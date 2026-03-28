"""
MT5 Bridge — XM Demo Account
Runs as a local Flask server on port 5000
Node.js server communicates with this bridge
"""

import MetaTrader5 as mt5
from flask import Flask, request, jsonify
from flask_cors import CORS
import datetime
import time

app = Flask(__name__)
CORS(app)

# ── SYMBOL CONFIG ─────────────────────────────────────
SYMBOL_CANDIDATES = ['XAUUSD', 'XAUUSDm', 'XAUUSDc', 'GOLD', 'GOLDm', 'XAUUSD.']
ACTIVE_SYMBOL = 'XAUUSD'

# ── SYMBOL AUTO-DETECT ────────────────────────────────
def detect_symbol():
    global ACTIVE_SYMBOL
    for sym in SYMBOL_CANDIDATES:
        info = mt5.symbol_info(sym)
        if info is not None:
            mt5.symbol_select(sym, True)
            time.sleep(0.2)
            ACTIVE_SYMBOL = sym
            print(f"  ✅ Gold symbol detected: {sym}")
            return sym
    print("  ❌ No Gold symbol found! Check Market Watch in MT5.")
    return None

# ── MT5 CONNECTION ────────────────────────────────────
def connect_mt5():
    if not mt5.initialize():
        print(f"  ❌ MT5 initialize failed: {mt5.last_error()}")
        return False

    acc  = mt5.account_info()
    term = mt5.terminal_info()
    if not acc or not term:
        print("  ❌ Could not get account/terminal info")
        return False

    print(f"  ✅ MT5 Connected: {term.name}")
    print(f"     Account:  {acc.login}")
    print(f"     Balance:  ${acc.balance:.2f}")
    print(f"     Equity:   ${acc.equity:.2f}")
    print(f"     Leverage: 1:{acc.leverage}")
    print(f"     Server:   {acc.server}")

    sym = detect_symbol()
    if sym:
        mt5.symbol_select(sym, True)
        time.sleep(0.3)
        tick = mt5.symbol_info_tick(sym)
        if tick:
            print(f"  ✅ {sym} loaded — Bid: {tick.bid} Ask: {tick.ask}")
        else:
            print(f"  ⚠️  {sym} selected but no tick yet")
    return True

# ── ENSURE CONNECTED ─────────────────────────────────
def ensure_connected():
    term = mt5.terminal_info()
    if term is None:
        print("  🔄 MT5 connection lost — re-connecting...")
        return connect_mt5()
    return True

# ── AUTO-DETECT FILLING MODE ──────────────────────────
def get_filling_mode(symbol):
    info = mt5.symbol_info(symbol)
    if info is None:
        return mt5.ORDER_FILLING_FOK

    filling = info.filling_mode
    print(f"  📋 Symbol filling mode raw value: {filling}")

    if filling & 1:
        print("  ✅ Using ORDER_FILLING_FOK")
        return mt5.ORDER_FILLING_FOK
    elif filling & 2:
        print("  ✅ Using ORDER_FILLING_IOC")
        return mt5.ORDER_FILLING_IOC
    else:
        print("  ✅ Using ORDER_FILLING_RETURN")
        return mt5.ORDER_FILLING_RETURN

# ── SYMBOL HELPER ─────────────────────────────────────
def resolve_symbol(requested='XAUUSD'):
    global ACTIVE_SYMBOL

    info = mt5.symbol_info(requested)
    if info is not None:
        mt5.symbol_select(requested, True)
        time.sleep(0.1)
        return requested

    if ACTIVE_SYMBOL != requested:
        info = mt5.symbol_info(ACTIVE_SYMBOL)
        if info is not None:
            mt5.symbol_select(ACTIVE_SYMBOL, True)
            time.sleep(0.1)
            print(f"  ⚠️  Using {ACTIVE_SYMBOL} instead of {requested}")
            return ACTIVE_SYMBOL

    sym = detect_symbol()
    return sym

# ── ROUTES ───────────────────────────────────────────

@app.route('/status', methods=['GET'])
def status():
    if not ensure_connected():
        return jsonify({'connected': False, 'error': str(mt5.last_error())})

    acc = mt5.account_info()
    if not acc:
        return jsonify({'connected': False, 'error': 'No account info'})

    # Calculate margin level safely
    margin_level = 0
    if acc.margin > 0:
        margin_level = round((acc.equity / acc.margin) * 100, 2)

    return jsonify({
        'connected':    True,
        'login':        acc.login,
        'balance':      round(acc.balance, 2),
        'equity':       round(acc.equity, 2),
        'margin':       round(acc.margin, 2),
        'freeMargin':   round(acc.margin_free, 2),
        'marginLevel':  margin_level,
        'profit':       round(acc.profit, 2),
        'server':       acc.server,
        'currency':     acc.currency,
        'leverage':     acc.leverage,
        'symbol':       ACTIVE_SYMBOL,
        'name':         acc.name
    })

@app.route('/symbols', methods=['GET'])
def list_symbols():
    if not ensure_connected():
        return jsonify({'error': 'MT5 not connected'}), 400

    all_symbols = mt5.symbols_get()
    if all_symbols is None:
        return jsonify({'gold_symbols': [], 'error': str(mt5.last_error())})

    gold = [s.name for s in all_symbols if 'XAU' in s.name or 'GOLD' in s.name.upper()]
    return jsonify({
        'gold_symbols':  gold,
        'active_symbol': ACTIVE_SYMBOL,
        'total_symbols': len(all_symbols)
    })

@app.route('/price', methods=['GET'])
def get_price():
    symbol = request.args.get('symbol', ACTIVE_SYMBOL)

    if not ensure_connected():
        return jsonify({'error': 'MT5 not connected'}), 400

    symbol = resolve_symbol(symbol)
    if not symbol:
        return jsonify({'error': 'Cannot resolve Gold symbol'}), 400

    tick = mt5.symbol_info_tick(symbol)
    if not tick:
        return jsonify({'error': f'Cannot get price for {symbol}'}), 400

    return jsonify({
        'symbol': symbol,
        'bid':    round(tick.bid, 2),
        'ask':    round(tick.ask, 2),
        'spread': round((tick.ask - tick.bid) * 100, 1),
        'time':   datetime.datetime.fromtimestamp(tick.time).isoformat()
    })

@app.route('/open-trade', methods=['POST'])
def open_trade():
    data      = request.json
    symbol    = data.get('symbol', ACTIVE_SYMBOL)
    direction = data.get('direction', '').upper()
    lot_size  = float(data.get('lotSize', 0.01))
    sl_price  = float(data.get('sl', 0))
    tp_price  = float(data.get('tp', 0))
    comment   = data.get('comment', 'AI Signal')

    print(f"\n  📨 TRADE REQUEST: {direction} {lot_size} {symbol}")
    print(f"     SL: {sl_price} | TP: {tp_price}")

    if direction not in ['BUY', 'SELL']:
        return jsonify({'success': False, 'error': 'direction must be BUY or SELL'}), 400
    if lot_size < 0.01:
        return jsonify({'success': False, 'error': 'Minimum lot size is 0.01'}), 400

    if not ensure_connected():
        return jsonify({'success': False, 'error': 'MT5 not connected'}), 400

    # ── PRE-TRADE MARGIN CHECK ──────────────────────
    acc = mt5.account_info()
    if acc:
        # Rough margin check: 1 lot GOLD at 1:100 needs ~$45 margin
        # lotSize * price / leverage ≈ required margin
        tick_check = mt5.symbol_info_tick(resolve_symbol(symbol) or symbol)
        if tick_check:
            approx_price    = tick_check.ask if direction == 'BUY' else tick_check.bid
            required_margin = (lot_size * approx_price) / acc.leverage
            print(f"  💰 Balance: ${acc.balance:.2f} | Free Margin: ${acc.margin_free:.2f} | Required: ~${required_margin:.2f}")

            if required_margin > acc.margin_free * 0.9:  # 90% safety buffer
                msg = (f"Insufficient margin. Need ~${required_margin:.2f}, "
                       f"have ${acc.margin_free:.2f} free. "
                       f"Max safe lot: {(acc.margin_free * 0.9 * acc.leverage / approx_price):.2f}")
                print(f"  ❌ MARGIN CHECK FAILED: {msg}")
                return jsonify({'success': False, 'error': msg}), 400

    symbol = resolve_symbol(symbol)
    if not symbol:
        return jsonify({'success': False, 'error': 'Cannot find Gold symbol'}), 400

    mt5.symbol_select(symbol, True)
    time.sleep(0.5)

    tick = None
    for attempt in range(3):
        tick = mt5.symbol_info_tick(symbol)
        if tick:
            break
        print(f"  ⏳ Waiting for tick (attempt {attempt + 1}/3)...")
        time.sleep(1.0)

    if not tick:
        err = mt5.last_error()
        return jsonify({'success': False, 'error': f'Cannot get price for {symbol}. Error: {err}'}), 400

    price      = tick.ask if direction == 'BUY' else tick.bid
    order_type = mt5.ORDER_TYPE_BUY if direction == 'BUY' else mt5.ORDER_TYPE_SELL
    filling    = get_filling_mode(symbol)

    print(f"  📊 Live price: ask={tick.ask} bid={tick.bid} → using {price}")

    # Validate / auto-set SL
    if sl_price == 0:
        sl_price = price - 15.0 if direction == 'BUY' else price + 15.0
        print(f"  ⚠️  No SL, auto-set to {sl_price:.2f}")
    else:
        sl_distance = abs(price - sl_price)
        if sl_distance < 1.0:
            sl_price = price - 15.0 if direction == 'BUY' else price + 15.0
            print(f"  ⚠️  SL too close, adjusted to {sl_price:.2f}")

    # Validate / auto-set TP
    if tp_price == 0:
        risk     = abs(price - sl_price)
        tp_price = price + (risk * 2) if direction == 'BUY' else price - (risk * 2)
        print(f"  ⚠️  No TP, auto-set to {tp_price:.2f}")

    request_data = {
        'action':       mt5.TRADE_ACTION_DEAL,
        'symbol':       symbol,
        'volume':       lot_size,
        'type':         order_type,
        'price':        price,
        'sl':           round(sl_price, 2),
        'tp':           round(tp_price, 2),
        'deviation':    50,
        'magic':        234000,
        'comment':      comment,
        'type_time':    mt5.ORDER_TIME_GTC,
        'type_filling': filling,
    }

    print(f"\n  📤 SENDING TO MT5: {request_data}")
    result = mt5.order_send(request_data)
    print(f"  📥 MT5 RESULT: {result}")

    if result is None:
        err = mt5.last_error()
        return jsonify({'success': False, 'error': f'MT5 error: {err}'}), 400

    if result.retcode != mt5.TRADE_RETCODE_DONE:
        print(f"\n  ❌ ORDER FAILED: code={result.retcode} comment={result.comment}")

        # Retry with fallback filling modes
        if result.retcode in [10030, 10006]:
            for fallback in [mt5.ORDER_FILLING_FOK, mt5.ORDER_FILLING_IOC, mt5.ORDER_FILLING_RETURN]:
                if fallback == filling:
                    continue
                request_data['type_filling'] = fallback
                result = mt5.order_send(request_data)
                if result and result.retcode == mt5.TRADE_RETCODE_DONE:
                    print(f"  ✅ Success with fallback filling: {fallback}")
                    break

        if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
            return jsonify({
                'success': False,
                'retcode': result.retcode if result else None,
                'error':   f'{result.comment if result else "None"} (code: {result.retcode if result else "N/A"})'
            }), 400

    print(f"\n  🚀 TRADE OPENED: {direction} {lot_size} {symbol} @ {price}")
    print(f"     SL: {sl_price:.2f} | TP: {tp_price:.2f} | Ticket: {result.order}\n")

    return jsonify({
        'success':   True,
        'ticket':    result.order,
        'symbol':    symbol,
        'direction': direction,
        'lotSize':   lot_size,
        'price':     price,
        'sl':        round(sl_price, 2),
        'tp':        round(tp_price, 2),
        'comment':   comment
    })

@app.route('/close-trade', methods=['POST'])
def close_trade():
    data   = request.json
    ticket = int(data.get('ticket', 0))
    symbol = data.get('symbol', ACTIVE_SYMBOL)

    if not ticket:
        return jsonify({'error': 'ticket required'}), 400
    if not ensure_connected():
        return jsonify({'error': 'MT5 not connected'}), 400

    symbol = resolve_symbol(symbol)
    if not symbol:
        return jsonify({'error': 'Cannot resolve symbol'}), 400

    positions = mt5.positions_get(ticket=ticket)
    if not positions:
        return jsonify({'error': f'Position {ticket} not found'}), 404

    pos     = positions[0]
    filling = get_filling_mode(symbol)

    tick = None
    for _ in range(3):
        tick = mt5.symbol_info_tick(symbol)
        if tick:
            break
        time.sleep(0.5)

    if not tick:
        return jsonify({'error': f'Cannot get price for {symbol}'}), 400

    close_price = tick.bid if pos.type == mt5.ORDER_TYPE_BUY else tick.ask
    close_type  = mt5.ORDER_TYPE_SELL if pos.type == mt5.ORDER_TYPE_BUY else mt5.ORDER_TYPE_BUY

    request_data = {
        'action':       mt5.TRADE_ACTION_DEAL,
        'symbol':       symbol,
        'volume':       pos.volume,
        'type':         close_type,
        'position':     ticket,
        'price':        close_price,
        'deviation':    50,
        'magic':        234000,
        'comment':      'AI Close',
        'type_time':    mt5.ORDER_TIME_GTC,
        'type_filling': filling,
    }

    print(f"\n  📤 CLOSING TRADE: ticket={ticket} @ {close_price}")
    result = mt5.order_send(request_data)
    print(f"  📥 CLOSE RESULT: {result}")

    if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
        err  = result.comment if result else str(mt5.last_error())
        code = result.retcode if result else 'None'
        return jsonify({'success': False, 'error': f'Close failed: {err} (code: {code})'}), 400

    print(f"\n  ✅ TRADE CLOSED: Ticket {ticket} | P&L: ${pos.profit:.2f}\n")
    return jsonify({'success': True, 'ticket': ticket, 'profit': round(pos.profit, 2), 'price': close_price})

@app.route('/positions', methods=['GET'])
def get_positions():
    if not ensure_connected():
        return jsonify([])

    positions = mt5.positions_get()
    if positions is None:
        return jsonify([])

    result = []
    for p in positions:
        result.append({
            'ticket':    p.ticket,
            'symbol':    p.symbol,
            'type':      'BUY' if p.type == 0 else 'SELL',
            'volume':    p.volume,
            'openPrice': round(p.price_open, 2),
            'sl':        round(p.sl, 2),
            'tp':        round(p.tp, 2),
            'profit':    round(p.profit, 2),
            'comment':   p.comment,
            'openTime':  datetime.datetime.fromtimestamp(p.time).isoformat()
        })
    return jsonify(result)

@app.route('/modify-sl', methods=['POST'])
def modify_sl():
    data   = request.json
    ticket = int(data.get('ticket', 0))
    new_sl = float(data.get('sl', 0))
    symbol = data.get('symbol', ACTIVE_SYMBOL)

    if not ensure_connected():
        return jsonify({'error': 'MT5 not connected'}), 400

    positions = mt5.positions_get(ticket=ticket)
    if not positions:
        return jsonify({'error': f'Position {ticket} not found'}), 404

    pos = positions[0]
    request_data = {
        'action':   mt5.TRADE_ACTION_SLTP,
        'symbol':   symbol,
        'position': ticket,
        'sl':       new_sl,
        'tp':       pos.tp,
    }

    result = mt5.order_send(request_data)
    if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
        err = result.comment if result else str(mt5.last_error())
        return jsonify({'success': False, 'error': f'Modify failed: {err}'}), 400

    print(f"  ⚡ SL MODIFIED: Ticket {ticket} → SL {new_sl}")
    return jsonify({'success': True, 'ticket': ticket, 'newSL': new_sl})

@app.route('/account-history', methods=['GET'])
def account_history():
    if not ensure_connected():
        return jsonify([])

    from_date = datetime.datetime.now() - datetime.timedelta(days=30)
    to_date   = datetime.datetime.now()

    deals = mt5.history_deals_get(from_date, to_date)
    if deals is None:
        return jsonify([])

    result = []
    for d in deals:
        if d.entry == 1:
            result.append({
                'ticket':  d.ticket,
                'symbol':  d.symbol,
                'type':    'BUY' if d.type == 0 else 'SELL',
                'volume':  d.volume,
                'price':   round(d.price, 2),
                'profit':  round(d.profit, 2),
                'time':    datetime.datetime.fromtimestamp(d.time).isoformat(),
                'comment': d.comment
            })
    return jsonify(result)

# ── START ─────────────────────────────────────────────
if __name__ == '__main__':
    print('\n  🔌 MT5 Bridge starting...')
    if connect_mt5():
        print(f'  🌐 Bridge ready on http://localhost:5000')
        print(f'  🥇 Active symbol: {ACTIVE_SYMBOL}')
        print(f'  🔍 Debug symbols: http://localhost:5000/symbols\n')
        app.run(port=5000, debug=False)
    else:
        print('  ❌ MT5 connection failed!')
        print('  💡 Make sure:')
        print('     1. MetaTrader 5 is open')
        print('     2. You are logged into your account')
        print('     3. Internet connection is active')
        print('     4. XAUUSD is visible in Market Watch (Ctrl+M)')
