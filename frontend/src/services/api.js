// Frontend API service for communicating with backend
class APIService {
    constructor() {
        this.baseURL = window.location.origin;
        this.sseConnection = null;
    }

    // Scanner endpoints
    async getScannerStatus() {
        return this.fetch('/api/scanner/status');
    }

    async startScanner() {
        return this.fetch('/api/scanner/start', { method: 'POST' });
    }

    async stopScanner() {
        return this.fetch('/api/scanner/stop', { method: 'POST' });
    }

    // Trade endpoints
    async getTrades(filter = {}) {
        const params = new URLSearchParams(filter);
        return this.fetch(`/api/trades?${params}`);
    }

    async getActiveTrade() {
        return this.fetch('/api/trades/active');
    }

    async createTrade(tradeData) {
        return this.fetch('/api/trades', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tradeData)
        });
    }

    async closeTrade(tradeId, closeData) {
        return this.fetch(`/api/trades/${tradeId}/close`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(closeData)
        });
    }

    // MT5 endpoints
    async getMT5Status() {
        return this.fetch('/api/mt5/status');
    }

    async getMT5Positions() {
        return this.fetch('/api/mt5/positions');
    }

    async closeMT5Position(ticket) {
        return this.fetch('/api/mt5/close', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticket })
        });
    }

    // Chart data
    async getChartData(timeframe = '5min', count = 100) {
        return this.fetch(`/api/chart?interval=${timeframe}&outputsize=${count}`);
    }

    async getCurrentPrice() {
        return this.fetch('/api/price');
    }

    // Settings
    async getSettings() {
        return this.fetch('/api/settings');
    }

    async updateSettings(settings) {
        return this.fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
    }

    // Journal and analysis
    async getJournal() {
        return this.fetch('/api/journal');
    }

    async getInsights() {
        return this.fetch('/api/analysis/insights');
    }

    // Server-Sent Events for real-time updates
    connectSSE(onMessage) {
        if (this.sseConnection) {
            this.sseConnection.close();
        }

        this.sseConnection = new EventSource('/api/events');

        this.sseConnection.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                onMessage(data);
            } catch (error) {
                console.error('SSE message parsing error:', error);
            }
        };

        this.sseConnection.onerror = (error) => {
            console.error('SSE connection error:', error);
            // Attempt reconnect after delay
            setTimeout(() => this.connectSSE(onMessage), 5000);
        };

        return this.sseConnection;
    }

    disconnectSSE() {
        if (this.sseConnection) {
            this.sseConnection.close();
            this.sseConnection = null;
        }
    }

    // Generic fetch method with error handling
    async fetch(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API call failed: ${endpoint}`, error);
            throw error;
        }
    }

    // Health check
    async healthCheck() {
        try {
            await this.fetch('/health');
            return true;
        } catch {
            return false;
        }
    }
}

// Create singleton instance
const apiService = new APIService();

export default apiService;
