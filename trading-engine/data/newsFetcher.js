const fetch = require('node-fetch');

class NewsFetcher {
    constructor() {
        this.newsCache = new Map();
        this.cacheTTL = 300000; // 5 minutes cache
    }

    async getEconomicCalendar() {
        const cacheKey = 'economic_calendar';
        const cached = this.getCached(cacheKey);
        
        if (cached) {
            return cached;
        }

        try {
            const response = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json');
            const events = await response.json();
            
            // Filter for relevant events (USD, Gold, important economic indicators)
            const relevantEvents = events.filter(event => 
                event.currency === 'USD' ||
                event.title.toLowerCase().includes('gold') ||
                event.title.toLowerCase().includes('fed') ||
                event.title.toLowerCase().includes('inflation') ||
                event.title.toLowerCase().includes('interest rate') ||
                event.title.toLowerCase().includes('nfp') ||
                event.title.toLowerCase().includes('cpi')
            );

            const processedEvents = relevantEvents.map(event => ({
                title: event.title,
                country: event.country,
                date: new Date(event.date),
                impact: event.impact,
                forecast: event.forecast,
                previous: event.previous,
                actual: event.actual,
                isHighImpact: event.impact === 'High',
                isUpcoming: new Date(event.date) > new Date(),
                minutesUntil: Math.round((new Date(event.date) - new Date()) / 60000)
            }));

            this.setCached(cacheKey, processedEvents);
            return processedEvents;

        } catch (error) {
            console.error('Failed to fetch economic calendar:', error);
            return [];
        }
    }

    async getMarketNews() {
        try {
            // This would integrate with a news API
            // For now, return placeholder data
            return [
                {
                    title: "Gold prices steady amid economic uncertainty",
                    source: "Market Watch",
                    timestamp: new Date(),
                    impact: "medium",
                    sentiment: "neutral"
                }
            ];
        } catch (error) {
            console.error('Failed to fetch market news:', error);
            return [];
        }
    }

    async getHighImpactEvents() {
        const events = await this.getEconomicCalendar();
        return events.filter(event => event.isHighImpact);
    }

    async getImminentEvents(minutesThreshold = 60) {
        const events = await this.getEconomicCalendar();
        const now = new Date();
        
        return events.filter(event => {
            const timeDiff = Math.abs(event.date - now) / 60000; // minutes
            return timeDiff <= minutesThreshold;
        });
    }

    shouldBlockTradingDueToNews() {
        // Check if there are high-impact news events within the next 15 minutes
        return this.getImminentEvents(15).then(events => {
            const highImpactEvents = events.filter(e => e.isHighImpact);
            return {
                shouldBlock: highImpactEvents.length > 0,
                events: highImpactEvents,
                reason: highImpactEvents.length > 0 ? 
                    `High-impact news in ${highImpactEvents[0].minutesUntil} minutes: ${highImpactEvents[0].title}` :
                    null
            };
        });
    }

    getCached(key) {
        const cached = this.newsCache.get(key);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
            return cached.data;
        }
        return null;
    }

    setCached(key, data) {
        this.newsCache.set(key, {
            data,
            timestamp: Date.now()
        });
    }
}

module.exports = new NewsFetcher();
