
// ai-power-helper.js
// Attach this on ai-power.html page AFTER wallet.js/auth.js.
// It will look for a button with id="aiPowerBtn" OR any element with [data-ai-power] and bind click.

;(function () {
  'use strict';

  function findButton() {
    return document.getElementById('aiPowerBtn') || document.querySelector('[data-ai-power]');
  }

  async function onTap(e) {
    try { if (e && e.preventDefault) e.preventDefault(); } catch (_) {}
    if (!window.DemoWallet || !window.ExaAuth) return;

    var userId = await window.ExaAuth.ensureSupabaseUserId();
    if (!userId) { alert('Please login first'); return; }

    try {
      var r = await window.DemoWallet.runAiPower();
      // After success, refresh asset summary if any page widgets exist
      alert('Done! Earned: ' + (r.earning_amount || 0).toFixed(2) + ' USDT');
      // If sb-balance is loaded on this page it will refresh automatically; otherwise do nothing.
    } catch (err) {
      var msg = (err && err.message) ? err.message : String(err || 'Error');
      alert(msg);
      console.error('[ai-power] failed:', err);
    }
  }

  function init() {
    var btn = findButton();
    if (!btn) return;
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', onTap);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
