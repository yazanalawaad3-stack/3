// Assets dashboard updater (server-truth via RPC)
//
// This script updates visible balances/income numbers on pages such as my-assets.
// It uses DemoWallet.getAssetsSummary() which reads from the DB (no local cache).
//
// Safe: it only updates elements if they exist.

;(function () {
  'use strict';

  function fmt2(n) {
    var x = Number(n);
    if (!isFinite(x)) x = 0;
    return x.toFixed(2);
  }

  function setText(sel, text) {
    var el = document.querySelector(sel);
    if (el) el.textContent = text;
  }

  async function update() {
    if (!window.DemoWallet || !window.ExaAuth) return;
    var userId = await window.ExaAuth.ensureSupabaseUserId();
    if (!userId) return;

    try {
      var s = await window.DemoWallet.getAssetsSummary();

      // Common: wallet balance
      setText('.assets-usdt-balance', fmt2(s.usdt_balance) + ' USDT');

      // Optional blocks (only if your HTML has these classes/ids)
      setText('.total-personal-income', fmt2(s.total_personal) + ' USDT');
      setText('.team-total-income', fmt2(s.total_team) + ' USDT');
      setText('.today-personal-income', fmt2(s.today_personal) + ' USDT');
      setText('.today-team-income', fmt2(s.today_team) + ' USDT');

      // Also support IDs if your template uses them
      setText('#totalPersonalIncome', fmt2(s.total_personal) + ' USDT');
      setText('#teamTotalIncome', fmt2(s.total_team) + ' USDT');
      setText('#todayPersonalIncome', fmt2(s.today_personal) + ' USDT');
      setText('#todayTeamIncome', fmt2(s.today_team) + ' USDT');
      setText('#usdtBalance', fmt2(s.usdt_balance) + ' USDT');
    } catch (e) {
      // silent
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', update);
  } else {
    update();
  }
})();