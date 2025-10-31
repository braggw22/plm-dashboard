/* =========================================================
   PHASE 2.2 — IndexedDB persistence + real CRUD + SharePoint sync stubs
   ========================================================= */
const TZ = "America/Chicago";

/* ----------------------- App Config ----------------------- */
const AppConfig = {
  msal: { clientId: "YOUR_AZURE_AD_APP_CLIENT_ID", authority: "https://login.microsoftonline.com/YOUR_TENANT_ID", redirectUri: window.location.origin + window.location.pathname },
  graphScopes: ["User.Read","Files.ReadWrite.All","Sites.Read.All","Sites.ReadWrite.All","offline_access"],
  sharepoint: { siteHostname:"yourtenant.sharepoint.com", sitePath:"/sites/PLM", driveName:"Documents", folderPath:"/01 SCRUM", dataFileName:"dashboard-data.json" }
};
const STORAGE_KEY = "plm.config.v2";

/* ----------------------- DateService ----------------------- */
const DateService = (()=>{
  const fmtShort = new Intl.DateTimeFormat("en-US",{timeZone:TZ,weekday:"short",month:"short",day:"2-digit",year:"numeric"});
  const fmtTime  = new Intl.DateTimeFormat("en-US",{timeZone:TZ,hour:"2-digit",minute:"2-digit",hour12:true});
  const now = ()=> new Date();
  const format = d => fmtShort.format(d);
  const iso = d => {
    const parts = new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);
    const y = parts.find(p=>p.type==="year").value, m=parts.find(p=>p.type==="month").value, g=parts.find(p=>p.type==="day").value;
    return `${y}-${m}-${g}`;
  };
  const ymd = d => {
    const p = new Intl.DateTimeFormat("en-US",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);
    return {y:+p.find(x=>x.type==="year").value,m:+p.find(x=>x.type==="month").value,d:+p.find(x=>x.type==="day").value};
  };
  const dateFromLocalYMD = (y,m,d)=> new Date(Date.UTC(y,m-1,d,0,0,0));
  const isWeekend = d => { const {y,m,d:dd}=ymd(d); const wd=(dateFromLocalYMD(y,m,dd).getUTCDay()+7)%7; return wd===0||wd===6; };
  const yesterday = d => { const {y,m,d:dd}=ymd(d); const ct=dateFromLocalYMD(y,m,dd); return new Date(ct.getTime()-86400000); };
  const weekNumber = d => {
    const {y,m,d:dd}=ymd(d); const ct=dateFromLocalYMD(y,m,dd);
    const dayNum=(ct.getUTCDay()+6)%7; const thu=new Date(ct); thu.setUTCDate(thu.getUTCDate()-dayNum+3);
    const firstThu=new Date(Date.UTC(thu.getUTCFullYear(),0,4)); const firstDayNum=(firstThu.getUTCDay()+6)%7;
    firstThu.setUTCDate(firstThu.getUTCDate()-firstDayNum+3);
    return 1+Math.floor(Math.round((ct-firstThu)/86400000)/7);
  };
  const timeString = d => fmtTime.format(d);
  return {now,format,iso,isWeekend,yesterday,weekNumber,timeString};
})();

/* ----------------------- IDB ----------------------- */
const DB_NAME="plmDB"; const DB_VERSION=1; let idb;
function idbOpen(){ return new Promise((res,rej)=>{ const r=indexedDB.open(DB_NAME,DB_VERSION);
  r.onupgradeneeded=e=>{ const db=e.target.result;
    ["meta","teamMembers","tasks","tagups","rfis","risks","tfr"].forEach((s,i)=>{
      if(!db.objectStoreNames.contains(s)) db.createObjectStore(s,{keyPath: s==="meta"?"id":(s==="tagups"?"dateISO":"id")});
    });
  };
  r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });}
async function db(){ if(!idb) idb=await idbOpen(); return idb; }
function store(name,mode="readonly"){ return (d)=>d.transaction(name,mode).objectStore(name); }
async function put(name,val){ const d=await db(); return new Promise((res,rej)=>{ const r=store(name,"readwrite")(d).put(val); r.onsuccess=()=>res(val); r.onerror=()=>rej(r.error); }); }
async function bulkPut(name,vals){ for(const v of vals) await put(name,v); }
async function get(name,key){ const d=await db(); return new Promise((res,rej)=>{ const r=store(name)(d).get(key); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
async function getAll(name){ const d=await db(); return new Promise((res,rej)=>{ const r=store(name)(d).getAll(); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
async function clearStore(name){ const d=await db(); return new Promise((res,rej)=>{ const r=store(name,"readwrite")(d).clear(); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error); }); }

/* ----------------------- Seed ----------------------- */
const DefaultSeed=(()=>{ const t=DateService.now(); const yIso=DateService.iso(DateService.yesterday(t));
  return { meta:{id:"singleton",lastTagUpISO:yIso,tz:TZ,activeMemberId:"weston"},
    teamMembers:[
      {id:"weston",name:"Weston Bragg",role:"Installations Engineer"},
      {id:"brian",name:"Brian Burrer",role:"Engineer"},
      {id:"chase",name:"Chase Cole",role:"Engineer"},
      {id:"gavin",name:"Gavin Lasater",role:"Engineer"},
      {id:"holocom",name:"Holocom (subcontractor)",role:"Subcontractor"}
    ],
    tagups:[{dateISO:yIso,yesterdayText:"Completed BLDG 1289 drawing corrections; no blockers.",todayText:"Prep notes for PRTH TFR review; organize photo references.",risksText:"None."}],
    tasks:[
      {id:"t1",title:"Finalize BLDG 1289 drawing corrections",ownerId:"weston",dueISO:DateService.iso(t),priority:"High",status:"In Progress"},
      {id:"t2",title:"Review PRTH TFR submittal",ownerId:"brian",dueISO:DateService.iso(t),priority:"Medium",status:"Not Started"},
      {id:"t3",title:"Draft RFI list for PRTH",ownerId:"chase",dueISO:DateService.iso(DateService.yesterday(t)),priority:"Low",status:"Not Started"},
      {id:"t4",title:"Sanitize photo log (Appendix E)",ownerId:"gavin",dueISO:DateService.iso(t),priority:"Low",status:"Not Started"},
      {id:"t5",title:"Cable mapping for Bldg 1289",ownerId:"holocom",dueISO:DateService.iso(t),priority:"High",status:"In Progress"}
    ],
    tfr:[], rfis:[], risks:[]
  };
})();
async function ensureSeed(){ if(!(await get("meta","singleton"))){ await put("meta",DefaultSeed.meta); await bulkPut("teamMembers",DefaultSeed.teamMembers); await bulkPut("tagups",DefaultSeed.tagups); await bulkPut("tasks",DefaultSeed.tasks); await bulkPut("tfr",[]); await bulkPut("rfis",[]); await bulkPut("risks",[]);}}

/* ----------------------- Helpers ----------------------- */
function saveConfigToLocal(cfg){ localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); }
function loadConfigFromLocal(){ try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||null;}catch{ return null; } }
function toast(msg){ const el=document.createElement("div"); el.setAttribute("role","status"); el.className="card"; Object.assign(el.style,{position:"fixed",right:"1rem",bottom:"3.2rem",zIndex:"9999"}); el.textContent=msg; document.body.appendChild(el); setTimeout(()=>el.remove(),1800); }
function updateStatusLine(){ const n=DateService.now(); document.getElementById("status-line").textContent=`Local time: ${DateService.timeString(n)} CT | Week ${String(DateService.weekNumber(n)).padStart(2,"0")}`; }
function setActiveNav(hash){ ["nav-dashboard","nav-tagup","nav-tasks","nav-settings"].forEach(id=>document.getElementById(id)?.classList.remove("active")); if(hash.startsWith("#/dashboard")) document.getElementById("nav-dashboard")?.classList.add("active"); if(hash.startsWith("#/tagup")) document.getElementById("nav-tagup")?.classList.add("active"); if(hash.startsWith("#/tasks")) document.getElementById("nav-tasks")?.classList.add("active"); if(hash.startsWith("#/settings")) document.getElementById("nav-settings")?.classList.add("active"); }
function modal(html,{title="Edit"}={}){ const root=document.getElementById("modal-root"); root.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-label="${title}">${html}</div>`; root.hidden=false; root.setAttribute("aria-hidden","false"); function close(){ root.hidden=true; root.setAttribute("aria-hidden","true"); root.innerHTML=""; } root.addEventListener("click",e=>{ if(e.target===root) close(); }); return {close}; }

/* ----------------------- Members ----------------------- */
async function memberList(){ return await getAll("teamMembers"); }
function memberNameSync(members,id){ return members.find(m=>m.id===id)?.name || "Unassigned"; }
async function populateMemberSelect(meta){ const sel=document.getElementById("memberSelect"); if(!sel) return; const members=await memberList(); sel.innerHTML=""; members.forEach(m=>{ const o=document.createElement("option"); o.value=m.id; o.textContent=m.name; sel.appendChild(o); }); sel.value=meta.activeMemberId; sel.onchange=async()=>{ meta.activeMemberId=sel.value; await put("meta",meta); router(); }; }

/* ----------------------- Dashboard ----------------------- */
async function renderDashboard(){
  const meta=await get("meta","singleton"); const t=DateService.now(); const todayISO=DateService.iso(t); const tasks=await getAll("tasks"); const members=await memberList();
  const myDueToday=tasks.filter(x=>x.dueISO===todayISO && x.ownerId===meta.activeMemberId && x.status!=="Completed").length;
  const next7=tasks.filter(x=>{ const due=new Date(Date.parse(x.dueISO+"T00:00:00Z")); const start=new Date(Date.parse(todayISO+"T00:00:00Z")); const diff=Math.floor((due-start)/86400000); return diff>=0&&diff<7 && x.status!=="Completed"; }).length;
  const html=`<section class="card">
    <h2>Today — <span class="label">${DateService.format(t)}</span></h2>
    <div class="kpi-row">
      <div class="kpi" tabindex="0"><div class="label">My Tasks Due Today</div><div class="num">${myDueToday}</div><div class="label">${memberNameSync(members,meta.activeMemberId)}</div></div>
      <div class="kpi" tabindex="0"><div class="label">Team Tasks (7d)</div><div class="num">${next7}</div><div class="label">Open only</div></div>
      <div class="kpi" tabindex="0"><div class="label">RFIs</div><div class="num">${(await getAll("rfis")).length}</div></div>
      <div class="kpi" tabindex="0"><div class="label">Risks</div><div class="num">${(await getAll("risks")).length}</div></div>
    </div>
    <div class="button-row" style="margin-top:.5rem;">
      <a class="btn" href="#/tagup" role="button">Open Daily Tag-Up</a>
      <a class="btn" href="#/tasks" role="button">Open Task Manager</a>
    </div>
  </section>
  <section class="card"><h3>TFR Progress by Site</h3><p class="label">Hookups land in Phase 2.3.</p></section>`;
  document.getElementById("app").innerHTML=html; await populateMemberSelect(meta);
}

/* ----------------------- Tag-Up ----------------------- */
let tagupSaveTimer=null;
async function renderTagUp(){
  const meta=await get("meta","singleton"); const now=DateService.now(); const todayISO=DateService.iso(now); const yDate=DateService.yesterday(now); const yISO=DateService.iso(yDate);
  const weekendDefault=DateService.isWeekend(now)?"Weekend — no project work logged.":"";
  if(meta.lastTagUpISO<todayISO){ if(!(await get("tagups",meta.lastTagUpISO))) await put("tagups",{dateISO:meta.lastTagUpISO,yesterdayText:"(rolled)",todayText:"(rolled)",risksText:"None."}); meta.lastTagUpISO=todayISO; await put("meta",meta); }
  let rec=await get("tagups",todayISO); if(!rec){ rec={dateISO:todayISO,yesterdayText:weekendDefault,todayText:"",risksText:"None."}; await put("tagups",rec); }
  const tasks=await getAll("tasks"); const suggestions=tasks.filter(t=>t.dueISO===todayISO && t.ownerId===meta.activeMemberId && t.status!=="Completed").map(t=>"• "+t.title).join("\n") || "• —";
  const html=`<section class="card">
    <h2>Daily Tag-Up</h2>
    <div class="label">Timezone: ${TZ} • Member: ${memberNameSync(await memberList(),meta.activeMemberId)}</div>
    <div class="section-row">
      <div><h3>Yesterday — <span class="label">${DateService.format(yDate)}</span></h3>
        <textarea id="yesterdayText" placeholder="${weekendDefault || "Add yesterday notes..."}">${rec.yesterdayText || weekendDefault}</textarea></div>
      <div><h3>Today — <span class="label">${DateService.format(now)}</span></h3>
        <textarea id="todayText" placeholder="Add today notes...">${rec.todayText || suggestions}</textarea></div>
    </div>
    <div style="margin-top:.75rem;"><h3>Risks / Impediments</h3>
      <textarea id="risksText" placeholder="Any blockers or risks?">${rec.risksText || "None."}</textarea></div>
    <div class="button-row" style="margin-top:.75rem;">
      <button id="btn-copy" type="button">Copy to Clipboard</button>
      <button id="btn-save" type="button">Save Now</button>
      <a href="#/dashboard" class="btn" role="button">Back to Dashboard</a>
    </div></section>`;
  document.getElementById("app").innerHTML=html; await populateMemberSelect(meta);
  function schedule(){ clearTimeout(tagupSaveTimer); tagupSaveTimer=setTimeout(async()=>{ const rec={dateISO:todayISO,yesterdayText:document.getElementById("yesterdayText").value,todayText:document.getElementById("todayText").value,risksText:document.getElementById("risksText").value}; await put("tagups",rec); await put("meta",{...meta,lastTagUpISO:todayISO}); toast("Autosaved."); },600); }
  ["yesterdayText","todayText","risksText"].forEach(id=>document.getElementById(id).addEventListener("input",schedule));
  document.getElementById("btn-save").onclick=async()=>{ await put("tagups",{dateISO:todayISO,yesterdayText:document.getElementById("yesterdayText").value,todayText:document.getElementById("todayText").value,risksText:document.getElementById("risksText").value}); await put("meta",{...meta,lastTagUpISO:todayISO}); toast("Saved."); };
  document.getElementById("btn-copy").onclick=()=>{ const y=document.getElementById("yesterdayText").value.trim(); const t=document.getElementById("todayText").value.trim(); const r=document.getElementById("risksText").value.trim(); const blob=[`Yesterday (${DateService.format(yDate)})`, y||"(no entry)","",`Today (${DateService.format(now)})`, t||"(no entry)","", "Risks / Impediments", r||"(none)"].join("\n"); navigator.clipboard.writeText(blob).then(()=>toast("Copied."),()=>toast("Copy blocked.")); };
}

/* ----------------------- Tasks ----------------------- */
function uid(){ return "t"+Math.random().toString(36).slice(2,9); }
async function renderTasks(){
  const meta=await get("meta","singleton"); const members=await memberList(); const allTasks=await getAll("tasks"); let showCompleted=JSON.parse(localStorage.getItem("plm.showCompleted")||"false"); const tasks=allTasks.filter(t=>showCompleted||t.status!=="Completed");
  const list=tasks.map(t=>`<li class="card" tabindex="0"><div class="inline"><strong>${t.title}</strong>
    <span class="label">Owner: ${memberNameSync(members,t.ownerId)}</span><span class="label">Priority: ${t.priority||"—"}</span><span class="label">Status: ${t.status||"—"}</span><span class="label">Due: ${t.dueISO}${t.dueISO===DateService.iso(DateService.now())?" (today)":""}</span></div>
    <div class="button-row" style="margin-top:.5rem;"><button onclick="taskEdit('${t.id}')">Edit</button><button onclick="taskComplete('${t.id}')">Complete</button><button onclick="taskReassign('${t.id}')">Reassign</button></div></li>`).join("");
  const html=`<section class="card"><h2>Task Manager</h2>
    <div class="button-row" style="margin-bottom:.75rem;"><button onclick="taskAdd()">Add Task</button><button id="toggle-completed" class="ghost">${showCompleted?"Hide Completed":"Show Completed"}</button><a href="#/dashboard" class="btn" role="button">Back to Dashboard</a></div>
    <p class="label">Active member: ${memberNameSync(members,meta.activeMemberId)}</p>
    <ul role="list" style="list-style:none;padding:0;margin:0;">${list || '<li class="card">No tasks yet.</li>'}</ul></section>`;
  document.getElementById("app").innerHTML=html; await populateMemberSelect(meta); document.getElementById("toggle-completed").onclick=()=>{ localStorage.setItem("plm.showCompleted",JSON.stringify(!showCompleted)); renderTasks(); };
}
window.taskAdd=async function(){ const members=await memberList(); const opts=members.map(m=>`<option value="${m.id}">${m.name}</option>`).join(""); const content=`<h3>Add Task</h3><div class="grid">
  <div><label class="label">Title</label><input id="t-title" type="text"/></div>
  <div><label class="label">Owner</label><select id="t-owner">${opts}</select></div>
  <div><label class="label">Due Date</label><input id="t-due" type="date"/></div>
  <div><label class="label">Priority</label><select id="t-priority"><option>Low</option><option>Medium</option><option>High</option></select></div>
</div><div class="actions"><button class="ghost" id="cancel">Cancel</button><button id="save">Save</button></div>`; const m=modal(content,{title:"Add Task"});
  document.getElementById("cancel").onclick=()=>m.close(); document.getElementById("save").onclick=async()=>{ const task={id:uid(),title:document.getElementById("t-title").value.trim(),ownerId:document.getElementById("t-owner").value,dueISO:document.getElementById("t-due").value||DateService.iso(DateService.now()),priority:document.getElementById("t-priority").value,status:"Not Started"}; await put("tasks",task); m.close(); toast("Task added."); renderTasks(); };
};
window.taskEdit=async function(id){ const t=(await getAll("tasks")).find(x=>x.id===id); if(!t) return; const members=await memberList(); const content=`<h3>Edit Task</h3><div class="grid">
  <div><label class="label">Title</label><input id="t-title" type="text" value="${t.title}"/></div>
  <div><label class="label">Owner</label><select id="t-owner">${members.map(m=>`<option value="${m.id}" ${m.id===t.ownerId?"selected":""}>${m.name}</option>`).join("")}</select></div>
  <div><label class="label">Due Date</label><input id="t-due" type="date" value="${t.dueISO}"/></div>
  <div><label class="label">Priority</label><select id="t-priority"><option ${t.priority==="Low"?"selected":""}>Low</option><option ${t.priority==="Medium"?"selected":""}>Medium</option><option ${t.priority==="High"?"selected":""}>High</option></select></div>
  <div><label class="label">Status</label><select id="t-status"><option ${t.status==="Not Started"?"selected":""}>Not Started</option><option ${t.status==="In Progress"?"selected":""}>In Progress</option><option ${t.status==="Blocked"?"selected":""}>Blocked</option><option ${t.status==="Completed"?"selected":""}>Completed</option></select></div>
</div><div class="actions"><button class="ghost" id="cancel">Cancel</button><button id="save">Save</button></div>`; const m=modal(content,{title:"Edit Task"});
  document.getElementById("cancel").onclick=()=>m.close(); document.getElementById("save").onclick=async()=>{ t.title=document.getElementById("t-title").value.trim(); t.ownerId=document.getElementById("t-owner").value; t.dueISO=document.getElementById("t-due").value; t.priority=document.getElementById("t-priority").value; t.status=document.getElementById("t-status").value; await put("tasks",t); m.close(); toast("Task saved."); renderTasks(); };
};
window.taskComplete=async function(id){ const t=(await getAll("tasks")).find(x=>x.id===id); if(!t) return; t.status="Completed"; t.completedISO=DateService.iso(DateService.now()); await put("tasks",t); toast("Completed."); renderTasks(); };
window.taskReassign=async function(id){ const t=(await getAll("tasks")).find(x=>x.id===id); if(!t) return; const members=await memberList(); const content=`<h3>Reassign Task</h3><div><label class="label">New Owner</label><select id="t-owner">${members.map(m=>`<option value="${m.id}" ${m.id===t.ownerId?"selected":""}>${m.name}</option>`).join("")}</select></div><div class="actions"><button class="ghost" id="cancel">Cancel</button><button id="save">Reassign</button></div>`; const m=modal(content,{title:"Reassign Task"}); document.getElementById("cancel").onclick=()=>m.close(); document.getElementById("save").onclick=async()=>{ t.ownerId=document.getElementById("t-owner").value; await put("tasks",t); m.close(); toast("Reassigned."); renderTasks(); }; };

/* ----------------------- Settings (SharePoint stubs) ----------------------- */
let msalClient=null, account=null;
function initMsal(){ const persisted=loadConfigFromLocal(); if(persisted?.msal?.clientId) AppConfig.msal.clientId=persisted.msal.clientId; if(persisted?.msal?.authority) AppConfig.msal.authority=persisted.msal.authority;
  try{ msalClient=new msal.PublicClientApplication({auth:AppConfig.msal,cache:{cacheLocation:"localStorage",storeAuthStateInCookie:true}}); const accts=msalClient.getAllAccounts(); if(accts.length) account=accts[0]; }catch{}
  updateConnLine();
}
async function login(){ try{ const r=await msalClient.loginPopup({scopes:AppConfig.graphScopes}); account=r.account; updateConnLine("Signed in as "+(account?.username||account?.name||"user")); }catch(e){ toast("Login failed: "+e.message); } }
async function logout(){ try{ await msalClient.logoutPopup({account}); account=null; updateConnLine("Signed out"); }catch(e){ toast("Logout failed: "+e.message); } }
function updateConnLine(text){ const el=document.getElementById("conn-line"); if(!el) return; el.textContent=text || (account?`Signed in as ${account.username||account.name}`:"Not connected"); }

async function exportDB(){ return { meta:await get("meta","singleton"), teamMembers:await getAll("teamMembers"), tasks:await getAll("tasks"), tagups:await getAll("tagups"), rfis:await getAll("rfis"), risks:await getAll("risks"), tfr:await getAll("tfr") }; }
async function importDB(json){ await clearStore("meta"); await put("meta", json.meta || {id:"singleton",tz:TZ,lastTagUpISO:DateService.iso(DateService.yesterday(DateService.now()))}); for(const s of ["teamMembers","tasks","tagups","rfis","risks","tfr"]){ await clearStore(s); await bulkPut(s,json[s]||[]);} }

async function renderSettings(){
  const cfg=loadConfigFromLocal()||AppConfig; const s=cfg.sharepoint||AppConfig.sharepoint; const m=cfg.msal||AppConfig.msal;
  const html=`<section class="card"><h2>Settings — Sync & Auth</h2>
    <div class="section-row">
      <div><h3>Azure AD App (SPA)</h3>
        <label class="label">Client ID</label><input id="inp-clientId" type="text" value="${m.clientId||""}"/>
        <label class="label">Authority (tenant)</label><input id="inp-authority" type="url" value="${m.authority||""}"/>
        <div class="button-row" style="margin-top:.5rem;"><button id="btn-savecfg" type="button">Save Config</button><button id="btn-login" type="button">Sign In</button><button id="btn-logout" type="button">Sign Out</button></div>
      </div>
      <div><h3>SharePoint</h3>
        <label class="label">Site Hostname</label><input id="inp-host" type="text" value="${s.siteHostname||""}"/>
        <label class="label">Site Path</label><input id="inp-sitepath" type="text" value="${s.sitePath||""}"/>
        <label class="label">Library Name</label><input id="inp-drive" type="text" value="${s.driveName||"Documents"}"/>
        <label class="label">Folder Path</label><input id="inp-folder" type="text" value="${s.folderPath||"/01 SCRUM"}"/>
        <label class="label">Data File</label><input id="inp-file" type="text" value="${s.dataFileName||"dashboard-data.json"}"/>
        <div class="button-row" style="margin-top:.5rem;"><button id="btn-download" type="button">Download JSON</button><input id="file-upload" type="file" accept="application/json" style="display:none;"/><button id="btn-upload" class="ghost" type="button">Import JSON</button></div>
        <p class="label small">Graph Push/Pull available once credentials are set in a later step.</p>
      </div>
    </div></section>`;
  document.getElementById("app").innerHTML=html;
  await populateMemberSelect(await get("meta","singleton"));
  document.getElementById("btn-savecfg").onclick=()=>{ const newCfg={msal:{clientId:document.getElementById("inp-clientId").value.trim(),authority:document.getElementById("inp-authority").value.trim(),redirectUri:window.location.origin+window.location.pathname},graphScopes:AppConfig.graphScopes,sharepoint:{siteHostname:document.getElementById("inp-host").value.trim(),sitePath:document.getElementById("inp-sitepath").value.trim(),driveName:document.getElementById("inp-drive").value.trim()||"Documents",folderPath:document.getElementById("inp-folder").value.trim()||"/",dataFileName:document.getElementById("inp-file").value.trim()||"dashboard-data.json"}}; saveConfigToLocal(newCfg); toast("Config saved."); };
  document.getElementById("btn-login").onclick=()=>login(); document.getElementById("btn-logout").onclick=()=>logout();
  document.getElementById("btn-download").onclick=async()=>{ const data=await exportDB(); const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"})); const a=document.createElement("a"); a.href=url; a.download="plm-dashboard-data.json"; a.click(); URL.revokeObjectURL(url); };
  document.getElementById("btn-upload").onclick=()=>document.getElementById("file-upload").click();
  document.getElementById("file-upload").onchange=async e=>{ const f=e.target.files[0]; if(!f) return; const txt=await f.text(); await importDB(JSON.parse(txt)); toast("Imported JSON."); router(); };
}

/* ----------------------- Router ----------------------- */
const routes={"/dashboard":renderDashboard,"/tagup":renderTagUp,"/tasks":renderTasks,"/settings":renderSettings};
function router(){ const hash=location.hash||"#/dashboard"; setActiveNav(hash); const path=hash.replace(/^#/,""); const view=routes[path]||routes["/dashboard"]; view(); document.getElementById("app").focus(); }

/* ----------------------- Boot ----------------------- */
(async function init(){
  await db(); await ensureSeed();
  initMsal();
  window.addEventListener("hashchange", router);
  router();
  updateStatusLine(); setInterval(updateStatusLine,30000);
})();