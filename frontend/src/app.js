// app.js - Main Application Entry Point
import { initHeader }    from './components/header.js';
import { initPriceBar }  from './components/price-bar.js';
import { initTabs }      from './components/tabs.js';
import { initPanels }    from './panels/panels-manager.js';
import { state }         from './utils/state.js';
import { formatPrice, formatTime, formatNumber } from './utils/formatters.js';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const INTERVALS = {
    CLOCK:   1_000,
    SIGNAL:  3_000,
    PRICE:  10_000,
    MT5:    30_000,
};

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

/** Safely set element text — no-op if element is missing. */
function setText(id, value) {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null) el.textContent = value;
}

/** Fetch JSON — returns null on any failure, never throws. */
async function safeFetch(url, options = {}) {
    try {
        const res = await fetch(url, options);
        if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
        return await res.json();
    } catch (err) {
        console.warn(`[safeFetch] ${err.message}`);
        return null;
    }
}

// ─────────────────────────────────────────────
// TradingDashboard
// ─────────────────────────────────────────────
class TradingDashboard {
    constructor() {
        this._intervalIds = [];
        this._lastPrice   = null;
        this._toastTimer  = null;
        this.init();
    }

    // ── Boot ──────────────────────────────────

    async init() {
        console.log('🚀 Initialising XAU/USD AI Dashboard 2026…');
        try {
            this.initUI();
            await this.loadInitialData();
            this.setupIntervals();
            console.log('✅ Dashboard ready');
        } catch (err) {
            console.error('❌ Dashboard init failed:', err);
            this.showToast('Failed to initialise dashboard', 'error');
        }
    }

    initUI() {
        initHeader();
        initPriceBar();
        initTabs();
        initPanels(); // calls initSignalPanel() internally
    }

    async loadInitialData() {
        await Promise.allSettled([
            this.loadPriceData(),
            this.loadScannerState(),
            this.loadMT5Status(),
            this.loadJournalData(),
            this.loadSettings(),
            this.loadSignal(),
        ]);
    }

    setupIntervals() {
        const reg = (fn, ms) => {
            const id = setInterval(fn.bind(this), ms);
            this._intervalIds.push(id);
        };
        reg(this.updateISTClock,  INTERVALS.CLOCK);
        reg(this.loadSignal,      INTERVALS.SIGNAL);
        reg(this.loadPriceData,   INTERVALS.PRICE);
        reg(this.loadMT5Status,   INTERVALS.MT5);
    }

    destroy() {
        this._intervalIds.forEach(clearInterval);
        this._intervalIds = [];
    }

    // ── Price ─────────────────────────────────

    async loadPriceData() {
        const data = await safeFetch('/api/price');
        if (data) this.updatePriceDisplay(data);
    }

    updatePriceDisplay(d) {
        if (d.current != null) {
            const el = document.getElementById('pb-price');
            if (el) {
                el.textContent = formatPrice(d.current);
                if (this._lastPrice !== null) {
                    const cls = d.current >= this._lastPrice ? 'price-up' : 'price-down';
                    el.classList.remove('price-up', 'price-down');
                    el.classList.add(cls);
                    setTimeout(() => el.classList.remove(cls), 1000);
                }
                this._lastPrice = d.current;
            }
        }

        const map = {
            'pb-change':  d.change,
            'pb-open':    d.open,
            'pb-high':    d.high,
            'pb-low':     d.low,
            'pb-atr':     d.atr,
            'pb-rsi':     d.rsi,
            'pb-struct':  d.structure,
        };
        Object.entries(map).forEach(([id, val]) => setText(id, val));

        // Colour the change field
        if (d.change != null) {
            const changeEl = document.getElementById('pb-change');
            if (changeEl) {
                const positive = String(d.change).startsWith('+') || Number(d.change) >= 0;
                changeEl.className = positive ? 'price-up' : 'price-down';
            }
        }
    }

    // ── Signal ────────────────────────────────

    async loadSignal() {
        const data = await safeFetch('/api/signal');

        // Primary: delegate to signal-panel renderer (handles signal card + confidence bar)
       if (window._signalPanel?.renderSignal) {
    window._signalPanel.renderSignal(data);
    return;
}

        // Fallback: signal-panel not mounted yet
        const signalEl = document.getElementById('signal-main');
        if (!signalEl) return;

        if (!data || !data.signal) {
            signalEl.innerHTML = '<span class="signal-waiting">⏳ WAITING for setup…</span>';
            this._updateConfBar(0);
            return;
        }

        const isBuy = data.signal.toUpperCase().includes('BUY');
        signalEl.innerHTML = `
            <div>${isBuy ? '📈' : '📉'} <strong>${data.signal}</strong> @ ${data.entry}</div>
            <div>🛡 SL: ${data.sl} &nbsp;|&nbsp; 🎯 TP: ${data.tp}</div>
            <div>Confidence: <strong>${data.confidence}%</strong></div>
        `;
        setText('wait-reason', '');
        this._updateConfBar(data.confidence);
    }

    _updateConfBar(confidence) {
        const pct    = Math.min(100, Math.max(0, confidence || 0));
        const fillEl = document.getElementById('conf-fill');
        const pctEl  = document.getElementById('conf-pct');
        if (pctEl)  pctEl.textContent = `${pct}%`;
        if (fillEl) {
            fillEl.style.width = `${pct}%`;
            fillEl.style.background =
                pct >= 75 ? 'linear-gradient(90deg,#f0b429,#21c55d)' :
                pct >= 50 ? 'linear-gradient(90deg,#ef4444,#f0b429)' :
                            'linear-gradient(90deg,#6b7280,#ef4444)';
        }
    }

    // ── Scanner ───────────────────────────────

    async loadScannerState() {
        const data = await safeFetch('/api/scanner/status');
        if (data) {
            state.set('scannerRunning', data.running);
            this.updateScannerUI(data.running);
        }
    }

    updateScannerUI(isRunning) {
        const startBtn = document.getElementById('btn-start');
        const stopBtn  = document.getElementById('btn-stop');
        const badge    = document.getElementById('scanner-badge');

        if (startBtn) startBtn.style.display = isRunning ? 'none'  : 'block';
        if (stopBtn)  stopBtn.style.display  = isRunning ? 'block' : 'none';

        if (badge) {
            badge.className = isRunning ? 'scanner-badge' : 'scanner-badge stopped';
            badge.innerHTML = isRunning
                ? '<div class="dot"></div> Scanner RUNNING'
                : '<div class="dot" style="background:var(--red)"></div> Scanner STOPPED';
        }

        // Keep signal-panel in sync too
        window._signalPanel?.updateScannerUI?.(isRunning);
    }

    // ── MT5 ───────────────────────────────────

    async loadMT5Status() {
        const data = await safeFetch('/api/mt5/status');
        if (data) {
            this.updateMT5Badge(data.connected);
            if (data.connected) this.updateMT5Info(data);
        } else {
            this.updateMT5Badge(false);
        }
    }

    updateMT5Badge(connected) {
        const badge = document.getElementById('badge-mt5');
        if (!badge) return;
        badge.className = connected ? 'badge badge-mt5' : 'badge badge-err';
        badge.innerHTML = connected
            ? '<div class="dot"></div> MT5 Live'
            : '<div class="dot"></div> MT5 Offline';
    }

    updateMT5Info(d) {
        setText('mt5-account', d.account || '—');
        setText('mt5-balance', d.balance != null ? formatNumber(d.balance) : '—');
        setText('mt5-equity',  d.equity  != null ? formatNumber(d.equity)  : '—');
        setText('mt5-margin',  d.margin  != null ? formatNumber(d.margin)  : '—');
    }

    // ── Journal ───────────────────────────────

    async loadJournalData() {
        const trades = await safeFetch('/api/journal');
        if (Array.isArray(trades)) {
            state.set('trades', trades);
            this.updateJournalStats(trades);
        }
    }

    updateJournalStats(trades) {
        const closed   = trades.filter(t => t.status  === 'CLOSED');
        const wins     = closed.filter(t => t.outcome === 'WIN');
        const losses   = closed.filter(t => t.outcome === 'LOSS');
        const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);
        const winRate  = closed.length ? (wins.length / closed.length) * 100 : 0;
        const avgWin   = wins.length   ? wins.reduce(  (s,t) => s + (t.pnl || 0), 0)         / wins.length   : 0;
        const avgLoss  = losses.length ? losses.reduce((s,t) => s + Math.abs(t.pnl||0), 0)   / losses.length : 0;
        const lossRate = closed.length ? losses.length / closed.length : 0;
        const expect   = (winRate / 100) * avgWin - lossRate * avgLoss;

        const map = {
            'j-total':      trades.length,
            'j-open':       trades.filter(t => t.status === 'OPEN').length,
            'j-wins':       wins.length,
            'j-losses':     losses.length,
            'j-wr':         formatNumber(winRate, 1) + '%',
            'j-pnl':        formatNumber(totalPnl, 2),
            'j-expectancy': formatNumber(expect, 2),
        };
        Object.entries(map).forEach(([id, val]) => setText(id, val));

        const pnlEl = document.getElementById('j-pnl');
        if (pnlEl) pnlEl.className = totalPnl >= 0 ? 's-val price-up' : 's-val price-down';
    }

    // ── Settings ──────────────────────────────

    async loadSettings() {
        const settings = await safeFetch('/api/settings');
        if (settings) state.set('settings', settings);
    }

    // ── IST Clock ─────────────────────────────

    updateISTClock() {
        const now = new Date();
        const ist = new Date(now.getTime() + 5.5 * 3_600_000);
        setText('pb-time', formatTime(ist, 'HH:mm:ss'));
        const sessionEl = document.getElementById('pb-session');
        if (sessionEl) sessionEl.textContent = this.getTradingSession(now);
    }

    getTradingSession(utcDate) {
        const h = utcDate.getUTCHours() + utcDate.getUTCMinutes() / 60;
        if (h >= 17.5 && h < 22.0) return '🇺🇸 New York';
        if (h >= 13.0 && h < 17.5) return '🇬🇧🇺🇸 London/NY';
        if (h >= 8.0  && h < 13.0) return '🇬🇧 London';
        if (h >= 5.0  && h < 8.0)  return '🇯🇵 Asian';
        return '🌙 Off-Hours';
    }

    // ── Toast ─────────────────────────────────

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => { toast.className = 'toast'; }, 3000);
    }
}

// ─────────────────────────────────────────────
// Global scanner controls
// Defined HERE first — signal-panel.js guards with
// `if (typeof window.startScanner !== 'function')`
// so it will never overwrite these.
// ─────────────────────────────────────────────

async function _scannerAction(url, successMsg, successType, failMsg) {
    const data = await safeFetch(url, { method: 'POST' });
    if (data !== null) {
        window.dashboard.showToast(successMsg, successType);
        window.dashboard.loadScannerState();
        // After START, server waits 2 s to emit signal — poll immediately after that
        if (successType === 'success') {
            setTimeout(() => window.dashboard.loadSignal(), 2500);
        }
    } else {
        window.dashboard.showToast(failMsg, 'error');
    }
}

window.startScanner = () =>
    _scannerAction('/api/scanner/start', '🤖 Scanner started!', 'success', 'Failed to start scanner');

window.stopScanner  = () =>
    _scannerAction('/api/scanner/stop',  '🛑 Scanner stopped',  'warning', 'Failed to stop scanner');

// ─────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new TradingDashboard();
});