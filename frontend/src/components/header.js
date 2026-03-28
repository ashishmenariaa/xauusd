// components/header.js
export function initHeader() {
    const headerContainer = document.getElementById('header-container');
    if (!headerContainer) return;
    
    headerContainer.innerHTML = `
        <div class="header">
            <div class="header-left">
                <h1>XAU/<span>USD</span> AI</h1>
                <div class="header-sub">Auto Scanner · AI Journal · MT5 Bridge</div>
            </div>
            <div class="header-right">
                <div id="badge-live" class="badge badge-live">
                    <div class="dot"></div> LIVE
                </div>
                <div id="badge-mt5" class="badge badge-warn">
                    <div class="dot"></div> MT5 Checking…
                </div>
            </div>
        </div>
    `;
}
