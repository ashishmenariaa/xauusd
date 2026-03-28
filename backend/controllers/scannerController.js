const scannerService = require('../services/scannerService');
const DatabaseQueries = require('../database/queries');
const { broadcastEvent, EventTypes } = require('../routes/events');

class ScannerController {
  async getStatus(req, res) {
    try {
      const status = {
        running: global.appState.scannerRunning,
        lastScan: global.appState.lastScanTime,
        nextScan: global.appState.nextScanTime,
        scansToday: global.appState.scansToday || 0,
        activeTrade: !!global.appState.activeTrade,
        marketData: global.appState.marketData ? {
          price: global.appState.marketData.price,
          timestamp: global.appState.marketData.timestamp
        } : null
      };
      
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  
  async start(req, res) {
    try {
      if (global.appState.scannerRunning) {
        return res.json({ message: 'Scanner is already running' });
      }
      
      await scannerService.start();
      global.appState.scannerRunning = true;
      
      // Log to journal
      await DatabaseQueries.addJournalEntry({
        type: 'SYSTEM',
        category: 'SETUP',
        title: 'Scanner Started',
        message: 'AI Scanner has been started',
        priority: 3
      });
      
      // Broadcast event
      broadcastEvent({
        type: EventTypes.SCANNER_STARTED,
        message: 'Scanner started successfully',
        timestamp: new Date().toISOString()
      });
      
      res.json({ 
        success: true, 
        message: 'Scanner started successfully',
        nextScan: global.appState.nextScanTime
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  
  async stop(req, res) {
    try {
      if (!global.appState.scannerRunning) {
        return res.json({ message: 'Scanner is not running' });
      }
      
      await scannerService.stop();
      global.appState.scannerRunning = false;
      
      // Log to journal
      await DatabaseQueries.addJournalEntry({
        type: 'SYSTEM',
        category: 'SETUP',
        title: 'Scanner Stopped',
        message: 'AI Scanner has been stopped',
        priority: 3
      });
      
      // Broadcast event
      broadcastEvent({
        type: EventTypes.SCANNER_STOPPED,
        message: 'Scanner stopped',
        timestamp: new Date().toISOString()
      });
      
      res.json({ 
        success: true, 
        message: 'Scanner stopped successfully'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  
  async getScannerState(req, res) {
    try {
      const state = await scannerService.getState();
      res.json(state);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new ScannerController();
