class TechnicalAnalysis {
  // Calculate Simple Moving Average
  static SMA(data, period) {
    if (data.length < period) return null;
    
    const result = [];
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
    return result;
  }
  
  // Calculate Exponential Moving Average
  static EMA(data, period) {
    if (data.length < period) return null;
    
    const k = 2 / (period + 1);
    const result = [data[0]]; // First value is the same as SMA
    
    for (let i = 1; i < data.length; i++) {
      const ema = data[i] * k + result[i - 1] * (1 - k);
      result.push(ema);
    }
    return result;
  }
  
  // Calculate RSI
  static RSI(data, period = 14) {
    if (data.length < period + 1) return null;
    
    const gains = [];
    const losses = [];
    
    // Calculate gains and losses
    for (let i = 1; i < data.length; i++) {
      const change = data[i] - data[i - 1];
      gains.push(Math.max(change, 0));
      losses.push(Math.max(-change, 0));
    }
    
    // Calculate first average gains and losses
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    const rsi = [100 - (100 / (1 + (avgLoss === 0 ? Infinity : avgGain / avgLoss)))];
    
    // Calculate subsequent RSI values
    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      
      const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
    
    return rsi;
  }
  
  // Calculate ATR (Average True Range)
  static ATR(candles, period = 14) {
    if (candles.length < period + 1) return null;
    
    const trueRanges = [];
    
    for (let i = 1; i < candles.length; i++) {
      const current = candles[i];
      const previous = candles[i - 1];
      
      const tr = Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close)
      );
      trueRanges.push(tr);
    }
    
    // Calculate ATR
    const atr = [trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period];
    
    for (let i = period; i < trueRanges.length; i++) {
      atr.push((atr[atr.length - 1] * (period - 1) + trueRanges[i]) / period);
    }
    
    return atr;
  }
  
  // Identify support and resistance levels
  static findSupportResistance(candles, lookback = 20) {
    if (candles.length < lookback) return { supports: [], resistances: [] };
    
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    
    const supports = [];
    const resistances = [];
    
    for (let i = lookback; i < candles.length - lookback; i++) {
      const currentHigh = highs[i];
      const currentLow = lows[i];
      
      // Check for resistance (swing high)
      const leftHighs = highs.slice(i - lookback, i);
      const rightHighs = highs.slice(i + 1, i + lookback + 1);
      
      if (currentHigh > Math.max(...leftHighs) && currentHigh > Math.max(...rightHighs)) {
        resistances.push({
          price: currentHigh,
          index: i,
          strength: leftHighs.length + rightHighs.length
        });
      }
      
      // Check for support (swing low)
      const leftLows = lows.slice(i - lookback, i);
      const rightLows = lows.slice(i + 1, i + lookback + 1);
      
      if (currentLow < Math.min(...leftLows) && currentLow < Math.min(...rightLows)) {
        supports.push({
          price: currentLow,
          index: i,
          strength: leftLows.length + rightLows.length
        });
      }
    }
    
    return { supports, resistances };
  }
  
  // Detect market structure
  static analyzeMarketStructure(candles) {
    if (candles.length < 10) return { structure: 'ranging', trend: 'neutral' };
    
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const closes = candles.map(c => c.close);
    
    // Simple trend detection
    const recentCloses = closes.slice(0, 5);
    const trend = recentCloses.every((c, i, arr) => i === 0 || c > arr[i - 1]) ? 'bullish' :
                 recentCloses.every((c, i, arr) => i === 0 || c < arr[i - 1]) ? 'bearish' : 'neutral';
    
    // Structure detection
    const lastHigh = Math.max(...highs.slice(0, 3));
    const lastLow = Math.min(...lows.slice(0, 3));
    const prevHigh = Math.max(...highs.slice(3, 6));
    const prevLow = Math.min(...lows.slice(3, 6));
    
    let structure = 'ranging';
    if (lastHigh > prevHigh && lastLow > prevLow) structure = 'bullish';
    if (lastHigh < prevHigh && lastLow < prevLow) structure = 'bearish';
    
    // Break of structure detection
    let bos = null;
    if (structure === 'bullish' && closes[0] > lastHigh) bos = 'bullish';
    if (structure === 'bearish' && closes[0] < lastLow) bos = 'bearish';
    
    return {
      structure,
      trend,
      bos,
      lastHigh,
      lastLow,
      prevHigh,
      prevLow
    };
  }
  
  // Calculate Fibonacci retracement levels
  static fibonacciRetracement(high, low) {
    const diff = high - low;
    return {
      level_0: high,
      level_23_6: high - diff * 0.236,
      level_38_2: high - diff * 0.382,
      level_50: high - diff * 0.5,
      level_61_8: high - diff * 0.618,
      level_78_6: high - diff * 0.786,
      level_100: low
    };
  }
  
  // Detect candlestick patterns
  static detectCandlestickPatterns(candles) {
    if (candles.length < 3) return [];
    
    const patterns = [];
    
    for (let i = 2; i < candles.length; i++) {
      const current = candles[i];
      const previous = candles[i - 1];
      const twoPrevious = candles[i - 2];
      
      // Bullish Engulfing
      if (previous.open > previous.close && // Previous bearish
          current.close > current.open &&    // Current bullish
          current.open < previous.close &&   // Opens below previous close
          current.close > previous.open) {   // Closes above previous open
        patterns.push({ type: 'BULLISH_ENGULFING', index: i, confidence: 0.7 });
      }
      
      // Bearish Engulfing
      if (previous.close > previous.open && // Previous bullish
          current.open > current.close &&    // Current bearish
          current.open > previous.close &&   // Opens above previous close
          current.close < previous.open) {   // Closes below previous open
        patterns.push({ type: 'BEARISH_ENGULFING', index: i, confidence: 0.7 });
      }
      
      // Hammer (bullish reversal)
      if (current.close > current.open && // Bullish candle
          (current.close - current.open) * 2 <= (current.open - current.low) && // Long lower wick
          (current.high - current.close) <= (current.close - current.open)) { // Small or no upper wick
        patterns.push({ type: 'HAMMER', index: i, confidence: 0.6 });
      }
      
      // Shooting Star (bearish reversal)
      if (current.open > current.close && // Bearish candle
          (current.open - current.close) * 2 <= (current.high - current.open) && // Long upper wick
          (current.close - current.low) <= (current.open - current.close)) { // Small or no lower wick
        patterns.push({ type: 'SHOOTING_STAR', index: i, confidence: 0.6 });
      }
    }
    
    return patterns;
  }
}

module.exports = TechnicalAnalysis;
