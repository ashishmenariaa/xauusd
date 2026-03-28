const fetch = require('node-fetch');
const config = require('../config');

class ChartController {
    async getChartData(req, res) {
        try {
            const { interval = '5min', outputsize = '100' } = req.query;
            
            const response = await fetch(
                `https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=${interval}&outputsize=${outputsize}&apikey=${config.twelveDataKey}`
            );
            const data = await response.json();
            
            if (data.status === 'error') {
                throw new Error(data.message);
            }
            
            const candles = (data.values || []).reverse().map(candle => ({
                time: Math.floor(new Date(candle.datetime).getTime() / 1000),
                open: parseFloat(candle.open),
                high: parseFloat(candle.high),
                low: parseFloat(candle.low),
                close: parseFloat(candle.close)
            }));
            
            res.json({ candles });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    async getCandles(req, res) {
        try {
            const { interval = '5min', outputsize = '50' } = req.query;
            
            const response = await fetch(
                `https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=${interval}&outputsize=${outputsize}&apikey=${config.twelveDataKey}`
            );
            const data = await response.json();
            
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    async getCurrentPrice(req, res) {
        try {
            const response = await fetch(
                `https://api.twelvedata.com/price?symbol=XAU/USD&apikey=${config.twelveDataKey}`
            );
            const data = await response.json();
            
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    async getMarketOverview(req, res) {
        try {
            const [priceResp, newsResp] = await Promise.all([
                fetch(`https://api.twelvedata.com/price?symbol=XAU/USD&apikey=${config.twelveDataKey}`),
                fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json')
            ]);
            
            const priceData = await priceResp.json();
            const newsData = await newsResp.json();
            
            const overview = {
                currentPrice: priceData.price,
                news: (newsData || []).filter(event => 
                    event.currency === 'USD' || event.title.toLowerCase().includes('gold')
                ).slice(0, 5),
                timestamp: new Date().toISOString()
            };
            
            res.json(overview);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new ChartController();
