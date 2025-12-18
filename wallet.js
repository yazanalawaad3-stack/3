
// wallet.js (DB-driven)
// Uses Supabase RPC functions from your SQL system:
// - get_assets_summary(p_user uuid)
// - perform_ipower_action(p_user uuid)
// - request_withdrawal(p_user, p_currency, p_network, p_amount, p_address)
//
// This file intentionally avoids "local balance caching" logic that can conflict
// with triggers/commissions on the database.

;(function () {
  'use strict';

  var SB = window.SB_CONFIG;
  if (!SB) {
    console.error('SB_CONFIG is not defined. Ensure sb-config.js is loaded before wallet.js.');
    return;
  }

  function getUserId() {
    try { return localStorage.getItem('currentUserId') || null; } catch (e) { return null; }
  }

  async function rpc(fn, bodyObj) {
    var url = SB.url + '/rest/v1/rpc/' + encodeURIComponent(fn);
    var res = await fetch(url, {
      method: 'POST',
      headers: SB.headers(),
      body: JSON.stringify(bodyObj || {})
    });
    var txt = '';
    if (!res.ok) {
      try { txt = await res.text(); } catch (_) {}
      // Try to surface PostgREST error JSON if present
      var msg = txt;
      try {
        var j = JSON.parse(txt);
        msg = j.message || j.details || j.hint || txt;
      } catch (_) {}
      throw new Error(msg || ('RPC ' + fn + ' failed'));
    }
    // RPC may return json array or object
    return await res.json();
  }

  function num(v) {
    var n = typeof v === 'number' ? v : parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  function fmtUSDT(v) {
    return num(v).toFixed(2) + ' USDT';
  }

  // -----------------------------
  // Public API
  // -----------------------------

  /**
   * Returns the asset summary for the logged-in user.
   * { usdt_balance, total_personal, today_personal, total_team, today_team }
   */
  async function getAssetsSummary() {
    var userId = getUserId();
    if (!userId) throw new Error('Not logged in');
    var rows = await rpc('get_assets_summary', { p_user: userId });
    // SQL returns a rowset; PostgREST gives an array
    var row = Array.isArray(rows) && rows[0] ? rows[0] : (rows || {});
    return {
      usdt_balance: num(row.usdt_balance),
      total_personal: num(row.total_personal),
      today_personal: num(row.today_personal),
      total_team: num(row.total_team),
      today_team: num(row.today_team)
    };
  }

  /**
   * Performs the AI Power action (once per 24h). DB will:
   * - insert ipower_actions
   * - update wallet_balances
   * - distribute referral commissions
   * Returns { action_id, earning_amount, new_balance, out_created_at }
   */
  async function runAiPower() {
    var userId = getUserId();
    if (!userId) throw new Error('Not logged in');
    var rows = await rpc('perform_ipower_action', { p_user: userId });
    var row = Array.isArray(rows) && rows[0] ? rows[0] : (rows || {});
    return {
      action_id: row.action_id,
      earning_amount: num(row.earning_amount),
      new_balance: num(row.new_balance),
      out_created_at: row.out_created_at
    };
  }

  /**
   * Submit withdrawal request using the DB rules.
   */
  async function requestWithdraw(currency, network, amount, address) {
    var userId = getUserId();
    if (!userId) throw new Error('Not logged in');
    var payload = {
      p_user: userId,
      p_currency: String(currency || 'usdt').toLowerCase(),
      p_network: String(network || 'trc20').toLowerCase(),
      p_amount: num(amount),
      p_address: String(address || '')
    };
    var rows = await rpc('request_withdrawal', payload);
    var row = Array.isArray(rows) && rows[0] ? rows[0] : (rows || {});
    return row;
  }

  function getUser() {
    var uid = null, phone = null;
    try {
      uid = localStorage.getItem('currentUserId') || null;
      phone = localStorage.getItem('currentPhone') || null;
    } catch (e) {}
    return { id: uid, phone: phone };
  }

  window.DemoWallet = {
    getUser: getUser,
    getAssetsSummary: getAssetsSummary,
    runAiPower: runAiPower,
    requestWithdraw: requestWithdraw,
    fmtUSDT: fmtUSDT
  };
})();
