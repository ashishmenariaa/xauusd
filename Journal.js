const DatabaseQueries = require('../backend/database/queries');

class TradingJournal {
    constructor() {
        this.performanceMetrics = {};
        this.tradePatterns = {};
    }

    async analyzePerformance() {
        const trades = await DatabaseQueries.getTrades({ status: 'CLOSED' });
        
        if (trades.length === 0) {
            return this.getEmptyMetrics();
        }

        const metrics = this.calculateBasicMetrics(trades);
        const advancedMetrics = this.calculateAdvancedMetrics(trades);
        const patterns = this.identifyPatterns(trades);

        this.performanceMetrics = { ...metrics, ...advancedMetrics };
        this.tradePatterns = patterns;

        return {
            metrics: this.performanceMetrics,
            patterns: this.tradePatterns
        };
    }

    calculateBasicMetrics(trades) {
        const wins = trades.filter(t => t.outcome === 'WIN');
        const losses = trades.filter(t => t.outcome === 'LOSS');
        const breakEven = trades.filter(t => t.outcome === 'BREAKEVEN');

        const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
        
        const avgWin = wins.length > 0 ? 
            wins.reduce((sum, t) => sum + (t.pnl || 0), 0) / wins.length : 0;
        const avgLoss = losses.length > 0 ? 
            losses.reduce((sum, t) => sum + (t.pnl || 0), 0) / losses.length : 0;
        
        const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : Infinity;

        return {
            totalTrades: trades.length,
            winningTrades: wins.length,
            losingTrades: losses.length,
            breakEvenTrades: breakEven.length,
            winRate: winRate.toFixed(2),
            totalPnL: totalPnL.toFixed(2),
            avgWin: avgWin.toFixed(2),
            avgLoss: avgLoss.toFixed(2),
            profitFactor: profitFactor.toFixed(2),
            expectancy: ((winRate / 100) * avgWin + ((100 - winRate) / 100) * avgLoss).toFixed(2)
        };
    }

    calculateAdvancedMetrics(trades) {
        // Calculate drawdown
        const drawdown = this.calculateDrawdown(trades);
        
        // Calculate Sharpe ratio (simplified)
        const sharpeRatio = this.calculateSharpeRatio(trades);
        
        // Calculate consistency
        const consistency = this.calculateConsistency(trades);
        
        // Best and worst trades
        const bestTrade = Math.max(...trades.map(t => t.pnl || 0));
        const worstTrade = Math.min(...trades.map(t => t.pnl || 0));

        return {
            maxDrawdown: drawdown.maxDrawdown.toFixed(2),
            sharpeRatio: sharpeRatio.toFixed(2),
            consistency: consistency.toFixed(2),
            bestTrade: bestTrade.toFixed(2),
            worstTrade: worstTrade.toFixed(2),
            avgTradeDuration: this.calculateAvgDuration(trades)
        };
    }

    calculateDrawdown(trades) {
        let peak = 0;
        let maxDrawdown = 0;
        let currentBalance = 1000; // Starting balance

        const balances = trades.map(trade => {
            currentBalance += trade.pnl || 0;
            if (currentBalance > peak) peak = currentBalance;
            const drawdown = ((peak - currentBalance) / peak) * 100;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
            return { balance: currentBalance, drawdown };
        });

        return {
            maxDrawdown,
            balances
        };
    }

    calculateSharpeRatio(trades) {
        if (trades.length < 2) return 0;

        const returns = trades.map(t => t.pnl || 0);
        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const stdDev = Math.sqrt(returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length);
        
        return stdDev !== 0 ? avgReturn / stdDev : 0;
    }

    calculateConsistency(trades) {
        if (trades.length < 2) return 0;

        const wins = trades.filter(t => t.outcome === 'WIN').length;
        const streaks = this.calculateWinStreaks(trades);
        const avgStreak = streaks.length > 0 ? streaks.reduce((a, b) => a + b, 0) / streaks.length : 0;
        
        return (wins / trades.length) * (avgStreak / streaks.length) * 100;
    }

    calculateWinStreaks(trades) {
        const streaks = [];
        let currentStreak = 0;

        trades.forEach(trade => {
            if (trade.outcome === 'WIN') {
                currentStreak++;
            } else {
                if (currentStreak > 0) {
                    streaks.push(currentStreak);
                    currentStreak = 0;
                }
            }
        });

        if (currentStreak > 0) streaks.push(currentStreak);
        return streaks;
    }

    calculateAvgDuration(trades) {
        const durations = trades.map(trade => {
            if (trade.exitTime && trade.timestamp) {
                return new Date(trade.exitTime) - new Date(trade.timestamp);
            }
            return 0;
        }).filter(d => d > 0);

        return durations.length > 0 ? 
            (durations.reduce((a, b) => a + b, 0) / durations.length / 60000).toFixed(2) + ' min' : 
            'N/A';
    }

    identifyPatterns(trades) {
        const patterns = {
            bestSession: this.identifyBestSession(trades),
            bestTime: this.identifyBestTime(trades),
            bestSignalType: this.identifyBestSignalType(trades),
            correlationWithMarket: this.analyzeMarketCorrelation(trades)
        };

        return patterns;
    }

    identifyBestSession(trades) {
        const sessions = {};
        
        trades.forEach(trade => {
            const hour = new Date(trade.timestamp).getHours();
            const session = hour >= 9 && hour < 17 ? 'london' :
                           hour >= 13 && hour < 21 ? 'new_york' :
                           hour >= 22 || hour < 5 ? 'asian' : 'other';
            
            if (!sessions[session]) sessions[session] = { wins: 0, total: 0, pnl: 0 };
            sessions[session].total++;
            if (trade.outcome === 'WIN') sessions[session].wins++;
            sessions[session].pnl += trade.pnl || 0;
        });

        return Object.entries(sessions)
            .map(([session, stats]) => ({
                session,
                winRate: (stats.wins / stats.total) * 100,
                avgPnL: stats.pnl / stats.total,
                totalTrades: stats.total
            }))
            .sort((a, b) => b.winRate - a.winRate);
    }

    identifyBestTime(trades) {
        const hours = {};
        
        trades.forEach(trade => {
            const hour = new Date(trade.timestamp).getHours();
            if (!hours[hour]) hours[hour] = { wins: 0, total: 0, pnl: 0 };
            hours[hour].total++;
            if (trade.outcome === 'WIN') hours[hour].wins++;
            hours[hour].pnl += trade.pnl || 0;
        });

        return Object.entries(hours)
            .map(([hour, stats]) => ({
                hour: parseInt(hour),
                winRate: (stats.wins / stats.total) * 100,
                avgPnL: stats.pnl / stats.total,
                totalTrades: stats.total
            }))
            .sort((a, b) => b.winRate - a.winRate);
    }

    identifyBestSignalType(trades) {
        const signals = {};
        
        trades.forEach(trade => {
            const signalType = trade.factors ? trade.factors[0] || 'unknown' : 'unknown';
            if (!signals[signalType]) signals[signalType] = { wins: 0, total: 0, pnl: 0 };
            signals[signalType].total++;
            if (trade.outcome === 'WIN') signals[signalType].wins++;
            signals[signalType].pnl += trade.pnl || 0;
        });

        return Object.entries(signals)
            .map(([signal, stats]) => ({
                signal,
                winRate: stats.total > 0 ? (stats.wins / stats.total) * 100 : 0,
                avgPnL: stats.total > 0 ? stats.pnl / stats.total : 0,
                totalTrades: stats.total
            }))
            .sort((a, b) => b.winRate - a.winRate);
    }

    analyzeMarketCorrelation(trades) {
        // This would require market data for correlation analysis
        // For now, return basic analysis
        return {
            bullMarketPerformance: 'N/A',
            bearMarketPerformance: 'N/A',
            rangingMarketPerformance: 'N/A'
        };
    }

    getEmptyMetrics() {
        return {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            breakEvenTrades: 0,
            winRate: 0,
            totalPnL: 0,
            avgWin: 0,
            avgLoss: 0,
            profitFactor: 0,
            expectancy: 0,
            maxDrawdown: 0,
            sharpeRatio: 0,
            consistency: 0,
            bestTrade: 0,
            worstTrade: 0,
            avgTradeDuration: 'N/A'
        };
    }

    async generateReport(period = 'all') {
        const analysis = await this.analyzePerformance();
        
        return {
            period,
            generatedAt: new Date(),
            summary: {
                totalTrades: analysis.metrics.totalTrades,
                overallWinRate: analysis.metrics.winRate,
                totalProfit: analysis.metrics.totalPnL,
                profitFactor: analysis.metrics.profitFactor
            },
            performance: analysis.metrics,
            patterns: analysis.patterns,
            recommendations: this.generateRecommendations(analysis)
        };
    }

    generateRecommendations(analysis) {
        const recommendations = [];

        if (analysis.metrics.winRate < 50) {
            recommendations.push({
                type: 'win_rate',
                message: 'Consider improving entry timing or risk management',
                priority: 'high'
            });
        }

        if (analysis.metrics.maxDrawdown > 20) {
            recommendations.push({
                type: 'risk_management',
                message: 'Drawdown is high - consider reducing position sizes',
                priority: 'high'
            });
        }

        if (analysis.patterns.bestSession.length > 0) {
            const bestSession = analysis.patterns.bestSession[0];
            recommendations.push({
                type: 'trading_hours',
                message: `Best performance during ${bestSession.session} session (${bestSession.winRate}% win rate)`,
                priority: 'medium'
            });
        }

        return recommendations;
    }
}

module.exports = new TradingJournal();
