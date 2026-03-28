// components/price-bar.js
export function initPriceBar() {
    const container = document.getElementById('price-bar-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="price-bar">
            <div class="price-item">
                <div class="price-label">Price</div>
                <div class="price-value price-main" id="pb-price">—</div>
            </div>
            <div class="price-item">
                <div class="price-label">Change</div>
                <div class="price-value price-neu" id="pb-change">—</div>
            </div>
            <div class="price-item">
                <div class="price-label">Open</div>
                <div class="price-value price-neu" id="pb-open">—</div>
            </div>
            <div class="price-item">
                <div class="price-label">High</div>
                <div class="price-value price-up" id="pb-high">—</div>
            </div>
            <div class="price-item">
                <div class="price-label">Low</div>
                <div class="price-value price-down" id="pb-low">—</div>
            </div>
            <div class="price-item">
                <div class="price-label">ATR(14)</div>
                <div class="price-value price-neu" id="pb-atr">—</div>
            </div>
            <div class="price-item">
                <div class="price-label">RSI(14)</div>
                <div class="price-value price-neu" id="pb-rsi">—</div>
            </div>
            <div class="price-item">
                <div class="price-label">Structure</div>
                <div class="price-value price-neu" id="pb-struct">—</div>
            </div>
            <div class="price-item">
                <div class="price-label">Session (IST)</div>
                <div class="price-value price-neu" id="pb-session">—</div>
            </div>
            <div class="price-item">
                <div class="price-label">IST Time</div>
                <div class="price-value price-neu" id="pb-time">—</div>
            </div>
        </div>
    `;
}
