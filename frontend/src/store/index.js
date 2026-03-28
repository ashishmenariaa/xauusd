// Frontend state management
import { writable, derived } from 'svelte/store';

// Reactive stores for application state
export const scannerState = writable({
    running: false,
    lastScan: null,
    activeTrade: null,
    marketData: null
});

export const trades = writable([]);
export const journalEntries = writable([]);
export const settings = writable({});
export const mt5Status = writable({ connected: false });
export const currentPrice = writable(0);
export const aiAnalysis = writable(null);
export const notifications = writable([]);

// Derived state
export const activeTrades = derived(trades, $trades => 
    $trades.filter(trade => trade.status === 'OPEN')
);

export const todayStats = derived(trades, $trades => {
    const today = new Date().toDateString();
    const todayTrades = $trades.filter(trade => 
        new Date(trade.timestamp).toDateString() === today
    );
    
    const wins = todayTrades.filter(t => t.outcome === 'WIN').length;
    const losses = todayTrades.filter(t => t.outcome === 'LOSS').length;
    const pnl = todayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    
    return {
        total: todayTrades.length,
        wins,
        losses,
        pnl,
        winRate: todayTrades.length > 0 ? (wins / todayTrades.length * 100) : 0
    };
});

export const performanceMetrics = derived(trades, $trades => {
    const closedTrades = $trades.filter(t => t.status === 'CLOSED');
    
    if (closedTrades.length === 0) {
        return {
            winRate: 0,
            totalPnL: 0,
            avgWin: 0,
            avgLoss: 0
        };
    }
    
    const wins = closedTrades.filter(t => t.outcome === 'WIN');
    const losses = closedTrades.filter(t => t.outcome === 'LOSS');
    
    const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winRate = (wins.length / closedTrades.length) * 100;
    const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + (t.pnl || 0), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + (t.pnl || 0), 0) / losses.length : 0;
    
    return {
        winRate,
        totalPnL,
        avgWin,
        avgLoss,
        profitFactor: avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : Infinity
    };
});

// Action functions
export const appActions = {
    async initialize() {
        try {
            // Load initial data
            const [settingsData, tradesData, journalData, mt5Data] = await Promise.all([
                apiService.getSettings(),
                apiService.getTrades(),
                apiService.getJournal(),
                apiService.getMT5Status()
            ]);
            
            settings.set(settingsData);
            trades.set(tradesData.trades || []);
            journalEntries.set(journalData);
            mt5Status.set(mt5Data);
            
            // Start price updates
            this.startPriceUpdates();
            
        } catch (error) {
            console.error('Initialization failed:', error);
            notifications.update(n => [...n, {
                type: 'error',
                message: 'Failed to initialize application',
                timestamp: new Date()
            }]);
        }
    },
    
    async startPriceUpdates() {
        setInterval(async () => {
            try {
                const priceData = await apiService.getCurrentPrice();
                currentPrice.set(parseFloat(priceData.price));
            } catch (error) {
                console.error('Price update failed:', error);
            }
        }, 5000); // Update every 5 seconds
    },
    
    async toggleScanner() {
        const $scannerState = get(scannerState);
        
        try {
            if ($scannerState.running) {
                await apiService.stopScanner();
                scannerState.update(state => ({ ...state, running: false }));
            } else {
                await apiService.startScanner();
                scannerState.update(state => ({ ...state, running: true }));
            }
        } catch (error) {
            console.error('Scanner toggle failed:', error);
            notifications.update(n => [...n, {
                type: 'error',
                message: `Failed to ${$scannerState.running ? 'stop' : 'start'} scanner`,
                timestamp: new Date()
            }]);
        }
    },
    
    async refreshTrades() {
        try {
            const tradesData = await apiService.getTrades();
            trades.set(tradesData.trades || []);
        } catch (error) {
            console.error('Trade refresh failed:', error);
        }
    },
    
    async manualCloseTrade(tradeId, exitPrice, outcome) {
        try {
            await apiService.closeTrade(tradeId, { exitPrice, outcome });
            await this.refreshTrades();
            
            notifications.update(n => [...n, {
                type: 'success',
                message: 'Trade closed successfully',
                timestamp: new Date()
            }]);
        } catch (error) {
            console.error('Manual close failed:', error);
            notifications.update(n => [...n, {
                type: 'error',
                message: 'Failed to close trade',
                timestamp: new Date()
            }]);
        }
    },
    
    addNotification(notification) {
        notifications.update(n => [...n, {
            ...notification,
            id: Date.now(),
            timestamp: new Date()
        }]);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            notifications.update(n => n.filter(notif => notif.id !== notification.id));
        }, 5000);
    }
};
