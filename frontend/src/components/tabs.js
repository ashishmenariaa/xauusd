// components/tabs.js
export function initTabs() {
    const container = document.getElementById('tabs-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="tabs">
            <div class="tab active" data-panel="signal">⚡ Signal</div>
            <div class="tab" data-panel="chart">📊 Chart</div>
            <div class="tab" data-panel="journal">📋 Journal</div>
            <div class="tab" data-panel="backtest">🔬 Backtest</div>
            <div class="tab" data-panel="insights">💡 Insights</div>
            <div class="tab" data-panel="weekly">📅 Weekly</div>
            <div class="tab" data-panel="mt5">🔌 MT5</div>
            <div class="tab" data-panel="settings">⚙️ Settings</div>
        </div>
    `;
    
    // Add event listeners
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const panel = tab.dataset.panel;
            
            // Update active tab
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Dispatch panel change event
            window.dispatchEvent(new CustomEvent('panelChange', { 
                detail: { panel } 
            }));
        });
    });
}
