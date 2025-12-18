
;(function () {
  'use strict';

  var SB = window.SB_CONFIG;
  if (!SB) return;

  function rpc(name, body) {
    return fetch(SB.url + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: SB.headers(),
      body: JSON.stringify(body || {})
    }).then(async function (res) {
      var txt = await res.text();
      if (!res.ok) {
        try { var j = JSON.parse(txt); throw new Error(j.message || j.error || txt); }
        catch (e) { throw new Error(txt || ('RPC ' + name + ' failed')); }
      }
      try { return JSON.parse(txt); } catch (e) { return txt; }
    });
  }

  function fmt(n) {
    n = Number(n || 0);
    if (!isFinite(n)) n = 0;
    return n.toFixed(2);
  }

  async function update() {
    if (!window.ExaAuth || typeof window.ExaAuth.ensureSupabaseUserId !== 'function') return;
    var uid = await window.ExaAuth.ensureSupabaseUserId();
    if (!uid) return;

    var rows = await rpc('get_assets_summary', { p_user: uid });
    var s = Array.isArray(rows) ? rows[0] : rows;
    if (!s) return;

    var bal = fmt(s.usdt_balance);
    var set = function (sel, val) {
      var el = document.querySelector(sel);
      if (el) el.textContent = val;
    };

    // Main balance
    set('.assets-usdt-balance', bal + ' USDT');
    // Donut number inside circle
    set('.assets-usd-approx', bal);

    // Profit fields
    set('.assets-total-personal', fmt(s.total_personal) + ' USDT');
    set('.assets-total-team', fmt(s.total_team) + ' USDT');
    set('.assets-today-personal', fmt(s.today_personal) + ' USDT');
    set('.assets-today-team', fmt(s.today_team) + ' USDT');

    // Currency list USDT amount
    document.querySelectorAll('.currency-amount[data-asset="USDT"]').forEach(function (el) {
      el.textContent = bal;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', update);
  } else {
    update();
  }
})();
