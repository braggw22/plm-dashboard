// PLM Dashboard — Phase 3 Final Build (no frameworks, Edge-friendly)
/* eslint-disable no-console */
(function(){
  'use strict';

  // ---------- Utilities ----------
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  function toast(msg){
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(()=>{ t.remove(); }, 2200);
  }

  // ---------- DateService ----------
  const DateService = (() => {
    function pad(n){ return (n<10?'0':'') + n; }
    function toLocalISO(d){
      const tzOffset = d.getTimezoneOffset();
      const local = new Date(d.getTime() - tzOffset * 60000);
      return local.toISOString().slice(0,19);
    }
    function isWeekend(d){
      const day = d.getDay();
      return day === 0 || day === 6;
    }
    function nextBusinessDay(d){
      const r = new Date(d);
      while(isWeekend(r)){ r.setDate(r.getDate()+1); }
      return r;
    }
    // ISO week number
    function getISOWeek(d){
      const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const dayNum = date.getUTCDay() || 7;
      date.setUTCDate(date.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
      return Math.ceil((((date - yearStart) / 86400000) + 1)/7);
    }
    function friendly(d=new Date()){
      const week = getISOWeek(d);
      const opts = { weekday:'short', month:'short', day:'numeric', year:'numeric' };
      return { text: d.toLocaleDateString(undefined, opts), week, weekend:isWeekend(d) };
    }
    return { pad, toLocalISO, isWeekend, nextBusinessDay, getISOWeek, friendly };
  })();

  // ---------- IndexedDB Helper ----------
  const DB = (() => {
    const DB_NAME = 'plm_dashboard_v3';
    const DB_VER = 1;
    const STORES = ['tasks','rfis','risks','tfrs','tagups','settings'];

    let db;
    function open(){
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VER);
        req.onupgradeneeded = (e) => {
          const _db = e.target.result;
          STORES.forEach(s => { if(!_db.objectStoreNames.contains(s)){ _db.createObjectStore(s, { keyPath:'id', autoIncrement:true }); } });
        };
        req.onsuccess = () => { db = req.result; resolve(db); };
        req.onerror = () => reject(req.error);
      });
    }
    function tx(store, mode='readonly'){
      return db.transaction(store, mode).objectStore(store);
    }
    function getAll(store){
      return new Promise((resolve,reject)=>{
        const r = tx(store).getAll(); r.onsuccess=()=>resolve(r.result||[]); r.onerror=()=>reject(r.error);
      });
    }
    function put(store, value){
      return new Promise((resolve,reject)=>{
        const r = tx(store,'readwrite').put(value); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);
      });
    }
    function del(store, id){
      return new Promise((resolve,reject)=>{
        const r = tx(store,'readwrite')["delete"](id); r.onsuccess=()=>resolve(); r.onerror=()=>reject(r.error);
      });
    }
    async function clear(store){
      return new Promise((resolve,reject)=>{
        const r = tx(store,'readwrite').clear(); r.onsuccess=()=>resolve(); r.onerror=()=>reject(r.error);
      });
    }
    return { open, getAll, put, del, clear };
  })();

  // ---------- State ----------
  const State = {
    currentRoute: '',
    caches: {
      tasks: [], rfis: [], risks: [], tfrs: [], tagups: [], settings: []
    }
  };

  // ---------- Rendering helpers ----------
  function setActiveNav(hash){
    $$('.topnav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === hash));
  }
  function renderFooter(){
    const f = DateService.friendly(new Date());
    $('#footerWeek').textContent = f.week;
    $('#footerDate').textContent = f.text + (f.weekend ? ' (Weekend)' : '');
  }

  function inputRow(label, html){
    return `<div class="row"><div><label>${label}</label>${html}</div></div>`;
  }
  function input(label, id, type='text', placeholder=''){
    return `<label for="${id}">${label}</label><input id="${id}" type="${type}" class="input" placeholder="${placeholder}">`;
  }
  function textarea(label, id, rows=3, placeholder=''){
    return `<label for="${id}">${label}</label><textarea id="${id}" rows="${rows}" class="input" placeholder="${placeholder}"></textarea>`;
  }
  function select(label, id, options){
    const opts = options.map(o => `<option value="${o}">${o}</option>`).join('');
    return `<label for="${id}">${label}</label><select id="${id}" class="input">${opts}</select>`;
  }
  function table(headers, rows){
    const th = headers.map(h=>`<th>${h}</th>`).join('');
    const tr = rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('');
    return `<table class="table"><thead><tr>${th}</tr></thead><tbody>${tr||''}</tbody></table>`;
  }
  function card(title, body, extra=''){
    return `<section class="card"><h3>${title}</h3>${extra}${body}</section>`;
  }

  // ---------- Feature: Settings (Theme) ----------
  function applyTheme(theme){
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('plm_theme', theme); } catch(_) {}
  }
  function loadTheme(){
    let t = 'light';
    try { t = localStorage.getItem('plm_theme') || 'light'; } catch(_) {}
    applyTheme(t);
    const btn = $('#modeToggle');
    if(btn){ btn.textContent = t === 'dark' ? '☀' : '☾'; }
  }

  // ---------- CRUD UIs ----------
  function renderDashboard(){
    const wrap = document.createElement('div');
    wrap.className = 'container grid cols-2';
    const kpi = (label, value) => `<div class="kpi"><div class="label">${label}</div><div class="value">${value}</div></div>`;

    const openTasks = State.caches.tasks.filter(t=>!t.done).length;
    const overdue = State.caches.tasks.filter(t=>!t.done && new Date(t.due) < new Date()).length;
    const openRFIs = State.caches.rfis.filter(r=>r.status!=='Closed').length;
    const openRisks = State.caches.risks.filter(r=>r.status!=='Closed').length;

    const kpis = `<div class="kpis">
      ${kpi('Open Tasks', openTasks)}
      ${kpi('Overdue Tasks', overdue)}
      ${kpi('Open RFIs', openRFIs)}
      ${kpi('Open Risks', openRisks)}
    </div>`;

    const recentTasks = State.caches.tasks.slice(-5).reverse()
      .map(t=>`<li><strong>${t.title}</strong> — <span class="small">${t.owner||'Unassigned'} • due ${t.due?.slice(0,10)||'—'}</span></li>`).join('') || '<li>No tasks yet.</li>';
    const recentRFIs = State.caches.rfis.slice(-5).reverse()
      .map(r=>`<li><strong>${r.title}</strong> — <span class="small">#${r.number||'—'} • ${r.status||'Open'}</span></li>`).join('') || '<li>No RFIs yet.</li>';

    wrap.innerHTML = `
      ${card('At‑a‑Glance', kpis)}
      ${card('Recent Tasks', `<ul class="clean">${recentTasks}</ul>`)}
      ${card('Recent RFIs', `<ul class="clean">${recentRFIs}</ul>`)}
    `;
    $('#app').innerHTML = '';
    $('#app').appendChild(wrap);
  }

  function renderTasks(){
    const wrap = document.createElement('div');
    wrap.className = 'container grid cols-1';

    const form = document.createElement('div');
    form.className = 'card';
    form.innerHTML = `
      <h3>New Task</h3>
      <div class="row">
        <div>${input('Title','task_title')}</div>
        <div>${input('Owner','task_owner')}</div>
      </div>
      <div class="row">
        <div>${input('Due Date','task_due','date')}</div>
        <div>${select('Priority','task_priority',['Low','Medium','High'])}</div>
      </div>
      ${textarea('Notes','task_notes',3)}
      <div class="actions">
        <button id="addTask" class="btn primary">Add Task</button>
        <button id="clearDone" class="btn danger">Clear Completed</button>
      </div>
    `;

    const rows = State.caches.tasks
      .sort((a,b)=> (a.done - b.done) || String(a.due).localeCompare(String(b.due)))
      .map(t=>[
        `<span class="checkbox"><input type="checkbox" data-id="${t.id}" class="task-toggle" ${t.done?'checked':''}><span>${t.title}</span></span>`,
        t.owner||'—',
        (t.due||'').slice(0,10) || '—',
        `<span class="chip ${t.priority==='High'?'danger':t.priority==='Medium'?'warn':'ok'}">${t.priority||'Low'}</span>`,
        `<button class="btn" data-del="${t.id}">Delete</button>`
      ]);
    const list = document.createElement('div');
    list.className = 'card';
    list.innerHTML = `<h3>Tasks</h3>${table(['Task','Owner','Due','Priority',''], rows)}`;

    wrap.appendChild(form);
    wrap.appendChild(list);
    $('#app').innerHTML='';
    $('#app').appendChild(wrap);

    $('#addTask').onclick = async () => {
      const t = {
        title: $('#task_title').value.trim(),
        owner: $('#task_owner').value.trim(),
        due: $('#task_due').value || null,
        priority: $('#task_priority').value,
        notes: $('#task_notes').value.trim(),
        done: false,
        createdAt: DateService.toLocalISO(new Date())
      };
      if(!t.title){ toast('Title is required'); return; }
      await DB.put('tasks', t);
      await refreshCaches();
      toast('Task added');
      routeTo('#/tasks');
    };
    $('#clearDone').onclick = async () => {
      for(const t of State.caches.tasks){ if(t.done) await DB.del('tasks', t.id); }
      await refreshCaches(); routeTo('#/tasks');
    };
    $$('.task-toggle').forEach(cb => {
      cb.addEventListener('change', async (e)=>{
        const id = Number(e.target.getAttribute('data-id'));
        const t = State.caches.tasks.find(x=>x.id===id);
        if(t){ t.done = e.target.checked; await DB.put('tasks', t); await refreshCaches(); renderFooter(); }
      });
    });
    $$('button[data-del]').forEach(btn => {
      btn.onclick = async () => {
        await DB.del('tasks', Number(btn.getAttribute('data-del')));
        await refreshCaches(); routeTo('#/tasks');
      };
    });
  }

  function renderRFIs(){
    const wrap = document.createElement('div');
    wrap.className = 'container grid cols-1';

    const form = document.createElement('div');
    form.className = 'card';
    form.innerHTML = `
      <h3>New RFI</h3>
      <div class="row">
        <div>${input('RFI #','rfi_num','text','e.g., 001')}</div>
        <div>${input('Title','rfi_title')}</div>
      </div>
      <div class="row">
        <div>${select('Status','rfi_status',['Open','Pending Govt','Pending Sub','Closed'])}</div>
        <div>${input('Owner','rfi_owner')}</div>
      </div>
      ${textarea('Question / Notes','rfi_notes',3)}
      <div class="actions"><button id="addRFI" class="btn primary">Add RFI</button></div>
    `;

    const rows = State.caches.rfis.slice().reverse().map(r=>[
      r.number||'—',
      r.title||'—',
      r.owner||'—',
      `<span class="chip ${r.status==='Closed'?'ok':r.status.startsWith('Pending')?'warn':'danger'}">${r.status||'Open'}</span>`,
      `<button class="btn" data-del="${r.id}">Delete</button>`
    ]);
    const list = document.createElement('div');
    list.className = 'card';
    list.innerHTML = `<h3>RFIs</h3>${table(['#','Title','Owner','Status',''], rows)}`;

    wrap.appendChild(form); wrap.appendChild(list);
    $('#app').innerHTML=''; $('#app').appendChild(wrap);

    $('#addRFI').onclick = async () => {
      const r = {
        number: $('#rfi_num').value.trim(),
        title: $('#rfi_title').value.trim(),
        status: $('#rfi_status').value,
        owner: $('#rfi_owner').value.trim(),
        notes: $('#rfi_notes').value.trim(),
        createdAt: DateService.toLocalISO(new Date())
      };
      if(!r.title){ toast('Title is required'); return; }
      await DB.put('rfis', r); await refreshCaches(); routeTo('#/rfis');
    };
    $$('button[data-del]').forEach(btn => btn.onclick = async ()=>{
      await DB.del('rfis', Number(btn.getAttribute('data-del'))); await refreshCaches(); routeTo('#/rfis');
    });
  }

  function renderRisks(){
    const wrap = document.createElement('div');
    wrap.className = 'container grid cols-1';

    const form = document.createElement('div');
    form.className = 'card';
    form.innerHTML = `
      <h3>New Risk</h3>
      <div class="row">
        <div>${input('Title','risk_title')}</div>
        <div>${select('Severity','risk_sev',['Low','Medium','High','Critical'])}</div>
      </div>
      <div class="row">
        <div>${input('Owner','risk_owner')}</div>
        <div>${select('Status','risk_status',['Open','Mitigating','Watching','Closed'])}</div>
      </div>
      ${textarea('Mitigation','risk_mit',3)}
      <div class="actions"><button id="addRisk" class="btn primary">Add Risk</button></div>
    `;

    const rows = State.caches.risks.slice().reverse().map(r=>[
      r.title||'—',
      `<span class="chip ${r.severity==='Critical'?'danger':r.severity==='High'?'danger':r.severity==='Medium'?'warn':'ok'}">${r.severity||'Low'}</span>`,
      r.owner||'—',
      `<span class="chip ${r.status==='Closed'?'ok':r.status==='Mitigating'?'warn':'danger'}">${r.status||'Open'}</span>`,
      `<button class="btn" data-del="${r.id}">Delete</button>`
    ]);
    const list = document.createElement('div');
    list.className = 'card';
    list.innerHTML = `<h3>Risks</h3>${table(['Title','Severity','Owner','Status',''], rows)}`;

    wrap.appendChild(form); wrap.appendChild(list);
    $('#app').innerHTML=''; $('#app').appendChild(wrap);

    $('#addRisk').onclick = async () => {
      const r = {
        title: $('#risk_title').value.trim(),
        severity: $('#risk_sev').value,
        owner: $('#risk_owner').value.trim(),
        status: $('#risk_status').value,
        mitigation: $('#risk_mit').value.trim(),
        createdAt: DateService.toLocalISO(new Date())
      };
      if(!r.title){ toast('Title is required'); return; }
      await DB.put('risks', r); await refreshCaches(); routeTo('#/risks');
    };
    $$('button[data-del]').forEach(btn => btn.onclick = async ()=>{
      await DB.del('risks', Number(btn.getAttribute('data-del'))); await refreshCaches(); routeTo('#/risks');
    });
  }

  function renderTFR(){
    const wrap = document.createElement('div');
    wrap.className = 'container grid cols-1';

    const form = document.createElement('div');
    form.className = 'card';
    form.innerHTML = `
      <h3>New TFR Item</h3>
      <div class="row">
        <div>${input('Deliverable','tfr_title')}</div>
        <div>${select('Status','tfr_status',['Not Started','In Progress','Govt Review','Complete'])}</div>
      </div>
      <div class="row">
        <div>${input('Owner','tfr_owner')}</div>
        <div>${input('Due Date','tfr_due','date')}</div>
      </div>
      ${textarea('Notes','tfr_notes',3)}
      <div class="actions"><button id="addTFR" class="btn primary">Add</button></div>
    `;

    const rows = State.caches.tfrs.slice().reverse().map(r=>[
      r.title||'—', r.owner||'—', (r.due||'').slice(0,10) || '—',
      `<span class="chip ${r.status==='Complete'?'ok':r.status==='Govt Review'?'warn':'danger'}">${r.status||'Not Started'}</span>`,
      `<button class="btn" data-del="${r.id}">Delete</button>`
    ]);
    const list = document.createElement('div');
    list.className = 'card';
    list.innerHTML = `<h3>TFR Tracker</h3>${table(['Deliverable','Owner','Due','Status',''], rows)}`;

    wrap.appendChild(form); wrap.appendChild(list);
    $('#app').innerHTML=''; $('#app').appendChild(wrap);

    $('#addTFR').onclick = async () => {
      const r = {
        title: $('#tfr_title').value.trim(),
        status: $('#tfr_status').value,
        owner: $('#tfr_owner').value.trim(),
        due: $('#tfr_due').value || null,
        notes: $('#tfr_notes').value.trim(),
        createdAt: DateService.toLocalISO(new Date())
      };
      if(!r.title){ toast('Deliverable is required'); return; }
      await DB.put('tfrs', r); await refreshCaches(); routeTo('#/tfr');
    };
    $$('button[data-del]').forEach(btn => btn.onclick = async ()=>{
      await DB.del('tfrs', Number(btn.getAttribute('data-del'))); await refreshCaches(); routeTo('#/tfr');
    });
  }

  function renderTagUp(){
    const wrap = document.createElement('div');
    wrap.className = 'container grid cols-1';

    const f = DateService.friendly(new Date());
    const defaultHeader = `Daily Tag‑Up — Week ${f.week} — ${f.text}${f.weekend?' (Weekend)':''}`;

    const form = document.createElement('div');
    form.className = 'card';
    form.innerHTML = `
      <h3>Team Tag‑Up</h3>
      <div class="row">
        <div>${input('Member','tu_member')}</div>
        <div>${input('Date','tu_date','date')}</div>
      </div>
      ${textarea('Yesterday','tu_y',3)}
      ${textarea('Today','tu_t',3)}
      ${textarea('Blockers','tu_b',2)}
      <div class="actions">
        <button id="addTagUp" class="btn primary">Save Entry</button>
        <button id="genClipboard" class="btn">Copy to Clipboard</button>
      </div>
      <hr class="sep"/>
      <div class="small">Header Preview: <strong id="tu_header">${defaultHeader}</strong></div>
    `;

    const entries = State.caches.tagups.slice().reverse().map(e=>[
      e.member||'—',
      (e.date||'').slice(0,10) || '—',
      (e.yesterday||'').replace(/\n/g,'<br>') || '—',
      (e.today||'').replace(/\n/g,'<br>') || '—',
      (e.blockers||'').replace(/\n/g,'<br>') || '—',
      `<button class="btn" data-del="${e.id}">Delete</button>`
    ]);
    const list = document.createElement('div');
    list.className = 'card';
    list.innerHTML = `<h3>Recent Tag‑Ups</h3>${table(['Member','Date','Yesterday','Today','Blockers',''], entries)}`;

    wrap.appendChild(form); wrap.appendChild(list);
    $('#app').innerHTML=''; $('#app').appendChild(wrap);

    $('#tu_date').valueAsDate = new Date();
    $('#addTagUp').onclick = async () => {
      const e = {
        member: $('#tu_member').value.trim(),
        date: $('#tu_date').value || new Date().toISOString().slice(0,10),
        yesterday: $('#tu_y').value.trim(),
        today: $('#tu_t').value.trim(),
        blockers: $('#tu_b').value.trim(),
        createdAt: DateService.toLocalISO(new Date())
      };
      if(!e.member){ toast('Member is required'); return; }
      await DB.put('tagups', e); await refreshCaches(); routeTo('#/tagup');
    };

    $('#genClipboard').onclick = async () => {
      const header = $('#tu_header').textContent;
      const member = $('#tu_member').value.trim() || '(member)';
      const y = $('#tu_y').value.trim() || '—';
      const t = $('#tu_t').value.trim() || '—';
      const b = $('#tu_b').value.trim() || '—';
      const text = `${header}\n${member}\n\nYesterday:\n${y}\n\nToday:\n${t}\n\nBlockers:\n${b}`;
      try{
        if(navigator.clipboard && navigator.clipboard.writeText){
          await navigator.clipboard.writeText(text);
          toast('Copied to clipboard');
        }else{
          const ta = document.createElement('textarea');
          ta.value = text; document.body.appendChild(ta); ta.select();
          document.execCommand('copy'); ta.remove(); toast('Copied');
        }
      }catch(err){ console.log(err); toast('Copy failed'); }
    };
  }

  function renderSettings(){
    const wrap = document.createElement('div');
    wrap.className = 'container grid cols-1';

    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.innerHTML = `
      <h3>Preferences</h3>
      <div class="actions">
        <button id="setLight" class="btn">Light Mode</button>
        <button id="setDark" class="btn">Dark Mode</button>
        <button id="exportData" class="btn">Export JSON</button>
        <button id="wipeAll" class="btn danger">Wipe All Data</button>
      </div>
      <p class="small">Theme is saved in localStorage. App data persists in IndexedDB.</p>
    `;

    wrap.appendChild(cardEl);
    $('#app').innerHTML=''; $('#app').appendChild(wrap);

    $('#setLight').onclick = () => { applyTheme('light'); $('#modeToggle').textContent='☾'; };
    $('#setDark').onclick = () => { applyTheme('dark'); $('#modeToggle').textContent='☀'; };
    $('#exportData').onclick = async () => {
      const payload = {
        tasks: State.caches.tasks,
        rfis: State.caches.rfis,
        risks: State.caches.risks,
        tfrs: State.caches.tfrs,
        tagups: State.caches.tagups
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'plm-dashboard-export.json'; a.click();
      URL.revokeObjectURL(url);
    };
    $('#wipeAll').onclick = async () => {
      if(!confirm('This will permanently delete all local data. Continue?')) return;
      await Promise.all(['tasks','rfis','risks','tfrs','tagups'].map(s=>DB.clear(s)));
      await refreshCaches(); routeTo('#/dashboard'); toast('All data wiped');
    };
  }

  // ---------- Router ----------
  async function refreshCaches(){
    State.caches.tasks = await DB.getAll('tasks');
    State.caches.rfis = await DB.getAll('rfis');
    State.caches.risks = await DB.getAll('risks');
    State.caches.tfrs = await DB.getAll('tfrs');
    State.caches.tagups = await DB.getAll('tagups');
  }

  async function routeTo(hash){
    if(!hash) hash = '#/dashboard';
    State.currentRoute = hash;
    setActiveNav(hash);
    renderFooter();
    switch(hash){
      case '#/dashboard': renderDashboard(); break;
      case '#/tasks': renderTasks(); break;
      case '#/rfis': renderRFIs(); break;
      case '#/risks': renderRisks(); break;
      case '#/tfr': renderTFR(); break;
      case '#/tagup': renderTagUp(); break;
      case '#/settings': renderSettings(); break;
      default: renderDashboard(); break;
    }
  }

  // ---------- Init ----------
  async function init(){
    // Theme
    loadTheme();
    $('#modeToggle').addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      applyTheme(isDark ? 'light' : 'dark');
      $('#modeToggle').textContent = isDark ? '☾' : '☀';
    });

    // DB open
    try{
      await DB.open();
      $('#footerDbState').textContent = 'connected';
    }catch(err){
      console.log(err);
      $('#footerDbState').textContent = 'error';
    }

    // Caches
    await refreshCaches();

    // Router
    window.addEventListener('hashchange', () => routeTo(location.hash));
    if(!location.hash){ location.hash = '#/dashboard'; }
    await routeTo(location.hash);
  }

  // Boot
  document.addEventListener('DOMContentLoaded', init);
})();
