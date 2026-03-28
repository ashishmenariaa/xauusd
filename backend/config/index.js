module.exports = {
  // API Keys (loaded from environment variables)
  twelveDataKey: process.env.TWELVE_DATA_KEY || '',
  groqKeys: [
    process.env.GROQ_KEY_1,
    process.env.GROQ_KEY_2,
    process.env.GROQ_KEY_3
  ].filter(Boolean),
  geminiKey: process.env.GEMINI_KEY,
  
  // MT5 Bridge
  mt5BridgeUrl: process.env.MT5_BRIDGE_URL || 'http://localhost:5000',
  
  // Database
  mongoURI: process.env.MONGODB_URI || 'mongodb://localhost:27017/xauusd_ai',
  
  // Server
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Trading
  defaultRiskPercent: 1.0,
  defaultMaxTradesPerDay: 5,
  defaultMaxLossesPerDay: 3,
  defaultScanInterval: 60, // seconds
  defaultMinConfidence: 65,
  
  // Sessions (IST times)
  sessions: {
    morning: { start: '11:00', end: '14:00' },
    evening: { start: '16:00', end: '22:00' }
  }
};
