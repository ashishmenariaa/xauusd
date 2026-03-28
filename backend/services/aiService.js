const Helpers = require('../utils/helpers');
const DatabaseQueries = require('../database/queries');

class AIService {
    constructor() {
        this.lastCallTime = 0;
        this.minCallGap = 4 * 60 * 1000; // 4 minutes between AI calls
        this.groqKeyIndex = 0;
        this.config = require('../config');
    }
    
    async analyzeMarket(marketData, technicalAnalysis) {
        // Rate limiting
        const now = Date.now();
        if (now - this.lastCallTime < this.minCallGap) {
            return {
                decision: 'WAIT',
                confidence: 0,
                waitReason: `AI cooldown - next call in ${Math.ceil((this.minCallGap - (now - this.lastCallTime)) / 60000)} minutes`
            };
        }
        
        try {
            this.lastCallTime = now;
            
            // Build market narrative
            const narrative = await this.buildMarketNarrative(marketData, technicalAnalysis);
            
            // Get macro scenario
            const macroScenario = await this.getMacroScenario(marketData.currentPrice);
            
            // Get news context
            const newsContext = await this.getNewsContext();
            
            // Prepare AI prompt
            const prompt = await this.buildAIPrompt(narrative, macroScenario, newsContext, technicalAnalysis);
            
            // Call AI
            const aiResponse = await this.callAI(prompt);
            
            // Parse AI response
            const aiResult = this.parseAIResponse(aiResponse);
            
            // Enhance with technical analysis
            return this.enhanceWithTechnicalAnalysis(aiResult, technicalAnalysis, marketData);
            
        } catch (error) {
            console.error('AI analysis error:', error);
            
            // Log error to journal
            await DatabaseQueries.addJournalEntry({
                type: 'ERROR',
                title: 'AI Analysis Error',
                message: error.message,
                priority: 4
            });
            
            return {
                decision: 'WAIT',
                confidence: 0,
                waitReason: 'AI analysis temporarily unavailable'
            };
        }
    }
    
    async buildMarketNarrative(marketData, technicalAnalysis) {
        const price = marketData.currentPrice;
        const ta5 = technicalAnalysis['5min'] || {};
        const ta15 = technicalAnalysis['15min'] || {};
        const ta1h = technicalAnalysis['1h'] || {};
        const ta4h = technicalAnalysis['4h'] || {};
        
        const settings = await this.getSettings();
        const session = Helpers.isTradingSession(settings);
        
        return `
MARKET ANALYSIS - XAUUSD @ ${price.toFixed(2)}

PRICE ACTION:
- Current: ${price.toFixed(2)}
- 4H Trend: ${ta4h.structure?.structure || 'Unknown'}
- 1H Structure: ${ta1h.structure?.structure || 'Unknown'} 
- 15M BOS: ${ta15.structure?.bos || 'None'}
- 5M BOS: ${ta5.structure?.bos || 'None'}

TECHNICALS:
- RSI(14): ${ta5.rsi?.[ta5.rsi.length - 1]?.toFixed(1) || 'N/A'}
- EMA20: ${ta5.ema20?.[ta5.ema20.length - 1]?.toFixed(2) || 'N/A'}
- EMA50: ${ta5.ema50?.[ta5.ema50.length - 1]?.toFixed(2) || 'N/A'}
- ATR(14): ${ta5.atr?.[ta5.atr.length - 1]?.toFixed(2) || 'N/A'}

SESSION:
- IST Time: ${Helpers.getISTInfo().istHHMM}
- Session: ${session.session}
    `.trim();
    }
    
    async getMacroScenario(price) {
        // This would integrate with news/macro data APIs
        // For now, return a placeholder
        return 'Macro analysis placeholder - would integrate with news APIs';
    }
    
    async getNewsContext() {
        // This would fetch and process news events
        // For now, return empty context
        return {
            highImpactEvents: [],
            recentNews: [],
            economicCalendar: []
        };
    }
    
    async buildAIPrompt(narrative, macroScenario, newsContext, technicalAnalysis) {
        const settings = await this.getSettings();
        
        return `
${narrative}

MACRO CONTEXT:
${macroScenario}

TRADING RULES:
- Risk Management: ${settings.riskPct}% per trade
- Minimum Confidence: ${settings.minConfidence}%
- Session Trading: ${Helpers.isTradingSession(settings).session}
- Account Balance: $${settings.accountBalance}

ANALYSIS REQUEST:
Based on the market data above, provide a trading decision with the following format:

DECISION: BUY or SELL or WAIT
CONFIDENCE: 0-100
ENTRY: price or N/A
STOP_LOSS: price or N/A  
TP1: price or N/A
TP2: price or N/A
TP3: price or N/A
WAIT_REASON: if WAIT
ANALYSIS: brief technical/macro reasoning

Focus on:
- Price action structure
- Support/resistance levels
- Momentum confirmation
- Risk-reward ratio > 1:2
- Session timing appropriateness
    `.trim();
    }
    
    async callAI(prompt) {
        const settings = await this.getSettings();
        const groqKeys = settings.groqKeys || [];
        
        if (groqKeys.length === 0) {
            throw new Error('No Groq API keys configured');
        }
        
        // Rotate keys for rate limiting
        const apiKey = groqKeys[this.groqKeyIndex % groqKeys.length];
        this.groqKeyIndex++;
        
        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an expert XAUUSD trader specializing in ICT/SMC methodology. Provide concise, actionable trading decisions based on technical analysis and price action. Always respond in the exact format specified.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 800,
                    temperature: 0.3
                })
            });
            
            if (!response.ok) {
                throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            return data.choices[0]?.message?.content || '';
            
        } catch (error) {
            // If rate limited, try next key
            if (error.message.includes('rate limit') && this.groqKeyIndex < groqKeys.length) {
                return this.callAI(prompt);
            }
            throw error;
        }
    }
    
    parseAIResponse(response) {
        const lines = response.split('\n');
        const result = {
            decision: 'WAIT',
            confidence: 0,
            entry: null,
            sl: null,
            tp1: null,
            tp2: null,
            tp3: null,
            waitReason: '',
            analysis: '',
            factors: []
        };
        
        for (const line of lines) {
            const lowerLine = line.toLowerCase();
            
            if (lowerLine.startsWith('decision:')) {
                const decision = line.split(':')[1]?.trim().toUpperCase();
                if (['BUY', 'SELL', 'WAIT'].includes(decision)) {
                    result.decision = decision;
                }
            }
            else if (lowerLine.startsWith('confidence:')) {
                result.confidence = parseInt(line.split(':')[1]?.trim()) || 0;
            }
            else if (lowerLine.startsWith('entry:')) {
                result.entry = parseFloat(line.split(':')[1]?.trim());
            }
            else if (lowerLine.startsWith('stop_loss:') || lowerLine.startsWith('sl:')) {
                result.sl = parseFloat(line.split(':')[1]?.trim());
            }
            else if (lowerLine.startsWith('tp1:')) {
                result.tp1 = parseFloat(line.split(':')[1]?.trim());
            }
            else if (lowerLine.startsWith('tp2:')) {
                result.tp2 = parseFloat(line.split(':')[1]?.trim());
            }
            else if (lowerLine.startsWith('tp3:')) {
                result.tp3 = parseFloat(line.split(':')[1]?.trim());
            }
            else if (lowerLine.startsWith('wait_reason:')) {
                result.waitReason = line.split(':')[1]?.trim();
            }
            else if (lowerLine.startsWith('analysis:')) {
                result.analysis = line.split(':')[1]?.trim() || '';
            }
        }
        
        // Extract factors from analysis
        if (result.analysis) {
            const factorKeywords = [
                'break of structure', 'bos', 'market structure shift', 'mss',
                'order block', 'ob', 'fair value gap', 'fvg', 'liquidity', 
                'support', 'resistance', 'ema', 'rsi', 'momentum', 'trend'
            ];
            
            result.factors = factorKeywords.filter(keyword => 
                result.analysis.toLowerCase().includes(keyword)
            );
        }
        
        return result;
    }
    
    enhanceWithTechnicalAnalysis(aiResult, technicalAnalysis, marketData) {
        const ta5 = technicalAnalysis['5min'] || {};
        
        // If AI says WAIT but technicals are strong, consider overriding
        if (aiResult.decision === 'WAIT' && aiResult.confidence < 50) {
            const strongBullishSignals = this.detectStrongSignals(technicalAnalysis, 'bullish');
            const strongBearishSignals = this.detectStrongSignals(technicalAnalysis, 'bearish');
            
            if (strongBullishSignals.length >= 2) {
                aiResult.decision = 'BUY';
                aiResult.confidence = Math.min(75, aiResult.confidence + 25);
                aiResult.waitReason = 'Overridden by strong bullish technicals';
            } else if (strongBearishSignals.length >= 2) {
                aiResult.decision = 'SELL';
                aiResult.confidence = Math.min(75, aiResult.confidence + 25);
                aiResult.waitReason = 'Overridden by strong bearish technicals';
            }
        }
        
        // Ensure risk management
        if (aiResult.entry && aiResult.sl) {
            const risk = Math.abs(aiResult.entry - aiResult.sl);
            if (risk < 1.0) { // Minimum 1.0 point risk
                const adjustment = aiResult.decision === 'BUY' ? 1.0 : -1.0;
                aiResult.sl = aiResult.entry - (adjustment * 1.0);
            }
        }
        
        // Add technical context
        aiResult.technicalContext = {
            rsi: ta5.rsi?.[ta5.rsi.length - 1],
            atr: ta5.atr?.[ta5.atr.length - 1],
            structure: ta5.structure,
            price: marketData.currentPrice
        };
        
        return aiResult;
    }
    
    detectStrongSignals(technicalAnalysis, direction) {
        const signals = [];
        const timeframes = ['5min', '15min', '1h'];
        
        for (const tf of timeframes) {
            const ta = technicalAnalysis[tf];
            if (!ta || !ta.structure) continue;
            
            if (ta.structure.structure === direction) {
                signals.push(`${tf} structure`);
            }
            
            if (ta.structure.bos === direction) {
                signals.push(`${tf} BOS`);
            }
        }
        
        return signals;
    }
    
    async getSettings() {
        try {
            if (global.appState && global.appState.settings) {
                return global.appState.settings;
            }
            
            // Fallback to database settings
            const settings = await DatabaseQueries.getSettings();
            return settings.toObject ? settings.toObject() : settings;
        } catch (error) {
            console.error('Error getting settings:', error);
            return this.config;
        }
    }
}

module.exports = new AIService();
