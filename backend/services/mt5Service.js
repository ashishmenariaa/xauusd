const Helpers = require('../utils/helpers');
const DatabaseQueries = require('../database/queries');

class MT5Service {
    constructor() {
        // Use config instead of global.appState which isn't available during module load
        const config = require('../config');
        this.baseUrl = config.mt5BridgeUrl || 'http://localhost:5000';
        this.timeout = 10000; // 10 second timeout
    }
    
    async checkConnection() {
        try {
            const response = await fetch(`${this.baseUrl}/status`, {
                timeout: this.timeout
            });
            
            if (!response.ok) {
                throw new Error(`MT5 bridge responded with status: ${response.status}`);
            }
            
            const data = await response.json();
            return {
                connected: data.connected || false,
                account: data.login ? `Acc: ${data.login}` : 'No account info',
                balance: data.balance || 0,
                error: data.error
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message
            };
        }
    }
    
    async openTrade(tradeData) {
        try {
            const response = await fetch(`${this.baseUrl}/open-trade`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    symbol: tradeData.symbol || 'XAUUSD',
                    direction: tradeData.signal,
                    lotSize: tradeData.lotSize || 0.01,
                    sl: tradeData.sl,
                    tp: tradeData.tp2, // Use TP2 for MT5
                    comment: tradeData.mt5Comment || `AI ${tradeData.signal}`
                }),
                timeout: this.timeout
            });
            
            if (!response.ok) {
                throw new Error(`MT5 open trade failed: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Unknown MT5 error');
            }
            
            // Log successful trade execution
            await DatabaseQueries.addJournalEntry({
                type: 'TRADE',
                category: 'EXECUTION',
                title: 'MT5 Trade Opened',
                message: `MT5 trade opened: ${tradeData.signal} @ ${result.price} | Ticket: ${result.ticket}`,
                tradeId: tradeData.id,
                data: result
            });
            
            return result;
            
        } catch (error) {
            // Log MT5 error
            await DatabaseQueries.addJournalEntry({
                type: 'ERROR',
                title: 'MT5 Trade Error',
                message: `Failed to open MT5 trade: ${error.message}`,
                tradeId: tradeData.id,
                priority: 4
            });
            
            throw error;
        }
    }
    
    async closeTrade(ticket) {
        try {
            const response = await fetch(`${this.baseUrl}/close-trade`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ticket: ticket,
                    symbol: 'XAUUSD'
                }),
                timeout: this.timeout
            });
            
            if (!response.ok) {
                throw new Error(`MT5 close trade failed: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Unknown MT5 error');
            }
            
            // Log successful close
            await DatabaseQueries.addJournalEntry({
                type: 'TRADE',
                category: 'EXECUTION',
                title: 'MT5 Trade Closed',
                message: `MT5 trade closed: Ticket ${ticket} | P&L: ${result.profit || 0}`,
                data: result
            });
            
            return result;
            
        } catch (error) {
            // Log MT5 error
            await DatabaseQueries.addJournalEntry({
                type: 'ERROR',
                title: 'MT5 Close Error',
                message: `Failed to close MT5 trade ${ticket}: ${error.message}`,
                priority: 4
            });
            
            throw error;
        }
    }
    
    async modifySL(ticket, newSL) {
        try {
            const response = await fetch(`${this.baseUrl}/modify-sl`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ticket: ticket,
                    sl: newSL,
                    symbol: 'XAUUSD'
                }),
                timeout: this.timeout
            });
            
            if (!response.ok) {
                throw new Error(`MT5 modify SL failed: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Unknown MT5 error');
            }
            
            return result;
            
        } catch (error) {
            console.error('MT5 modify SL error:', error);
            throw error;
        }
    }
    
    async getPositions() {
        try {
            const response = await fetch(`${this.baseUrl}/positions`, {
                timeout: this.timeout
            });
            
            if (!response.ok) {
                throw new Error(`MT5 get positions failed: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('MT5 get positions error:', error);
            return [];
        }
    }
    
    async getAccountInfo() {
        try {
            const response = await fetch(`${this.baseUrl}/status`, {
                timeout: this.timeout
            });
            
            if (!response.ok) {
                throw new Error(`MT5 get account info failed: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Update global account balance if available
            if (data.balance && data.balance > 0 && global.appState) {
                global.appState.accountBalance = data.balance;
                if (global.appState.settings) {
                    global.appState.settings.accountBalance = data.balance;
                }
            }
            
            return data;
        } catch (error) {
            console.error('MT5 get account info error:', error);
            return null;
        }
    }
    
    async getHistory(days = 7) {
        try {
            // MT5 bridge might not have date filtering, so we'll filter client-side
            const response = await fetch(`${this.baseUrl}/account-history`, {
                timeout: this.timeout
            });
            
            if (!response.ok) {
                throw new Error(`MT5 get history failed: ${response.status}`);
            }
            
            const history = await response.json();
            
            // Filter by date
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            
            return history.filter(trade => {
                const tradeDate = new Date(trade.time);
                return tradeDate >= cutoffDate;
            });
        } catch (error) {
            console.error('MT5 get history error:', error);
            return [];
        }
    }
}

module.exports = new MT5Service();
