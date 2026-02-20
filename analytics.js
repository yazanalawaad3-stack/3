(() => {
  const qs = (s, el=document) => el.querySelector(s);
  const qsa = (s, el=document) => [...el.querySelectorAll(s)];

  const toastEl = qs('#luxToast');
  const toastText = qs('#toastText');
  let toastTimer = null;

  function toast(msg){
    if(!toastEl || !toastText) return;
    toastText.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1400);
  }

  async function safeCopy(text){
    try{
      await navigator.clipboard.writeText(String(text));
      return true;
    }catch{
      try{
        const ta = document.createElement('textarea');
        ta.value = String(text);
        ta.setAttribute('readonly','');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return !!ok;
      }catch{
        return false;
      }
    }
  }

  // --- Date helpers ---
  function pad2(n){ return String(n).padStart(2,'0'); }
  function toISODate(d){
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  }
  function prettyDate(iso){
    // iso: YYYY-MM-DD
    const [y,m,d] = iso.split('-').map(Number);
    const dt = new Date(y, (m-1), d);
    return dt.toLocaleDateString(undefined, {weekday:'short', year:'numeric', month:'short', day:'numeric'});
  }
  function prettyTime(hhmm){
    return hhmm;
  }

  // --- Demo data (prepared for future real API) ---
  // Data shape ready for backend:
  // { id, date:"YYYY-MM-DD", time:"HH:MM", type, title, amount, currency, status }
  const TYPES = [
    {key:'deposit', icon:'fa-arrow-down', label:'Deposit'},
    {key:'withdraw', icon:'fa-arrow-up', label:'Withdraw'},
    {key:'trade', icon:'fa-right-left', label:'Trade'},
    {key:'network', icon:'fa-users', label:'Network'},
    {key:'system', icon:'fa-shield-halved', label:'System'}
  ];

  // Small deterministic pseudo-random so demo looks stable between refreshes.
  let seed = 1337;
  function rand(){
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }
  function pick(arr){ return arr[Math.floor(rand()*arr.length)]; }

  const demoEvents = [];
  const today = new Date();
  const dayCount = 10;

  for(let i=0;i<dayCount;i++){
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = toISODate(d);

    const n = i === 0 ? 8 : Math.max(2, Math.floor(rand()*9));
    for(let k=0;k<n;k++){
      const t = pick(TYPES);
      const hh = pad2(7 + Math.floor(rand()*14)); // 07-20
      const mm = pad2(Math.floor(rand()*60));
      const amount = (10 + rand()*1500) * (t.key === 'withdraw' ? -1 : 1);
      const status = rand() > 0.12 ? 'success' : 'pending';

      demoEvents.push({
        id: `${iso}-${hh}${mm}-${k}`,
        date: iso,
        time: `${hh}:${mm}`,
        type: t.key,
        title: t.label,
        amount: Math.abs(amount),
        currency: 'USDT',
        direction: amount >= 0 ? 'in' : 'out',
        status
      });
    }
  }

  // Sort newest first
  demoEvents.sort((a,b) => {
    if(a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.time < b.time ? 1 : -1;
  });

  // --- UI wiring ---
  const dateInput = qs('#dateInput');
  const dateChipBtn = qs('#dateChipBtn');
  const selectedDateText = qs('#selectedDateText');
  const todayBtn = qs('#todayBtn');
  const refreshBtn = qs('#refreshBtn');

  const listEl = qs('#logList');
  const emptyState = qs('#emptyState');
  const countText = qs('#countText');
  const updatedAt = qs('#updatedAt');
  const liveText = qs('#liveText');

  const copyBtn = qs('#copyUserIdBtn');
  const userIdValue = qs('#userIdValue');

  if(copyBtn && userIdValue){
    copyBtn.addEventListener('click', async () => {
      const ok = await safeCopy(userIdValue.textContent.trim());
      toast(ok ? 'ID copied' : 'Copy failed');
    });
  }

  let selectedISO = toISODate(today);

  function setUpdatedNow(){
    const now = new Date();
    updatedAt.textContent = now.toLocaleTimeString(undefined, {hour:'2-digit', minute:'2-digit'});
  }

  function render(){
    const items = demoEvents.filter(e => e.date === selectedISO);

    if(selectedISO === toISODate(new Date())){
      selectedDateText.textContent = 'Today';
      if(liveText) liveText.textContent = 'Updated for today';
    }else{
      selectedDateText.textContent = prettyDate(selectedISO);
      if(liveText) liveText.textContent = 'Showing selected date';
    }

    if(countText) countText.textContent = String(items.length);

    if(!listEl) return;
    listEl.innerHTML = '';

    if(items.length === 0){
      emptyState.hidden = false;
      return;
    }
    emptyState.hidden = true;

    const frag = document.createDocumentFragment();

    items.forEach(ev => {
      const typeMeta = TYPES.find(t => t.key === ev.type) || TYPES[0];
      const row = document.createElement('div');
      row.className = 'lux-log-card';

      const dirClass = ev.direction === 'in' ? 'good' : 'bad';
      const sign = ev.direction === 'in' ? '+' : '-';
      const statusClass = ev.status === 'success' ? 'ok' : 'pending';
      const statusLabel = ev.status === 'success' ? 'Success' : 'Pending';

      row.innerHTML = `
        <div class="lux-log-ic">
          <i class="fa-solid ${typeMeta.icon}" aria-hidden="true"></i>
        </div>

        <div class="lux-log-mid">
          <div class="lux-log-top">
            <div class="lux-log-title">${typeMeta.label}</div>
            <div class="lux-log-time">${prettyTime(ev.time)}</div>
          </div>

          <div class="lux-log-sub">
            <span class="lux-log-status ${statusClass}">${statusLabel}</span>
            <span class="lux-log-dot" aria-hidden="true">•</span>
            <span class="lux-log-id">#${ev.id.slice(-6)}</span>
          </div>
        </div>

        <div class="lux-log-right">
          <div class="lux-log-amt ${dirClass}">${sign}${ev.amount.toFixed(2)} <span class="lux-log-cur">${ev.currency}</span></div>
        </div>
      `;
      frag.appendChild(row);
    });

    listEl.appendChild(frag);
  }

  function openNativeDate(){
    if(!dateInput) return;
    dateInput.value = selectedISO;
    // In some browsers showPicker is supported
    if(typeof dateInput.showPicker === 'function'){
      dateInput.showPicker();
    }else{
      dateInput.focus();
      dateInput.click();
    }
  }

  function setDate(iso){
    selectedISO = iso;
    setUpdatedNow();
    render();
  }

  if(dateChipBtn){
    dateChipBtn.addEventListener('click', openNativeDate);
  }
  if(dateInput){
    dateInput.addEventListener('change', (e) => {
      const iso = e.target.value;
      if(iso) setDate(iso);
    });
  }

  if(todayBtn){
    todayBtn.addEventListener('click', () => {
      setDate(toISODate(new Date()));
      toast('Today');
    });
  }

  if(refreshBtn){
    refreshBtn.addEventListener('click', () => {
      // Placeholder: in the future this will re-fetch from server.
      setUpdatedNow();
      toast('Refreshed');
      render();
    });
  }

  // initial
  setUpdatedNow();
  render();
})();