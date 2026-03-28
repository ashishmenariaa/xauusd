const express = require('express');
const router = express.Router();

// Import controllers
const mt5Controller = require('../controllers/mt5Controller');
const scannerController = require('../controllers/scannerController');
const tradeController = require('../controllers/tradeController');
const journalController = require('../controllers/journalController');
const settingsController = require('../controllers/settingsController');
const chartController = require('../controllers/chartController');
const analysisController = require('../controllers/analysisController');

// Scanner routes
router.get('/scanner/status', scannerController.getStatus);
router.post('/scanner/start', scannerController.start);
router.post('/scanner/stop', scannerController.stop);
router.get('/scanner/state', scannerController.getScannerState);

// Trade routes

router.get('/trades', tradeController.getTrades);
router.get('/trades/active', tradeController.getActiveTrade);
router.get('/trades/:id', tradeController.getTrade);
router.post('/trades', tradeController.createTrade);
router.put('/trades/:id', tradeController.updateTrade);
router.delete('/trades/:id', tradeController.deleteTrade);
router.post('/trades/:id/close', tradeController.closeTrade);
router.get('/trades/stats/:period', tradeController.getStats);
// MT5 routes
router.get('/mt5/status', mt5Controller.getStatus);
router.get('/mt5/account', mt5Controller.getAccountInfo);
router.get('/mt5/positions', mt5Controller.getPositions);
router.get('/mt5/history', mt5Controller.getHistory);
router.post('/mt5/open', mt5Controller.openTrade);
router.post('/mt5/close', mt5Controller.closeTrade);
router.post('/mt5/modify', mt5Controller.modifyTrade);
// Journal routes
router.get('/journal', journalController.getEntries);
router.post('/journal', journalController.addEntry);
router.get('/journal/stats', journalController.getStats);
router.delete('/journal/:id', journalController.deleteEntry);

// Settings routes
router.get('/settings', settingsController.getSettings);
router.put('/settings', settingsController.updateSettings);
router.post('/settings/reset', settingsController.resetSettings);

// Chart & Data routes
router.get('/chart', chartController.getChartData);
router.get('/candles', chartController.getCandles);
router.get('/price', chartController.getCurrentPrice);
router.get('/market/overview', chartController.getMarketOverview);

// Analysis routes
router.get('/analysis/technical', analysisController.getTechnicalAnalysis);
router.get('/analysis/macro', analysisController.getMacroAnalysis);
router.get('/analysis/news', analysisController.getNews);
router.post('/analysis/backtest', analysisController.runBacktest);
router.get('/analysis/insights', analysisController.getInsights);
router.post('/analysis/weekly-review', analysisController.runWeeklyReview);

// Account routes
router.get('/account/balance', (req, res) => {
    res.json({ balance: global.appState.accountBalance || 1000 });
});

router.get('/account/performance', (req, res) => {
    const DatabaseQueries = require('../database/queries');
    DatabaseQueries.getTradingStats(30).then(stats => {
        res.json(stats);
    }).catch(error => {
        res.status(500).json({ error: error.message });
    });
});

// Health check
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        scanner: global.appState.scannerRunning,
        activeTrade: !!global.appState.activeTrade,
        uptime: process.uptime()
    });
});

const Signal = require('../models/Signal');

// Signals route
router.get('/signals', async (req, res) => {
    try {
        const signals = await Signal.find()
            .sort({ timestamp: -1 })
            .limit(50);

        res.json(signals);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
