// panels/panels-manager.js - Panel Manager
import { initSignalPanel } from './signal-panel.js';
import { initChartPanel } from './chart-panel.js';
import { initJournalPanel } from './journal-panel.js';
import { initBacktestPanel } from './backtest-panel.js';
import { initInsightsPanel } from './insights-panel.js';
import { initWeeklyPanel } from './weekly-panel.js';
import { initMT5Panel } from './mt5-panel.js';
import { initSettingsPanel } from './settings-panel.js';

export function initPanels() {
    const container = document.getElementById('panels-container');
    if (!container) return;

    // Create all panel containers
    container.innerHTML = `
        <div id="panel-signal" class="panel active"></div>
        <div id="panel-chart" class="panel"></div>
        <div id="panel-journal" class="panel"></div>
        <div id="panel-backtest" class="panel"></div>
        <div id="panel-insights" class="panel"></div>
        <div id="panel-weekly" class="panel"></div>
        <div id="panel-mt5" class="panel"></div>
        <div id="panel-settings" class="panel"></div>
    `;

    // Initialize all panels
    initSignalPanel();
    initChartPanel();
    initJournalPanel();
    initBacktestPanel();
    initInsightsPanel();
    initWeeklyPanel();
    initMT5Panel();
    initSettingsPanel();

    // Set up panel switching
    setupPanelSwitching();
}

function setupPanelSwitching() {
    // Tab click handlers are already set up in tabs.js
    // Listen for panel change events
    window.addEventListener('panelChange', (event) => {
        const { panel } = event.detail;
        
        // Hide all panels
        document.querySelectorAll('.panel').forEach(p => {
            p.classList.remove('active');
        });
        
        // Show selected panel
        const panelEl = document.getElementById('panel-' + panel);
        if (panelEl) {
            panelEl.classList.add('active');
            
            // Trigger panel-specific event
            const panelEvent = new CustomEvent('panel' + panel.charAt(0).toUpperCase() + panel.slice(1) + 'Show');
            window.dispatchEvent(panelEvent);
            
            // Special handling for chart panel
            if (panel === 'chart') {
                // Wait for DOM update then load chart
                setTimeout(() => {
                    const activeTfBtn = document.querySelector('.tf-btn.active');
                    if (activeTfBtn) {
                        const timeframe = activeTfBtn.dataset.tf || '5min';
                        if (window.loadChart) window.loadChart(timeframe);
                    }
                }, 100);
            }
        }
    });
}

// Export panel change function
export function switchPanel(panelName) {
    const event = new CustomEvent('panelChange', { detail: { panel: panelName } });
    window.dispatchEvent(event);
}

window.switchPanel = switchPanel;
