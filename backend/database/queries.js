const Trade = require('../models/Trade');
const Settings = require('../models/Settings');
const Journal = require('../models/Journal');

class DatabaseQueries {
  // Trade operations
  static async createTrade(tradeData) {
    const trade = new Trade(tradeData);
    return await trade.save();
  }
  
  static async getActiveTrade() {
    return await Trade.findOne({ status: 'OPEN' });
  }
  
  static async updateTrade(id, updates) {
    return await Trade.findByIdAndUpdate(id, updates, { new: true });
  }
  
  static async getTrades(filter = {}) {
    return await Trade.find(filter).sort({ timestamp: -1 });
  }
  
  static async getTodayTrades() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return await Trade.find({
      timestamp: { $gte: today }
    });
  }
  
  // Settings operations
  static async getSettings() {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
      await settings.save();
    }
    return settings;
  }
  
  static async updateSettings(updates) {
    const settings = await Settings.findOneAndUpdate(
      {},
      updates,
      { new: true, upsert: true }
    );
    return settings;
  }
  
  // Journal operations
  static async addJournalEntry(entry) {
    const journal = new Journal(entry);
    return await journal.save();
  }
  
  static async getJournalEntries(limit = 100) {
    return await Journal.find().sort({ timestamp: -1 }).limit(limit);
  }
  
  // Statistics
  static async getTradingStats(days = 30) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    
    const trades = await Trade.find({
      timestamp: { $gte: date },
      status: 'CLOSED'
    });
    
    const wins = trades.filter(t => t.outcome === 'WIN');
    const losses = trades.filter(t => t.outcome === 'LOSS');
    const breakEven = trades.filter(t => t.outcome === 'BREAKEVEN');
    
    const totalPnL = trades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    const winRate = trades.length > 0 ? (wins.length / trades.length * 100) : 0;
    
    return {
      total: trades.length,
      wins: wins.length,
      losses: losses.length,
      breakEven: breakEven.length,
      winRate: winRate.toFixed(2),
      totalPnL: totalPnL.toFixed(2),
      avgPnL: trades.length > 0 ? (totalPnL / trades.length).toFixed(2) : 0,
      bestTrade: trades.length > 0 ? Math.max(...trades.map(t => t.pnl || 0)).toFixed(2) : 0,
      worstTrade: trades.length > 0 ? Math.min(...trades.map(t => t.pnl || 0)).toFixed(2) : 0
    };
  }
}

module.exports = DatabaseQueries;
