const RiskManager = require('./riskManager');
const MT5Service = require('../backend/services/mt5Service');
const DatabaseQueries = require('../backend/database/queries');
const Helpers = require('../backend/utils/helpers');

class TradeManager {
    constructor() {
        this.activeTrades = new Map();
        this.tradeMonitor = null;
        this.isMonitoring = false;
    }

    async openTrade(tradeSignal) {
        try {
            // Risk check
            const riskCheck = await RiskManager.canOpenTrade(tradeSignal);
            if (!riskCheck.canTrade) {
                throw new Error(`Risk check failed: ${riskCheck.failedChecks.join(', ')}`);
            }

            // Create trade record
            const tradeData = {
                id: Helpers.generateId('TRADE_'),
                timestamp: new Date(),
                symbol: 'XAUUSD',
                signal: tradeSignal.direction.toUpperCase(),
                entry: tradeSignal.entry,
                sl: tradeSignal.stopLoss,
                tp1: tradeSignal.takeProfit,
                tp2: tradeSignal.takeProfit * 1.5, // Extended TP
                confidence: tradeSignal.confidence,
                lotSize: tradeSignal.position.lotSize,
                riskAmount: tradeSignal.position.riskAmount,
                status: 'PENDING',
                factors: tradeSignal.rationale || []
            };

            // Execute via MT5 if auto-trading enabled
            const settings = require('../backend/config/defaultSettings');
            if (settings.autoTrade) {
                const mt5Result = await MT5Service.openTrade({
                    symbol: 'XAUUSD',
                    direction: tradeSignal.direction.toUpperCase(),
                    lotSize: tradeSignal.position.lotSize,
                    sl: tradeSignal.stopLoss,
                    tp: tradeSignal.takeProfit
                });

                if (mt5Result.success) {
                    tradeData.mt5Ticket = mt5Result.ticket;
                    tradeData.status = 'OPEN';
                    tradeData.entry = mt5Result.price; // Actual execution price
                } else {
                    throw new Error(`MT5 execution failed: ${mt5Result.error}`);
                }
            } else {
                tradeData.status = 'OPEN'; // Simulated trade
            }

            // Save to database
            const trade = await DatabaseQueries.createTrade(tradeData);
            
            // Add to active trades
            this.activeTrades.set(trade.id, trade);
            
            // Start monitoring if not already
            if (!this.isMonitoring) {
                this.startTradeMonitoring();
            }

            // Log trade opening
            await DatabaseQueries.addJournalEntry({
                type: 'TRADE',
                category: 'ENTRY',
                title: `Trade Opened - ${tradeSignal.direction.toUpperCase()}`,
                message: `Trade ${trade.id} opened @ ${trade.entry}`,
                tradeId: trade.id,
                data: trade,
                priority: 4
            });

            return trade;

        } catch (error) {
            console.error('Trade opening error:', error);
            
            await DatabaseQueries.addJournalEntry({
                type: 'ERROR',
                category: 'TRADING',
                title: 'Trade Opening Failed',
                message: error.message,
                priority: 4
            });
            
            throw error;
        }
    }

    async closeTrade(tradeId, closeReason = 'Manual close') {
        try {
            const trade = this.activeTrades.get(tradeId);
            if (!trade) {
                throw new Error(`Trade ${tradeId} not found in active trades`);
            }

            // Get current price for P&L calculation
            const currentPrice = await this.getCurrentPrice();
            const isBuy = trade.signal === 'BUY';
            const pnl = isBuy ? (currentPrice - trade.entry) : (trade.entry - currentPrice);

            // Close MT5 position if exists
            if (trade.mt5Ticket) {
                await MT5Service.closeTrade(trade.mt5Ticket);
            }

            // Update trade record
            const updatedTrade = await DatabaseQueries.updateTrade(trade._id, {
                status: 'CLOSED',
                exitPrice: currentPrice,
                exitTime: new Date(),
                outcome: pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN',
                pnl: pnl.toFixed(2),
                exitNote: closeReason
            });

            // Remove from active trades
            this.activeTrades.delete(tradeId);

            // Stop monitoring if no active trades
            if (this.activeTrades.size === 0) {
                this.stopTradeMonitoring();
            }

            // Log trade closure
            await DatabaseQueries.addJournalEntry({
                type: 'TRADE',
                category: 'EXIT',
                title: `Trade Closed - ${updatedTrade.outcome}`,
                message: `Trade ${tradeId} closed @ ${currentPrice} | P&L: ${pnl.toFixed(2)}`,
                tradeId: tradeId,
                data: updatedTrade,
                priority: 4
            });

            return updatedTrade;

        } catch (error) {
            console.error('Trade closing error:', error);
            throw error;
        }
    }

    async modifyTrade(tradeId, modifications) {
        try {
            const trade = this.activeTrades.get(tradeId);
            if (!trade) {
                throw new Error(`Trade ${tradeId} not found`);
            }

            // Update MT5 if active ticket
            if (trade.mt5Ticket && modifications.sl) {
                await MT5Service.modifySL(trade.mt5Ticket, modifications.sl);
            }

            // Update database
            const updatedTrade = await DatabaseQueries.updateTrade(trade._id, modifications);

            // Update local copy
            this.activeTrades.set(tradeId, { ...trade, ...modifications });

            await DatabaseQueries.addJournalEntry({
                type: 'TRADE',
                category: 'MODIFY',
                title: 'Trade Modified',
                message: `Trade ${tradeId} modified: ${JSON.stringify(modifications)}`,
                tradeId: tradeId,
                data: modifications,
                priority: 3
            });

            return updatedTrade;

        } catch (error) {
            console.error('Trade modification error:', error);
            throw error;
        }
    }

    startTradeMonitoring() {
        if (this.isMonitoring) return;

        this.isMonitoring = true;
        this.tradeMonitor = setInterval(async () => {
            await this.monitorActiveTrades();
        }, 30000); // Check every 30 seconds

        console.log('Trade monitoring started');
    }

    stopTradeMonitoring() {
        if (!this.isMonitoring) return;

        this.isMonitoring = false;
        if (this.tradeMonitor) {
            clearInterval(this.tradeMonitor);
            this.tradeMonitor = null;
        }

        console.log('Trade monitoring stopped');
    }

    async monitorActiveTrades() {
        for (const [tradeId, trade] of this.activeTrades.entries()) {
            try {
                const currentPrice = await this.getCurrentPrice();
                
                // Update current price and P&L
                const isBuy = trade.signal === 'BUY';
                const livePnl = isBuy ? (currentPrice - trade.entry) : (trade.entry - currentPrice);
                
                await DatabaseQueries.updateTrade(trade._id, {
                    currentPrice,
                    livePnl: livePnl.toFixed(2)
                });

                // Check if trade should be closed
                const closeCheck = await RiskManager.shouldCloseTrade(trade, currentPrice);
                if (closeCheck.shouldClose) {
                    await this.closeTrade(tradeId, closeCheck.reason);
                    continue;
                }

                // Check for TP1 hit to move SL to breakeven
                if (!trade.tp1Hit) {
                    const tp1Hit = isBuy ? currentPrice >= trade.tp1 : currentPrice <= trade.tp1;
                    if (tp1Hit) {
                        await this.modifyTrade(tradeId, {
                            tp1Hit: true,
                            sl: trade.entry // Move to breakeven
                        });
                    }
                }

            } catch (error) {
                console.error(`Error monitoring trade ${tradeId}:`, error);
            }
        }
    }

    async getCurrentPrice() {
        try {
            const fetch = require('node-fetch');
            const config = require('../backend/config');
            
            const response = await fetch(`https://api.twelvedata.com/price?symbol=XAU/USD&apikey=${config.twelveDataKey}`);
            const data = await response.json();
            
            return parseFloat(data.price);
        } catch (error) {
            throw new Error(`Failed to get current price: ${error.message}`);
        }
    }

    getActiveTrades() {
        return Array.from(this.activeTrades.values());
    }

    getTrade(tradeId) {
        return this.activeTrades.get(tradeId);
    }

    async getTradeStatistics() {
        const trades = await DatabaseQueries.getTrades({ status: 'CLOSED' });
        
        const stats = {
            total: trades.length,
            wins: trades.filter(t => t.outcome === 'WIN').length,
            losses: trades.filter(t => t.outcome === 'LOSS').length,
            breakEven: trades.filter(t => t.outcome === 'BREAKEVEN').length,
            totalPnL: trades.reduce((sum, t) => sum + (t.pnl || 0), 0),
            winRate: trades.length > 0 ? 
                (trades.filter(t => t.outcome === 'WIN').length / trades.length * 100) : 0
        };

        stats.avgPnL = stats.total > 0 ? stats.totalPnL / stats.total : 0;
        stats.avgWin = stats.wins > 0 ? 
            trades.filter(t => t.outcome === 'WIN').reduce((sum, t) => sum + (t.pnl || 0), 0) / stats.wins : 0;
        stats.avgLoss = stats.losses > 0 ? 
            trades.filter(t => t.outcome === 'LOSS').reduce((sum, t) => sum + (t.pnl || 0), 0) / stats.losses : 0;

        return stats;
    }
}

module.exports = new TradeManager();
