// panels/journal-panel.js - Journal Panel Component
export function initJournalPanel() {
    const container = document.getElementById('panel-journal');
    if (!container) return;

    container.innerHTML = `
        <div class="journal-stats">
            <div class="stat-card"><div class="s-val" id="j-total">0</div><div class="s-lbl">Total</div></div>
            <div class="stat-card"><div class="s-val price-up" id="j-wins">0</div><div class="s-lbl">Wins</div></div>
            <div class="stat-card"><div class="s-val price-down" id="j-losses">0</div><div class="s-lbl">Losses</div></div>
            <div class="stat-card"><div class="s-val" id="j-wr">0%</div><div class="s-lbl">Win Rate</div></div>
            <div class="stat-card"><div class="s-val" id="j-pnl">0.00</div><div class="s-lbl">Net P&L</div></div>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
            <button class="btn btn-ghost" onclick="loadJournalData(\'ALL\')" style="font-size:11px;padding:6px 12px">All</button>
            <button class="btn btn-ghost" onclick="loadJournalData(\'OPEN\')" style="font-size:11px;padding:6px 12px">Open</button>
            <button class="btn btn-ghost" onclick="loadJournalData(\'WIN\')" style="font-size:11px;padding:6px 12px">Wins</button>
            <button class="btn btn-ghost" onclick="loadJournalData(\'LOSS\')" style="font-size:11px;padding:6px 12px">Losses</button>
            <div style="flex:1"></div>
            <button class="btn btn-ghost" onclick="refreshJournal()" style="font-size:11px;padding:6px 14px">↺ Refresh</button>
        </div>
        <div class="tbl-wrap">
            <table>
                <thead>
                    <tr><th>Time</th><th>Signal</th><th>Entry</th><th>Exit</th><th>SL</th><th>TP1</th><th>TP2</th><th>Conf</th><th>Outcome</th><th>P&L</th><th>Actions</th></tr>
                </thead>
                <tbody id="journal-body">
                    <tr><td colspan="11" class="empty-state">No trades yet</td></tr>
                </tbody>
            </table>
        </div>
    `;

    // Load initial data
    window.addEventListener('panelJournalShow', loadJournalData);
}

let currentJournalFilter = 'ALL';

async function loadJournalData(filter = 'ALL') {
    currentJournalFilter = filter;
    
    try {
        const response = await fetch('/api/journal');
        if (!response.ok) throw new Error('Failed to fetch journal');
        
        let trades = await response.json();
        
        // Apply filter
        if (filter === 'OPEN') trades = trades.filter(t => t.status === 'OPEN');
        else if (filter === 'WIN') trades = trades.filter(t => t.outcome === 'WIN');
        else if (filter === 'LOSS') trades = trades.filter(t => t.outcome === 'LOSS');
        
        // Update stats
        updateJournalStats(trades);
        
        // Update table
        renderJournalTable(trades);
        
    } catch (error) {
        console.error('Journal load error:', error);
        document.getElementById('journal-body').innerHTML = `
            <tr><td colspan="11" class="empty-state" style="color:var(--red)">Error loading journal</td></tr>
        `;
    }
}

function updateJournalStats(trades) {
    const closed = trades.filter(t => t.status === 'CLOSED');
    const wins = closed.filter(t => t.outcome === 'WIN');
    const losses = closed.filter(t => t.outcome === 'LOSS');
    const totalPnl = closed.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winRate = closed.length ? (wins.length / closed.length * 100) : 0;
    
    document.getElementById('j-total').textContent = trades.length;
    document.getElementById('j-wins').textContent = wins.length;
    document.getElementById('j-losses').textContent = losses.length;
    document.getElementById('j-wr').textContent = winRate.toFixed(1) + '%';
    
    const pnlEl = document.getElementById('j-pnl');
    pnlEl.textContent = (totalPnl >= 0 ? '+' : '') + totalPnl.toFixed(2);
    pnlEl.className = totalPnl >= 0 ? 's-val price-up' : 's-val price-down';
}

function renderJournalTable(trades) {
    const tbody = document.getElementById('journal-body');
    if (!tbody) return;
    
    if (!trades.length) {
        tbody.innerHTML = '<tr><td colspan="11" class="empty-state">No trades found</td></tr>';
        return;
    }
    
    tbody.innerHTML = trades.map(trade => `
        <tr>
            <td style="font-family:\'JetBrains Mono\',monospace;font-size:11px;color:var(--text-tertiary)">
                ${new Date(trade.timestamp).toLocaleTimeString('en-IN', {hour12:false}).slice(0,5)}
            </td>
            <td><span class="chip ${trade.signal === 'BUY' ? 'chip-buy' : 'chip-sell'}">${trade.signal || '—'}</span></td>
            <td style="font-family:\'JetBrains Mono\',monospace">${trade.entry || '—'}</td>
            <td style="font-family:\'JetBrains Mono\',monospace">${trade.exitPrice || '—'}</td>
            <td style="font-family:\'JetBrains Mono\',monospace;color:var(--red)">${trade.sl || '—'}</td>
            <td style="font-family:\'JetBrains Mono\',monospace;color:var(--green)">${trade.tp1 || '—'}</td>
            <td style="font-family:\'JetBrains Mono\',monospace;color:var(--green)">${trade.tp2 || '—'}</td>
            <td>${trade.confidence ? trade.confidence + '%' : '—'}</td>
            <td>
                <span class="chip ${
                    trade.outcome === 'WIN' ? 'chip-win' : 
                    trade.outcome === 'LOSS' ? 'chip-loss' : 
                    trade.outcome === 'BREAKEVEN' ? 'chip-be' : 'chip-open'
                }">
                    ${trade.outcome || trade.status || '—'}
                </span>
            </td>
            <td style="font-family:\'JetBrains Mono\',monospace;font-weight:600" class="${trade.pnl >= 0 ? 'price-up' : 'price-down'}">
                ${trade.pnl ? (trade.pnl >= 0 ? '+' : '') + trade.pnl.toFixed(2) : '—'}
            </td>
            <td style="display:flex;gap:4px">
                ${trade.status === 'OPEN' ? 
                    `<button class="btn btn-ghost" style="font-size:10px;padding:3px 8px" onclick="closeTrade('${trade.id}')">Close</button>` : ''}
                <button class="btn btn-ghost" style="font-size:10px;padding:3px 8px;color:var(--red)" onclick="deleteTrade('${trade.id}')">🗑</button>
            </td>
        </tr>
    `).join('');
}

async function closeTrade(tradeId) {
    if (!confirm('Close this trade?')) return;
    
    try {
        const response = await fetch('/api/journal/close', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ id: tradeId })
        });
        
        if (response.ok) {
            showToast('Trade closed successfully', 'success');
            loadJournalData(currentJournalFilter);
        }
    } catch (error) {
        showToast('Failed to close trade', 'error');
    }
}

async function deleteTrade(tradeId) {
    if (!confirm('Delete this trade permanently?')) return;
    
    try {
        const response = await fetch(`/api/journal/${tradeId}`, { method: 'DELETE' });
        
        if (response.ok) {
            showToast('Trade deleted', 'warning');
            loadJournalData(currentJournalFilter);
        }
    } catch (error) {
        showToast('Failed to delete trade', 'error');
    }
}

function refreshJournal() {
    loadJournalData(currentJournalFilter);
}

function showToast(message, type) {
    const event = new CustomEvent('showToast', { detail: { message, type } });
    document.dispatchEvent(event);
}

// Export functions for global access
window.loadJournalData = loadJournalData;
window.closeTrade = closeTrade;
window.deleteTrade = deleteTrade;
window.refreshJournal = refreshJournal;
