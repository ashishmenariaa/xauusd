const DatabaseQueries = require('../backend/database/queries');
const Helpers = require('../backend/utils/helpers');

class RiskManager {
    constructor() {
        this.dailyLimits = {
            maxTrades: 5,
            maxLosses: 3,
            dailyLossLimit: 300,
            dailyProfitTarget: 600
        };
        
        this.currentDayStats = {
            trades: 0,
            losses: 0,
            pnl: 0,
            startTime: new Date()
        };
    }

    async canOpenTrade(tradeSignal) {
        const checks = [];

        // 1. Daily trade limit
        const dailyTrades = await this.getTodayTrades();
        if (dailyTrades.length >= this.dailyLimits.maxTrades) {
            checks.push({
                passed: false,
                reason: `Daily trade limit reached (${this.dailyLimits.maxTrades})`
            });
        }

        // 2. Daily loss limit
        const todayPnL = await this.getTodayPnL();
        if (todayPnL <= -this.dailyLimits.dailyLossLimit) {
            checks.push({
                passed: false,
                reason: `Daily loss limit reached (${this.dailyLimits.dailyLossLimit})`
            });
        }

        // 3. Consecutive losses
        const recentTrades = await this.getRecentTrades(10);
        const consecutiveLosses = this.countConsecutiveLosses(recentTrades);
        if (consecutiveLosses >= 2) { // After 2 consecutive losses, require higher confidence
            if (tradeSignal.confidence < 80) {
                checks.push({
                    passed: false,
                    reason: `Consecutive losses (${consecutiveLosses}) - requiring higher confidence`
                });
            }
        }

        // 4. Session timing
        const sessionCheck = Helpers.isTradingSession(require('../backend/config/defaultSettings'));
        if (!sessionCheck.inSession) {
            checks.push({
                passed: false,
                reason: `Outside trading session: ${sessionCheck.reason}`
            });
        }

        // 5. Signal confidence
        if (tradeSignal.confidence < 60) {
            checks.push({
                passed: false,
                reason: `Signal confidence too low (${tradeSignal.confidence}%)`
            });
        }

        // 6. Position size validation
        const positionSize = this.validatePositionSize(tradeSignal);
        if (!positionSize.valid) {
            checks.push({
                passed: false,
                reason: positionSize.reason
            });
        }

        const failedChecks = checks.filter(check => !check.passed);
        const canTrade = failedChecks.length === 0;

        return {
            canTrade,
            checks,
            failedChecks: failedChecks.map(fc => fc.reason)
        };
    }

    validatePositionSize(tradeSignal) {
        const settings = require('../backend/config/defaultSettings');
        const maxLotSize = settings.mt5?.maxLotSize || 1.0;
        
        if (tradeSignal.position.lotSize > maxLotSize) {
            return {
                valid: false,
                reason: `Lot size ${tradeSignal.position.lotSize} exceeds maximum ${maxLotSize}`
            };
        }

        // Check if lot size is reasonable for account size
        const minLotSize = 0.01;
        if (tradeSignal.position.lotSize < minLotSize) {
            return {
                valid: false,
                reason: `Lot size ${tradeSignal.position.lotSize} below minimum ${minLotSize}`
            };
        }

        return { valid: true };
    }

    async getTodayTrades() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return await DatabaseQueries.getTrades({
            timestamp: { $gte: today },
            status: 'CLOSED'
        });
    }

    async getTodayPnL() {
        const todayTrades = await this.getTodayTrades();
        return todayTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    }

    async getRecentTrades(limit = 10) {
        return await DatabaseQueries.getTrades({})
            .then(trades => trades.slice(0, limit));
    }

    countConsecutiveLosses(trades) {
        let consecutive = 0;
        
        for (const trade of trades) {
            if (trade.outcome === 'LOSS') {
                consecutive++;
            } else {
                break;
            }
        }
        
        return consecutive;
    }

    calculateDynamicPositionSize(tradeSignal, accountBalance) {
        const baseRisk = accountBalance * 0.01; // 1% base risk
        const confidenceMultiplier = tradeSignal.confidence / 100;
        
        // Adjust risk based on confidence and recent performance
        let adjustedRisk = baseRisk * confidenceMultiplier;
        
        // Recent performance adjustment
        this.getRecentTrades(5).then(recentTrades => {
            const winRate = this.calculateWinRate(recentTrades);
            if (winRate < 0.5) {
                adjustedRisk *= 0.7; // Reduce risk if recent performance poor
            } else if (winRate > 0.7) {
                adjustedRisk *= 1.2; // Increase risk if recent performance good
            }
        });

        return Math.max(adjustedRisk, accountBalance * 0.005); // Minimum 0.5% risk
    }

    calculateWinRate(trades) {
        if (trades.length === 0) return 0;
        
        const wins = trades.filter(t => t.outcome === 'WIN').length;
        return wins / trades.length;
    }

    async shouldCloseTrade(trade, currentPrice) {
        const checks = [];

        // 1. Stop loss hit
        const isBuy = trade.signal === 'BUY';
        const slHit = isBuy ? currentPrice <= trade.sl : currentPrice >= trade.sl;
        
        if (slHit) {
            checks.push({
                shouldClose: true,
                reason: 'Stop loss hit',
                outcome: 'LOSS'
            });
        }

        // 2. Take profit hit
        const tpHit = isBuy ? currentPrice >= trade.tp1 : currentPrice <= trade.tp1;
        if (tpHit) {
            checks.push({
                shouldClose: true,
                reason: 'Take profit 1 hit',
                outcome: 'WIN'
            });
        }

        // 3. Time-based exit (max 3 hours)
        const tradeAge = Date.now() - new Date(trade.timestamp).getTime();
        const maxHoldTime = 3 * 60 * 60 * 1000; // 3 hours
        if (tradeAge > maxHoldTime) {
            checks.push({
                shouldClose: true,
                reason: 'Maximum hold time reached',
                outcome: trade.pnl > 0 ? 'WIN' : 'LOSS'
            });
        }

        // 4. Session end
        const sessionCheck = Helpers.isTradingSession(require('../backend/config/defaultSettings'));
        if (!sessionCheck.inSession && tradeAge > 30 * 60 * 1000) { // 30 minutes minimum
            checks.push({
                shouldClose: true,
                reason: 'Trading session ended',
                outcome: trade.pnl > 0 ? 'WIN' : 'LOSS'
            });
        }

        const shouldClose = checks.some(check => check.shouldClose);
        const primaryReason = checks.find(check => check.shouldClose) || {};

        return {
            shouldClose,
            reason: primaryReason.reason,
            outcome: primaryReason.outcome
        };
    }

    async updateRiskParameters() {
        // Adaptive risk management based on performance
        const recentTrades = await this.getRecentTrades(20);
        
        if (recentTrades.length >= 10) {
            const winRate = this.calculateWinRate(recentTrades);
            const avgPnL = recentTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / recentTrades.length;
            
            // Adjust daily limits based on performance
            if (winRate > 0.6 && avgPnL > 0) {
                this.dailyLimits.maxTrades = Math.min(8, this.dailyLimits.maxTrades + 1);
            } else if (winRate < 0.4 || avgPnL < 0) {
                this.dailyLimits.maxTrades = Math.max(3, this.dailyLimits.maxTrades - 1);
            }
        }
    }

    getRiskMetrics() {
        return {
            dailyLimits: this.dailyLimits,
            currentDayStats: this.currentDayStats,
            riskLevel: this.calculateOverallRiskLevel()
        };
    }

    calculateOverallRiskLevel() {
        // Simple risk level calculation based on various factors
        let riskScore = 50; // Base score
        
        // Adjust based on recent performance
        this.getRecentTrades(10).then(trades => {
            const winRate = this.calculateWinRate(trades);
            if (winRate < 0.4) riskScore += 20;
            if (winRate > 0.6) riskScore -= 20;
        });

        // Adjust based on market volatility (would need volatility data)
        
        if (riskScore >= 70) return 'HIGH';
        if (riskScore <= 30) return 'LOW';
        return 'MEDIUM';
    }
}

module.exports = new RiskManager();
