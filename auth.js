// Authentication and user registration module (Supabase + custom users table)
//
// IMPORTANT:
// - This project does NOT use Supabase Auth.
// - There is NO password in the database schema.
// - Login is based on phone existence in `public.users`.
// - Signup requires an invite code (handled by DB trigger) except bootstrap first user.
//
// This script exposes a global `ExaAuth` object used by other pages.

;(function () {
  'use strict';

  var SB = window.SB_CONFIG;
  if (!SB) {
    console.error('SB_CONFIG is not defined. Ensure sb-config.js is loaded before auth.js.');
    return;
  }

  function _safeGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }
  function _safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {}
  }
  function _safeDel(key) {
    try { localStorage.removeItem(key); } catch (_) {}
  }

  /**
   * Normalize phone parts into a single string (no spaces, no plus).
   * Example: prefix "+961", digits "70 123 456" => "96170123456"
   */
  function fullPhone(prefix, digits) {
    var pre = String(prefix || '').replace(/^\+/, '').replace(/\D/g, '');
    var num = String(digits || '').replace(/\D/g, '');
    return pre + num;
  }

  async function fetchUserByPhone(phone) {
    if (!phone) return null;
    var url = SB.url + '/rest/v1/users'
      + '?select=id,phone,invite_code,public_id,created_at'
      + '&phone=eq.' + encodeURIComponent(phone)
      + '&limit=1';
    var res = await fetch(url, { method: 'GET', headers: SB.headers() });
    if (!res.ok) return null;
    var rows = await res.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  async function fetchUserById(userId) {
    if (!userId) return null;
    var url = SB.url + '/rest/v1/users'
      + '?select=id,phone,invite_code,used_invite_code,public_id,created_at,inviter_id'
      + '&id=eq.' + encodeURIComponent(userId)
      + '&limit=1';
    var res = await fetch(url, { method: 'GET', headers: SB.headers() });
    if (!res.ok) return null;
    var rows = await res.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  /**
   * Signup: create a row in `public.users`.
   * DB trigger enforces used_invite_code for all users except the first one.
   *
   * opts:
   *  - areaCode: "+961"
   *  - phoneDigits: "70123456"
   *  - usedInviteCode: inviter's invite code (optional ONLY for first user)
   */
  async function registerWithInvite(opts) {
    opts = opts || {};
    var area = String(opts.areaCode || '').trim();
    var digits = String(opts.phoneDigits || '').trim();
    var usedInviteCode = opts.usedInviteCode != null ? String(opts.usedInviteCode).trim() : '';
    var phone = fullPhone(area, digits);
    if (!phone) throw new Error('Phone is required');

    // Prevent duplicate signup by phone
    var existing = await fetchUserByPhone(phone);
    if (existing && existing.id) {
      // Consider this a "login" and set session
      _safeSet('currentUserId', existing.id);
      _safeSet('currentPhone', existing.phone);
      _safeSet('currentPublicId', String(existing.public_id || ''));
      return {
        id: existing.id,
        phone: existing.phone,
        inviteCode: existing.invite_code,
        publicId: existing.public_id,
        createdAt: existing.created_at
      };
    }

    var payload = { phone: phone };
    if (usedInviteCode) payload.used_invite_code = usedInviteCode;

    var res = await fetch(SB.url + '/rest/v1/users', {
      method: 'POST',
      headers: Object.assign({}, SB.headers(), { 'Prefer': 'return=representation' }),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      var errText = '';
      try { errText = await res.text(); } catch (_) {}
      // DB raises: "Invite code is required" or "Invalid invite code"
      throw new Error(errText || 'Failed to register');
    }

    var data = await res.json();
    if (!Array.isArray(data) || !data.length) throw new Error('Unexpected signup response');

    var user = data[0];
    _safeSet('currentUserId', user.id);
    _safeSet('currentPhone', user.phone);
    _safeSet('currentPublicId', String(user.public_id || ''));

    return {
      id: user.id,
      phone: user.phone,
      inviteCode: user.invite_code,
      publicId: user.public_id,
      createdAt: user.created_at
    };
  }

  /**
   * Login: verify phone exists in DB, then store current user id in localStorage.
   * opts:
   *  - areaCode: "+961"
   *  - phoneDigits: "70123456"
   */
  async function loginWithPhone(opts) {
    opts = opts || {};
    var area = String(opts.areaCode || '').trim();
    var digits = String(opts.phoneDigits || '').trim();
    var phone = fullPhone(area, digits);
    if (!phone) throw new Error('Phone is required');

    var user = await fetchUserByPhone(phone);
    if (!user) throw new Error('Account not found');

    _safeSet('currentUserId', user.id);
    _safeSet('currentPhone', user.phone);
    _safeSet('currentPublicId', String(user.public_id || ''));

    return { id: user.id, phone: user.phone };
  }

  async function ensureSupabaseUserId() {
    return _safeGet('currentUserId') || null;
  }

  async function getCurrentUser() {
    var id = _safeGet('currentUserId') || null;
    if (!id) return null;
    return await fetchUserById(id);
  }

  function logout() {
    _safeDel('currentUserId');
    _safeDel('currentPhone');
    _safeDel('currentPublicId');
  }

  window.ExaAuth = {
    fullPhone: fullPhone,
    registerWithInvite: registerWithInvite,
    loginWithPhone: loginWithPhone,
    ensureSupabaseUserId: ensureSupabaseUserId,
    getCurrentUser: getCurrentUser,
    logout: logout
  };
})();