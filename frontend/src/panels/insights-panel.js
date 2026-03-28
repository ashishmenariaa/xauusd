// panels/insights-panel.js - Insights Panel Component
export function initInsightsPanel() {
    const container = document.getElementById('panel-insights');
    if (!container) return;

    container.innerHTML = `
        <div style="display:flex;gap:10px;margin-bottom:16px;align-items:center">
            <button class="btn btn-gold" onclick="generateInsights()">🧠 Generate AI Insights</button>
            <span id="insights-loader" style="display:none"><span class="loader"></span> Analysing journal…</span>
        </div>
        <div class="grid-2" style="margin-bottom:16px">
            <div class="stat-card"><div class="s-val price-up" id="ins-wr">—</div><div class="s-lbl">Win Rate</div></div>
            <div class="stat-card"><div class="s-val" id="ins-total">—</div><div class="s-lbl">Trades Analysed</div></div>
        </div>
        <div class="insight-box" id="insights-box">Click "Generate AI Insights" to analyse your trading journal.</div>
    `;
}

async function generateInsights() {
    const loader = document.getElementById('insights-loader');
    const insightsBox = document.getElementById('insights-box');
    
    loader.style.display = '';
    insightsBox.textContent = 'Analysing your trading patterns...';
    
    try {
        const response = await fetch('/api/journal/insights');
        if (!response.ok) throw new Error('Failed to generate insights');
        
        const insights = await response.json();
        renderInsights(insights);
        
    } catch (error) {
        insightsBox.innerHTML = `
            <div style="color:var(--red);text-align:center;padding:20px">
                <div>⚠️ Error generating insights</div>
                <div style="font-size:12px;margin-top:8px">\${error.message}</div>
            </div>
        `;
    } finally {
        loader.style.display = 'none';
    }
}

function renderInsights(insights) {
    const insightsBox = document.getElementById('insights-box');
    const wrEl = document.getElementById('ins-wr');
    const totalEl = document.getElementById('ins-total');
    
    if (wrEl && insights.winRate) {
        wrEl.textContent = insights.winRate.toFixed(1) + '%';
    }
    
    if (totalEl && insights.totalTrades) {
        totalEl.textContent = insights.totalTrades;
    }
    
    let html = '';
    
    if (insights.bestSession) {
        html += `
            <div style="margin-bottom:16px">
                <div style="font-size:12px;color:var(--gold);font-weight:600;margin-bottom:4px">📊 Best Trading Session</div>
                <div style="font-size:11px;color:var(--text-secondary)">
                    \${insights.bestSession.session}: \${insights.bestSession.winRate}% win rate (\${insights.bestSession.totalTrades} trades)
                </div>
            </div>
        `;
    }
    
    if (insights.bestTime) {
        html += `
            <div style="margin-bottom:16px">
                <div style="font-size:12px;color:var(--gold);font-weight:600;margin-bottom:4px">🕐 Optimal Trading Time</div>
                <div style="font-size:11px;color:var(--text-secondary)">
                    Hour \${insights.bestTime.hour}: \${insights.bestTime.winRate}% win rate
                </div>
            </div>
        `;
    }
    
    if (insights.recommendations && insights.recommendations.length) {
        html += `
            <div style="margin-bottom:16px">
                <div style="font-size:12px;color:var(--cyan);font-weight:600;margin-bottom:4px">💡 Recommendations</div>
                <div style="font-size:11px;color:var(--text-secondary);line-height:1.6">
                    \${insights.recommendations.map(rec => \`• \${rec.message}\`).join('<br>')}
                </div>
            </div>
        `;
    }
    
    if (insights.patterns) {
        html += `
            <div style="margin-bottom:16px">
                <div style="font-size:12px;color:var(--purple);font-weight:600;margin-bottom:4px">🔍 Detected Patterns</div>
                <div style="font-size:11px;color:var(--text-secondary);line-height:1.6">
                    \${Object.entries(insights.patterns).map(([key, value]) => \`• \${key}: \${value}\`).join('<br>')}
                </div>
            </div>
        `;
    }
    
    if (!html) {
        html = '<div style="color:var(--text-tertiary);text-align:center;padding:20px">No insights available. Trade more to generate insights.</div>';
    }
    
    insightsBox.innerHTML = html;
}

window.generateInsights = generateInsights;
