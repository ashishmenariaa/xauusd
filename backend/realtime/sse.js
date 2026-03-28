const clients = new Set();

function setupSSE(app) {
  // SSE endpoint is already handled in routes/events.js
  // This function is for additional SSE setup if needed
  console.log('✅ SSE service setup complete');
}

function broadcastToClients(event) {
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

function addClient(client) {
  clients.add(client);
}

function removeClient(client) {
  clients.delete(client);
}

module.exports = {
  setupSSE,
  broadcastToClients,
  addClient,
  removeClient,
  clients
};
