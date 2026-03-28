const mongoose = require('mongoose');

const journalSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  type: { 
    type: String, 
    enum: ['TRADE', 'SCAN', 'AI_DECISION', 'ERROR', 'INFO', 'SYSTEM'],
    required: true 
  },
  category: {
    type: String,
enum: [
  'ENTRY',
  'EXIT',
  'MODIFY',
  'ANALYSIS',
  'SETUP',
  'NEWS',
  'SESSION',
  'RISK',
  'PERFORMANCE',
  'SCAN',
  'TRADING',
  'STARTUP',
  'SHUTDOWN' 
]
  },
  
  // Content
  title: String,
  message: { type: String, required: true },
  data: mongoose.Schema.Types.Mixed,
  
  // Context
  tradeId: String,
  session: String,
  price: Number,
  confidence: Number,
  
  // AI specific
  aiModel: String,
  tokensUsed: Number,
  responseTime: Number,
  
  // Metadata
  tags: [String],
  priority: { type: Number, default: 1 }, // 1=low, 5=critical
  acknowledged: { type: Boolean, default: false },
  
  // System
  source: String,
  ip: String,
  userAgent: String
});

// Indexes
journalSchema.index({ timestamp: -1 });
journalSchema.index({ type: 1, timestamp: -1 });
journalSchema.index({ tradeId: 1 });
journalSchema.index({ category: 1 });


module.exports = mongoose.model('Journal', journalSchema);
