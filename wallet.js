// Wallet + earnings + withdrawals module (Supabase RPC-first)
//
// IMPORTANT:
// - Do NOT keep a local balance cache. Balance/earnings are server-truth.
// - Use SQL RPC functions/views provided by your migration pack.
// - This module exposes a global `DemoWallet` object for pages.
//
// Requires: sb-config.js, auth.js

;(function () {
  'use strict';

  var SB = window.SB_CONFIG;
  if (!SB) {
    console.error('SB_CONFIG is not defined. Ensure sb-config.js is loaded before wallet.js.');
    return;
  }

  function _uid() {
    try { return localStorage.getItem('currentUserId') || null; } catch (_) { return null; }
  }

  async function _rpc(fnName, bodyObj) {
    var res = await fetch(SB.url + '/rest/v1/rpc/' + encodeURIComponent(fnName), {
      method: 'POST',
      headers: SB.headers(),
      body: JSON.stringify(bodyObj || {})
    });
    if (!res.ok) {
      var t = '';
      try { t = await res.text(); } catch (_) {}
      throw new Error(t || ('RPC failed: ' + fnName));
    }
    return await res.json();
  }

  async function _getOne(table, select, filterKey, filterVal) {
    var url = SB.url + '/rest/v1/' + table
      + '?select=' + encodeURIComponent(select)
      + '&' + encodeURIComponent(filterKey) + '=eq.' + encodeURIComponent(filterVal)
      + '&limit=1';
    var res = await fetch(url, { method: 'GET', headers: SB.headers() });
    if (!res.ok) return null;
    var rows = await res.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  // ---------------------------------------------------------------------------
  // Assets / income summary (used by dashboard)
  // ---------------------------------------------------------------------------

  async function getAssetsSummary() {
    var userId = _uid();
    if (!userId) throw new Error('Not logged in');
    // returns a single row object
    var rows = await _rpc('get_assets_summary', { p_user: userId });
    // PostgREST returns array for set-returning functions
    var row = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!row) {
      return {
        usdt_balance: 0,
        total_personal: 0,
        today_personal: 0,
        total_team: 0,
        today_team: 0
      };
    }
    return row;
  }

  async function getAssetsDashboard() {
    var userId = _uid();
    if (!userId) throw new Error('Not logged in');
    var rows = await _rpc('get_assets_dashboard', { p_user: userId });
    var row = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!row) {
      return {
        total_assets: 0,
        personal_total: 0,
        personal_24h: 0,
        team_total: 0,
        team_24h: 0
      };
    }
    return row;
  }

  // ---------------------------------------------------------------------------
  // AI Power action
  // ---------------------------------------------------------------------------

  async function performIpowerAction() {
    var userId = _uid();
    if (!userId) throw new Error('Not logged in');
    // returns table(action_id, out_user_id, earning_amount, new_balance, out_created_at)
    var rows = await _rpc('perform_ipower_action', { p_user: userId });
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  // ---------------------------------------------------------------------------
  // Team
  // ---------------------------------------------------------------------------

  async function getMyTeam() {
    var userId = _uid();
    if (!userId) throw new Error('Not logged in');
    // returns rows (depth, public_id, phone, created_at, usdt_balance, is_funded, is_activated)
    var rows = await _rpc('get_my_team', { p_ancestor: userId });
    return Array.isArray(rows) ? rows : [];
  }

  // ---------------------------------------------------------------------------
  // VIP / state
  // ---------------------------------------------------------------------------

  async function getVipInfo() {
    var userId = _uid();
    if (!userId) {
      return { currentLevel: 'V0', isActivated: false, isFunded: false, isLocked: false, lockedReason: null };
    }
    var state = await _getOne('user_state', 'current_level,is_activated,is_funded,is_locked,locked_reason', 'user_id', userId);
    state = state || {};
    return {
      currentLevel: state.current_level || 'V0',
      isActivated: !!state.is_activated,
      isFunded: !!state.is_funded,
      isLocked: !!state.is_locked,
      lockedReason: state.locked_reason || null
    };
  }

  // ---------------------------------------------------------------------------
  // Payout addresses
  // ---------------------------------------------------------------------------

  async function listPayoutAddresses() {
    var userId = _uid();
    if (!userId) throw new Error('Not logged in');
    var url = SB.url + '/rest/v1/user_payout_addresses'
      + '?select=currency,network,address,is_locked,locked_at,updated_at'
      + '&user_id=eq.' + encodeURIComponent(userId);
    var res = await fetch(url, { method: 'GET', headers: SB.headers() });
    if (!res.ok) return [];
    var rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }

  async function addPayoutAddress(currency, network, address) {
    var userId = _uid();
    if (!userId) throw new Error('Not logged in');
    var payload = {
      user_id: userId,
      currency: String(currency || '').toLowerCase(),
      network: String(network || '').toLowerCase(),
      address: String(address || '')
    };
    var res = await fetch(SB.url + '/rest/v1/user_payout_addresses', {
      method: 'POST',
      headers: Object.assign({}, SB.headers(), { 'Prefer': 'return=representation' }),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      var msg = '';
      try { msg = await res.text(); } catch (_) {}
      throw new Error(msg || 'Failed to add address');
    }
    var data = await res.json();
    return Array.isArray(data) && data.length ? data[0] : null;
  }

  // ---------------------------------------------------------------------------
  // Withdrawals (MUST use RPC request_withdrawal to enforce rules)
  // ---------------------------------------------------------------------------

  async function requestWithdrawal(opts) {
    var userId = _uid();
    if (!userId) throw new Error('Not logged in');
    opts = opts || {};
    var amount = Number(opts.amount);
    if (!isFinite(amount) || amount <= 0) throw new Error('Invalid amount');

    var currency = String(opts.currency || '').toLowerCase();
    var network = String(opts.network || '').toLowerCase();
    var address = String(opts.address || '').trim();

    // Returns uuid (request id)
    var reqId = await _rpc('request_withdrawal', {
      p_user: userId,
      p_amount: amount,
      p_currency: currency,
      p_network: network,
      p_address: address
    });

    // PostgREST returns scalar directly for scalar functions.
    return reqId;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  window.DemoWallet = {
    // Assets & income (dashboard)
    getAssetsSummary: getAssetsSummary,
    getAssetsDashboard: getAssetsDashboard,

    // AI Power
    performIpowerAction: performIpowerAction,

    // Team / state
    getMyTeam: getMyTeam,
    getVipInfo: getVipInfo,

    // Payout addresses
    listPayoutAddresses: listPayoutAddresses,
    addPayoutAddress: addPayoutAddress,

    // Withdrawals
    requestWithdrawal: requestWithdrawal
  };
})();