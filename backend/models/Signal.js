const mongoose = require('mongoose');

const signalSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },

  type: String,
  direction: String,
  confidence: Number,

  entry: Number,
  stopLoss: Number,
  takeProfit: Number,

  reason: String,
  source: String
});

module.exports = mongoose.model('Signal', signalSchema);