/* ══════════════════════════════════════════════════════
   execution.js — Position sizing, MT5 bridge,
                  trade execution, active trade monitor
   ══════════════════════════════════════════════════════ */
const fetch    = require('node-fetch');
const config   = require('./config');
const { callAI } = require('./decision');

const TWELVE_KEY = config.TWELVE_KEY;
const MT5_BRIDGE = config.MT5_BRIDGE;

/* ── POSITION SIZING ── */
function calcPositionSize(entryPrice, slPrice) {
  const { liveAccount, tradingSettings } = config;
  const riskAmount  = liveAccount.balance * (tradingSettings.riskPct / 100);
  const slPoints    = Math.abs(entryPrice - slPrice);

  if (slPoints === 0) {
    return { lotSize: 0.01, riskAmount: riskAmount.toFixed(2), slPoints: '0' };
  }

  const pointValue      = 10;
  let lotSize           = riskAmount / (slPoints * pointValue);
  const marginPerLot    = entryPrice / liveAccount.leverage;
  const maxLotsByMargin = (liveAccount.freeMargin * 0.9) / marginPerLot;

  lotSize = Math.min(lotSize, maxLotsByMargin);
  lotSize = Math.max(0.01, Math.round(lotSize * 100) / 100);

  const marginUsed  = (lotSize * entryPrice / liveAccount.leverage).toFixed(2);
  const actualRisk  = (lotSize * slPoints * pointValue).toFixed(2);

  return {
    lotSize, riskAmount: actualRisk, slPoints: slPoints.toFixed(2),
    riskPct: tradingSettings.riskPct, balance: liveAccount.balance,
    leverage: liveAccount.leverage, marginUsed
  };
}

/* ── MT5 BRIDGE HELPERS ── */
async function mt5OpenTrade(signal, entry, sl, tp1, tp2, lotSize, comment) {
  try {
    const r = await fetch(MT5_BRIDGE + '/open-trade', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: 'XAUUSD', direction: signal, lotSize: lotSize || 0.01,
        sl: parseFloat(sl), tp: parseFloat(tp2), comment: comment || 'AI Signal'
      })
    });
    const data = await r.json();
    if (!data.success) {
      console.log('  ❌ MT5 open failed:', data.error);
      return { success: false, error: data.error };
    }
    return data;
  } catch (e) { return { success: false, error: e.message }; }
}

async function mt5CloseTrade(ticket) {
  try {
    const r = await fetch(MT5_BRIDGE + '/close-trade', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket, symbol: 'XAUUSD' })
    });
    return await r.json();
  } catch { return null; }
}

async function mt5ModifySL(ticket, newSL) {
  try {
    const r = await fetch(MT5_BRIDGE + '/modify-sl', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket, sl: newSL, symbol: 'XAUUSD' })
    });
    return await r.json();
  } catch { return null; }
}

/* ── TRADE EXECUTION ── */
async function executeTrade(aiResult, marketData, { sendSSE, loadJournal, saveJournal, syncMT5Account }) {
  const { decision, confidence }             = aiResult;
  const { price, ta5, ta1h, ta4h, sessionInfo } = marketData;
  const { tradingSettings, liveAccount, state } = config;

  const tier      = confidence >= 85 ? 3 : confidence >= 75 ? 2 : 1;
  const tierLabel = tier === 3 ? '🔴 Tier 3' : tier === 2 ? '🟡 Tier 2' : '🟢 Tier 1';
  const useTa5    = aiResult.ta || ta5;

  /* Safety: bail if useTa5 is missing */
  if (!useTa5 || typeof useTa5.atr !== 'number') {
    console.log('  ⚠️ executeTrade: missing TA data — skipping');
    return;
  }

  const entryPrice = parseFloat(aiResult.entry) || price;
  const slPrice    = parseFloat(aiResult.sl) ||
    (decision === 'BUY'
      ? entryPrice - useTa5.atr * tradingSettings.atrMul
      : entryPrice + useTa5.atr * tradingSettings.atrMul);

  const risk     = Math.abs(entryPrice - slPrice);
  const tp1Price = parseFloat(aiResult.tp1) || (decision === 'BUY' ? entryPrice + risk * tradingSettings.tp1R : entryPrice - risk * tradingSettings.tp1R);
  const tp2Price = parseFloat(aiResult.tp2) || (decision === 'BUY' ? entryPrice + risk * tradingSettings.tp2R : entryPrice - risk * tradingSettings.tp2R);
  const tp3Price = parseFloat(aiResult.tp3) || (decision === 'BUY' ? entryPrice + risk * tradingSettings.tp3R : entryPrice - risk * tradingSettings.tp3R);
  const rr       = (Math.abs(tp2Price - entryPrice) / risk).toFixed(2);

  const posSize = calcPositionSize(entryPrice, slPrice);

  const sessionName = sessionInfo?.currentSession || useTa5?.session?.name || 'Unknown';

  const newTrade = {
    id:             Date.now().toString(),
    timestamp:      new Date().toISOString(),
    signal:         decision,
    session:        sessionName,
    entry:          entryPrice.toFixed(2),
    sl:             slPrice.toFixed(2),
    tp1:            tp1Price.toFixed(2),
    tp2:            tp2Price.toFixed(2),
    tp3:            tp3Price.toFixed(2),
    score:          'AI',
    lotSize:        posSize.lotSize,
    riskAmount:     posSize.riskAmount,
    confidence, tier, tierLabel, rr,
    accountBalance: liveAccount.balance,
    leverage:       liveAccount.leverage,
    structure:      useTa5.structure,
    rsi:            useTa5.rsi?.toFixed(1) || '—',
    factors: [
      useTa5.structure + ' structure',
      useTa5.bos          ? 'BOS '   + useTa5.bos   : null,
      useTa5.choch        ? 'CHoCH ' + useTa5.choch  : null,
      useTa5.inPullback   ? 'Pullback entry'          : null,
      useTa5.orderBlocks?.[0] ? useTa5.orderBlocks[0].type + ' OB'  : null,
      useTa5.fvgs?.[0]        ? useTa5.fvgs[0].type        + ' FVG' : null
    ].filter(Boolean),
    entryAnalysis: aiResult.analysis,
    status:        'PENDING',
    tp1Hit:        false,
    trailingSL:    slPrice.toFixed(2),
    exitPrice: null, exitTime: null, outcome: null, pnl: null, exitNote: null, aiReview: null
  };

  if (tradingSettings.autoTrade) {
    const mt5Result = await mt5OpenTrade(decision, entryPrice, slPrice, tp1Price, tp2Price, posSize.lotSize, `AI ${decision} Conf:${confidence}%`);
    if (!mt5Result || !mt5Result.ticket) {
      const rejectReason = mt5Result?.error || 'MT5 rejected';
      console.log(`  ❌ MT5 rejected: ${rejectReason}`);
      state.aiLogs.unshift({ time: new Date().toLocaleTimeString('en-IN'), decision: 'REJECTED', confidence: 0, message: `MT5: ${rejectReason}` });
      state.aiLogs = state.aiLogs.slice(0, 25);
      sendSSE('AI_UPDATE', { decision: 'WAIT', waitReason: `MT5 rejected: ${rejectReason}`, aiLogs: state.aiLogs, currentSetup: state.currentSetup });
      await syncMT5Account();
      return;
    }
    newTrade.mt5Ticket = mt5Result.ticket;
    newTrade.status    = 'OPEN';
    newTrade.entry     = mt5Result.price ? mt5Result.price.toFixed(2) : entryPrice.toFixed(2);
  } else {
    newTrade.status = 'OPEN';
  }

  const journalData = loadJournal();
  journalData.unshift(newTrade);
  saveJournal(journalData);

  state.activeTrade = newTrade;
  if (state.monitorTimer) clearInterval(state.monitorTimer);
  state.monitorTimer = setInterval(() => checkActiveTrade({ sendSSE, loadJournal, saveJournal, syncMT5Account }), 60 * 1000);
  checkActiveTrade({ sendSSE, loadJournal, saveJournal, syncMT5Account });

  console.log(`\n🚀 TRADE OPEN: ${decision} @ ${newTrade.entry} | Lots:${posSize.lotSize} | Conf:${confidence}% | ${tierLabel}`);
  sendSSE('TRADE_LOCKED', { trade: newTrade });
}

/* ── ACTIVE TRADE MONITOR ── */
async function checkActiveTrade({ sendSSE, loadJournal, saveJournal, syncMT5Account }) {
  const { state, tradingSettings } = config;
  if (!state.activeTrade) return;

  try {
    const r     = await fetch(`https://api.twelvedata.com/price?symbol=XAU/USD&apikey=${TWELVE_KEY}`);
    const data  = await r.json();
    const price = parseFloat(data.price);
    if (isNaN(price)) return;

    const entry = parseFloat(state.activeTrade.entry);
    const sl    = parseFloat(state.activeTrade.sl);
    const tp1   = parseFloat(state.activeTrade.tp1);
    const tp2   = parseFloat(state.activeTrade.tp2);
    const tp3   = parseFloat(state.activeTrade.tp3);
    const isBuy = state.activeTrade.signal === 'BUY';

    state.activeTrade.currentPrice = price.toFixed(2);
    state.activeTrade.livePnl      = (isBuy ? (price - entry) : (entry - price)).toFixed(2);

    let currentSL = parseFloat(state.activeTrade.trailingSL || sl);

    if (state.activeTrade.tp1Hit && tradingSettings.beAtTp1) {
      if (isBuy) currentSL = Math.max(currentSL, entry);
      else       currentSL = Math.min(currentSL, entry);
    }
    if (state.activeTrade.tp1Hit && tradingSettings.trailingSL) {
      const atr = 5;
      if (isBuy) currentSL = Math.max(currentSL, price - atr);
      else       currentSL = Math.min(currentSL, price + atr);
    }
    state.activeTrade.trailingSL = currentSL.toFixed(2);

    const slHit  = isBuy ? price <= currentSL : price >= currentSL;
    const tp1Hit = isBuy ? price >= tp1        : price <= tp1;
    const tp2Hit = isBuy ? price >= tp2        : price <= tp2;
    const tp3Hit = isBuy ? price >= tp3        : price <= tp3;

    if (tp1Hit && !state.activeTrade.tp1Hit) {
      state.activeTrade.tp1Hit    = true;
      state.activeTrade.trailingSL = entry.toFixed(2);
      const j = loadJournal();
      const i = j.findIndex(t => t.id === state.activeTrade.id);
      if (i !== -1) { j[i].tp1Hit = true; j[i].trailingSL = entry.toFixed(2); saveJournal(j); }
      sendSSE('TP1_HIT', { message: 'TP1 hit — SL at breakeven', trailingSL: entry.toFixed(2), tradeId: state.activeTrade.id });
    }

    let outcome = null, exitPrice = null, exitReason = null;

    if (slHit) {
      outcome    = state.activeTrade.tp1Hit ? 'BREAKEVEN' : 'LOSS';
      exitPrice  = currentSL;
      exitReason = state.activeTrade.tp1Hit ? 'Breakeven' : 'Stop Loss hit';
    } else if (tp3Hit) {
      outcome = 'WIN'; exitPrice = tp3; exitReason = '🎯 TP3!';
    } else if (tp2Hit) {
      outcome = 'WIN'; exitPrice = tp2; exitReason = 'TP2 hit';
    }

    /* Time / session exit */
    if (!outcome) {
      const openMins = (Date.now() - new Date(state.activeTrade.timestamp).getTime()) / 60000;
      const { getISTInfo, timeToDecimal } = require('./scanner');
      const { istH } = getISTInfo();
      const sessionExpired = tradingSettings.closeAtSessionEnd && tradingSettings.customEnabled &&
                             istH >= timeToDecimal(tradingSettings.customEnd);
      if (sessionExpired || (tradingSettings.maxHoldTime && openMins >= 180)) {
        outcome    = parseFloat(state.activeTrade.livePnl) >= 0 ? 'WIN' : 'LOSS';
        exitPrice  = price;
        exitReason = sessionExpired
          ? `Session end @ ${price.toFixed(2)}`
          : `Safety close after ${openMins.toFixed(0)} min`;
      }
    }

    /* Still open — just send price update */
    if (!outcome) {
      sendSSE('PRICE_UPDATE', {
        price: price.toFixed(2),
        livePnl: state.activeTrade.livePnl,
        tradeId: state.activeTrade.id,
        tp1Hit: state.activeTrade.tp1Hit || false,
        trailingSL: state.activeTrade.trailingSL
      });
      return;
    }

    /* Close the trade */
    const journal = loadJournal();
    const idx     = journal.findIndex(t => t.id === state.activeTrade.id);
    if (idx !== -1) {
      const pnl = (isBuy ? (parseFloat(exitPrice) - entry) : (entry - parseFloat(exitPrice))).toFixed(2);
      if (state.activeTrade.mt5Ticket && tradingSettings.autoTrade) await mt5CloseTrade(state.activeTrade.mt5Ticket);

      let aiReview = 'Review unavailable';
      try {
        const cr  = await fetch(`https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=5min&outputsize=30&apikey=${TWELVE_KEY}`);
        const cd  = await cr.json();
        const afterStr = (cd.values || []).slice(0, 8).map((c, i) =>
          `C${i+1}[${c.datetime.slice(11,16)}] O:${c.open} H:${c.high} L:${c.low} C:${c.close}`
        ).join('\n') || 'Not available';
        aiReview = await callAI(
          'Elite XAUUSD coach. Plain text.',
          `Trade: ${state.activeTrade.signal} Entry:${state.activeTrade.entry} Exit:${parseFloat(exitPrice).toFixed(2)} Outcome:${outcome} P&L:${pnl}pts Reason:${exitReason}\nAFTER: ${afterStr}\n1. ENTRY QUALITY:\n2. WENT RIGHT:\n3. WENT WRONG:\n4. AFTER EXIT:\n5. NEXT RULE:`,
          600
        );
      } catch { aiReview = 'Review unavailable'; }

      journal[idx] = {
        ...journal[idx],
        status: 'CLOSED', exitPrice: parseFloat(exitPrice).toFixed(2),
        exitTime: new Date().toISOString(), outcome, pnl, exitNote: exitReason,
        tp1Hit: state.activeTrade.tp1Hit || false, aiReview
      };
      saveJournal(journal);
      await syncMT5Account();
      sendSSE('TRADE_CLOSED', { trade: journal[idx], exitReason, newBalance: liveAccount.balance });
    }

    clearInterval(state.monitorTimer);
    state.monitorTimer = null;
    state.activeTrade  = null;

  } catch (e) { console.error('Monitor error:', e.message); }
}

module.exports = { calcPositionSize, executeTrade, checkActiveTrade, mt5OpenTrade, mt5CloseTrade, mt5ModifySL };
