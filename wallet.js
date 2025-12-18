// wallet.js - Supabase-backed wallet + membership helpers (no UI / no styling changes)
//
// Exposes: window.DemoWallet
// Depends on: sb-config.js (window.SB_CONFIG)

;(function () {
  'use strict';
  var SB = window.SB_CONFIG;
  if (!SB) {
    console.error('SB_CONFIG is not defined. Ensure sb-config.js is loaded before wallet.js.');
    return;
  }

  function safeJson(res){
    return res.json().catch(function(){ return null; });
  }

  function getCurrentUserId(){
    try { return localStorage.getItem('currentUserId') || null; } catch (e) { return null; }
  }

  async function rpc(fnName, args){
    var url = SB.url + '/rest/v1/rpc/' + fnName;
    var res = await fetch(url, {
      method: 'POST',
      headers: SB.headers(),
      body: JSON.stringify(args || {})
    });
    if (!res.ok) {
      var payload = await safeJson(res);
      var msg = (payload && (payload.message || payload.error)) || ('RPC ' + fnName + ' failed');
      var err = new Error(msg);
      err.status = res.status;
      err.payload = payload;
      throw err;
    }
    return await safeJson(res);
  }

  var __walletCache = { balance: 0, reserved: 0 };
  var __lastSyncAt = 0;

  async function refreshWallet(){
    var userId = getCurrentUserId();
    if (!userId) return __walletCache;
    var url = SB.url + '/rest/v1/wallet_balances?select=usdt_balance&user_id=eq.' + encodeURIComponent(userId) + '&limit=1';
    var res = await fetch(url, { method: 'GET', headers: SB.headers() });
    if (res.ok){
      var rows = await safeJson(res);
      var row = (Array.isArray(rows) && rows[0]) ? rows[0] : null;
      __walletCache.balance = row ? Number(row.usdt_balance || 0) : 0;
      __lastSyncAt = Date.now();
    }
    return __walletCache;
  }

  async function getWalletAsync(){
    if (Date.now() - __lastSyncAt > 1500) {
      try { await refreshWallet(); } catch (e) {}
    }
    return { balance: Number(__walletCache.balance || 0), reserved: Number(__walletCache.reserved || 0) };
  }

  async function getUserState(){
    var userId = getCurrentUserId();
    if (!userId) return null;
    var url = SB.url + '/rest/v1/user_state?select=current_level,is_activated,is_funded,is_locked,locked_reason&user_id=eq.' + encodeURIComponent(userId) + '&limit=1';
    var res = await fetch(url, { method: 'GET', headers: SB.headers() });
    if (!res.ok) return null;
    var rows = await safeJson(res);
    return (Array.isArray(rows) && rows[0]) ? rows[0] : null;
  }

  async function getAssetsSummary(){
    var userId = getCurrentUserId();
    if (!userId) return null;
    var rows = await rpc('get_assets_summary', { p_user: userId });
    var row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return null;
    return {
      usdt_balance: Number(row.usdt_balance || 0),
      total_personal: Number(row.total_personal || 0),
      today_personal: Number(row.today_personal || 0),
      total_team: Number(row.total_team || 0),
      today_team: Number(row.today_team || 0)
    };
  }

  async function getDirectFundedCount(){
    var userId = getCurrentUserId();
    if (!userId) return 0;
    var n = await rpc('get_direct_funded_count', { p_user: userId });
    return Number(n || 0);
  }

  async function getMyTeam(){
    var userId = getCurrentUserId();
    if (!userId) return [];
    var rows = await rpc('get_my_team', { p_ancestor: userId });
    return Array.isArray(rows) ? rows : [];
  }

  async function getTeamSummary(){
    var rows = await getMyTeam();
    var members = rows.map(function(r){
      return {
        depth: Number(r.depth || 0),
        public_id: r.public_id,
        phone: r.phone,
        created_at: r.created_at,
        usdt_balance: Number(r.usdt_balance || 0),
        is_funded: !!r.is_funded,
        is_activated: !!r.is_activated
      };
    });
    var total = members.length;
    var funded = members.filter(function(m){ return m.is_funded; }).length;
    var byDepth = { 1:0, 2:0, 3:0 };
    members.forEach(function(m){ if (byDepth[m.depth] != null) byDepth[m.depth] += 1; });
    return { totalMembers: total, fundedMembers: funded, byDepth: byDepth, members: members };
  }

  async function getVipInfo(){
    var state = await getUserState();
    var bal = await getWalletAsync();
    var directFunded = await getDirectFundedCount();

    var rulesByLevel = {
      'V1': { minBalance: 50, minUsers: 0 },
      'V2': { minBalance: 500, minUsers: 5 },
      'V3': { minBalance: 3000, minUsers: 10 }
    };

    var order = ['V0','V1','V2','V3'];
    var curr = (state && state.current_level) ? state.current_level : 'V0';
    var idx = order.indexOf(curr);
    var next = (idx >= 0 && idx < order.length - 1) ? order[idx+1] : null;

    return {
      currentLevel: curr,
      nextLevel: next,
      isActivated: !!(state && state.is_activated),
      isFunded: !!(state && state.is_funded),
      isLocked: !!(state && state.is_locked),
      lockedReason: (state && state.locked_reason) ? String(state.locked_reason) : null,
      balance: Number(bal.balance || 0),
      effectiveUsers: Number(directFunded || 0),
      rulesByLevel: rulesByLevel
    };
  }

  async function performIpowerAction(){
    var userId = getCurrentUserId();
    if (!userId) throw new Error('Not logged in');
    var rows = await rpc('perform_ipower_action', { p_user: userId });
    var row = Array.isArray(rows) ? rows[0] : rows;
    if (row && row.new_balance != null) {
      __walletCache.balance = Number(row.new_balance || 0);
      __lastSyncAt = Date.now();
    }
    return row;
  }

  try { refreshWallet(); } catch (e) {}

  window.DemoWallet = {
    refreshWallet: refreshWallet,
    getWalletAsync: getWalletAsync,
    getUserState: getUserState,
    getAssetsSummary: getAssetsSummary,
    getDirectFundedCount: getDirectFundedCount,
    getMyTeam: getMyTeam,
    getTeamSummary: getTeamSummary,
    getVipInfo: getVipInfo,
    performIpowerAction: performIpowerAction
  };
})();
