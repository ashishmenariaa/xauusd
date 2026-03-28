const MT5Bridge = require('./mt5Bridge');
const DatabaseQueries = require('../../backend/database/queries');

class OrderExecutor {
    constructor() {
        this.pendingOrders = new Map();
        this.executionHistory = [];
    }

    async executeOrder(tradeSignal) {
        const orderId = Helpers.generateId('ORDER_');
        
        try {
            // Prepare order parameters
            const orderParams = {
                symbol: 'XAUUSD',
                direction: tradeSignal.direction.toUpperCase(),
                lotSize: tradeSignal.position.lotSize,
                sl: tradeSignal.stopLoss,
                tp: tradeSignal.takeProfit,
                comment: `AI_${tradeSignal.direction}_${tradeSignal.confidence}%`
            };

            // Execute order
            const result = await MT5Bridge.executeOrder(orderParams);
            
            if (result.success) {
                const executionRecord = {
                    orderId,
                    timestamp: new Date(),
                    tradeSignal,
                    result,
                    status: 'EXECUTED'
                };

                this.executionHistory.push(executionRecord);
                
                await DatabaseQueries.addJournalEntry({
                    type: 'EXECUTION',
                    category: 'ORDER',
                    title: 'Order Executed',
                    message: `Order ${orderId} executed successfully`,
                    data: executionRecord,
                    priority: 4
                });

                return executionRecord;
            } else {
                throw new Error(result.error || 'Order execution failed');
            }

        } catch (error) {
            const errorRecord = {
                orderId,
                timestamp: new Date(),
                tradeSignal,
                error: error.message,
                status: 'FAILED'
            };

            this.executionHistory.push(errorRecord);
            
            await DatabaseQueries.addJournalEntry({
                type: 'ERROR',
                category: 'EXECUTION',
                title: 'Order Execution Failed',
                message: `Order ${orderId} failed: ${error.message}`,
                data: errorRecord,
                priority: 4
            });

            throw error;
        }
    }

    async closeOrder(ticket) {
        try {
            const result = await MT5Bridge.closePosition(ticket);
            
            await DatabaseQueries.addJournalEntry({
                type: 'EXECUTION',
                category: 'CLOSE',
                title: 'Position Closed',
                message: `Position ${ticket} closed successfully`,
                data: result,
                priority: 3
            });

            return result;
        } catch (error) {
            await DatabaseQueries.addJournalEntry({
                type: 'ERROR',
                category: 'EXECUTION',
                title: 'Position Close Failed',
                message: `Failed to close position ${ticket}: ${error.message}`,
                priority: 4
            });

            throw error;
        }
    }

    getExecutionHistory(limit = 50) {
        return this.executionHistory.slice(0, limit);
    }

    getPendingOrders() {
        return Array.from(this.pendingOrders.values());
    }

    async validateOrder(tradeSignal) {
        const validations = [];

        // Lot size validation
        if (tradeSignal.position.lotSize < 0.01) {
            validations.push('Lot size below minimum 0.01');
        }

        if (tradeSignal.position.lotSize > 1.0) {
            validations.push('Lot size above maximum 1.0');
        }

        // Price validation
        if (tradeSignal.entry <= 0) {
            validations.push('Invalid entry price');
        }

        // SL/TP validation
        if (tradeSignal.direction === 'BUY') {
            if (tradeSignal.stopLoss >= tradeSignal.entry) {
                validations.push('Stop loss must be below entry for BUY');
            }
            if (tradeSignal.takeProfit <= tradeSignal.entry) {
                validations.push('Take profit must be above entry for BUY');
            }
        } else {
            if (tradeSignal.stopLoss <= tradeSignal.entry) {
                validations.push('Stop loss must be above entry for SELL');
            }
            if (tradeSignal.takeProfit >= tradeSignal.entry) {
                validations.push('Take profit must be below entry for SELL');
            }
        }

        // Risk validation
        const riskPerTrade = tradeSignal.position.riskAmount;
        if (riskPerTrade > 100) { // Example limit
            validations.push('Risk per trade too high');
        }

        return {
            isValid: validations.length === 0,
            validations
        };
    }
}

module.exports = new OrderExecutor();
