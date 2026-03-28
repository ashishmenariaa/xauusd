const DatabaseQueries = require('../database/queries');
const { broadcastEvent, EventTypes } = require('../routes/events');
const Helpers = require('../utils/helpers');
const TechnicalAnalysis = require('../utils/technical');

class ScannerService {
    constructor() {
        this.scannerInterval = null;
        this.isRunning = false;
        this.lastScanTime = null;
        this.scansToday = 0;
        this.tradeMonitor = null;
        this.config = require('../config');
    }
    
    async start() {
        if (this.isRunning) {
            console.log('Scanner is already running');
            return;
        }
        
        this.isRunning = true;
        this.scansToday = 0;
        
        // Reset daily counters at midnight IST
        this.scheduleDailyReset();
        
        // Start the scanning loop
        this.runScanLoop();
        
        console.log('✅ Scanner service started');
    }
    
    async stop() {
        this.isRunning = false;
        
        if (this.scannerInterval) {
            clearInterval(this.scannerInterval);
            this.scannerInterval = null;
        }
        
        if (this.tradeMonitor) {
            clearInterval(this.tradeMonitor);
            this.tradeMonitor = null;
        }
        
        if (this.dailyResetInterval) {
            clearInterval(this.dailyResetInterval);
            this.dailyResetInterval = null;
        }
        
        console.log('🛑 Scanner service stopped');
    }
    
    async runScanLoop() {
        if (!this.isRunning) return;
        
        const runScan = async () => {
            try {
                await this.executeScan();
            } catch (error) {
                console.error('Scan error:', error);
                
                // Log error to journal
                await DatabaseQueries.addJournalEntry({
                    type: 'ERROR',
                    title: 'Scan Error',
                    message: error.message,
                    priority: 4
                });
            }
        };
        
        // Run immediately, then set interval
        await runScan();
        
        const settings = await this.getSettings();
        const interval = (settings?.scanInterval || 60) * 1000;
        this.scannerInterval = setInterval(runScan, interval);
    }
    
    async executeScan() {
        if (!this.isRunning) return;
        
        const startTime = Date.now();
        this.lastScanTime = new Date();
        this.scansToday++;
        
        console.log(`🔍 Scan #${this.scansToday} started...`);
        
        const settings = await this.getSettings();
        
        // 1. Check trading session
        const sessionCheck = Helpers.isTradingSession(settings);
        if (!sessionCheck.inSession) {
            broadcastEvent({
                type: EventTypes.INFO,
                message: `Outside trading session: ${sessionCheck.reason}`,
                session: sessionCheck.reason,
                timestamp: new Date().toISOString()
            });
            return;
        }
        
        // 2. Check daily limits
        const limitCheck = await this.checkDailyLimits();
        if (limitCheck.reached) {
            broadcastEvent({
                type: EventTypes.WARNING,
                message: `Daily limit reached: ${limitCheck.reason}`,
                timestamp: new Date().toISOString()
            });
            return;
        }
        
        // 3. Fetch market data
        const marketData = await this.fetchMarketData();
        if (!marketData) {
            throw new Error('Failed to fetch market data');
        }
        
        // Update global state if available
        if (global.appState) {
            global.appState.marketData = marketData;
        }
        
        // 4. Run technical analysis
        const technicalAnalysis = this.runTechnicalAnalysis(marketData);
        
        // 5. Check news block
        if (settings.newsBlock) {
            const newsCheck = await this.checkNewsBlock();
            if (newsCheck.blocked) {
                broadcastEvent({
                    type: EventTypes.WARNING,
                    message: `News block active: ${newsCheck.reason}`,
                    timestamp: new Date().toISOString()
                });
                return;
            }
        }
        
        // 6. Broadcast market update
        broadcastEvent({
            type: EventTypes.MARKET_UPDATE,
            price: marketData.currentPrice,
            technical: technicalAnalysis,
            session: sessionCheck.session,
            timestamp: new Date().toISOString()
        });
        
        const scanDuration = Date.now() - startTime;
        console.log(`✅ Scan completed in ${scanDuration}ms`);
        
        // Log to journal
        await DatabaseQueries.addJournalEntry({
            type: 'SCAN',
            category: 'ANALYSIS',
            title: 'Market Scan',
            message: `Scan completed in ${scanDuration}ms`,
            data: {
                duration: scanDuration,
                price: marketData.currentPrice,
                session: sessionCheck.session
            },
            priority: 2
        });
    }
    
    async fetchMarketData() {
        try {
            const fetch = require('node-fetch');
            
            // Fetch current price
            const priceResponse = await fetch(
                `https://api.twelvedata.com/price?symbol=XAU/USD&apikey=${this.config.twelveDataKey}`
            );
            const priceData = await priceResponse.json();
            
            if (priceData.status === 'error') {
                throw new Error(`Price API error: ${priceData.message}`);
            }
            
            const currentPrice = parseFloat(priceData.price);
            
            // Fetch candle data for multiple timeframes
            const timeframes = ['5min', '15min', '1h', '4h'];
            const candlePromises = timeframes.map(tf => 
                fetch(`https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=${tf}&outputsize=100&apikey=${this.config.twelveDataKey}`)
            );
            
            const candleResponses = await Promise.all(candlePromises);
            const candleData = await Promise.all(candleResponses.map(r => r.json()));
            
            const candles = {};
            timeframes.forEach((tf, index) => {
                candles[tf] = candleData[index].values || [];
            });
            
            return {
                currentPrice,
                candles,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Market data fetch error:', error);
            throw error;
        }
    }
    
    runTechnicalAnalysis(marketData) {
        const analysis = {};
        const timeframes = ['5min', '15min', '1h', '4h'];
        
        timeframes.forEach(tf => {
            const candles = marketData.candles[tf];
            if (!candles || candles.length < 20) return;
            
            const closes = candles.map(c => parseFloat(c.close)).reverse();
            const highs = candles.map(c => parseFloat(c.high)).reverse();
            const lows = candles.map(c => parseFloat(c.low)).reverse();
            
            analysis[tf] = {
                ema20: TechnicalAnalysis.EMA(closes, 20),
                ema50: TechnicalAnalysis.EMA(closes, 50),
                rsi: TechnicalAnalysis.RSI(closes, 14),
                atr: TechnicalAnalysis.ATR(candles.map(c => ({
                    high: parseFloat(c.high),
                    low: parseFloat(c.low),
                    close: parseFloat(c.close)
                })), 14),
                structure: TechnicalAnalysis.analyzeMarketStructure(candles.map(c => ({
                    high: parseFloat(c.high),
                    low: parseFloat(c.low),
                    close: parseFloat(c.close),
                    open: parseFloat(c.open)
                }))),
                supportResistance: TechnicalAnalysis.findSupportResistance(candles.map(c => ({
                    high: parseFloat(c.high),
                    low: parseFloat(c.low),
                    close: parseFloat(c.close)
                })))
            };
        });
        
        return analysis;
    }
    
    async checkDailyLimits() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayTrades = await DatabaseQueries.getTrades({
            timestamp: { $gte: today },
            status: 'CLOSED'
        });
        
        const lossesToday = todayTrades.filter(t => t.outcome === 'LOSS').length;
        const totalToday = todayTrades.length;
        
        const settings = await this.getSettings();
        
        if (totalToday >= settings.maxTradesDay) {
            return { reached: true, reason: `Max trades per day (${settings.maxTradesDay})` };
        }
        
        if (lossesToday >= settings.maxLossesDay) {
            return { reached: true, reason: `Max losses per day (${settings.maxLossesDay})` };
        }
        
        const pnlToday = todayTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
        if (pnlToday <= -settings.dailyLossLimit) {
            return { reached: true, reason: `Daily loss limit (${settings.dailyLossLimit})` };
        }
        
        return { reached: false };
    }
    
    async checkNewsBlock() {
        // Implement news checking logic
        // This would interface with a news API to check for high-impact events
        return { blocked: false };
    }
    
    async getSettings() {
        try {
            if (global.appState && global.appState.settings) {
                return global.appState.settings;
            }
            
            // Fallback to database settings
            const settings = await DatabaseQueries.getSettings();
            return settings.toObject ? settings.toObject() : settings;
        } catch (error) {
            console.error('Error getting settings:', error);
            return require('../config/defaultSettings');
        }
    }
    
    scheduleDailyReset() {
        // Schedule reset at midnight IST (18:30 UTC)
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
        const istNow = new Date(now.getTime() + istOffset);
        
        // Calculate next midnight IST
        const nextMidnight = new Date(istNow);
        nextMidnight.setUTCHours(24, 30, 0, 0); // 00:00 IST = 18:30 UTC previous day
        
        const timeToMidnight = nextMidnight.getTime() - istNow.getTime();
        
        this.dailyResetInterval = setTimeout(() => {
            this.scansToday = 0;
            this.scheduleDailyReset(); // Reschedule for next day
        }, timeToMidnight);
    }
    
    getState() {
        return {
            isRunning: this.isRunning,
            lastScanTime: this.lastScanTime,
            scansToday: this.scansToday,
            activeTrade: global.appState ? !!global.appState.activeTrade : false,
            nextScan: this.lastScanTime ? 
                new Date(this.lastScanTime.getTime() + 60000) : null
        };
    }
}

module.exports = new ScannerService();
