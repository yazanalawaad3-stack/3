// sb-balance.js
// Updates balances + income widgets on my-assets.html using Supabase RPCs.
// Calls public.get_assets_summary(p_user uuid) and updates the UI.
//
// Targets in my-assets.html:
// - .assets-usdt-balance (Total Account Assets line)
// - .assets-usd-approx (donut center)
// - .assets-total-personal / .assets-today-personal
// - .assets-total-team / .assets-today-team
// - .currency-amount[data-asset="USDT"]

;(function () {
  'use strict';

  function fmt2(n) {
    var x = Number(n);
    if (!isFinite(x)) x = 0;
    return x.toFixed(2);
  }

  function setText(el, text) {
    if (!el) return;
    el.textContent = text;
  }

  function q(sel) { return document.querySelector(sel); }
  function qAll(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  async function getUserId() {
    try {
      if (window.ExaAuth && typeof window.ExaAuth.ensureSupabaseUserId === 'function') {
        var uid = await window.ExaAuth.ensureSupabaseUserId();
        if (uid) return uid;
      }
    } catch (e) {}

    try {
      return localStorage.getItem('currentUserId') ||
             localStorage.getItem('sb_user_id') ||
             null;
    } catch (e) {}
    return null;
  }

  async function rpcGetAssetsSummary(userId) {
    if (!window.SB_CONFIG || !SB_CONFIG.url) throw new Error('SB_CONFIG missing');
    var url = SB_CONFIG.url + '/rest/v1/rpc/get_assets_summary';
    var res = await fetch(url, {
      method: 'POST',
      headers: SB_CONFIG.headers(),
      body: JSON.stringify({ p_user: userId })
    });

    if (!res.ok) {
      var t = '';
      try { t = await res.text(); } catch (e) {}
      throw new Error('RPC get_assets_summary failed: ' + res.status + ' ' + t);
    }

    var data = await res.json();
    if (Array.isArray(data)) return data[0] || {};
    return data || {};
  }

  function applyToUI(summary) {
    var usdt = fmt2(summary.usdt_balance);
    var totalPersonal = fmt2(summary.total_personal);
    var todayPersonal = fmt2(summary.today_personal);
    var totalTeam = fmt2(summary.total_team);
    var todayTeam = fmt2(summary.today_team);

    setText(q('.assets-usdt-balance'), usdt + ' USDT');

    // User requested: donut center shows the same number as the total (203)
    setText(q('.assets-usd-approx'), usdt);

    setText(q('.assets-total-personal'), totalPersonal + ' USDT');
    setText(q('.assets-today-personal'), todayPersonal + ' USDT');
    setText(q('.assets-total-team'), totalTeam + ' USDT');
    setText(q('.assets-today-team'), todayTeam + ' USDT');

    qAll('.currency-amount[data-asset="USDT"]').forEach(function (el) {
      setText(el, usdt);
    });
  }

  async function refresh() {
    var uid = await getUserId();
    if (!uid) return;
    var summary = await rpcGetAssetsSummary(uid);
    applyToUI(summary || {});
  }

  function start() {
    refresh().catch(function () {});
    setInterval(function () {
      refresh().catch(function () {});
    }, 10000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();