'use strict';

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const http       = require('http');
const path       = require('path');

// ─── Engine (singleton exported by the module) ───────────────────────────────
const engine = require('../trading-engine');
// 🔥 CONNECT ENGINE TO SSE
engine.onSignalUpdate = (data) => {
    broadcastSSE({
        type: 'SIGNAL_UPDATE',
        data
    });
};
// ─── App bootstrap ───────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend/src')));

// ─── SSE helpers ─────────────────────────────────────────────────────────────
// Minimal client registry used only by the /api/events SSE stream.
const sseClients = new Map(); // id → res

function broadcastSSE(payload) {
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of sseClients.values()) {
        res.write(data);
    }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// ── Health ────────────────────────────────────────────────────────────────────
app.get(['/health', '/api/health'], (req, res) => {
    res.json({
        status:      'ok',
        timestamp:   new Date().toISOString(),
        scanner:     engine.isRunning,
        activeTrade: engine.isRunning
            ? engine.components.tradeManager.getActiveTrades().length > 0
            : false,
        uptime: process.uptime()
    });
});

// ── Price ─────────────────────────────────────────────────────────────────────
// Pulls live price from MarketDataService; falls back to empty object on error.
app.get('/api/price', async (req, res) => {
    try {
        const price = await engine.components.marketData.getCurrentPrice();

        res.json({
            current: price ?? null
        });

    } catch (err) {
        console.error('[/api/price]', err.message);

        res.json({
            current: null
        });
    }
});

// ── Signal ────────────────────────────────────────────────────────────────────
// Returns the latest scan result from the scanner component.
// getScannerStatus() is synchronous per the engine source.



// ── Scanner control ───────────────────────────────────────────────────────────
app.get('/api/scanner/status', (req, res) => {
    res.json({ running: engine.isRunning });
});

app.post('/api/scanner/start', async (req, res) => {
    try {
        if (!engine.isRunning) await engine.start();
        res.json({ success: true, running: engine.isRunning });
    } catch (err) {
        console.error('[/api/scanner/start]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/scanner/stop', async (req, res) => {
    try {
        if (engine.isRunning) await engine.stop();
        res.json({ success: true, running: engine.isRunning });
    } catch (err) {
        console.error('[/api/scanner/stop]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── Full engine status ────────────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
    try {
        res.json(engine.getStatus());
    } catch (err) {
        console.error('[/api/status]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Analysis (on-demand full scan) ────────────────────────────────────────────
app.get('/api/analysis', async (req, res) => {
    try {
        if (!engine.isRunning) {
            return res.status(503).json({ error: 'Engine is not running' });
        }
        const analysis = await engine.getAnalysis();
        res.json(analysis);
    } catch (err) {
        console.error('[/api/analysis]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Manual trade ──────────────────────────────────────────────────────────────
app.post('/api/trade/manual', async (req, res) => {
    try {
        const result = await engine.manualTrade(req.body);
        res.json({ success: true, trade: result });
    } catch (err) {
        console.error('[/api/trade/manual]', err.message);
        res.status(400).json({ success: false, error: err.message });
    }
});

// ── Active trades ─────────────────────────────────────────────────────────────
app.get('/api/trades', (req, res) => {
    try {
        const trades = engine.isRunning
            ? engine.components.tradeManager.getActiveTrades()
            : [];
        res.json(trades);
    } catch (err) {
        console.error('[/api/trades]', err.message);
        res.json([]);
    }
});

// ── Risk metrics ──────────────────────────────────────────────────────────────
app.get('/api/risk', (req, res) => {
    try {
        const metrics = engine.isRunning
            ? engine.components.riskManager.getRiskMetrics()
            : {};
        res.json(metrics);
    } catch (err) {
        console.error('[/api/risk]', err.message);
        res.json({});
    }
});

// ── MT5 status ────────────────────────────────────────────────────────────────
// Keep this endpoint; wire to tradeManager once MT5 bridge exposes account info.
app.get('/api/mt5/status', (req, res) => {
    try {
        // TODO: replace with engine.components.tradeManager.getAccountInfo()
        //       once that method is implemented in the trade manager.
        res.json({ connected: engine.isRunning });
    } catch (err) {
        res.json({ connected: false });
    }
});

// ── Journal ───────────────────────────────────────────────────────────────────
app.get('/api/journal', async (req, res) => {
    try {
        const DatabaseQueries = require('./database/queries');
        const entries = await DatabaseQueries.getJournalEntries(req.query);
        res.json(entries ?? []);
    } catch (err) {
        console.error('[/api/journal]', err.message);
        res.json([]);
    }
});

// ── Settings ──────────────────────────────────────────────────────────────────
// Settings are persisted via the database; fall back to state if DB unavailable.
app.get('/api/settings', async (req, res) => {
    try {
        const DatabaseQueries = require('./database/queries');
        const settings = await DatabaseQueries.getSettings();
        res.json(settings ?? {});
    } catch (err) {
        console.error('[/api/settings]', err.message);
        res.json({});
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        const DatabaseQueries = require('./database/queries');
        const saved = await DatabaseQueries.saveSettings(req.body);
        res.json({ success: true, settings: saved });
    } catch (err) {
        console.error('[/api/settings POST]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── SSE – real-time price stream ──────────────────────────────────────────────
app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type',                'text/event-stream');
    res.setHeader('Cache-Control',               'no-cache');
    res.setHeader('Connection',                  'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const clientId = Date.now();
    sseClients.set(clientId, res);

    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date() })}\n\n`);

    // Push live price every 5 seconds.
    const interval = setInterval(async () => {
        try {
            const price = await engine.components.marketData.getCurrentPrice();
            if (price) {
                res.write(`data: ${JSON.stringify({ type: 'PRICE_UPDATE', ...price, timestamp: new Date() })}\n\n`);
            }
        } catch {
            // Silently skip if market data is temporarily unavailable.
        }
    }, 5000);

    req.on('close', () => {
        clearInterval(interval);
        sseClients.delete(clientId);
    });
});

// ── Catch-all → index.html ────────────────────────────────────────────────────
// app.get('*', (req, res) => {
//     res.sendFile(path.join(__dirname, '../frontend/src/index.html'));
// });

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    console.error('[Unhandled error]', err);
    res.status(500).json({
        error:   'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ─── Server start + engine boot ───────────────────────────────────────────────
const connectDB = require('./database/db');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        console.log("🔌 Connecting to MongoDB...");

        // ✅ 1. CONNECT DATABASE FIRST
        await connectDB();

        console.log("✅ MongoDB connected");

        // ✅ 2. START SERVER
        server.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`🌐 Frontend : http://localhost:${PORT}`);
            console.log(`📡 API      : http://localhost:${PORT}/api`);
            console.log(`🔗 Events   : http://localhost:${PORT}/api/events`);
        });

        // ✅ 3. START ENGINE AFTER DB
        console.log("🚀 Starting trading engine...");
        await engine.start();

    } catch (err) {
        console.error('❌ Startup failed:', err.message);
    }
};

startServer();

// ─── Graceful shutdown ────────────────────────────────────────────────────────
async function gracefulShutdown(signal) {
    console.log(`\n🛑 ${signal} received — shutting down...`);

    // Drain SSE clients
    for (const res of sseClients.values()) {
        try { res.end(); } catch { /* ignore */ }
    }
    sseClients.clear();

    // Stop engine first so open trades are closed cleanly
    if (engine.isRunning) {
        try { await engine.stop(); } catch (err) {
            console.error('Error during engine shutdown:', err.message);
        }
    }

    server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
    });

    // Force-exit if graceful shutdown takes too long
    setTimeout(() => {
        console.error('⚠️  Forced exit after timeout');
        process.exit(1);
    }, 10_000);
}
const Signal = require('./models/Signal');

const { state } = require('../trading-engine/config');

app.get('/api/signal', (req, res) => {
    try {
        res.json({
            success: true,
            data: state.latestAIResult || null
        });
    } catch (err) {
        console.error('/api/signal error:', err.message);
        res.json({
            success: false,
            data: null
        });
    }
});
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));