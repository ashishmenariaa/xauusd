/* ══════════════════════════════════════════════
   config.js — all constants, keys, shared state
   ══════════════════════════════════════════════ */
try {
    require('dotenv').config();
} catch (err) {
    console.warn("dotenv not loaded, continuing without it");
}
const path = require('path');

/* ── API KEYS ── */
const TWELVE_KEY = '';
const GEMINI_KEY = process.env.GEMINI_KEY || '';
const MT5_BRIDGE = 'http://localhost:5000';

const GROQ_KEYS = [
  process.env.GROQ_KEY_1 || '',
  process.env.GROQ_KEY_2 || '',
  process.env.GROQ_KEY_3 || '',
];

/* ── FILE PATHS ── */
const JOURNAL_FILE       = path.join(__dirname, '..', 'journal.json');
const WEEKLY_REVIEW_FILE = path.join(__dirname, '..', 'weekly_reviews.json');

/* ── TRADING SETTINGS (mutable) ── */
let tradingSettings = {
  scanInterval: 60, minConfidence: 65, maxTradesDay: 5, maxLossesDay: 3,
  cooldownMins: 30, accountBalance: 1000, riskPct: 1,
  dailyLossLimit: 300, dailyProfitTarget: 600,
  autoTrade: true, newsBlock: true, htfLock: false, atrMul: 1.5,
  tp1R: 1, tp2R: 2, tp3R: 3, beAtTp1: true, trailingSL: false,
  closeAtSessionEnd: true, maxHoldTime: true,
  customEnabled: true, customStart: '06:30', customEnd: '16:00',
  morningEnabled: false, morningStart: '11:00', morningEnd: '14:00',
  eveningEnabled: false, eveningStart: '16:00', eveningEnd: '22:00'
};

/* ── LIVE ACCOUNT STATE (mutable) ── */
let liveAccount = {
  balance: 1000, equity: 1000, freeMargin: 1000, leverage: 100, synced: false
};

/* ── RUNTIME STATE (mutable) ── */
let state = {
  activeTrade:    null,
  monitorTimer:   null,
  scanTimer:      null,
  aiRunning:      false,
  lastAiCallTime: 0,
  latestMarketData: null,
  latestAIResult:   null,
  aiLogs:         [],
  currentSetup:   null,
  scanState: { running: false, lastScan: null, waitReason: null, scansToday: 0, locking: false }
};

const MIN_AI_CALL_GAP_MS = 4 * 60 * 1000;

/* ── GROQ KEY ROTATION ── */
let groqKeyIndex = 0;
function getGroqKey()    { return GROQ_KEYS[groqKeyIndex % GROQ_KEYS.length]; }
function rotateGroqKey() {
  groqKeyIndex = (groqKeyIndex + 1) % GROQ_KEYS.length;
  console.log(`  🔄 Rotated to Groq key #${groqKeyIndex + 1}`);
}

module.exports = {
  TWELVE_KEY, GEMINI_KEY, MT5_BRIDGE, GROQ_KEYS,
  JOURNAL_FILE, WEEKLY_REVIEW_FILE,
  tradingSettings, liveAccount, state,
  MIN_AI_CALL_GAP_MS,
  getGroqKey, rotateGroqKey
};
