const mt5Service = require('../services/mt5Service');

class MT5Controller {
    async getStatus(req, res) {
        try {
            const status = await mt5Service.checkConnection();
            res.json(status);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    async getAccountInfo(req, res) {
        try {
            const info = await mt5Service.getAccountInfo();
            res.json(info || { connected: false });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    async getPositions(req, res) {
        try {
            const positions = await mt5Service.getPositions();
            res.json(positions);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    async getHistory(req, res) {
        try {
            const { days = 7 } = req.query;
            const history = await mt5Service.getHistory(parseInt(days));
            res.json(history);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    async openTrade(req, res) {
        try {
            const result = await mt5Service.openTrade(req.body);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    async closeTrade(req, res) {
        try {
            const result = await mt5Service.closeTrade(req.body.ticket);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    async modifyTrade(req, res) {
        try {
            const result = await mt5Service.modifySL(req.body.ticket, req.body.sl);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new MT5Controller();
