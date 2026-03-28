const DatabaseQueries = require('../database/queries');

class SettingsController {
  async getSettings(req, res) {
    try {
      const settings = await DatabaseQueries.getSettings();
      
      // Merge with global app state
      const mergedSettings = {
        ...settings.toObject(),
        scannerRunning: global.appState.scannerRunning,
        activeTrade: !!global.appState.activeTrade,
        accountBalance: global.appState.accountBalance || 1000
      };
      
      res.json(mergedSettings);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  
  async updateSettings(req, res) {
    try {
      const updates = req.body;
      
      // Update in database
      const settings = await DatabaseQueries.updateSettings(updates);
      
      // Update global app state
      global.appState.settings = {
        ...global.appState.settings,
        ...settings.toObject()
      };
      
      // If scanner interval changed, restart scanner if running
      if (updates.scanInterval && global.appState.scannerRunning) {
        const scannerService = require('../services/scannerService');
        scannerService.restartScanner();
      }
      
      res.json({
        success: true,
        message: 'Settings updated successfully',
        settings: settings.toObject()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  
  async resetSettings(req, res) {
    try {
      // Reset to default settings
      const defaultSettings = require('../config/defaultSettings');
      const settings = await DatabaseQueries.updateSettings(defaultSettings);
      
      // Update global app state
      global.appState.settings = defaultSettings;
      
      res.json({
        success: true,
        message: 'Settings reset to defaults',
        settings: settings.toObject()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new SettingsController();
