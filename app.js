/* =========================================================
   PLM Dashboard — Phase 1 Core (team-aware)
   Vanilla JS + hash router
   DateService with America/Chicago logic
   ========================================================= */

const TZ = "America/Chicago";

/* ----------------------- DateService ----------------------- */
const DateService = (() => {
  const fmtShort = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, weekday: "short", month: "short", day: "2-digit", year: "numeric"
  });
  const fmtTime = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: true
  });

  const now = () => new Date();

  const format = (date) => fmtShort.format(date);

  const iso = (date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date);
    const y = parts.find(p => p.type === "year").value;
    const m = parts.find(p => p.type === "month").value;
    const d = parts.find(p => p.type === "day").value;
    return `${y}-${m}-${d}`;
  };

  const ymd = (date) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date);
    return {
      y: Number(parts.find(p => p.type === "year").value),
      m: Number(parts.find(p => p.type === "month").value),
      d: Number(parts.find(p => p.type === "day").value)
    };
  };

  const dateFromLocalYMD = (y, m, d) => new Date(Date.UTC(y, m - 1, d, 0, 0, 0));

  const isWeekend = (date) => {
    const { y, m, d } = ymd(date);
    const ctMidnight = dateFromLocalYMD(y, m, d);
    const weekday = (ctMidnight.getUTCDay() + 7) % 7; // 0 Sun..6 Sat
    return weekday === 0 || weekday === 6;
  };

  const yesterday = (date) => {
    const { y, m, d } = ymd(date);
    const ctMidnight = dateFromLocalYMD(y, m, d);
    const prior = new Date(ctMidnight.getTime() - 24 * 60 * 60 * 1000);
    return prior;
  };

  const weekNumber = (date) => {
    const { y, m, d } = ymd(date);
    const ctMidnight = dateFromLocalYMD(y, m, d);
    const dayNum = (ctMidnight.getUTCDay() + 6) % 7; // 0 Mon..6 Sun
    const thu = new Date(ctMidnight);
    thu.setUTCDate(thu.getUTCDate() - dayNum + 3);
    const firstThu = new Date(Date.UTC(thu.getUTCFullYear(), 0, 4));
    const firstDayNum = (firstThu.getUTCDay() + 6) % 7;
    firstThu.setUTCDate(firstThu.getUTCDate() - firstDayNum + 3);
    const diffDays = Math.round((ctMidnight - firstThu) / 86400000);
    return 1 + Math.floor(diffDays / 7);
  };

  const timeString = (date) => fmtTime.format(date);

  return { now, format, iso, isWeekend, yesterday, weekNumber, timeString };
})();

/* ----------------------- Data (Phase 1 local JSON) ----------------------- */
const DefaultData = (() => {
  const today = DateService.now();
  const yIso = DateService.iso(DateService.yesterday(today));
  return {
    meta: { lastTagUpISO: yIso, tz: TZ, activeMemberId: "weston" },
    teamMembers: [
      { id: "weston",  name: "Weston Bragg", role: "Installations Engineer" },
      { id: "brian",   name: "Brian Burrer", role: "Engineer" },
      { id: "chase",   name: "Chase Cole", role: "Engineer" },
      { id: "gavin",   name: "Gavin Lasater", role: "Engineer" },
      { id: "holocom", name: "Holocom (subcontractor)", role: "Subcontractor" }
    ],
    tagups: [
      {
        dateISO: yIso,
        yesterdayText: "Completed BLDG 1289 drawing corrections; no blockers.",
        todayText: "Prep notes for PRTH TFR review; organize photo references.",
        risksText: "None."
      }
    ],
    tasks: [
      { id: "t1", title: "Finalize BLDG 1289 drawing corrections", ownerId: "weston",  dueISO: DateService.iso(today), priority: "High",   status: "In Progress" },
      { id: "t2", title: "Review PRTH TFR submittal",               ownerId: "brian",   dueISO: DateService.iso(today), priority: "Medium", status: "Not Started" },
      { id: "t3", title: "Draft RFI list for PRTH",                  ownerId: "chase",   dueISO: DateService.iso(DateService.yesterday(today)), priority: "Low", status: "Not Started" },
      { id: "t4", title: "Sanitize photo log (Appendix E)",          ownerId: "gavin",   dueISO: DateService.iso(today), priority: "Low",    status: "Not Started" },
      { id: "t5", title: "Cable mapping for Bldg 1289",              ownerId: "holocom", dueISO: DateService.iso(today), priority: "High",   status: "In Progress" }
    ],
    tfr: [],
    rfis: [],
    risks: []
  };
})();

let DB = null;

/* ----------------------- Load data ----------------------- */
async function loadData() {
  try {
    const res = await fetch("dashboard-data.json", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    DB = await res.json();
  } catch (e) {
    console.warn("Using in-memory default data (fetch failed):", e.message);
    DB = structuredClone(DefaultData);
  }
  if (!DB.meta) DB.meta = { lastTagUpISO: DateService.iso(DateService.now()), tz: TZ };
  if (!DB.meta.activeMemberId) DB.meta.activeMemberId = (DB.teamMembers?.[0]?.id) || "weston";
  if (!DB.teamMembers) DB.teamMembers = DefaultData.teamMembers;
}

/* ----------------------- Router ----------------------- */
const routes = {
  "/dashboard": renderDashboard,
  "/tagup": renderTagUp,
  "/tasks": renderTasks
};

function setActiveNav(hash) {
  const ids = ["nav-dashboard", "nav-tagup", "nav-tasks"];
  ids.forEach(id => document.getElementById(id)?.classList.remove("active"));
  if (hash.startsWith("#/dashboard")) document.getElementById("nav-dashboard")?.classList.add("active");
  if (hash.startsWith("#/tagup")) document.getElementById("nav-tagup")?.classList.add("active");
  if (hash.startsWith("#/tasks")) document.getElementById("nav-tasks")?.classList.add("active");
}

function router() {
  const hash = location.hash || "#/dashboard";
  setActiveNav(hash);
  const path = hash.replace(/^#/, "");
  const view = routes[path] || routes["/dashboard"];
  view();
  document.getElementById("app").focus();
}

/* ----------------------- Status Line ----------------------- */
function updateStatusLine() {
  const now = DateService.now();
  const time = DateService.timeString(now);
  const wk = DateService.weekNumber(now);
  const el = document.getElementById("status-line");
  if (el) el.textContent = `Local time: ${time} CT | Week ${String(wk).padStart(2, "0")}`;
}

/* ----------------------- Header member selector ----------------------- */
function populateMemberSelect() {
  const sel = document.getElementById("memberSelect");
  if (!sel) return;
  sel.innerHTML = "";
  DB.teamMembers.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.name;
    sel.appendChild(opt);
  });
  sel.value = DB.meta.activeMemberId;
  sel.addEventListener("change", () => {
    DB.meta.activeMemberId = sel.value;
    router();
  });
}

/* ----------------------- Helpers ----------------------- */
function memberName(id) {
  return DB.teamMembers.find(m => m.id === id)?.name || "Unassigned";
}

/* ----------------------- Renderers ----------------------- */
function renderDashboard() {
  const today = DateService.now();
  const todayFmt = DateService.format(today);
  const active = DB.meta.activeMemberId;

  const myDueToday = DB.tasks.filter(t => t.dueISO === DateService.iso(today) && t.ownerId === active).length;
  const teamNext7 = DB.tasks.filter(t => {
    const d = new Date(DBDateToUTC(t.dueISO));
    const todayUTC = stripToCTMidnightUTC(today);
    const diffDays = Math.floor((d - todayUTC) / 86400000);
    return diffDays >= 0 && diffDays < 7;
  }).length;

  const activeName = memberName(active);
  const activeNext7 = DB.tasks.filter(t => {
    const d = new Date(DBDateToUTC(t.dueISO));
    const todayUTC = stripToCTMidnightUTC(today);
    const diffDays = Math.floor((d - todayUTC) / 86400000);
    return diffDays >= 0 && diffDays < 7 && t.ownerId === active;
  }).length;

  const html = `
    <section class="card">
      <h2>Today — <span class="label">${todayFmt}</span></h2>
      <div class="kpi-row" role="group" aria-label="Dashboard KPIs">
        <div class="kpi" tabindex="0">
          <div class="label">My Tasks Due Today</div>
          <div class="num">${myDueToday}</div>
          <div class="label">${activeName}</div>
        </div>
        <div class="kpi" tabindex="0">
          <div class="label">Team Tasks (7d)</div>
          <div class="num">${teamNext7}</div>
          <div class="label">You: ${activeNext7}</div>
        </div>
        <div class="kpi" tabindex="0">
          <div class="label">RFIs</div>
          <div class="num">${DB.rfis.length}</div>
        </div>
        <div class="kpi" tabindex="0">
          <div class="label">Risks</div>
          <div class="num">${DB.risks.length}</div>
        </div>
      </div>
      <div class="button-row" style="margin-top:0.5rem;">
        <a href="#/tagup" class="btn" role="button">Open Daily Tag-Up</a>
        <a href="#/tasks" class="btn" role="button">Open Task Manager</a>
      </div>
    </section>

    <section class="card">
      <h3>TFR Progress by Site</h3>
      <p class="label">Phase 2 will wire this to real data.</p>
      <div class="button-row">
        <button type="button" onclick="alert('Sites table coming in Phase 2')">View Sites</button>
      </div>
    </section>
  `;
  document.getElementById("app").innerHTML = html;
  populateMemberSelect();
}

function renderTagUp() {
  const now = DateService.now();
  const active = DB.meta.activeMemberId;
  const yest = DateService.yesterday(now);

  const todayISO = DateService.iso(now);
  const todayLabel = DateService.format(now);
  const yestLabel = DateService.format(yest);

  const weekendYesterdayDefault = DateService.isWeekend(now) ? "Weekend — no project work logged." : "";

  const suggestions = DB.tasks
    .filter(t => t.dueISO === todayISO && t.ownerId === active)
    .map(t => `• ${t.title} (${memberName(t.ownerId)})`);
  const suggestionText = suggestions.length ? suggestions.join("\n") : "• —";

  const html = `
    <section class="card">
      <h2>Daily Tag-Up</h2>
      <div class="label">Timezone: ${TZ} • Member: ${memberName(active)}</div>
      <div class="section-row">
        <div>
          <h3>Yesterday — <span class="label">${yestLabel}</span></h3>
          <textarea id="yesterdayText" aria-label="Yesterday notes" placeholder="${weekendYesterdayDefault ? weekendYesterdayDefault : 'Add yesterday notes...'}">${weekendYesterdayDefault}</textarea>
        </div>
        <div>
          <h3>Today — <span class="label">${todayLabel}</span></h3>
          <textarea id="todayText" aria-label="Today notes" placeholder="Add today notes...">${suggestionText}</textarea>
        </div>
      </div>
      <div style="margin-top:0.75rem;">
        <h3>Risks / Impediments</h3>
        <textarea id="risksText" aria-label="Risks or impediments" placeholder="Any blockers or risks?">None.</textarea>
      </div>
      <div class="button-row" style="margin-top:0.75rem;">
        <button id="btn-copy" type="button">Copy to Clipboard</button>
        <button id="btn-save" type="button">Save (Phase 1: in-memory)</button>
        <a href="#/dashboard" class="btn" role="button">Back to Dashboard</a>
      </div>
      <p class="label" style="margin-top:0.5rem;">Phase 1 saves in memory. Persistence backend lands in Phase 2.</p>
    </section>
  `;
  const root = document.getElementById("app");
  root.innerHTML = html;
  populateMemberSelect();

  document.getElementById("btn-copy").addEventListener("click", () => {
    const y = document.getElementById("yesterdayText").value.trim();
    const t = document.getElementById("todayText").value.trim();
    const r = document.getElementById("risksText").value.trim();
    const blob = [
      `Yesterday (${yestLabel})`,
      y || "(no entry)",
      "",
      `Today (${todayLabel})`,
      t || "(no entry)",
      "",
      "Risks / Impediments",
      r || "(none)"
    ].join("\n");
    navigator.clipboard.writeText(blob).then(
      () => toast("Tag-Up copied to clipboard."),
      () => toast("Copy failed. Your browser may block clipboard without user gesture.")
    );
  });

  document.getElementById("btn-save").addEventListener("click", () => {
    const todayISO = DateService.iso(DateService.now());
    const yText = document.getElementById("yesterdayText").value.trim();
    const tText = document.getElementById("todayText").value.trim();
    const rText = document.getElementById("risksText").value.trim();

    const last = DB.meta.lastTagUpISO || todayISO;
    if (last < todayISO) {
      DB.tagups.push({
        dateISO: last,
        yesterdayText: "(rolled from prior)",
        todayText: "(rolled from prior)",
        risksText: "None."
      });
    }

    const idx = DB.tagups.findIndex(tu => tu.dateISO === todayISO);
    if (idx >= 0) {
      DB.tagups[idx].yesterdayText = yText;
      DB.tagups[idx].todayText = tText;
      DB.tagups[idx].risksText = rText;
    } else {
      DB.tagups.push({ dateISO: todayISO, yesterdayText: yText, todayText: tText, risksText: rText });
    }
    DB.meta.lastTagUpISO = todayISO;

    toast("Saved to in-memory store (Phase 1).");
  });
}

function renderTasks() {
  const todayISO = DateService.iso(DateService.now());
  const active = DB.meta.activeMemberId;

  const listItems = DB.tasks.map(t => {
    const dueLabel = t.dueISO;
    return `
      <li class="card" tabindex="0">
        <div class="inline">
          <strong>${t.title}</strong>
          <span class="label">Owner: ${memberName(t.ownerId)}</span>
          <span class="label">Priority: ${t.priority || "—"}</span>
          <span class="label">Status: ${t.status || "—"}</span>
          <span class="label">Due: ${dueLabel}${dueLabel === todayISO ? " (today)" : ""}</span>
        </div>
        <div class="button-row" style="margin-top:0.5rem;">
          <button type="button" onclick="alert('Edit modal coming in Phase 2')">Edit</button>
          <button type="button" onclick="alert('Complete toggle in Phase 2')">Complete</button>
          <button type="button" onclick="alert('Reassign in Phase 2')">Reassign</button>
        </div>
      </li>
    `;
  }).join("");

  const html = `
    <section class="card">
      <h2>Task Manager</h2>
      <div class="button-row" style="margin-bottom:0.75rem;">
        <button type="button" onclick="alert('Add task form coming in Phase 2')">Add Task</button>
        <button type="button" onclick="alert('Filter panel coming in Phase 2')">Filters</button>
        <a href="#/dashboard" class="btn" role="button">Back to Dashboard</a>
      </div>
      <p class="label">Active member: ${memberName(active)}</p>
      <ul role="list" style="list-style:none; padding:0; margin:0;">
        ${listItems || `<li class="card">No tasks yet.</li>`}
      </ul>
    </section>
  `;
  document.getElementById("app").innerHTML = html;
  populateMemberSelect();
}

/* ----------------------- Utilities ----------------------- */
function toast(msg) {
  const el = document.createElement("div");
  el.setAttribute("role", "status");
  el.className = "card";
  el.style.position = "fixed";
  el.style.right = "1rem";
  el.style.bottom = "3.2rem";
  el.style.zIndex = "9999";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

function DBDateToUTC(isoStr) {
  const [y, m, d] = isoStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 0, 0, 0);
}
function stripToCTMidnightUTC(date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const y = Number(parts.find(p => p.type === "year").value);
  const m = Number(parts.find(p => p.type === "month").value);
  const d = Number(parts.find(p => p.type === "day").value);
  return Date.UTC(y, m - 1, d, 0, 0, 0);
}

/* ----------------------- App bootstrap ----------------------- */
(async function init() {
  await loadData();

  const todayISO = DateService.iso(DateService.now());
  if ((DB.meta.lastTagUpISO || todayISO) < todayISO) {
    DB.tagups = DB.tagups || [];
    DB.tagups.push({
      dateISO: DB.meta.lastTagUpISO,
      yesterdayText: "(rolled)",
      todayText: "(rolled)",
      risksText: "None."
    });
    DB.meta.lastTagUpISO = todayISO;
  }

  populateMemberSelect();

  window.addEventListener("hashchange", router);
  router();

  updateStatusLine();
  setInterval(updateStatusLine, 30 * 1000);
})();
