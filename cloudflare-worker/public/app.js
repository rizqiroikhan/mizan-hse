import {read, write} from './db.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = (v = '') => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => crypto.randomUUID();
const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const monthNow = () => localDate().slice(0,7);
const fmt = (date, opts = {}) => date ? new Intl.DateTimeFormat('en-GB', {day:'numeric',month:'short',...opts}).format(new Date(date.length === 10 ? date+'T12:00:00' : date)) : '—';
const label = s => ({awaiting_verification:'Awaiting verification',in_progress:'In progress',submitted:'Awaiting review',approved:'Approved',returned:'Returned',open:'Open',closed:'Closed',pass:'Pass',fail:'Fail',na:'N/A',missing:'Missing',expired:'Expired',resolved:'Resolved',Patrol:'Safety patrol',staff:'HSE Staff',manager:'HSE Supervisor',supervisor:'HSE Manager',management:'Management'}[s] || s);
const stagingLoginAccounts = {staff:'pilot_staff',manager:'pilot_supervisor',supervisor:'pilot_manager',management:'pilot_management'};
const stagingHost = location.hostname === 'hse.ssnai.org';
const roleForLoginValue = value => stagingHost
  ? Object.entries(stagingLoginAccounts).find(([, account]) => account === value)?.[0]
  : value;
const syncLoginRoleUI = value => {
  const role = roleForLoginValue(value);
  $$('.role-chip').forEach(b => b.classList.toggle('selected', b.dataset.role === role));
  const hint = $('#login-role-hint');
  if (hint) hint.textContent = role ? `${label(role)} · ${stagingHost ? stagingLoginAccounts[role] : role}` : 'Choose a workspace role';
};
const icons = {
 grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
 clipboard:'M9 4H6a2 2 0 0 0-2 2v14h16V6a2 2 0 0 0-2-2h-3M9 2h6v5H9zM8 12h8M8 16h5',
 box:'m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9M7.5 5.5l9 5',
 flag:'M5 22V3m0 1c5-4 9 4 15 0v10c-6 4-10-4-15 0',
 shield:'m12 2 9 4v6c0 5-6 9-9 10-3-1-9-5-9-10V6zM8 12l3 3 5-6',
 chart:'M4 3v17h17M8 15v-4M13 15V7M18 15v-7',
 settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3l-1 3-3 1-2 3 2 2-1 3 3 3 3-1 2 3 3-2 2-2-1-3 3-2-1-4-3-1-1-3z',
 arrow:'M5 12h14m-5-5 5 5-5 5', chevron:'m9 5 7 7-7 7',down:'m6 9 6 6 6-6',
 plus:'M12 5v14M5 12h14', search:'M21 21l-5-5M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14',
 bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
 calendar:'M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2M7 2v6M17 2v6M3 11h18',
 location:'M12 22s8-8 8-14a8 8 0 0 0-16 0c0 6 8 14 8 14M12 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
 building:'M4 21V4h10v17M14 10h6v11M2 21h20M7 8h4M7 12h4M7 16h4M17 14v2',
 check:'m5 12 4 4L19 6', circle:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M8 12l3 3 5-6',
 clock:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M12 6v6l4 2',
 alert:'m12 3 10 18H2zM12 9v5M12 17v1', file:'M14 2H4v20h16V8zM14 2v6h6M8 13h8M8 17h5',
 download:'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4', upload:'M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4',
 refresh:'M20 8A8 8 0 0 0 6 5L3 8M3 3v5h5M4 16a8 8 0 0 0 14 3l3-3M21 21v-5h-5',
 wifi:'M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8 16a6 6 0 0 1 8 0M12 20h.01',
 offline:'M2 2l20 20M5 12a11 11 0 0 1 5-2M14 10a11 11 0 0 1 5 2M8 16a6 6 0 0 1 8 0M12 20h.01M2 8a16 16 0 0 1 4-2M10 4a16 16 0 0 1 12 4',
 fire:'M14 2c1 6-5 6-3 12-3-1-4-3-4-5-6 7-3 13 5 13s11-10 2-20z',
 hydrant:'M8 8V5h8v3M7 8h10v12H7zM3 11h4v5H3zM17 11h4v5h-4zM5 22h14M8 3h8M10 12h4',
 medical:'M3 6h18v15H3zM8 6V3h8v3M12 10v7M8.5 13.5h7',
 patrol:'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6zM8 12l3 3 5-6',
 leaf:'M20 3c1 11-3 18-10 17-9-1-9-13 0-15zM4 22 15 10',
 close:'M6 6l12 12M6 18 18 6', menu:'M4 6h16M4 12h16M4 18h16',
 camera:'M8 5l2-3h4l2 3h5v16H3V5zM12 8a5 5 0 1 0 0 10 5 5 0 0 0 0-10',
 user:'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4 22v-3a8 8 0 0 1 16 0v3',
 logout:'M9 3H3v18h6M9 12h12m-5-5 5 5-5 5', qr:'M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h2v2h-2zM19 15h2v6h-6v-2',
 info:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M12 11v6M12 7v1',
 archive:'M3 3h18v5H3zM5 8v13h14V8M9 12h6', edit:'m15 3 6 6-12 12H3v-6zM12 6l6 6',
 lock:'M5 10h14v12H5zM8 10V6a4 4 0 0 1 8 0v4M12 14v4', trash:'M3 6h18M8 6V3h8v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name] || icons.clipboard}"/></svg>`;
const badge = (status, text) => `<span class="badge ${['pass','approved','closed','resolved'].includes(status)?'green':['fail','expired','missing','critical','high'].includes(status)?'red':['open','medium','submitted','awaiting_verification'].includes(status)?'amber':status==='in_progress'?'blue':'gray'}"><span class="dot"></span>${esc(text || label(status))}</span>`;
const typeIcon = type => `<span class="type-icon ${type.toLowerCase()}">${icon({APAR:'fire',Hydrant:'hydrant',P3K:'medical',Patrol:'patrol'}[type])}</span>`;
let user = null, state = null, queue = [], drafts = [], page = 'overview', siteFilter = 'all', period = monthNow(), listFilter = 'all', search = '', isOnline = navigator.onLine, syncing = false, syncedAt = null, form = null, formPhotos = [], lastFocus = null, photoBusy = false, saveTimer = null;
const app = $('#app');
const canInspect = () => ['staff','manager','supervisor'].includes(user?.role);
const canReview = () => ['manager','supervisor'].includes(user?.role);
const siteName = id => state?.sites.find(s=>s.id===id)?.name || 'Unknown site';
const myQueue = () => queue.filter(q=>q.userId===user?.id);
const myDrafts = () => drafts.filter(d=>d.userId===user?.id);
const matchSite = x => siteFilter==='all' || x.siteId===siteFilter;
const inspections = () => state.inspections.filter(i=>matchSite(i) && (!period || i.period===period));
const approved = () => inspections().filter(i=>i.status==='approved');
const findings = () => state.findings.filter(matchSite);
const assets = () => state.assets.filter(matchSite);
function score(rows) {
  let pass=0,total=0;
  for(const r of rows) for(const a of r.answers || []) if(a.status!=='na') { total++; if(a.status==='pass') pass++; }
  return {pass,total,value:total?Math.round(pass/total*100):null};
}
const percent = val => val===null ? '—' : val+'%';
const btn = (action, text, ico='', cls='', attrs='') => `<button class="btn ${cls}" data-action="${action}" ${attrs}>${ico?icon(ico):''}${text}</button>`;
const empty = (title, text, action='') => `<div class="empty">${icon('leaf')}<h3>${title}</h3><p>${text}</p>${action}</div>`;
function toast(message, error=false) {
  $('#toast-root').innerHTML=`<div class="toast ${error?'error':''}" role="status">${esc(message)}</div>`;
  setTimeout(()=>$('#toast-root').replaceChildren(),5500);
}
async function api(path, body) {
  const res=await fetch('/api/'+path,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json','X-Requested-With':'mizan-hse'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(18000)});
  const data=await res.json();
  if(!res.ok){const err=new Error(data.error || 'Request failed');err.status=res.status;throw err;}
  return data;
}
async function persistLocal() { await write('queue',queue); await write('drafts',drafts); }
async function refreshState() {
  state=await api('state'); syncedAt=new Date().toISOString(); isOnline=true;
  await write('state',state); await write('syncedAt',syncedAt);
}
async function synchronize(quiet=false) {
  if(syncing || !user) return;
  syncing=true;
  try {
    for(const op of myQueue().filter(q=>!q.error)) {
      try { await api('operations',op); queue=queue.filter(q=>q.id!==op.id); await write('queue',queue); }
      catch(e){
        if(!e.status || e.status>=500) throw e;
        op.error=e.message;op.errorStatus=e.status;await write('queue',queue);
        if(e.status===401) break;
      }
    }
    await refreshState();
    if(!quiet) toast(myQueue().length?'Some changes need attention. Open Sync center.':'Workspace is up to date.');
  } catch(e) { if(!e.status) isOnline=false; if(!quiet) toast(e.status===401?'Session expired. Sign in again; local drafts are preserved.':'Server unavailable. Your work is saved on this device.',true); }
  finally { syncing=false;if(state) render(); }
}
async function enqueue(kind,data,expectedRevision) {
  const op={id:uid(),kind,data:structuredClone(data),expectedRevision,userId:user.id,queuedAt:new Date().toISOString()};
  queue.push(op);await write('queue',queue);
  toast('Saved on this device. Synchronizing when connected.');
  await synchronize(true);
  return op;
}

function renderLogin() {
  const defaultRole = 'manager';
  const defaultAccount = stagingHost ? stagingLoginAccounts[defaultRole] : defaultRole;
  app.innerHTML=`<main class="login"><section class="login-story"><div class="brand"><div class="brand-mark">m</div><div><div class="brand-name">mizan<span>.</span></div><div class="brand-caption">HSE WORKSPACE</div></div></div><div><div class="heading-label" style="color:#aeca93">CARE IN EVERY CHECK</div><h1>Safer spaces.<br><em>Less paperwork.</em></h1><p>Bring your inspections, corrective actions, and people together. Wherever work takes you.</p><div class="login-tags"><span>${icon('offline')} Offline ready</span><span>${icon('building')} Multiple sites</span></div></div><footer>Built for the people who keep workplaces safe.</footer></section><section class="login-form-side"><form id="login-form" class="login-form"><div class="heading-label">YOUR HSE, CONNECTED</div><h2>Welcome to Mizan</h2><p>Sign in to your workspace. A clearer picture of workplace safety starts here.</p><div class="field"><label for="login-user">Sign-in account</label><input id="login-user" type="text" name="username" autocomplete="username" list="login-users" value="${defaultAccount}" required><div id="login-role-hint" class="muted" style="font-size:11px;margin-top:7px">${label(defaultRole)} · ${defaultAccount}</div><datalist id="login-users">${['staff','manager','supervisor','management'].map(r=>{const account=stagingHost?stagingLoginAccounts[r]:r;return `<option value="${account}">${label(r)}</option>`;}).join('')}</datalist></div><div class="field"><label for="login-password">Password</label><input id="login-password" name="password" type="password" autocomplete="current-password" required></div><button class="btn primary" type="submit">Enter workspace ${icon('arrow')}</button><div class="login-error" id="login-error" aria-live="polite"></div><div class="demo-accounts"><div class="eyebrow" style="margin-bottom:9px">Explore the MVP</div><p>Fictional sample data · choose a role to try its workflow.</p><div class="role-chips">${['staff','manager','supervisor','management'].map(r=>`<button type="button" class="role-chip ${r===defaultRole?'selected':''}" data-action="select-role" data-role="${r}" data-staging-account="${stagingLoginAccounts[r]}" aria-label="${label(r)} (${stagingLoginAccounts[r]})">${label(r)}</button>`).join('')}</div></div><p style="font-size:10px;color:#939c89;line-height:1.7;margin-top:19px">Connect once to download your workspace. After that, field inspections and photos can be saved offline on this device.</p></form></section></main>`;
}
const titles={overview:'Overview',inspections:'Inspections',equipment:'Equipment',findings:'Corrective actions',review:'Review queue',reports:'Reports',settings:'Workspace settings',sync:'Sync center'};
function render(){
  if(!user || !state){renderLogin();return;}
  const openFlags=state.flags.filter(f=>f.status==='open').length;
  const waiting=state.findings.filter(f=>f.status==='awaiting_verification').length;
  const nav=(id,name,ico,count=0)=>`<button data-action="nav" data-page="${id}" class="${page===id?'active':''}" ${page===id?'aria-current="page"':''}>${icon(ico)}${name}${count?`<span class="count">${count}</span>`:''}</button>`;
  app.innerHTML=`<div class="shell"><div class="mobile-shade" data-action="menu-close"></div><aside class="sidebar"><div class="brand"><div class="brand-mark">m</div><div><div class="brand-name">mizan<span>.</span></div><div class="brand-caption">HSE WORKSPACE</div></div></div><div class="nav-caption">WORKSPACE</div><nav class="nav" aria-label="Main navigation">${nav('overview','Overview','grid')}${nav('inspections','Inspections','clipboard')}${nav('equipment','Equipment','box')}${nav('findings','Corrective actions','flag',waiting)}${nav('review','Review queue','shield',openFlags)}${nav('reports','Reports','chart')}</nav><div class="nav-caption" style="margin-top:16px">MANAGE</div><nav class="nav" aria-label="Workspace management">${nav('sync','Sync center','refresh',myQueue().length)}${nav('settings','Settings','settings')}</nav><div class="sidebar-bottom"><div class="field-note">${icon('leaf')}<h3>Small checks.<br>Safer spaces.</h3><p>Your next inspection<br>makes a difference.</p></div><div class="sidebar-status"><span class="dot"></span>${isOnline?'Workspace connected':'Offline · drafts available'}</div></div></aside><main class="main"><header class="topbar"><div class="row"><button class="icon-btn mobile-menu" data-action="menu" aria-label="Open navigation">${icon('menu')}</button><div class="breadcrumb"><span class="workspace-label">Workspace</span><span class="workspace-label">/</span><b>${titles[page]}</b></div></div><div class="top-actions"><button class="search-trigger" data-action="search">${icon('search')}<span>Find equipment</span><span class="keycap">/</span></button><button class="icon-btn" data-action="nav" data-page="review" aria-label="Open review queue">${icon('bell')}</button><span class="separator"></span><button class="btn ghost profile" data-action="nav" data-page="settings" aria-label="Account and settings"><span class="avatar">${user.role==='management'?'MG':'HS'}</span><span class="profile-text"><b>${esc(user.name)}</b><small>${user.role==='management'?'Read-only access':'HSE workspace'}</small></span>${icon('down')}</button></div></header>${!isOnline?`<div class="offline-banner">${icon('offline')}You’re offline. Inspections and photos stay on this device until synchronization.</div>`:myQueue().some(q=>q.error)?`<div class="offline-banner">${icon('alert')}${myQueue().filter(q=>q.error).length} change(s) need attention in Sync center.</div>`:''}<div class="content">${({overview:renderOverview,inspections:renderInspections,equipment:renderEquipment,findings:renderFindings,review:renderReview,reports:renderReports,settings:renderSettings,sync:renderSync}[page])()}<footer class="footer"><span class="row">${icon('shield')} Mizan HSE · Care in every check</span><span>Sample workspace · ${syncedAt?'Last synchronized '+fmt(syncedAt,{hour:'2-digit',minute:'2-digit'}):'Not yet synchronized'}</span></footer></div></main></div>`;
}
function heading(title,sub,action='',eyebrow='YOUR WORKPLACE, AT A GLANCE'){
  return `<div class="page-heading"><div><div class="heading-label">${eyebrow}</div><h1>${title}</h1><p>${sub}</p></div>${action}</div>`;
}
function toolbar(withPeriod=true){
  return `<div class="toolbar"><div class="filters"><label class="filter">${icon('building')}<select data-filter="site" aria-label="Filter by site"><option value="all">All sites</option>${state.sites.map(s=>`<option value="${s.id}" ${siteFilter===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>${withPeriod?`<label class="filter">${icon('calendar')}<input type="month" data-filter="period" value="${esc(period)}" aria-label="Inspection period"></label>`:''}</div><div class="demo-note"><span class="dot"></span>Demo workspace · fictional results</div></div>`;
}
function stat(title,value,unit,ico,foot,first=false){return `<article class="stat ${first?'first':''}"><div class="stat-top">${title}<span class="stat-icon">${icon(ico)}</span></div><div class="stat-value mono">${value}<span class="unit">${unit}</span></div><div class="stat-bottom">${foot}</div></article>`;}
function renderOverview(){
  const sc=score(approved()), fs=findings().filter(f=>f.status!=='closed'), overdue=fs.filter(f=>f.dueDate<localDate()), a=assets(), checked=new Set(inspections().filter(i=>i.status!=='returned').map(i=>i.assetId).filter(Boolean)), verified=findings().filter(f=>f.status==='awaiting_verification').length;
  const checkedCount=a.filter(x=>checked.has(x.id)).length;
  const types=['APAR','Hydrant','P3K','Patrol'];
  const buckets=types.map(t=>{const q=score(approved().filter(i=>i.type===t));return {type:t,pass:q.pass,fail:q.total-q.pass,total:q.total};});
  const max=Math.max(...buckets.map(b=>Math.max(b.pass,b.fail)),10);const scale=Math.ceil(max/20)*20;
  const upcoming=[...a].sort((x,y)=>x.dueDate.localeCompare(y.dueDate)).slice(0,5);
  return `${heading('Safety overview','A clear view of compliance, across every site.',canInspect()?btn('new-inspection','New inspection','plus','primary'):'')}${toolbar()}<div class="stats">${stat('Checklist compliance',sc.value??'—',sc.value===null?'':'%','shield',`<b>${sc.pass} / ${sc.total}</b> applicable checks passed`,true)}${stat('Equipment inspected',checkedCount,`/ ${a.length}`,'clipboard',`${checkedCount===a.length?'<b>All equipment covered</b>':`<b>${a.length-checkedCount}</b> still to inspect this period`}`)}${stat('Open findings',fs.length,'','flag',`<span class="alert">${fs.filter(f=>['high','critical'].includes(f.severity)).length} high / critical</span> requiring attention`)}${stat('Overdue actions',overdue.length,'','clock',`${verified} action${verified===1?'':'s'} awaiting verification`)}</div><div class="dashboard-grid"><section class="panel"><div class="panel-head"><div><h2>Compliance by inspection</h2><p>Approved checklist results for the selected period</p></div><div class="legend"><span><i></i>Passed</span><span><i class="fail"></i>Failed</span></div></div><div class="panel-body"><div class="chart"><div class="chart-grid">${[scale,Math.round(scale*.75),Math.round(scale*.5),Math.round(scale*.25),0].map(n=>`<div class="gridline"><span>${n}</span></div>`).join('')}</div>${buckets.map((b,i)=>`<div class="chart-col" title="${b.type}: ${b.pass} passed, ${b.fail} failed"><div class="bars"><div class="bar ${i===0?'dark':''}" style="height:${b.pass/scale*100}%" aria-label="${b.pass} passed"></div><div class="bar fail" style="height:${b.fail/scale*100}%" aria-label="${b.fail} failed"></div></div><span class="chart-label">${label(b.type)}</span></div>`).join('')}</div></div><div class="chart-foot">${icon('info')}Scores reflect approved inspections. N/A answers are excluded.</div></section><section class="panel"><div class="panel-head"><div><h2>Across your sites</h2><p>Compliance, with inspection coverage</p></div>${icon('building')}</div><div class="panel-body">${state.sites.filter(s=>siteFilter==='all'||s.id===siteFilter).map(s=>{const rows=state.inspections.filter(i=>i.siteId===s.id&&i.period===period), q=score(rows.filter(i=>i.status==='approved')), all=state.assets.filter(a=>a.siteId===s.id), done=new Set(rows.filter(i=>i.status!=='returned').map(i=>i.assetId));return `<div class="site-row"><span class="site-symbol">${icon('building')}</span><div><div class="site-name">${esc(s.name)}</div><div class="site-sub">${all.filter(a=>done.has(a.id)).length} of ${all.length} equipment inspected · ${esc(s.city)}</div><div class="progress-track"><div class="progress-fill" style="width:${q.value??0}%"></div></div></div><div class="site-value">${q.value??'—'}<small>${q.value===null?'':'%'}</small></div></div>`;}).join('')}<div class="inline-note">A good score needs good coverage. Uninspected equipment is never counted as compliant.</div></div></section></div><section class="panel"><div class="panel-head"><div><h2>Your next checks <span class="pill-number">${a.length}</span></h2><p>Scheduled equipment inspections</p></div><button class="link-btn" data-action="nav" data-page="equipment">View equipment ${icon('arrow')}</button></div><div class="table-wrap"><table><thead><tr><th>Equipment</th><th>Site / area</th><th>Due date</th><th>This period</th><th></th></tr></thead><tbody>${upcoming.map(x=>`<tr><td><div class="row">${typeIcon(x.type)}<div class="cell-title">${esc(x.id)}<span class="cell-sub">${esc(label(x.type))} inspection</span></div></div></td><td>${esc(siteName(x.siteId))}<span class="cell-sub">${esc(x.zone)}</span></td><td>${fmt(x.dueDate)}</td><td>${badge(checked.has(x.id)?'approved':'open',checked.has(x.id)?'Inspected':'To inspect')}</td><td>${canInspect()?btn('inspect-asset','Inspect','arrow','small',`data-id="${esc(x.id)}"`):btn('asset-detail','View','arrow','small',`data-id="${esc(x.id)}"`)}</td></tr>`).join('')}</tbody></table></div><div class="panel-footer"><span>Monthly visual checks · technical maintenance tracked separately</span><span>${icon('calendar')} ${esc(period)}</span></div></section><div class="spacer"></div><div class="dashboard-grid"><section class="panel"><div class="panel-head"><h2>Needs your attention</h2><button class="link-btn" data-action="nav" data-page="findings">All actions ${icon('arrow')}</button></div><div class="panel-body">${fs.slice(0,3).map(f=>`<div class="site-row"><span class="site-symbol" style="color:#a27c51">${icon('flag')}</span><div><div class="site-name">${esc(f.title)}</div><div class="site-sub">${esc(siteName(f.siteId))} · ${esc(f.assetId||'Patrol')}</div></div><button class="link-btn" data-action="finding-detail" data-id="${f.id}">${badge(f.severity)} ${icon('chevron')}</button></div>`).join('')||empty('All clear','No open findings for this site.')}</div></section><section class="panel"><div class="panel-head"><h2>Workspace activity</h2>${icon('clock')}</div><div class="panel-body">${state.activity.slice(0,3).map(a=>`<div class="activity-row">${icon('circle')}<div><p>${esc(a.text)}</p><small>${esc(a.actor)} · ${fmt(a.at,{hour:'2-digit',minute:'2-digit'})}</small></div></div>`).join('')}</div></section></div>`;
}
function renderInspections(){
  let rows=inspections().filter(i=>(listFilter==='all'||i.type===listFilter)&&(!search||`${i.assetId} ${i.type} ${i.inspector}`.toLowerCase().includes(search.toLowerCase())));
  return `${heading('Inspections','Every check recorded. Every detail accounted for.',canInspect()?btn('new-inspection','New inspection','plus','primary'):'','FIELDWORK, WITHOUT THE PAPER')}${toolbar()}<div class="tabs">${['all','APAR','Hydrant','P3K','Patrol'].map(t=>`<button class="tab ${listFilter===t?'active':''}" data-action="list-filter" data-value="${t}">${t==='all'?'All inspections':label(t)}</button>`).join('')}</div>${myDrafts().length?`<section class="panel" style="margin-bottom:20px"><div class="panel-head"><h2>Saved on this device <span class="pill-number">${myDrafts().length}</span></h2>${icon('archive')}</div><div class="panel-body">${myDrafts().map(d=>`<div class="site-row"><span class="site-symbol">${icon('edit')}</span><div><div class="site-name">${esc(label(d.type))} · ${esc(d.assetId||d.zone||'New draft')}</div><div class="site-sub">Draft · ${fmt(d.savedAt,{hour:'2-digit',minute:'2-digit'})}</div></div>${btn('resume-draft','Continue','arrow','small',`data-id="${d.id}"`)}</div>`).join('')}</div></section>`:''}<section class="panel"><div class="list-toolbar"><div class="search-box">${icon('search')}<input data-search="list" placeholder="Search inspections…" value="${esc(search)}" aria-label="Search inspections"></div><span class="muted" style="font-size:11px">${rows.length} records</span></div>${rows.length?`<div class="table-wrap"><table><thead><tr><th>Inspection</th><th>Site</th><th>Date</th><th>Inspector</th><th>Score</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(i=>`<tr><td><div class="row">${typeIcon(i.type)}<div class="cell-title">${esc(i.assetId||label(i.type))}<span class="cell-sub">${esc(i.zone)} ${i.sample?'· Sample':''}</span></div></div></td><td>${esc(siteName(i.siteId))}</td><td>${fmt(i.date)}</td><td>${esc(i.inspector)}</td><td class="cell-title">${percent(score([i]).value)}</td><td>${badge(i.status)}</td><td><button class="icon-btn" data-action="inspection-detail" data-id="${i.id}" aria-label="View inspection">${icon('chevron')}</button></td></tr>`).join('')}</tbody></table></div>`:empty('No inspections here yet','Start an inspection or change the selected site and month.',canInspect()?btn('new-inspection','Start an inspection','plus','primary'):'')}</section>`;
}
function renderEquipment(){
  const rows=assets().filter(a=>(listFilter==='all'||a.type===listFilter)&&(!search||`${a.id} ${a.zone} ${a.name}`.toLowerCase().includes(search.toLowerCase())));
  return `${heading('Equipment register','Know what you have, where it is, and when it needs care.',canReview()?btn('new-asset','Add equipment','plus','primary'):'','EVERY ASSET, ACCOUNTED FOR')}${toolbar(false)}<div class="tabs">${['all','APAR','Hydrant','P3K'].map(t=>`<button class="tab ${listFilter===t?'active':''}" data-action="list-filter" data-value="${t}">${t==='all'?'All equipment':t}</button>`).join('')}</div><section class="panel"><div class="list-toolbar"><div class="search-box">${icon('search')}<input data-search="list" placeholder="Search ID or location…" value="${esc(search)}" aria-label="Search equipment"></div>${btn('scan','Scan QR','qr','small')}</div>${rows.length?`<div class="table-wrap"><table><thead><tr><th>Equipment</th><th>Site / area</th><th>Type</th><th>Next inspection</th><th>Service due</th><th></th></tr></thead><tbody>${rows.map(a=>`<tr><td><div class="row">${typeIcon(a.type)}<div class="cell-title">${esc(a.id)}<span class="cell-sub">${esc(a.name)}</span></div></div></td><td>${esc(siteName(a.siteId))}<span class="cell-sub">${esc(a.zone)}</span></td><td>${esc(a.subtype||a.type)}<span class="cell-sub">${esc(a.capacity)}</span></td><td>${fmt(a.dueDate)}${a.dueDate<localDate()?'<span class="cell-sub overdue">Scheduled date passed</span>':''}</td><td>${fmt(a.serviceDue)}${a.serviceDue&&a.serviceDue<localDate()?'<span class="cell-sub overdue">Overdue</span>':''}</td><td>${btn('asset-detail','Details','chevron','small',`data-id="${esc(a.id)}"`)}</td></tr>`).join('')}</tbody></table></div>`:empty('No matching equipment','Try another search, or register new equipment.')}</section>`;
}
function renderFindings(){
  let rows=findings().filter(f=>listFilter==='all'||f.status===listFilter);
  return `${heading('Corrective actions','From finding to verified fix. Nothing left unresolved.','','FOLLOW THROUGH, TOGETHER')}${toolbar(false)}<div class="summary-line"><span><b>${findings().filter(f=>f.status!=='closed').length}</b> open actions</span><span><b>${findings().filter(f=>f.status==='awaiting_verification').length}</b> awaiting verification</span><span><b>${findings().filter(f=>f.status==='closed').length}</b> verified closed</span></div><div class="tabs">${['all','open','in_progress','awaiting_verification','closed'].map(t=>`<button class="tab ${listFilter===t?'active':''}" data-action="list-filter" data-value="${t}">${t==='all'?'All actions':label(t)}</button>`).join('')}</div>${rows.length?`<div class="cards-grid">${rows.map(f=>`<article class="finding-card"><div class="row between">${badge(f.severity)}<span class="muted" style="font-size:10px">${esc(f.assetId||'Patrol')}</span></div><h3>${esc(f.title)}</h3><p>${esc(siteName(f.siteId))}<br>Assigned to ${esc(f.owner)}</p><div>${badge(f.status)}</div><div class="finding-meta"><span class="${f.dueDate<localDate()&&f.status!=='closed'?'overdue':''}">${icon('calendar')} Due ${fmt(f.dueDate)}</span><button class="link-btn" data-action="finding-detail" data-id="${f.id}">View action ${icon('arrow')}</button></div></article>`).join('')}</div>`:empty('No actions in this view','Change the status filter to see other corrective actions.')}`;
}
function renderReview(){
  const flags=state.flags.filter(f=>matchSite(f)&&f.status==='open'), rows=state.inspections.filter(i=>matchSite(i)&&i.status==='submitted'), verification=state.findings.filter(f=>matchSite(f)&&f.status==='awaiting_verification');
  return `${heading('Review queue','A second look, for records and resolutions you can trust.','','CONFIDENCE IN EVERY RECORD')}${toolbar(false)}<div class="notice info" style="margin-bottom:22px">${icon('shield')} HSE Managers review inspections and verify corrective actions. HSE Supervisors perform corrective actions. Data inconsistencies must be resolved before inspection approval.</div><div class="section-title">Data inconsistencies <span class="badge">${flags.length} open</span></div>${flags.map(f=>`<article class="review-card"><div>${badge('medium','Needs review')}<h3>${esc(f.reason)}</h3><p>${esc(siteName(f.siteId))} · Record ${esc(f.inspectionId.slice(0,8))}</p></div>${btn('flag-detail',canReview()?'Review flag':'View flag','arrow','small',`data-id="${f.id}"`)}</article>`).join('')||`<div class="inline-note" style="margin-bottom:22px">${icon('circle')} No unresolved data flags.</div>`}<div class="section-title">Inspection approvals <span class="badge">${rows.length} submitted</span></div>${rows.map(i=>`<article class="review-card"><div><h3>${esc(i.assetId||label(i.type))}</h3><p>${esc(siteName(i.siteId))} · ${fmt(i.date)} · ${esc(i.inspector)}</p></div>${btn('inspection-detail','Review inspection','arrow','small',`data-id="${i.id}"`)}</article>`).join('')||`<div class="inline-note" style="margin-bottom:22px">No inspections awaiting approval.</div>`}<div class="section-title">Corrective-action verification <span class="badge">${verification.length} ready</span></div>${verification.map(f=>`<article class="review-card"><div>${badge('awaiting_verification')}<h3>${esc(f.title)}</h3><p>${esc(siteName(f.siteId))} · Completion evidence submitted by HSE Supervisor</p></div>${btn('finding-detail',user.role==='supervisor'?'Verify action':'View action','arrow','small',`data-id="${f.id}"`)}</article>`).join('')||`<div class="inline-note">No corrective actions awaiting verification.</div>`}`;
}
function renderReports(){
  return `${heading('Reports & insights','Turn fieldwork into a clear, shareable record.','','LESS REPORTING. MORE CLARITY.')}${toolbar()}<div class="metric-strip"><div><b>${percent(score(approved()).value)}</b><small>Approved checklist compliance</small></div><div><b>${inspections().length}</b><small>Inspection records</small></div><div><b>${findings().filter(f=>f.status!=='closed').length}</b><small>Open actions · all dates</small></div></div><div class="cards-grid">${[['compliance','Compliance summary','Site scores, inspection coverage, and open corrective actions for your management review.','chart'],['inspection','Inspection register','A complete record of inspections, including status, checklist results, and inspectors.','clipboard'],['findings','Corrective-action register','Track ownership, due dates, completion evidence, and Manager verification.','flag'],['p3k','Annual P3K matrix','View the year’s approved supply checks by kit and month, with quantity and condition.','medical']].map(([id,name,desc,ico])=>`<article class="report-card">${icon(ico)}<h3>${name}</h3><p>${desc}</p><div class="row">${btn('print-report','Print / PDF','file','small',`data-report="${id}"`)}${btn('export-csv','CSV','download','small',`data-report="${id}"`)}</div></article>`).join('')}</div><div class="notice info" style="margin-top:22px">Print / PDF opens your device’s print dialog. Choose “Save as PDF” to download. To include inspection photos, open an individual inspection and choose “Print report.”</div>`;
}
function renderSettings(){
  return `${heading('Workspace settings','Your access, fieldwork setup, and workspace details.','','MAKE YOURSELF AT HOME')}<div class="setting-grid"><section class="panel"><div class="panel-head"><h2>Your account</h2>${icon('user')}</div><div class="panel-body"><div class="setting-row"><div><strong>${esc(user.name)}</strong><p>${esc(label(user.role))} · all demo sites</p></div><span class="avatar">HS</span></div><div class="setting-row"><div><strong>Role permissions</strong><p>${{staff:'Create inspections, capture photos, and track findings.',manager:'Perform corrective actions, submit completion evidence, and track findings.',supervisor:'Review inspections and independently verify corrective actions.',management:'View compliance, inspection records, actions, and reports.'}[user.role]}</p></div></div><div class="setting-row"><div><strong>Switch demo role</strong><p>Sign out, then choose another account. Local drafts are retained for their owner.</p></div>${btn('logout','Sign out','logout','small')}</div></div></section><section class="panel"><div class="panel-head"><h2>Install on your phone</h2>${icon('download')}</div><div class="panel-body"><div class="install-guide"><strong>Android · Chrome</strong><br>Open the browser menu → Add to Home screen → Install.<br><br><strong>iPhone · Safari</strong><br>Tap Share → Add to Home Screen → Add.<br><br>Phone installation and offline caching require this app to be hosted on <strong>HTTPS</strong>. Localhost works on this computer.</div></div></section><section class="panel"><div class="panel-head"><h2>Sites</h2>${icon('building')}</div><div class="panel-body">${state.sites.map(s=>`<div class="setting-row"><div><strong>${esc(s.name)}</strong><p>${esc(s.city)} · ${esc(s.code)}</p></div><span class="badge">${state.assets.filter(a=>a.siteId===s.id).length} assets</span></div>`).join('')}</div></section><section class="panel"><div class="panel-head"><h2>Data & offline access</h2>${icon('archive')}</div><div class="panel-body"><div class="setting-row"><div><strong>On this device</strong><p>${myDrafts().length} drafts · ${myQueue().length} pending changes<br>Photos and drafts are retained in browser storage. Avoid clearing browser data before synchronization.</p></div></div><div class="setting-row"><div><strong>Download workspace backup</strong><p>Exports synchronized data as JSON, including evidence. Store it securely.</p></div>${btn('backup','Export','download','small')}</div><div class="setting-row"><div><strong>Persist offline storage</strong><p>Ask the browser to protect local fieldwork from automatic storage cleanup.</p></div>${btn('persist-storage','Request','archive','small')}</div></div></section></div><div class="notice" style="margin-top:22px">MVP demonstration environment. These sample accounts and fictional results are for evaluation. Production rollout needs named accounts, site-specific access, HTTPS hosting, backups, and approved equipment-specific inspection criteria.</div>`;
}
function renderSync(){
  return `${heading('Sync center','Your work stays with you, even when the connection doesn’t.',btn('sync','Sync now','refresh','primary'),'BUILT FOR THE FIELD')}<div class="stats">${stat('Connection',isOnline?'Online':'Offline','','wifi','Server connection status',true)}${stat('Pending changes',myQueue().length,'','upload','Saved securely in this browser')}${stat('Needs attention',myQueue().filter(q=>q.error).length,'','alert','Review before retrying')}${stat('Local drafts',myDrafts().length,'','archive','Available to this account')}</div><section class="panel"><div class="panel-head"><h2>Outgoing changes</h2><span class="muted" style="font-size:10px">${syncedAt?'Last sync '+fmt(syncedAt,{hour:'2-digit',minute:'2-digit'}):'Never synchronized'}</span></div><div class="panel-body">${myQueue().map(q=>`<div class="sync-item"><div class="row between"><h3>${esc(q.kind.replaceAll('_',' '))}</h3>${badge(q.error?'high':'open',q.error?'Needs attention':'Pending upload')}</div><p>${esc(q.data.assetId||q.data.id||'')} · ${fmt(q.queuedAt,{hour:'2-digit',minute:'2-digit'})}</p>${q.error?`<div class="notice error">${esc(q.error)}</div><div class="spacer"></div><div class="row">${btn('export-operation','Download local copy','download','small',`data-id="${q.id}"`)}${q.kind==='create_inspection'?btn('repair-operation','Edit as draft','edit','small',`data-id="${q.id}"`):btn('open-conflict','Review current record','search','small',`data-id="${q.id}"`)}${q.errorStatus===401?btn('logout','Sign in again','logout','small'):''}${btn('discard-operation','Discard pending change','trash','small danger',`data-id="${q.id}"`)}</div>`:''}</div>`).join('')||empty('Everything is up to date','New offline inspections will appear here until they synchronize.')}<div class="inline-note">Conflicting edits are never silently overwritten. Review the current server record, then make a new decision. A local copy remains here until you explicitly remove it.</div></div></section>`;
}

function openModal(title,subtitle,body,footer='',wide=false){
  lastFocus=document.activeElement;
  $('#modal-root').innerHTML=`<div class="modal-backdrop"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header"><div><h2 id="modal-title">${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div><button class="icon-btn" data-action="close-modal" aria-label="Close dialog">${icon('close')}</button></header><div class="modal-body">${body}</div>${footer?`<footer class="modal-footer">${footer}</footer>`:''}</section></div>`;
  document.body.style.overflow='hidden';
  setTimeout(()=>$('.modal input:not([type=hidden]), .modal select, .modal button')?.focus(),20);
}
async function closeModal(){
  if(form) await saveDraft(false);
  if(window.scanStream){window.scanStream.getTracks().forEach(t=>t.stop());window.scanStream=null;}
  $('#modal-root').replaceChildren();document.body.style.overflow='';form=null;formPhotos=[];clearTimeout(saveTimer);lastFocus?.focus();render();
}
function photoMarkup(photo,index){
  if(photo.data)return `<a href="${esc(photo.data)}" data-action="view-photo" data-index="${index}" aria-label="Open evidence photo"><img src="${esc(photo.data)}" alt="${esc(photo.name||'Inspection evidence')}"></a>`;
  const evidenceId=photo.evidenceId||photo.id;
  return evidenceId?`<button type="button" class="link-btn evidence-link" data-action="view-evidence" data-evidence-id="${esc(evidenceId)}">Open evidence${photo.name?` · ${esc(photo.name)}`:''}</button>`:'';
}
function photoGallery(photos,removable=false){return `<div class="photos">${(photos||[]).map((p,i)=>`<div class="photo">${photoMarkup(p,i)}${removable?`<button data-action="remove-photo" data-index="${i}" aria-label="Remove photo">×</button>`:''}</div>`).join('')}</div>`;}
async function viewEvidence(evidenceId){
  const response=await fetch('/api/evidence/'+encodeURIComponent(evidenceId),{credentials:'same-origin'});
  if(!response.ok)throw new Error('Evidence could not be loaded.');
  const blob=await response.blob(),url=URL.createObjectURL(blob),overlay=document.createElement('div');
  overlay.className='modal-backdrop';overlay.style.zIndex='150';overlay.innerHTML=`<button class="icon-btn" style="position:absolute;right:25px;top:25px" aria-label="Close photo">${icon('close')}</button><img src="${url}" alt="Evidence photo" style="max-width:90vw;max-height:85vh;object-fit:contain;border-radius:10px">`;
  const close=()=>{URL.revokeObjectURL(url);overlay.remove();};overlay.addEventListener('click',close);overlay.querySelector('img').addEventListener('click',event=>event.stopPropagation());document.body.append(overlay);
}
function photoInput(){return `<label class="photo-drop">${icon('camera')}Add inspection evidence<small>JPEG, PNG or WebP · up to 8 photos · compressed on this device</small><input type="file" data-upload="photos" accept="image/jpeg,image/png,image/webp" multiple aria-label="Add evidence photos"></label><div id="photo-gallery">${photoGallery(form?form.photos:formPhotos,true)}</div><div id="photo-status" class="saved-indicator" style="margin-top:8px" aria-live="polite"></div>`;}

function startInspection(assetId=null,type=null,draft=null){
  const asset=state.assets.find(a=>a.id===assetId);
  form=draft?structuredClone(draft):{id:uid(),userId:user.id,type:type||asset?.type||'APAR',assetId:asset?.id||'',siteId:asset?.siteId||(siteFilter!=='all'?siteFilter:state.sites[0].id),zone:asset?.zone||'',period:period||monthNow(),date:localDate(),answers:[],photos:[],observations:[],notes:'',missing:false};
  initAnswers();renderInspectionForm();saveDraft(false);
}
function initAnswers(){
  const a=state.assets.find(a=>a.id===form.assetId);
  form.answers=state.templates[form.type].items.map(q=>{
    const existing=form.answers.find(x=>x.id===q.id);
    if(existing) return existing;
    const na=(q.conditional==='co2'&&a&&a.subtype!=='CO2')||(q.conditional==='gauge'&&a?.subtype==='CO2');
    return {id:q.id,status:na?'na':'',note:na?'Not applicable to this equipment type':'',quantity:null,expiry:''};
  });
}
function renderInspectionForm(){
  const qs=state.templates[form.type].items;
  const options=state.assets.filter(a=>a.siteId===form.siteId&&a.type===form.type);
  const completed=form.answers.filter(a=>a.status).length;
  const typeOptions=Object.keys(state.templates).map(t=>'<option '+(t===form.type?'selected':'')+'>'+esc(t)+'</option>').join('');
  const siteOptions=state.sites.map(s=>'<option value="'+esc(s.id)+'" '+(s.id===form.siteId?'selected':'')+'>'+esc(s.name)+'</option>').join('');
  const assetField=form.type!=='Patrol'
    ? '<div class="field"><label for="form-asset">Equipment</label><select id="form-asset" data-form="assetId"><option value="">Select equipment</option>'+options.map(a=>'<option value="'+esc(a.id)+'" '+(a.id===form.assetId?'selected':'')+'>'+esc(a.id)+'</option>').join('')+'</select></div>'
    : '<div class="field"><label for="form-zone">Patrol area</label><input id="form-zone" data-form="zone" value="'+esc(form.zone)+'" placeholder="e.g. Ground floor"></div>';
  const missingField=form.type!=='Patrol' ? '<label class="checkbox-row"><input type="checkbox" data-form="missing" '+(form.missing?'checked':'')+'>Equipment is missing from its registered location</label>' : '';
  const checklist=form.missing ? '<div class="notice">All component checks will be recorded as missing. Add a note and a photo of the registered location.</div>' : '<div class="section-title">Checklist <span id="answer-progress" class="badge">'+completed+' / '+qs.length+' answered</span></div>'+qs.map((q,i)=>{
    const a=form.answers.find(x=>x.id===q.id);
    const required=q.required ? '<div class="muted" style="font-size:10px">Required quantity: '+q.required+'</div>' : '';
    const answers=['pass','fail','na'].map(status=>'<button class="answer '+status+' '+(a.status===status?'selected':'')+'" data-action="answer" data-question="'+esc(q.id)+'" data-value="'+status+'" aria-pressed="'+(a.status===status)+'">'+label(status)+'</button>').join('');
    const quantity=q.required ? '<label>Actual qty <input type="number" min="0" step="1" data-answer="quantity" data-question="'+esc(q.id)+'" value="'+(a.quantity??'')+'" aria-label="Actual quantity for '+esc(q.label)+'"></label>' : '';
    const expiry=q.expiry ? '<label>Earliest expiry <input type="date" data-answer="expiry" data-question="'+esc(q.id)+'" value="'+esc(a.expiry)+'" aria-label="Expiry for '+esc(q.label)+'"></label>' : '';
    return '<div class="check-item"><div class="check-top"><div class="check-label"><span class="check-number">'+String(i+1).padStart(2,'0')+'</span><div>'+esc(q.label)+required+'</div></div><div class="answer-buttons" role="group" aria-label="'+esc(q.label)+'">'+answers+'</div></div><div class="check-detail">'+quantity+expiry+'<input class="note-input" data-answer="note" data-question="'+esc(q.id)+'" value="'+esc(a.note)+'" placeholder="'+(a.status&&a.status!=='pass'?'Reason required':'Add a note (optional)')+'" aria-label="Note for '+esc(q.label)+'"></div></div>';
  }).join('');
  const co2=form.type==='APAR'&&form.answers.find(a=>a.id==='weight')?.status!=='na' ? '<div class="section-title">CO₂ weighing · kg</div><div class="notice info">Use the reference and minimum acceptable weight for this specific equipment. Do not use a universal threshold.</div><div class="spacer"></div><div class="form-grid three">'+[['weight','Measured weight'],['referenceWeight','Reference full weight'],['minimumWeight','Minimum acceptable weight']].map(pair=>'<div class="field"><label for="'+pair[0]+'">'+pair[1]+' (kg)</label><input id="'+pair[0]+'" type="number" min="0.01" step="0.01" data-form="'+pair[0]+'" value="'+(form[pair[0]]??'')+'"></div>').join('')+'</div>' : '';
  const observations=form.type==='Patrol' ? '<div class="section-title">Additional observations '+btn('add-observation','Add observation','plus','small')+'</div>'+form.observations.map((o,i)=>'<div class="observation"><div class="form-grid"><div class="field"><label>Observation</label><input data-observation="title" data-index="'+i+'" value="'+esc(o.title)+'" placeholder="What did you observe?"></div><div class="field"><label>Condition</label><select data-observation="condition" data-index="'+i+'"><option value="safe" '+(o.condition==='safe'?'selected':'')+'>Safe condition</option><option value="unsafe" '+(o.condition==='unsafe'?'selected':'')+'>Unsafe condition</option></select></div><div class="field"><label>Severity</label><select data-observation="severity" data-index="'+i+'">'+['low','medium','high','critical'].map(x=>'<option '+(o.severity===x?'selected':'')+'>'+x+'</option>').join('')+'</select></div><div class="field"><label>Details</label><input data-observation="note" data-index="'+i+'" value="'+esc(o.note)+'"></div></div>'+btn('remove-observation','Remove','trash','small ghost','data-index="'+i+'"')+'</div>').join('') : '';
  const body='<div class="form-grid three"><div class="field"><label for="form-type">Inspection type</label><select id="form-type" data-form="type">'+typeOptions+'</select></div><div class="field"><label for="form-site">Site</label><select id="form-site" data-form="siteId">'+siteOptions+'</select></div>'+assetField+'<div class="field"><label for="form-period">Scheduled period</label><input id="form-period" type="month" data-form="period" value="'+esc(form.period)+'"></div><div class="field"><label for="form-date">Actual inspection date</label><input id="form-date" type="date" data-form="date" value="'+esc(form.date)+'"></div><div class="field"><label>Inspector</label><input value="'+esc(user.name)+'" disabled></div></div>'+missingField+checklist+co2+observations+'<div class="section-title">Photo evidence</div>'+photoInput()+'<div class="spacer"></div><div class="field"><label for="form-notes">Inspection notes</label><textarea id="form-notes" data-form="notes" placeholder="Additional context, location or follow-up…">'+esc(form.notes)+'</textarea></div><div id="form-error" class="error-text" role="alert"></div>';
  const footer='<p id="draft-status" class="saved-indicator">Saved automatically on this device</p><div class="row">'+btn('save-draft','Save & close','archive')+btn('submit-inspection','Submit inspection','check','primary')+'</div>';
  openModal('New '+label(form.type)+' inspection',state.templates[form.type].description,body,footer,true);
}
async function saveDraft(showToast=true){
  if(!form) return;
  const copy=structuredClone(form);copy.savedAt=new Date().toISOString();
  const next=drafts.filter(d=>d.id!==copy.id);next.push(copy);
  try {await write('drafts',next);drafts=next;if($('#draft-status'))$('#draft-status').textContent='Saved on this device · '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});if(showToast)toast('Draft saved on this device.');}
  catch(e){if($('#draft-status'))$('#draft-status').textContent='Save failed — keep this window open';toast('Device storage is full or unavailable. Your latest changes have not been saved.',true);throw e;}
}
function deferSave(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveDraft(false).catch(()=>{}),450);}
function validateForm(){
  if(form.type!=='Patrol'&&!form.assetId)return 'Select the equipment you inspected.';
  if(form.type==='Patrol'&&!form.zone.trim())return 'Enter the patrol area.';
  if(!form.date||!form.period)return 'Enter the inspection date and scheduled period.';
  if(form.missing){if(!form.notes.trim()||!form.photos.length)return 'Missing equipment requires a note and a location photo.';return '';}
  for(const q of state.templates[form.type].items){const a=form.answers.find(a=>a.id===q.id);if(!a?.status)return 'Answer every checklist item before submitting.';if(a.status!=='pass'&&!a.note.trim())return 'Add a reason for each failed or N/A answer.';if(q.required&&a.status!=='na'&&(a.quantity===null||a.quantity<0))return 'Enter the actual quantity for each applicable P3K supply.';}
  if((form.answers.some(a=>a.status==='fail')||form.observations.some(o=>o.condition==='unsafe'))&&!form.photos.length)return 'Add at least one photo to support failed checks or unsafe observations.';
  if(form.observations.some(o=>!o.title.trim()))return 'Give every patrol observation a title.';
  if(form.type==='APAR'&&['pass','fail'].includes(form.answers.find(a=>a.id==='weight')?.status)){
    if(['weight','referenceWeight','minimumWeight'].some(k=>!(Number(form[k])>0)))return 'Enter measured, reference and minimum acceptable CO₂ weights.';
    if(!form.photos.length)return 'Add a photo of the CO₂ weighing result.';
  }
  return '';
}
async function submitInspection(){
  if(photoBusy){toast('Please wait for the photos to finish saving.',true);return;}
  const error=validateForm();if(error){$('#form-error').textContent=error;$('#form-error').scrollIntoView({block:'nearest',behavior:'smooth'});return;}
  if(form.missing)form.answers=form.answers.map(a=>({...a,status:'missing',note:form.notes}));
  await saveDraft(false);
  const data=structuredClone(form);
  const op={id:uid(),kind:'create_inspection',data,userId:user.id,queuedAt:new Date().toISOString()};
  queue.push(op);await write('queue',queue);
  drafts=drafts.filter(d=>d.id!==form.id);await write('drafts',drafts);form=null;await closeModal();
  page='inspections';render();toast('Inspection saved. It will appear in the register after synchronization.');await synchronize(true);
}
function inspectionDetail(id){
  const i=state.inspections.find(i=>i.id===id);if(!i)return;
  const flags=state.flags.filter(f=>f.inspectionId===id&&f.status==='open');
  openModal(esc(i.assetId||label(i.type)),'Inspection record · '+esc(i.id.slice(0,8)),
    `<div class="detail-grid"><div><label>Site</label><b>${esc(siteName(i.siteId))}</b></div><div><label>Date / period</label><b>${fmt(i.date)} / ${esc(i.period)}</b></div><div><label>Inspector</label><b>${esc(i.inspector)}</b></div><div><label>Status</label>${badge(i.status)}</div><div><label>Checklist score</label><b>${percent(score([i]).value)}</b></div><div><label>Template</label><b>${esc(i.type)} · v${i.templateVersion}</b></div></div>${i.sample?'<div class="notice info">Fictional sample inspection. This is not an imported result from your PDFs.</div>':''}${flags.length?`<div class="notice" style="margin-top:12px">${flags.length} data flag(s) must be resolved in the Review queue before approval.</div>`:''}<div class="section-title">Checklist results</div>${i.answers.map(a=>`<div class="detail-answer"><div>${esc(state.templates[i.type].items.find(q=>q.id===a.id)?.label||a.id)}${a.quantity!==null&&a.quantity!==undefined?`<p>Actual quantity: ${a.quantity}</p>`:''}${a.note?`<p>${esc(a.note)}</p>`:''}</div>${badge(a.status)}</div>`).join('')}${i.observations?.length?`<div class="section-title">Patrol observations</div>${i.observations.map(o=>`<div class="detail-answer"><div>${esc(o.title)}<p>${esc(o.note)}</p></div>${badge(o.condition==='safe'?'pass':o.severity,o.condition)}</div>`).join('')}`:''}<div class="section-title">Photo evidence</div>${i.photos?.length?photoGallery(i.photos):'<p class="muted" style="font-size:12px">No evidence photos attached.</p>'}${i.notes?`<div class="section-title">Notes</div><p style="font-size:12px;line-height:1.8">${esc(i.notes)}</p>`:''}${i.reviewNote?`<div class="notice" style="margin-top:18px">Reviewer: ${esc(i.reviewer)}<br>${esc(i.reviewNote)}</div>`:''}${canReview()&&i.status==='submitted'?`<div class="spacer"></div><div class="field"><label for="review-note">Review note (required when returning)</label><textarea id="review-note" placeholder="Explain corrections or your approval…"></textarea></div>`:''}<div id="modal-error" class="error-text"></div>`,
    `<div>${btn('print-inspection','Print report','file','small',`data-id="${id}"`)}</div><div class="row">${canReview()&&i.status==='submitted'?`${btn('review-inspection','Return','edit','small',`data-id="${id}" data-decision="returned"`)}${btn('review-inspection','Approve','check','primary small',`data-id="${id}" data-decision="approved" ${flags.length?'disabled':''}`)}`:i.status==='returned'&&canInspect()?btn('revise-inspection','Create corrected inspection','edit','primary small',`data-id="${id}"`):btn('close-modal','Close','','small')}</div>`,true);
}
function findingDetail(id){
  const f=state.findings.find(f=>f.id===id);if(!f)return;
  formPhotos=[];
  const work=user.role==='manager'&&['open','in_progress'].includes(f.status), verify=user.role==='supervisor'&&f.status==='awaiting_verification';
  openModal(esc(f.title),'Corrective action · '+esc(f.assetId||'Safety patrol'),
    `<div class="detail-grid"><div><label>Site</label><b>${esc(siteName(f.siteId))}</b></div><div><label>Owner</label><b>${esc(f.owner)}</b></div><div><label>Due date</label><b class="${f.dueDate<localDate()&&f.status!=='closed'?'text-danger':''}">${fmt(f.dueDate,{year:'numeric'})}</b></div><div><label>Status</label>${badge(f.status)}</div><div><label>Severity</label>${badge(f.severity)}</div><div><label>Verified by</label><b>${esc(f.verifiedBy||'Not yet verified')}</b></div></div>${f.sample?'<div class="notice info">Demonstration record. This finding and any sample completion notes are fictional.</div>':''}<div class="section-title">Finding details</div><p style="font-size:12px;line-height:1.8">${esc(f.detail||'No additional notes.')}</p>${photoGallery(f.photos)}${f.completion?`<div class="section-title">Supervisor’s completion evidence</div><div class="notice info">${esc(f.completion)}</div>${photoGallery(f.evidence)}`:''}${work?`<div class="section-title">Record corrective work</div><div class="field"><label for="action-note">What was done?</label><textarea id="action-note" placeholder="Describe the fix and how the condition was restored…"></textarea></div>${photoInput()}`:verify?`<div class="section-title">Independent verification</div><div class="field"><label for="action-note">Verification note</label><textarea id="action-note" placeholder="Describe what you verified, or why further work is needed…"></textarea></div>`:''}${f.history.length?`<div class="section-title">Action history</div><div class="timeline">${f.history.map(h=>`<div class="timeline-item"><b>${esc(label(h.action))} · ${esc(h.actor)}</b><p>${esc(h.note)}</p><small>${fmt(h.at,{hour:'2-digit',minute:'2-digit'})}</small></div>`).join('')}</div>`:''}<div id="modal-error" class="error-text"></div>`,
    `<p>Only the HSE Manager can verify closure.</p><div class="row">${work?`${f.status==='open'?btn('finding-action','Start work','edit','small',`data-id="${id}" data-kind="start"`):''}${btn('finding-action','Submit for verification','check','primary small',`data-id="${id}" data-kind="complete"`)}`:verify?`${btn('finding-action','Return','edit','small',`data-id="${id}" data-kind="reject"`)}${btn('finding-action','Verify & close','shield','primary small',`data-id="${id}" data-kind="verify"`)}`:btn('close-modal','Close','','small')}</div>`);
}
function flagDetail(id){
  const f=state.flags.find(f=>f.id===id);if(!f)return;
  const ins=state.inspections.find(i=>i.id===f.inspectionId);
  openModal('Review data inconsistency',esc(siteName(f.siteId)),`<div class="notice">${esc(f.reason)}</div><div class="spacer"></div><div class="detail-grid"><div><label>Equipment</label><b>${esc(ins?.assetId||'Patrol')}</b></div><div><label>Scheduled period</label><b>${esc(ins?.period)}</b></div><div><label>Inspection date</label><b>${esc(ins?.date)}</b></div></div><p class="muted" style="font-size:12px;line-height:1.8">Resolving a flag records an explanation; it does not change the original answers. If a result is incorrect, return the inspection and ask for a corrected inspection.</p>${canReview()?`<div class="spacer"></div><div class="field"><label for="flag-note">Resolution explanation</label><textarea id="flag-note" placeholder="Explain why the record is acceptable or how the discrepancy was handled…"></textarea></div>`:''}<div id="modal-error" class="error-text"></div>`,`<div>${btn('inspection-detail','View inspection','search','small',`data-id="${f.inspectionId}"`)}</div>${canReview()?btn('resolve-flag','Record resolution','check','primary small',`data-id="${id}"`):btn('close-modal','Close','','small')}`);
}
function assetDetail(id){
  const a=state.assets.find(x=>x.id===id);if(!a)return;
  const records=state.inspections.filter(i=>i.assetId===id);
  openModal(esc(a.id),esc(a.name)+' · '+esc(siteName(a.siteId)),`<div class="detail-grid">${[['Type',a.subtype||a.type],['Area',a.zone],['Capacity',a.capacity||'—'],['Serial number',a.serial||'—'],['Inspection due',fmt(a.dueDate)],['Service due',fmt(a.serviceDue)]].map(([k,v])=>`<div><label>${k}</label><b>${esc(v)}</b></div>`).join('')}</div><div class="notice info">QR labels can contain this equipment ID: <strong>${esc(a.id)}</strong>. Use Scan QR or enter the ID manually to find the record.</div><div class="section-title">Inspection history</div>${records.map(i=>`<div class="site-row"><span class="site-symbol">${icon('clipboard')}</span><div><div class="site-name">${fmt(i.date,{year:'numeric'})}</div><div class="site-sub">${esc(i.inspector)} · ${percent(score([i]).value)}</div></div><button class="link-btn" data-action="inspection-detail" data-id="${i.id}">${badge(i.status)} ${icon('chevron')}</button></div>`).join('')||empty('No inspection history','The first submitted inspection will appear here.')}`,`<p>Equipment history is retained for every inspection.</p>${canInspect()?btn('inspect-asset','Inspect equipment','clipboard','primary',`data-id="${esc(a.id)}"`):btn('close-modal','Close','','small')}`);
}
function newAsset(){
  openModal('Register equipment','Add an asset to the selected site',`<form id="asset-form"><div class="form-grid"><div class="field"><label for="asset-id">Unique equipment ID</label><input id="asset-id" name="id" placeholder="JPM-APAR-021" maxlength="80" required></div><div class="field"><label for="asset-name">Equipment name</label><input id="asset-name" name="name" placeholder="APAR 21" required></div><div class="field"><label for="asset-site">Site</label><select id="asset-site" name="siteId">${state.sites.map(s=>`<option value="${s.id}" ${s.id===siteFilter?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div><div class="field"><label for="asset-type">Equipment type</label><select id="asset-type" name="type"><option>APAR</option><option>Hydrant</option><option>P3K</option></select></div><div class="field"><label for="asset-zone">Zone / area</label><input id="asset-zone" name="zone" placeholder="Ground floor" required></div><div class="field"><label for="asset-subtype">APAR agent (if applicable)</label><select id="asset-subtype" name="subtype"><option value="">Not applicable</option><option>Dry chemical</option><option>CO2</option><option>Foam</option><option>Water</option><option>Other</option></select></div><div class="field"><label for="asset-capacity">Capacity</label><input id="asset-capacity" name="capacity" placeholder="e.g. 5 kg"></div><div class="field"><label for="asset-serial">Serial number</label><input id="asset-serial" name="serial"></div><div class="field"><label for="asset-due">Next inspection date</label><input id="asset-due" type="date" name="dueDate" value="${localDate()}" required></div><div class="field"><label for="asset-service">Next service date</label><input id="asset-service" type="date" name="serviceDue"></div><div class="field"><label for="asset-expiry">Manufacturer expiry (if applicable)</label><input id="asset-expiry" type="date" name="expiryDate"></div></div></form><div id="modal-error" class="error-text"></div>`,`<p>Equipment IDs must be unique across sites.</p>${btn('save-asset','Register equipment','plus','primary')}`);
}

async function compressImage(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPEG, PNG or WebP image.');
  if(file.size>25*1024*1024)throw new Error('Source photos must be under 25 MB.');
  const url=URL.createObjectURL(file);
  try{
    const img=new Image();img.src=url;await img.decode();
    const ratio=Math.min(1,1400/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*ratio);canvas.height=Math.round(img.naturalHeight*ratio);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL('image/jpeg',.78);
    if(data.length>2_000_000)throw new Error('Photo is still too large. Choose a smaller image.');
    return {id:uid(),name:file.name,data,capturedAt:new Date().toISOString()};
  }finally{URL.revokeObjectURL(url);}
}
async function uploadPhotos(input){
  photoBusy=true;const target=form?form.photos:formPhotos;
  try{
    const files=[...input.files];if(target.length+files.length>8)throw new Error('A maximum of 8 photos can be attached.');
    $('#photo-status').textContent='Preparing photos…';
    for(const f of files)target.push(await compressImage(f));
    if(form)await saveDraft(false);
    $('#photo-gallery').innerHTML=photoGallery(target,true);$('#photo-status').textContent=`${target.length} photo(s) ready${form?' · saved on this device':''}`;
  }catch(e){toast(e.message,true);$('#photo-status').textContent=e.message;}finally{photoBusy=false;input.value='';}
}
async function startScan(){
  openModal('Find equipment','Scan an existing QR label, or enter the equipment ID',`<div id="scanner-area"><div class="notice info">Camera scanning is available when supported by this browser. Manual ID lookup works on Android and iPhone.</div></div><div class="spacer"></div><div class="field"><label for="scan-id">Equipment ID</label><input id="scan-id" placeholder="e.g. JPM-APAR-01" autocomplete="off"></div><div id="modal-error" class="error-text"></div>`,`<div>${btn('enable-camera','Use camera','camera','small')}</div>${btn('lookup-asset','Find equipment','search','primary')}`);
}
async function enableCamera(){
  if(!('BarcodeDetector' in window)){ $('#scanner-area').innerHTML='<div class="notice">QR scanning is not available in this browser. Use your phone’s camera app to read the equipment ID, then enter it below.</div>';return; }
  try{
    window.scanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    $('#scanner-area').innerHTML='<video class="scan-video" autoplay playsinline muted></video>';
    const video=$('.scan-video');video.srcObject=window.scanStream;await video.play();const detector=new BarcodeDetector({formats:['qr_code']});
    const tick=async()=>{if(!window.scanStream||!document.contains(video))return;try{const found=await detector.detect(video);if(found[0]){$('#scan-id').value=found[0].rawValue;window.scanStream.getTracks().forEach(t=>t.stop());window.scanStream=null;lookupAsset();return;}}catch{}setTimeout(tick,500);};tick();
  }catch(e){$('#scanner-area').innerHTML='<div class="notice">Camera access was unavailable. Enter the equipment ID below.</div>';}
}
function lookupAsset(){
  const raw=$('#scan-id').value.trim();const a=state.assets.find(a=>a.id.toLowerCase()===raw.toLowerCase());
  if(!a){$('#modal-error').textContent='No equipment matches this ID in the downloaded workspace.';return;}
  if(window.scanStream){window.scanStream.getTracks().forEach(t=>t.stop());window.scanStream=null;}assetDetail(a.id);
}

function download(filename,content,type='application/json'){
  const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function reportRows(type){
  if(type==='compliance')return [['Site','Period','Checklist compliance %','Passed checks','Applicable checks','Equipment inspected','Total equipment'],...state.sites.filter(s=>siteFilter==='all'||s.id===siteFilter).map(s=>{const records=inspections().filter(i=>i.siteId===s.id),q=score(records.filter(i=>i.status==='approved')),a=assets().filter(a=>a.siteId===s.id),ids=new Set(records.filter(i=>i.status!=='returned').map(i=>i.assetId));return[s.name,period,q.value??'',q.pass,q.total,a.filter(x=>ids.has(x.id)).length,a.length];})];
  if(type==='inspection')return [['Equipment / area','Type','Site','Period','Date','Inspector','Status','Score %'],...inspections().map(i=>[i.assetId||i.zone,i.type,siteName(i.siteId),i.period,i.date,i.inspector,label(i.status),score([i]).value??''])];
  if(type==='findings')return [['Finding','Equipment','Site','Severity','Owner','Status','Due date','Completion','Verified by'],...findings().map(f=>[f.title,f.assetId,siteName(f.siteId),f.severity,f.owner,label(f.status),f.dueDate,f.completion,f.verifiedBy||''])];
  if(type==='p3k'){
    const year=(period||monthNow()).slice(0,4);
    const rows=[['Kit','Supply','Required quantity',...Array.from({length:12},(_,i)=>new Intl.DateTimeFormat('en',{month:'short'}).format(new Date(2026,i,1)))]];
    for(const a of assets().filter(a=>a.type==='P3K'))for(const q of state.templates.P3K.items){
      rows.push([a.id,q.label,q.required,...Array.from({length:12},(_,m)=>{const records=state.inspections.filter(i=>i.assetId===a.id&&i.status==='approved'&&i.period===`${year}-${String(m+1).padStart(2,'0')}`).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));const answer=records[0]?.answers.find(x=>x.id===q.id);return answer?`${label(answer.status)}${answer.quantity!=null?' ('+answer.quantity+')':''}`:'—';})]);
    }return rows;
  }return [];
}
function tableHTML(rows){return `<table><thead><tr>${rows[0].map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;}
function exportCSV(type){const rows=reportRows(type);const safe=v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};download(`mizan-${type}-${period}.csv`,'\uFEFF'+rows.map(r=>r.map(safe).join(',')).join('\r\n'),'text/csv;charset=utf-8');toast('CSV report downloaded.');}
function printReport(type,id){
  let title,body;
  if(id){const i=state.inspections.find(i=>i.id===id);title=`${label(i.type)} inspection · ${i.assetId||i.zone}`;body=`<p>Site: ${esc(siteName(i.siteId))} · Period: ${esc(i.period)} · Date: ${esc(i.date)}</p><p>Inspector: ${esc(i.inspector)} · Status: ${esc(label(i.status))} · Score: ${percent(score([i]).value)}</p>${tableHTML([['Check','Result','Quantity','Note'],...i.answers.map(a=>[state.templates[i.type].items.find(q=>q.id===a.id)?.label,a.status,a.quantity??'',a.note])])}${i.observations?.length?'<h2>Patrol observations</h2>'+tableHTML([['Observation','Condition','Severity','Note'],...i.observations.map(o=>[o.title,o.condition,o.severity,o.note])]):''}<h2>Notes</h2><p>${esc(i.notes||'—')}</p><h2>Evidence</h2>${(i.photos||[]).map(p=>`<img class="report-photo" src="${esc(p.data)}" alt="${esc(p.name)}">`).join('')}<p>Reviewed by: ${esc(i.reviewer||'Pending')} · ${esc(i.reviewNote||'')}</p>`;}
  else{title={compliance:'Compliance summary',inspection:'Inspection register',findings:'Corrective-action register',p3k:'Annual P3K matrix'}[type];body=tableHTML(reportRows(type));}
  let report=$('.print-report');if(!report){report=document.createElement('article');report.className='print-report';document.body.append(report);}
  report.innerHTML=`<header><p>MIZAN · HSE WORKSPACE</p><h1>${esc(title)}</h1><p>${siteFilter==='all'?'All sites':esc(siteName(siteFilter))} · ${type==='p3k'?'Year '+period.slice(0,4):esc(period)} · Generated ${fmt(new Date().toISOString(),{year:'numeric',hour:'2-digit',minute:'2-digit'})}</p></header><p>DEMO WORKSPACE — includes fictional sample results. Scores represent checklist compliance, not certification.</p>${body}<footer>Original inspection outcomes are preserved after corrective-action closure. Report generated by ${esc(user.name)}.</footer>`;
  setTimeout(()=>window.print(),100);
}

document.addEventListener('submit',async e=>{
  if(e.target.id!=='login-form')return;e.preventDefault();const button=$('button[type=submit]',e.target);button.disabled=true;$('#login-error').textContent='';
  try{const data=await api('login',{user:$('#login-user').value,password:$('#login-password').value});user=data.user;await refreshState();await write('user',user);await new Promise(resolve=>setTimeout(resolve,800));page='overview';render();await synchronize(true);}
  catch(err){$('#login-error').textContent=err.status?err.message:'Cannot connect to the server. Run npm run dev, set DATABASE_URL, and try again.';button.disabled=false;}
});
document.addEventListener('input',e=>{
  const el=e.target;
  if(el.id==='login-user')syncLoginRoleUI(el.value);
  if(el.matches('[data-search]')){search=el.value;const pos=el.selectionStart;render();const next=$('[data-search]');next.focus();next.setSelectionRange(pos,pos);}
  if(form&&el.dataset.form&&!['type','siteId','assetId','missing'].includes(el.dataset.form)){form[el.dataset.form]=['weight','referenceWeight','minimumWeight'].includes(el.dataset.form)?(el.value===''?null:Number(el.value)):el.value;deferSave();}
  if(form&&el.dataset.answer){const a=form.answers.find(a=>a.id===el.dataset.question);a[el.dataset.answer]=el.dataset.answer==='quantity'?(el.value===''?null:Number(el.value)):el.value;deferSave();}
  if(form&&el.dataset.observation){form.observations[Number(el.dataset.index)][el.dataset.observation]=el.value;deferSave();}
});
document.addEventListener('change',async e=>{
  const el=e.target;
  if(el.dataset.filter){if(el.dataset.filter==='site')siteFilter=el.value;else period=el.value||monthNow();render();}
  if(el.dataset.upload)await uploadPhotos(el);
  if(el.id==='login-user')syncLoginRoleUI(el.value);
  if(form&&['type','siteId','assetId','missing'].includes(el.dataset.form)){
    const field=el.dataset.form;
    if(field==='missing'){form.missing=el.checked;}
    else{form[field]=el.value;if(field==='assetId'){const a=state.assets.find(a=>a.id===el.value);form.zone=a?.zone||'';}else{form.assetId='';}form.answers=[];form.missing=false;initAnswers();}
    await saveDraft(false);renderInspectionForm();
  }
});
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]');if(!b)return;e.preventDefault();if(b.disabled)return;
  const {action,id}=b.dataset;
  try{
    if(action==='select-role'){$('#login-user').value=stagingHost?b.dataset.stagingAccount:b.dataset.role;syncLoginRoleUI($('#login-user').value);}
    else if(action==='nav'){page=b.dataset.page;listFilter='all';search='';render();window.scrollTo(0,0);}
    else if(action==='menu'){$('.sidebar').classList.add('open');$('.mobile-shade').classList.add('visible');}
    else if(action==='menu-close'){$('.sidebar').classList.remove('open');$('.mobile-shade').classList.remove('visible');}
    else if(action==='list-filter'){listFilter=b.dataset.value;render();}
    else if(action==='search'){page='equipment';listFilter='all';search='';render();$('[data-search]').focus();}
    else if(action==='new-inspection')startInspection();
    else if(action==='inspect-asset'){if(form)await saveDraft(false);startInspection(id);}
    else if(action==='resume-draft')startInspection(null,null,myDrafts().find(d=>d.id===id));
    else if(action==='close-modal')await closeModal();
    else if(action==='save-draft'){await saveDraft();form=null;await closeModal();}
    else if(action==='submit-inspection'){b.disabled=true;try{await submitInspection();}finally{b.disabled=false;}}
    else if(action==='answer'){
      const a=form.answers.find(a=>a.id===b.dataset.question);a.status=b.dataset.value;
      const item=b.closest('.check-item');$$('.answer',item).forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});
      $('.note-input',item).placeholder=a.status!=='pass'?'Reason required':'Add a note (optional)';
      $('#answer-progress').textContent=`${form.answers.filter(a=>a.status).length} / ${form.answers.length} answered`;
      if(a.id==='weight'){await saveDraft(false);renderInspectionForm();}else deferSave();
    }
    else if(action==='add-observation'){form.observations.push({title:'',condition:'unsafe',severity:'medium',note:''});await saveDraft(false);renderInspectionForm();}
    else if(action==='remove-observation'){form.observations.splice(Number(b.dataset.index),1);await saveDraft(false);renderInspectionForm();}
    else if(action==='remove-photo'){const photos=form?form.photos:formPhotos;photos.splice(Number(b.dataset.index),1);if(form)await saveDraft(false);$('#photo-gallery').innerHTML=photoGallery(photos,true);}
    else if(action==='view-photo'){const img=b.querySelector('img');if(img){const overlay=document.createElement('div');overlay.className='modal-backdrop';overlay.style.zIndex='150';overlay.innerHTML=`<button class="icon-btn" style="position:absolute;right:25px;top:25px" aria-label="Close photo">${icon('close')}</button><img src="${esc(img.src)}" alt="Evidence photo" style="max-width:90vw;max-height:85vh;object-fit:contain;border-radius:10px">`;overlay.addEventListener('click',()=>overlay.remove());document.body.append(overlay);}}
    else if(action==='view-evidence')await viewEvidence(b.dataset.evidenceId);
    else if(action==='inspection-detail')inspectionDetail(id);
    else if(action==='finding-detail')findingDetail(id);
    else if(action==='flag-detail')flagDetail(id);
    else if(action==='asset-detail')assetDetail(id);
    else if(action==='new-asset')newAsset();
    else if(action==='save-asset'){
      const f=$('#asset-form');if(!f.reportValidity())return;const data=Object.fromEntries(new FormData(f));await enqueue('create_asset',data);await closeModal();
    }
    else if(action==='review-inspection'){
      const i=state.inspections.find(i=>i.id===id);const note=$('#review-note')?.value||'';if(b.dataset.decision==='returned'&&!note.trim())throw new Error('Please explain why this inspection needs correction.');await enqueue('review_inspection',{id,decision:b.dataset.decision,note},i.revision);await closeModal();
    }
    else if(action==='revise-inspection'){
      const i=state.inspections.find(i=>i.id===id);const d=structuredClone(i);d.id=uid();d.userId=user.id;d.notes=`Correction of inspection ${i.id}. ${i.notes||''}`;delete d.sample;startInspection(null,null,d);
    }
    else if(action==='finding-action'){
      if(photoBusy)throw new Error('Please wait for the evidence photos to finish preparing.');
      const f=state.findings.find(f=>f.id===id),kind=b.dataset.kind,note=$('#action-note')?.value||'';
      if(['complete','verify','reject'].includes(kind)&&!note.trim())throw new Error('Add a note explaining your action.');
      if(kind==='complete'&&!formPhotos.length)throw new Error('Attach at least one photo of the completed corrective action.');
      await enqueue('finding_action',{id,action:kind,note,evidence:formPhotos},f.revision);await closeModal();
    }
    else if(action==='resolve-flag'){const f=state.flags.find(f=>f.id===id);const note=$('#flag-note').value;if(!note.trim())throw new Error('Provide a resolution explanation.');await enqueue('resolve_flag',{id,note},f.revision);await closeModal();}
    else if(action==='sync')await synchronize();
    else if(action==='backup')download('mizan-workspace-'+localDate()+'.json',JSON.stringify(state,null,2));
    else if(action==='export-csv')exportCSV(b.dataset.report);
    else if(action==='print-report')printReport(b.dataset.report);
    else if(action==='print-inspection')printReport('inspection',id);
    else if(action==='scan')await startScan();
    else if(action==='enable-camera')await enableCamera();
    else if(action==='lookup-asset')lookupAsset();
    else if(action==='persist-storage'){const ok=await navigator.storage?.persist?.();toast(ok?'Browser granted persistent storage.':'Browser did not grant persistent storage. Keep pending work synchronized.');}
    else if(action==='export-operation'){const q=queue.find(q=>q.id===id);download('mizan-local-change-'+id+'.json',JSON.stringify(q,null,2));}
    else if(action==='repair-operation'){
      const q=queue.find(q=>q.id===id);const d=structuredClone(q.data);d.userId=user.id;d.id=uid();drafts.push(d);await write('drafts',drafts);queue=queue.filter(q=>q.id!==id);await write('queue',queue);startInspection(null,null,d);
    }
    else if(action==='open-conflict'){const q=queue.find(q=>q.id===id);if(q.kind==='finding_action')findingDetail(q.data.id);else if(q.kind==='review_inspection')inspectionDetail(q.data.id);else if(q.kind==='resolve_flag')flagDetail(q.data.id);else toast('Download the local copy and review the equipment register before discarding.');}
    else if(action==='discard-operation'){openModal('Discard this pending change?','This removes only the unsynchronized local operation.',`<p style="font-size:13px;line-height:1.8">Download a local copy first if you need to retain it. Synchronized server records will remain unchanged.</p>`,`<div>${btn('export-operation','Download copy','download','small',`data-id="${id}"`)}</div>${btn('confirm-discard','Discard change','trash','danger',`data-id="${id}"`)}`);}
    else if(action==='confirm-discard'){queue=queue.filter(q=>q.id!==id);await write('queue',queue);await closeModal();toast('Pending local change discarded.');}
    else if(action==='logout'){
      if(!isOnline)throw new Error('Connect to the server to sign out safely. Your offline work remains available.');
      await api('logout',{});await write('user',null);user=null;form=null;$('#modal-root').replaceChildren();document.body.style.overflow='';renderLogin();
    }
  }catch(err){const error=$('#modal-error')||$('#form-error');if(error){error.textContent=err.message;error.scrollIntoView({block:'nearest'});}else toast(err.message,true);}
});
document.addEventListener('keydown',e=>{
  const modal=$('.modal');
  if(e.key==='Escape'&&modal){e.preventDefault();closeModal().catch(()=>{});}
  if(e.key==='Tab'&&modal){const focusables=$$('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]',modal).filter(x=>x.offsetParent!==null);if(!focusables.length)return;const first=focusables[0],last=focusables.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  if(e.key==='/'&&!modal&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&user){e.preventDefault();page='equipment';search='';listFilter='all';render();$('[data-search]').focus();}
});
window.addEventListener('online',()=>{isOnline=true;synchronize(true);});
window.addEventListener('offline',()=>{isOnline=false;if(state)render();});
window.addEventListener('beforeunload',e=>{if(photoBusy){e.preventDefault();e.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&form)saveDraft(false).catch(()=>{});});

let swReloading = false;
function showUpdateAvailable(registration) {
  if ($('#sw-update')) return;
  const button = document.createElement('button');
  button.id = 'sw-update';
  button.className = 'btn primary';
  button.textContent = 'Update available · Reload';
  button.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:200;box-shadow:0 8px 24px #173d3040';
  button.addEventListener('click', () => {
    if (form) { toast('Save or close the inspection before updating.', true); return; }
    swReloading = true;
    registration.waiting?.postMessage({type:'SKIP_WAITING'});
    window.location.reload();
  });
  document.body.append(button);
}
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  const registration = await navigator.serviceWorker.register('/sw.js', {updateViaCache:'none'});
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdateAvailable(registration);
    });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || swReloading) return;
    if (form) showUpdateAvailable(registration);
    else { swReloading = true; window.location.reload(); }
  });
  await registration.update();
  if (registration.waiting && hadController) showUpdateAvailable(registration);
}

async function boot(){
  try{
    [user,state,queue,drafts,syncedAt]=await Promise.all([read('user'),read('state'),read('queue',[]),read('drafts',[]),read('syncedAt')]);
    if(user&&state){render();try{const session=await api('session');if(session.user.id!==user.id){user=session.user;await write('user',user);}for(const q of myQueue())if(q.errorStatus===401){delete q.error;delete q.errorStatus;}await synchronize(true);}catch(e){if(e.status===401){user=null;await write('user',null);renderLogin();}else{isOnline=false;render();}}}
    else renderLogin();
    registerServiceWorker().catch(()=>{});
  }catch(e){app.innerHTML=`<div class="boot"><div class="notice error">Browser storage is unavailable. Enable site storage and reload to use offline inspections.</div></div>`;}
}
boot();
