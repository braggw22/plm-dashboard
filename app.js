
/*
  PLM Dashboard – Final Build
  This script implements a hash‑based router, IndexedDB persistence,
  dark/light theme, CRUD for tasks/RFIs/risks/TFRs/tagups, copy to clipboard,
  and a simple DateService.
*/

(function() {
  const DB_NAME = 'plm-dashboard';
  const DB_VERSION = 1;
  let db;

  // open IndexedDB
  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function(event) {
        db = event.target.result;
        // create stores if they don't exist
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('teamMembers')) {
          db.createObjectStore('teamMembers', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('tagups')) {
          db.createObjectStore('tagups', { keyPath: 'dateISO' });
        }
        if (!db.objectStoreNames.contains('tasks')) {
          db.createObjectStore('tasks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('rfis')) {
          db.createObjectStore('rfis', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('risks')) {
          db.createObjectStore('risks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('tfr')) {
          db.createObjectStore('tfr', { keyPath: 'id' });
        }
      };
      request.onsuccess = function(event) {
        db = event.target.result;
        resolve();
      };
      request.onerror = function(event) {
        reject(event.target.error);
      };
    });
  }

  // helpers for object store transactions
  function tx(storeName, mode = 'readonly') {
    const t = db.transaction(storeName, mode);
    return t.objectStore(storeName);
  }

  function getAll(storeName) {
    return new Promise((resolve, reject) => {
      const store = tx(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function getRecord(storeName, key) {
    return new Promise((resolve, reject) => {
      const store = tx(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function putRecord(storeName, record) {
    return new Promise((resolve, reject) => {
      const store = tx(storeName, 'readwrite');
      const request = store.put(record);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function deleteRecord(storeName, key) {
    return new Promise((resolve, reject) => {
      const store = tx(storeName, 'readwrite');
      const request = store.delete(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // load initial data if not already seeded
  async function seedData() {
    const seeded = await getRecord('meta', 'seeded');
    if (seeded && seeded.value) {
      return;
    }
    const resp = await fetch('dashboard-data.json');
    const data = await resp.json();
    // meta keys
    await putRecord('meta', { key: 'lastTagUpISO', value: data.meta.lastTagUpISO });
    await putRecord('meta', { key: 'tz', value: data.meta.tz });
    await putRecord('meta', { key: 'activeMemberId', value: data.meta.activeMemberId });
    // teamMembers
    for (const member of data.teamMembers) {
      await putRecord('teamMembers', member);
    }
    // tagups
    for (const tu of data.tagups) {
      await putRecord('tagups', tu);
    }
    // tasks
    for (const task of data.tasks) {
      await putRecord('tasks', task);
    }
    // rfis
    for (const rfi of data.rfis) {
      await putRecord('rfis', rfi);
    }
    // risks
    for (const risk of data.risks) {
      await putRecord('risks', risk);
    }
    // tfr
    for (const tfr of data.tfr) {
      await putRecord('tfr', tfr);
    }
    await putRecord('meta', { key: 'seeded', value: true });
  }

  // DateService: update time and week number
  function startClock() {
    const statusLine = document.getElementById('status-line');
    function update() {
      const tz = 'America/Chicago';
      const now = new Date();
      const options = { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit' };
      const timeStr = new Intl.DateTimeFormat('en-US', options).format(now);
      // Adjust date for week number: roll over weekends (Saturday -> Monday, Sunday -> Monday)
      let weekDate = new Date(now);
      const dow = weekDate.getDay();
      if (dow === 6) { // Saturday
        weekDate.setDate(weekDate.getDate() + 2);
      } else if (dow === 0) { // Sunday
        weekDate.setDate(weekDate.getDate() + 1);
      }
      const weekNo = getISOWeekNumber(weekDate);
      statusLine.textContent = `Local time: ${timeStr} CT | Week ${weekNo}`;
    }
    update();
    setInterval(update, 60000);
  }

  // ISO week number computation
  function getISOWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    // Thursday of this week
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
  }

  // Router
  function initRouter() {
    window.addEventListener('hashchange', renderRoute);
    if (!location.hash) {
      location.hash = '#/dashboard';
    } else {
      renderRoute();
    }
  }

  async function renderRoute() {
    const hash = location.hash || '#/dashboard';
    const route = hash.slice(2).split('/')[0] || 'dashboard';
    // update nav active state
    document.querySelectorAll('.top-nav .nav-link').forEach(link => {
      if (link.getAttribute('href') === '#/' + route) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
    switch (route) {
      case 'dashboard': await renderDashboard(); break;
      case 'tagup': await renderTagUp(); break;
      case 'tasks': await renderTasks(); break;
      case 'rfis': await renderRFIs(); break;
      case 'risks': await renderRisks(); break;
      case 'tfr': await renderTFR(); break;
      case 'settings': await renderSettings(); break;
      default: await renderDashboard(); break;
    }
  }

  // dark mode toggle
  async function initTheme() {
    const toggle = document.getElementById('themeToggle');
    const current = await getRecord('meta', 'theme');
    if (current) {
      setTheme(current.value);
    } else {
      setTheme('dark');
    }
    toggle.setAttribute('aria-pressed', document.documentElement.getAttribute('data-theme') === 'dark' ? 'false' : 'true');
    toggle.addEventListener('click', async () => {
      const newTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      setTheme(newTheme);
      await putRecord('meta', { key: 'theme', value: newTheme });
    });
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    // update button icon maybe?
  }

  // populate member select
  async function initMemberSelect() {
    const sel = document.getElementById('memberSelect');
    const members = await getAll('teamMembers');
    sel.innerHTML = '';
    members.forEach(member => {
      const opt = document.createElement('option');
      opt.value = member.id;
      opt.textContent = member.name;
      sel.appendChild(opt);
    });
    const activeMeta = await getRecord('meta', 'activeMemberId');
    if (activeMeta) sel.value = activeMeta.value;
    sel.addEventListener('change', async (e) => {
      await putRecord('meta', { key: 'activeMemberId', value: e.target.value });
    });
  }

  // Render Dashboard page
  async function renderDashboard() {
    const app = document.getElementById('app');
    // read counts
    const tasks = await getAll('tasks');
    const rfis = await getAll('rfis');
    const risks = await getAll('risks');
    const tfrs = await getAll('tfr');
    const tagups = await getAll('tagups');
    const lastTagUp = tagups[tagups.length - 1] || null;
    app.innerHTML = '';
    const section = document.createElement('div');
    section.className = 'section-row';
    // KPIs
    const kpiRow = document.createElement('div');
    kpiRow.className = 'kpi-row';
    // tasks count
    const k1 = document.createElement('div');
    k1.className = 'kpi';
    k1.innerHTML = `<div class="num">${tasks.length}</div><div>Tasks</div>`;
    kpiRow.appendChild(k1);
    const k2 = document.createElement('div');
    k2.className = 'kpi';
    k2.innerHTML = `<div class="num">${rfis.length}</div><div>RFIs</div>`;
    kpiRow.appendChild(k2);
    const k3 = document.createElement('div');
    k3.className = 'kpi';
    k3.innerHTML = `<div class="num">${risks.length}</div><div>Risks</div>`;
    kpiRow.appendChild(k3);
    const k4 = document.createElement('div');
    k4.className = 'kpi';
    const avgProgress = tfrs.length ? Math.round(tfrs.reduce((sum,t)=>sum+t.progress,0)/tfrs.length) : 0;
    k4.innerHTML = `<div class="num">${avgProgress}%</div><div>Avg TFR Progress</div>`;
    kpiRow.appendChild(k4);
    section.appendChild(kpiRow);
    // Quick links card
    const quick = document.createElement('div');
    quick.className = 'card';
    quick.innerHTML = `
      <h2>Welcome</h2>
      <p>Use the navigation to access the Daily Tag‑Up, Tasks, RFIs, Risks or TFR Tracker.</p>
      ${lastTagUp ? `<p class="small">Last Tag‑Up: ${lastTagUp.dateISO}</p>` : ''}
    `;
    section.appendChild(quick);
    app.appendChild(section);
  }

  // TagUp page
  async function renderTagUp() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h2>Daily Tag‑Up</h2>`;
    // date label
    const today = new Date().toISOString().split('T')[0];
    // load existing if any
    const existing = await getRecord('tagups', today);
    const yesterdayInput = document.createElement('textarea');
    yesterdayInput.placeholder = "What did you do yesterday?";
    const todayInput = document.createElement('textarea');
    todayInput.placeholder = "What will you do today?";
    const risksInput = document.createElement('textarea');
    risksInput.placeholder = "Risks / blockers";
    if (existing) {
      yesterdayInput.value = existing.yesterdayText;
      todayInput.value = existing.todayText;
      risksInput.value = existing.risksText;
    }
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save Tag‑Up';
    saveBtn.addEventListener('click', async () => {
      const record = {
        dateISO: today,
        yesterdayText: yesterdayInput.value.trim(),
        todayText: todayInput.value.trim(),
        risksText: risksInput.value.trim()
      };
      await putRecord('tagups', record);
      // update lastTagUpISO meta
      await putRecord('meta', { key: 'lastTagUpISO', value: today });
      alert('Tag‑Up saved.');
    });
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy to Clipboard';
    copyBtn.addEventListener('click', () => {
      const clip = `Yesterday: ${yesterdayInput.value.trim()}
Today: ${todayInput.value.trim()}
Risks: ${risksInput.value.trim()}`;
      navigator.clipboard.writeText(clip).then(() => {
        alert('Tag‑Up copied to clipboard!');
      }).catch(err => {
        console.error(err);
        alert('Unable to copy.');
      });
    });
    card.appendChild(document.createElement('label')).appendChild(document.createTextNode(`Date: ${today}`));
    card.appendChild(document.createElement('div')).appendChild(yesterdayInput);
    card.appendChild(document.createElement('div')).appendChild(todayInput);
    card.appendChild(document.createElement('div')).appendChild(risksInput);
    const row = document.createElement('div');
    row.className = 'button-row';
    row.appendChild(saveBtn);
    row.appendChild(copyBtn);
    card.appendChild(row);
    app.appendChild(card);
  }

  // Helper to generate unique IDs
  function generateId(prefix) {
    return prefix + Math.random().toString(36).substr(2, 9);
  }

  // Render Tasks page
  async function renderTasks() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    const tasks = await getAll('tasks');
    const members = await getAll('teamMembers');
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<h2>Tasks</h2>';
    // Form to add/edit tasks
    const form = document.createElement('div');
    form.className = 'grid';
    // Title
    const titleGroup = document.createElement('div');
    titleGroup.innerHTML = '<label class="label">Title</label>';
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleGroup.appendChild(titleInput);
    // Owner
    const ownerGroup = document.createElement('div');
    ownerGroup.innerHTML = '<label class="label">Owner</label>';
    const ownerSelect = document.createElement('select');
    members.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name;
      ownerSelect.appendChild(opt);
    });
    ownerGroup.appendChild(ownerSelect);
    // Due date
    const dueGroup = document.createElement('div');
    dueGroup.innerHTML = '<label class="label">Due Date</label>';
    const dueInput = document.createElement('input');
    dueInput.type = 'date';
    dueGroup.appendChild(dueInput);
    // Priority
    const priorityGroup = document.createElement('div');
    priorityGroup.innerHTML = '<label class="label">Priority</label>';
    const prioritySelect = document.createElement('select');
    ['High','Medium','Low'].forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      prioritySelect.appendChild(opt);
    });
    priorityGroup.appendChild(prioritySelect);
    // Status
    const statusGroup = document.createElement('div');
    statusGroup.innerHTML = '<label class="label">Status</label>';
    const statusSelect = document.createElement('select');
    ['Not Started','In Progress','Completed'].forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      statusSelect.appendChild(opt);
    });
    statusGroup.appendChild(statusSelect);
    // Add button
    const addBtn = document.createElement('button');
    addBtn.textContent = 'Add Task';
    addBtn.addEventListener('click', async () => {
      const newTask = {
        id: generateId('t'),
        title: titleInput.value.trim(),
        ownerId: ownerSelect.value,
        dueISO: dueInput.value,
        priority: prioritySelect.value,
        status: statusSelect.value
      };
      await putRecord('tasks', newTask);
      renderTasks(); // re-render
    });
    form.appendChild(titleGroup);
    form.appendChild(ownerGroup);
    form.appendChild(dueGroup);
    form.appendChild(priorityGroup);
    form.appendChild(statusGroup);
    const btnRow = document.createElement('div');
    btnRow.className = 'button-row';
    btnRow.appendChild(addBtn);
    form.appendChild(btnRow);
    card.appendChild(form);
    // Table listing
    const list = document.createElement('div');
    tasks.forEach(task => {
      const row = document.createElement('div');
      row.className = 'tr';
      row.style.gridTemplateColumns = '2fr 1fr 1fr 1fr 1fr';
      const ownerName = members.find(m => m.id === task.ownerId)?.name || task.ownerId;
      row.innerHTML = `
        <div>${task.title}</div>
        <div>${ownerName}</div>
        <div>${task.dueISO}</div>
        <div>${task.priority}</div>
        <div>${task.status}</div>
      `;
      // Edit & Delete buttons
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => {
        titleInput.value = task.title;
        ownerSelect.value = task.ownerId;
        dueInput.value = task.dueISO;
        prioritySelect.value = task.priority;
        statusSelect.value = task.status;
        addBtn.textContent = 'Update';
        addBtn.onclick = async () => {
          const updated = {
            id: task.id,
            title: titleInput.value.trim(),
            ownerId: ownerSelect.value,
            dueISO: dueInput.value,
            priority: prioritySelect.value,
            status: statusSelect.value
          };
          await putRecord('tasks', updated);
          addBtn.textContent = 'Add Task';
          // reset form
          titleInput.value = '';
          dueInput.value = '';
          renderTasks();
        };
      });
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', async () => {
        await deleteRecord('tasks', task.id);
        renderTasks();
      });
      const btns = document.createElement('div');
      btns.className = 'inline';
      btns.appendChild(editBtn);
      btns.appendChild(delBtn);
      row.appendChild(btns);
      list.appendChild(row);
    });
    card.appendChild(list);
    app.appendChild(card);
  }

  // Render RFIs page
  async function renderRFIs() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    const rfis = await getAll('rfis');
    const members = await getAll('teamMembers');
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<h2>RFIs</h2>';
    // Form
    const form = document.createElement('div');
    form.className = 'grid';
    // Title
    const tGroup = document.createElement('div');
    tGroup.innerHTML = '<label class="label">Title</label>';
    const tInput = document.createElement('input');
    tInput.type = 'text';
    tGroup.appendChild(tInput);
    // Site
    const siteGroup = document.createElement('div');
    siteGroup.innerHTML = '<label class="label">Site</label>';
    const siteInput = document.createElement('input');
    siteInput.type = 'text';
    siteGroup.appendChild(siteInput);
    // Building
    const bldgGroup = document.createElement('div');
    bldgGroup.innerHTML = '<label class="label">Building</label>';
    const bldgInput = document.createElement('input');
    bldgInput.type = 'text';
    bldgGroup.appendChild(bldgInput);
    // Owner
    const ownerGroup = document.createElement('div');
    ownerGroup.innerHTML = '<label class="label">Owner</label>';
    const ownerSelect = document.createElement('select');
    members.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name;
      ownerSelect.appendChild(opt);
    });
    ownerGroup.appendChild(ownerSelect);
    // Status
    const statusGroup = document.createElement('div');
    statusGroup.innerHTML = '<label class="label">Status</label>';
    const statusSelect = document.createElement('select');
    ['Open','Closed','Resolved'].forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      statusSelect.appendChild(opt);
    });
    statusGroup.appendChild(statusSelect);
    // Opened date
    const openedGroup = document.createElement('div');
    openedGroup.innerHTML = '<label class="label">Opened Date</label>';
    const openedInput = document.createElement('input');
    openedInput.type = 'date';
    openedGroup.appendChild(openedInput);
    // Due date
    const dueGroup = document.createElement('div');
    dueGroup.innerHTML = '<label class="label">Due Date</label>';
    const dueInput = document.createElement('input');
    dueInput.type = 'date';
    dueGroup.appendChild(dueInput);
    // Notes
    const notesGroup = document.createElement('div');
    notesGroup.innerHTML = '<label class="label">Notes</label>';
    const notesInput = document.createElement('textarea');
    notesGroup.appendChild(notesInput);
    // Add button
    const addBtn = document.createElement('button');
    addBtn.textContent = 'Add RFI';
    addBtn.addEventListener('click', async () => {
      const newRecord = {
        id: generateId('rfi'),
        title: tInput.value.trim(),
        site: siteInput.value.trim(),
        building: bldgInput.value.trim(),
        ownerId: ownerSelect.value,
        status: statusSelect.value,
        openedISO: openedInput.value,
        dueISO: dueInput.value,
        notes: notesInput.value.trim()
      };
      await putRecord('rfis', newRecord);
      renderRFIs();
    });
    form.appendChild(tGroup);
    form.appendChild(siteGroup);
    form.appendChild(bldgGroup);
    form.appendChild(ownerGroup);
    form.appendChild(statusGroup);
    form.appendChild(openedGroup);
    form.appendChild(dueGroup);
    form.appendChild(notesGroup);
    const btnRow = document.createElement('div');
    btnRow.className = 'button-row';
    btnRow.appendChild(addBtn);
    form.appendChild(btnRow);
    card.appendChild(form);
    // List
    const list = document.createElement('div');
    rfis.forEach(item => {
      const row = document.createElement('div');
      row.className = 'tr';
      row.style.gridTemplateColumns = '2fr 0.6fr 0.6fr 0.8fr 0.8fr 0.8fr 1fr';
      const ownerName = members.find(m => m.id === item.ownerId)?.name || item.ownerId;
      row.innerHTML = `
        <div>${item.title}</div>
        <div>${item.site}</div>
        <div>${item.building}</div>
        <div>${ownerName}</div>
        <div>${item.status}</div>
        <div>${item.dueISO}</div>
      `;
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => {
        // populate form
        tInput.value = item.title;
        siteInput.value = item.site;
        bldgInput.value = item.building;
        ownerSelect.value = item.ownerId;
        statusSelect.value = item.status;
        openedInput.value = item.openedISO;
        dueInput.value = item.dueISO;
        notesInput.value = item.notes;
        addBtn.textContent = 'Update';
        addBtn.onclick = async () => {
          const updated = {
            id: item.id,
            title: tInput.value.trim(),
            site: siteInput.value.trim(),
            building: bldgInput.value.trim(),
            ownerId: ownerSelect.value,
            status: statusSelect.value,
            openedISO: openedInput.value,
            dueISO: dueInput.value,
            notes: notesInput.value.trim()
          };
          await putRecord('rfis', updated);
          addBtn.textContent = 'Add RFI';
          // reset
          tInput.value = siteInput.value = bldgInput.value = openedInput.value = dueInput.value = notesInput.value = '';
          renderRFIs();
        };
      });
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', async () => {
        await deleteRecord('rfis', item.id);
        renderRFIs();
      });
      const btns = document.createElement('div');
      btns.className = 'inline';
      btns.appendChild(editBtn);
      btns.appendChild(delBtn);
      row.appendChild(btns);
      list.appendChild(row);
    });
    card.appendChild(list);
    app.appendChild(card);
  }

  // Render Risks page
  async function renderRisks() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    const risks = await getAll('risks');
    const members = await getAll('teamMembers');
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<h2>Risks</h2>';
    // form
    const form = document.createElement('div');
    form.className = 'grid';
    // Title
    const titleGroup = document.createElement('div');
    titleGroup.innerHTML = '<label class="label">Title</label>';
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleGroup.appendChild(titleInput);
    // Severity
    const severityGroup = document.createElement('div');
    severityGroup.innerHTML = '<label class="label">Severity</label>';
    const severitySelect = document.createElement('select');
    ['High','Medium','Low'].forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      severitySelect.appendChild(opt);
    });
    severityGroup.appendChild(severitySelect);
    // Owner
    const ownerGroup = document.createElement('div');
    ownerGroup.innerHTML = '<label class="label">Owner</label>';
    const ownerSelect = document.createElement('select');
    members.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name;
      ownerSelect.appendChild(opt);
    });
    ownerGroup.appendChild(ownerSelect);
    // Status
    const statusGroup = document.createElement('div');
    statusGroup.innerHTML = '<label class="label">Status</label>';
    const statusSelect = document.createElement('select');
    ['Mitigating','Open','Closed'].forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      statusSelect.appendChild(opt);
    });
    statusGroup.appendChild(statusSelect);
    // Opened date
    const openedGroup = document.createElement('div');
    openedGroup.innerHTML = '<label class="label">Opened Date</label>';
    const openedInput = document.createElement('input');
    openedInput.type = 'date';
    openedGroup.appendChild(openedInput);
    // Due date
    const dueGroup = document.createElement('div');
    dueGroup.innerHTML = '<label class="label">Due Date</label>';
    const dueInput = document.createElement('input');
    dueInput.type = 'date';
    dueGroup.appendChild(dueInput);
    // Notes
    const notesGroup = document.createElement('div');
    notesGroup.innerHTML = '<label class="label">Notes</label>';
    const notesInput = document.createElement('textarea');
    notesGroup.appendChild(notesInput);
    // Add
    const addBtn = document.createElement('button');
    addBtn.textContent = 'Add Risk';
    addBtn.addEventListener('click', async () => {
      const rec = {
        id: generateId('risk'),
        title: titleInput.value.trim(),
        severity: severitySelect.value,
        ownerId: ownerSelect.value,
        status: statusSelect.value,
        openedISO: openedInput.value,
        dueISO: dueInput.value,
        notes: notesInput.value.trim()
      };
      await putRecord('risks', rec);
      renderRisks();
    });
    form.appendChild(titleGroup);
    form.appendChild(severityGroup);
    form.appendChild(ownerGroup);
    form.appendChild(statusGroup);
    form.appendChild(openedGroup);
    form.appendChild(dueGroup);
    form.appendChild(notesGroup);
    const btnRow = document.createElement('div');
    btnRow.className = 'button-row';
    btnRow.appendChild(addBtn);
    form.appendChild(btnRow);
    card.appendChild(form);
    // list
    const list = document.createElement('div');
    risks.forEach(item => {
      const row = document.createElement('div');
      row.className = 'tr';
      row.style.gridTemplateColumns = '2fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr';
      const ownerName = members.find(m => m.id === item.ownerId)?.name || item.ownerId;
      row.innerHTML = `
        <div>${item.title}</div>
        <div>${item.severity}</div>
        <div>${ownerName}</div>
        <div>${item.status}</div>
        <div>${item.dueISO}</div>
      `;
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => {
        titleInput.value = item.title;
        severitySelect.value = item.severity;
        ownerSelect.value = item.ownerId;
        statusSelect.value = item.status;
        openedInput.value = item.openedISO;
        dueInput.value = item.dueISO;
        notesInput.value = item.notes;
        addBtn.textContent = 'Update';
        addBtn.onclick = async () => {
          const updated = {
            id: item.id,
            title: titleInput.value.trim(),
            severity: severitySelect.value,
            ownerId: ownerSelect.value,
            status: statusSelect.value,
            openedISO: openedInput.value,
            dueISO: dueInput.value,
            notes: notesInput.value.trim()
          };
          await putRecord('risks', updated);
          addBtn.textContent = 'Add Risk';
          titleInput.value = '';
          openedInput.value = dueInput.value = notesInput.value = '';
          renderRisks();
        };
      });
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', async () => {
        await deleteRecord('risks', item.id);
        renderRisks();
      });
      const btns = document.createElement('div');
      btns.className = 'inline';
      btns.appendChild(editBtn);
      btns.appendChild(delBtn);
      row.appendChild(btns);
      list.appendChild(row);
    });
    card.appendChild(list);
    app.appendChild(card);
  }

  // Render TFR page
  async function renderTFR() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    const tfrs = await getAll('tfr');
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<h2>TFR Tracker</h2>';
    // Form
    const form = document.createElement('div');
    form.className = 'grid';
    // Site
    const siteGroup = document.createElement('div');
    siteGroup.innerHTML = '<label class="label">Site</label>';
    const siteInput = document.createElement('input');
    siteInput.type = 'text';
    siteGroup.appendChild(siteInput);
    // Building
    const bldgGroup = document.createElement('div');
    bldgGroup.innerHTML = '<label class="label">Building</label>';
    const bldgInput = document.createElement('input');
    bldgInput.type = 'text';
    bldgGroup.appendChild(bldgInput);
    // Phase
    const phaseGroup = document.createElement('div');
    phaseGroup.innerHTML = '<label class="label">Phase</label>';
    const phaseSelect = document.createElement('select');
    ['Survey','Install','AsBuilt','Complete'].forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      phaseSelect.appendChild(opt);
    });
    phaseGroup.appendChild(phaseSelect);
    // Progress
    const progressGroup = document.createElement('div');
    progressGroup.innerHTML = '<label class="label">Progress (%)</label>';
    const progressInput = document.createElement('input');
    progressInput.type = 'number';
    progressInput.min = 0;
    progressInput.max = 100;
    progressGroup.appendChild(progressInput);
    // Updated date
    const updatedGroup = document.createElement('div');
    updatedGroup.innerHTML = '<label class="label">Updated Date</label>';
    const updatedInput = document.createElement('input');
    updatedInput.type = 'date';
    updatedGroup.appendChild(updatedInput);
    // Rooms
    const roomsGroup = document.createElement('div');
    roomsGroup.innerHTML = '<label class="label">Rooms</label>';
    const roomsInput = document.createElement('input');
    roomsInput.type = 'text';
    roomsGroup.appendChild(roomsInput);
    // Notes
    const notesGroup = document.createElement('div');
    notesGroup.innerHTML = '<label class="label">Notes</label>';
    const notesInput = document.createElement('textarea');
    notesGroup.appendChild(notesInput);
    // Add
    const addBtn = document.createElement('button');
    addBtn.textContent = 'Add Entry';
    addBtn.addEventListener('click', async () => {
      const rec = {
        id: generateId('tfr'),
        site: siteInput.value.trim(),
        building: bldgInput.value.trim(),
        phase: phaseSelect.value,
        progress: parseInt(progressInput.value) || 0,
        updatedISO: updatedInput.value,
        notes: notesInput.value.trim(),
        rooms: roomsInput.value.trim()
      };
      await putRecord('tfr', rec);
      renderTFR();
    });
    form.appendChild(siteGroup);
    form.appendChild(bldgGroup);
    form.appendChild(phaseGroup);
    form.appendChild(progressGroup);
    form.appendChild(updatedGroup);
    form.appendChild(roomsGroup);
    form.appendChild(notesGroup);
    const btnRow = document.createElement('div');
    btnRow.className = 'button-row';
    btnRow.appendChild(addBtn);
    form.appendChild(btnRow);
    card.appendChild(form);
    // list
    const list = document.createElement('div');
    tfrs.forEach(item => {
      const row = document.createElement('div');
      row.className = 'tr';
      row.style.gridTemplateColumns = '1fr 1fr 1fr 1fr 1fr 1fr';
      row.innerHTML = `
        <div>${item.site}</div>
        <div>${item.building}</div>
        <div>${item.phase}</div>
        <div><div class="progress"><span style="width:${item.progress}%"></span></div></div>
        <div>${item.updatedISO}</div>
      `;
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => {
        siteInput.value = item.site;
        bldgInput.value = item.building;
        phaseSelect.value = item.phase;
        progressInput.value = item.progress;
        updatedInput.value = item.updatedISO;
        roomsInput.value = item.rooms;
        notesInput.value = item.notes;
        addBtn.textContent = 'Update';
        addBtn.onclick = async () => {
          const updated = {
            id: item.id,
            site: siteInput.value.trim(),
            building: bldgInput.value.trim(),
            phase: phaseSelect.value,
            progress: parseInt(progressInput.value) || 0,
            updatedISO: updatedInput.value,
            notes: notesInput.value.trim(),
            rooms: roomsInput.value.trim()
          };
          await putRecord('tfr', updated);
          addBtn.textContent = 'Add Entry';
          siteInput.value = bldgInput.value = roomsInput.value = notesInput.value = '';
          progressInput.value = updatedInput.value = '';
          renderTFR();
        };
      });
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', async () => {
        await deleteRecord('tfr', item.id);
        renderTFR();
      });
      const btns = document.createElement('div');
      btns.className = 'inline';
      btns.appendChild(editBtn);
      btns.appendChild(delBtn);
      row.appendChild(btns);
      list.appendChild(row);
    });
    card.appendChild(list);
    app.appendChild(card);
  }

  // Settings page: import/export JSON, reset
  async function renderSettings() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<h2>Settings</h2>';
    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export Data';
    exportBtn.addEventListener('click', async () => {
      const data = {};
      data.meta = {};
      const metaKeys = await getAll('meta');
      metaKeys.forEach(item => { data.meta[item.key] = item.value; });
      data.teamMembers = await getAll('teamMembers');
      data.tagups = await getAll('tagups');
      data.tasks = await getAll('tasks');
      data.rfis = await getAll('rfis');
      data.risks = await getAll('risks');
      data.tfr = await getAll('tfr');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'plm-dashboard-export.json';
      link.click();
      URL.revokeObjectURL(url);
    });
    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = 'application/json';
    const importBtn = document.createElement('button');
    importBtn.textContent = 'Import Data';
    importBtn.addEventListener('click', () => {
      importInput.click();
    });
    importInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const data = JSON.parse(reader.result);
          // clear each store
          const stores = ['meta','teamMembers','tagups','tasks','rfis','risks','tfr'];
          for (const storeName of stores) {
            const store = tx(storeName, 'readwrite');
            store.clear();
          }
          // populate meta
          Object.keys(data.meta).forEach(async (key) => {
            await putRecord('meta', { key: key, value: data.meta[key] });
          });
          for (const member of data.teamMembers || []) await putRecord('teamMembers', member);
          for (const tu of data.tagups || []) await putRecord('tagups', tu);
          for (const t of data.tasks || []) await putRecord('tasks', t);
          for (const rfi of data.rfis || []) await putRecord('rfis', rfi);
          for (const risk of data.risks || []) await putRecord('risks', risk);
          for (const tfr of data.tfr || []) await putRecord('tfr', tfr);
          alert('Data imported successfully.');
        } catch(err) {
          console.error(err);
          alert('Failed to import file.');
        }
      };
      reader.readAsText(file);
    });
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset App';
    resetBtn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to reset all data?')) return;
      // delete all stores data
      const stores = ['meta','teamMembers','tagups','tasks','rfis','risks','tfr'];
      for (const storeName of stores) {
        const store = tx(storeName, 'readwrite');
        store.clear();
      }
      await seedData();
      alert('Data reset complete.');
      renderDashboard();
    });
    const btnRow = document.createElement('div');
    btnRow.className = 'button-row';
    btnRow.appendChild(exportBtn);
    btnRow.appendChild(importBtn);
    btnRow.appendChild(resetBtn);
    card.appendChild(btnRow);
    app.appendChild(card);
  }

  // initialize application
  async function init() {
    await openDB();
    await seedData();
    await initTheme();
    await initMemberSelect();
    initRouter();
    startClock();
  }

  init();
})();
