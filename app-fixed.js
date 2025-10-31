(async () => {
  try {
    const res = await fetch('dashboard-data.json');
    const data = await res.json();
    let { meta, teamMembers, tagups, tasks, rfis, risks, tfr } = data;
  // Add click handlers for nav links to ensure routing works
  document.querySelectorAll('nav a').forEach(a => {
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      const hash = a.getAttribute('href');
      window.location.hash = hash;
      renderCurrent();
    });
  });
   const memberSelect = document.getElementById('memberSelect');
    const appEl = document.getElementById('app');
    function populateMembers() {
      memberSelect.innerHTML = '';
      teamMembers.forEach(m => {
        const option = document.createElement('option');
        option.value = m.id;
        option.textContent = m.name;
        if (m.id === meta.activeMemberId) option.selected = true;
        memberSelect.appendChild(option);
      });
    }
    populateMembers();
    memberSelect.addEventListener('change', (e) => {
      meta.activeMemberId = e.target.value;
      renderCurrent();
    });
    function formatDate(iso) {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }
    function renderDashboard() {
      const activeMember = teamMembers.find(m => m.id == meta.activeMemberId);
      const tasksCount = tasks.filter(t => t.ownerId == meta.activeMemberId && t.status !== 'Complete').length;
      const rfisCount = rfis ? rfis.length : 0;
      const risksCount = risks ? risks.length : 0;
      let tfrAvg = 0;
      if (tfr && tfr.length) {
        const sum = tfr.reduce((acc, item) => acc + (item.progress || 0), 0);
        tfrAvg = sum / tfr.length;
      }
      const memberTagups = tagups ? tagups.filter(tu => tu.memberId == meta.activeMemberId) : [];
      const lastTagup = memberTagups.length ? memberTagups[memberTagups.length - 1] : null;
      let tagupText = lastTagup ? lastTagup.notes : 'No recent tag-up.';
      appEl.innerHTML = `
        <h2>Dashboard</h2>
        <p>Hello ${activeMember ? activeMember.name : ''}! Here is your summary.</p>
        <ul>
          <li>Open tasks: ${tasksCount}</li>
          <li>RFIs: ${rfisCount}</li>
          <li>Risks: ${risksCount}</li>
          <li>Average TFR progress: ${tfrAvg.toFixed(1)}%</li>
        </ul>
        <h3>Latest Tag-Up</h3>
        <p>${tagupText}</p>
      `;
    }
    function renderTagUp() {
      const items = tagups ? tagups.filter(tu => tu.memberId == meta.activeMemberId).slice(-5).reverse() : [];
      let html = '<h2>Daily Tag-Up</h2>';
      if (!items.length) {
        html += '<p>No tag-up entries.</p>';
      } else {
        html += '<ul>';
        items.forEach(tu => {
          html += `<li><strong>${formatDate(tu.dateISO)}</strong>: ${tu.notes}</li>`;
        });
        html += '</ul>';
      }
      appEl.innerHTML = html;
    }
    function renderTasks() {
      const myTasks = tasks ? tasks.filter(t => t.ownerId == meta.activeMemberId) : [];
      let html = '<h2>Tasks</h2>';
      if (!myTasks.length) {
        html += '<p>No tasks assigned.</p>';
      } else {
        html += '<table border="1" cellpadding="4" cellspacing="0"><thead><tr><th>Title</th><th>Due</th><th>Priority</th><th>Status</th></tr></thead><tbody>';
        myTasks.forEach(task => {
          html += `<tr><td>${task.title}</td><td>${formatDate(task.dueISO)}</td><td>${task.priority}</td><td>${task.status}</td></tr>`;
        });
        html += '</tbody></table>';
      }
      appEl.innerHTML = html;
    }
    function renderRFIs() {
      let html = '<h2>RFIs</h2>';
      if (!rfis || !rfis.length) {
        html += '<p>No RFIs at this time.</p>';
      } else {
        html += '<ul>';
        rfis.forEach(rfi => {
          const text = rfi.title || rfi.description || JSON.stringify(rfi);
          html += `<li>${text}</li>`;
        });
        html += '</ul>';
      }
      appEl.innerHTML = html;
    }
    function renderRisks() {
      let html = '<h2>Risks</h2>';
      if (!risks || !risks.length) {
        html += '<p>No risks recorded.</p>';
      } else {
        html += '<ul>';
        risks.forEach(risk => {
          const text = risk.title || risk.description || JSON.stringify(risk);
          html += `<li>${text}</li>`;
        });
        html += '</ul>';
      }
      appEl.innerHTML = html;
    }
    function renderTFR() {
      let html = '<h2>TFR Tracker</h2>';
      if (!tfr || !tfr.length) {
        html += '<p>No TFR data.</p>';
      } else {
        html += '<table border="1" cellpadding="4" cellspacing="0"><thead><tr><th>Title</th><th>Progress (%)</th></tr></thead><tbody>';
        tfr.forEach(item => {
          const name = item.title || item.name || 'Item';
          const progress = item.progress != null ? item.progress : '';
          html += `<tr><td>${name}</td><td>${progress}</td></tr>`;
        });
        html += '</tbody></table>';
      }
      appEl.innerHTML = html;
    }
    function renderSettings() {
      let html = '<h2>Settings</h2>';
      html += '<p>Currently there are no settings.</p>';
      appEl.innerHTML = html;
    }
    function renderCurrent() {
      const hash = window.location.hash.replace('#/', '');
      switch (hash) {
        case 'dashboard':
        case '':
          renderDashboard();
          break;
        case 'tagup':
          renderTagUp();
          break;
        case 'tasks':
          renderTasks();
          break;
        case 'rfis':
          renderRFIs();
          break;
        case 'risks':
          renderRisks();
          break;
        case 'tfr':
          renderTFR();
          break;
        case 'settings':
          renderSettings();
          break;
        default:
          renderDashboard();
          break;
      }
    }
    window.addEventListener('hashchange', renderCurrent);
    renderCurrent();
  } catch (e) {
    const appEl = document.getElementById('app') || document.body;
    appEl.innerHTML = '<pre style="color:red;">Error loading dashboard: ' + e.message + '</pre>';
    console.error(e);
  }
})();
