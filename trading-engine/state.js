class TradingState {
    constructor() {
        this.currentState = {
            market: 'neutral',
            sentiment: 'neutral',
            riskAppetite: 'medium',
            lastSignal: null,
            activeTrades: 0,
            dailyPerformance: 0,
            session: 'closed'
        };
        
        this.history = [];
        this.stateChanges = [];
    }

    updateMarketState(analysis) {
        const previousState = { ...this.currentState };
        
        // Update market state based on analysis
        this.currentState.market = this.determineMarketState(analysis);
        this.currentState.sentiment = this.calculateSentiment(analysis);
        this.currentState.riskAppetite = this.assessRiskAppetite(analysis);
        this.currentState.session = this.getCurrentSession();
        
        // Log state change if significant
        if (this.isSignificantChange(previousState, this.currentState)) {
            this.stateChanges.push({
                timestamp: new Date(),
                previous: previousState,
                current: { ...this.currentState },
                reason: 'Market analysis update'
            });
        }
        
        this.history.push({
            timestamp: new Date(),
            state: { ...this.currentState },
            analysis: analysis
        });
        
        // Keep only recent history
        if (this.history.length > 1000) {
            this.history = this.history.slice(-500);
        }
    }

    determineMarketState(analysis) {
        if (!analysis || !analysis.ai) return 'neutral';
        
        const { trend, strength } = analysis.ai.structure || {};
        
        if (strength > 70) {
            return trend === 'bullish' ? 'strong_bull' : 
                   trend === 'bearish' ? 'strong_bear' : 'neutral';
        } else if (strength > 40) {
            return trend === 'bullish' ? 'bullish' : 
                   trend === 'bearish' ? 'bearish' : 'neutral';
        } else {
            return 'ranging';
        }
    }

    calculateSentiment(analysis) {
        if (!analysis || !analysis.ai) return 'neutral';
        
        const { confidence, signal } = analysis.ai;
        
        if (confidence >= 80 && signal.direction !== 'wait') {
            return signal.direction === 'buy' ? 'bullish' : 'bearish';
        } else if (confidence >= 60) {
            return 'cautious';
        } else {
            return 'neutral';
        }
    }

    assessRiskAppetite(analysis) {
        if (!analysis || !analysis.ai) return 'medium';
        
        const { risk } = analysis.ai;
        
        if (risk.level === 'high') return 'low';
        if (risk.level === 'low') return 'high';
        return 'medium';
    }

    getCurrentSession() {
        const hour = new Date().getHours();
        if (hour >= 9 && hour < 17) return 'london';
        if (hour >= 13 && hour < 21) return 'new_york';
        if (hour >= 22 || hour < 5) return 'asian';
        return 'closed';
    }

    isSignificantChange(previous, current) {
        return previous.market !== current.market ||
               previous.sentiment !== current.sentiment ||
               previous.riskAppetite !== current.riskAppetite;
    }

    shouldTrade() {
        const state = this.currentState;
        
        // Don't trade during closed sessions
        if (state.session === 'closed') return false;
        
        // Don't trade if risk appetite is low
        if (state.riskAppetite === 'low') return false;
        
        // Only trade if we have clear market direction
        if (state.market === 'neutral' || state.market === 'ranging') return false;
        
        return true;
    }

    getTradingRecommendation() {
        if (!this.shouldTrade()) {
            return {
                action: 'wait',
                reason: 'Market conditions not favorable',
                confidence: 0
            };
        }

        const state = this.currentState;
        
        if (state.sentiment === 'bullish' && state.market.includes('bull')) {
            return {
                action: 'buy',
                reason: 'Strong bullish sentiment and market structure',
                confidence: 80
            };
        } else if (state.sentiment === 'bearish' && state.market.includes('bear')) {
            return {
                action: 'sell',
                reason: 'Strong bearish sentiment and market structure',
                confidence: 80
            };
        } else {
            return {
                action: 'wait',
                reason: 'Mixed signals - waiting for clearer direction',
                confidence: 40
            };
        }
    }

    getStateHistory(limit = 50) {
        return this.history.slice(-limit);
    }

    getStateChanges(limit = 20) {
        return this.stateChanges.slice(-limit);
    }

    getPerformanceMetrics() {
        // This would calculate performance based on trade history
        return {
            winRate: 0,
            avgWin: 0,
            avgLoss: 0,
            profitFactor: 0,
            sharpeRatio: 0
        };
    }
}

module.exports = new TradingState();
