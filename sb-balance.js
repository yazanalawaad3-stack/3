// Assets dashboard updater (balance + incomes)
//
// This script updates the main "Asset Center" dashboard numbers:
// - total USDT balance
// - total personal income / today's personal income
// - team total income / today's team income
// - optional ring/center text amount
//
// It uses the SQL function `get_assets_summary(p_user uuid)` via Supabase RPC.
// If some elements are missing, it will quietly skip them.
//
// Recommended (no style change, just add class names on existing elements):
//   .assets-usdt-balance         -> "203.00 USDT" top number
//   .total-personal-income       -> "0 USDT"
//   .today-personal-income       -> "0 USDT"
//   .team-total-income           -> "0 USDT"
//   .today-team-income           -> "0 USDT"
//   .assets-ring-amount          -> "~$203" (or just "203")
//
// It also keeps backward compatibility with older pages that only had `.assets-usdt-balance`.
;
(function () {
  'use strict';

  function num(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function fmtUSDT(v) {
    return num(v).toFixed(2) + ' USDT';
  }

  function setText(sel, text) {
    var el = document.querySelector(sel);
    if (el) el.textContent = text;
  }

  // Heuristic fallback: update the first element that currently contains "~$"
  function setRingFallback(amount) {
    try {
      var nodes = document.querySelectorAll('*');
      for (var i = 0; i < nodes.length; i++) {
        var t = (nodes[i].textContent || '').trim();
        if (t === '~$--' || t === '~$ --' || t.indexOf('~$') === 0) {
          nodes[i].textContent = '~$' + String(Math.round(num(amount)));
          return;
        }
      }
    } catch (_) {}
  }

  async function fetchAssetsSummary(userId) {
    // Supabase RPC: POST /rest/v1/rpc/get_assets_summary { "p_user": "<uuid>" }
    if (!window.SB_CONFIG) throw new Error('SB_CONFIG missing');
    var SB = window.SB_CONFIG;
    var res = await fetch(SB.url + '/rest/v1/rpc/get_assets_summary', {
      method: 'POST',
      headers: SB.headers(),
      body: JSON.stringify({ p_user: userId })
    });
    if (!res.ok) {
      var err;
      try { err = await res.text(); } catch (_) {}
      throw new Error(err || 'Failed to load assets summary');
    }
    var data = await res.json();
    // PostgREST returns either an object or array depending on config; normalize:
    if (Array.isArray(data)) return data[0] || {};
    return data || {};
  }

  async function update() {
    if (!window.ExaAuth) return;
    var userId = await window.ExaAuth.ensureSupabaseUserId();
    if (!userId) return;

    try {
      var s = await fetchAssetsSummary(userId);

      var usdt = num(s.usdt_balance);
      var totalPersonal = num(s.total_personal);
      var todayPersonal = num(s.today_personal);
      var totalTeam = num(s.total_team);
      var todayTeam = num(s.today_team);

      // Main balance
      setText('.assets-usdt-balance', fmtUSDT(usdt));

      // Incomes (optional, if you add these classes in HTML)
      setText('.total-personal-income', fmtUSDT(totalPersonal));
      setText('.today-personal-income', fmtUSDT(todayPersonal));
      setText('.team-total-income', fmtUSDT(totalTeam));
      setText('.today-team-income', fmtUSDT(todayTeam));

      // Ring center amount (optional)
      var ringEl = document.querySelector('.assets-ring-amount');
      if (ringEl) {
        // Many designs show "~$203" without decimals
        ringEl.textContent = '~$' + String(Math.round(usdt));
      } else {
        // best-effort fallback if you didn't add class
        setRingFallback(usdt);
      }
    } catch (e) {
      // ignore errors to avoid breaking UI
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', update);
  } else {
    update();
  }
})();
