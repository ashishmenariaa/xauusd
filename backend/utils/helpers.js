class Helpers {
  // Generate unique ID
  static generateId(prefix = '') {
    return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Format price with 2 decimal places
  static formatPrice(price) {
    return parseFloat(price).toFixed(2);
  }
  
  // Calculate percentage change
  static calculatePercentageChange(oldValue, newValue) {
    if (!oldValue || oldValue === 0) return 0;
    return ((newValue - oldValue) / oldValue) * 100;
  }
  
  // Convert time to decimal (HH:MM to decimal hours)
  static timeToDecimal(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours + (minutes / 60);
  }
  
  // Get current IST time info
  static getISTInfo() {
    const istMs = Date.now() + (5.5 * 60 * 60 * 1000); // IST is UTC+5:30
    const ist = new Date(istMs);
    return {
      ist,
      istHour: ist.getUTCHours(),
      istMinute: ist.getUTCMinutes(),
      istDecimal: ist.getUTCHours() + (ist.getUTCMinutes() / 60),
      istDay: ist.getUTCDay(), // 0 = Sunday, 6 = Saturday
      istHHMM: `${ist.getUTCHours().toString().padStart(2, '0')}:${ist.getUTCMinutes().toString().padStart(2, '0')}`
    };
  }
  
  // Check if current time is within trading session
  static isTradingSession(settings) {
    const { istDecimal, istDay } = this.getISTInfo();
    
    // Weekend check
    if (istDay === 0 || istDay === 6 || (istDay === 5 && istDecimal >= 20.5)) {
      return { inSession: false, reason: 'Weekend' };
    }
    
    // Custom session
    if (settings.customEnabled) {
      const start = this.timeToDecimal(settings.customStart);
      const end = this.timeToDecimal(settings.customEnd);
      if (istDecimal >= start && istDecimal < end) {
        return { inSession: true, session: 'Custom' };
      }
    }
    
    // Morning session
    if (settings.morningEnabled) {
      const start = this.timeToDecimal(settings.morningStart);
      const end = this.timeToDecimal(settings.morningEnd);
      if (istDecimal >= start && istDecimal < end) {
        return { inSession: true, session: 'Morning' };
      }
    }
    
    // Evening session
    if (settings.eveningEnabled) {
      const start = this.timeToDecimal(settings.eveningStart);
      const end = this.timeToDecimal(settings.eveningEnd);
      if (istDecimal >= start && istDecimal < end) {
        return { inSession: true, session: 'Evening' };
      }
    }
    
    return { inSession: false, reason: 'Outside trading hours' };
  }
  
  // Calculate position size
  static calculatePositionSize(entryPrice, slPrice, riskAmount, leverage = 100) {
    const riskPoints = Math.abs(entryPrice - slPrice);
    if (riskPoints === 0) return { lotSize: 0.01, riskAmount, riskPoints: 0 };
    
    const pointValue = 10; // For XAUUSD, 1 point = $10 per lot
    let lotSize = riskAmount / (riskPoints * pointValue);
    
    // Apply margin constraints
    const marginPerLot = entryPrice / leverage;
    const maxLotsByMargin = (riskAmount * 10) / marginPerLot; // Conservative margin usage
    
    lotSize = Math.min(lotSize, maxLotsByMargin);
    lotSize = Math.max(0.01, Math.round(lotSize * 100) / 100); // Min 0.01 lot
    
    const marginUsed = (lotSize * entryPrice / leverage).toFixed(2);
    const actualRisk = (lotSize * riskPoints * pointValue).toFixed(2);
    
    return {
      lotSize,
      riskAmount: actualRisk,
      riskPoints: riskPoints.toFixed(2),
      marginUsed,
      leverage
    };
  }
  
  // Validate trade parameters
  static validateTrade(signal, entry, sl, tp1, tp2) {
    const errors = [];
    
    if (!['BUY', 'SELL'].includes(signal)) {
      errors.push('Signal must be BUY or SELL');
    }
    
    if (!entry || entry <= 0) {
      errors.push('Valid entry price required');
    }
    
    if (!sl || sl <= 0) {
      errors.push('Valid stop loss required');
    }
    
    if (signal === 'BUY') {
      if (sl >= entry) errors.push('SL must be below entry for BUY');
      if (tp1 && tp1 <= entry) errors.push('TP1 must be above entry for BUY');
      if (tp2 && tp2 <= tp1) errors.push('TP2 must be above TP1 for BUY');
    } else {
      if (sl <= entry) errors.push('SL must be above entry for SELL');
      if (tp1 && tp1 >= entry) errors.push('TP1 must be below entry for SELL');
      if (tp2 && tp2 >= tp1) errors.push('TP2 must be below TP1 for SELL');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  // Sleep function
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Retry function with exponential backoff
  static async retry(fn, retries = 3, delay = 1000) {
    try {
      return await fn();
    } catch (error) {
      if (retries === 0) throw error;
      await this.sleep(delay);
      return this.retry(fn, retries - 1, delay * 2);
    }
  }
}

module.exports = Helpers;
