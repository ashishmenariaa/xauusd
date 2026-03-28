const DatabaseQueries = require('../database/queries');

class AnalysisController {
    async getTechnicalAnalysis(req, res) {
        try {
            // This would generate technical analysis based on current market data
            res.json({
                analysis: 'Technical analysis placeholder',
                indicators: ['RSI', 'EMA', 'ATR', 'Support/Resistance'],
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    async getMacroAnalysis(req, res) {
        try {
            // This would analyze macroeconomic factors
            res.json({
                analysis: 'Macro analysis placeholder',
                factors: ['Interest Rates', 'Inflation', 'Geopolitical Events'],
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    async getNews(req, res) {
        try {
            const response = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json');
            const newsData = await response.json();
            
            const relevantNews = (newsData || []).filter(event => 
                event.currency === 'USD' || 
                event.title.toLowerCase().includes('gold') ||
                event.title.toLowerCase().includes('fed') ||
                event.impact === 'High'
            );
            
            res.json(relevantNews.slice(0, 10));
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    async runBacktest(req, res) {
        try {
            const { timeframe, candleCount, minConfidence } = req.body;
            
            // Placeholder backtest implementation
            res.json({
                results: 'Backtest results placeholder',
                parameters: { timeframe, candleCount, minConfidence },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    async getInsights(req, res) {
        try {
            const trades = await DatabaseQueries.getTrades({ status: 'CLOSED' });
            const journal = await DatabaseQueries.getJournalEntries(100);
            
            const insights = {
                totalTrades: trades.length,
                winRate: trades.length > 0 ? 
                    (trades.filter(t => t.outcome === 'WIN').length / trades.length * 100).toFixed(1) + '%' : '0%',
                performance: this.calculatePerformance(trades),
                recentActivity: journal.slice(0, 5),
                recommendations: this.generateRecommendations(trades)
            };
            
            res.json(insights);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    async runWeeklyReview(req, res) {
        try {
            // Placeholder weekly review implementation
            res.json({
                review: 'Weekly review placeholder',
                period: 'Last 7 days',
                generatedAt: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    calculatePerformance(trades) {
        if (trades.length === 0) return {};
        
        const wins = trades.filter(t => t.outcome === 'WIN');
        const losses = trades.filter(t => t.outcome === 'LOSS');
        
        return {
            totalTrades: trades.length,
            winningTrades: wins.length,
            losingTrades: losses.length,
            winRate: ((wins.length / trades.length) * 100).toFixed(1) + '%',
            totalPnL: trades.reduce((sum, t) => sum + (t.pnl || 0), 0).toFixed(2)
        };
    }
    
    generateRecommendations(trades) {
        const recommendations = [];
        
        if (trades.length < 10) {
            recommendations.push('Need more trades for meaningful analysis');
            return recommendations;
        }
        
        const winRate = (trades.filter(t => t.outcome === 'WIN').length / trades.length) * 100;
        
        if (winRate < 40) {
            recommendations.push('Consider reviewing entry strategies');
        }
        
        if (winRate > 60) {
            recommendations.push('Excellent performance - consider increasing position sizes gradually');
        }
        
        return recommendations;
    }
}

module.exports = new AnalysisController();
