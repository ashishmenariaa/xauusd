const express = require('express');
const router = express.Router();

// Store connected clients
const clients = new Set();

// SSE endpoint
router.get('/', (req, res) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    
    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);
    
    // Add client to set
    const clientId = Date.now();
    clients.add({ id: clientId, res });
    
    console.log(`📡 New SSE client connected: ${clientId}`);
    
    // Send initial state
    const initialState = {
        type: 'INITIAL_STATE',
        scannerRunning: global.appState.scannerRunning,
        activeTrade: global.appState.activeTrade,
        marketData: global.appState.marketData,
        settings: global.appState.settings
    };
    res.write(`data: ${JSON.stringify(initialState)}\n\n`);
    
    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
        try {
            res.write(': heartbeat\n\n');
        } catch (err) {
            clearInterval(heartbeat);
        }
    }, 30000);
    
    // Remove client on disconnect
    req.on('close', () => {
        clearInterval(heartbeat);
        clients.forEach(client => {
            if (client.id === clientId) {
                clients.delete(client);
            }
        });
        console.log(`📡 SSE client disconnected: ${clientId}`);
    });
});

// Function to broadcast events to all clients
function broadcastEvent(event) {
    const eventData = JSON.stringify({
        ...event,
        timestamp: new Date().toISOString()
    });
    
    const deadClients = [];
    
    clients.forEach(client => {
        try {
            client.res.write(`data: ${eventData}\n\n`);
        } catch (err) {
            deadClients.push(client);
        }
    });
    
    // Clean up dead clients
    deadClients.forEach(client => clients.delete(client));
}

// Event types
const EventTypes = {
    MARKET_UPDATE: 'MARKET_UPDATE',
    AI_DECISION: 'AI_DECISION',
    TRADE_OPENED: 'TRADE_OPENED',
    TRADE_CLOSED: 'TRADE_CLOSED',
    TRADE_MODIFIED: 'TRADE_MODIFIED',
    SCANNER_STARTED: 'SCANNER_STARTED',
    SCANNER_STOPPED: 'SCANNER_STOPPED',
    PRICE_UPDATE: 'PRICE_UPDATE',
    NEWS_UPDATE: 'NEWS_UPDATE',
    ERROR: 'ERROR',
    WARNING: 'WARNING',
    INFO: 'INFO'
};


