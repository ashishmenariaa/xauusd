// panels/mt5-panel.js - MT5 Panel Component
export function initMT5Panel() {
    const container = document.getElementById('panel-mt5');
    if (!container) return;

    container.innerHTML = `
        <div class="mt5-status-row">
            <div id="mt5-status-dot" class="dot" style="background:var(--gold);width:10px;height:10px"></div>
            <span id="mt5-status-text" style="font-weight:600">Checking MT5 bridge…</span>
            <div style="flex:1"></div>
            <button class="btn btn-ghost" onclick="loadMT5Data()" style="font-size:11px;padding:6px 12px">↺ Refresh</button>
        </div>
        <div class="grid-2">
            <div class="card">
                <div class="card-title"><span>📂</span> Open Positions</div>
                <div id="mt5-positions"><div class="empty-state">Click Refresh to load</div></div>
            </div>
            <div class="card">
                <div class="card-title"><span>📜</span> Recent History</div>
                <div id="mt5-history"><div class="empty-state">Click Refresh to load</div></div>
            </div>
        </div>
    `;

    // Load MT5 data when panel is shown
    window.addEventListener('panelMT5Show', loadMT5Data);
}

async function loadMT5Data() {
    updateMT5Status('Checking...', 'gold');
    
    try {
        const [statusRes, positionsRes, historyRes] = await Promise.all([
            fetch('/api/mt5/status'),
            fetch('/api/mt5/positions'),
            fetch('/api/mt5/history')
        ]);

        const status = await statusRes.json();
        const positions = positionsRes.ok ? await positionsRes.json() : [];
        const history = historyRes.ok ? await historyRes.json() : [];

        // Update status
        if (status.connected) {
            updateMT5Status(`Connected • Acc: \${status.account} • Balance: $\${status.balance}`, 'green');
            updateBadge('mt5', true);
        } else {
            updateMT5Status('Disconnected • ' + (status.error || 'Bridge not responding'), 'red');
            updateBadge('mt5', false);
        }

        // Render positions
        renderPositions(positions);
        
        // Render history
        renderHistory(history);

    } catch (error) {
        updateMT5Status('Connection failed • ' + error.message, 'red');
        updateBadge('mt5', false);
    }
}

function updateMT5Status(text, color) {
    const dot = document.getElementById('mt5-status-dot');
    const textEl = document.getElementById('mt5-status-text');
    
    if (dot) dot.style.background = `var(--\${color})`;
    if (textEl) textEl.textContent = text;
}

function updateBadge(type, connected) {
    const badge = document.getElementById('badge-mt5');
    if (!badge) return;
    
    if (connected) {
        badge.className = 'badge badge-mt5';
        badge.innerHTML = '<div class="dot"></div> MT5 Live';
    } else {
        badge.className = 'badge badge-err';
        badge.innerHTML = '<div class="dot"></div> MT5 Offline';
    }
}

function renderPositions(positions) {
    const container = document.getElementById('mt5-positions');
    
    if (!positions || !positions.length) {
        container.innerHTML = '<div class="empty-state">No open positions</div>';
        return;
    }
    
    container.innerHTML = `
        <table style="font-size:11px">
            <thead>
                <tr><th>Ticket</th><th>Type</th><th>Symbol</th><th>Volume</th><th>Open</th><th>Current</th><th>P&L</th><th>Action</th></tr>
            </thead>
            <tbody>
                \${positions.map(pos => \`
                    <tr>
                        <td style="font-family:\'JetBrains Mono\',monospace">\${pos.ticket || '—'}</td>
                        <td><span class="chip \${pos.type?.includes('BUY') ? 'chip-buy' : 'chip-sell'}">\${pos.type || '—'}</span></td>
                        <td>\${pos.symbol || '—'}</td>
                        <td>\${pos.volume || '—'}</td>
                        <td style="font-family:\'JetBrains Mono\',monospace">\${pos.price_open || '—'}</td>
                        <td style="font-family:\'JetBrains Mono\',monospace">\${pos.price_current || '—'}</td>
                        <td style="font-family:\'JetBrains Mono\',monospace;font-weight:600" class="\${(pos.profit || 0) >= 0 ? 'price-up' : 'price-down'}">
                            \${pos.profit ? (pos.profit >= 0 ? '+' : '') + pos.profit.toFixed(2) : '0.00'}
                        </td>
                        <td><button class="btn btn-ghost" style="font-size:10px;padding:3px 8px" onclick="closeMT5Position(\${pos.ticket})">Close</button></td>
                    </tr>
                \`).join('')}
            </tbody>
        </table>
    `;
}

function renderHistory(history) {
    const container = document.getElementById('mt5-history');
    
    if (!history || !history.length) {
        container.innerHTML = '<div class="empty-state">No recent history</div>';
        return;
    }
    
    // Show only last 20 trades
    const recentHistory = history.slice(0, 20);
    
    container.innerHTML = `
        <table style="font-size:11px">
            <thead>
                <tr><th>Time</th><th>Type</th><th>Symbol</th><th>Volume</th><th>Open</th><th>Close</th><th>P&L</th></tr>
            </thead>
            <tbody>
                \${recentHistory.map(trade => \`
                    <tr>
                        <td style="font-family:\'JetBrains Mono\',monospace;font-size:10px">
                            \${new Date(trade.time).toLocaleTimeString('en-IN', {hour12:false}).slice(0,5)}
                        </td>
                        <td><span class="chip \${trade.type?.includes('BUY') ? 'chip-buy' : 'chip-sell'}">\${trade.type || '—'}</span></td>
                        <td>\${trade.symbol || '—'}</td>
                        <td>\${trade.volume || '—'}</td>
                        <td style="font-family:\'JetBrains Mono\',monospace">\${trade.price_open || '—'}</td>
                        <td style="font-family:\'JetBrains Mono\',monospace">\${trade.price_close || '—'}</td>
                        <td style="font-family:\'JetBrains Mono\',monospace;font-weight:600" class="\${(trade.profit || 0) >= 0 ? 'price-up' : 'price-down'}">
                            \${trade.profit ? (trade.profit >= 0 ? '+' : '') + trade.profit.toFixed(2) : '0.00'}
                        </td>
                    </tr>
                \`).join('')}
            </tbody>
        </table>
    `;
}

async function closeMT5Position(ticket) {
    if (!confirm(`Close MT5 position #\${ticket}?`)) return;
    
    try {
        const response = await fetch('/api/mt5/close', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ ticket })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Position closed successfully', 'success');
            loadMT5Data();
        } else {
            showToast(`Failed: \${result.error}`, 'error');
        }
    } catch (error) {
        showToast('Failed to close position', 'error');
    }
}

function showToast(message, type) {
    const event = new CustomEvent('showToast', { detail: { message, type } });
    document.dispatchEvent(event);
}

window.loadMT5Data = loadMT5Data;
window.closeMT5Position = closeMT5Position;
