const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  // Scanner settings
  scanInterval: { type: Number, default: 60 }, // seconds
  minConfidence: { type: Number, default: 65 }, // percentage
  maxTradesDay: { type: Number, default: 5 },
  maxLossesDay: { type: Number, default: 3 },
  cooldownMins: { type: Number, default: 30 },
  
  // Risk management
  accountBalance: { type: Number, default: 1000 },
  riskPct: { type: Number, default: 1.0 },
  dailyLossLimit: { type: Number, default: 300 },
  dailyProfitTarget: { type: Number, default: 600 },
  atrMul: { type: Number, default: 1.5 },
  
  // Take Profit R:R
  tp1R: { type: Number, default: 1 },
  tp2R: { type: Number, default: 2 },
  tp3R: { type: Number, default: 3 },
  
  // Trading sessions (IST)
  customEnabled: { type: Boolean, default: true },
  customStart: { type: String, default: '06:30' },
  customEnd: { type: String, default: '16:00' },
  
  morningEnabled: { type: Boolean, default: false },
  morningStart: { type: String, default: '11:00' },
  morningEnd: { type: String, default: '14:00' },
  
  eveningEnabled: { type: Boolean, default: false },
  eveningStart: { type: String, default: '16:00' },
  eveningEnd: { type: String, default: '22:00' },
  
  // Features
  autoTrade: { type: Boolean, default: true },
  newsBlock: { type: Boolean, default: true },
  htfLock: { type: Boolean, default: false },
  beAtTp1: { type: Boolean, default: true },
  trailingSL: { type: Boolean, default: false },
  closeAtSessionEnd: { type: Boolean, default: true },
  maxHoldTime: { type: Boolean, default: true },
  
  // AI Settings
  aiModel: { type: String, default: 'groq-llama' },
  maxTokens: { type: Number, default: 800 },
  temperature: { type: Number, default: 0.3 },
  
  // Notification settings
  notifications: {
    telegram: { enabled: Boolean, token: String, chatId: String },
    discord: { enabled: Boolean, webhook: String },
    email: { enabled: Boolean, address: String }
  },
  
  // MT5 Settings
  mt5: {
    symbol: { type: String, default: 'XAUUSD' },
    defaultLotSize: { type: Number, default: 0.01 },
    maxLotSize: { type: Number, default: 1.0 },
    slippage: { type: Number, default: 5 },
    magicNumber: { type: Number, default: 234000 }
  },
  
  // Technical indicators
  indicators: {
    rsiPeriod: { type: Number, default: 14 },
    emaShort: { type: Number, default: 20 },
    emaLong: { type: Number, default: 50 },
    atrPeriod: { type: Number, default: 14 },
    bbPeriod: { type: Number, default: 20 },
    bbStdDev: { type: Number, default: 2 }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

settingsSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Settings', settingsSchema);
