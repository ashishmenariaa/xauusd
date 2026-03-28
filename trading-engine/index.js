// Main trading engine entry point
const MarketScanner = require('./scanner');
const AIEngine = require('./aiEngine');
const TradeManager = require('./tradeManager');
const RiskManager = require('./riskManager');
const TradingState = require('./state');
const TradingJournal = require('./journal');
const MarketDataService = require('./data/marketData');

class TradingEngine {
   constructor() {
    this.isRunning = false;
    this.latestAnalysis = null;   // ✅ ADD THIS

    this.components = {
        scanner: MarketScanner,
        ai: AIEngine,
        tradeManager: TradeManager,
        riskManager: RiskManager,
        state: TradingState,
        journal: TradingJournal,
        marketData: MarketDataService
    };
}

    async start() {
        if (this.isRunning) {
            console.log('Trading engine is already running');
            return;
        }

        try {
            console.log('Starting XAUUSD AI Trading Engine...');
            
            // Initialize components
            await this.initializeComponents();
            
            // Start market scanner
            await this.components.scanner.startScanner(60000); // 1 minute intervals
            
            // Start trade monitoring
            this.components.tradeManager.startTradeMonitoring();
            
            this.isRunning = true;
            
            console.log('✅ Trading engine started successfully');
            console.log('📊 Market scanner: ACTIVE');
            console.log('🤖 AI analysis: READY');
            console.log('💰 Trade manager: ACTIVE');
            console.log('⚡ Risk manager: MONITORING');
            
            // Log startup
            const DatabaseQueries = require('../backend/database/queries');
            await DatabaseQueries.addJournalEntry({
                type: 'SYSTEM',
                category: 'STARTUP',
                title: 'Trading Engine Started',
                message: 'XAUUSD AI Trading Engine started successfully',
                priority: 4
            });

        } catch (error) {
            console.error('Failed to start trading engine:', error);
            throw error;
        }
    }

    async stop() {
        if (!this.isRunning) return;

        try {
            console.log('Stopping trading engine...');
            
            // Stop scanner
            this.components.scanner.stopScanner();
            
            // Stop trade monitoring
            this.components.tradeManager.stopTradeMonitoring();
            
            // Close all active trades
            const activeTrades = this.components.tradeManager.getActiveTrades();
            for (const trade of activeTrades) {
                await this.components.tradeManager.closeTrade(trade.id, 'Engine shutdown');
            }
            
            this.isRunning = false;
            
            console.log('✅ Trading engine stopped successfully');
            
            // Log shutdown
            const DatabaseQueries = require('../backend/database/queries');
            await DatabaseQueries.addJournalEntry({
                type: 'SYSTEM',
                category: 'SHUTDOWN',
                title: 'Trading Engine Stopped',
                message: 'XAUUSD AI Trading Engine stopped successfully',
                priority: 4
            });

        } catch (error) {
            console.error('Error stopping trading engine:', error);
            throw error;
        }
    }

    async initializeComponents() {
        // Initialize each component
        console.log('Initializing trading engine components...');
        
        // Test market data connection
        try {
            await this.components.marketData.getCurrentPrice();
            console.log('✅ Market data service: CONNECTED');
        } catch (error) {
            console.log('❌ Market data service: FAILED');
            throw error;
        }

        // Test database connection
        try {
            const DatabaseQueries = require('../backend/database/queries');
            await DatabaseQueries.getTrades({ limit: 1 });
            console.log('✅ Database connection: ACTIVE');
        } catch (error) {
            console.log('❌ Database connection: FAILED');
            throw error;
        }

        console.log('✅ All components initialized successfully');
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            components: {
                scanner: this.components.scanner.getScannerStatus(),
                tradeManager: {
                    activeTrades: this.components.tradeManager.getActiveTrades().length,
                    isMonitoring: this.components.tradeManager.isMonitoring
                },
                riskManager: this.components.riskManager.getRiskMetrics(),
                state: this.components.state.currentState
            },
            performance: this.getPerformanceSnapshot()
        };
    }

    async getPerformanceSnapshot() {
        const journal = await this.components.journal.analyzePerformance();
        const activeTrades = this.components.tradeManager.getActiveTrades();
        
        return {
            metrics: journal.metrics,
            activeTrades: activeTrades.length,
            totalOpenPnL: activeTrades.reduce((sum, trade) => sum + (trade.livePnl || 0), 0),
            todayPnL: await this.components.riskManager.getTodayPnL()
        };
    }

    async manualTrade(signal) {
        if (!this.isRunning) {
            throw new Error('Trading engine is not running');
        }

        // Validate signal
        const validation = await this.components.riskManager.canOpenTrade(signal);
        if (!validation.canTrade) {
            throw new Error(`Trade rejected: ${validation.failedChecks.join(', ')}`);
        }

        // Execute trade
        return await this.components.tradeManager.openTrade(signal);
    }

 async getAnalysis() {
    const marketData = await this.components.marketData.getMultipleTimeframes();
    const analysis = await this.components.scanner.performScan();
    
    // Update trading state
    this.components.state.updateMarketState(analysis);

    const recommendation = this.components.state.getTradingRecommendation();

    // ✅ CACHE RESULT
 // ✅ CACHE RESULT
this.latestAnalysis = {
    analysis,
    recommendation,
    timestamp: Date.now()
};

// 🔥 REAL-TIME EVENT
if (this.onSignalUpdate) {
    this.onSignalUpdate(this.latestAnalysis);
}
    
    return {
        marketData: {
            currentPrice: marketData.currentPrice,
            timeframes: Object.keys(marketData).filter(k => k !== 'currentPrice')
        },
        analysis,
        state: this.components.state.currentState,
        recommendation
    };
}
}

// Create singleton instance
const tradingEngine = new TradingEngine();


module.exports = tradingEngine;
