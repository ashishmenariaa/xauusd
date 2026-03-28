const AIEngine = require('./aiEngine');
const MarketAnalysis = require('./analysis');
const DatabaseQueries = require('../backend/database/queries');
const Helpers = require('../backend/utils/helpers');
const fetch = global.fetch;
const Signal = require('../backend/models/Signal');
const Trade = require('../backend/models/Trade');

class MarketScanner {
    constructor() {
        this.isScanning = false;
        this.scanInterval = null;
        this.lastScan = null;
        this.marketData = {};
        this.signals = [];
    }

    async startScanner(interval = 60000) {
        if (this.isScanning) {
            console.log('Scanner is already running');
            return;
        }

        this.isScanning = true;
        console.log('Starting market scanner...');

        // Initial scan
        await this.performScan();

        // Set up interval scanning
        this.scanInterval = setInterval(async () => {
            await this.performScan();
        }, interval);

        await DatabaseQueries.addJournalEntry({
            type: 'SYSTEM',
            category: 'SETUP',
            title: 'Market Scanner Started',
            message: `Scanner started with ${interval}ms interval`,
            priority: 3
        });
    }

    stopScanner() {
        if (!this.isScanning) return;

        this.isScanning = false;
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }

        console.log('Market scanner stopped');

        DatabaseQueries.addJournalEntry({
            type: 'SYSTEM',
            category: 'SETUP',
            title: 'Market Scanner Stopped',
            message: 'Scanner has been stopped',
            priority: 3
        });
    }

    async performScan() {
        try {
            const startTime = Date.now();

            // Fetch market data
            await this.fetchMarketData();

            // ✅ FIX 2: Price safety check — skip scan if price is missing or invalid
            const price = this.marketData.currentPrice;
            if (!price || typeof price !== 'number' || isNaN(price) || price <= 0) {
                console.warn('⚠️ Skipping scan: currentPrice is missing or invalid.');
                await DatabaseQueries.addJournalEntry({
                    type: 'WARN',
                    category: 'SCAN',
                    title: 'Scan Skipped',
                    message: 'currentPrice missing or invalid — scan skipped safely.',
                    priority: 2
                });
                return;
            }

            // Run analysis
            let analysis;
            try {
                analysis = await this.analyzeMarket();
            } catch (err) {
                console.warn('⚠️ Analysis failed, skipping this cycle:', err.message);
                return;
            }

            // ✅ FIX 5: Prevent overtrading — guard against invalid analysis object
            if (!analysis || !analysis.price || !analysis.timeframes) {
                console.warn('⚠️ Skipping scan: analysis result is invalid or incomplete.');
                return;
            }

            // Generate signals
            const signals = this.generateSignals(analysis);

            // Log results
            await this.logScanResults(analysis, signals, Date.now() - startTime);

            this.lastScan = {
                timestamp: new Date(),
                analysis,
                signals,
                duration: Date.now() - startTime
            };

            return { analysis, signals };

        } catch (error) {
            console.error('Scan error:', error);

            await DatabaseQueries.addJournalEntry({
                type: 'ERROR',
                category: 'SCAN',
                title: 'Scan Error',
                message: error.message,
                priority: 4
            });

            throw error;
        }
    }

    async fetchMarketData() {
        try {
            const config = require('../backend/config');

            const timeframes = ['5min', '15min', '1h', '4h'];
            const promises = timeframes.map(tf =>
                fetch(`https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=${tf}&outputsize=100&apikey=${config.twelveDataKey}`)
            );

            const responses = await Promise.all(promises);
            const data = await Promise.all(responses.map(r => r.json()));

            this.marketData = {};
            timeframes.forEach((tf, index) => {
                this.marketData[tf] = data[index].values || [];
            });

            // Get current price
            const priceResponse = await fetch(`https://api.twelvedata.com/price?symbol=XAU/USD&apikey=${config.twelveDataKey}`);
            const priceData = await priceResponse.json();

            if (!priceData || !priceData.price) {
                throw new Error('Price API failed or returned invalid data');
            }

            this.marketData.currentPrice = parseFloat(priceData.price);

        } catch (error) {
            console.warn('⚠️ Market data fetch failed:', error.message);

            // Prevent crash — null price will be caught by safety check in performScan
            this.marketData = {
                currentPrice: null
            };

            return;
        }
    }

    async analyzeMarket() {
        const analysis = {
            timestamp: new Date(),
            price: this.marketData.currentPrice,
            timeframes: {}
        };

        // ✅ FIX 6: Avoid calling analyzePriceAction twice for the same candles
        //    Store result once per timeframe and reuse for signal generation
        for (const [tf, candles] of Object.entries(this.marketData)) {
            if (tf === 'currentPrice') continue;

            // ✅ FIX 5: Skip timeframes with missing or empty candle data
            if (!Array.isArray(candles) || candles.length === 0) {
                console.warn(`⚠️ Skipping timeframe ${tf}: no candle data.`);
                continue;
            }

            const technical = MarketAnalysis.analyzePriceAction(candles); // called once, reused below

            analysis.timeframes[tf] = {
                technical,
                signals: MarketAnalysis.generateTradingSignals(
                    technical,
                    this.marketData.currentPrice
                )
            };
        }

        // AI Analysis
     // AI Analysis
analysis.ai = await AIEngine.analyzeMarket(
    this.marketData['5min'] || [],
    this.marketData['15min'] || [],
    this.marketData['1h'] || [],
    this.marketData['4h'] || [],
    this.marketData.currentPrice
);

const { state } = require('./config');
state.latestAIResult = analysis.ai;

console.log("AI RESULT:", analysis.ai);

// ✅ IMPORTANT — END FUNCTION
return analysis;
}

    generateSignals(analysis) {
        const signals = [];
        const currentPrice = analysis?.price;

        // ✅ FIX 2 + FIX 5: No price → return empty, no crash
        if (!currentPrice) return [];

        // Combine timeframe signals safely
        if (analysis?.timeframes) {
            Object.values(analysis.timeframes).forEach(tfAnalysis => {
                if (tfAnalysis?.signals?.length) {
                    signals.push(...tfAnalysis.signals);
                }
            });
        }

        // ✅ FIX 3: AI safety check — only add signal if result is complete and valid
        const aiSignal = analysis?.ai?.signal;
        if (
            aiSignal &&
            typeof aiSignal.direction === 'string' &&
            aiSignal.direction !== 'wait' &&
            typeof aiSignal.confidence === 'number' &&
            aiSignal.entry &&
            aiSignal.stopLoss &&
            aiSignal.takeProfit
        ) {
            signals.push({
                type: 'ai_analysis',
                direction: aiSignal.direction,
                confidence: aiSignal.confidence,
                reason: Array.isArray(aiSignal.rationale)
                    ? aiSignal.rationale.join(', ')
                    : 'AI signal',
                entry: aiSignal.entry,
                stopLoss: aiSignal.stopLoss,
                takeProfit: aiSignal.takeProfit
            });
        }

        // ✅ FIX 1: FALLBACK REMOVED — if no real signals exist, return empty array.
        //    The system will not generate forced BUY trades during low-confidence periods.

        // Filter + sort — only keep signals meeting minimum confidence threshold
        return signals
            .filter(s => s.confidence >= 50)
            .sort((a, b) => b.confidence - a.confidence);
    }

    async logScanResults(analysis, signals, duration) {
        const Signal = require('../backend/models/Signal');
        const Trade = require('../backend/models/Trade');

        const journalEntry = {
            type: 'SCAN',
            category: 'ANALYSIS',
            title: 'Market Scan Completed',
            message: `Scan completed in ${duration}ms - Found ${signals.length} signals`,
            data: {
                analysis,
                signals,
                duration,
                price: analysis.price
            },
            priority: signals.length > 0 ? 3 : 2
        };

        // Save journal
        await DatabaseQueries.addJournalEntry(journalEntry);

        // Save signals
        for (const signal of signals) {
            try {
                await Signal.create({
                    type: signal.type,
                    direction: signal.direction,
                    confidence: signal.confidence,
                    entry: signal.entry,
                    stopLoss: signal.stopLoss,
                    takeProfit: signal.takeProfit,
                    reason: signal.reason,
                    source: 'scanner'
                });
            } catch (err) {
                console.warn('⚠️ Signal save failed:', err.message);
            }
        }

        // ✅ FIX 4: Improved trade filter — only create trades for confidence >= 75
        //    Previously this threshold was 70, allowing weaker signals through
        for (const signal of signals) {
            try {
                if (signal.confidence < 75) continue; // raised from 70 → 75

                await Trade.create({
                    id: Date.now().toString(),
                    signal: signal.direction,
                    entry: signal.entry,
                    sl: signal.stopLoss,
                    tp1: signal.takeProfit,
                    tp2: signal.takeProfit,
                    tp3: signal.takeProfit,
                    confidence: signal.confidence,
                    status: 'PENDING',
                    notes: signal.reason
                });

            } catch (err) {
                console.warn('⚠️ Trade create failed:', err.message);
            }
        }

        // Log high confidence signals (aligned with new threshold)
        signals.filter(s => s.confidence >= 75).forEach(signal => {
            DatabaseQueries.addJournalEntry({
                type: 'SIGNAL',
                category: 'TRADING',
                title: `High Confidence Signal - ${signal.direction.toUpperCase()}`,
                message: `${signal.type}: ${signal.reason} (${signal.confidence}% confidence)`,
                data: signal,
                confidence: signal.confidence,
                priority: 4
            });
        });
    }

    getScannerStatus() {
        return {
            isScanning: this.isScanning,
            lastScan: this.lastScan ? {
                timestamp: this.lastScan.timestamp,
                signalsFound: this.lastScan.signals.length,
                duration: this.lastScan.duration
            } : null,
            marketData: {
                price: this.marketData.currentPrice,
                timeframes: Object.keys(this.marketData).filter(k => k !== 'currentPrice')
            }
        };
    }

    getSignals(filter = {}) {
        let filteredSignals = this.signals;

        if (filter.minConfidence) {
            filteredSignals = filteredSignals.filter(s => s.confidence >= filter.minConfidence);
        }

        if (filter.direction) {
            filteredSignals = filteredSignals.filter(s => s.direction === filter.direction);
        }

        if (filter.type) {
            filteredSignals = filteredSignals.filter(s => s.type === filter.type);
        }

        return filteredSignals;
    }
}

module.exports = new MarketScanner();