const TechnicalAnalysis = require('../backend/utils/technical');
const Helpers = require('../backend/utils/helpers');
const DatabaseQueries = require('../backend/database/queries');

class AIEngine {
    constructor() {
        this.lastAnalysis = null;
        this.marketContext = {};
        this.riskMetrics = {};
    }

    async analyzeMarket(candles5m, candles15m, candles1h, candles4h, currentPrice) {
        try {
            // Technical analysis for different timeframes
      const ta5m = Array.isArray(candles5m) ? this.runTechnicalAnalysis(candles5m) : null;
const ta15m = Array.isArray(candles15m) ? this.runTechnicalAnalysis(candles15m) : null;
const ta1h = Array.isArray(candles1h) ? this.runTechnicalAnalysis(candles1h) : null;
const ta4h = Array.isArray(candles4h) ? this.runTechnicalAnalysis(candles4h) : null;

if (!ta5m) {
    return {
        signal: {
            direction: 'wait',
            confidence: 0,
            entry: null,
            stopLoss: null,
            takeProfit: null,
            rationale: ['No valid candle data']
        }
    };
}
            // Market structure analysis
            const structure = this.analyzeMarketStructure(ta5m, ta15m, ta1h, ta4h);
            
            // Risk assessment
            const risk = this.assessRisk(ta5m, structure, currentPrice);
            
            // Trading signal generation
           const signal = this.generateSignal(ta5m, ta15m, structure, risk, currentPrice);
            
            // Position sizing
            const position = this.calculatePositionSize(signal, currentPrice, risk);
            
            this.lastAnalysis = {
                timestamp: new Date(),
                price: currentPrice,
                signal,
                structure,
                risk,
                position,
                technicals: { ta5m, ta15m, ta1h, ta4h }
            };

            return this.lastAnalysis;

        } catch (error) {
            console.error('AI Engine analysis error:', error);
            throw error;
        }
    }

  runTechnicalAnalysis(candles) {
    // 🛑 FIX: Ensure candles is valid array
    if (!Array.isArray(candles) || candles.length < 20) {
        return null;
    }
        const closes = candles.map(c => parseFloat(c.close));
        const highs = candles.map(c => parseFloat(c.high));
        const lows = candles.map(c => parseFloat(c.low));
        const opens = candles.map(c => parseFloat(c.open));

        return {
            ema20: TechnicalAnalysis.EMA(closes, 20),
            ema50: TechnicalAnalysis.EMA(closes, 50),
            rsi: TechnicalAnalysis.RSI(closes, 14),
            atr: TechnicalAnalysis.ATR(candles.map((c, i) => ({
                high: highs[i],
                low: lows[i],
                close: closes[i]
            })), 14),
            momentum: this.calculateMomentum(closes),
            volatility: this.calculateVolatility(closes),
            supportResistance: TechnicalAnalysis.findSupportResistance(candles.map((c, i) => ({
                high: highs[i],
                low: lows[i],
                close: closes[i]
            })))
        };
    }

    analyzeMarketStructure(ta5m, ta15m, ta1h, ta4h) {
        const structure = {
            trend: 'neutral',
            strength: 0,
            keyLevels: [],
            breakouts: [],
            pattern: null
        };

        // Multi-timeframe trend analysis
        const trends = [ta4h, ta1h, ta15m, ta5m]
            .filter(ta => ta && ta.ema20 && ta.ema50)
            .map(ta => {
                const ema20 = ta.ema20[ta.ema20.length - 1];
                const ema50 = ta.ema50[ta.ema50.length - 1];
                return ema20 > ema50 ? 'bullish' : ema20 < ema50 ? 'bearish' : 'neutral';
            });

        structure.trend = this.consensusTrend(trends);
        structure.strength = this.calculateTrendStrength(trends);

        // Identify key levels
        if (ta5m && ta5m.supportResistance) {
            structure.keyLevels = [
                ...ta5m.supportResistance.supports.slice(0, 3),
                ...ta5m.supportResistance.resistances.slice(0, 3)
            ].sort((a, b) => b.strength - a.strength);
        }

        return structure;
    }

    assessRisk(ta5m, structure, currentPrice) {
        const risk = {
            level: 'medium',
            score: 50,
            factors: [],
            recommendation: 'proceed'
        };

        // RSI-based risk
        if (ta5m.rsi && ta5m.rsi.length > 0) {
            const currentRSI = ta5m.rsi[ta5m.rsi.length - 1];
            if (currentRSI > 80) {
                risk.factors.push('RSI overbought');
                risk.score += 20;
            } else if (currentRSI < 20) {
                risk.factors.push('RSI oversold');
                risk.score -= 20;
            }
        }

        // Volatility-based risk
        if (ta5m.atr && ta5m.atr.length > 0) {
            const currentATR = ta5m.atr[ta5m.atr.length - 1];
            const avgATR = ta5m.atr.reduce((a, b) => a + b, 0) / ta5m.atr.length;
            
            if (currentATR > avgATR * 1.5) {
                risk.factors.push('High volatility');
                risk.score += 15;
            }
        }

        // Trend strength risk
        if (structure.strength < 30) {
            risk.factors.push('Weak trend');
            risk.score += 10;
        }

        // Determine risk level
        if (risk.score >= 70) risk.level = 'high';
        else if (risk.score <= 30) risk.level = 'low';

        risk.recommendation = risk.level === 'high' ? 'avoid' : 
                            risk.level === 'medium' ? 'caution' : 'favorable';

        return risk;
    }

   generateSignal(ta5m, ta15m, structure, risk, currentPrice) {
        const signal = {
            direction: 'wait',
            confidence: 0,
            entry: null,
            stopLoss: null,
            takeProfit: null,
            rationale: []
        };

        if (risk.level === 'high') {
            signal.rationale.push('High risk environment - waiting');
            return signal;
        }
if (!currentPrice || typeof currentPrice !== 'number') {
    signal.rationale.push('Invalid price data');
    return signal;
}
        // Price relative to EMAs

        const ema20_5m = ta5m.ema20[ta5m.ema20.length - 1];
        const ema50_5m = ta5m.ema50[ta5m.ema50.length - 1];

        // Trend alignment
        const isBullish = structure.trend === 'bullish';
        const isBearish = structure.trend === 'bearish';

        // EMA crossover signals
        const emaBullish = ema20_5m > ema50_5m;
        const emaBearish = ema20_5m < ema50_5m;

        // RSI conditions
        const rsi = ta5m.rsi[ta5m.rsi.length - 1];
        const rsiOversold = rsi < 30;
        const rsiOverbought = rsi > 70;

        if (isBullish && emaBullish && rsiOversold) {
            signal.direction = 'buy';
            signal.confidence = 75;
            signal.rationale.push('Bullish trend, EMA alignment, RSI oversold');
        } else if (isBearish && emaBearish && rsiOverbought) {
            signal.direction = 'sell';
            signal.confidence = 75;
            signal.rationale.push('Bearish trend, EMA alignment, RSI overbought');
        } else {
            signal.rationale.push('No clear signal - market indecision');
            return signal;
        }

        // Calculate levels
        const atr = ta5m.atr[ta5m.atr.length - 1];
        
        if (signal.direction === 'buy') {
            signal.entry = currentPrice;
            signal.stopLoss = currentPrice - (atr * 1.5);
            signal.takeProfit = currentPrice + (atr * 3);
        } else {
            signal.entry = currentPrice;
            signal.stopLoss = currentPrice + (atr * 1.5);
            signal.takeProfit = currentPrice - (atr * 3);
        }

        // Adjust confidence based on risk
        signal.confidence = Math.min(signal.confidence, 100 - risk.score);

        return signal;
    }

    calculatePositionSize(signal, currentPrice, risk) {
        if (signal.direction === 'wait') {
            return { lotSize: 0, riskAmount: 0, riskPercent: 0 };
        }

        const settings = require('../backend/config/defaultSettings');
        const accountBalance = settings.accountBalance;
        const riskPercent = settings.riskPct;
        
        const riskAmount = accountBalance * (riskPercent / 100);
        const priceDifference = Math.abs(signal.entry - signal.stopLoss);
        const pointValue = 10; // XAUUSD point value
        
        let lotSize = riskAmount / (priceDifference * pointValue);
        
        // Apply risk adjustments
        if (risk.level === 'high') lotSize *= 0.5;
        else if (risk.level === 'low') lotSize *= 1.2;
        
        // Round to nearest 0.01
        lotSize = Math.max(0.01, Math.round(lotSize * 100) / 100);
        
        return {
            lotSize,
            riskAmount,
            riskPercent,
            marginUsed: (lotSize * currentPrice) / (settings.leverage || 100)
        };
    }

    consensusTrend(trends) {
        const counts = { bullish: 0, bearish: 0, neutral: 0 };
        trends.forEach(trend => counts[trend]++);
        
        if (counts.bullish > counts.bearish && counts.bullish > counts.neutral) return 'bullish';
        if (counts.bearish > counts.bullish && counts.bearish > counts.neutral) return 'bearish';
        return 'neutral';
    }

    calculateTrendStrength(trends) {
        const bullishCount = trends.filter(t => t === 'bullish').length;
        const bearishCount = trends.filter(t => t === 'bearish').length;
        const total = trends.length;
        
        return Math.max(bullishCount, bearishCount) / total * 100;
    }

    calculateMomentum(prices) {
        if (prices.length < 5) return 0;
        
        const recent = prices.slice(0, 5);
        const changes = [];
        
        for (let i = 1; i < recent.length; i++) {
            changes.push((recent[i] - recent[i-1]) / recent[i-1] * 100);
        }
        
        return changes.reduce((a, b) => a + b, 0) / changes.length;
    }

    calculateVolatility(prices) {
        if (prices.length < 20) return 0;
        
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push((prices[i] - prices[i-1]) / prices[i-1]);
        }
        
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
        
        return Math.sqrt(variance) * 100; // Annualized percentage
    }

    async logAnalysis(tradeSignal) {
        await DatabaseQueries.addJournalEntry({
            type: 'AI_DECISION',
            category: 'ANALYSIS',
            title: 'AI Market Analysis',
            message: `Signal: ${tradeSignal.direction} | Confidence: ${tradeSignal.confidence}%`,
            data: tradeSignal,
            confidence: tradeSignal.confidence,
            priority: tradeSignal.direction === 'wait' ? 2 : 3
        });
    }
}

module.exports = new AIEngine();
