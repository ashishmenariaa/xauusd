// This file would contain the MT5 bridge communication logic
// Since we already have MT5 service in backend, this is for trading engine specific needs

class MT5Bridge {
    constructor() {
        this.isConnected = false;
        this.connectionStatus = 'disconnected';
    }

    async connect() {
        try {
            const response = await fetch('http://localhost:5000/status');
            const data = await response.json();
            
            this.isConnected = data.connected || false;
            this.connectionStatus = this.isConnected ? 'connected' : 'disconnected';
            
            return this.isConnected;
        } catch (error) {
            this.connectionStatus = 'error';
            throw new Error(`MT5 bridge connection failed: ${error.message}`);
        }
    }

    async executeOrder(orderParams) {
        if (!this.isConnected) {
            await this.connect();
        }

        try {
            const response = await fetch('http://localhost:5000/open-trade', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderParams)
            });

            const result = await response.json();
            return result;
        } catch (error) {
            throw new Error(`Order execution failed: ${error.message}`);
        }
    }

    async closePosition(ticket) {
        try {
            const response = await fetch('http://localhost:5000/close-trade', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ticket })
            });

            const result = await response.json();
            return result;
        } catch (error) {
            throw new Error(`Position close failed: ${error.message}`);
        }
    }

    async getPositions() {
        try {
            const response = await fetch('http://localhost:5000/positions');
            const positions = await response.json();
            return positions;
        } catch (error) {
            throw new Error(`Failed to get positions: ${error.message}`);
        }
    }

    async getAccountInfo() {
        try {
            const response = await fetch('http://localhost:5000/status');
            const info = await response.json();
            return info;
        } catch (error) {
            throw new Error(`Failed to get account info: ${error.message}`);
        }
    }
}

module.exports = new MT5Bridge();
