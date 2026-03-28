// panels/settings-panel.js - Settings Panel Component
export function initSettingsPanel() {
    const container = document.getElementById('panel-settings');
    if (!container) return;

    container.innerHTML = `
        <div class="settings-grid">
            <div class="card">
                <div class="card-title"><span>🤖</span> Scanner</div>
                <div class="form-group"><label>Scan Interval (sec)</label><input type="number" id="s-scanInterval" min="30" max="3600" value="60"/></div>
                <div class="form-group"><label>Min Confidence (%)</label><input type="number" id="s-minConfidence" min="50" max="100" value="80"/></div>
                <div class="form-group"><label>Max Trades / Day</label><input type="number" id="s-maxTradesDay" min="1" max="20" value="5"/></div>
                <div class="form-group"><label>Max Losses / Day</label><input type="number" id="s-maxLossesDay" min="1" max="10" value="3"/></div>
                <div class="form-group"><label>Cooldown (min)</label><input type="number" id="s-cooldownMins" min="5" max="120" value="15"/></div>
            </div>
            <div class="card">
                <div class="card-title"><span>💰</span> Risk Management</div>
                <div class="form-group"><label>Account Balance ($)</label><input type="number" id="s-accountBalance" min="100" value="1000"/></div>
                <div class="form-group"><label>Risk per Trade (%)</label><input type="number" id="s-riskPct" min="0.1" max="10" step="0.1" value="1"/></div>
                <div class="form-group"><label>Daily Loss Limit ($)</label><input type="number" id="s-dailyLossLimit" min="10" value="50"/></div>
                <div class="form-group"><label>Daily Profit Target ($)</label><input type="number" id="s-dailyProfitTarget" min="10" value="100"/></div>
                <div class="form-group"><label>ATR Multiplier</label><input type="number" id="s-atrMul" min="0.5" max="5" step="0.1" value="1.5"/></div>
            </div>
            <div class="card">
                <div class="card-title"><span>🎯</span> Take Profit R:R</div>
                <div class="form-group"><label>TP1 (R)</label><input type="number" id="s-tp1R" min="0.5" step="0.5" value="1"/></div>
                <div class="form-group"><label>TP2 (R)</label><input type="number" id="s-tp2R" min="1" step="0.5" value="2"/></div>
                <div class="form-group"><label>TP3 (R)</label><input type="number" id="s-tp3R" min="1.5" step="0.5" value="3"/></div>
            </div>
            <div class="card">
                <div class="card-title"><span>🕐</span> Trading Session (IST)</div>
                <div class="toggle-row">
                    <div><div class="toggle-lbl">Custom Window</div><div class="toggle-sub">Define your own window</div></div>
                    <label class="toggle"><input type="checkbox" id="s-customEnabled" onchange="toggleCustomSession()"><span class="slider"></span></label>
                </div>
                <div id="custom-session-fields" style="display:none">
                    <div class="form-group" style="margin-top:10px"><label>Start Time</label><input type="time" id="s-customStart" value="09:00"/></div>
                    <div class="form-group"><label>End Time</label><input type="time" id="s-customEnd" value="17:00"/></div>
                </div>
                <div class="toggle-row">
                    <div><div class="toggle-lbl">Morning Session</div><div class="toggle-sub">11:00 – 14:00 IST</div></div>
                    <label class="toggle"><input type="checkbox" id="s-morningEnabled" checked><span class="slider"></span></label>
                </div>
                <div class="toggle-row">
                    <div><div class="toggle-lbl">Evening Session</div><div class="toggle-sub">16:00 – 22:00 IST</div></div>
                    <label class="toggle"><input type="checkbox" id="s-eveningEnabled" checked><span class="slider"></span></label>
                </div>
            </div>
            <div class="card">
                <div class="card-title"><span>🔧</span> Features</div>
                <div class="toggle-row"><div><div class="toggle-lbl">Auto Trade</div><div class="toggle-sub">Execute trades automatically</div></div><label class="toggle"><input type="checkbox" id="s-autoTrade"><span class="slider"></span></label></div>
                <div class="toggle-row"><div><div class="toggle-lbl">News Block</div><div class="toggle-sub">Pause before high-impact news</div></div><label class="toggle"><input type="checkbox" id="s-newsBlock" checked><span class="slider"></span></label></div>
                <div class="toggle-row"><div><div class="toggle-lbl">HTF Lock</div><div class="toggle-sub">Require 1H / 4H alignment</div></div><label class="toggle"><input type="checkbox" id="s-htfLock" checked><span class="slider"></span></label></div>
                <div class="toggle-row"><div><div class="toggle-lbl">BE at TP1</div><div class="toggle-sub">Move SL to breakeven on TP1</div></div><label class="toggle"><input type="checkbox" id="s-beAtTp1" checked><span class="slider"></span></label></div>
                <div class="toggle-row"><div><div class="toggle-lbl">Trailing SL</div><div class="toggle-sub">Trail stop loss automatically</div></div><label class="toggle"><input type="checkbox" id="s-trailingSL" checked><span class="slider"></span></label></div>
                <div class="toggle-row"><div><div class="toggle-lbl">Close at Session End</div><div class="toggle-sub">Auto-exit on session close</div></div><label class="toggle"><input type="checkbox" id="s-closeAtSessionEnd"><span class="slider"></span></label></div>
                <div class="toggle-row"><div><div class="toggle-lbl">Max Hold Time (3h)</div><div class="toggle-sub">Safety close after 3 hours</div></div><label class="toggle"><input type="checkbox" id="s-maxHoldTime" checked><span class="slider"></span></label></div>
            </div>
        </div>
        <div style="margin-top:16px;display:flex;gap:10px">
            <button class="btn btn-gold" onclick="saveSettings()">💾 Save Settings</button>
            <button class="btn btn-ghost" onclick="loadSettings()">↺ Reset</button>
        </div>
    `;

    // Load saved settings
    window.addEventListener('panelSettingsShow', loadSettings);
}

function toggleCustomSession() {
    const customEnabled = document.getElementById('s-customEnabled').checked;
    const fields = document.getElementById('custom-session-fields');
    if (fields) fields.style.display = customEnabled ? 'block' : 'none';
}

async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        if (!response.ok) return;
        
        const settings = await response.json();
        
        // Fill form fields
        Object.keys(settings).forEach(key => {
            const element = document.getElementById('s-' + key);
            if (!element) return;
            
            if (element.type === 'checkbox') {
                element.checked = !!settings[key];
            } else {
                element.value = settings[key];
            }
        });
        
        // Update custom session visibility
        toggleCustomSession();
        
    } catch (error) {
        console.log('No saved settings found, using defaults');
    }
}

async function saveSettings() {
    const settings = {};
    
    // Collect all settings from form
    const numberFields = ['scanInterval', 'minConfidence', 'maxTradesDay', 'maxLossesDay', 'cooldownMins', 
                         'accountBalance', 'riskPct', 'dailyLossLimit', 'dailyProfitTarget', 'atrMul',
                         'tp1R', 'tp2R', 'tp3R'];
    
    const checkboxFields = ['customEnabled', 'morningEnabled', 'eveningEnabled', 'autoTrade', 'newsBlock',
                           'htfLock', 'beAtTp1', 'trailingSL', 'closeAtSessionEnd', 'maxHoldTime'];
    
    // Process number fields
    numberFields.forEach(field => {
        const element = document.getElementById('s-' + field);
        if (element) {
            settings[field] = parseFloat(element.value) || element.value;
        }
    });
    
    // Process checkbox fields
    checkboxFields.forEach(field => {
        const element = document.getElementById('s-' + field);
        if (element) {
            settings[field] = element.checked;
        }
    });
    
    // Add custom times
    const customStart = document.getElementById('s-customStart');
    const customEnd = document.getElementById('s-customEnd');
    if (customStart) settings.customStart = customStart.value;
    if (customEnd) settings.customEnd = customEnd.value;
    
    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify(settings)
        });
        
        if (response.ok) {
            showToast('Settings saved successfully!', 'success');
        } else {
            showToast('Failed to save settings', 'error');
        }
    } catch (error) {
        showToast('Error saving settings: ' + error.message, 'error');
    }
}

function showToast(message, type) {
    const event = new CustomEvent('showToast', { detail: { message, type } });
    document.dispatchEvent(event);
}

window.toggleCustomSession = toggleCustomSession;
window.loadSettings = loadSettings;
window.saveSettings = saveSettings;
