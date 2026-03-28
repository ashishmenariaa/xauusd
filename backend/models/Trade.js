const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  // Basic info
  id: { type: String, required: true, unique: true },
  timestamp: { type: Date, default: Date.now },
  symbol: { type: String, default: 'XAUUSD' },
  
  // Signal info
  signal: { type: String, enum: ['BUY', 'SELL', 'WAIT'], required: true },
  session: String,
  tier: Number,
  tierLabel: String,
  score: String,
  
  // Entry details
  entry: { type: Number, required: true },
  sl: { type: Number, required: true },
  tp1: { type: Number, required: true },
  tp2: { type: Number, required: true },
  tp3: Number,
  
  // Position sizing
  lotSize: Number,
  riskAmount: Number,
  riskPercent: Number,
  accountBalance: Number,
  leverage: Number,
  marginUsed: String,
  
  // Analysis
  confidence: Number,
  structure: String,
  rsi: Number,
  atr: Number,
  factors: [String],
  entryAnalysis: String,
  macroScenario: String,
  
  // Trade management
  status: { type: String, enum: ['PENDING', 'OPEN', 'CLOSED', 'CANCELLED'], default: 'PENDING' },
  tp1Hit: { type: Boolean, default: false },
  trailingSL: Number,
  currentPrice: Number,
  livePnl: Number,
  
  // Exit details
  exitPrice: Number,
  exitTime: Date,
  outcome: { type: String, enum: ['WIN', 'LOSS', 'BREAKEVEN', 'CANCELLED'] },
  pnl: Number,
  exitNote: String,
  aiReview: String,
  
  // MT5 integration
  mt5Ticket: Number,
  mt5Comment: String,
  
  // Risk metrics
  rr: Number, // Risk to Reward ratio
  maxAdverseExcursion: Number,
  maxFavorableExcursion: Number,
  
  // Metadata
  tags: [String],
  notes: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for faster queries
tradeSchema.index({ timestamp: -1 });
tradeSchema.index({ status: 1 });
tradeSchema.index({ outcome: 1 });
tradeSchema.index({ symbol: 1, timestamp: -1 });

// Pre-save hook to update updatedAt
tradeSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Trade', tradeSchema);
