const DatabaseQueries = require('../database/queries');
const { broadcastEvent, EventTypes } = require('../routes/events');
const mt5Service = require('../services/mt5Service');

class TradeController {
  async getTrades(req, res) {
    try {
      const { 
        limit = 50, 
        offset = 0, 
        status, 
        outcome,
        signal,
        startDate,
        endDate 
      } = req.query;
      
      let filter = {};
      
      if (status) filter.status = status;
      if (outcome) filter.outcome = outcome;
      if (signal) filter.signal = signal;
      
      if (startDate || endDate) {
        filter.timestamp = {};
        if (startDate) filter.timestamp.$gte = new Date(startDate);
        if (endDate) filter.timestamp.$lte = new Date(endDate);
      }
      
      const trades = await DatabaseQueries.getTrades(filter);
      const total = trades.length;
      const paginatedTrades = trades.slice(offset, offset + parseInt(limit));
      
      res.json({
        trades: paginatedTrades,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: offset + parseInt(limit) < total
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  
  async getActiveTrade(req, res) {
    try {
      const activeTrade = await DatabaseQueries.getActiveTrade();
      res.json(activeTrade);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  
  async getTrade(req, res) {
    try {
      const { id } = req.params;
      const trades = await DatabaseQueries.getTrades({ id });
      
      if (trades.length === 0) {
        return res.status(404).json({ error: 'Trade not found' });
      }
      
      res.json(trades[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  
  async createTrade(req, res) {
    try {
      const tradeData = req.body;
      
      // Validate required fields
      if (!tradeData.signal || !tradeData.entry || !tradeData.sl) {
        return res.status(400).json({ 
          error: 'Missing required fields: signal, entry, sl' 
        });
      }
      
      // Generate unique ID
      tradeData.id = `TRADE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      tradeData.timestamp = new Date();
      
      const trade = await DatabaseQueries.createTrade(tradeData);
      
      // If this is an OPEN trade, update global state
      if (trade.status === 'OPEN') {
        global.appState.activeTrade = trade;
        
        // Start monitoring if not already
        const scannerService = require('../services/scannerService');
        if (!global.appState.tradeMonitor) {
          global.appState.tradeMonitor = setInterval(
            () => scannerService.monitorActiveTrade(),
            30000 // Check every 30 seconds
          );
        }
        
        // Broadcast event
        broadcastEvent({
          type: EventTypes.TRADE_OPENED,
          trade: trade,
          message: `New ${trade.signal} trade opened @ ${trade.entry}`
        });
      }
      
      // Log to journal
      await DatabaseQueries.addJournalEntry({
        type: 'TRADE',
        category: 'ENTRY',
        title: 'Trade Created',
        message: `${trade.signal} trade created @ ${trade.entry}`,
        tradeId: trade.id,
        price: trade.entry,
        data: trade
      });
      
      res.status(201).json(trade);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  
  async updateTrade(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const trades = await DatabaseQueries.getTrades({ id });
      if (trades.length === 0) {
        return res.status(404).json({ error: 'Trade not found' });
      }
      
      const trade = await DatabaseQueries.updateTrade(trades[0]._id, updates);
      
      // If updating active trade, update global state
      if (global.appState.activeTrade && global.appState.activeTrade.id === id) {
        global.appState.activeTrade = trade;
      }
      
      // Broadcast event
      broadcastEvent({
        type: EventTypes.TRADE_MODIFIED,
        trade: trade,
        message: `Trade ${id} updated`
      });
      
      res.json(trade);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  
  async deleteTrade(req, res) {
    try {
      const { id } = req.params;
      const trades = await DatabaseQueries.getTrades({ id });
      
      if (trades.length === 0) {
        return res.status(404).json({ error: 'Trade not found' });
      }
      
      // If this is the active trade, clear it
      if (global.appState.activeTrade && global.appState.activeTrade.id === id) {
        global.appState.activeTrade = null;
      }
      
      // Soft delete by marking as CANCELLED
      await DatabaseQueries.updateTrade(trades[0]._id, {
        status: 'CANCELLED',
        outcome: 'CANCELLED',
        exitNote: 'Manually deleted by user'
      });
      
      res.json({ success: true, message: 'Trade marked as cancelled' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  
  async closeTrade(req, res) {
    try {
      const { id } = req.params;
      const { exitPrice, outcome, exitNote } = req.body;
      
      const trades = await DatabaseQueries.getTrades({ id });
      if (trades.length === 0) {
        return res.status(404).json({ error: 'Trade not found' });
      }
      
      const trade = trades[0];
      
      // Calculate P&L
      const entry = parseFloat(trade.entry);
      const exit = parseFloat(exitPrice);
      const pnl = trade.signal === 'BUY' 
        ? (exit - entry) 
        : (entry - exit);
      
      // Update trade
      const updates = {
        status: 'CLOSED',
        exitPrice: exit,
        exitTime: new Date(),
        outcome: outcome || (pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN'),
        pnl: pnl.toFixed(2),
        exitNote: exitNote || 'Manually closed'
      };
      
      const updatedTrade = await DatabaseQueries.updateTrade(trade._id, updates);
      
      // If this was the active trade, clear it
      if (global.appState.activeTrade && global.appState.activeTrade.id === id) {
        global.appState.activeTrade = null;
        
        // Stop monitoring if no active trades
        const activeTrades = await DatabaseQueries.getTrades({ status: 'OPEN' });
        if (activeTrades.length === 0 && global.appState.tradeMonitor) {
          clearInterval(global.appState.tradeMonitor);
          global.appState.tradeMonitor = null;
        }
      }
      
      // Close MT5 position if exists
      if (trade.mt5Ticket) {
        try {
          await mt5Service.closeTrade(trade.mt5Ticket);
        } catch (mt5Error) {
          console.warn('Failed to close MT5 trade:', mt5Error.message);
        }
      }
      
      // Broadcast event
      broadcastEvent({
        type: EventTypes.TRADE_CLOSED,
        trade: updatedTrade,
        message: `Trade closed: ${updatedTrade.outcome} | P&L: ${updatedTrade.pnl}`
      });
      
      // Log to journal
      await DatabaseQueries.addJournalEntry({
        type: 'TRADE',
        category: 'EXIT',
        title: 'Trade Closed',
        message: `${trade.signal} trade closed @ ${exit} | ${updates.outcome} | P&L: ${pnl.toFixed(2)}`,
        tradeId: trade.id,
        price: exit,
        data: updatedTrade
      });
      
      res.json(updatedTrade);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  
  async getStats(req, res) {
    try {
      const { period } = req.params; // daily, weekly, monthly, yearly
      const days = {
        daily: 1,
        weekly: 7,
        monthly: 30,
        yearly: 365
      }[period] || 30;
      
      const stats = await DatabaseQueries.getTradingStats(days);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new TradeController();
