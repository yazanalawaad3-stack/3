// sb-balance.js - Updates my-assets.html numbers using get_assets_summary RPC
;(function () {
  'use strict';

  function setText(sel, text) {
    var el = document.querySelector(sel);
    if (el) el.textContent = text;
  }

  function fmt2(n) {
    var x = Number(n);
    if (!isFinite(x)) x = 0;
    return x.toFixed(2);
  }

  async function refresh() {
    try {
      if (!window.DemoWallet || typeof window.DemoWallet.getAssetsSummary !== 'function') return;

      var data = await window.DemoWallet.getAssetsSummary();
      if (!data) return;

      var bal = data.usdt_balance ?? data.total_assets ?? 0;

      setText('.assets-usdt-balance', fmt2(bal) + ' USDT');
      setText('.assets-usd-approx', fmt2(bal)); // show same number inside donut

      setText('.assets-total-personal', fmt2(data.total_personal) + ' USDT');
      setText('.assets-today-personal', fmt2(data.today_personal) + ' USDT');

      setText('.assets-total-team', fmt2(data.total_team) + ' USDT');
      setText('.assets-today-team', fmt2(data.today_team) + ' USDT');

      // currency list USDT amount
      document.querySelectorAll('.currency-amount[data-asset="USDT"]').forEach(function (el) {
        el.textContent = fmt2(bal);
      });
    } catch (e) {
      try { console.warn('sb-balance refresh failed:', e && e.message ? e.message : e); } catch (_) {}
    }
  }

  function start() {
    refresh();
    // refresh every 20s to keep it in sync after AI Power runs
    setInterval(refresh, 20000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
