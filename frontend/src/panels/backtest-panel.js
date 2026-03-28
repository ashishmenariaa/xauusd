// panels/backtest-panel.js - Backtest Panel Component
export function initBacktestPanel() {
    const container = document.getElementById('panel-backtest');
    if (!container) return;

    container.innerHTML = `
        <div class="card" style="margin-bottom:16px">
            <div class="card-title"><span>⚙️</span> Backtest Configuration</div>
            <div class="grid-2">
                <div class="form-group"><label>Timeframe</label><select id="bt-tf"><option value="5min">5 Minutes</option><option value="15min" selected>15 Minutes</option><option value="1h">1 Hour</option></select></div>
                <div class="form-group"><label>Candle Count</label><input type="number" id="bt-count" value="500" min="30" max="5000"/></div>
                <div class="form-group"><label>Min Confidence (%)</label><input type="number" id="bt-conf" value="80" min="50" max="100"/></div>
                <div class="form-group"><label>Risk per Trade (%)</label><input type="number" id="bt-risk" value="1" min="0.1" max="5" step="0.1"/></div>
            </div>
            <button class="btn btn-gold" onclick="runBacktest()">▶ Run Backtest</button>
        </div>
        <div id="backtest-result" class="backtest-result"><div class="empty-state">Configure and run backtest above</div></div>
    `;
}

async function runBacktest() {
    const config = {
        timeframe: document.getElementById('bt-tf').value,
        candleCount: parseInt(document.getElementById('bt-count').value),
        minConfidence: parseInt(document.getElementById('bt-conf').value),
        riskPerTrade: parseFloat(document.getElementById('bt-risk').value)
    };

    const resultEl = document.getElementById('backtest-result');
    resultEl.innerHTML = '<div style="display:flex;align-items:center;gap:10px;padding:20px"><span class="loader"></span> Running backtest...</div>';

    try {
        const response = await fetch('/api/backtest/run', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify(config)
        });

        if (!response.ok) throw new Error('Backtest failed');
        
        const result = await response.json();
        renderBacktestResult(result);
        
    } catch (error) {
    resultEl.innerHTML = `
        <div style="color:var(--red);padding:20px;text-align:center">
            <div>⚠️ Backtest Error</div>
            <div style="font-size:12px;margin-top:8px">${error.message}</div>
            <button class="btn btn-ghost" onclick="runBacktest()" style="margin-top:12px">↺ Retry</button>
        </div>
    `;
}
}

function renderBacktestResult(result) {
    const resultEl = document.getElementById('backtest-result');
    
  resultEl.innerHTML = `
    <div class="grid-4" style="margin-bottom:16px">
        <div class="stat-card"><div class="s-val">${result.totalTrades || 0}</div><div class="s-lbl">Total Trades</div></div>
        <div class="stat-card"><div class="s-val price-up">${result.winningTrades || 0}</div><div class="s-lbl">Wins</div></div>
        <div class="stat-card"><div class="s-val price-down">${result.losingTrades || 0}</div><div class="s-lbl">Losses</div></div>
        <div class="stat-card"><div class="s-val">${result.winRate ? result.winRate.toFixed(1) + '%' : '0%'}</div><div class="s-lbl">Win Rate</div></div>
    </div>

    <div class="grid-3" style="margin-bottom:16px">
        <div class="stat-card">
            <div class="s-val ${(result.netProfit || 0) >= 0 ? 'price-up' : 'price-down'}">
                ${result.netProfit ? (result.netProfit >= 0 ? '+' : '') + result.netProfit.toFixed(2) : '0.00'}
            </div>
            <div class="s-lbl">Net Profit</div>
        </div>

        <div class="stat-card">
            <div class="s-val">${result.profitFactor ? result.profitFactor.toFixed(2) : '0.00'}</div>
            <div class="s-lbl">Profit Factor</div>
        </div>

        <div class="stat-card">
            <div class="s-val">${result.maxDrawdown ? result.maxDrawdown.toFixed(1) + '%' : '0%'}</div>
            <div class="s-lbl">Max DD</div>
        </div>
    </div>

    ${result.recommendations ? `
        <div class="card" style="margin-top:16px">
            <div class="card-title"><span>💡</span> Recommendations</div>
            <div style="font-size:12px;color:var(--text-secondary);line-height:1.6">
                ${result.recommendations.map(rec => `• ${rec}`).join('<br>')}
            </div>
        </div>
    ` : ''}
`;
}

window.runBacktest = runBacktest;
