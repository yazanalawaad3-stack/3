// Authentication and user registration module
//
// This script defines a global `ExaAuth` object that provides methods
// for registering new users and logging existing users in using the
// Supabase REST API.
//
// IMPORTANT (per your system):
// - No UI/style changes.
// - No server-side auth; this is a lightweight "demo auth" that stores the
//   current user id in localStorage so pages can load the right data.

;(function () {
  'use strict';

  var SB = window.SB_CONFIG;
  if (!SB) {
    console.error('SB_CONFIG is not defined. Ensure sb-config.js is loaded before auth.js.');
    return;
  }

  // ----------------------------
  // Helpers
  // ----------------------------

  function cleanDigits(s) {
    return String(s || '').replace(/\D/g, '');
  }

  /**
   * Normalize a phone number by concatenating the area code prefix and the digits.
   * Leading plus signs in the prefix are removed.
   *
   * @param {string} prefix The international dialing code, e.g. "+961"
   * @param {string} digits The phone number digits, e.g. "70123456"
   * @returns {string} The full phone number (e.g. "96170123456")
   */
  function fullPhone(prefix, digits) {
    var pre = String(prefix || '').replace(/^\+/, '');
    var num = cleanDigits(digits);
    // If the user already typed the full number including country code, keep it.
    // Example: prefix "+386" and digits "38670123456" => "38670123456"
    if (num && pre && num.indexOf(pre) === 0) return num;
    return pre + num;
  }

  function firstMatch(selList, root) {
    root = root || document;
    for (var i = 0; i < selList.length; i++) {
      try {
        var el = root.querySelector(selList[i]);
        if (el) return el;
      } catch (e) {}
    }
    return null;
  }

  /**
   * Try to read phone prefix + phone digits from the current page without
   * relying on fixed IDs (because your HTML might use different selectors).
   *
   * @returns {{prefix:string, digits:string, full:string}}
   */
  function readPhoneFromPage() {
    var prefixEl = firstMatch([
      'select[name*="code"]',
      'select[name*="country"]',
      'select[id*="code"]',
      'select[id*="country"]',
      'select'
    ]);

    // Prefer explicit phone inputs
    var phoneEl =
      firstMatch([
        'input[type="tel"]',
        'input[name="phone"]',
        'input[name*="phone"]',
        'input[id="phone"]',
        'input[id*="phone"]',
        '.phone-wrapper input'
      ]) || null;

    // If not found, pick the first non-password text-like input (but not invite/verification)
    if (!phoneEl) {
      var inputs = Array.prototype.slice.call(document.querySelectorAll('input'));
      for (var i = 0; i < inputs.length; i++) {
        var inp = inputs[i];
        var t = (inp.getAttribute('type') || 'text').toLowerCase();
        if (t === 'password' || t === 'hidden') continue;
        var key = ((inp.getAttribute('name') || '') + ' ' + (inp.id || '') + ' ' + (inp.className || '')).toLowerCase();
        if (key.indexOf('invite') !== -1) continue;
        if (key.indexOf('verify') !== -1) continue;
        if (key.indexOf('code') !== -1) continue;
        phoneEl = inp;
        break;
      }
    }

    var prefix = prefixEl ? String(prefixEl.value || '').trim() : '';
    var digits = phoneEl ? String(phoneEl.value || '').trim() : '';
    return { prefix: prefix, digits: digits, full: fullPhone(prefix, digits) };
  }

  function readInviteFromPage() {
    var el = firstMatch([
      'input[name*="invite"]',
      'input[id*="invite"]',
      'input[placeholder*="Invite"]',
      'input[placeholder*="Invitation"]'
    ]);
    return el ? String(el.value || '').trim() : '';
  }

  async function fetchUserByPhone(phone) {
    if (!phone) return null;
    var url =
      SB.url +
      '/rest/v1/users?select=id,phone,invite_code,public_id,created_at&phone=eq.' +
      encodeURIComponent(phone) +
      '&limit=1';
    var res = await fetch(url, { method: 'GET', headers: SB.headers() });
    if (!res.ok) return null;
    var rows = await res.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  async function fetchUserById(id) {
    if (!id) return null;
    var url =
      SB.url +
      '/rest/v1/users?select=id,phone,invite_code,public_id,created_at&' +
      'id=eq.' +
      encodeURIComponent(id) +
      '&limit=1';
    var res = await fetch(url, { method: 'GET', headers: SB.headers() });
    if (!res.ok) return null;
    var rows = await res.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  // ----------------------------
  // Public API
  // ----------------------------

  /**
   * Register a new user using an invitation code.
   *
   * IMPORTANT: Your signup page has country-code select + phone input.
   * If the caller doesn't pass `opts.phone`, we auto-read from the page.
   *
   * @param {{phone?:string, usedInviteCode?:string, prefix?:string, digits?:string}} opts
   * @returns {Promise<{id:string, phone:string, inviteCode:string, publicId:number, createdAt:string}>}
   */
  async function registerWithInvite(opts) {
    opts = opts || {};
    var usedInviteCode =
      (opts.usedInviteCode != null ? String(opts.usedInviteCode) : String(readInviteFromPage() || '')).trim() || null;

    var phone = (opts.phone != null ? String(opts.phone) : '').trim();
    if (!phone) {
      // Try from prefix+digits
      var p = opts.prefix != null ? String(opts.prefix) : null;
      var d = opts.digits != null ? String(opts.digits) : null;
      if (p != null || d != null) phone = fullPhone(p || '', d || '');
      if (!phone) phone = readPhoneFromPage().full;
    }

    if (!phone) throw new Error('Phone is required');

    // Prepare payload; omit used_invite_code if blank so that the DB trigger can
    // handle the "first user" bootstrap case.
    var payload = { phone: phone };
    if (usedInviteCode) payload.used_invite_code = usedInviteCode;

    var res = await fetch(SB.url + '/rest/v1/users', {
      method: 'POST',
      headers: Object.assign({}, SB.headers(), { Prefer: 'return=representation' }),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      var errText = '';
      try {
        errText = await res.text();
      } catch (e) {}
      // Make the message cleaner for toast/alert
      throw new Error(errText || 'Failed to register');
    }

    var data = await res.json();
    if (!Array.isArray(data) || !data.length) throw new Error('Unexpected signup response');
    var user = data[0];

    try {
      localStorage.setItem('currentUserId', user.id);
      localStorage.setItem('currentPhone', user.phone);
    
      // Compatibility key for older pages
      localStorage.setItem('sb_user_id_v1', user.id);
} catch (e) {}

    return {
      id: user.id,
      phone: user.phone,
      inviteCode: user.invite_code,
      publicId: user.public_id,
      createdAt: user.created_at
    };
  }

  /**
   * Log in an existing user by phone number ONLY.
   * (No passwords; your database schema doesn't store passwords.)
   *
   * @param {{phone?:string, prefix?:string, digits?:string}} opts
   * @returns {Promise<{id:string, phone:string}>}
   */
  async function loginWithPhone(opts) {
    opts = opts || {};
    var phone = (opts.phone != null ? String(opts.phone) : '').trim();
    if (!phone) {
      var p = opts.prefix != null ? String(opts.prefix) : null;
      var d = opts.digits != null ? String(opts.digits) : null;
      if (p != null || d != null) phone = fullPhone(p || '', d || '');
      if (!phone) phone = readPhoneFromPage().full;
    }
    if (!phone) throw new Error('Phone is required');

    var user = await fetchUserByPhone(phone);
    if (!user) throw new Error('Account not found');

    try {
      localStorage.setItem('currentUserId', user.id);
      localStorage.setItem('currentPhone', user.phone);
    
      // Compatibility key for older pages
      localStorage.setItem('sb_user_id_v1', user.id);
} catch (e) {}

    return { id: user.id, phone: user.phone };
  }

  async function ensureSupabaseUserId() {
    var id = null;
    try {
      id = localStorage.getItem('currentUserId') || localStorage.getItem('sb_user_id_v1') || null;
    } catch (e) {}
    return id;
  }

  function logout() {
    try {
      localStorage.removeItem('currentUserId');
      localStorage.removeItem('currentPhone');
    
      localStorage.removeItem('sb_user_id_v1');
} catch (e) {}
  }

  // Convenience: ensure we can restore a full profile when needed
  async function getCurrentUserProfile() {
    var id = await ensureSupabaseUserId();
    if (!id) return null;
    var row = await fetchUserById(id);
    if (!row) return null;
    return {
      id: row.id,
      phone: row.phone,
      inviteCode: row.invite_code,
      publicId: row.public_id,
      createdAt: row.created_at
    };
  }

  window.ExaAuth = {
    fullPhone: fullPhone,
    readPhoneFromPage: readPhoneFromPage,
    registerWithInvite: registerWithInvite,
    loginWithPhone: loginWithPhone,
    ensureSupabaseUserId: ensureSupabaseUserId,
    getCurrentUserProfile: getCurrentUserProfile,
    logout: logout
  };
})();