// panels/signal-panel.js - LIVE AI VERSION (SAFE + MODULAR)

export function initSignalPanel() {
    const container = document.getElementById('panel-signal');

    // ✅ Safety checks
    if (!container) {
        console.log('Signal panel container not found');
        return;
    }

    const isActive = container.classList.contains('active');
    const isVisible = container.style.display !== 'none';

    if (!isActive && !isVisible) {
        console.log('Signal panel not active - skipping initialization');
        return;
    }

    if (container.dataset.initialized === 'true') {
        console.log('Signal panel already initialized');
        return;
    }

    console.log('Initializing signal panel...');
    container.dataset.initialized = 'true';

    // ✅ UI Structure (NO LOGIC CHANGE)
    container.innerHTML = `
        <div class="sp-hero card">
            <div class="signal-status">
                <div>
                    <div class="scanner-label">AI AUTO SCANNER</div>
                    <div id="scanner-badge" class="scanner-badge stopped">
                        <div class="dot" style="background:var(--red)"></div> Scanner STOPPED
                    </div>
                </div>
                <div style="display:flex;gap:8px;align-items:center">
                    <button id="btn-start" class="btn btn-green" onclick="window.startScanner()">▶ START</button>
                    <button id="btn-stop"  class="btn btn-red" onclick="window.stopScanner()" style="display:none">■ STOP</button>
                </div>
            </div>

            <div id="signal-main" class="signal-main">
                <div class="sp-idle">
                    <span class="sp-idle-icon">⚪</span>
                    <span class="sp-idle-text">Start the scanner to begin analysis</span>
                </div>
            </div>
        </div>

        <div class="sp-row2">
            <div class="card sp-setup-card">
                <div class="card-title"><span>●</span> Current Setup</div>
                <div id="setup-content">No setup yet</div>
            </div>

            <div class="card sp-ai-card">
                <div class="card-title"><span class="sp-ai-dot">●</span> AI Thinking Feed</div>
                <div id="ai-feed">Waiting for AI...</div>
            </div>
        </div>
    `;

    initSignalFunctionality();
}


// =========================
// 🔥 MAIN FUNCTIONALITY
// =========================
function initSignalFunctionality() {
    console.log('Initializing signal panel functionality...');

    // ✅ Prevent duplicate intervals
    if (window.signalInterval) {
        clearInterval(window.signalInterval);
    }

    // Initial load
    loadSignalData();

    // Live updates
    window.signalInterval = setInterval(() => {
        const container = document.getElementById('panel-signal');

        if (container && container.classList.contains('active')) {
            loadSignalData();
        }
    }, 3000);
}


// =========================
// 🔥 FETCH AI DATA
// =========================
async function loadSignalData() {
    try {
        const res = await fetch('/api/signal');
        const json = await res.json();

        if (!json.success || !json.data) {
            updateIdleState("WAITING for high probability setup...");
            return;
        }

        const ai = json.data;
        const signal = ai.signal;

        renderSignal(signal);
        updateAIFeed(signal);

    } catch (err) {
        console.error('Signal fetch error:', err);
        updateIdleState("Error fetching AI data");
    }
}


// =========================
// 🔥 RENDER SIGNAL
// =========================
function renderSignal(signal) {
    const container = document.getElementById('signal-main');

    if (!signal || signal.direction === 'wait') {
        updateIdleState("WAITING for high probability setup...");
        return;
    }

    const direction = signal.direction.toUpperCase();

    let color = '#888';
    if (signal.direction === 'buy') color = '#00c853';
    if (signal.direction === 'sell') color = '#ff3d00';

    container.innerHTML = `
        <div class="sp-signal-card">
            <div style="font-size:22px;font-weight:bold;color:${color}">
                ${direction}
            </div>

            <div style="margin-top:8px">Confidence: ${signal.confidence}%</div>
            <div>Entry: ${signal.entry ?? '-'}</div>
            <div>SL: ${signal.stopLoss ?? '-'}</div>
            <div>TP: ${signal.takeProfit ?? '-'}</div>

            <div style="margin-top:12px">
                <b>AI Reason:</b>
                <ul style="margin:5px 0;padding-left:18px">
                    ${(signal.rationale || []).map(r => `<li>${r}</li>`).join('')}
                </ul>
            </div>
        </div>
    `;
}


// =========================
// 🔥 AI THINKING FEED
// =========================
function updateAIFeed(signal) {
    const feed = document.getElementById('ai-feed');

    if (!signal) {
        feed.innerText = "No AI data";
        return;
    }

    feed.innerHTML = `
        <div>Direction: ${signal.direction}</div>
        <div>Confidence: ${signal.confidence}%</div>
    `;
}


// =========================
// 🔥 IDLE STATE
// =========================
function updateIdleState(text) {
    const container = document.getElementById('signal-main');

    container.innerHTML = `
        <div class="sp-idle">
            <span class="sp-idle-icon">⚪</span>
            <span class="sp-idle-text">${text}</span>
        </div>
    `;
}


// =========================
// GLOBAL FLAG
// =========================
window.signalPanelInitialized = true;