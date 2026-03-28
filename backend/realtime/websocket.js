const WebSocket = require('ws');

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });
  
  wss.on('connection', (ws, req) => {
    console.log('🔗 New WebSocket connection');
    
    // Send initial state
    ws.send(JSON.stringify({
      type: 'INITIAL_STATE',
      scannerRunning: global.appState.scannerRunning,
      activeTrade: global.appState.activeTrade,
      marketData: global.appState.marketData
    }));
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        handleWebSocketMessage(ws, data);
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'ERROR',
          message: 'Invalid message format'
        }));
      }
    });
    
    ws.on('close', () => {
      console.log('🔗 WebSocket connection closed');
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });
  
  console.log('✅ WebSocket server setup complete');
}

function handleWebSocketMessage(ws, data) {
  const { type, payload } = data;
  
  switch (type) {
    case 'PING':
      ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      break;
      
    case 'GET_STATE':
      ws.send(JSON.stringify({
        type: 'STATE_UPDATE',
        scannerRunning: global.appState.scannerRunning,
        activeTrade: global.appState.activeTrade,
        marketData: global.appState.marketData
      }));
      break;
      
    case 'SUBSCRIBE_PRICE':
      // Implement price subscription logic
      break;
      
    default:
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: `Unknown message type: ${type}`
      }));
  }
}

function broadcastToWebSockets(event) {
  // This would broadcast to all connected WebSocket clients
  // Implementation depends on specific requirements
}

module.exports = {
  setupWebSocket,
  broadcastToWebSockets
};
