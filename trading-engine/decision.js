/* ══════════════════════════════════════════════════════
   decision.js — AI call, news fetch, macro scenario,
                 full BUY/SELL/WAIT decision
   ══════════════════════════════════════════════════════ */
const fetch  = require('node-fetch');
const config = require('./config');
const { analyze, analyzeSession, buildMarketNarrative } = require('./analysis');

/* ── NEWS CACHE ── */
let newsCache = { events: [], lastFetch: 0, ttl: 60 * 60 * 1000 };

async function getUpcomingNews() {
  const now = Date.now();
  if (newsCache.events.length && (now - newsCache.lastFetch) < newsCache.ttl) return newsCache.events;
  try {
    const r    = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json');
    const data = await r.json();
    const relevant = data.filter(e =>
      e.impact === 'High' &&
      (e.currency === 'USD' || ['gold','fomc','nfp','cpi','fed'].some(kw => (e.title || '').toLowerCase().includes(kw)))
    ).map(e => ({ title: e.title, time: new Date(e.date).getTime(), currency: e.currency, impact: e.impact }));
    newsCache.events    = relevant;
    newsCache.lastFetch = now;
    return relevant;
  } catch { return newsCache.events; }
}

async function isNewsBlocked() {
  try {
    const events  = await getUpcomingNews();
    const now     = Date.now();
    const BEFORE  = 15 * 60 * 1000;
    const AFTER   = 5  * 60 * 1000;
    for (const e of events) {
      if (e.impact !== 'High') continue;
      if (now >= e.time - BEFORE && now <= e.time + AFTER) {
        const mins = Math.round((e.time - now) / 60000);
        return {
          blocked: true,
          reason: mins > 0
            ? `High-impact news in ${mins} min: ${e.title}`
            : `News spike settling: ${e.title} — wait 5 min`
        };
      }
    }
    return { blocked: false };
  } catch { return { blocked: false }; }
}

async function fetchNewsEvents() {
  try {
    const r    = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json');
    const data = await r.json();
    const now  = Date.now();
    return data.filter(e =>
      e.currency === 'USD' ||
      ['gold','fomc','nfp','cpi','pce','gdp','fed','powell','inflation','interest rate']
        .some(kw => (e.title || '').toLowerCase().includes(kw))
    ).map(e => {
      const eventTime = new Date(e.date).getTime();
      const minsDiff  = Math.round((eventTime - now) / 60000);
      return {
        title: e.title, time: e.date, impact: e.impact, currency: e.currency,
        forecast: e.forecast || 'N/A', previous: e.previous || 'N/A', actual: e.actual || null,
        minsDiff, isPast: eventTime < now, isHigh: e.impact === 'High',
        isUpcoming: eventTime > now && minsDiff <= 240,
        isRecent:   eventTime < now && Math.abs(minsDiff) <= 60
      };
    });
  } catch { return []; }
}

/* ── MACRO CACHE ── */
let macroCache = { scenario: null, lastFetch: 0, ttl: 20 * 60 * 1000 };

async function buildMacroScenario(newsEvents, price) {
  const now = Date.now();
  if (macroCache.scenario && (now - macroCache.lastFetch) < macroCache.ttl) return macroCache.scenario;

  const upcoming   = newsEvents.filter(e => e.isUpcoming).slice(0, 6);
  const recent     = newsEvents.filter(e => e.isRecent).slice(0, 4);
  const today      = newsEvents.filter(e => new Date(e.time).toDateString() === new Date().toDateString()).slice(0, 8);
  const upcomingStr = upcoming.length ? upcoming.map(e => `[${e.impact}] ${e.title} in ${e.minsDiff}min`).join('\n') : 'None';
  const recentStr   = recent.length   ? recent.map(e => `[${e.impact}] ${e.title} ${Math.abs(e.minsDiff)}min ago — Actual:${e.actual||'N/A'}`).join('\n') : 'None';
  const todayStr    = today.length    ? today.map(e => `${e.isPast?'✅':'🔜'} [${e.impact}] ${e.title}`).join('\n') : 'None';

  try {
    const scenarioText = await callAI(
      'Macro analyst specializing in XAUUSD. Concise and actionable. Plain text only.',
      `XAUUSD macro scenario. Gold: ${price}\nTODAY: ${todayStr}\nRECENT: ${recentStr}\nUPCOMING: ${upcomingStr}\n1. MACRO BIAS:\n2. NEWS IMPACT:\n3. RISK LEVEL:\n4. TRADE DIRECTION BIAS:\n5. KEY LEVELS:`,
      400
    );
    macroCache.scenario  = scenarioText;
    macroCache.lastFetch = now;
    return scenarioText;
  } catch { return macroCache.scenario || 'Macro analysis unavailable.'; }
}

/* ── AI CALL (Groq → Gemini fallback) ── */
async function callAI(systemPrompt, userPrompt, maxTokens = 800) {
  let lastError = null;

  for (let attempt = 0; attempt < config.GROQ_KEYS.length; attempt++) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.getGroqKey()}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile', max_tokens: maxTokens, temperature: 0.3,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]
        })
      });
      const d = await r.json();
      if (d.error) {
        const isRate = (d.error.message || '').toLowerCase().includes('rate_limit') || r.status === 429;
        if (isRate) { config.rotateGroqKey(); lastError = new Error(d.error.message); continue; }
        throw new Error('Groq: ' + (d.error.message || JSON.stringify(d.error)));
      }
      return (d.choices?.[0]?.message?.content || '').replace(/\*\*/g, '').replace(/\*/g, '').trim();
    } catch (e) {
      if ((e.message || '').toLowerCase().includes('rate_limit')) { config.rotateGroqKey(); lastError = e; continue; }
      throw e;
    }
  }

  /* Fallback to Gemini */
  if (!config.GEMINI_KEY) throw lastError || new Error('All Groq keys exhausted');
  const gr = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.GEMINI_KEY}`,
    {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents:           [{ parts: [{ text: userPrompt }] }],
        generationConfig:   { maxOutputTokens: maxTokens, temperature: 0.3 }
      })
    }
  );
  const gd = await gr.json();
  if (gd.error) throw new Error('Gemini: ' + (gd.error.message || JSON.stringify(gd.error)));
  return (gd.candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/\*\*/g, '').replace(/\*/g, '').trim();
}

/* ── MAIN AI DECISION ── */
async function aiDecide(candles5, candles15, candles1h, candles4h) {
  const ta5  = analyze(candles5);
  const ta15 = analyze(candles15 || candles5);
  const ta1h = analyze(candles1h  || candles15 || candles5);
  const ta4h = (candles4h && candles4h.length >= 5) ? analyze(candles4h) : ta1h;

  if (!ta5) return { decision: 'WAIT', reason: 'Not enough candle data', confidence: 0 };

  const sessionInfo = analyzeSession(candles5);
  const narrative   = buildMarketNarrative(candles5, candles15, candles1h, candles4h || [], sessionInfo, ta5, ta15, ta1h, ta4h);

  let newsEvents = [], macroScenario = '';
  try {
    newsEvents    = await fetchNewsEvents();
    macroScenario = await buildMacroScenario(newsEvents, ta5.price);
  } catch { macroScenario = 'News/macro unavailable.'; }

  const upcomingHigh = newsEvents.filter(e => e.isUpcoming && e.isHigh);
  const recentHigh   = newsEvents.filter(e => e.isRecent  && e.isHigh);
  const newsWarning  = upcomingHigh.length
    ? `⚠️ HIGH-IMPACT NEWS IN ${upcomingHigh[0].minsDiff} MIN: ${upcomingHigh[0].title}`
    : recentHigh.length
      ? `📰 RECENT: ${recentHigh[0].title} ${Math.abs(recentHigh[0].minsDiff)}min ago — Actual:${recentHigh[0].actual}`
      : 'No major news';

  const recentCandles5  = candles5.slice(0, 8).map((c, i) =>
    `C${i+1}[${c.datetime.slice(11,16)}] O:${parseFloat(c.open).toFixed(1)} H:${parseFloat(c.high).toFixed(1)} L:${parseFloat(c.low).toFixed(1)} C:${parseFloat(c.close).toFixed(1)}`
  ).join('\n');
  const recentCandles15 = (candles15 || candles5).slice(0, 5).map((c, i) =>
    `C${i+1}[${c.datetime.slice(11,16)}] O:${parseFloat(c.open).toFixed(1)} H:${parseFloat(c.high).toFixed(1)} L:${parseFloat(c.low).toFixed(1)} C:${parseFloat(c.close).toFixed(1)}`
  ).join('\n');

  const { liveAccount } = config;
  const prompt = `${narrative}\n\nMACRO:\n${macroScenario}\nNEWS: ${newsWarning}\n\nRECENT 5M:\n${recentCandles5}\nRECENT 15M:\n${recentCandles15}\n\nACCOUNT: Balance $${liveAccount.balance} Leverage 1:${liveAccount.leverage}\n\nRULES: Combine macro + technicals. Min signal: BOS on 5M/15M, EMA bounce, FVG retest, RSI div. SL beyond swing/1.5xATR. TP1:1R TP2:2R TP3:3R.\n\nRespond EXACTLY:\nDECISION: BUY or SELL or WAIT\nCONFIDENCE: (0-100)\nENTRY: (price or N/A)\nSTOP_LOSS: (price or N/A)\nTP1: (price or N/A)\nTP2: (price or N/A)\nTP3: (price or N/A)\nWAIT_REASON: (if WAIT)\nANALYSIS:\n(3-4 lines)`;

  const text = await callAI('Elite XAUUSD trader. ICT/SMC + macro. Plain text only.', prompt, 900);
  const g    = key => { const m = text.match(new RegExp(key + ':\\s*([^\\n]+)', 'i')); return m ? m[1].trim() : null; };
  const analysisMatch = text.match(/ANALYSIS:\s*\n?([\s\S]*)/i);

  return {
    decision:      (g('DECISION') || 'WAIT').toUpperCase().trim(),
    confidence:    parseInt(g('CONFIDENCE') || '0'),
    entry:         g('ENTRY'),
    sl:            g('STOP_LOSS'),
    tp1:           g('TP1'),
    tp2:           g('TP2'),
    tp3:           g('TP3'),
    waitReason:    g('WAIT_REASON'),
    analysis:      analysisMatch ? analysisMatch[1].trim() : text,
    macroScenario,
    newsEvents:    newsEvents.filter(e => e.isUpcoming || e.isRecent).slice(0, 5),
    ta:            ta5,
    sessionInfo,
    ta1h,
    ta4h
  };
}

module.exports = { callAI, aiDecide, isNewsBlocked, fetchNewsEvents };
