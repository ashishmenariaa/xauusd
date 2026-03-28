module.exports = {
  // Scanner settings
  scanInterval: 60,
  minConfidence: 65,
  maxTradesDay: 5,
  maxLossesDay: 3,
  cooldownMins: 30,
  
  // Risk management
  accountBalance: 1000,
  riskPct: 1.0,
  dailyLossLimit: 300,
  dailyProfitTarget: 600,
  atrMul: 1.5,
  
  // Take Profit R:R
  tp1R: 1,
  tp2R: 2,
  tp3R: 3,
  
  // Trading sessions (IST)
  customEnabled: true,
  customStart: '06:30',
  customEnd: '16:00',
  
  morningEnabled: false,
  morningStart: '11:00',
  morningEnd: '14:00',
  
  eveningEnabled: false,
  eveningStart: '16:00',
  eveningEnd: '22:00',
  
  // Features
  autoTrade: true,
  newsBlock: true,
  htfLock: false,
  beAtTp1: true,
  trailingSL: false,
  closeAtSessionEnd: true,
  maxHoldTime: true,
  
  // AI Settings
  aiModel: 'groq-llama',
  maxTokens: 800,
  temperature: 0.3,
  
  // API Keys (should be set via environment variables)
  twelveDataKey: process.env.TWELVE_DATA_KEY || '',
  groqKeys: [
    process.env.GROQ_KEY_1,
    process.env.GROQ_KEY_2,
    process.env.GROQ_KEY_3
  ].filter(Boolean),
  
  // MT5 Settings
  mt5BridgeUrl: process.env.MT5_BRIDGE_URL || 'http://localhost:5000',
  leverage: 100,
  
  // Technical indicators
  indicators: {
    rsiPeriod: 14,
    emaShort: 20,
    emaLong: 50,
    atrPeriod: 14
  }
};
