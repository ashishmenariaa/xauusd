const DatabaseQueries = require('../database/queries');

class JournalController {
    async getEntries(req, res) {
        try {
            const { limit = 100, offset = 0, type, category } = req.query;
            
            let filter = {};
            if (type) filter.type = type;
            if (category) filter.category = category;
            
            const entries = await DatabaseQueries.getJournalEntries(parseInt(limit));
            const paginatedEntries = entries.slice(offset, offset + parseInt(limit));
            
            res.json({
                entries: paginatedEntries,
                pagination: {
                    total: entries.length,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: offset + parseInt(limit) < entries.length
                }
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    async addEntry(req, res) {
        try {
            const entryData = req.body;
            entryData.timestamp = new Date();
            
            const entry = await DatabaseQueries.addJournalEntry(entryData);
            res.status(201).json(entry);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    async getStats(req, res) {
        try {
            const entries = await DatabaseQueries.getJournalEntries(1000);
            
            const stats = {
                total: entries.length,
                byType: {},
                byCategory: {},
                recent: entries.slice(0, 10)
            };
            
            // Count by type
            entries.forEach(entry => {
                stats.byType[entry.type] = (stats.byType[entry.type] || 0) + 1;
                if (entry.category) {
                    stats.byCategory[entry.category] = (stats.byCategory[entry.category] || 0) + 1;
                }
            });
            
            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    async deleteEntry(req, res) {
        try {
            const { id } = req.params;
            // Journal entries are typically not deleted, but marked as archived
            res.json({ message: 'Journal entry deletion not implemented' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new JournalController();
