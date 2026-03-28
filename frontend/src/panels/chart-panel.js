// panels/chart-panel.js - Fixed Version
export function initChartPanel() {
    const container = document.getElementById('panel-chart');
    if (!container) return;

    container.innerHTML = `
        <div class="chart-controls">
            <span style="font-size:11px;color:var(--text-tertiary);letter-spacing:1px;text-transform:uppercase;margin-right:4px">Timeframe:</span>
            <button class="tf-btn active" data-tf="5min">5M</button>
            <button class="tf-btn" data-tf="15min">15M</button>
            <button class="tf-btn" data-tf="1h">1H</button>
            <button class="tf-btn" data-tf="4h">4H</button>
            <button class="tf-btn" data-tf="1day">1D</button>
            <div style="flex:1"></div>
            <button class="btn btn-ghost" id="chart-refresh-btn" style="font-size:11px;padding:6px 14px">↺ Refresh</button>
        </div>
        <div id="chart-container">
            <div style="display:flex;align-items:center;justify-content:center;height:100%;gap:10px;color:var(--text-tertiary)">
                <span class="loader"></span> Click a timeframe to load chart
            </div>
        </div>
        <div class="grid-3" style="margin-top:16px">
            <div class="card"><div class="card-title"><span>📈</span> EMA</div><div id="chart-ema" style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-secondary);white-space:pre-line">—</div></div>
            <div class="card"><div class="card-title"><span>🔢</span> Indicators</div><div id="chart-indicators" style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-secondary);white-space:pre-line">—</div></div>
            <div class="card"><div class="card-title"><span>📊</span> Candle Stats</div><div id="chart-stats" style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-secondary);white-space:pre-line">—</div></div>
        </div>
    `;

    // Initialize chart functionality
    initChartControls();
}

function initChartControls() {
    // Add event listeners to timeframe buttons
    document.querySelectorAll('.tf-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const timeframe = this.dataset.tf;
            loadChart(timeframe);
        });
    });

    // Add event listener to refresh button
    const refreshBtn = document.getElementById('chart-refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            const activeBtn = document.querySelector('.tf-btn.active');
            if (activeBtn) {
                loadChart(activeBtn.dataset.tf);
            }
        });
    }

    // Load initial chart
    loadChart('5min');
}

let chartInstance = null;

async function loadChart(timeframe = '5min') {
    const container = document.getElementById('chart-container');
    if (!container) return;

    // Show loading state
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;gap:10px;color:var(--text-tertiary)"><span class="loader"></span> Loading chart...</div>';

    try {
        // Fetch chart data from API
        const response = await fetch(`/api/chart?interval=${timeframe}&outputsize=200`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();

        if (!data.candles || !data.candles.length) {
            throw new Error('No chart data available');
        }

        // Clear container
        container.innerHTML = '';

        // Get container dimensions
        const width = container.clientWidth;
        const height = 500;

        // Create the chart
        chartInstance = LightweightCharts.createChart(container, {
            width: width,
            height: height,
            layout: {
                background: { color: '#12141a' },
                textColor: '#a3aec9'
            },
            grid: {
                vertLines: { color: '#2d3240' },
                horzLines: { color: '#2d3240' }
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal
            },
            rightPriceScale: {
                borderColor: '#3a4052'
            },
            timeScale: {
                borderColor: '#3a4052',
                timeVisible: true,
                secondsVisible: false
            }
        });

        // Add candlestick series
        const candleSeries = chartInstance.addCandlestickSeries({
            upColor: '#06d6a0',
            downColor: '#ef476f',
            borderUpColor: '#06d6a0',
            borderDownColor: '#ef476f',
            wickUpColor: '#06d6a0',
            wickDownColor: '#ef476f'
        });
        
        candleSeries.setData(data.candles);

        // Add EMA series if available
        if (data.ema20 && data.ema20.length > 0) {
            const ema20Series = chartInstance.addLineSeries({
                color: '#ffd166',
                lineWidth: 1,
                title: 'EMA 20'
            });
            ema20Series.setData(data.ema20);
        }

        if (data.ema50 && data.ema50.length > 0) {
            const ema50Series = chartInstance.addLineSeries({
                color: '#118ab2',
                lineWidth: 1,
                title: 'EMA 50'
            });
            ema50Series.setData(data.ema50);
        }

        // Fit content to view
        chartInstance.timeScale().fitContent();

        // Update information cards
        updateChartInfo(data, timeframe);

    } catch (error) {
        // Show error state
        container.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;color:var(--text-tertiary)">
                <div>⚠️ Failed to load chart</div>
                <div style="font-size:12px;color:var(--text-muted)">${error.message}</div>
                <button class="btn btn-ghost" onclick="loadChart('${timeframe}')">↺ Retry</button>
            </div>
        `;
    }
}

function updateChartInfo(data, timeframe) {
    const emaEl = document.getElementById('chart-ema');
    const indicatorsEl = document.getElementById('chart-indicators');
    const statsEl = document.getElementById('chart-stats');

    // Update EMA information
    if (emaEl) {
        const ema20 = data.ema20 && data.ema20.length > 0 ? data.ema20[data.ema20.length - 1]?.value : null;
        const ema50 = data.ema50 && data.ema50.length > 0 ? data.ema50[data.ema50.length - 1]?.value : null;
        
        emaEl.innerHTML = `
            EMA 20: ${ema20 ? ema20.toFixed(2) : '—'}<br>
            EMA 50: ${ema50 ? ema50.toFixed(2) : '—'}<br>
            ${ema20 && ema50 ? (ema20 > ema50 ? '↑ Bullish Alignment' : '↓ Bearish Alignment') : ''}
        `;
    }

    // Update indicators information
    if (indicatorsEl) {
        const candles = data.candles || [];
        const lastCandle = candles.length > 0 ? candles[0] : {};
        
        indicatorsEl.innerHTML = `
            RSI: ${data.rsi || '—'}<br>
            ATR: ${data.atr || '—'}<br>
            Volume: ${lastCandle.volume || '—'}
        `;
    }

    // Update candle statistics
    if (statsEl) {
        const candles = data.candles || [];
        const bullishCount = candles.filter(c => c.close > c.open).length;
        const bearishCount = candles.length - bullishCount;
        const total = candles.length;
        
        statsEl.innerHTML = `
            Total: ${total} candles<br>
            Bullish: ${bullishCount} (${total > 0 ? ((bullishCount/total)*100).toFixed(1) : 0}%)<br>
            Bearish: ${bearishCount} (${total > 0 ? ((bearishCount/total)*100).toFixed(1) : 0}%)
        `;
    }
}

// Make function available globally
window.loadChart = loadChart;
