//const fetch = require('node-fetch');
const config = require('../../backend/config');

class MarketDataService {
    constructor() {
        this.cache = new Map();
        this.cacheTTL = 60000; // 1 minute cache
    }

    async getCurrentPrice() {
        const cacheKey = 'current_price';
        const cached = this.getCached(cacheKey);
        
        if (cached) {
            return cached;
        }

        try {
            const response = await fetch(`https://api.twelvedata.com/price?symbol=XAU/USD&apikey=${config.twelveDataKey}`);
            const data = await response.json();
            
            if (data.price) {
                const price = parseFloat(data.price);
                this.setCached(cacheKey, price);
                return price;
            } else {
                throw new Error('Invalid price data received');
            }
        } catch (error) {
            throw new Error(`Failed to fetch current price: ${error.message}`);
        }
    }

    async getCandles(timeframe, count = 100) {
        const cacheKey = `candles_${timeframe}_${count}`;
        const cached = this.getCached(cacheKey);
        
        if (cached) {
            return cached;
        }

        try {
            const response = await fetch(
                `https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=${timeframe}&outputsize=${count}&apikey=${config.twelveDataKey}`
            );
            const data = await response.json();
            
            if (data.values) {
                const candles = data.values;
                this.setCached(cacheKey, candles);
                return candles;
            } else {
                throw new Error('Invalid candle data received');
            }
        } catch (error) {
            throw new Error(`Failed to fetch ${timeframe} candles: ${error.message}`);
        }
    }

    async getMultipleTimeframes() {
        const timeframes = ['5min', '15min', '1h', '4h'];
        const promises = timeframes.map(tf => this.getCandles(tf, 100));
        
        try {
            const results = await Promise.all(promises);
            const data = {};
            
            timeframes.forEach((tf, index) => {
                data[tf] = results[index];
            });

            // Get current price separately
            data.currentPrice = await this.getCurrentPrice();
            
            return data;
        } catch (error) {
            throw new Error(`Failed to fetch multiple timeframes: ${error.message}`);
        }
    }

    async getHistoricalData(days = 30) {
        try {
            // For longer historical data, use daily timeframe
            const response = await fetch(
                `https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=1day&outputsize=${days}&apikey=${config.twelveDataKey}`
            );
            const data = await response.json();
            
            return data.values || [];
        } catch (error) {
            throw new Error(`Failed to fetch historical data: ${error.message}`);
        }
    }

    getCached(key) {
        const cached = this.cache.get(key);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
            return cached.data;
        }
        return null;
    }

    setCached(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.cache.clear();
    }

    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

module.exports = new MarketDataService();
