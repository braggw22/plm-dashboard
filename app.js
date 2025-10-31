(async () => {
  const data = await fetch('dashboard-data.json').then(res => res.json());
  const { meta, teamMembers, tagups, tasks } = data;

  let activeMemberId = meta.activeMemberId || (teamMembers[0] && teamMembers[0].id);

  const selectEl = document.getElementById('memberSelect');
  // populate select options
  teamMembers.forEach(member => {
    const option = document.createElement('option');
    option.value = member.id;
    option.textContent = member.name;
    selectEl.appendChild(option);
  });
  selectEl.value = activeMemberId;
  selectEl.addEventListener('change', () => {
    activeMemberId = selectEl.value;
    renderCurrent();
  });

  function formatDate(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function renderDashboard() {
    const appEl = document.getElementById('app');
    const memberTasks = tasks.filter(t => t.ownerId === activeMemberId);
    const openTasks = memberTasks.filter(t => !['complete','closed'].includes((t.status || '').toLowerCase()));
    const closedTasks = memberTasks.filter(t => ['complete','closed'].includes((t.status || '').toLowerCase()));
    const progress = memberTasks.length ? Math.round((closedTasks.length / memberTasks.length) * 100) : 0;
    appEl.innerHTML = `
      <section>
        <h2>Dashboard</h2>
        <p><strong>Total Tasks:</strong> ${memberTasks.length}</p>
        <p><strong>Open Tasks:</strong> ${openTasks.length}</p>
        <p><strong>Closed Tasks:</strong> ${closedTasks.length}</p>
        <p><strong>Progress:</strong> ${progress}%</p>
      </section>
    `;
  }

  function renderTagUp() {
    const appEl = document.getElementById('app');
    const memberTagups = tagups.filter(t => t.memberId === activeMemberId);
    const latest = memberTagups[memberTagups.length - 1];
    let html = '<section><h2>Daily Tag‑Up</h2>';
    if (latest) {
      html += `
        <p><strong>Date:</strong> ${formatDate(latest.dateISO)}</p>
        <p><strong>Notes:</strong> ${latest.notes || ''}</p>
      `;
    } else {
      html += '<p>No tag-up data available.</p>';
    }
    html += '</section>';
    appEl.innerHTML = html;
  }

  function renderTasks() {
    const appEl = document.getElementById('app');
    const memberTasks = tasks.filter(t => t.ownerId === activeMemberId);
    let html = '<section><h2>Tasks</h2>';
    if (memberTasks.length) {
      html += '<table><thead><tr><th>Title</th><th>Due</th><th>Priority</th><th>Status</th></tr></thead><tbody>';
      memberTasks.forEach(task => {
        html += `<tr><td>${task.title}</td><td>${formatDate(task.dueISO)}</td><td>${task.priority || ''}</td><td>${task.status || ''}</td></tr>`;
      });
      html += '</tbody></table>';
    } else {
      html += '<p>No tasks found.</p>';
    }
    html += '</section>';
    appEl.innerHTML = html;
  }

  function renderRFIs() {
    const appEl = document.getElementById('app');
    appEl.innerHTML = '<section><h2>RFIs</h2><p>No RFIs data available.</p></section>';
  }

  function renderRisks() {
    const appEl = document.getElementById('app');
    appEl.innerHTML = '<section><h2>Risks</h2><p>No risks data available.</p></section>';
  }

  function renderTFR() {
    const appEl = document.getElementById('app');
    appEl.innerHTML = '<section><h2>TFR Tracker</h2><p>No TFR data available.</p></section>';
  }

  function renderSettings() {
    const appEl = document.getElementById('app');
    appEl.innerHTML = '<section><h2>Settings</h2><p>No settings available.</p></section>';
  }

  function renderCurrent() {
    const hash = window.location.hash.slice(2);
    switch (hash) {
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
})();
