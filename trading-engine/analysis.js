/* ══════════════════════════════════════════════════════
   analysis.js — Technical analysis, session analysis,
                 market narrative, pre-filter logic
   ══════════════════════════════════════════════════════ */

/* ── CORE TA ── */
function analyze(candles) {
  if (!candles || candles.length < 10) return null;

  const closes = candles.map(c => parseFloat(c.close));
  const highs   = candles.map(c => parseFloat(c.high));
  const lows    = candles.map(c => parseFloat(c.low));
  const opens   = candles.map(c => parseFloat(c.open));

  /* ATR-14 */
  const atrLen = Math.min(14, candles.length - 1);
  const atr14  = (() => {
    const slice = candles.slice(0, atrLen + 1);
    let trSum = 0;
    for (let i = 0; i < atrLen; i++) {
      const h  = parseFloat(slice[i].high);
      const l  = parseFloat(slice[i].low);
      const pc = parseFloat(slice[i + 1]?.close || slice[i].open);
      trSum += Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    }
    return trSum / atrLen;
  })();
  

  /* EMA helper */
  function ema(arr, period) {
    const p = Math.min(period, arr.length), k = 2 / (p + 1);
    let val = arr.slice(0, p).reduce((a, b) => a + b, 0) / p;
    for (let i = p; i < arr.length; i++) val = arr[i] * k + val * (1 - k);
    return val;
  }
  const closesAsc = closes.slice().reverse();
  const ema20 = ema(closesAsc, Math.min(20, closesAsc.length));
  const ema50 = ema(closesAsc, Math.min(50, closesAsc.length));

  /* RSI-14 */
  const rsiPrices = closes.slice(0, Math.min(50, closes.length)).reverse();
  const rsiLen    = Math.min(14, rsiPrices.length - 1);
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= rsiLen; i++) {
    const diff = rsiPrices[i] - rsiPrices[i - 1];
    if (diff >= 0) avgGain += diff; else avgLoss += Math.abs(diff);
  }
  avgGain /= rsiLen; avgLoss /= rsiLen;
  for (let i = rsiLen + 1; i < rsiPrices.length; i++) {
    const diff = rsiPrices[i] - rsiPrices[i - 1];
    avgGain = (avgGain * (rsiLen - 1) + (diff >= 0 ? diff : 0)) / rsiLen;
    avgLoss = (avgLoss * (rsiLen - 1) + (diff < 0 ? Math.abs(diff) : 0)) / rsiLen;
  }
  const rs  = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));

  /* Swing highs / lows */
  const swingHighs = [], swingLows = [];
  const swingWindow = Math.min(20, candles.length - 2);
  for (let i = 2; i < swingWindow; i++) {
    if (highs[i] > highs[i-1] && highs[i] > highs[i-2] && highs[i] > highs[i+1] && highs[i] > highs[i+2])
      swingHighs.push({ price: highs[i], idx: i });
    if (lows[i] < lows[i-1] && lows[i] < lows[i-2] && lows[i] < lows[i+1] && lows[i] < lows[i+2])
      swingLows.push({ price: lows[i], idx: i });
  }

  /* Market structure */
  let structure = 'ranging';
  if (swingHighs.length >= 2 && swingLows.length >= 2) {
    const hh = swingHighs[0].price > swingHighs[1].price;
    const hl = swingLows[0].price  > swingLows[1].price;
    const lh = swingHighs[0].price < swingHighs[1].price;
    const ll = swingLows[0].price  < swingLows[1].price;
    if (hh && hl) structure = 'bullish';
    else if (lh && ll) structure = 'bearish';
  } else {
    structure = closes[0] > ema20 ? 'bullish' : closes[0] < ema20 ? 'bearish' : 'ranging';
  }

  /* BOS / CHoCH */
  let bos = null, choch = null;
  if (swingHighs.length > 0 && closes[0] > swingHighs[0].price) bos = 'bullish';
  if (swingLows.length  > 0 && closes[0] < swingLows[0].price)  bos = 'bearish';
  if (structure === 'bullish' && swingLows.length >= 2 && lows[0] < swingLows[1].price)     choch = 'bearish';
  if (structure === 'bearish' && swingHighs.length >= 2 && highs[0] > swingHighs[1].price)  choch = 'bullish';

  /* Order blocks */
  const orderBlocks = [];
  for (let i = 1; i < Math.min(15, candles.length - 1); i++) {
    const prevBull = closes[i]   > opens[i];
    const currBull = closes[i-1] > opens[i-1];
    if (!prevBull && currBull && closes[i-1] > highs[i])
      orderBlocks.push({ type: 'bullish', high: highs[i], low: lows[i], idx: i });
    if (prevBull && !currBull && closes[i-1] < lows[i])
      orderBlocks.push({ type: 'bearish', high: highs[i], low: lows[i], idx: i });
  }

  /* FVGs */
  const fvgs = [];
  for (let i = 1; i < Math.min(10, candles.length - 1); i++) {
    if (lows[i-1]  > highs[i+1]) fvgs.push({ type: 'bullish', top: lows[i-1],  bot: highs[i+1] });
    if (highs[i-1] < lows[i+1])  fvgs.push({ type: 'bearish', top: lows[i+1],  bot: highs[i-1] });
  }

  const recentHigh = Math.max(...highs.slice(0, 20));
  const recentLow  = Math.min(...lows.slice(0, 20));
  const last3bull  = closes.slice(0, 3).every((c, i) => c > opens[i]);
  const last3bear  = closes.slice(0, 3).every((c, i) => c < opens[i]);
  const inPullback = (structure === 'bearish' && (last3bull || closes[0] > closes[1]))
                  || (structure === 'bullish' && (last3bear || closes[0] < closes[1]));

  /* Weekend check */
  const nowIST    = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const istDecimal = nowIST.getUTCHours() + nowIST.getUTCMinutes() / 60;
  const istDay    = nowIST.getUTCDay();
  const isWeekend = istDay === 0 || istDay === 6 || (istDay === 5 && istDecimal >= 20.5);

  return {
    price: closes[0], atr: atr14, ema20, ema50, rsi,
    structure, bos, choch, orderBlocks, fvgs,
    recentHigh, recentLow, inPullback, swingHighs, swingLows,
    session: { name: isWeekend ? 'Market Closed' : 'Valid Session', valid: !isWeekend },
    last3bull, last3bear
  };
}

/* ── TRADING SIGNALS ── */
function generateTradingSignals(ta, price) {
  if (!ta || !price) return [];

  const signals = [];

  if (
    ta.structure === 'bullish' &&
    ta.bos === 'bullish' &&
    ta.rsi > 50 &&
    ta.inPullback
  ) {
    signals.push({
      type: 'structure',
      direction: 'BUY',
      confidence: 70,
      entry: price,
      stopLoss: price - ta.atr,
      takeProfit: price + ta.atr * 2,
      reason: 'Bullish structure + BOS + pullback + momentum'
    });
  }

  if (
    ta.structure === 'bearish' &&
    ta.bos === 'bearish' &&
    ta.rsi < 50 &&
    ta.inPullback
  ) {
    signals.push({
      type: 'structure',
      direction: 'SELL',
      confidence: 70,
      entry: price,
      stopLoss: price + ta.atr,
      takeProfit: price - ta.atr * 2,
      reason: 'Bearish structure + BOS + pullback + momentum'
    });
  }

  return signals;
}

/* ── SESSION ANALYSIS ── */
function analyzeSession(candles5) {
  if (!candles5 || candles5.length < 10) return null;

  const candlesWithTime = candles5.map(c => ({
    ...c,
    hour: new Date(new Date(c.datetime).getTime() + 5.5 * 3600000).getUTCHours()
  }));

  const asianCandles  = candlesWithTime.filter(c => c.hour >= 5  && c.hour < 11);
  const londonCandles = candlesWithTime.filter(c => c.hour >= 13 && c.hour < 18);
  const nyCandles     = candlesWithTime.filter(c => c.hour >= 18 && c.hour < 23);

  const asianHigh = asianCandles.length > 0 ? Math.max(...asianCandles.map(c => parseFloat(c.high))) : null;
  const asianLow  = asianCandles.length > 0 ? Math.min(...asianCandles.map(c => parseFloat(c.low)))  : null;

  let londonSweep = null;
  if (asianHigh && asianLow && londonCandles.length > 0) {
    const lLow  = Math.min(...londonCandles.map(c => parseFloat(c.low)));
    const lHigh = Math.max(...londonCandles.map(c => parseFloat(c.high)));
    if (lLow  < asianLow)  londonSweep = 'swept_asian_low';
    if (lHigh > asianHigh) londonSweep = 'swept_asian_high';
  }

  let londonDirection = 'ranging';
  if (londonCandles.length >= 4) {
    const first = parseFloat(londonCandles[londonCandles.length - 1].close);
    const last  = parseFloat(londonCandles[0].close);
    const move  = last - first;
    londonDirection = move > 5 ? 'bullish' : move < -5 ? 'bearish' : 'ranging';
  }

  const istH = new Date(Date.now() + 5.5 * 60 * 60 * 1000).getUTCHours() +
               new Date(Date.now() + 5.5 * 60 * 60 * 1000).getUTCMinutes() / 60;

  const currentSession = istH >= 18 && istH < 23 ? 'New York'
    : istH >= 13 && istH < 18 ? 'London'
    : istH >= 5  && istH < 11 ? 'Asian'
    : 'Off-Hours';

  return {
    asianHigh:        asianHigh ? asianHigh.toFixed(2) : 'N/A',
    asianLow:         asianLow  ? asianLow.toFixed(2)  : 'N/A',
    asianRange:       asianHigh && asianLow ? (asianHigh - asianLow).toFixed(2) : 'N/A',
    londonSweep:      londonSweep || 'no sweep yet',
    londonDirection,
    currentSession,
    londonCandleCount: londonCandles.length,
    nyCandleCount:     nyCandles.length
  };
}

/* ── PRE-FILTER (no AI call if no edge) ── */
function localPreFilter(candles5, candles15, candles1h) {
  const ta5  = analyze(candles5);
  const ta15 = analyze(candles15 || candles5);
  if (!ta5 || !ta15) return { pass: false, reason: 'Insufficient candle data' };
  if (!ta5.session.valid) return { pass: false, reason: `Off-session (${ta5.session.name})` };

  const noSignal5  = !ta5.bos  && ta5.orderBlocks.length === 0 && ta5.fvgs.length === 0 && ta5.structure === 'ranging';
  const noSignal15 = !ta15.bos && ta15.orderBlocks.length === 0 && ta15.fvgs.length === 0 && ta15.structure === 'ranging';
  const noSignal1h = candles1h
    ? (() => { const t = analyze(candles1h); return t ? (!t.bos && t.orderBlocks.length === 0 && t.structure === 'ranging') : true; })()
    : false;

  if (noSignal5 && noSignal15 && noSignal1h) return { pass: false, reason: 'All TFs ranging — no edge' };

  if (ta5.rsi > 85 && ta5.structure === 'ranging' && ta15.structure === 'ranging')
    return { pass: false, reason: `RSI ${ta5.rsi.toFixed(1)} extremely overbought on ranging market` };
  if (ta5.rsi < 15 && ta5.structure === 'ranging' && ta15.structure === 'ranging')
    return { pass: false, reason: `RSI ${ta5.rsi.toFixed(1)} extremely oversold on ranging market` };

  return { pass: true };
}

/* ── MARKET NARRATIVE (text prompt for AI) ── */
function buildMarketNarrative(candles5, candles15, candles1h, candles4h, sessionInfo, ta5, ta15, ta1h, ta4h) {
  const price   = candles5.length > 0 ? parseFloat(candles5[0].close) : 0;
  const trend4h = ta4h ? ta4h.structure : (ta1h ? ta1h.structure : 'unknown');

  const highs5  = candles5.slice(0, 50).map(c => parseFloat(c.high));
  const lows5   = candles5.slice(0, 50).map(c => parseFloat(c.low));

  const last5   = candles5.slice(0, 5);
  const avgWick = last5.map(c => {
    const body = Math.abs(parseFloat(c.close) - parseFloat(c.open));
    const rng  = parseFloat(c.high) - parseFloat(c.low);
    return rng > 0 ? body / rng : 0;
  }).reduce((a, b) => a + b, 0) / last5.length;

  const candleChar  = avgWick < 0.3 ? 'indecision' : avgWick > 0.7 ? 'conviction' : 'mixed';
  const last3closes = candles5.slice(0, 3).map(c => parseFloat(c.close));
  const last3opens  = candles5.slice(0, 3).map(c => parseFloat(c.open));
  const bullCount   = last3closes.filter((c, i) => c > last3opens[i]).length;
  const momentumDir = bullCount >= 2 ? 'bullish' : bullCount === 0 ? 'bearish' : 'mixed';

  return `MARKET STORY — XAUUSD @ ${price.toFixed(2)}
SESSION: ${sessionInfo?.currentSession} | Asian ${sessionInfo?.asianLow}–${sessionInfo?.asianHigh} | London: ${sessionInfo?.londonSweep} | Dir: ${sessionInfo?.londonDirection}
4H: ${trend4h} | 1H: ${ta1h?.structure} BOS:${ta1h?.bos||'none'} | 15M: ${ta15?.structure} BOS:${ta15?.bos||'none'} | 5M: ${ta5?.structure} BOS:${ta5?.bos||'none'}
High50: ${Math.max(...highs5).toFixed(2)} | Low50: ${Math.min(...lows5).toFixed(2)} | EMA20: ${ta5?.ema20?.toFixed(2)} | EMA50: ${ta5?.ema50?.toFixed(2)}
RSI: ${ta5?.rsi?.toFixed(1)} | ATR: ${ta5?.atr?.toFixed(2)} | OB5M: ${(ta5?.orderBlocks||[]).slice(0,2).map(o=>o.type+' '+o.low.toFixed(2)+'-'+o.high.toFixed(2)).join(', ')||'none'}
FVG: ${(ta5?.fvgs||[]).slice(0,2).map(f=>f.type+' '+f.bot.toFixed(2)+'-'+f.top.toFixed(2)).join(', ')||'none'} | Candles: ${candleChar} | Momentum: ${momentumDir}`;
}

module.exports = {
  analyzePriceAction: analyze,
  generateTradingSignals
};
