(async () => {
  try {
    const res = await fetch('dashboard-data.json');
    const data = await res.json();
    let { meta, teamMembers, tagups, tasks, rfis, risks, tfr } = data;

    // nav click handler
    function setupNav() {
      document.querySelectorAll('nav a').forEach(a => {
        a.addEventListener('click', ev => {
          ev.preventDefault();
          const href = a.getAttribute('href');
          let hash = '';
          if (href) {
            const idx = href.indexOf('#');
            hash = idx >= 0 ? href.substring(idx) : href;
          } else {
            const text = a.textContent.trim();
            const map = {
              'Dashboard': '#/dashboard',
              'Daily Tag-Up': '#/tagup',
              'Tasks': '#/tasks',
              'RFIs': '#/rfis',
              'Risks': '#/risks',
              'TFR Tracker': '#/tfr',
              'Settings': '#/settings'
            };
            hash = map[text] || '#/dashboard';
          }
          window.location.hash = hash;
          renderCurrent();
        });
      });
    }

    setupNav();

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
      const memberTasks = tasks.filter(t => t.ownerId === meta.activeMemberId);
      const total = memberTasks.length;
      const completed = memberTasks.filter(t => t.status === 'Complete').length;
      const open = total - completed;
      const progress = total ? Math.round((completed / total) * 100) : 0;
      appEl.innerHTML = `
        <h2>Dashboard</h2>
        <p>Total Tasks: ${total}</p>
        <p>Open Tasks: ${open}</p>
        <p>Closed Tasks: ${completed}</p>
        <p>Progress: ${progress}%</p>
        <div style="background:#444; height:10px; width:100%; border-radius:5px;">
          <div style="background:#4caf50; width:${progress}%; height:100%; border-radius:5px;"></div>
        </div>
      `;
    }

    function renderTagUp() {
      const entries = tagups.filter(t => t.memberId === meta.activeMemberId);
      if (!entries.length) {
        appEl.innerHTML = `<h2>Daily Tag-Up</h2><p>No tag-up data available</p>`;
        return;
      }
      const list = entries.slice(-5).map(item => `<li>${formatDate(item.dateISO)}: ${item.notes}</li>`).join('');
      appEl.innerHTML = `<h2>Daily Tag-Up</h2><ul>${list}</ul>`;
    }

    function renderTasks() {
      const memberTasks = tasks.filter(t => t.ownerId === meta.activeMemberId);
      if (!memberTasks.length) {
        appEl.innerHTML = `<h2>Tasks</h2><p>No tasks available</p>`;
        return;
      }
      const rows = memberTasks.map(t => `
        <tr>
          <td>${t.title}</td>
          <td>${formatDate(t.dueISO)}</td>
          <td>${t.priority}</td>
          <td>${t.status}</td>
        </tr>
      `).join('');
      appEl.innerHTML = `
        <h2>Tasks</h2>
        <table>
          <thead><tr><th>Title</th><th>Due</th><th>Priority</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }

    function renderRFIs() {
      const memberRfis = rfis.filter(r => r.memberId === meta.activeMemberId);
      if (!memberRfis.length) {
        appEl.innerHTML = `<h2>RFIs</h2><p>No RFIs data available</p>`;
        return;
      }
      appEl.innerHTML = `<h2>RFIs</h2><ul>${memberRfis.map(r => `<li>${formatDate(r.dateISO)}: ${r.description}</li>`).join('')}</ul>`;
    }

    function renderRisks() {
      const memberRisks = risks.filter(r => r.memberId === meta.activeMemberId);
      if (!memberRisks.length) {
        appEl.innerHTML = `<h2>Risks</h2><p>No risks data available</p>`;
        return;
      }
      appEl.innerHTML = `<h2>Risks</h2><ul>${memberRisks.map(r => `<li>${formatDate(r.dateISO)}: ${r.description}</li>`).join('')}</ul>`;
    }

    function renderTFR() {
      const memberTfr = tfr.filter(r => r.memberId === meta.activeMemberId);
      if (!memberTfr.length) {
        appEl.innerHTML = `<h2>TFR Tracker</h2><p>No TFR data available</p>`;
        return;
      }
      appEl.innerHTML = `<h2>TFR Tracker</h2><ul>${memberTfr.map(r => `<li>${formatDate(r.dateISO)}: ${r.description}</li>`).join('')}</ul>`;
    }

    function renderSettings() {
      appEl.innerHTML = `<h2>Settings</h2><p>No settings available.</p>`;
    }

    function renderCurrent() {
      const hash = window.location.hash || '#/dashboard';
      switch (hash) {
        case '#/dashboard':
          renderDashboard();
          break;
        case '#/tagup':
          renderTagUp();
          break;
        case '#/tasks':
          renderTasks();
          break;
        case '#/rfis':
          renderRFIs();
          break;
        case '#/risks':
          renderRisks();
          break;
        case '#/tfr':
          renderTFR();
          break;
        case '#/settings':
          renderSettings();
          break;
        default:
          renderDashboard();
      }
    }

    renderCurrent();
    window.addEventListener('hashchange', renderCurrent);
  } catch (e) {
    const appEl = document.getElementById('app');
    appEl.innerHTML = `<pre>Error loading dashboard: ${e.message}</pre>`;
  }
})();
