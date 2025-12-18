// my-team-helper.js - Show funded vs not-funded per generation using RPC get_my_team()
;(function () {
  'use strict';

  function qs(sel, root){ return (root || document).querySelector(sel); }
  function qsa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function fmt2(n){
    var x = Number(n);
    if (!isFinite(x)) x = 0;
    return x.toFixed(2);
  }

  function fmtDate(ts){
    if (!ts) return "-";
    try {
      var d = new Date(ts);
      if (isNaN(d.getTime())) return "-";
      var yyyy = d.getFullYear();
      var mm = String(d.getMonth() + 1).padStart(2,'0');
      var dd = String(d.getDate()).padStart(2,'0');
      var hh = String(d.getHours()).padStart(2,'0');
      var mi = String(d.getMinutes()).padStart(2,'0');
      var ss = String(d.getSeconds()).padStart(2,'0');
      return yyyy + '-' + mm + '-' + dd + ' ' + hh + ':' + mi + ':' + ss;
    } catch(e){ return "-"; }
  }

  function maskPhone(p){
    if (!p) return "-";
    var s = String(p).trim();
    if (s.length <= 6) return s;
    return s.slice(0, 3) + "****" + s.slice(-3);
  }

  function getUserIdFallback(){
    try {
      return (localStorage.getItem('currentUserId') || localStorage.getItem('sb_user_id_v1') || '').trim();
    } catch(e){ return ''; }
  }

  async function getUserId(){
    try {
      if (window.ExaAuth && typeof window.ExaAuth.ensureSupabaseUserId === 'function') {
        var id = await window.ExaAuth.ensureSupabaseUserId();
        return (id || '').trim();
      }
    } catch(e){}
    return getUserIdFallback();
  }

  async function rpc(name, body){
    if (window.DemoWallet && typeof window.DemoWallet.rpc === 'function') {
      return await window.DemoWallet.rpc(name, body || {});
    }
    var SB = window.SB_CONFIG;
    if (!SB) throw new Error('SB_CONFIG missing');
    var res = await fetch(SB.url.replace(/\/$/,'') + '/rest/v1/rpc/' + encodeURIComponent(name), {
      method: 'POST',
      headers: SB.headers(),
      body: JSON.stringify(body || {})
    });
    var text = await res.text();
    var data;
    try { data = text ? JSON.parse(text) : null; } catch(e){ data = text; }
    if (!res.ok) {
      var msg = (data && (data.message || data.error || data.details)) ? (data.message || data.error || data.details) : ('RPC ' + name + ' failed');
      throw new Error(msg);
    }
    return data;
  }

  function setText(sel, txt){
    var el = qs(sel);
    if (el) el.textContent = txt;
  }

  function setSummary(teamEffective, teamTotal, todayTeam, totalTeam){
    var values = qsa('.summary-box .summary-value');
    if (values[0]) values[0].textContent = teamEffective + '/' + teamTotal;
    if (values[1]) values[1].textContent = fmt2(todayTeam) + '/' + fmt2(totalTeam);
  }

  function updateGenCard(idx, effective, total, percent, incomeToday, incomeTotal){
    var cards = qsa('.generation-card');
    var card = cards[idx];
    if (!card) return;
    var spans = qsa('.generation-values span', card);
    if (spans[0]) spans[0].textContent = effective + '/' + total;
    if (spans[1]) spans[1].textContent = String(percent) + '%';
    if (spans[2]) spans[2].textContent = fmt2(incomeToday) + '/' + fmt2(incomeTotal);
  }

  function normalizeLevel(v){
    if (!v) return 'LV.0';
    var s = String(v);
    if (s.toUpperCase().startsWith('V')) return 'LV.' + s.slice(1);
    if (s.toUpperCase().startsWith('LV')) return s;
    return s;
  }

  function renderTable(rowsDepth1){
    var tbody = qs('.team-table tbody');
    if (!tbody) return;
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

    if (!rowsDepth1 || !rowsDepth1.length) {
      var tr = document.createElement('tr');
      ['-','-','-','-'].forEach(function(t){
        var td = document.createElement('td'); td.textContent = t; tr.appendChild(td);
      });
      tbody.appendChild(tr);
      return;
    }

    rowsDepth1.forEach(function(m){
      var tr = document.createElement('tr');

      var phone = maskPhone(m.phone || m.member_phone);
      var pid = (m.public_id != null ? String(m.public_id) : '');
      var shortId = pid || String(m.user_id || m.member_id || m.id || '').slice(0,8) || '-';
      var lvl = normalizeLevel(m.current_level || m.level);
      var funded = (m.is_funded === true) || (String(m.is_funded).toLowerCase() === 'true');

      // Put funded marker without changing style
      var lvlText = lvl + (funded ? ' ✅' : ' ❌');

      [phone, shortId, lvlText, fmtDate(m.created_at || m.member_created_at)].forEach(function(t){
        var td = document.createElement('td');
        td.textContent = t;
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }

  async function load(){
    var uid = await getUserId();
    if (!uid) return;

    // Team rows (depth 1..3) with is_funded/is_activated/current_level
    var team = await rpc('get_my_team', { p_user: uid });
    if (!Array.isArray(team)) team = [];

    // Income summary
    var sum = null;
    try {
      var rows = await rpc('get_assets_summary', { p_user: uid });
      sum = Array.isArray(rows) ? rows[0] : rows;
    } catch(e){}

    var todayTeam = sum ? (sum.today_team || 0) : 0;
    var totalTeam = sum ? (sum.total_team || 0) : 0;

    var byDepth = {1: [], 2: [], 3: []};
    team.forEach(function(r){
      var d = Number(r.depth || r.gen || r.generation || 0);
      if (d === 1 || d === 2 || d === 3) byDepth[d].push(r);
    });

    function countEffective(arr){
      return arr.filter(function(r){
        return (r.is_funded === true) || (String(r.is_funded).toLowerCase() === 'true');
      }).length;
    }

    var t1 = byDepth[1].length, e1 = countEffective(byDepth[1]);
    var t2 = byDepth[2].length, e2 = countEffective(byDepth[2]);
    var t3 = byDepth[3].length, e3 = countEffective(byDepth[3]);

    var totalAll = t1 + t2 + t3;
    var effectiveAll = e1 + e2 + e3;

    setSummary(effectiveAll, totalAll, todayTeam, totalTeam);

    // Percentages fixed per your system
    updateGenCard(0, e1, t1, 20, todayTeam, totalTeam);
    updateGenCard(1, e2, t2, 5, 0, 0);
    updateGenCard(2, e3, t3, 3, 0, 0);

    // Table shows Generation 1 list by default
    renderTable(byDepth[1]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ load().catch(function(e){ try{console.error(e);}catch(_){} }); });
  } else {
    load().catch(function(e){ try{console.error(e);}catch(_){} });
  }
})();
