// panels/weekly-panel.js - Weekly Review Panel Component
export function initWeeklyPanel() {
    const container = document.getElementById('panel-weekly');
    if (!container) return;

    container.innerHTML = `
        <div style="display:flex;gap:10px;margin-bottom:16px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-gold" onclick="runWeeklyReview()">📊 Run Review Now</button>
            <span style="font-size:12px;color:var(--text-tertiary)">Auto-runs every Sunday 3PM IST</span>
            <div style="flex:1"></div>
            <button class="btn btn-ghost" onclick="loadWeeklyReviews()" style="font-size:11px">↺ Refresh</button>
        </div>
        <div id="weekly-container"><div class="empty-state">No weekly reviews yet.</div></div>
    `;

    // Load existing reviews
    window.addEventListener('panelWeeklyShow', loadWeeklyReviews);
}

async function loadWeeklyReviews() {
    const container = document.getElementById('weekly-container');
    container.innerHTML = '<div style="display:flex;align-items:center;gap:10px;padding:20px"><span class="loader"></span> Loading reviews...</div>';

    try {
        const response = await fetch('/api/weekly-review');
        if (!response.ok) throw new Error('Failed to load reviews');
        
        const reviews = await response.json();
        renderWeeklyReviews(reviews);
        
    } catch (error) {
        container.innerHTML = `
            <div class="empty-state" style="color:var(--red)">
                Error loading reviews<br>
                <span style="font-size:11px">\${error.message}</span>
            </div>
        `;
    }
}

async function runWeeklyReview() {
    try {
        const response = await fetch('/api/weekly-review/run', { method: 'POST' });
        
        if (response.ok) {
            showToast('Weekly review completed!', 'success');
            loadWeeklyReviews();
        }
    } catch (error) {
        showToast('Failed to run weekly review', 'error');
    }
}

function renderWeeklyReviews(reviews) {
    const container = document.getElementById('weekly-container');
    
    if (!reviews || !reviews.length) {
        container.innerHTML = '<div class="empty-state">No weekly reviews yet.</div>';
        return;
    }
    
    container.innerHTML = reviews.map(review => `
        <div class="review-card">
            <div class="review-date">📅 \${new Date(review.date).toLocaleDateString('en-IN', { 
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
            })}</div>
            <div class="review-stats">
                <span class="rs">Total: <span>\${review.stats?.total || 0}</span></span>
                <span class="rs">WR: <span class="\${(review.stats?.winRate || 0) >= 50 ? 'price-up' : 'price-down'}">\${review.stats?.winRate || 0}%</span></span>
                <span class="rs">P&L: <span class="\${(review.stats?.netPnl || 0) >= 0 ? 'price-up' : 'price-down'}">\${review.stats?.netPnl || 0} pts</span></span>
            </div>
            <div class="insight-box" style="max-height:200px">\${review.insights || 'No insights available'}</div>
        </div>
    `).join('');
}

function showToast(message, type) {
    const event = new CustomEvent('showToast', { detail: { message, type } });
    document.dispatchEvent(event);
}

window.loadWeeklyReviews = loadWeeklyReviews;
window.runWeeklyReview = runWeeklyReview;
