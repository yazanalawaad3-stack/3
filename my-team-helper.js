// my-team-helper.js - binds my-team.html to Supabase via DemoWallet (no styling changes)
;(function(){
  'use strict';
  function qs(sel, root){ return (root || document).querySelector(sel); }
  function qsa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function maskPhone(p){
    if (!p) return '-';
    var s = String(p);
    if (s.length <= 4) return s;
    return s.slice(0,2) + '****' + s.slice(-2);
  }
  function fmtDate(ts){
    if (!ts) return '-';
    try {
      var d = new Date(ts);
      if (isNaN(d.getTime())) return String(ts);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString().slice(0,5);
    } catch (e) { return String(ts); }
  }

  async function load(){
    if (!window.DemoWallet) return;

    // Income summary cards on this page (same labels as dashboard)
    try {
      var sum = await window.DemoWallet.getAssetsSummary();
      if (sum) {
        var vals = qsa('.summary-card .summary-value');
        if (vals[0]) vals[0].textContent = (Number(sum.total_personal||0)).toFixed(2) + ' USDT';
        if (vals[1]) vals[1].textContent = (Number(sum.total_team||0)).toFixed(2) + ' USDT';
        if (vals[2]) vals[2].textContent = (Number(sum.today_personal||0)).toFixed(2) + ' USDT';
        if (vals[3]) vals[3].textContent = (Number(sum.today_team||0)).toFixed(2) + ' USDT';
      }
    } catch (e) {}

    var team = null;
    try { team = await window.DemoWallet.getTeamSummary(); } catch (e) { team = null; }
    if (!team) team = { members: [], byDepth: {1:0,2:0,3:0}, totalMembers: 0, fundedMembers: 0 };

    // Generation cards
    var cards = qsa('.generation-card');
    function renderGen(i, total){
      var card = cards[i];
      if (!card) return;
      var row = card.querySelector('.generation-values');
      if (!row) return;
      var spans = row.querySelectorAll('span');
      if (spans.length >= 1) spans[0].textContent = total + '/' + total;
      if (spans.length >= 2) spans[1].textContent = '0%';
      if (spans.length >= 3) spans[2].textContent = '0/0';
    }
    renderGen(0, team.byDepth[1] || 0);
    renderGen(1, team.byDepth[2] || 0);
    renderGen(2, team.byDepth[3] || 0);

    // Table = Gen 1 members
    var tbody = qs('tbody');
    if (tbody) {
      var gen1 = (team.members || []).filter(function(m){ return Number(m.depth||0) === 1; });
      if (gen1.length) {
        tbody.innerHTML = '';
        gen1.forEach(function(m){
          var tr = document.createElement('tr');
          tr.innerHTML = ''
            + '<td>' + (m.public_id != null ? m.public_id : '-') + '</td>'
            + '<td>' + maskPhone(m.phone) + '</td>'
            + '<td>' + (m.is_funded ? 'Active' : 'Inactive') + '</td>'
            + '<td>' + (m.depth ? ('LV.' + m.depth) : '-') + '</td>'
            + '<td>' + fmtDate(m.created_at) + '</td>'
            + '<td>0.00</td>'
            + '<td>0.00</td>';
          tbody.appendChild(tr);
        });
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();