
// sb-balance.js (Asset Center updater)
// Reads DB summary using DemoWallet.getAssetsSummary() and updates:
// - .assets-usdt-balance
// - .assets-usd-approx (inside donut)
// - .assets-total-personal
// - .assets-today-personal
// - .assets-total-team
// - .assets-today-team
// - Currency list USDT amount: .currency-amount[data-asset="USDT"]

;(function () {
  'use strict';

  function setText(sel, text) {
    var el = document.querySelector(sel);
    if (el) el.textContent = text;
  }

  function setAllText(selector, text) {
    document.querySelectorAll(selector).forEach(function (el) { el.textContent = text; });
  }

  function num(v) {
    var n = typeof v === 'number' ? v : parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  async function update() {
    if (!window.DemoWallet || !window.ExaAuth) return;
    var userId = await window.ExaAuth.ensureSupabaseUserId();
    if (!userId) return;

    try {
      var s = await window.DemoWallet.getAssetsSummary();

      // Main balance display
      var bal = num(s.usdt_balance);
      setAllText('.assets-usdt-balance', bal.toFixed(2) + ' USDT');

      // Donut center value (approx) — match balance (your design uses "$")
      setText('.assets-usd-approx', bal.toFixed(2));

      // Income stats
      setAllText('.assets-total-personal', num(s.total_personal).toFixed(2) + ' USDT');
      setAllText('.assets-today-personal', num(s.today_personal).toFixed(2) + ' USDT');
      setAllText('.assets-total-team', num(s.total_team).toFixed(2) + ' USDT');
      setAllText('.assets-today-team', num(s.today_team).toFixed(2) + ' USDT');

      // Currency list USDT amount row
      document.querySelectorAll('.currency-amount[data-asset="USDT"]').forEach(function (el) {
        el.textContent = bal.toFixed(2);
      });
    } catch (e) {
      // If something fails, show nothing (but log for debugging)
      console.error('[sb-balance] update failed:', e && e.message ? e.message : e);
    }
  }

  function start() {
    update();
    // Optional periodic refresh
    setInterval(update, 15000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
