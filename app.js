'use strict';

// ============================================================
// EVENT DELEGATION — central HTML-handler registry
// ============================================================
// All HTML-bound click handlers live in HANDLERS. Templates use the act() helper
// to produce data-action + data-args attributes. A single document-level click
// listener dispatches to HANDLERS[action] with the parsed args.
// This replaces the older pattern of 76 separate window.* global assignments.
const HANDLERS = {};

// Produce data-action + data-args attributes for use inside template literals.
// Example: <button ${act('archiveProject', p.id)}>Arkiver</button>
function act(name, ...args){
  const a = args.length ? ` data-args='${JSON.stringify(args).replace(/'/g, "&#39;")}'` : '';
  return `data-action="${name}"${a}`;
}

// Single delegated click handler. Looks up the action on the nearest ancestor with
// a data-action attribute and invokes HANDLERS[action] with the parsed args.
document.addEventListener('click', (ev) => {
  const t = ev.target.closest && ev.target.closest('[data-action]');
  if (!t) return;
  // Optional event modifiers via data attributes
  if (t.dataset.stop === '1') ev.stopPropagation();
  if (t.dataset.preventDefault === '1') ev.preventDefault();
  const action = t.dataset.action;
  const fn = HANDLERS[action];
  if (typeof fn !== 'function') return;
  let args = [];
  if (t.dataset.args){
    try { args = JSON.parse(t.dataset.args.replace(/&#39;/g, "'")); }
    catch (err) { console.error('Could not parse data-args for ' + action, err, t.dataset.args); return; }
  }
  try { fn.apply(null, [...args, ev, t]); }
  catch (err) { console.error('HANDLERS.' + action + ' threw:', err); }
});

// ----- HTML-bound handler helpers (replaces former inline onclick expressions) -----

// Notes editor: generic execCommand wrapper. Pass cmd as arg, optional value as second arg.
HANDLERS.execCmd = (cmd, value) => {
  document.execCommand(cmd, false, value === undefined ? null : value);
  const ed = document.getElementById('note-editor');
  if (ed) ed.focus();
};

// Notes editor: colour / highlight selects. Non-click inline attributes (onchange=)
// must call HANDLERS.X explicitly — see ADR 0012.
HANDLERS.noteTextColor = (sel) => {
  if (!sel || !sel.value) return;
  document.execCommand('foreColor', false, sel.value);
  sel.value = '';
  const ed = document.getElementById('note-editor');
  if (ed) ed.focus();
};

HANDLERS.noteHighlight = (sel) => {
  if (!sel || !sel.value) return;
  document.execCommand('hiliteColor', false, sel.value);
  sel.value = '';
  const ed = document.getElementById('note-editor');
  if (ed) ed.focus();
};

// Notes editor: prompt for URL, then insert as link
HANDLERS.insertLink = () => {
  const u = prompt('Lim inn URL');
  if (u) document.execCommand('createLink', false, u);
  const ed = document.getElementById('note-editor');
  if (ed) ed.focus();
};

// Open a project page (replaces inline state.ui.openProjectId=...;state.ui.view='projects';render())
HANDLERS.openProject = (pid) => {
  state.ui.openProjectId = pid;
  state.ui.view = 'projects';
  _syncHash(true);
  render();
};

// Back to project list (replaces inline state.ui.openProjectId=null;render())
HANDLERS.backToProjects = () => {
  state.ui.openProjectId = null;
  _syncHash(true);
  render();
};

// Switch to a view, closing any open modal. For calendar views (day/week/
// month/overview), reset the anchor to today so clicking the nav-button
// always opens at "now" rather than wherever the user last scrolled.
// Browsing within the view via the ‹ › arrows still works as before.
// Requested by Maria 2026-06-08.
const CALENDAR_VIEWS = ['day', 'week', 'month', 'overview'];

// ============================================================
// RUTING: adressen er hvor du er (ADR 0036)
// ============================================================
// Før bodde «hvor er jeg» bare i lagret state, og nettleserens tilbakeknapp gjorde
// ingenting — eller forlot appen. Det ga to feil på rad (ADR 0034): fanen kunne ikke
// komme seg ut av et åpent prosjekt, fordi posisjonen var en lagret verdi og ikke en
// adresse. Nå er hash-en sannheten man kan navigere i, og state følger den.
//
// Norske segmenter, fordi URL-en er noe hun ser: #/prosjekter/p-meox, #/uke/2026-08-10.
const ROUTE_BY_VIEW = { home:'hjem', projects:'prosjekter', todos:'todos', day:'dag', week:'uke', month:'maned', overview:'arsoversikt' };
const VIEW_BY_ROUTE = Object.fromEntries(Object.entries(ROUTE_BY_VIEW).map(([v,r])=>[r,v]));
const _isDateKey = s => /^\d{4}-\d{2}-\d{2}$/.test(s||'');

// Ruten som beskriver dagens state.
function _routeFromState(){
  const v = state.ui.view || 'home';
  const seg = ROUTE_BY_VIEW[v] || 'hjem';
  if (v === 'projects' && state.ui.openProjectId) return `/prosjekter/${encodeURIComponent(state.ui.openProjectId)}`;
  if (v === 'overview') return `/arsoversikt/${state.ui.overviewAnchor || todayKey()}`;
  if (CALENDAR_VIEWS.includes(v)) return `/${seg}/${state.ui.anchor || todayKey()}`;
  return `/${seg}`;
}

// Setter state fra en rute. Returnerer false hvis ruten ikke er gjenkjent, slik at en
// ukjent adresse ikke stille lander deg et tilfeldig sted.
function _applyRoute(route){
  const parts = String(route||'').replace(/^#/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (!parts.length) return false;
  const view = VIEW_BY_ROUTE[parts[0].toLowerCase()];
  if (!view) return false;
  state.ui.view = view;
  if (view === 'projects'){
    const pid = parts[1];
    // Ukjent eller slettet prosjekt ⇒ kortrutenettet, ikke en tom side.
    state.ui.openProjectId = (pid && (state.projects||[]).some(p=>p.id===pid)) ? pid : null;
  } else {
    state.ui.openProjectId = null;
    if (CALENDAR_VIEWS.includes(view) && _isDateKey(parts[1])){
      if (view === 'overview') state.ui.overviewAnchor = parts[1];
      else state.ui.anchor = parts[1];
    }
  }
  return true;
}

// `push` gir en oppføring i historikken (brukerens egne navigasjonssteg).
// Uten `push` bare speiles adressen, så et bakgrunns-pull ikke fyller historikken.
function _syncHash(push){
  const want = '#' + _routeFromState();
  if (location.hash === want) return;
  try {
    if (push) location.hash = want;
    else history.replaceState(null, '', location.pathname + location.search + want);
  } catch(_){ /* history kan være utilgjengelig i noen innebygde visninger */ }
}

// Ingen undertrykkelses-flagg og ingen timere: en hash vi satte selv er per definisjon
// lik ruten state alt beskriver, og da gjør vi ingenting. Det er robust der et flagg
// med `setTimeout` ville vært skjørt.
window.addEventListener('hashchange', ()=>{
  const current = _routeFromState();
  const next = (location.hash || '').replace(/^#/, '');
  if (!next || next === current) return;
  if (_applyRoute(next)) render();
  else _syncHash(false);          // ukjent adresse: skriv tilbake den vi faktisk er på
});

HANDLERS.switchView = (view) => {
  if (CALENDAR_VIEWS.includes(view)) {
    state.ui.anchor = todayKey();
    if (view === 'overview') state.ui.overviewAnchor = todayKey();
  }
  // Fanemenyen skal alltid lande på startsiden i en visning. `openProjectId` overlever
  // både visningsbytte og sidelasting (den er med i den lagrede ui-tilstanden), så
  // «Prosjekter» førte deg tilbake INN i prosjektet du sist hadde åpent — også etter en
  // tur via Hjem. Fanene er de eneste kallstedene for switchView, og ingen av dem har
  // grunn til å beholde et åpent prosjekt. ADR 0034.
  state.ui.openProjectId = null;
  state.ui.view = view;
  // Velg-modus hører til To Do's-siden. Et utvalg som lå og ventet mens hun var på
  // Hjem ville handlingslinja plutselig operert på ved retur. ADR 0042.
  _selReset();
  if (document.querySelector('.modal-bg.open')) closeModal();
  _syncHash(true);        // brukerens eget navigasjonssteg ⇒ historikk-oppføring
  render();
};

// Toggle the "show completed todos" flag
HANDLERS.toggleShowCompleted = () => {
  state.ui.showCompletedTodos = !state.ui.showCompletedTodos;
  saveState();
  render();
};

// Open the task-form modal pre-filled with a due date (used by the day view "+ Ny")
HANDLERS.openTaskFormWithDate = (key) => {
  HANDLERS.openTaskForm(null, { due: key });
};

// Wikilink resolution from notes (replaces inline event.preventDefault();HANDLERS.resolveWikilink(this.dataset.target))
HANDLERS.openWikilink = (...args) => {
  // Last 2 args from listener are (event, element). The target is on the element's dataset.
  const t = args[args.length - 1];
  if (t && t.dataset && t.dataset.target) HANDLERS.resolveWikilink(t.dataset.target);
};

// Navigate to a specific date in the day view (used by backlinks)
HANDLERS.goToDate = (date) => {
  state.ui.anchor = date || todayKey();
  state.ui.view = 'day';
  render();
};

// Close modal then start voice capture (replaces inline closeModal();HANDLERS.startVoiceCapture())
HANDLERS.closeModalThenVoice = () => {
  closeModal();
  HANDLERS.startVoiceCapture();
};

// Delete a project task while inside the task-edit modal, then close
HANDLERS.deleteProjectTaskAndClose = (pid, tid) => {
  const p = state.projects.find(x => x.id === pid);
  const t = p ? (p.tasks || []).find(x => x.id === tid) : null;
  deleteWithUndo(()=>_projectArr(pid, 'tasks'), tid, `«${t ? t.title : 'oppgaven'}»`);
  saveState();
  closeModal();
  render();
};

// Slår opp en av prosjektets lister på nytt. Brukes som `getArr` til
// deleteWithUndo, som med vilje ikke fanger referansen — se ADR 0039.
function _projectArr(pid, key){
  const p = (state.projects || []).find(x => x.id === pid);
  if (!p) return null;
  if (!Array.isArray(p[key])) p[key] = [];
  return p[key];
}

// "No-op" handler used purely for the side effect of stopping click propagation via data-stop="1"
HANDLERS.noop = () => {};

// ============================================================
// CONSTANTS — Norwegian labels, categories, dates
// ============================================================
const I18N = {
  appName: 'Planlegger',
  views: { home:'Hjem', projects:'Prosjekter', todos:"To Do's", day:'Dag', week:'Uke', month:'Måned', overview:'Årsoversikt' },
  filters: { all:'Alle', arbeid:'Jobb', privat:'Privat' },
  weekdaysShort: ['Man','Tir','Ons','Tor','Fre','Lør','Søn'],
  weekdaysLong: ['Mandag','Tirsdag','Onsdag','Torsdag','Fredag','Lørdag','Søndag'],
  weekdaysMini: ['M','T','O','T','F','L','S'],
  months: ['januar','februar','mars','april','mai','juni','juli','august','september','oktober','november','desember'],
  monthsShort: ['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des'],
  today:'I dag', cancel:'Avbryt', save:'Lagre', delete:'Slett', add:'Legg til',
  noEvents:'Ingen hendelser', noTasks:'Ingen oppgaver', noNotes:'Ingen notater enda', noProjects:'Ingen prosjekter ennå',
};

// SVG icons — minimal, monochrome, currentColor-based (matches surrounding text color)
const ICONS = {
  plus: '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  mail: '<svg viewBox="0 0 24 24"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
  alert: '<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
  star: '<svg viewBox="0 0 24 24"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>',
  check: '<svg viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>',
  pencil: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
  x: '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  arrowUpRight: '<svg viewBox="0 0 24 24"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7,7 17,7 17,17"/></svg>',
  trendingUp: '<svg viewBox="0 0 24 24"><polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
};
function icon(name, size){ return `<span class="icon" style="${size?`width:${size}px;height:${size}px`:''}">${ICONS[name]||''}</span>`; }

const PRIORITIES = [
  { id:'urgent', label:'Urgent',     short:'Urgent',     color:'#b04949' },
  { id:'short',  label:'Short term', short:'Short',      color:'#c9a87a' },
  { id:'long',   label:'Long term',  short:'Long',       color:'#6b7d99' },
];
const PRIO_BY_ID = Object.fromEntries(PRIORITIES.map(p=>[p.id,p]));

// Project templates — 'offset' is days relative to targetDate (negative = before, 0 = day of)
const PROJECT_TEMPLATES = [
  { id:'reise', label:'Reise / ferie', category:'reise',
    description:'Tur eller ferie — booking, pakking, reisedokumenter',
    tasks:[
      { title:'Diskutere destinasjon', offset:-90 },
      { title:'Sett budsjett', offset:-90 },
      { title:'Sjekk feriedager / koordiner med jobb', offset:-85 },
      { title:'Booke fly', offset:-75 },
      { title:'Booke overnatting', offset:-60 },
      { title:'Forsikring + reisedokumenter', offset:-30 },
      { title:'Pakke', offset:-2 },
    ], milestones:[{ title:'Avreise', offset:0 }] },
  { id:'bryllup-gjest', label:'Bryllup (som gjest)', category:'personlig',
    description:'Bryllup hvor du er gjest',
    tasks:[
      { title:'Svare på invitasjon (RSVP)', offset:-90 },
      { title:'Velge antrekk', offset:-45 },
      { title:'Bestille gave', offset:-14 },
      { title:'Frisør / sminke', offset:-1 },
    ], milestones:[] },
  { id:'konferanse', label:'Konferanse / arrangement', category:'arbeid',
    description:'Faglig konferanse eller arrangement',
    tasks:[
      { title:'Påmelding', offset:-60 },
      { title:'Booke reise + overnatting', offset:-45 },
      { title:'Forberede presentasjon (hvis aktuelt)', offset:-14 },
      { title:'Sett agenda — hvilke sesjoner', offset:-3 },
    ], milestones:[] },
  { id:'trening', label:'Treningsmål (løp / event)', category:'helse',
    description:'Trene mot et spesifikt mål — løp, event eller utfordring',
    tasks:[
      { title:'Finn og meld på arrangement', offset:-120 },
      { title:'Sett opp treningsplan', offset:-120 },
      { title:'Kjøp utstyr (sko, etc.)', offset:-110 },
      { title:'Test-økt på 50% distanse', offset:-75 },
      { title:'Test-økt på 75% distanse', offset:-45 },
      { title:'Tapering-uke', offset:-7 },
    ], milestones:[] },
  { id:'investering', label:'Investeringsprosess (DD → IC → Closing)', category:'arbeid',
    description:'Investeringsprosess: DD → term sheet → IC → closing',
    tasks:[
      { title:'Initial screening / teaser', offset:null },
      { title:'Management-møte', offset:null },
      { title:'Finansiell DD', offset:null },
      { title:'Kommersiell DD', offset:null },
      { title:'Juridisk DD', offset:null },
      { title:'Term sheet', offset:null },
      { title:'Forhandling', offset:null },
      { title:'Final IC-godkjenning', offset:null },
      { title:'Closing', offset:null },
    ], milestones:[] },
];

// Pending template selection (used by openProjectForm + saveProjectForm)
let _pendingTemplate = null;

const CATEGORIES = [
  { id:'arbeid', label:'Jobb',   color:'var(--work)' },
  { id:'privat', label:'Privat', color:'var(--personlig)' },
];
const CAT_BY_ID = Object.fromEntries(CATEGORIES.map(c=>[c.id,c]));
// Legacy mapping — old categories collapse into 'privat' on load
const _LEGACY_CAT_MAP = { personlig:'privat', helse:'privat', reise:'privat' };

// Easter Sunday computation (Anonymous Gregorian algorithm) — needed for moveable feasts
function easterSunday(year){
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19*a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2*e + 2*i - h - k) % 7;
  const m = Math.floor((a + 11*h + 22*l) / 451);
  const month = Math.floor((h + l - 7*m + 114) / 31);
  const day = ((h + l - 7*m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// Generate Norwegian holidays for a given year (computed dynamically — works for any year)
function generateNorwegianHolidays(year){
  const result = {};
  const easter = easterSunday(year);
  const offset = n => { const x = new Date(easter); x.setDate(x.getDate()+n); return x; };
  const k = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  result[`${year}-01-01`] = 'Nyttårsdag';
  result[k(offset(-7))] = 'Palmesøndag';
  result[k(offset(-3))] = 'Skjærtorsdag';
  result[k(offset(-2))] = 'Langfredag';
  result[k(offset(0))] = '1. påskedag';
  result[k(offset(1))] = '2. påskedag';
  result[`${year}-05-01`] = 'Arbeidernes dag';
  result[k(offset(39))] = 'Kristi himmelfartsdag';
  const pinse1 = k(offset(49));
  const pinse2 = k(offset(50));
  result[pinse1] = result[pinse1] ? result[pinse1] + ' / 1. pinsedag' : '1. pinsedag';
  result[pinse2] = result[pinse2] ? result[pinse2] + ' / 2. pinsedag' : '2. pinsedag';
  // 17. mai may overlap with 2. pinsedag (e.g. 2027)
  const may17 = `${year}-05-17`;
  result[may17] = result[may17] ? result[may17] + ' / Grunnlovsdag' : 'Grunnlovsdag';
  result[`${year}-12-24`] = 'Julaften';
  result[`${year}-12-25`] = '1. juledag';
  result[`${year}-12-26`] = '2. juledag';
  result[`${year}-12-31`] = 'Nyttårsaften';
  return result;
}

// Cached holidays per year, computed on demand
const _holidayCache = {};
function getHoliday(key){
  const year = parseInt(key.slice(0, 4));
  if (!Number.isFinite(year)) return undefined;
  if (!_holidayCache[year]){
    _holidayCache[year] = generateNorwegianHolidays(year);
  }
  return _holidayCache[year][key];
}

// Compatibility shim: HOLIDAYS[key] still works via Proxy (auto-computes year on access)
const HOLIDAYS = new Proxy({}, {
  get(_target, key){ return getHoliday(String(key)); },
  has(_target, key){ return getHoliday(String(key)) !== undefined; },
});

// Holidays are computed dynamically per year via generateNorwegianHolidays() above.
// The Årsoversikt window is also computed dynamically in renderOverview() (rolling 24 months
// around the anchor date). No hardcoded year limits anywhere.

// ============================================================
// DATE UTILS — Monday-first
// ============================================================
const pad = n => String(n).padStart(2,'0');
const dKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fromKey = k => { const [y,m,d]=k.split('-').map(Number); return new Date(y,m-1,d); };
const sameDay = (a,b) => a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
const todayKey = () => dKey(new Date());
const monIdx = d => (d.getDay()+6)%7; // 0 = Monday
function startOfWeek(d){ const x=new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate()-monIdx(x)); return x; }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
// Horisont for gjentakende hendelser uten sluttdato. Var 5 år, og en ukentlig
// hendelse laget i dag sluttet dermed å vises i 2031 uten et ord. Taket fantes for å
// bremse en loop som ikke lenger stepper. ADR 0032.
const RECUR_HORIZON_YEARS = 25;
function addMonths(d,n){ return new Date(d.getFullYear(), d.getMonth()+n, 1); }
function monthDays(y,m){ return new Date(y,m+1,0).getDate(); }
// Add n months, PRESERVING the day of month (clamped to the target month's last day,
// so 31 Jan + 1 month = 28/29 Feb). Distinct from addMonths(), which snaps to the 1st
// on purpose for calendar navigation — using that one for RRULE expansion collapsed
// every monthly recurrence onto the 1st. See ADR 0025.
function addMonthsKeepDay(d, n){
  const day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  t.setDate(Math.min(day, monthDays(t.getFullYear(), t.getMonth())));
  return t;
}
// BYDAY weekday codes → JS getDay() numbers
const _BYDAY_NUM = { SU:0, MO:1, TU:2, WE:3, TH:4, FR:5, SA:6 };
// All dates in month (y,m) falling on weekday dow. ord > 0 picks the nth, ord < 0 the
// nth from the end, ord === 0 returns every one (BYDAY without an ordinal).
function _weekdaysOfMonth(y, m, dow, ord){
  const all = [];
  const n = monthDays(y, m);
  for (let day = 1; day <= n; day++){
    const d = new Date(y, m, day);
    if (d.getDay() === dow) all.push(d);
  }
  if (!ord) return all;
  const idx = ord > 0 ? ord - 1 : all.length + ord;
  return all[idx] ? [all[idx]] : [];
}
function isoWeek(d){
  const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  const dn=t.getUTCDay()||7; t.setUTCDate(t.getUTCDate()+4-dn);
  const ys=new Date(Date.UTC(t.getUTCFullYear(),0,1));
  return Math.ceil((((t-ys)/86400000)+1)/7);
}
function fmtDate(d){ return `${d.getDate()}. ${I18N.months[d.getMonth()]} ${d.getFullYear()}`; }
function fmtDateShort(d){ return `${d.getDate()}. ${I18N.monthsShort[d.getMonth()]}`; }
function fmtMonth(y,m){ return `${I18N.months[m].charAt(0).toUpperCase()+I18N.months[m].slice(1)} ${y}`; }

// ---------------------------------------------------------------------------
// RELATIVE DATOETIKETTER (ADR 0040)
// «12. aug» tvinger leseren til å regne selv. «om 3 dager» leses uten å tenke.
// Innenfor ±7 dager vinner det relative; utenfor er den absolutte datoen både
// kortere og mer presis, så da bytter vi tilbake. Den fulle datoen legges alltid
// i title-attributtet på kallstedet, slik at ingenting går tapt.
// ---------------------------------------------------------------------------
const REL_WINDOW_DAYS = 7;

// Hele døgn mellom to YYYY-MM-DD-nøkler (b minus a). fromKey() gir lokal midnatt,
// så et sommertidsskifte gjør differansen 23 eller 25 timer — derfor Math.round,
// ikke Math.floor: med floor ville 25 timer blitt «0 dager» om høsten.
function daysBetweenKeys(aKey, bKey){
  if (!aKey || !bKey) return null;
  const a = fromKey(aKey), b = fromKey(bKey);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  return Math.round((b - a) / 86400000);
}

// Lang variant — brukes der det er plass (To Do-lista, Hjem).
function relDateLabel(key, todayK){
  if (!key) return '';
  const d = daysBetweenKeys(todayK || todayKey(), key);
  if (d === null) return '';
  if (d === 0) return 'i dag';
  if (d === 1) return 'i morgen';
  if (d === -1) return 'i går';
  if (d > 1 && d <= REL_WINDOW_DAYS) return `om ${d} dager`;
  if (d < -1 && d >= -REL_WINDOW_DAYS) return `${-d} dager på overtid`;
  return fmtDateShort(fromKey(key));
}

// Kompakt variant for smale kolonner — prosjektkortenes datokolonne er 68 px.
// «5 d siden» er det lengste den kan produsere.
function relDateShort(key, todayK){
  if (!key) return '';
  const d = daysBetweenKeys(todayK || todayKey(), key);
  if (d === null) return '';
  if (d === 0) return 'i dag';
  if (d === 1) return 'i morgen';
  if (d === -1) return 'i går';
  if (d > 1 && d <= REL_WINDOW_DAYS) return `om ${d} d`;
  if (d < -1 && d >= -REL_WINDOW_DAYS) return `${-d} d siden`;
  return fmtDateShort(fromKey(key));
}

// Full dato til title-attributt. Egen funksjon fordi alle kallstedene skal ha
// nøyaktig samme fallback-oppførsel på en ugyldig nøkkel: tom streng.
function absDateTitle(key){
  if (!key) return '';
  const d = fromKey(key);
  return isNaN(d.getTime()) ? '' : fmtDate(d);
}

// ---------------------------------------------------------------------------
// HANDLINGSRIKE TOMME TILSTANDER (ADR 0043)
// «Ingen delmål satt» er en blindvei: den forteller hva som mangler, men ikke hva
// man gjør med det. Knappen tar samme plass og fører videre. `attrs` er enten
// act(...) eller rå data-attributter.
// ---------------------------------------------------------------------------
function emptyAction(label, attrs){
  if (!label || !attrs) return '';
  return `<div class="es-act"><button class="es-btn" ${attrs}>${escapeHTML(label)}</button></div>`;
}

// Setter markøren i et felt som allerede står på siden, og ruller det til syne.
// Tomme tilstander for delmål/personer/lenker peker på skjemaet rett over lista
// i stedet for å åpne en dialog — feltet er der, det er bare ikke åpenbart.
HANDLERS.focusField = (id)=>{
  const el = document.getElementById(id);
  if (!el) return;
  if (el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.focus();
};

// ---------------------------------------------------------------------------
// FAST FARGE PER PROSJEKT (ADR 0041)
// Chipen var grå overalt, så en tagget oppgave måtte leses for å plasseres.
// Fargen utledes av tittelen — ingen ny state, ingen fargevelger, og samme
// prosjekt får samme farge på alle enheter uten at noe må synkroniseres.
// Bare nyansen varierer; metning og lyshet ligger i CSS, én gang for lys og én
// gang for mørk modus, så kontrasten er kontrollert begge steder.
// ---------------------------------------------------------------------------
function projectHue(title){
  const s = String(title || '');
  let h = 0;
  for (let i = 0; i < s.length; i++){ h = (h * 31 + s.charCodeAt(i)) >>> 0; }
  return h % 360;
}

// Én dør for prosjekt-chipen — seks steder rendret den hver for seg, og bare ett
// av dem hadde klikk-for-å-fjerne. Ekstra attributter sendes inn av det stedet
// som trenger dem.
function projChipHTML(title, attrs){
  if (!title) return '';
  return `<span class="proj-chip" style="--pc-h:${projectHue(title)}"${attrs ? ' ' + attrs : ''}>${escapeHTML(title)}</span>`;
}

// Calendar event positioning: returns CSS for top/height so events visually span their full duration.
// slotH = pixel height of one hour slot.
function evDurationStyle(e, slotH){
  if (!e.start) return '';
  const [sh, sm] = e.start.split(':').map(Number);
  let durationMin = 60; // default 1 hour if no end
  if (e.end){
    const [eh, em] = e.end.split(':').map(Number);
    durationMin = (eh*60 + em) - (sh*60 + sm);
    if (durationMin <= 0) durationMin = 60;
  }
  const topOffset = (sm/60) * slotH;
  const minVisible = Math.max(slotH*0.45, 20);
  const height = Math.max(minVisible, (durationMin/60) * slotH - 2);
  // z-index range 1–99 — keeps shorter events on top of longer ones for click access,
  // while staying well below modal z-index (5000)
  const z = Math.max(1, Math.min(99, Math.round(99 - durationMin/15)));
  return `top:${topOffset}px;height:${height}px;z-index:${z};`;
}

// ============================================================
// STATE MANAGEMENT
// ============================================================
const STORAGE_KEY = 'planlegger.v1';
// Outlook-cachen bor for seg selv. Den er 95 % av blobben, den er hentbar med én knapp,
// og den er enhetslokal — hver enhet henter ICS-feeden selv. Da hører den verken i
// hovednøkkelen (som skrives ved hver render), i sky-blobben (som lastes hvert 60. sekund)
// eller i øyeblikksbildene. Målt før: 652 kB hovednøkkel og ~39 MB/time nedlasting fra
// pollingen; etter: ~35 kB og ~2 MB/time. ADR 0032.
const OUTLOOK_KEY = 'planlegger.outlook.v1';

function _loadOutlookCache(){
  try {
    const raw = localStorage.getItem(OUTLOOK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (err){
    console.error('Outlook-cachen kunne ikke leses', err);
    return null;
  }
}
let _lastOutlookWritten = null;
function _saveOutlookCache(){
  const arr = state.outlookEvents || [];
  const json = JSON.stringify(arr);
  if (json === _lastOutlookWritten) return { ok: true, unchanged: true };
  try {
    localStorage.setItem(OUTLOOK_KEY, json);
    _lastOutlookWritten = json;
    return { ok: true };
  } catch (err){
    console.error('Outlook-cachen kunne ikke lagres', err);
    if (typeof showToast === 'function'){
      showToast('⚠ Outlook-kalenderen kunne ikke lagres lokalt (lagringsplassen er full). Den hentes på nytt ved neste synk.', 10000);
    }
    return { ok: false, error: err.message || String(err) };
  }
}
const STATE_VERSION = 4;
const DEFAULT_STATE = {
  themes: {},      // legacy yearly themes — migrated to yearFocus
  yearFocus: {},   // { "2026": "string" }  optional
  quarterly: {},   // legacy — migrated to quarterFocus
  quarterFocus: {},// { "2026-Q2": "string" } optional
  monthFocus: {},  // { "2026-07": "string" } optional
  events: [],
  outlookEvents: [],  // synced from Outlook ICS — read-only
  tasks: [],
  projects: [],
  goals: [],
  habits: [],
  notes: {},
  reviews: {},
  inbox: [],
  // UI preferences and current view state (formerly part of `settings`)
  ui: {
    view: 'home',
    filter: 'all',
    anchor: dKey(new Date()),
    overviewAnchor: '',
    theme: 'auto',
    projectViewMode: 'list',
    showCompletedTodos: false,
    openProjectId: null,
    notifications: true,
  },
  // Sync configuration and cloud state (formerly part of `settings`)
  sync: {
    icsUrl: '',
    lastSync: '',
    syncUrl: '',
    syncToken: '',
    lastWeeklyExport: '',
  },
  meta: { version: 4, createdAt: new Date().toISOString() }
};

let state = loadState();

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)){
      throw new Error('Stored state is not an object');
    }
    // Normalise bucket types BEFORE anything iterates them. A single wrong-typed
    // bucket (tasks:{} or projects:null) used to throw, and the catch below then
    // returned an empty DEFAULT_STATE which render()'s saveState() wrote straight
    // over the original blob — losing everything. See ADR 0022.
    ['events','tasks','projects','outlookEvents','inbox','goals','habits'].forEach(k=>{
      if (!Array.isArray(parsed[k])) delete parsed[k];
    });
    ['ui','sync','themes','quarterly','yearFocus','quarterFocus','monthFocus','reviews','notes','meta'].forEach(k=>{
      if (parsed[k] === null || typeof parsed[k] !== 'object' || Array.isArray(parsed[k])) delete parsed[k];
    });
    const merged = Object.assign(structuredClone(DEFAULT_STATE), parsed, {
      ui: Object.assign({}, DEFAULT_STATE.ui, parsed.ui || {}),
      sync: Object.assign({}, DEFAULT_STATE.sync, parsed.sync || {}),
      themes: Object.assign({}, DEFAULT_STATE.themes, parsed.themes||{}),
    });
    // Migration (2026-05-26): flat state.settings → state.ui + state.sync.
    // Also folds in two older legacy fixups: filter 'personlig' → 'privat',
    // and view 'strategy'/'fokus' → 'home'.
    // Always strip merged.settings regardless of whether ui/sync also exist —
    // settings is dead schema, never read anywhere. If parsed lacks ui/sync entirely
    // (a pre-2026-05-26 blob), fold the legacy fields in first; parsed.ui/parsed.sync
    // still win where present.
    if (parsed.settings) {
      if (!parsed.ui || !parsed.sync) {
        const s = parsed.settings;
        const legacyFilter = (s.filter === 'personlig') ? 'privat' : s.filter;
        const legacyView = (s.view === 'strategy' || s.view === 'fokus' || s.view === 'list') ? 'home' : s.view;
        merged.ui = Object.assign({}, DEFAULT_STATE.ui, {
          view: legacyView, filter: legacyFilter, anchor: s.anchor, overviewAnchor: s.overviewAnchor,
          theme: s.theme, projectViewMode: s.projectViewMode, showCompletedTodos: s.showCompletedTodos,
          openProjectId: s.openProjectId, notifications: s.notifications,
        }, parsed.ui || {});
        merged.sync = Object.assign({}, DEFAULT_STATE.sync, {
          icsUrl: s.icsUrl, lastSync: s.lastSync, syncUrl: s.syncUrl, syncToken: s.syncToken,
          lastWeeklyExport: s.lastWeeklyExport,
        }, parsed.sync || {});
      }
      delete merged.settings;
    }
    // Migration: legacy goals -> projects
    if (merged.goals && merged.goals.length && (!merged.projects || !merged.projects.length)){
      merged.projects = merged.goals.map(g=>({
        id:g.id, title:g.title, category:g.category||'personlig',
        startDate:'', targetDate:g.target||'', description:'', notes:g.notes||'',
        tasks:[], milestones:(g.milestones||[]).map(m=>({id:m.id,title:m.title,date:m.date,done:!!m.done})),
        people:[], links:[], status:'active', archived:false
      }));
      merged.goals = [];
    }
    // Migration: legacy categories (personlig/helse/reise) -> 'privat'
    const migrateCat = (obj)=>{
      if (obj && obj.category && _LEGACY_CAT_MAP[obj.category]){
        obj.category = _LEGACY_CAT_MAP[obj.category];
      }
    };
    (merged.events||[]).forEach(migrateCat);
    (merged.tasks||[]).forEach(migrateCat);
    (merged.outlookEvents||[]).forEach(migrateCat);
    (merged.habits||[]).forEach(migrateCat);
    (merged.projects||[]).forEach(p=>{
      migrateCat(p);
      (p.tasks||[]).forEach(migrateCat);
    });
    // Migration: legacy themes (array per year) -> yearFocus (string per year)
    Object.entries(merged.themes||{}).forEach(([y, arr])=>{
      if (Array.isArray(arr) && arr.length && !merged.yearFocus[y]){
        merged.yearFocus[y] = arr.filter(Boolean).join(' · ');
      }
    });
    // Migration: legacy quarterly (array) -> quarterFocus (string)
    Object.entries(merged.quarterly||{}).forEach(([q, arr])=>{
      if (Array.isArray(arr) && arr.length && !merged.quarterFocus[q]){
        merged.quarterFocus[q] = arr.filter(Boolean).join(' · ');
      }
    });
    // Ensure each project has the new fields (for partial v1->v2 data)
    (merged.projects||[]).forEach(p=>{
      p.tasks = p.tasks||[]; p.milestones = p.milestones||[]; p.people = p.people||[]; p.links = p.links||[];
      if (!p.status) p.status = 'active';
      // Migrate old single notes string → noteList array (multiple named notes)
      if (!p.noteList){
        p.noteList = [];
        if (p.notes && p.notes.trim()){
          // Convert legacy plain/markdown text to safe HTML (paragraphs + line breaks)
          const escaped = String(p.notes).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          const html = escaped.split(/\n\n+/).map(par => '<p>' + par.replace(/\n/g, '<br>') + '</p>').join('');
          p.noteList.push({ id: 'note-mig-' + Math.random().toString(36).slice(2,10), title: 'Notater', content: html });
        }
      }
    });
    // Stamp the schema version so a future version-gated migration has something to
    // gate on. It was never written back before, so every load reported the stored
    // value (or undefined) forever. See ADR 0022.
    // The List view was removed 2026-08-10 (ADR 0024) — send anyone parked there home.
    if (merged.ui && merged.ui.view === 'list') merged.ui.view = 'home';
    if (!merged.meta) merged.meta = {};
    merged.meta.version = STATE_VERSION;
    // Outlook-cachen: egen nøkkel vinner. Finnes den ikke, men hovedblobben har en
    // cache, er dette første load etter oppgraderingen — skriv den over, og la
    // originalen ligge i hovedblobben til neste saveState fjerner den. Verste utfall
    // hvis skrivingen feiler er en tom kalender til neste synk, som er ett klikk.
    const ownCache = _loadOutlookCache();
    if (ownCache){
      merged.outlookEvents = ownCache;
      _lastOutlookWritten = JSON.stringify(ownCache);
    } else if ((merged.outlookEvents||[]).length){
      // Skriv direkte her, ikke via _saveOutlookCache: den leser den globale `state`,
      // som ennå ikke er tilordnet mens loadState kjører.
      try {
        const json = JSON.stringify(merged.outlookEvents);
        localStorage.setItem(OUTLOOK_KEY, json);
        _lastOutlookWritten = json;
        console.info('[migrering] Outlook-cachen flyttet til egen nøkkel (' + merged.outlookEvents.length + ' hendelser)');
      } catch (err){
        console.error('[migrering] klarte ikke skrive Outlook-cachen til egen nøkkel', err);
      }
    }
    return merged;
  }catch(e){
    console.error('State load failed', e);
    // Do NOT let the caller silently continue with an empty state — render() ends in
    // saveState(), which would overwrite the unreadable-but-possibly-salvageable blob.
    // Keep the original bytes under a recovery key and tell the user. See ADR 0022.
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) localStorage.setItem('planlegger.unreadable.' + Date.now(), raw);
    } catch(_){}
    const fresh = structuredClone(DEFAULT_STATE);
    fresh.meta.loadFailed = (e && e.message) || String(e);
    return fresh;
  }
}
// ============================================================
// GLOBAL ERROR SURFACE
// ============================================================
// The delegated click dispatcher catches handler throws, but anything thrown from a
// setTimeout, a promise, or module top-level used to vanish into the console — which is
// how a full localStorage quota could lose a whole session while the UI looked fine.
// Surface it once per session so a silent failure is at least visible. See ADR 0022.
let _globalErrorShown = false;
function _reportGlobalError(what, err){
  console.error('Unhandled ' + what, err);
  if (_globalErrorShown) return;
  _globalErrorShown = true;
  const msg = String((err && (err.message || err.name)) || err || '');
  const isQuota = /quota|exceeded|storage/i.test(msg);
  if (typeof showToast === 'function'){
    showToast(isQuota
      ? '⚠ Lagringsplassen er full — eksportér til JSON nå og slett store bilder fra notater.'
      : '⚠ Noe gikk galt internt: ' + msg.slice(0, 120) + ' — sjekk at siste endring ble lagret.', 15000);
  }
}
window.addEventListener('error', e => _reportGlobalError('error', e.error || e.message));
window.addEventListener('unhandledrejection', e => _reportGlobalError('rejection', e.reason));

// Track last-saved body (state without lastModified) so we only bump timestamp on real changes
let _lastSavedBody = null;
// Staten uten Outlook-cachen — dette er det som lagres, sammenlignes og pushes.
// `outlookEvents` er utelatt overalt utenom eksport: den er enhetslokal og hentbar.
function _stateWithoutCache(){
  const out = {};
  for (const k of Object.keys(state)) if (k !== 'outlookEvents') out[k] = state[k];
  return out;
}
function _computeStateBody(){
  if (!state.meta) state.meta = {};
  const lm = state.meta.lastModified;
  state.meta.lastModified = 0;
  const json = JSON.stringify(_stateWithoutCache());
  state.meta.lastModified = lm;
  return json;
}
let _lastWriteOk = false;
function saveState(){
  if (!state.meta) state.meta = {};
  // Cachen ligger utenfor sammenligningskroppen (ADR 0032), så den må lagres for seg —
  // FØR hurtigveien under. Ellers ville en Outlook-synk, som bare endrer cachen, blitt
  // sett som «ingenting er endret» og kalenderen aldri lagret. Kallet er gratis når
  // cachen er uendret.
  _saveOutlookCache();
  const body = _computeStateBody();
  if (_lastSavedBody === null){
    // First save in this session — initialize baseline without bumping
    _lastSavedBody = body;
  } else if (body !== _lastSavedBody){
    // Real data change — bump timestamp and schedule remote sync
    state.meta.lastModified = Date.now();
    _lastSavedBody = body;
    scheduleRemoteSync();
  } else if (_lastWriteOk && (STORAGE_KEY in localStorage)){
    // Ingenting er endret, forrige skriving gikk bra, og nøkkelen står der ⇒ blobben på
    // disk er allerede identisk. Før serialiserte vi hele staten to ganger (én gang for
    // sammenligningen, én gang for skrivingen) og skrev den på nytt ved HVER render() og
    // hvert 400. ms mens hun skriver — for å lagre presis samme bytes. Målt 12,1 ms per
    // kall, hvorav ~8 ms var denne andre runden.
    // `in` sjekker nøkkelen uten å kopiere ut 649 kB, og lukker smutthullet der noe
    // annet (f.eks. resetAll) har fjernet nøkkelen bak ryggen vår. ADR 0031.
    return;
  }
  // localStorage can throw QuotaExceededError — notes may contain base64 images, and
  // the backup rings are pruned by count, not bytes. This used to be unguarded, so a
  // full quota lost every edit in the session while the UI looked saved. See ADR 0022.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_stateWithoutCache()));
    _saveFailed = false;
    _lastWriteOk = true;
  } catch (err) {
    _lastWriteOk = false;
    console.error('saveState failed', err);
    if (!_saveFailed){
      _saveFailed = true;
      // Free what we safely can, then retry once before bothering the user.
      const freed = _pruneStorage();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(_stateWithoutCache()));
        _saveOutlookCache();
        _saveFailed = false;
        _lastWriteOk = true;
        console.warn('saveState recovered after pruning ' + freed + ' old backup key(s)');
      } catch (err2) {
        if (typeof showToast === 'function'){
          showToast('⚠ Kunne ikke lagre — lagringsplassen er full. Eksportér til JSON nå, og slett store bilder fra notater.', 15000);
        }
      }
    }
  }
}
let _saveFailed = false;
// Drop the oldest recovery/pre-sync/backup keys to make room. Never touches the live
// state key, and keeps the two most recent daily backups.
function _pruneStorage(){
  const droppable = [];
  for (let i = 0; i < localStorage.length; i++){
    const k = localStorage.key(i);
    if (!k || k === STORAGE_KEY) continue;
    if (/^planlegger\.(preSync|unreadable)\./.test(k)) droppable.push({k, keep:0});
    else if (/^planlegger\.backup\./.test(k)) droppable.push({k, keep:1});
  }
  droppable.sort((a,b)=> a.keep - b.keep || a.k.localeCompare(b.k));
  const backups = droppable.filter(d=>d.keep===1);
  const protectedKeys = new Set(backups.slice(-2).map(d=>d.k));
  let n = 0;
  for (const d of droppable){
    if (protectedKeys.has(d.k)) continue;
    try { localStorage.removeItem(d.k); n++; } catch(_){}
  }
  return n;
}

// ============================================================
// ØYEBLIKKSBILDER: beskytt det Maria har skrevet, ikke cachen (ADR 0030)
// ============================================================
// Outlook-hendelsene er hentbare — én knapp henter dem igjen. De var likevel 95 % av
// hvert øyeblikksbilde: målt 2026-08-11 var hver snapshot 615 kB, mot ~35 kB uten dem.
// Åtte av dem fylte localStorage til 4951 kB av ~5120 tilgjengelige, og da sluttet
// dagsbackupen å virke. Ringene ble beskåret på ANTALL, aldri på bytes, så grensene
// «5 preSync + 7 backup» var trygge da state var liten og en tidsinnstilt bombe etterpå.
const SNAPSHOT_OMITS = ['outlookEvents'];
const SNAPSHOT_BUDGET_BYTES = 1.5 * 1024 * 1024;

function _snapshotJSON(){
  const slim = {};
  for (const k of Object.keys(state)){
    if (!SNAPSHOT_OMITS.includes(k)) slim[k] = state[k];
  }
  slim._snapshotOmits = SNAPSHOT_OMITS;   // gjenopprettingen leser denne
  return JSON.stringify(slim);
}

// Nøkkelformat: `planlegger.preSync.<ISO>` og `planlegger.backup.<YYYY-MM-DD>`.
// ADR 0031: sorteringen MÅ gå på parset tid, ikke på strengen. Leksikografisk sortering
// på tvers av prefiksene setter alle `backup.*` før alle `preSync.*` (b < p), så et
// preSync fra juni rangerte som «nyere» enn dagsbackupen fra 11. august og ble beholdt
// mens dagsbackupen ble slettet. To skrivesteder brukte i tillegg `Date.now()` og to
// brukte ISO, som ikke sorterer likt engang.
function _snapshotTime(k){
  const raw = k.replace('planlegger.backup.','').replace('planlegger.preSync.','').replace('planlegger.unreadable.','');
  if (/^\d+$/.test(raw)) return Number(raw);                       // arv: Date.now()-nøkler
  // ISO-ish: 2026-08-11T09-00-00 eller 2026-08-11
  const iso = raw.replace(/T(\d\d)-(\d\d)-(\d\d)$/, 'T$1:$2:$3');
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;                                  // uparsebar ⇒ eldst
}

function _snapshotKeys(){
  // `unreadable.*` er en full kopi av en ødelagt state-blob. Den lå utenfor budsjettet
  // og kunne dermed okkupere ~650 kB av kvoten permanent, usynlig.
  return Object.keys(localStorage)
    .filter(k => k.startsWith('planlegger.backup.') || k.startsWith('planlegger.preSync.') || k.startsWith('planlegger.unreadable.'))
    .sort((a,b) => _snapshotTime(a) - _snapshotTime(b));            // eldst først
}

// Beskjær nyeste-først til budsjettet.
// **Det nyeste øyeblikksbildet beskyttes alltid, uansett størrelse.** Uten det gulvet
// slettet et enkelt øyeblikksbilde større enn budsjettet seg selv — og `autoBackup`
// stemplet `ok: true` etterpå. Ett innlimt bilde i et notat er nok til å komme dit.
function _pruneSnapshotsToBudget(){
  const keys = _snapshotKeys().reverse();   // nyeste først
  const sizeOf = k => { const v = localStorage.getItem(k); return (v ? v.length : 0) + k.length; };
  let used = 0, dropped = 0, first = true;
  for (const k of keys){
    const size = sizeOf(k);
    if (first){
      first = false;
      used += size;                          // gulvet: nyeste står alltid
      continue;
    }
    if (used + size > SNAPSHOT_BUDGET_BYTES){
      try { localStorage.removeItem(k); dropped++; } catch(_){}
    } else {
      used += size;
    }
  }
  if (dropped) console.warn('[snapshots] beskar ' + dropped + ' gammelt øyeblikksbilde over budsjettet (' +
    Math.round(used/1024) + ' kB beholdt)');
  return dropped;
}

// Alle fire skrivesteder for preSync gikk hver sin vei: to hadde antallsgrense, ett
// beskar før, ett gjorde ingen av tingene, og alle fire svelget feilen i `catch(_){}` —
// selv om dette er den ENE veien tilbake fra en destruktiv operasjon. Én dør nå.
function _writePreSyncSnapshot(){
  const key = 'planlegger.preSync.' + new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
  _pruneSnapshotsToBudget();                 // lag plass FØR, ikke etter
  try {
    localStorage.setItem(key, _snapshotJSON());
  } catch (err){
    console.error('preSync-øyeblikksbilde feilet', err);
    if (typeof showToast === 'function'){
      showToast('⚠ Klarte ikke lagre øyeblikksbilde først — du kan ikke rulle tilbake dette. Eksportér til JSON nå hvis du vil være trygg.', 15000);
    }
    return { ok: false, error: err.message || String(err) };
  }
  const psKeys = Object.keys(localStorage).filter(k=>k.startsWith('planlegger.preSync.'))
    .sort((a,b)=> _snapshotTime(a) - _snapshotTime(b));
  while (psKeys.length > 5) localStorage.removeItem(psKeys.shift());
  _pruneSnapshotsToBudget();
  // Beskjæringen kan i prinsippet ha spist den vi nettopp skrev. Sjekk, ikke anta.
  if (!localStorage.getItem(key)){
    console.error('preSync-øyeblikksbilde forsvant i beskjæringen', key);
    if (typeof showToast === 'function'){
      showToast('⚠ Øyeblikksbildet ble ikke beholdt — lagringsplassen er for full. Eksportér til JSON nå.', 15000);
    }
    return { ok: false, error: 'beskåret bort' };
  }
  return { ok: true, key };
}

// Brukes av lagre-handlerne når posten de redigerte ikke finnes lenger.
function _warnVanished(){
  console.warn('Lagring forkastet: posten finnes ikke lenger i state');
  if (typeof showToast === 'function'){
    showToast('⚠ Denne posten finnes ikke lenger — den ble antakelig slettet på en annen enhet mens du redigerte. Endringen ble ikke lagret.', 12000);
  }
}

// Et øyeblikksbilde uten Outlook-cachen skal ikke tømme kalenderen ved gjenoppretting.
function _mergeSnapshot(parsed){
  const omitted = Array.isArray(parsed._snapshotOmits) ? parsed._snapshotOmits : [];
  const carried = {};
  for (const k of omitted) carried[k] = state[k];   // behold det som står nå
  delete parsed._snapshotOmits;
  const next = Object.assign(structuredClone(DEFAULT_STATE), parsed);
  for (const k of omitted) if (carried[k] !== undefined) next[k] = carried[k];
  return next;
}

// ============================================================
// CROSS-DEVICE SYNC (Cloudflare KV)
// ============================================================
let _syncDebounceTimer = null;
let _syncStatus = { state:'idle', lastSyncAt:0, error:null };
// Last PUSH failure, tracked separately: push and pull shared one status, so a
// successful poll erased a failed push within 60 s and the indicator went green
// while the cloud never received the change. See ADR 0023.
let _lastPushError = null;
// Last Outlook sync failure (auto-sync used to discard errors entirely).
let _outlookStatus = { failedAt: 0, error: null };
const SYNC_DEBOUNCE_MS = 2500;

function scheduleRemoteSync(){
  if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
  if (!state.sync.syncUrl || !state.sync.syncToken) return;
  // Guard: don't auto-push if local is empty (prevents wiping cloud data on a fresh device).
  // Manual "Send til sky" button bypasses this.
  // Outlook events are NOT content for this purpose: a fresh device that has only
  // pulled the ICS feed would otherwise pass the guard and push its empty projects,
  // tasks and events over good cloud data. Mirrors the pull-side guard.
  const hasContent = ((state.projects||[]).length + (state.tasks||[]).length + (state.events||[]).length) > 0;
  if (!hasContent){
    // Vakten er riktig, men den var stille: sletter du det siste prosjektet, blir
    // indikatoren stående grønn mens slettingen aldri når skyen — og pullet henter
    // den ikke tilbake, siden lokal `lastModified` er nyere. To enheter kan divergere
    // permanent mens begge sier «synket». ADR 0031.
    _syncStatus.state = 'blocked';
    _syncStatus.error = 'Lokalt er tomt for prosjekter, oppgaver og hendelser, så pushen er stanset for å ikke overskrive skyen. Bruk «Send til sky» i Innstillinger hvis dette er med vilje.';
    updateSyncIndicator();
    return;
  }
  if (_syncStatus.state === 'blocked'){ _syncStatus.state = 'idle'; _syncStatus.error = null; }
  _syncDebounceTimer = setTimeout(pushToRemote, SYNC_DEBOUNCE_MS);
}

async function pushToRemote(){
  if (!state.sync.syncUrl || !state.sync.syncToken) return;
  _syncStatus.state = 'pushing';
  updateSyncIndicator();
  try {
    const url = state.sync.syncUrl + (state.sync.syncUrl.includes('?')?'&':'?') + 'token=' + encodeURIComponent(state.sync.syncToken);
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type':'application/json' },
      // Uten Outlook-cachen: hver enhet henter ICS-feeden selv, så å pushe den er å
      // laste opp 617 kB som mottakeren kaster. ADR 0032.
      body: JSON.stringify(_stateWithoutCache()),
    });
    if (!res.ok) throw new Error('HTTP '+res.status);
    _syncStatus.state = 'synced';
    _syncStatus.lastSyncAt = Date.now();
    _syncStatus.error = null;
    _lastPushError = null;
  } catch (e) {
    _syncStatus.state = 'error';
    _syncStatus.error = e.message;
    _lastPushError = { at: Date.now(), error: e.message };
  }
  updateSyncIndicator();
}

// Fetch list of weekly cloud backups from sync worker
async function loadCloudBackups(){
  if (!state.sync.syncUrl || !state.sync.syncToken) return [];
  try {
    const base = state.sync.syncUrl.replace(/\/+$/, '');
    const url = base + '/backups?token=' + encodeURIComponent(state.sync.syncToken);
    const res = await fetch(url);
    // Distinguish "no backups" from "couldn't ask". Returning [] for both told the
    // user to update their worker when the real problem was an expired token.
    if (!res.ok) return { error: res.status === 401 || res.status === 403
      ? 'Ikke autorisert (' + res.status + ') — sjekk synk-tokenet.'
      : 'HTTP ' + res.status };
    const data = await res.json();
    return Array.isArray(data.backups) ? data.backups : [];
  } catch(e){ return { error: e.message || 'Nettverksfeil' }; }
}

HANDLERS.restoreCloudBackup = async (key)=>{
  const dateStr = key.replace('backup-','');
  if (!confirm(`Erstatt all nåværende data med sky-backup ${dateStr}?\n\nEt pre-sync-øyeblikksbilde lages automatisk før, så du kan rulle tilbake hvis du ombestemmer deg.`)) return;
  // Save current as pre-sync snapshot. Feiler den, sier den fra — se ADR 0031.
  _writePreSyncSnapshot();
  // Fetch backup
  try {
    const base = state.sync.syncUrl.replace(/\/+$/,'');
    const url = base + '/backups/' + encodeURIComponent(key) + '?token=' + encodeURIComponent(state.sync.syncToken);
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    if (!data || !data.meta) throw new Error('Tom backup');
    // Preserve sync credentials we actually have — an empty local value must not
    // overwrite a good one from the backup. Same reasoning as pullFromRemote.
    const localSync = {};
    ['syncUrl','syncToken','icsUrl'].forEach(k=>{ if (state.sync[k]) localSync[k] = state.sync[k]; });
    // Behold den lokale Outlook-cachen: sky-blobber lagd etter ADR 0032 inneholder den
    // ikke, og DEFAULT_STATE ville da tømt kalenderen.
    const keepCache = state.outlookEvents || [];
    state = Object.assign(structuredClone(DEFAULT_STATE), data);
    state.sync = Object.assign({}, state.sync, localSync);
    if (!(data.outlookEvents||[]).length) state.outlookEvents = keepCache;
    state.meta.lastModified = Date.now();
    _lastSavedBody = _computeStateBody();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_stateWithoutCache()));
    _saveOutlookCache();
    closeModal();
    render();
    showToast(`✓ Gjenopprettet fra ${dateStr}`);
    // Schedule push so other devices get the restored state
    scheduleRemoteSync();
  } catch(e){ alert('Klarte ikke gjenopprette: '+e.message); }
};

async function pullFromRemote(silent, force){
  if (!state.sync.syncUrl || !state.sync.syncToken) return { ok:false, reason:'not configured' };
  if (!silent){ _syncStatus.state = 'pulling'; updateSyncIndicator(); }
  try {
    const url = state.sync.syncUrl + (state.sync.syncUrl.includes('?')?'&':'?') + 'token=' + encodeURIComponent(state.sync.syncToken);
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP '+res.status);
    const remote = await res.json();
    const remoteMod = (remote && remote.meta && remote.meta.lastModified) || 0;
    const localMod = (state.meta && state.meta.lastModified) || 0;
    // Guard rail: detect populated vs empty state
    const remoteHasContent = ((remote.projects||[]).length + (remote.tasks||[]).length + (remote.events||[]).length) > 0;
    const localHasContent = ((state.projects||[]).length + (state.tasks||[]).length + (state.events||[]).length) > 0;
    let pulled = false;
    let shouldPull = false;
    if (force){
      // Manual "Hent fra sky" — always pull whatever's there
      shouldPull = !!remote.meta;
    } else if (remoteMod > localMod && remote.meta){
      // Auto-pull: only if remote is newer AND we won't accidentally wipe local data
      if (!localHasContent || remoteHasContent){
        shouldPull = true;
      }
      // Else: local has data but remote is empty → skip pull (prevents wipe)
    }
    if (shouldPull){
      // Save a pre-sync snapshot if local had content (for conflict recovery).
      // Dette er det automatiske 60-sekunders pullet: det erstatter hele state uten at
      // Maria ber om det, så øyeblikksbildet er det eneste nettet. ADR 0031.
      if (localHasContent){
        _writePreSyncSnapshot();
      }
      // Preserve local sync credentials — but only the ones we actually have. Copying
      // them unconditionally meant an EMPTY local value overwrote a good remote one, so
      // a device that never had the ICS URL could never learn it from the cloud. That's
      // why Outlook events sat frozen from 2026-05-23 on this browser. See ADR 0022.
      const localSync = {};
      ['syncUrl','syncToken','icsUrl'].forEach(k=>{ if (state.sync[k]) localSync[k] = state.sync[k]; });
      // Behold den lokale Outlook-cachen — se ADR 0032. Uten dette ville hvert pull
      // tømt kalenderen inntil neste ICS-synk.
      const keepCache = state.outlookEvents || [];
      state = Object.assign(structuredClone(DEFAULT_STATE), remote);
      state.sync = Object.assign({}, state.sync, localSync);
      if (!(remote.outlookEvents||[]).length) state.outlookEvents = keepCache;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_stateWithoutCache()));
      _saveOutlookCache();
      // Update baseline so subsequent render's saveState doesn't trigger an unnecessary push
      _lastSavedBody = _computeStateBody();
      pulled = true;
    }
    // A successful pull must not paint over an unresolved push failure — the change
    // that failed to upload is still only on this device. See ADR 0023.
    if (_lastPushError){
      _syncStatus.state = 'error';
      _syncStatus.error = 'Siste opplasting feilet: ' + _lastPushError.error;
    } else {
      _syncStatus.state = 'synced';
      _syncStatus.error = null;
    }
    _syncStatus.lastSyncAt = Date.now();
    updateSyncIndicator();
    if (pulled) render();
    return { ok:true, pulled, remoteMod, localMod };
  } catch (e) {
    _syncStatus.state = 'error';
    _syncStatus.error = e.message;
    updateSyncIndicator();
    return { ok:false, error:e.message };
  }
}

function updateSyncIndicator(){
  const el = document.getElementById('sync-indicator');
  if (!el) return;
  const cfg = state.sync.syncUrl && state.sync.syncToken;
  if (!cfg){ el.style.display='none'; return; }
  el.style.display='inline-flex';
  const map = {
    idle:    { color:'var(--ink-muted)', label:'·' },
    synced:  { color:'#588a58', label:'●' },
    pushing: { color:'#c9a87a', label:'↑' },
    pulling: { color:'#c9a87a', label:'↓' },
    error:   { color:'#b04949', label:'!' },
    blocked: { color:'#b04949', label:'⨯' },
  };
  const s = map[_syncStatus.state] || map.idle;
  el.style.color = s.color;
  const ago = _syncStatus.lastSyncAt ? Math.round((Date.now()-_syncStatus.lastSyncAt)/1000) : 0;
  const tip = (_syncStatus.state==='error' || _syncStatus.state==='blocked')
    ? (_syncStatus.state==='blocked' ? 'Push stanset: ' : 'Synk-feil: ') + (_syncStatus.error||'ukjent')
    : (ago<60?'synket nå':(`sist synket ${Math.round(ago/60)} min siden`));
  el.textContent = s.label;
  el.title = tip;
}

function lastSyncRemoteLabel(){
  if (!_syncStatus.lastSyncAt) return 'aldri';
  const ago = (Date.now() - _syncStatus.lastSyncAt) / 60000;
  if (ago<1) return 'nå nettopp';
  if (ago<60) return Math.round(ago)+' min siden';
  return Math.round(ago/60)+' t siden';
}
const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);

// ============================================================
// QUERIES
// ============================================================
function passesFilter(item){
  const f = state.ui.filter;
  if (f==='all') return true;
  if (f==='arbeid') return item.category==='arbeid';
  if (f==='privat') return item.category==='privat' || ['personlig','helse','reise'].includes(item.category);
  return true;
}
// True if event covers the given day-key (handles multi-day via endDate)
function eventCoversDay(e, key){
  const start = e.date;
  const end = e.endDate && e.endDate >= start ? e.endDate : start;
  return start <= key && key <= end;
}
// For a recurring event, return the instance that covers the given day, or null.
// The instance preserves the event's duration. Doesn't create new IDs (uses same id + suffix).
function recurringInstanceOnDay(e, key){
  if (!e.recurring) return null;
  const baseStart = fromKey(e.date);
  const baseEnd = e.endDate ? fromKey(e.endDate) : baseStart;
  const durationMs = baseEnd.getTime() - baseStart.getTime();
  const target = fromKey(key);
  if (target < baseStart) return null;
  if (e.recurringUntil && fromKey(key) > fromKey(e.recurringUntil)) return null;
  // Horisont. Var 5 år, satt fordi loopen gikk ett steg av gangen og måtte bremses et
  // sted. Nå at alle fire typer regnes ut aritmetisk finnes ikke den grunnen lenger, og
  // en ukentlig hendelse laget i dag sluttet å vises i 2031 uten et ord. ADR 0032.
  const maxEnd = new Date(baseStart); maxEnd.setFullYear(maxEnd.getFullYear()+RECUR_HORIZON_YEARS);
  if (target > maxEnd) return null;

  const hit = (cur, n)=>{
    const curEnd = new Date(cur.getTime() + durationMs);
    if (cur <= target && target <= curEnd){
      return { ...e, id: e.id + '-r' + n, _origId: e.id, _isRecurring: true,
               date: dKey(cur), endDate: durationMs > 0 ? dKey(curEnd) : '' };
    }
    return null;
  };

  // For `daily` og `weekly` hopper vi rett til området rundt målet. Den gamle loopen gikk
  // ett steg av gangen fra seriens start og allokerte to Date-objekter per steg, kalt én
  // gang per (gjentakende hendelse × dagcelle) — 112 ganger per ukesvisning. Kostnaden
  // vokste med kalendertid, ikke med dataene: en daglig serie fra 2022 målte 124 ms per
  // tegning. Å legge til `i` dager fra basen er per definisjon identisk med å steppe `i`
  // ganger med én dag, så semantikken er uendret. Verifisert med differansetest over
  // 153 600 tilfeller. ADR 0031.
  if (e.recurring === 'daily' || e.recurring === 'weekly'){
    const DAY = 86400000;
    const stride = e.recurring === 'daily' ? 1 : 7;
    const spanDays = Math.max(0, Math.round(durationMs / DAY));
    const gapDays = Math.round((target - baseStart) / DAY);
    const guess = Math.floor(gapDays / stride);
    const back = Math.ceil(spanDays / stride) + 1;
    for (let n = Math.max(0, guess - back); n <= guess + 1; n++){
      const cur = addDays(baseStart, n * stride);
      if (cur > target) break;
      const found = hit(cur, n);
      if (found) return found;
    }
    return null;
  }

  // `monthly` og `yearly` regnes fra BASEN med `addMonthsKeepDay`, som bevarer dagen i
  // måneden og klamrer til månedens siste dag.
  //
  // Før brukte denne `addMonths` kumulativt, og `addMonths` snapper til den 1. — så en
  // månedlig serie fra 31. januar ble 31/1 → 1/2 → 1/3 og lå på den 1. for alltid.
  // Kommentaren over `addMonthsKeepDay` sier rett ut at nettopp dette ble rettet for
  // ICS-serier (ADR 0025): «using that one for RRULE expansion collapsed every monthly
  // recurrence onto the 1st». Den manuelle gjentakelsen ble aldri rettet. Det var altså
  // samme feil i den andre kodestien, ikke et designvalg — presis mønsteret sjekklista
  // mi ber meg sveipe etter. Marias kalender hadde null manuelle gjentakende hendelser
  // da dette ble rettet, så ingenting flyttet seg. ADR 0032.
  const monthStep = e.recurring === 'monthly' ? 1 : 12;
  const guessM = ((target.getFullYear()-baseStart.getFullYear())*12 + (target.getMonth()-baseStart.getMonth()));
  const guessN = Math.floor(guessM / monthStep);
  // Gå noen få steg bakover: varigheten kan strekke seg inn i målmåneden, og klamringen
  // kan skyve en forekomst en dag eller to.
  const spanMonths = Math.ceil(Math.max(0, durationMs) / (28*86400000)) + 1;
  for (let n = Math.max(0, guessN - spanMonths); n <= guessN + 1; n++){
    const cur = addMonthsKeepDay(baseStart, n * monthStep);
    if (cur > target) break;
    const found = hit(cur, n);
    if (found) return found;
  }
  return null;
}
function eventsOnDay(key){
  const own = [];
  state.events.forEach(e=>{
    if (!passesFilter(e)) return;
    if (e.recurring){
      const inst = recurringInstanceOnDay(e, key);
      if (inst){
        own.push({...inst, _isContinuation: inst.date !== key, _isLastDay: (inst.endDate||inst.date)===key, _isMultiDay: !!(inst.endDate && inst.endDate>inst.date)});
      }
    } else if (eventCoversDay(e, key)){
      own.push({...e, _isContinuation: e.date !== key, _isLastDay: (e.endDate||e.date)===key, _isMultiDay: !!(e.endDate && e.endDate>e.date)});
    }
  });
  // Outlook events: always visible regardless of Jobb/Privat-filter (Outlook is used for both)
  const outlook = (state.outlookEvents||[]).filter(e=>eventCoversDay(e,key))
    .map(e=>({...e, _isContinuation: e.date !== key, _isLastDay: (e.endDate||e.date)===key, _isMultiDay: !!(e.endDate && e.endDate>e.date)}));
  // Project's own event (if it has a target date covering this day)
  const projects = state.projects
    .filter(p=>!p.archived && passesFilter(p) && projectEventCoversDay(p,key))
    .map(p=>{
      const start = p.targetDate;
      const end = p.targetEndDate && p.targetEndDate >= start ? p.targetEndDate : start;
      return {
        id: 'proj-'+p.id,
        _projectId: p.id,
        _kind: 'project',
        title: p.title,
        date: start,
        endDate: end > start ? end : '',
        start: '',
        end: '',
        category: p.category,
        _isContinuation: start !== key,
        _isLastDay: end === key,
        _isMultiDay: end > start,
      };
    });
  // Multi-day events sort first so the continuous bar sits at the top of every
  // cell along the run. Within each group (multi vs single), sort by start time.
  return [...own, ...outlook, ...projects].sort((a,b)=>{
    if (a._isMultiDay !== b._isMultiDay) return a._isMultiDay ? -1 : 1;
    return (a.start||'').localeCompare(b.start||'');
  });
}
function tasksOnDay(key){
  // Free-floating tasks. If a task is tagged to a project (via t.projectId), set
  // _projectTitle so downstream renderers (calendar, Forfaller-i-dag, list-view)
  // show the "· project-title" tag the same way they already do for project subtasks.
  const free = state.tasks.filter(t=>t.due===key && passesFilter(t)).map(t=>{
    const p = t.projectId ? state.projects.find(x=>x.id===t.projectId) : null;
    return { ...t, _kind:'task', _projectTitle: p ? p.title : '' };
  });
  // Project sub-tasks (with multi-day support)
  const proj = [];
  state.projects.filter(p=>!p.archived && passesFilter(p)).forEach(p=>{
    (p.tasks||[]).forEach(t=>{
      if (!t.due) return;
      const start = t.due;
      const end = t.endDate && t.endDate >= start ? t.endDate : start;
      if (start <= key && key <= end){
        const isMulti = end > start;
        proj.push({
          ...t, _kind:'projectTask', _projectId:p.id, _projectTitle:p.title, category:p.category,
          _isContinuation: t.due !== key, _isLastDay: end===key, _isMultiDay: isMulti
        });
      }
    });
    (p.milestones||[]).filter(m=>m.date===key).forEach(m=>{
      proj.push({id:m.id, title:m.title, due:m.date, done:!!m.done, _kind:'milestone', _projectId:p.id, _projectTitle:p.title, category:p.category});
    });
  });
  return [...free, ...proj];
}
function projectsActive(){ return state.projects.filter(p=>!p.archived && passesFilter(p)); }
function projectsArchived(){ return state.projects.filter(p=>p.archived && passesFilter(p)); }
// Project's next upcoming date — earliest of: targetDate, undone task dues, undone milestone dates that are today or later.
// Returns { date, label } or null.
function projectNextDate(p){
  const today = todayKey();
  const items = [];
  if (p.targetDate && p.targetDate >= today) items.push({date:p.targetDate, label:'måldato'});
  (p.tasks||[]).forEach(t=>{
    if (t.due && !t.done && t.due >= today) items.push({date:t.due, label:t.title});
  });
  (p.milestones||[]).forEach(m=>{
    if (m.date && !m.done && m.date >= today) items.push({date:m.date, label:'◆ '+m.title});
  });
  if (!items.length) return null;
  items.sort((a,b)=>a.date.localeCompare(b.date));
  return items[0];
}
// True if project's actual event covers the given day (using targetDate as start, targetEndDate as end)
function projectEventCoversDay(p, key){
  if (!p.targetDate) return false;
  const start = p.targetDate;
  const end = p.targetEndDate && p.targetEndDate >= start ? p.targetEndDate : start;
  return start <= key && key <= end;
}
function projectProgress(p){
  // Taggede To Do's teller med, slik at fremdriftslinja og «x/y oppgaver» stemmer med
  // lista kortet nå viser. Før regnet den bare på `p.tasks`, så et kort kunne liste tre
  // To Do's og samtidig si «0/1 oppgaver». ADR 0033.
  const items = [...projectTasksMerged(p), ...(p.milestones||[])];
  if (!items.length) return 0;
  const done = items.filter(i=>i.done).length;
  return Math.round(done/items.length*100);
}
function daysUntil(key){
  if (!key) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  const d = fromKey(key); d.setHours(0,0,0,0);
  return Math.round((d-now)/86400000);
}

// ============================================================
// MODAL SYSTEM
// ============================================================
const modalBg = document.getElementById('modal-bg');
const modalEl = document.getElementById('modal');
// Track whether the mousedown started on the backdrop. A `click` event's target is
// the common ancestor of mousedown and mouseup — so if the user starts a text
// selection inside the modal and releases the mouse on the backdrop, the click
// would target modalBg and close the modal. Maria reported this happening in the
// note editor. Fix: only close if BOTH mousedown and click are on the backdrop.
let _modalMouseDownOnBg = false;
modalBg.addEventListener('mousedown', e=>{ _modalMouseDownOnBg = (e.target === modalBg); });
modalBg.addEventListener('click', e=>{
  if (e.target === modalBg && _modalMouseDownOnBg) closeModal();
  _modalMouseDownOnBg = false;
});
function openModal(html){ modalEl.innerHTML = html; modalBg.classList.add('open'); }
// Optional one-shot callback a modal can register to run when it closes (e.g. the
// note editor re-rendering the page behind it so its card reflects the new title).
let _onModalClose = null;
function closeModal(){
  if (_onModalClose){
    const cb = _onModalClose;
    _onModalClose = null;
    try { cb(); } catch(e){ console.error('modal close callback threw', e); }
  } modalBg.classList.remove('open'); modalEl.innerHTML=''; }
// Expose on HANDLERS so the 11 `data-action="closeModal"` buttons in modal footers
// actually fire — without this they were silently no-ops, leaving Esc and backdrop-click
// as the only ways to dismiss a modal. Reported by Maria 2026-05-27 (Settings → Lukk).
HANDLERS.closeModal = closeModal;
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });

// ============================================================
// HURTIGTASTER (ADR 0038)
// ============================================================
// Søket lå bak et museklikk i en app hun er i daglig. «/» og Ctrl/Cmd+K åpner det, og
// pilene + Enter gjør at man aldri trenger å flytte hånden til musa for å finne noe.
let _searchHits = [];
let _searchIndex = -1;

function _searchRows(){ return [...document.querySelectorAll('#search-results .sr')]; }

function _searchMove(delta){
  const rows = _searchRows();
  if (!rows.length) return;
  _searchIndex = (_searchIndex + delta + rows.length) % rows.length;
  rows.forEach((r,i)=> r.classList.toggle('active', i === _searchIndex));
  const el = rows[_searchIndex];
  if (el && el.scrollIntoView) el.scrollIntoView({ block:'nearest' });
}

function _searchActivate(i){
  const h = _searchHits[i];
  if (!h) return;
  closeModal();
  _searchOpenHit(h);
}

document.addEventListener('keydown', e=>{
  const el = document.activeElement;
  const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  const modalOpen = !!document.querySelector('.modal-bg.open');

  // Ctrl/Cmd+K: åpner søket uansett hvor markøren står.
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')){
    e.preventDefault();
    if (!modalOpen) openSearch();
    return;
  }
  // «/»: bare når du ikke skriver i et felt — ellers kunne du ikke skrevet skråstrek.
  if (e.key === '/' && !typing && !modalOpen && !e.ctrlKey && !e.metaKey && !e.altKey){
    e.preventDefault();
    openSearch();
    return;
  }
  // Ctrl/Cmd+Z angrer siste sletting — men bare utenfor skrivefelt, der nettleserens
  // egen angring hører hjemme. Gjør ingenting når det ikke finnes noe angrepunkt. ADR 0039.
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z') && !typing){
    if (_undoEntry){ e.preventDefault(); HANDLERS.undoLast(); }
    return;
  }
  if (!modalOpen || !document.getElementById('search-results')) return;
  if (e.key === 'ArrowDown'){ e.preventDefault(); _searchMove(1); }
  else if (e.key === 'ArrowUp'){ e.preventDefault(); _searchMove(-1); }
  else if (e.key === 'Enter'){
    // Ingen rad markert ⇒ åpne det øverste treffet. Enter gjorde ingenting før.
    const i = _searchIndex >= 0 ? _searchIndex : 0;
    if (_searchHits[i]){ e.preventDefault(); _searchActivate(i); }
  }
});

// ============================================================
// MAIN RENDER
// ============================================================
const viewEl = document.getElementById('view');
function applyTheme(){
  const theme = state.ui.theme || 'auto';
  let actual = theme;
  if (theme === 'auto'){
    actual = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = actual;
}
// Listen to OS theme changes for auto mode
if (window.matchMedia){
  try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ()=>{
    if (state.ui.theme === 'auto') applyTheme();
  }); } catch(_){}
}

// ============================================================
// RENDER-KONTRAKTEN: en render() skal ikke koste deg det du skriver (ADR 0029)
// ============================================================
// `render()` bytter ut hele `#view`. Å fjerne et fokusert element fra DOM-en utløser
// ikke `blur` i noen nettleser, så et bakgrunns-pull kunne slette tekst midt i en
// setning. ADR 0023 strupet lagringen som første forsvar — men strupingen mister
// fortsatt de siste 400 ms, og den flytter markøren til slutten. Dette er andre laget:
// feltet får tilbake verdien, markøren og fokuset etter tegningen.

// Redigeringer som ennå ikke bor i state, og som må lagres FØR DOM-en byttes ut.
// Innebygd tittelredigering registrerer seg her: det feltet er injisert imperativt,
// ikke tegnet fra en mal, så det kan ikke gjenopprettes etterpå — bare lagres først.
const _pendingCommits = new Set();
function registerPendingCommit(fn){
  _pendingCommits.add(fn);
  return ()=> _pendingCommits.delete(fn);
}

let _rendering = false;

function _captureFocus(){
  const el = document.activeElement;
  if (!el || el === document.body || !viewEl.contains(el)) return null;
  const isField = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
  if (!isField) return null;
  // Felt som er lagret av en pending commit rett før dette — ikke advar om dem.
  if (el.dataset && el.dataset.transient) return null;
  const type = (el.type || '').toLowerCase();
  // Avkrysningsbokser, radio og filvelgere har ingen tekst å miste, og commiter
  // umiddelbart via onchange. Å hoppe over dem holder advarselen under meningsfull.
  if (type === 'checkbox' || type === 'radio' || type === 'file' || type === 'submit') return null;
  if (!el.id){
    // Gapet skal være synlig. ADR 0023 forkastet denne fiksen nettopp fordi felt man
    // glemmer ser trygge ut; da må de si fra selv.
    console.warn('[render] fokusert felt uten id — det du skriver her overlever ikke en render():',
      el.tagName, el.className || '(ingen class)');
    return null;
  }
  const snap = { id: el.id, editable: el.isContentEditable, scrollTop: el.scrollTop, start: null, end: null };
  snap.value = el.isContentEditable ? el.innerHTML : el.value;
  // selectionStart kaster på input-typene date/time/number — spør forsiktig.
  try { snap.start = el.selectionStart; snap.end = el.selectionEnd; } catch(_){}
  return snap;
}

function _restoreFocus(snap){
  if (!snap) return false;
  const el = document.getElementById(snap.id);
  if (!el) return false;                       // feltet finnes ikke i den nye visningen
  // Lokal skriving vinner over det tegningen la inn: brukeren står i feltet nå.
  if (snap.editable) el.innerHTML = snap.value; else el.value = snap.value;
  try { el.focus({ preventScroll: true }); } catch(_){ try { el.focus(); } catch(_){} }
  if (snap.start != null && typeof el.setSelectionRange === 'function'){
    try { el.setSelectionRange(snap.start, snap.end); } catch(_){}
  }
  el.scrollTop = snap.scrollTop;
  return true;
}

function render(){
  // Re-entrant kall — en pending commit kaller render() på slutten. Den ytre
  // tegningen produserer fersk HTML uansett, så det indre kallet er overflødig.
  if (_rendering) return;
  _rendering = true;
  try {
    for (const fn of [..._pendingCommits]){
      try { fn(); } catch (e){ console.warn('[render] pending commit feilet', e); }
    }
    _pendingCommits.clear();
    const focus = _captureFocus();
    applyTheme();
    renderTopbar();
    const v = state.ui.view;
    if (v==='home') renderHome();
    else if (v==='projects') renderProjects();
    else if (v==='todos') renderTodos();
    else if (v==='overview') renderOverview();
    else if (v==='month') renderMonth();
    else if (v==='week') renderWeek();
    else if (v==='day') renderDay();
    else renderHome(); // fallback
    _restoreFocus(focus);
    // Speil adressen mot tilstanden, uten historikk-oppføring: pilene i kalenderen og et
    // bakgrunns-pull skal oppdatere URL-en, men ikke fylle tilbakeknappen med hvert
    // enkelt ukebytte. De tre ekte navigasjonsstegene pusher selv. ADR 0036.
    _syncHash(false);
    saveState();
  } finally {
    _rendering = false;
  }
}

function renderTopbar(){
  const nav = document.getElementById('nav');
  // Compute badge counts
  const today = todayKey();
  const urgentCount = state.tasks.filter(t=>t.priority==='urgent' && !t.done && passesFilter(t)).length;
  const inboxCount = (state.inbox||[]).length;
  const todoBadge = urgentCount + inboxCount;
  // Projects with overdue items (tasks or milestones with past dates, not done)
  let overdueProjects = 0;
  state.projects.forEach(p=>{
    if (p.archived || !passesFilter(p)) return;
    const hasOverdue = (p.tasks||[]).some(t=>t.due && !t.done && t.due < today)
      || (p.milestones||[]).some(m=>m.date && !m.done && m.date < today);
    if (hasOverdue) overdueProjects++;
  });
  const badgeOf = v => {
    if (v === 'todos' && todoBadge > 0) return `<span class="badge" title="${urgentCount} urgent + ${inboxCount} innboks">${todoBadge}</span>`;
    if (v === 'projects' && overdueProjects > 0) return `<span class="badge" title="${overdueProjects} prosjekt(er) har overskredne oppgaver">${overdueProjects}</span>`;
    return '';
  };
  const isMobile = window.matchMedia('(max-width: 700px)').matches;
  const primary = ['home','projects','todos'];
  const secondary = ['day','week','month','overview'];
  if (isMobile){
    // Mobile: 3 big primary tabs + "Mer" for the rest
    const secondaryActive = secondary.includes(state.ui.view);
    const moreLabel = secondaryActive ? I18N.views[state.ui.view] : 'Mer';
    nav.innerHTML = primary
      .map(v=>`<button data-view="${v}" class="${state.ui.view===v?'active':''}">${I18N.views[v]}${badgeOf(v)}</button>`).join('')
      + `<button data-more="1" class="${secondaryActive?'active':''}">${moreLabel} ▾</button>`;
    nav.querySelectorAll('button').forEach(b=>{
      if (b.dataset.more){
        b.onclick = openMoreMenu;
      } else {
        b.onclick = ()=>{ HANDLERS.switchView(b.dataset.view); };
      }
    });
  } else {
    nav.innerHTML = ['home','projects','todos','day','week','month','overview']
      .map(v=>`<button data-view="${v}" class="${state.ui.view===v?'active':''}">${I18N.views[v]}${badgeOf(v)}</button>`).join('');
    nav.querySelectorAll('button').forEach(b=>b.onclick=()=>{ HANDLERS.switchView(b.dataset.view); });
  }

  const filter = document.getElementById('filter');
  filter.innerHTML = Object.entries(I18N.filters).map(([k,v])=>
    `<button data-f="${k}" class="${state.ui.filter===k?'active':''}">${v}</button>`).join('');
  // Filterbytte nullstiller velg-modus: et utvalg gjort under «Alle» ville ellers ligget
  // og virket på rader som ikke lenger vises. ADR 0042.
  filter.querySelectorAll('button').forEach(b=>b.onclick=()=>{ state.ui.filter=b.dataset.f; _selReset(); render(); });
}

document.getElementById('search-btn').onclick = openSearch;
document.getElementById('settings-btn').onclick = openSettings;
document.getElementById('fab').onclick = openQuickCapture;

// ============================================================
// VIEW: HJEM (Home dashboard — landing view)
// ============================================================
// -----------------------------------------------------------------------------
// HOME VIEW SECTIONS
// renderHome delegates to these small helpers. Each returns a fully-rendered
// HTML string. renderHome() itself is only responsible for gathering data,
// picking the greeting, assembling the sections, and wiring up interactive
// bits after the DOM is written (quick-capture Enter, urgent drag-reorder).
// Splitted 2026-06-09 following the ADR 0013-style section-helpers pattern.
// -----------------------------------------------------------------------------

// Section 1: URGENT (prominent, with checkboxes and drag-to-reorder)
function _homeUrgentHTML(urgent, todayK){
  return `
    <div class="home-section">
      <h3 style="color:var(--alert);display:flex;align-items:center;gap:6px">⚠ Urgent ${urgent.length?`(${urgent.length})`:''}</h3>
      ${urgent.length === 0 ? `<div class="home-empty">Ingen urgent-saker — godt jobba</div>` :
        `<div class="home-list home-list-urgent" id="urgent-list">
          ${urgent.map(t=>{
            const due = t.due ? relDateShort(t.due, todayK) : '—';
            const overdue = t.due && t.due < todayK;
            const proj = t.projectId ? state.projects.find(p=>p.id===t.projectId) : null;
            const projTag = projChipHTML(proj ? proj.title : '');
            return `<div class="home-item urgent-item ${t.done?'done':''}" draggable="true" data-task-id="${t.id}">
              <span class="drag-handle" title="Dra for å sortere">⋮⋮</span>
              <input type="checkbox" ${t.done?'checked':''} data-action="noop" data-stop="1" onchange="HANDLERS.toggleTask('${t.id}',event)">
              <div class="hi-date${overdue?' overdue':''}" title="${escapeAttr(absDateTitle(t.due))}">${escapeHTML(due)}</div>
              <div class="hi-title" data-action="openTaskForm" data-args='["${t.id}"]' style="cursor:pointer">${escapeHTML(t.title)}${projTag}</div>
            </div>`;
          }).join('')}
        </div>`}
    </div>
  `;
}

// Section 2: FORFALLER I DAG (tasks due today, mixed free + project tasks + milestones)
function _homeTodayTasksHTML(todayTasks, todayK){
  return `
    <div class="home-section">
      <h3>✓ Forfaller i dag ${todayTasks.length?`(${todayTasks.length})`:''}</h3>
      ${todayTasks.length === 0 ? `<div class="home-empty">Ingen oppgaver forfaller i dag${emptyAction('+ Ny oppgave', act('openTaskFormWithDate', todayK))}</div>` :
        `<div class="home-list">
          ${todayTasks.map(t=>{
            const isProj = t._kind === 'projectTask';
            const isMilestone = t._kind === 'milestone';
            const click = isProj ? act('openProjectTaskForm', t._projectId, t.id) : (isMilestone ? act('openProject', t._projectId) : act('openTaskForm', t.id));
            const toggleHandler = isProj ? `HANDLERS.toggleProjectTask('${t._projectId}','${t.id}',event)` : (isMilestone ? `HANDLERS.toggleProjectMilestone('${t._projectId}','${t.id}')` : `HANDLERS.toggleTask('${t.id}',event)`);
            const icon = isMilestone ? '◆' : '';
            const projTag = projChipHTML(t._projectTitle);
            return `<div class="home-item ${t.done?'done':''}">
              <input type="checkbox" ${t.done?'checked':''} data-action="noop" data-stop="1" onchange="${toggleHandler}">
              <div class="hi-date">${icon||fmtDateShort(fromKey(t.due||todayK))}</div>
              <div class="hi-title" ${click} style="cursor:pointer">${escapeHTML(t.title)}${projTag}</div>
            </div>`;
          }).join('')}
        </div>`}
    </div>
  `;
}

// Uten frist (ADR 0038). Disse er usynlige i Dag, Uke og Måned — de har ingen dato å
// vises på — så de forsvinner i praksis. Seksjonen vises bare når det finnes noen.
function _homeNoDateHTML(items){
  if (!items.length) return '';
  const LIMIT = 8;
  const shown = items.slice(0, LIMIT);
  const rest = items.length - shown.length;
  return `
    <div class="home-section">
      <h3>◦ Uten frist (${items.length})</h3>
      <div class="home-list">
        ${shown.map(t=>{
          const isProj = t._kind === 'projectTask';
          const click = isProj ? act('openProjectTaskForm', t._projectId, t.id) : act('openTaskForm', t.id);
          const toggleHandler = isProj
            ? `HANDLERS.toggleProjectTask('${t._projectId}','${t.id}',event)`
            : `HANDLERS.toggleTask('${t.id}',event)`;
          const projTag = projChipHTML(t._projectTitle);
          return `<div class="home-item">
            <input type="checkbox" data-action="noop" data-stop="1" onchange="${toggleHandler}">
            <div class="hi-date" style="color:var(--ink-muted)">–</div>
            <div class="hi-title" ${click} style="cursor:pointer">${escapeHTML(t.title)}${projTag}</div>
          </div>`;
        }).join('')}
        ${rest > 0 ? `<div class="home-item" style="cursor:default"><div class="hi-date"></div><div class="hi-title" style="color:var(--ink-muted);font-style:italic">+${rest} til uten frist</div></div>` : ''}
      </div>
    </div>
  `;
}

// Alt som gjenstår og mangler dato: frie To Do's og prosjektenes egne oppgaver.
function tasksWithoutDate(){
  const out = [];
  (state.tasks||[]).forEach(t=>{
    if (t.done || t.due || !passesFilter(t)) return;
    const p = t.projectId ? (state.projects||[]).find(x=>x.id===t.projectId) : null;
    out.push({ ...t, _kind:'task', _projectTitle: p ? p.title : '' });
  });
  (state.projects||[]).forEach(p=>{
    if (p.archived || !passesFilter(p)) return;
    (p.tasks||[]).forEach(t=>{
      if (t.done || t.due) return;
      out.push({ ...t, _kind:'projectTask', _projectId:p.id, _projectTitle:p.title });
    });
  });
  return out.sort((a,b)=> (a.order||0) - (b.order||0));
}

// Section 3: KALENDER — denne uka (7-column week view)
function _homeWeekHTML(today){
  const wkStart = startOfWeek(today);
  const wkEnd = addDays(wkStart, 6);
  const wn = isoWeek(wkStart);
  const weekDays = [];
  for (let i = 0; i < 7; i++){
    const d = addDays(wkStart, i);
    const k = dKey(d);
    weekDays.push({ d, k, events: eventsOnDay(k) });
  }
  // Week title: e.g., "Uke 20 · 11.–17. mai 2026" (with month/year spanning if needed)
  const wkTitle = wkStart.getMonth() === wkEnd.getMonth()
    ? `${wkStart.getDate()}.–${wkEnd.getDate()}. ${I18N.months[wkEnd.getMonth()]} ${wkEnd.getFullYear()}`
    : `${wkStart.getDate()}. ${I18N.monthsShort[wkStart.getMonth()]} – ${wkEnd.getDate()}. ${I18N.monthsShort[wkEnd.getMonth()]} ${wkEnd.getFullYear()}`;
  return `
    <div class="home-section">
      <h3 style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
        📅 Kalender
        <span class="hjem-week-title" style="margin-bottom:0">
          <span class="wn">Uke <strong>${wn}</strong></span>
          <span class="range">· ${wkTitle}</span>
        </span>
      </h3>
      <div class="hjem-week">
        <div class="hjem-week-grid">
          ${weekDays.map(({d, k, events})=>{
            const isToday = sameDay(d, today);
            const isWeekend = d.getDay()===0 || d.getDay()===6;
            const hol = HOLIDAYS[k];
            const eventsHTML = events.length === 0 ? `<div class="wke-empty">—</div>` :
              events.slice(0, 8).map(e=>{
                const click = e._ics ? act('openOutlookEvent', e.id) : (e._kind==='project' ? act('openProject', e._projectId) : act('editEvent', e.id));
                const cls = `wke cat-${e.category||'arbeid'}${e._ics?' ics':''}`;
                const timePart = e.start ? `<strong>${e.start}</strong> ` : '';
                return `<div class="${cls}" ${click} title="${escapeAttr(e.title)}">${timePart}${escapeHTML(e.title)}</div>`;
              }).join('') + (events.length > 8 ? `<div class="wke-empty">+ ${events.length-8} til</div>` : '');
            return `<div class="hjem-week-col ${isToday?'today':''} ${isWeekend?'weekend':''}">
              <div class="hjem-week-col-h">
                <span class="wd">${I18N.weekdaysShort[monIdx(d)]}</span>
                <span class="num">${d.getDate()}</span>
                ${hol?`<span class="hol">${escapeHTML(hol)}</span>`:''}
              </div>
              <div class="hjem-week-items">${eventsHTML}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

// Section 4: AKTIVE PROSJEKTER (projects with something happening in next 30 days)
function _homeActiveProjectsHTML(activeProjects){
  if (activeProjects.length === 0) return '';
  return `
    <div class="home-section">
      <h3>🎯 Aktive prosjekter <span style="font-size:12px;color:var(--ink-muted);font-weight:400;font-family:var(--font);font-style:italic">— neste 30 dager (${activeProjects.length})</span></h3>
      <div class="home-countdowns">
        ${activeProjects.map(({p, nd})=>{
          const days = daysUntil(nd.date);
          const featured = days <= 7 ? ' urgent' : '';
          const dayLabel = days === 0 ? 'i dag' : days === 1 ? 'i morgen' : `om ${days} dager`;
          const nextLabel = nd.label === 'måldato' ? '★ måldato' : nd.label;
          return `<div class="countdown-card${featured}" data-action="openProject" data-args='["${p.id}"]'>
            <div class="cd-label"><span class="pcat cat-${p.category}" style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--${p.category==='arbeid'?'work':'privat'});margin-right:5px;vertical-align:middle"></span>${escapeHTML(CAT_BY_ID[p.category]?.label||'')}</div>
            <div class="cd-title">${escapeHTML(p.title)}</div>
            <div class="cd-days" style="font-size:28px">${days === 0 ? 'i dag' : days}${days !== 0 ? `<small>${dayLabel.replace(/^om|i dag|i morgen/,'').trim() || (days===1?'dag til neste':'dager til neste')}</small>` : `<small>neste: ${escapeHTML(nextLabel.slice(0,30))}</small>`}</div>
            <div style="font-size:11.5px;color:var(--ink-muted);margin-top:6px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(nextLabel)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

// Section 5: Quick-capture input (Enter to add to inbox, or Dumpefelt for multi-line)
function _homeQuickCaptureHTML(){
  return `
    <div class="home-quick">
      <input id="home-quick-input" type="text" placeholder="Hva tenker du på? Trykk Enter for å legge i innboks…">
      <div class="home-quick-hint flex-row-gap">
        <span>Eller</span>
        <button data-action="openDumpModal" style="padding:5px 10px;font-size:12px;border-radius:6px;border:1px solid var(--line);background:var(--surface);color:var(--ink-soft);cursor:pointer">📋 Dumpefelt</button>
        <span>for å lime inn et helt notat med flere oppgaver</span>
      </div>
    </div>
  `;
}

// Post-render: drag-to-reorder for urgent tasks. Date deadlines still win in
// the sort; ties use the manual `order` field. Called after viewEl.innerHTML
// is set so the urgent-list element exists.
function _wireUrgentDragReorder(){
  const urgentList = document.getElementById('urgent-list');
  if (!urgentList) return;
  let draggedId = null;
  urgentList.querySelectorAll('.urgent-item').forEach(row=>{
    row.addEventListener('dragstart', e=>{
      draggedId = row.dataset.taskId;
      e.dataTransfer.effectAllowed = 'move';
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', ()=>{
      row.classList.remove('dragging');
      urgentList.querySelectorAll('.urgent-item').forEach(r=>r.classList.remove('drop-before','drop-after'));
    });
    row.addEventListener('dragover', e=>{
      if (!draggedId || draggedId === row.dataset.taskId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = row.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height/2;
      row.classList.toggle('drop-before', before);
      row.classList.toggle('drop-after', !before);
    });
    row.addEventListener('dragleave', ()=>{
      row.classList.remove('drop-before','drop-after');
    });
    row.addEventListener('drop', e=>{
      e.preventDefault();
      const targetId = row.dataset.taskId;
      if (!draggedId || draggedId === targetId) return;
      const rect = row.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height/2;
      reorderUrgent(draggedId, targetId, before);
    });
  });
}

function renderHome(){
  const today = new Date();
  const todayK = todayKey();
  const horizon30 = dKey(addDays(today, 30));
  const greetings = ['God morgen', 'Hei', 'God dag', 'God ettermiddag', 'God kveld'];
  const h = today.getHours();
  const greeting = h < 5 ? greetings[1] : h < 11 ? greetings[0] : h < 14 ? greetings[2] : h < 18 ? greetings[3] : greetings[4];
  const y = today.getFullYear();

  // Active projects: anything (target/task/milestone) within next 30 days
  const activeProjects = state.projects
    .filter(p=>{
      if (p.archived || !passesFilter(p)) return false;
      if (p.targetDate && p.targetDate >= todayK && p.targetDate <= horizon30) return true;
      if ((p.tasks||[]).some(t => !t.done && t.due && t.due >= todayK && t.due <= horizon30)) return true;
      if ((p.milestones||[]).some(m => !m.done && m.date && m.date >= todayK && m.date <= horizon30)) return true;
      return false;
    })
    .map(p => ({ p, nd: projectNextDate(p) }))
    .filter(x => x.nd && x.nd.date >= todayK && x.nd.date <= horizon30)
    .sort((a,b) => a.nd.date.localeCompare(b.nd.date));

  // Urgent To Do's — dates ascending, then manual order for ties
  const urgent = state.tasks.filter(t=>t.priority==='urgent' && !t.done && passesFilter(t))
    .sort((a,b)=>{
      const aDue = a.due || '';
      const bDue = b.due || '';
      if (aDue && bDue && aDue !== bDue) return aDue.localeCompare(bDue);
      if (aDue && !bDue) return -1;
      if (!aDue && bDue) return 1;
      return (a.order||0) - (b.order||0);
    });

  // Today's tasks (both project subtasks and free-floating, deduped via tasksOnDay)
  const todayTasks = tasksOnDay(todayK).filter(t=>!t.done);

  viewEl.innerHTML = `
    <div class="home-greeting">${greeting}</div>
    <div class="home-date">${I18N.weekdaysLong[monIdx(today)]} ${today.getDate()}. ${I18N.months[today.getMonth()]} ${y}${HOLIDAYS[todayK] ? ' · ' + HOLIDAYS[todayK] : ''}
      <button data-action="openWeekReview" style="margin-left:10px;padding:2px 9px;font-size:11.5px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--ink-soft);cursor:pointer">Ukesoppsummering</button>
    </div>
    ${_homeQuickCaptureHTML()}
    ${_homeUrgentHTML(urgent, todayK)}
    ${_homeTodayTasksHTML(todayTasks, todayK)}
    ${_homeNoDateHTML(tasksWithoutDate())}
    ${_homeActiveProjectsHTML(activeProjects)}
    ${_homeWeekHTML(today)}
  `;

  const qi = document.getElementById('home-quick-input');
  if (qi) qi.addEventListener('keydown', e=>{
    if (e.key === 'Enter' && qi.value.trim()){
      state.inbox.push({id:uid(), text:qi.value.trim(), createdAt:new Date().toISOString()});
      qi.value = '';
      showToast('✓ Lagt til i innboks');
      render();
    }
  });

  _wireUrgentDragReorder();
}

// Sort comparators reused across reorder operations (date wins, manual order is tiebreaker)
function _dateThenOrderCmp(a, b){
  const ad = a.due || '9999'; const bd = b.due || '9999';
  if (ad && bd && ad !== bd) return ad.localeCompare(bd);
  if (a.due && !b.due) return -1;
  if (!a.due && b.due) return 1;
  return (a.order||0) - (b.order||0);
}

// ----- Shared reorder primitives -----
// Splice draggedId out of a sorted list and re-insert it at targetId's position.
// Returns the modified list, or null on missing dragged / missing target.
function _spliceByTargetId(sortedList, draggedId, targetId, insertBefore){
  const dragged = sortedList.find(x => x.id === draggedId);
  if (!dragged) return null;
  const without = sortedList.filter(x => x.id !== draggedId);
  let idx = without.findIndex(x => x.id === targetId);
  if (idx === -1) return null;
  if (!insertBefore) idx++;
  without.splice(idx, 0, dragged);
  return without;
}

// Persist manual ordering by writing list position into each item's `order` field.
// Date sort still wins in subsequent renders; `order` is the tiebreaker.
function _renumberOrder(list){ list.forEach((item, i) => { item.order = i; }); }

// Reorder free tasks within a priority bucket. Date trumps, order is tiebreaker.
// Also handles cross-bucket drop (changes priority) and inbox-item drop (converts to free task).
function reorderFreeTasksByPriority(priority, draggedId, targetId, insertBefore){
  let dragged = state.tasks.find(t=>t.id===draggedId);
  if (!dragged){
    // Maybe an inbox item being dragged onto a bucket row — convert
    const inboxItem = (state.inbox||[]).find(i=>i.id===draggedId);
    if (inboxItem){
      dragged = { id: uid(), title: inboxItem.text, category: 'arbeid', priority, done: false, due: '' };
      state.tasks.push(dragged);
      state.inbox = state.inbox.filter(i=>i.id !== draggedId);
    } else {
      return;
    }
  } else if (dragged.priority !== priority){
    dragged.priority = priority;
  }
  const sorted = state.tasks.filter(t=>t.priority===priority && !t.done && passesFilter(t)).sort(_dateThenOrderCmp);
  let result = _spliceByTargetId(sorted, dragged.id, targetId, insertBefore);
  if (!result){
    // Target not found in this bucket — fall back to appending dragged at end
    result = sorted.filter(t => t.id !== dragged.id);
    result.push(dragged);
  }
  _renumberOrder(result);
  render();
}

// Reorder inbox items
function reorderInbox(draggedId, targetId, insertBefore){
  const result = _spliceByTargetId(state.inbox || [], draggedId, targetId, insertBefore);
  if (!result) return;
  state.inbox = result;
  render();
}

// Reorder project tasks
function reorderProjectTasksList(projectId, draggedId, targetId, insertBefore){
  const p = state.projects.find(x=>x.id===projectId);
  if (!p) return;
  const sorted = (p.tasks||[]).slice().sort((a,b)=>{
    if (a.done !== b.done) return a.done ? 1 : -1;
    return _dateThenOrderCmp(a, b);
  });
  const result = _spliceByTargetId(sorted, draggedId, targetId, insertBefore);
  if (!result) return;
  _renumberOrder(result);
  render();
}

// Reorder project milestones (sort key is `date`, not `due`)
function reorderProjectMilestones(projectId, draggedId, targetId, insertBefore){
  const p = state.projects.find(x=>x.id===projectId);
  if (!p) return;
  const sorted = (p.milestones||[]).slice().sort((a,b)=>{
    const ad = a.date || '9999'; const bd = b.date || '9999';
    if (ad !== bd) return ad.localeCompare(bd);
    return (a.order||0) - (b.order||0);
  });
  const result = _spliceByTargetId(sorted, draggedId, targetId, insertBefore);
  if (!result) return;
  _renumberOrder(result);
  render();
}

// Reorder urgent tasks — same as priority bucket but adds a toast if the
// post-reorder result will still be re-sorted by date in the next render.
function reorderUrgent(draggedId, targetId, insertBefore){
  const urgentSorted = state.tasks.filter(t=>t.priority==='urgent' && !t.done && passesFilter(t)).sort(_dateThenOrderCmp);
  const result = _spliceByTargetId(urgentSorted, draggedId, targetId, insertBefore);
  if (!result) return;
  _renumberOrder(result);
  // If date sort would still move dragged elsewhere, gently inform.
  const newSorted = result.slice().sort(_dateThenOrderCmp);
  if (newSorted.findIndex(t=>t.id===draggedId) !== result.findIndex(t=>t.id===draggedId)){
    showToast('💡 Tasks med tidligere datofrist sorteres alltid først');
  }
  render();
}

// ============================================================
// VIEW: PROJECTS (list + detail page)
// ============================================================
function renderProjects(){
  if (state.ui.openProjectId){
    renderProjectPage(state.ui.openProjectId);
    return;
  }
  const today = new Date();
  const active = projectsActive().slice().sort((a,b)=>{
    const an = projectNextDate(a);
    const bn = projectNextDate(b);
    const ad = an ? an.date : '9999-99-99';
    const bd = bn ? bn.date : '9999-99-99';
    return ad.localeCompare(bd);
  });
  const archived = projectsArchived();

  viewEl.innerHTML = `
    <div class="subnav">
      <h2>Prosjekter <span class="yr">${active.length} aktive</span></h2>
      <button class="today-btn" data-action="openProjectForm">+ Nytt prosjekt</button>
    </div>
    <div class="projects-grid" id="pgrid"></div>
    ${archived.length?`<div style="margin-top:24px"><h3 style="font-family:var(--serif);font-weight:500;font-size:16px;color:var(--ink-muted);margin:0 0 10px">Arkiverte</h3><div class="projects-grid" id="pgrid-arch"></div></div>`:''}
  `;

  const pg = document.getElementById('pgrid');
  pg.innerHTML = active.map(projectCardHTML).join('') + `<div class="new-project-card" data-action="openProjectForm">+ Nytt prosjekt</div>`;
  pg.querySelectorAll('.pcard').forEach(el=>el.onclick=()=>HANDLERS.openProject(el.dataset.id));

  if (archived.length){
    const pa = document.getElementById('pgrid-arch');
    pa.innerHTML = archived.map(projectCardHTML).join('');
    pa.querySelectorAll('.pcard').forEach(el=>el.onclick=()=>HANDLERS.openProject(el.dataset.id));
  }
}

function projectCardHTML(p){
  const days = daysUntil(p.targetDate);
  const cd = days===null ? '<span class="countdown empty" style="color:var(--ink-muted);font-style:italic;font-size:13px">ingen måldato</span>'
    : days<0 ? `<div class="countdown past">${Math.abs(days)} dager <small>siden</small></div>`
    : days===0 ? `<div class="countdown urgent">i dag <small>er dagen</small></div>`
    : `<div class="countdown ${days<14?'urgent':''}">${days} <small>dager til måldato</small></div>`;
  const prog = projectProgress(p);
  const merged = projectTasksMerged(p);
  const taskCount = merged.length;
  const doneCount = merged.filter(t=>t.done).length;
  const peopleCount = (p.people||[]).length;

  // To Do-lista på kortet: bare det som gjenstår, tidligste frist først, maks 3 — resten
  // bak «+N mer». Samme sortering som prosjektsiden (`_dateThenOrderCmp`), så rekkefølgen
  // er den samme begge steder: dato først, uten dato sist, deretter manuell rekkefølge.
  // Rader har ingen egen handling, så et klikk hvor som helst på kortet åpner prosjektet.
  // Ikke på arkiverte kort. Verifisert på ekte data: «Annual General Meeting 2026» viste
  // tre røde forfalte frister fra juni og «Sommerfest Bluefront» én fra mai — altså rødt
  // varsel på noe hun bevisst har lagt bort. Tellerne står der fortsatt, så informasjonen
  // om at noe gjenstår er ikke borte. ADR 0033.
  const CARD_TODO_LIMIT = 3;
  const openTodos = p.archived ? [] : merged.filter(t=>!t.done).sort(_dateThenOrderCmp);
  const shownTodos = openTodos.slice(0, CARD_TODO_LIMIT);
  const restCount = openTodos.length - shownTodos.length;
  const todayK = todayKey();
  const todosHTML = shownTodos.length ? `<div class="ptodos">
      ${shownTodos.map(t=>{
        const overdue = t.due && t.due < todayK;
        // Kompakt relativ etikett (ADR 0040) — kolonnen er 68 px, og «5 d siden» er
        // det lengste relDateShort kan produsere.
        const dateLabel = t.due ? relDateShort(t.due, todayK) : '–';
        const dateTitle = t.due ? escapeAttr(absDateTitle(t.due)) : 'Ingen frist';
        return `<div class="ptodo"><span class="ptodo-date${overdue?' overdue':''}" title="${dateTitle}">${escapeHTML(dateLabel)}</span><span class="ptodo-title">${escapeHTML(t.title)}</span></div>`;
      }).join('')}
      ${restCount>0?`<div class="ptodo ptodo-more"><span class="ptodo-date"></span><span class="ptodo-title">+${restCount} mer</span></div>`:''}
    </div>` : '';

  const next = projectNextDate(p);
  // Show "Neste:" only if it's not the same as targetDate (avoid duplication) — og ikke
  // når To Do-lista alt viser den samme oppgaven. Delmål (◆) beholdes, for de står ikke
  // i lista.
  const nextIsMilestone = !!(next && next.label && next.label.startsWith('◆'));
  const showNext = next && next.date !== p.targetDate && (!todosHTML || nextIsMilestone);
  const nextHTML = showNext
    ? `<div style="font-size:11.5px;color:var(--ink-soft);border-top:1px solid var(--line-soft);padding-top:6px;margin-top:2px"><strong style="color:var(--ink)">${fmtDateShort(fromKey(next.date))}</strong> · ${escapeHTML(next.label)}</div>`
    : '';
  return `<div class="pcard cat-${p.category} ${p.archived?'archived':''}" data-id="${p.id}" style="--pc-h:${projectHue(p.title)}">
    <h3>${escapeHTML(p.title)}</h3>
    <div class="pmeta">
      <span class="pill cat-${p.category}">${CAT_BY_ID[p.category]?.label||'–'}</span>
      ${p.targetDate?`<span>${fmtDateShort(fromKey(p.targetDate))}${p.targetEndDate&&p.targetEndDate>p.targetDate?'–'+fmtDateShort(fromKey(p.targetEndDate)):''} ${fromKey(p.targetEndDate||p.targetDate).getFullYear()}</span>`:''}
    </div>
    ${cd}
    ${(taskCount||p.milestones?.length)?`<div class="pprog"><i style="width:${prog}%"></i></div>`:''}
    <div class="pstats">
      ${taskCount?`<span><strong>${doneCount}/${taskCount}</strong> oppgaver</span>`:''}
      ${(p.milestones||[]).length?`<span><strong>${(p.milestones||[]).filter(m=>m.done).length}/${(p.milestones||[]).length}</strong> delmål</span>`:''}
    </div>
    ${todosHTML}
    ${nextHTML}
  </div>`;
}

// renderProjectPage orchestrator — reads as an outline.
// Section helpers live below; each renders one self-contained part of the project detail page.
function renderProjectPage(id){
  const p = state.projects.find(x=>x.id===id);
  if (!p){ state.ui.openProjectId=null; renderProjects(); return; }
  const days = daysUntil(p.targetDate);

  viewEl.innerHTML = `
    <button class="pback" data-action="backToProjects">← Tilbake til prosjekter</button>
    <div class="pdetail">
      ${_projectHeaderHTML(p, days)}
      <div class="pbody">
        ${_projectTasksSectionHTML(p)}
        ${_projectMilestonesSectionHTML(p)}
        ${_projectNotesSectionHTML(p)}
        ${_projectLinksSectionHTML(p)}
        ${_projectPeopleSectionHTML(p)}
        ${_projectBacklinksSectionHTML(p)}
        ${_projectActionsSectionHTML(p)}
      </div>
    </div>`;

  _wireProjectPageReorder(p);
}

// ----- Section helpers for renderProjectPage -----

function _projectCountdownHTML(days){
  if (days === null) return '<div class="pcount" style="color:var(--ink-muted);font-style:italic;font-size:18px">ingen dato</div>';
  if (days < 0)      return `<div class="pcount" style="color:var(--ink-muted);font-style:italic">${Math.abs(days)}<small>dager siden</small></div>`;
  if (days === 0)    return `<div class="pcount urgent">i dag<small>er dagen</small></div>`;
  return `<div class="pcount ${days<14?'urgent':''}">${days}<small>dager igjen</small></div>`;
}

function _projectHeaderHTML(p, days){
  return `
    <div class="phead">
      <div class="ptitle">
        <h2>${escapeHTML(p.title)}</h2>
        <div class="pmeta" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <span class="pill cat-${p.category}">${CAT_BY_ID[p.category]?.label||'–'}</span>
          ${p.targetDate?`<span style="font-size:13px;color:var(--ink-soft)">${fmtDate(fromKey(p.targetDate))}${p.targetEndDate&&p.targetEndDate>p.targetDate?' – '+fmtDate(fromKey(p.targetEndDate)):''}</span>`:''}
          ${p.startDate?`<span style="font-size:12px;color:var(--ink-muted)">forberedelse fra ${fmtDateShort(fromKey(p.startDate))}</span>`:''}
        </div>
        ${p.description?`<div class="pdesc">${escapeHTML(p.description)}</div>`:''}
      </div>
      ${_projectCountdownHTML(days)}
    </div>`;
}

function _projectTasksSectionHTML(p){
  const mode = state.ui.projectViewMode;
  const body = mode === 'kanban' ? renderProjectKanban(p) : renderProjectTasks(p);
  return `
    <div class="psection">
      <h4>Oppgaver
        <span style="display:flex;align-items:center;gap:8px">
          <span class="pview-toggle">
            <button data-action="setProjectViewMode" data-args='["list"]' class="${mode==='list'?'active':''}" title="Liste">≡ Liste</button>
            <button data-action="setProjectViewMode" data-args='["kanban"]' class="${mode==='kanban'?'active':''}" title="Kanban">⊟ Kanban</button>
          </span>
          <button data-action="openProjectTaskForm" data-args='["${p.id}"]'>+ Ny</button>
        </span>
      </h4>
      <div id="ptasks">${body}</div>
    </div>`;
}

function _projectMilestonesSectionHTML(p){
  if ((p.milestones||[]).length > 0){
    return `
      <div class="psection">
        <h4>Delmål</h4>
        <div id="pmilestones">${renderProjectMilestones(p)}</div>
        <div class="pinline-add">
          <input id="pms-title" type="text" placeholder="Nytt delmål…">
          <input id="pms-date" class="small" type="date">
          <button data-action="addProjectMilestone" data-args='["${p.id}"]'>+ Legg til</button>
        </div>
      </div>`;
  }
  return `
    <div class="psection" style="padding:10px 0;border-top:1px solid var(--line-soft)">
      <button class="add-link" data-action="quickAddMilestone" data-args='["${p.id}"]' style="font-size:12.5px;color:var(--ink-soft);padding:4px 0">+ Legg til delmål (valgfritt)</button>
    </div>`;
}

function _projectNotesSectionHTML(p){
  const noteCards = (p.noteList||[]).map(n=>{
    const preview = (n.content||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ')
      .replace(/\[\[([^\[\]]+)\]\]/g,'$1').replace(/\s+/g,' ').trim();
    const previewSnippet = preview ? escapeHTML(preview.slice(0,120)) + (preview.length>120?'…':'') : 'Tomt notat — klikk for å skrive';
    return `<div class="note-card" data-action="openNoteEditor" data-args='["${p.id}","${n.id}"]'>
      <div class="note-card-title">${escapeHTML(n.title||'Uten tittel')}</div>
      <div class="${preview?'note-card-preview':'note-card-empty'}">${previewSnippet}</div>
    </div>`;
  }).join('');
  return `
    <div class="psection">
      <h4>Notater & utkast <span style="font-weight:400;font-size:11px;color:var(--ink-muted);font-family:var(--font);font-style:italic;letter-spacing:0;text-transform:none">— lag flere notater for ulike temaer</span></h4>
      <div class="notes-grid">
        ${noteCards}
        <div class="new-note-card" data-action="addProjectNote" data-args='["${p.id}"]'>+ Nytt notat</div>
      </div>
    </div>`;
}

function _projectLinksSectionHTML(p){
  return `
    <div class="psection">
      <h4>Lenker & referanser</h4>
      <div id="plinks">${renderProjectLinks(p)}</div>
      <div class="pinline-add">
        <input id="pl-title" class="small" type="text" placeholder="Tittel">
        <input id="pl-url" type="url" placeholder="https://…">
        <button data-action="addProjectLink" data-args='["${p.id}"]'>+ Legg til</button>
      </div>
    </div>`;
}

function _projectPeopleSectionHTML(p){
  return `
    <div class="psection">
      <h4>Personer</h4>
      <div id="ppeople">${renderProjectPeople(p)}</div>
      <div class="pinline-add">
        <input id="pp-name" type="text" placeholder="Navn">
        <input id="pp-role" class="small" type="text" placeholder="Rolle (valgfritt)">
        <button data-action="addProjectPerson" data-args='["${p.id}"]'>+ Legg til</button>
      </div>
    </div>`;
}

function _projectBacklinksSectionHTML(p){
  const bl = findBacklinks(p.title);
  if (!bl.length) return '';
  const items = bl.map(b=>{
    const onClick = b.type==='project'
      ? act('openProject', b.id)
      : act('goToDate', b.date || '');
    const snippet = (b.snippet||'').slice(0,120);
    const ellipsis = (b.snippet||'').length>120 ? '…' : '';
    return `<div class="bl" ${onClick}>
      <strong>${escapeHTML(b.title)}</strong>
      <div class="snippet">${escapeHTML(snippet)}${ellipsis}</div>
    </div>`;
  }).join('');
  return `
    <div class="psection">
      <h4>Referert i</h4>
      <div class="backlinks">${items}</div>
    </div>`;
}

function _projectActionsSectionHTML(p){
  return `
    <div class="psection" style="display:flex;gap:8px;justify-content:space-between;align-items:center">
      <div style="display:flex;gap:8px">
        <button data-action="openProjectForm" data-args='["${p.id}"]' class="btn-action">Rediger detaljer</button>
        <button data-action="archiveProject" data-args='["${p.id}"]' class="btn-action">${p.archived?'Gjenåpne':'Arkivér'}</button>
      </div>
      <button data-action="deleteProject" data-args='["${p.id}"]' style="padding:7px 12px;border-radius:6px;border:1px solid transparent;font-size:13px;color:var(--alert)">Slett prosjekt</button>
    </div>`;
}

// Wire up drag-to-reorder for tasks and milestones (date trumps, order is tiebreaker)
function _wireProjectPageReorder(p){
  const tasksContainer = document.getElementById('ptasks');
  if (tasksContainer){
    setupListReorder(tasksContainer, '.ptask[data-task-id]', (draggedId, targetId, before)=>{
      reorderProjectTasksList(p.id, draggedId, targetId, before);
    });
  }
  const msContainer = document.getElementById('pmilestones');
  if (msContainer){
    setupListReorder(msContainer, '.ptask[data-task-id]', (draggedId, targetId, before)=>{
      reorderProjectMilestones(p.id, draggedId, targetId, before);
    });
  }
}

// Multi-note system per project
HANDLERS.addProjectNote = (pid)=>{
  const p = state.projects.find(x=>x.id===pid);
  if (!p) return;
  if (!p.noteList) p.noteList = [];
  const n = { id: 'note-'+uid(), title: 'Nytt notat', content: '' };
  p.noteList.push(n);
  saveState();
  // Render the page behind the modal too. Without this the new note card doesn't
  // appear when the editor closes, so it looks like nothing happened and you end up
  // creating several empty notes that all show up later at once.
  render();
  HANDLERS.openNoteEditor(pid, n.id);
};

// ----- Wikilink-autocomplete (ADR 0026) -----
// Wires a floating project-title picker to the note editor. Detects an unclosed `[[`
// immediately before the caret, filters project titles, and inserts `[[Tittel]]`.
// Internal to openNoteEditor — the dropdown lives inside the modal, so closeModal
// disposes it along with the editor and its listeners.
function _wireWikilinkAutocomplete(editor, afterInsert){
  if (!editor || !editor.parentNode) return;
  const box = document.createElement('div');
  box.className = 'wl-ac';
  box.setAttribute('role', 'listbox');
  box.style.display = 'none';
  editor.parentNode.appendChild(box);

  let matches = [];
  let active = 0;
  let ctx = null;

  const isOpen = ()=> box.style.display !== 'none';
  const hide = ()=>{ box.style.display = 'none'; matches = []; ctx = null; };

  // Locate an unclosed `[[` in the text node holding the caret. Returns null unless
  // the caret sits directly after `[[` + a query with no brackets in it.
  const readContext = ()=>{
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return null;
    const node = sel.anchorNode;
    if (!node || node.nodeType !== 3 || !editor.contains(node)) return null;
    const before = node.textContent.slice(0, sel.anchorOffset);
    const open = before.lastIndexOf('[[');
    if (open === -1) return null;
    const query = before.slice(open + 2);
    if (query.length > 60 || /[\[\]]/.test(query)) return null;
    return { node: node, start: open, end: sel.anchorOffset, query: query };
  };

  // Titles that could complete the query. Archived projects are excluded — you don't
  // link to something you've put away. Prefix matches sort above substring matches.
  const candidates = (query)=>{
    const q = String(query || '').trim().toLowerCase();
    return (state.projects || [])
      .filter(p => p && p.title && !p.archived)
      .filter(p => !q || p.title.toLowerCase().indexOf(q) > -1)
      .sort((a, b)=>{
        const as = a.title.toLowerCase().indexOf(q) === 0 ? 0 : 1;
        const bs = b.title.toLowerCase().indexOf(q) === 0 ? 0 : 1;
        return as !== bs ? as - bs : a.title.localeCompare(b.title, 'nb');
      })
      .slice(0, 8);
  };

  const paint = ()=>{
    box.innerHTML = matches.length
      ? matches.map((p, i)=>
          `<div class="wl-ac-item" role="option" data-i="${i}" aria-selected="${i === active}">`
          + `<span class="wl-ac-cat">${p.category === 'privat' ? 'Privat' : 'Jobb'}</span>`
          + escapeHTML(p.title) + '</div>').join('')
      : '<div class="wl-ac-empty">Ingen prosjekt matcher</div>';
    box.style.display = 'block';
    // Anchor to the caret, then keep the box inside the viewport.
    const sel = window.getSelection();
    let top = 0, left = 0;
    if (sel && sel.rangeCount){
      const range = sel.getRangeAt(0);
      // A collapsed range has no client rects in some engines (and none at all in jsdom),
      // so fall back through every option before giving up on positioning.
      const rects = range.getClientRects ? range.getClientRects() : null;
      const rect = (rects && rects[0])
        || (range.getBoundingClientRect ? range.getBoundingClientRect() : null);
      if (rect){ top = rect.bottom + 6; left = rect.left; }
    }
    const w = box.offsetWidth || 240;
    const h = box.offsetHeight || 120;
    box.style.left = Math.max(8, Math.min(left, window.innerWidth - w - 8)) + 'px';
    box.style.top = (top + h > window.innerHeight - 8 ? Math.max(8, top - h - 22) : top) + 'px';
  };

  const refresh = ()=>{
    if (editor.contentEditable !== 'true'){ hide(); return; }
    ctx = readContext();
    if (!ctx){ hide(); return; }
    matches = candidates(ctx.query);
    active = 0;
    paint();
  };

  const markActive = ()=>{
    const items = box.querySelectorAll('.wl-ac-item');
    for (let i = 0; i < items.length; i++) items[i].setAttribute('aria-selected', i === active);
    if (items[active] && items[active].scrollIntoView) items[active].scrollIntoView({ block: 'nearest' });
  };

  // Replace `[[query` with `[[Tittel]]` and drop the caret after it. Done with a Range
  // rather than execCommand so the result is deterministic and undo-safe enough.
  const insert = (p)=>{
    if (!ctx || !p) return;
    const range = document.createRange();
    range.setStart(ctx.node, ctx.start);
    range.setEnd(ctx.node, Math.min(ctx.end, ctx.node.textContent.length));
    range.deleteContents();
    const text = document.createTextNode('[[' + p.title + ']]');
    range.insertNode(text);
    const after = document.createRange();
    after.setStartAfter(text);
    after.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(after);
    hide();
    editor.focus();
    if (typeof afterInsert === 'function') afterInsert();
  };

  editor.addEventListener('input', refresh);
  editor.addEventListener('keyup', e=>{
    if (['ArrowLeft','ArrowRight','Home','End'].indexOf(e.key) > -1) refresh();
  });
  editor.addEventListener('keydown', e=>{
    if (!isOpen()) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){
      if (!matches.length) return;
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length;
      markActive();
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab'){
      if (!matches.length) return;   // let Enter make a new line when nothing matches
      e.preventDefault();
      insert(matches[active]);
      return;
    }
    if (e.key === 'Escape'){
      e.preventDefault();
      e.stopPropagation();           // the document-level Escape listener would close the modal
      hide();
    }
  });
  // Blur fires before click on the list, so defer the hide long enough for mousedown.
  editor.addEventListener('blur', ()=> setTimeout(hide, 150));
  box.addEventListener('mousedown', e=>{
    const item = e.target.closest && e.target.closest('.wl-ac-item');
    if (!item) return;
    e.preventDefault();              // keep focus and the caret inside the editor
    insert(matches[Number(item.dataset.i)]);
  });
}

HANDLERS.openNoteEditor = (pid, nid)=>{
  const p = state.projects.find(x=>x.id===pid);
  const n = p?.noteList?.find(x=>x.id===nid);
  if (!p || !n) return;
  // Open in 'view' mode by default — clicking inside switches to 'edit'
  const startMode = (n.content||'').trim() ? 'view' : 'edit';
  openModal(`
    <div data-note-mode="${startMode}" id="note-modal-inner">
    <h3 style="padding:14px 18px 8px;display:flex;align-items:center;gap:10px">
      <input id="note-title-input" class="note-title-input" type="text" value="${escapeAttr(n.title||'')}" placeholder="Tittel på notat" style="flex:1">
      <button id="note-toggle-edit" class="toggle-edit-btn" type="button">✎ Rediger</button>
    </h3>
    <div class="body" style="gap:8px">
      <div class="note-edit-hint">💡 Klikk inni notatet for å redigere</div>
      <div class="note-toolbar">
        <button type="button" class="tb-bold" data-action="execCmd" data-args='["bold"]' title="Fet (Ctrl+B)">F</button>
        <button type="button" class="tb-italic" data-action="execCmd" data-args='["italic"]' title="Kursiv (Ctrl+I)">K</button>
        <button type="button" data-action="execCmd" data-args='["underline"]' title="Understreket"><u>U</u></button>
        <span class="tb-sep"></span>
        <button type="button" data-action="execCmd" data-args='["formatBlock","<h2>"]' title="Stor overskrift">H1</button>
        <button type="button" data-action="execCmd" data-args='["formatBlock","<h3>"]' title="Mindre overskrift">H2</button>
        <button type="button" data-action="execCmd" data-args='["formatBlock","<p>"]' title="Vanlig tekst">¶</button>
        <span class="tb-sep"></span>
        <button type="button" data-action="execCmd" data-args='["insertUnorderedList"]' title="Punktliste">•</button>
        <button type="button" data-action="execCmd" data-args='["insertOrderedList"]' title="Nummerert liste">1.</button>
        <span class="tb-sep"></span>
        <select onchange="HANDLERS.noteTextColor(this)" title="Tekstfarge">
          <option value="">Farge</option>
          <option value="#2c3340">Standard</option>
          <option value="#c8503e">Rød</option>
          <option value="#c9a87a">Sand</option>
          <option value="#5d8a5d">Grønn</option>
          <option value="#6b7d99">Blå</option>
          <option value="#8a93a3">Grå</option>
        </select>
        <select onchange="HANDLERS.noteHighlight(this)" title="Markering">
          <option value="">Marker</option>
          <option value="#fdf6e3">Gul</option>
          <option value="#fae8e3">Rosa</option>
          <option value="#e8f3e8">Grønn</option>
          <option value="#e8eef7">Blå</option>
          <option value="transparent">Ingen</option>
        </select>
        <span class="tb-sep"></span>
        <button type="button" data-action="insertLink" title="Lenke">🔗</button>
        <button type="button" data-action="execCmd" data-args='["removeFormat"]' title="Fjern formatering">⌫</button>
      </div>
      <div id="note-editor" class="note-editor" contenteditable="true" data-placeholder="Begynn å skrive…">${sanitizeNoteHTML(n.content||'')}</div>
    </div>
    <div class="footer">
      <button class="btn btn-danger" data-action="deleteProjectNote" data-args='["${pid}","${nid}"]'>Slett notat</button>
      <button class="btn btn-ghost" data-action="closeModal">Lukk</button>
    </div>
    </div>`);
  const modalInner = document.getElementById('note-modal-inner');
  const editor = document.getElementById('note-editor');
  const titleInput = document.getElementById('note-title-input');
  const toggleBtn = document.getElementById('note-toggle-edit');
  // Re-find the note on every access — sync may have replaced the state object
  const noteRef = ()=>{
    const p2 = state.projects.find(x=>x.id===pid);
    return (p2 && p2.noteList) ? p2.noteList.find(x=>x.id===nid) : null;
  };
  // Persist immediately. Content is only read back while in edit mode, and always
  // stripped of rendered wikilink markup — lagret innhold beholder rå [[...]] (ADR 0019).
  const saveNow = ()=>{
    const n2 = noteRef();
    if (!n2) return;
    n2.title = (titleInput.value.trim()) || 'Uten tittel';
    if (modalInner.dataset.noteMode === 'edit'){
      n2.content = unrenderWikilinks(editor.innerHTML);
    }
    saveState();
  };
  // Mode toggle helper. Wikilinks are rendered in view mode only; edit mode always
  // shows the raw [[...]] source so the user can change it.
  const setMode = (mode)=>{
    if (modalInner.dataset.noteMode === 'edit' && mode === 'view') saveNow();
    modalInner.dataset.noteMode = mode;
    editor.contentEditable = (mode === 'edit') ? 'true' : 'false';
    titleInput.readOnly = (mode !== 'edit');
    toggleBtn.textContent = (mode === 'edit') ? '✓ Ferdig' : '✎ Rediger';
    const n2 = noteRef();
    const raw = sanitizeNoteHTML((n2 && n2.content) || '');
    editor.innerHTML = (mode === 'view') ? renderWikilinks(raw) : raw;
    if (mode === 'edit'){
      setTimeout(()=>editor.focus(), 30);
    }
  };
  setMode(startMode);
  // Click on editor when in view mode → switch to edit
  editor.addEventListener('click', (ev)=>{
    // A click on a wikilink must not also flip the note into edit mode. This listener
    // fires during bubbling BEFORE the document-level dispatcher, so data-stop="1"
    // comes too late — check the target here instead. See ADR 0021.
    if (ev.target && ev.target.closest && ev.target.closest('a.wikilink')) return;
    if (modalInner.dataset.noteMode === 'view') setMode('edit');
  });
  // Click on title when in view mode → switch to edit and focus title
  titleInput.addEventListener('click', ()=>{
    if (modalInner.dataset.noteMode === 'view'){
      setMode('edit');
      setTimeout(()=>titleInput.focus(), 30);
    }
  });
  // Toggle button
  toggleBtn.addEventListener('click', ()=>{
    setMode(modalInner.dataset.noteMode === 'edit' ? 'view' : 'edit');
  });
  // Auto-save on every change — content preserved even if modal closes for any reason
  let _saveTimer = null;
  // Throttle rather than debounce — see the day-notes comment in renderDay(). A
  // restarting debounce means continuous typing never reaches state.
  const autoSave = ()=>{
    if (_saveTimer) return;
    _saveTimer = setTimeout(()=>{ _saveTimer = null; saveNow(); }, 400);
  };
  if (editor){
    editor.addEventListener('input', autoSave);
    // Immediate save on blur (no debounce)
    editor.addEventListener('blur', saveNow);
    editor.addEventListener('paste', e=>{
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (const item of items){
        if (item.type && item.type.startsWith('image/')){
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) return;
          const r = new FileReader();
          r.onload = ()=>{
            // Skalér ned FØR bildet havner i state. Rå-blobben fra utklippstavlen ble
            // lagret som base64 uten noen grense: én skjermdump målte state fra 569 kB
            // til 2617 kB, og to–tre av dem sprenger localStorage-kvoten på ~5 MB. Dette
            // er den ene handlingen som kan ta hele lagringsplassen på ett klikk. ADR 0031.
            _downscaleDataURL(r.result, 1400, 0.85).then(small=>{
              document.execCommand('insertImage', false, small);
              autoSave();
              const kb = Math.round(small.length/1024);
              if (typeof showToast === 'function'){
                if (kb > 400) showToast(`⚠ Bildet er ${kb} kB selv etter nedskalering. Lagringsplassen er på ~5000 kB til alt — legg helst store bilder i OneDrive og lenk til dem.`, 12000);
                else showToast(`🖼 Bilde lagt inn (${kb} kB)`, 3000);
              }
            });
          };
          r.readAsDataURL(blob);
          return;
        }
      }
    });
  }
  if (titleInput){
    titleInput.addEventListener('input', autoSave);
    titleInput.addEventListener('blur', saveNow);
  }
  // «[[» i edit-modus foreslår prosjekttitler — ADR 0026
  _wireWikilinkAutocomplete(editor, autoSave);
  // Re-render the page behind when the editor closes, so the note card reflects a
  // changed title or preview without waiting for some other action to trigger render().
  _onModalClose = ()=>{ saveNow(); render(); };
};

HANDLERS.deleteProjectNote = (pid, nid)=>{
  const p = state.projects.find(x=>x.id===pid);
  if (!p) return;
  const n = (p.noteList||[]).find(x=>x.id===nid);
  const title = n && n.title ? `notatet «${n.title}»` : 'notatet';
  if (!deleteWithUndo(()=>_projectArr(pid, 'noteList'), nid, title)) return;
  saveState();
  closeModal();
  render();
};

// ============================================================
// «FERDIG» ÉN DØR: done, doneAt og status holdes i takt (ADR 0037)
// ============================================================
// Fire steder satte `t.done` direkte, og ingen av dem rørte `status` — så en oppgave med
// `status:'doing'` som ble krysset av i lista lå fortsatt i «I gang» på kanban-brettet.
// Og ingen sted registrerte NÅR noe ble gjort, så en ukesoppsummering var umulig å regne ut.
// `doneAt` fylles fra nå av; oppgaver som var ferdige før dette har den ikke, og
// oppsummeringen sier det i stedet for å late som lista er tom.
function _setDone(t, done){
  if (!t) return t;
  t.done = !!done;
  if (done){
    t.doneAt = new Date().toISOString();
    t.status = 'done';
  } else {
    delete t.doneAt;
    if (t.status === 'done') t.status = 'todo';
  }
  return t;
}

function taskStatus(t){ return t.status || (t.done ? 'done' : 'todo'); }

function renderProjectKanban(p){
  // Leste før bare `p.tasks`, så taggede frie To Do's manglet på brettet — det siste stedet
  // som ikke brukte `projectTasksMerged`. Dealflow-prosjektet hennes er en pipeline av
  // selskaper som ligger som taggede To Do's, så brettet var tomt for nettopp den bruken
  // det passer best til. `_origin` følger med, slik at klikk og drag treffer riktig lager.
  // ADR 0037.
  const all = projectTasksMerged(p);
  if (!all.length) return `<div class="empty-state">Ingen oppgaver ennå${emptyAction('+ Ny oppgave', act('openProjectTaskForm', p.id))}</div>`;
  const today = todayKey();
  const cols = { todo:[], doing:[], done:[] };
  all.forEach(t=>cols[taskStatus(t)].push(t));
  const colHTML = (label, key, items)=>{
    const cards = items.length === 0
      ? '<div style="padding:10px 4px;font-size:11.5px;color:var(--ink-muted);font-style:italic;text-align:center">ren boks</div>'
      : items.slice().sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')).map(t=>{
          const overdue = t.due && t.due < today && !t.done ? ' overdue' : '';
          const isFree = t._origin === 'free';
          const open = isFree ? act('openTaskForm', t.id) : act('openProjectTaskForm', p.id, t.id);
          return `<div class="kcard ${t.done?'done':''}" draggable="true" data-id="${t.id}" ondragstart="HANDLERS.kanbanDragStart(event,'${t.id}','${t._origin||'sub'}')" ondragend="HANDLERS.kanbanDragEnd(event)" ${open}>
            <div class="kcard-title">${escapeHTML(t.title)}</div>
            ${t.due ? `<div class="kcard-meta${overdue}" title="${escapeAttr(absDateTitle(t.due))}">${t.endDate&&t.endDate>t.due ? fmtDateShort(fromKey(t.due))+'–'+fmtDateShort(fromKey(t.endDate)) : escapeHTML(relDateShort(t.due))}${t.recurring?' · ↻':''}</div>` : ''}
          </div>`;
        }).join('');
    return `<div class="kcol" data-status="${key}" ondragover="HANDLERS.kanbanOver(event)" ondragleave="HANDLERS.kanbanLeave(event)" ondrop="HANDLERS.kanbanDrop(event,'${p.id}','${key}')">
      <div class="kcol-h">${label} <small>${items.length}</small></div>
      ${cards}
    </div>`;
  };
  return `<div class="kanban">
    ${colHTML('☐ Å gjøre', 'todo', cols.todo)}
    ${colHTML('▸ I gang', 'doing', cols.doing)}
    ${colHTML('✓ Ferdig', 'done', cols.done)}
  </div>`;
}

HANDLERS.kanbanDragStart = (e, id, origin)=>{
  // Opprinnelsen må med: en tagget fri To Do bor i `state.tasks`, en undernoppgave i
  // `p.tasks`. Uten den skrev slippet til feil lager — eller ingenting. ADR 0037.
  e.dataTransfer.setData('text/plain', JSON.stringify({ id, origin: origin || 'sub' }));
  e.dataTransfer.effectAllowed = 'move';
  e.target.style.opacity = '.5';
};
HANDLERS.kanbanDragEnd = (e)=>{ e.target.style.opacity = ''; };
HANDLERS.kanbanOver = (e)=>{
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.style.outline = '2px dashed var(--accent)';
  e.currentTarget.style.outlineOffset = '-2px';
};
HANDLERS.kanbanLeave = (e)=>{ e.currentTarget.style.outline = ''; };
HANDLERS.kanbanDrop = (e, pid, status)=>{
  e.preventDefault();
  e.currentTarget.style.outline = '';
  const raw = e.dataTransfer.getData('text/plain');
  let id = raw, origin = 'sub';
  try { const parsed = JSON.parse(raw); if (parsed && parsed.id){ id = parsed.id; origin = parsed.origin || 'sub'; } }
  catch(_){ /* en ren id er arv fra før ADR 0037 — behandles som undernoppgave */ }
  const t = origin === 'free'
    ? (state.tasks||[]).find(x=>x.id===id)
    : (state.projects.find(x=>x.id===pid)?.tasks||[]).find(x=>x.id===id);
  if (!t) return;
  t.status = status;
  _setDone(t, status === 'done');
  render();
};

HANDLERS.setProjectViewMode = (mode)=>{
  state.ui.projectViewMode = mode;
  render();
};

// Merge two sources: the project's own subtasks (p.tasks) and free tasks tagged to this
// project via the "▸ Prosjekt"-dropdown in To Do's (state.tasks with t.projectId === p.id)
// — ADR 0016/0017. Each origin uses different HANDLERS for toggle/edit/delete, so
// `_origin` must follow along.
// Én kilde, brukt av både prosjektsiden og prosjektkortet, slik at de ikke kan drifte fra
// hverandre: kortet regnet før bare på `p.tasks` mens siden viste begge. ADR 0033.
function projectTasksMerged(p){
  const subtasks = (p.tasks || []).map(t => ({ ...t, _origin: 'sub' }));
  const tagged = (state.tasks || []).filter(t => t.projectId === p.id).map(t => ({ ...t, _origin: 'free' }));
  return [...subtasks, ...tagged];
}

function renderProjectTasks(p){
  const all = projectTasksMerged(p);
  if (!all.length) return `<div class="empty-state">Ingen oppgaver ennå${emptyAction('+ Ny oppgave', act('openProjectTaskForm', p.id))}</div>`;
  return all.sort((a,b)=>{
    if (a.done !== b.done) return a.done?1:-1;
    return _dateThenOrderCmp(a, b);
  }).map(t=>{
    // Relativ etikett når oppgaven har én dato; datointervaller beholder absolutte
    // datoer i begge ender — «om 3 d–14. aug» leses ikke som et intervall. ADR 0040.
    const range = (t.endDate && t.endDate>t.due) ? '–'+fmtDateShort(fromKey(t.endDate)) : '';
    const dueLabel = t.due ? (range ? fmtDateShort(fromKey(t.due)) : relDateShort(t.due)) : '';
    const isFree = t._origin === 'free';
    const toggleH = isFree
      ? `HANDLERS.toggleTask('${t.id}',event)`
      : `HANDLERS.toggleProjectTask('${p.id}','${t.id}',event)`;
    const editAction = isFree
      ? `data-action="openTaskForm" data-args='["${t.id}"]'`
      : `data-action="openProjectTaskForm" data-args='["${p.id}","${t.id}"]'`;
    const deleteAction = isFree
      ? `data-action="deleteFreeTask" data-args='["${t.id}"]'`
      : `data-action="deleteProjectTask" data-args='["${p.id}","${t.id}"]'`;
    // Free tasks: not draggable within project view — their order lives in the
    // priority-bucket flow on the To Do's page. Reordering them here would be
    // confusing (which order-field wins?). User can drag them in To Do's instead.
    const draggable = isFree ? 'false' : 'true';
    const dragTitle = isFree ? 'Fra To Do\'s — endres på To Do\'s-siden' : 'Dra for å sortere';
    return `<div class="ptask ${t.done?'done':''}" data-task-id="${t.id}" draggable="${draggable}">
      <span class="drag-handle" title="${dragTitle}"${isFree?' style="opacity:.35"':''}>⋮⋮</span>
      <input type="checkbox" ${t.done?'checked':''} onchange="${toggleH}">
      <span class="pttitle" ${editAction}>${escapeHTML(t.title)}</span>
      ${t.due?`<span class="ptdate" title="${escapeAttr(absDateTitle(t.due))}">${escapeHTML(dueLabel)}${range}</span>`:''}
      <button class="ptdel" ${deleteAction}>×</button>
    </div>`;
  }).join('');
}
function renderProjectMilestones(p){
  // Uten delmål rendres seksjonen aldri — _projectMilestonesSectionHTML tar en annen
  // gren med sin egen «+ Legg til delmål»-knapp. Denne linjen er et rent forsvar.
  if (!(p.milestones||[]).length) return `<div class="empty-state">Ingen delmål satt</div>`;
  return p.milestones.slice().sort((a,b)=>{
    const ad = a.date || '9999'; const bd = b.date || '9999';
    if (ad !== bd) return ad.localeCompare(bd);
    return (a.order||0) - (b.order||0);
  }).map(m=>`<div class="ptask ${m.done?'done':''}" data-task-id="${m.id}" draggable="true">
    <span class="drag-handle" title="Dra for å sortere">⋮⋮</span>
    <input type="checkbox" ${m.done?'checked':''} onchange="HANDLERS.toggleProjectMilestone('${p.id}','${m.id}')">
    <span class="pttitle" data-action="openProjectMilestoneForm" data-args='["${p.id}","${m.id}"]' style="cursor:pointer">${escapeHTML(m.title)}</span>
    ${m.date?`<span class="ptdate" data-action="openProjectMilestoneForm" data-args='["${p.id}","${m.id}"]' style="cursor:pointer" title="${escapeAttr(absDateTitle(m.date))}">${escapeHTML(relDateShort(m.date))}</span>`:''}
    <button class="ptdel" data-action="deleteProjectMilestone" data-args='["${p.id}","${m.id}"]'>×</button>
  </div>`).join('');
}
function renderProjectPeople(p){
  if (!(p.people||[]).length) return `<div class="empty-state">Ingen personer registrert ennå${emptyAction('+ Legg til person', act('focusField', 'pp-name'))}</div>`;
  return p.people.map(pp=>`<div class="pperson">
    <span class="ppname">${escapeHTML(pp.name)}</span>
    ${pp.role?`<span class="pprole">${escapeHTML(pp.role)}</span>`:''}
    <select onchange="HANDLERS.setPersonStatus('${p.id}','${pp.id}',this.value)" style="font-size:11px;padding:2px 6px;border:1px solid var(--line);border-radius:6px;background:#fff">
      <option value="">– status –</option>
      <option value="pending" ${pp.status==='pending'?'selected':''}>Avventer</option>
      <option value="confirmed" ${pp.status==='confirmed'?'selected':''}>Bekreftet</option>
      <option value="declined" ${pp.status==='declined'?'selected':''}>Avslått</option>
    </select>
    <button class="ptdel" data-action="deleteProjectPerson" data-args='["${p.id}","${pp.id}"]'>×</button>
  </div>`).join('');
}
function renderProjectLinks(p){
  if (!(p.links||[]).length) return `<div class="empty-state">Ingen lenker lagret ennå${emptyAction('+ Legg til lenke', act('focusField', 'pl-title'))}</div>`;
  return p.links.map(l=>`<div class="plink">
    <a href="${escapeAttr(l.url)}" target="_blank" rel="noopener">${escapeHTML(l.title||l.url)}</a>
    <button class="ptdel" data-action="deleteProjectLink" data-args='["${p.id}","${l.id}"]'>×</button>
  </div>`).join('');
}

// Project mutations
HANDLERS.toggleProjectTask = (pid,tid,ev)=>{
  const p = state.projects.find(x=>x.id===pid);
  const t = p?.tasks.find(x=>x.id===tid);
  if (!t) return;
  if (!t.done && t.recurring && t.due){
    const cur = fromKey(t.due);
    let next = null;
    // `addMonthsKeepDay`, ikke `addMonths`: den siste snapper til den 1., så en månedlig
    // oppgave med frist den 25. hoppet til den 1. neste måned første gang du krysset den
    // av — og ble liggende der. Tredje og fjerde forekomst av samme feil, funnet av
    // mønster-sveipet i sjekklista rett før push. Se ADR 0025 og 0032.
    if (t.recurring === 'daily') next = addDays(cur, 1);
    else if (t.recurring === 'weekly') next = addDays(cur, 7);
    else if (t.recurring === 'monthly') next = addMonthsKeepDay(cur, 1);
    else if (t.recurring === 'yearly') next = addMonthsKeepDay(cur, 12);
    if (next){
      t.due = dKey(next);
      try { showToast(`✓ "${t.title}" — flyttet til ${fmtDateShort(next)}`); } catch(_){}
      _animateCompletion(ev, ()=>render());
      return;
    }
  }
  if (!t.done){
    _setDone(t, true);
    _animateCompletion(ev, ()=>render());
  } else {
    _setDone(t, false);
    render();
  }
};
HANDLERS.deleteProjectTask = (pid,tid)=>{
  const p=state.projects.find(x=>x.id===pid); if(!p) return;
  const t=(p.tasks||[]).find(x=>x.id===tid);
  if (!deleteWithUndo(()=>_projectArr(pid,'tasks'), tid, `«${t ? t.title : 'oppgaven'}»`)) return;
  render();
};
HANDLERS.toggleProjectMilestone = (pid,mid)=>{ const p=state.projects.find(x=>x.id===pid); const m=p?.milestones.find(x=>x.id===mid); if(m){m.done=!m.done; render();} };
HANDLERS.deleteProjectMilestone = (pid,mid)=>{
  const p=state.projects.find(x=>x.id===pid); if(!p) return;
  const m=(p.milestones||[]).find(x=>x.id===mid);
  if (!deleteWithUndo(()=>_projectArr(pid,'milestones'), mid, `delmålet «${m ? m.title : ''}»`)) return;
  render();
};

// Edit an existing milestone. Opens a modal with title + date + done checkbox,
// modelled after openProjectTaskForm. Added 2026-05-27 — milestones were missing
// a way to edit title/date after creation (reported by Maria).
function openProjectMilestoneForm(pid, mid){
  const p = state.projects.find(x=>x.id===pid);
  if (!p) return;
  const m = (p.milestones||[]).find(x=>x.id===mid);
  if (!m) return;
  openModal(`
    <h3>Rediger delmål — ${escapeHTML(p.title)}</h3>
    <div class="body">
      <div class="field"><label>Hva er delmålet?</label><input id="pme-title" type="text" value="${escapeAttr(m.title)}" placeholder="F.eks. Save the Date sendt"></div>
      <div class="field"><label>Dato (valgfritt)</label><input id="pme-date" type="date" value="${m.date||''}"></div>
      <div class="field"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input id="pme-done" type="checkbox" ${m.done?'checked':''}> Ferdig</label></div>
    </div>
    <div class="footer">
      <button class="danger" data-action="deleteProjectMilestoneAndClose" data-args='["${pid}","${mid}"]'>${I18N.delete}</button>
      <button data-action="closeModal">${I18N.cancel}</button>
      <button class="primary" data-action="saveProjectMilestoneForm" data-args='["${pid}","${mid}"]'>${I18N.save}</button>
    </div>`);
  setTimeout(()=>document.getElementById('pme-title')?.focus(),50);
}
HANDLERS.openProjectMilestoneForm = openProjectMilestoneForm;
HANDLERS.saveProjectMilestoneForm = (pid, mid)=>{
  const p = state.projects.find(x=>x.id===pid);
  if (!p) { closeModal(); render(); return; }
  const m = p.milestones.find(x=>x.id===mid);
  if (!m) { closeModal(); render(); return; }
  const title = document.getElementById('pme-title').value.trim();
  if (!title) return;
  m.title = title;
  m.date = document.getElementById('pme-date').value || '';
  m.done = !!document.getElementById('pme-done').checked;
  closeModal(); render();
};
HANDLERS.deleteProjectMilestoneAndClose = (pid, mid)=>{
  const p = state.projects.find(x=>x.id===pid);
  const m = p ? (p.milestones||[]).find(x=>x.id===mid) : null;
  if (!deleteWithUndo(()=>_projectArr(pid,'milestones'), mid, `delmålet «${m ? m.title : ''}»`)) return;
  closeModal(); render();
};
HANDLERS.addProjectMilestone = (pid)=>{
  const t = document.getElementById('pms-title').value.trim();
  const d = document.getElementById('pms-date').value;
  if (!t) return;
  const p = state.projects.find(x=>x.id===pid);
  if (!p) return;
  p.milestones.push({id:uid(),title:t,date:d,done:false});
  render();
};
HANDLERS.quickAddMilestone = (pid)=>{
  const t = prompt('Hva er delmålet? (f.eks. "Save the Date sendt")', '');
  if (!t || !t.trim()) return;
  const d = prompt('Eventuell dato (YYYY-MM-DD, valgfritt — la stå tom hvis ingen)', '');
  const p = state.projects.find(x=>x.id===pid);
  if (!p) return;
  p.milestones.push({id:uid(), title:t.trim(), date:(d&&/^\d{4}-\d{2}-\d{2}$/.test(d))?d:'', done:false});
  render();
};
HANDLERS.addProjectPerson = (pid)=>{
  const n = document.getElementById('pp-name').value.trim();
  const r = document.getElementById('pp-role').value.trim();
  if (!n) return;
  const p = state.projects.find(x=>x.id===pid);
  if (!p) return;
  p.people.push({id:uid(),name:n,role:r,contact:'',status:''});
  render();
};
HANDLERS.setPersonStatus = (pid,ppid,v)=>{ const p=state.projects.find(x=>x.id===pid); const pp=p?.people.find(x=>x.id===ppid); if(pp){pp.status=v; saveState();} };
HANDLERS.deleteProjectPerson = (pid,ppid)=>{
  const p=state.projects.find(x=>x.id===pid); if(!p) return;
  const pe=(p.people||[]).find(x=>x.id===ppid);
  if (!deleteWithUndo(()=>_projectArr(pid,'people'), ppid, pe && pe.name ? pe.name : 'personen')) return;
  render();
};
HANDLERS.addProjectLink = (pid)=>{
  const t = document.getElementById('pl-title').value.trim();
  const u = document.getElementById('pl-url').value.trim();
  if (!u) return;
  const p = state.projects.find(x=>x.id===pid);
  if (!p) return;
  p.links.push({id:uid(),title:t||u,url:u});
  render();
};
HANDLERS.deleteProjectLink = (pid,lid)=>{
  const p=state.projects.find(x=>x.id===pid); if(!p) return;
  const l=(p.links||[]).find(x=>x.id===lid);
  if (!deleteWithUndo(()=>_projectArr(pid,'links'), lid, `lenken «${l ? (l.title||l.url) : ''}»`)) return;
  render();
};
HANDLERS.archiveProject = (pid)=>{ const p=state.projects.find(x=>x.id===pid); if(p){p.archived=!p.archived; render();} };
// Bekreftelsen står igjen her: angring dekker prosjektet, men et helt prosjekt med
// oppgaver, delmål, notater og lenker er for stort tap til å hvile på at hun rekker
// å se toasten. ADR 0039.
HANDLERS.deleteProject = (pid)=>{
  const p = state.projects.find(x=>x.id===pid);
  if (!confirm('Slett prosjektet og alt innhold?')) return;
  if (!deleteWithUndo(()=>state.projects, pid, `prosjektet «${p ? p.title : ''}»`)) return;
  state.ui.openProjectId=null;
  render();
};

// Project create/edit form (top-level fields only)
function openProjectForm(id){
  _pendingTemplate = null;
  const p = id ? state.projects.find(x=>x.id===id) : null;
  const data = p || { title:'', category:'personlig', startDate:'', targetDate:'', targetEndDate:'', description:'' };
  const isNew = !p;
  openModal(`
    <h3>${p?'Rediger prosjekt':'Nytt prosjekt'}</h3>
    <div class="body">
      ${isNew ? `<div class="field"><label>Bruk mal <span class="text-note">— valgfritt, gir deg ferdig oppsett av oppgaver</span></label><select id="p-template">
        <option value="">— ingen mal (start tomt) —</option>
        ${PROJECT_TEMPLATES.map(t=>`<option value="${t.id}">${t.label}</option>`).join('')}
      </select></div>` : ''}
      <div class="field"><label>Tittel</label><input id="p-title" type="text" value="${escapeAttr(data.title)}" placeholder="F.eks. Vårt bryllup"></div>
      <div class="field"><label>Kategori</label><select id="p-cat">${CATEGORIES.map(c=>`<option value="${c.id}" ${data.category===c.id?'selected':''}>${c.label}</option>`).join('')}</select></div>
      <div class="field"><label>Måldato — første dag av hendelsen</label><input id="p-target" type="date" value="${data.targetDate||''}"></div>
      <div class="field"><label>Sluttdato på hendelsen <span class="text-note">— valgfritt, hvis flere dager (f.eks. bryllup over flere dager)</span></label><input id="p-targetEnd" type="date" value="${data.targetEndDate||''}"></div>
      <div class="field"><label>Forberedelse starter <span class="text-note">— valgfritt</span></label><input id="p-start" type="date" value="${data.startDate||''}"></div>
      <div class="field"><label>Kort beskrivelse</label><textarea id="p-desc" placeholder="Hva er dette i én setning?">${escapeHTML(data.description||'')}</textarea></div>
    </div>
    <div class="footer">
      <button data-action="closeModal">${I18N.cancel}</button>
      <button class="primary" data-action="saveProjectForm" data-args='["${p?p.id:''}"]'>${I18N.save}</button>
    </div>`);
  _focusLater('p-title');
  if (isNew){
    document.getElementById('p-template').addEventListener('change', e=>{
      const tid = e.target.value;
      if (!tid){ _pendingTemplate = null; return; }
      const tpl = PROJECT_TEMPLATES.find(t=>t.id===tid);
      if (!tpl) return;
      _pendingTemplate = tpl;
      // Pre-fill form fields (don't clobber if user has typed)
      const catSel = document.getElementById('p-cat');
      catSel.value = tpl.category;
      const descArea = document.getElementById('p-desc');
      if (!descArea.value.trim()) descArea.value = tpl.description;
    });
  }
}
HANDLERS.openProjectForm = openProjectForm;
// Sluttdato tidligere enn startdato ble stille erstattet med '' — feltet så ut som det
// ble tatt imot, og hendelsen ble endagsvarig uten et ord. Si det i stedet. ADR 0032.
function _endDateOr(raw, start, hva){
  if (!raw) return '';
  if (!start) return '';
  if (raw > start) return raw;
  if (typeof showToast === 'function'){
    showToast(`⚠ Sluttdatoen (${raw}) er ikke etter ${hva} (${start}), så den ble ikke lagret.`, 9000);
  }
  return '';
}

HANDLERS.saveProjectForm = id=>{
  const target = document.getElementById('p-target').value||'';
  const targetEndRaw = document.getElementById('p-targetEnd').value||'';
  const data = {
    title: document.getElementById('p-title').value.trim(),
    category: document.getElementById('p-cat').value,
    targetDate: target,
    targetEndDate: _endDateOr(targetEndRaw, target, 'måldatoen'),
    startDate: document.getElementById('p-start').value||'',
    description: document.getElementById('p-desc').value.trim(),
  };
  if (!data.title){
    // Dialogen sto åpen og knappen gjorde ingenting, uten å si hvorfor. ADR 0032.
    if (typeof showToast === 'function') showToast('⚠ Tittel må fylles ut før du kan lagre.', 5000);
    return;
  }
  if (id){
    const ex = state.projects.find(x=>x.id===id);
    // Posten forsvant mellom åpning og lagring — typisk fordi 60-sekunders-pullet
    // erstattet hele state mens dialogen sto åpen. Før lukket dialogen seg helt som
    // ved suksess, så redigeringen var borte uten et ord. ADR 0031.
    if (!ex){ _warnVanished(); closeModal(); render(); return; }
    Object.assign(ex, data);
  } else {
    const np = Object.assign({id:uid(),tasks:[],milestones:[],people:[],links:[],notes:'',status:'active',archived:false}, data);
    // Apply pending template (if any)
    if (_pendingTemplate){
      const tpl = _pendingTemplate;
      const targetD = data.targetDate ? fromKey(data.targetDate) : null;
      np.tasks = tpl.tasks.map(t=>{
        let due = '';
        if (t.offset !== null && targetD){
          const d = new Date(targetD);
          d.setDate(d.getDate() + t.offset);
          due = dKey(d);
        }
        return { id:uid(), title:t.title, due, endDate:'', notes:'', done:false };
      });
      np.milestones = tpl.milestones.map(m=>{
        let date = '';
        if (m.offset !== null && targetD){
          const d = new Date(targetD);
          d.setDate(d.getDate() + m.offset);
          date = dKey(d);
        }
        return { id:uid(), title:m.title, date, done:false };
      });
      _pendingTemplate = null;
    }
    state.projects.push(np);
    state.ui.openProjectId = np.id;
  }
  closeModal();
  state.ui.view='projects';
  render();
};

// Project sub-task form
function openProjectTaskForm(pid, tid){
  const p = state.projects.find(x=>x.id===pid);
  if (!p) return;
  const t = tid ? p.tasks.find(x=>x.id===tid) : null;
  const data = t || { title:'', due:'', endDate:'', notes:'', done:false };
  const hasAdvanced = !!(data.endDate || data.recurring || data.remindBefore || (data.notes||'').trim());
  openModal(`
    <h3>${t?'Rediger oppgave':'Ny oppgave'} — ${escapeHTML(p.title)}</h3>
    <div class="body">
      <div class="field"><label>Hva må gjøres?</label><input id="pt-title" type="text" value="${escapeAttr(data.title)}" placeholder="F.eks. Skrive tale"></div>
      <div class="field"><label>Frist (valgfritt)</label><input id="pt-due" type="date" value="${data.due||''}"></div>
      <details ${hasAdvanced?'open':''} style="margin-top:4px">
        <summary style="cursor:pointer;font-size:12px;color:var(--ink-soft);padding:4px 0;list-style:none;-webkit-user-select:none">▸ Avansert (sluttdato, gjenta, påminnelse, notater)</summary>
        <div style="display:flex;flex-direction:column;gap:12px;margin-top:8px">
          <div class="field"><label>Sluttdato <span class="text-note">— hvis oppgaven varer flere dager</span></label><input id="pt-endDate" type="date" value="${data.endDate||''}"></div>
          <div class="field"><label>Gjenta</label><select id="pt-recurring">
            <option value="" ${!data.recurring?'selected':''}>— én gang —</option>
            <option value="daily" ${data.recurring==='daily'?'selected':''}>Hver dag</option>
            <option value="weekly" ${data.recurring==='weekly'?'selected':''}>Hver uke</option>
            <option value="monthly" ${data.recurring==='monthly'?'selected':''}>Hver måned</option>
            <option value="yearly" ${data.recurring==='yearly'?'selected':''}>Hvert år</option>
          </select></div>
          <div class="field"><label>Påminnelse</label><select id="pt-remind">
            <option value="" ${!data.remindBefore?'selected':''}>— ingen —</option>
            <option value="sameday" ${data.remindBefore==='sameday'?'selected':''}>Samme dag (kl 09:00)</option>
            <option value="1day" ${data.remindBefore==='1day'?'selected':''}>1 dag før</option>
            <option value="3days" ${data.remindBefore==='3days'?'selected':''}>3 dager før</option>
            <option value="1week" ${data.remindBefore==='1week'?'selected':''}>1 uke før</option>
          </select></div>
          <div class="field"><label>Notater</label><textarea id="pt-notes">${escapeHTML(data.notes||'')}</textarea></div>
        </div>
      </details>
    </div>
    <div class="footer">
      ${t?`<button class="danger" data-action="deleteProjectTaskAndClose" data-args='["${pid}","${tid}"]'>${I18N.delete}</button>`:''}
      <button data-action="closeModal">${I18N.cancel}</button>
      <button class="primary" data-action="saveProjectTaskForm" data-args='["${pid}","${t?t.id:''}"]'>${I18N.save}</button>
    </div>`);
  _focusLater('pt-title');
}
HANDLERS.openProjectTaskForm = openProjectTaskForm;
HANDLERS.saveProjectTaskForm = (pid, tid)=>{
  const p = state.projects.find(x=>x.id===pid);
  const due = document.getElementById('pt-due').value||'';
  const endDateRaw = document.getElementById('pt-endDate').value||'';
  const data = {
    title: document.getElementById('pt-title').value.trim(),
    due,
    endDate: _endDateOr(endDateRaw, due, 'fristen'),
    remindBefore: document.getElementById('pt-remind').value||'',
    recurring: document.getElementById('pt-recurring').value||'',
    notes: document.getElementById('pt-notes').value.trim(),
  };
  if (!data.title){
    // Dialogen sto åpen og knappen gjorde ingenting, uten å si hvorfor. ADR 0032.
    if (typeof showToast === 'function') showToast('⚠ Tittel må fylles ut før du kan lagre.', 5000);
    return;
  }
  if (!p) { closeModal(); render(); return; }
  if (tid){
    const ex = p.tasks.find(x=>x.id===tid);
    // Posten forsvant mellom åpning og lagring — typisk fordi 60-sekunders-pullet
    // erstattet hele state mens dialogen sto åpen. Før lukket dialogen seg helt som
    // ved suksess, så redigeringen var borte uten et ord. ADR 0031.
    if (!ex){ _warnVanished(); closeModal(); render(); return; }
    Object.assign(ex, data);
  } else { p.tasks.push(Object.assign({id:uid(),done:false}, data)); }
  closeModal(); render();
};

// ============================================================
// VIEW: TO DO'S (dump + priority buckets + tag-to-project)
// ============================================================
function renderTodos(){
  const today = todayKey();
  const allFree = state.tasks.filter(passesFilter);
  const uncategorized = allFree.filter(t=>!t.priority && !t.done);
  const urgent = allFree.filter(t=>t.priority==='urgent' && !t.done);
  const shortTerm = allFree.filter(t=>t.priority==='short' && !t.done);
  const longTerm = allFree.filter(t=>t.priority==='long' && !t.done);
  const done = allFree.filter(t=>t.done);
  const inbox = state.inbox||[];

  // Sort by due date asc (undated last), then manual order field as tiebreaker
  uncategorized.sort(_dateThenOrderCmp);
  urgent.sort(_dateThenOrderCmp);
  shortTerm.sort(_dateThenOrderCmp);
  longTerm.sort(_dateThenOrderCmp);

  const projectsList = state.projects.filter(p=>!p.archived).map(p=>`<option value="${p.id}">${escapeHTML(p.title)}</option>`).join('');

  viewEl.innerHTML = `
    <div class="subnav">
      <h2>To Do's</h2>
      <button class="today-btn" data-action="toggleSelectMode">${_selMode ? '✕ Avslutt valg' : '☑ Velg flere'}</button>
    </div>
    ${_selMode ? bulkBarHTML(projectsList) : ''}
    <div class="todo-quick${_selMode ? ' hidden' : ''}">
      <input class="qtxt" id="qt-input" type="text" placeholder="Skriv en To Do og trykk Enter, eller bruk knappene under…" autofocus>
      <div class="qbtns">
        <button data-action="quickAddTodo" data-args='["inbox"]'>→ Innboks</button>
        <button class="urgent" data-action="quickAddTodo" data-args='["urgent"]'>⚠ Urgent</button>
        <button class="short" data-action="quickAddTodo" data-args='["short"]'>↗ Short term</button>
        <button class="long" data-action="quickAddTodo" data-args='["long"]'>⤳ Long term</button>
        <select id="qt-project" style="padding:6px 10px;border:1px solid var(--line);border-radius:6px;font-size:12.5px;background:#fff;color:var(--ink-soft)" onchange="if(this.value)HANDLERS.quickAddTodo('project',this.value);this.value=''">
          <option value="">▸ Til prosjekt…</option>${projectsList}
        </select>
        <button data-action="startVoiceCapture" title="Snakk inn et notat (lagres i innboks)" style="margin-left:auto">🎤 Tale</button>
      </div>
    </div>

    ${inbox.length ? `
      <div class="todo-bucket">
        <div class="bh">Innboks <small>${inbox.length} ufordelte — dra til en boks under, eller bruk knappene</small></div>
        ${inbox.slice().reverse().map(i=>{
          const isPrivat = i.category === 'privat';
          const catColor = isPrivat ? 'var(--privat)' : 'var(--work)';
          const catTitle = isPrivat ? 'Kategori: Privat — klikk for Jobb' : 'Kategori: Jobb — klikk for Privat';
          return `<div class="todo-row" data-task-id="${i.id}" data-task-kind="inbox" draggable="true" ondragstart="HANDLERS.todoDragStart(event,'${i.id}','inbox')" ondragend="HANDLERS.todoDragEnd(event)">
          <span class="drag-handle" title="Dra for å sortere">⋮⋮</span>
          <span class="ttitle" ondblclick="HANDLERS.inlineEditStart(event,'${i.id}','inbox')">${escapeHTML(i.text)}</span>
          <div class="actions" style="opacity:1">
            <button data-action="inboxToTodo" data-args='["${i.id}","urgent"]' title="Til Urgent">⚠</button>
            <button data-action="inboxToTodo" data-args='["${i.id}","short"]' title="Til Short term">↗</button>
            <button data-action="inboxToTodo" data-args='["${i.id}","long"]' title="Til Long term">⤳</button>
            <button data-action="toggleInboxCategory" data-args='["${i.id}"]' title="${catTitle}" style="color:${catColor};font-size:14px;line-height:1">●</button>
            <select onchange="if(this.value){HANDLERS.inboxToProject('${i.id}',this.value);this.value=''}" class="btn-sec-xs">
              <option value="">▸ Prosjekt</option>${projectsList}
            </select>
            <button class="ag" data-action="inboxEditStart" data-args='["${i.id}"]' title="Rediger">✎</button>
            <button class="ag" data-action="deleteInbox" data-args='["${i.id}"]'>×</button>
          </div>
        </div>`;
        }).join('')}
      </div>
    ` : ''}

    ${todoBucketHTML('Ukategorisert', '', uncategorized, projectsList, 'Disse trenger en plassering — drag dem til en boks under, eller fjern')}
    ${todoBucketHTML('⚠ Urgent', 'urgent', urgent, projectsList)}
    ${todoBucketHTML('↗ Short term', 'short', shortTerm, projectsList)}
    ${todoBucketHTML('⤳ Long term', 'long', longTerm, projectsList)}

    ${_selMode ? '' : projectTodosBucketHTML()}

    ${done.length && !_selMode ? `
      <div style="margin:18px 0 0;text-align:center">
        <button data-action="toggleShowCompleted" style="padding:6px 14px;font-size:12.5px;border-radius:6px;border:1px solid var(--line);background:var(--surface);color:var(--ink-soft)">${state.ui.showCompletedTodos?'Skjul fullførte':'Vis fullførte ('+done.length+')'}</button>
      </div>
      ${state.ui.showCompletedTodos ? `
        <div class="todo-bucket" style="margin-top:14px">
          <div class="bh" style="background:var(--surface-2);color:var(--ink-muted)">Fullførte <small>${done.length}</small></div>
          ${done.slice(-20).reverse().map(t=>todoRowHTML(t, projectsList)).join('')}
        </div>
      ` : ''}
    ` : ''}
  `;

  const inp = document.getElementById('qt-input');
  inp.addEventListener('keydown', e=>{
    if (e.key==='Enter' && inp.value.trim()){
      e.preventDefault();
      HANDLERS.quickAddTodo('inbox');
    }
  });
  // Wire up drag-to-reorder within each bucket (date trumps manual order in sort).
  // I velg-modus er radene ikke draggable — da er det ingenting å koble opp.
  if (!_selMode) viewEl.querySelectorAll('.todo-bucket').forEach(bucket=>{
    const prio = bucket.dataset.prio;
    // «Fra prosjekter» sorteres etter frist innenfor hvert prosjekt (ADR 0045) —
    // manuell rekkefølge der bor på prosjektsiden, så ingen omsortering her.
    if (bucket.classList.contains('proj-bucket')) return;
    if (prio === '' || prio === 'urgent' || prio === 'short' || prio === 'long'){
      setupListReorder(bucket, '.todo-row[data-task-kind="freetask"]', (draggedId, targetId, before)=>{
        reorderFreeTasksByPriority(prio, draggedId, targetId, before);
      });
    } else {
      // Inbox bucket (no data-prio attr)
      setupListReorder(bucket, '.todo-row[data-task-kind="inbox"]', (draggedId, targetId, before)=>{
        reorderInbox(draggedId, targetId, before);
      });
    }
  });
  // Wire up swipe actions on each task row (touch only — desktop ignores)
  viewEl.querySelectorAll('.todo-row[data-task-id]').forEach(row=>{
    const id = row.dataset.taskId;
    const kind = row.dataset.taskKind;
    addSwipeActions(row,
      // Right swipe → complete (or undo)
      ()=>{
        if (kind === 'freetask'){
          const t = state.tasks.find(x=>x.id===id); if (!t) return;
          row.classList.add('completing');
          setTimeout(()=>{ _setDone(t, !t.done); render(); }, 380);
        } else if (kind === 'projecttask'){
          // Samme dør som avkryssingsboksen, så gjentakelse og doneAt håndteres likt.
          HANDLERS.toggleProjectTask(row.dataset.projectId, id);
        } else if (kind === 'inbox'){
          // Inbox can't be "done"; swipe right promotes to short-term
          HANDLERS.inboxToTodo(id, 'short');
        }
      },
      // Venstresveip → slett. Bekreftelsesdialogen er borte: et sveip er nettopp
      // gesten man gjør ved et uhell, og angre-knappen i toasten er et bedre svar
      // på det enn en dialog man rekker å trykke bort like refleksivt. ADR 0039.
      // Prosjektoppgaver er med vilje ikke med her: sletting av prosjektinnhold hører
      // hjemme på prosjektsiden, der resten av saken er synlig. ADR 0045.
      ()=>{
        if (kind === 'freetask') HANDLERS.deleteFreeTask(id);
        else if (kind === 'inbox') HANDLERS.deleteInbox(id);
      }
    );
  });
}

// ---------------------------------------------------------------------------
// MASSEREDIGERING AV TO DO'S (ADR 0042)
// 108 oppgaver, 23 av dem uten frist. Å gi dem datoer én og én er trettende nok
// til at det ikke blir gjort. Utvalget lever bevisst utenfor `state`: det er
// arbeidsminne, ikke data, og en avkryssing som overlevde en omstart ville vært
// et gjenferd. Derfor heller ingen `saveState()` når utvalget endres — men
// render() lagrer uansett på slutten, så det er ingen ekstra skriving.
// ---------------------------------------------------------------------------
let _selMode = false;
const _selIds = new Set();

function _selReset(){ _selMode = false; _selIds.clear(); }

// Oppgavene velg-modus opererer på: frie, ikke fullførte, og synlige under
// gjeldende filter — nøyaktig de radene som faktisk står på skjermen.
function _selectableTasks(){
  return (state.tasks || []).filter(t => !t.done && passesFilter(t));
}

// Bare id-er som fortsatt finnes. Et sky-pull kan ha fjernet noe mens utvalget sto.
function _selectedTasks(){
  const ids = _selIds;
  return (state.tasks || []).filter(t => ids.has(t.id));
}

HANDLERS.toggleSelectMode = ()=>{
  _selMode = !_selMode;
  if (!_selMode) _selIds.clear();
  render();
};

HANDLERS.toggleSelectTask = (id)=>{
  if (_selIds.has(id)) _selIds.delete(id); else _selIds.add(id);
  render();
};

HANDLERS.selectAllTodos = ()=>{
  const all = _selectableTasks();
  // Samme knapp slår av igjen når alt allerede er valgt.
  if (all.length && all.every(t=>_selIds.has(t.id))) _selIds.clear();
  else all.forEach(t=>_selIds.add(t.id));
  render();
};

HANDLERS.bulkSetDue = (val)=>{
  const sel = _selectedTasks();
  if (!sel.length) return;
  // Tom verdi fra datofeltet betyr «fjern frist» — det er den eneste måten å tømme
  // et <input type="date"> på, og «uten frist» er en gyldig tilstand her.
  sel.forEach(t=>{ if (val) t.due = val; else delete t.due; });
  showToast(val ? `Frist satt på ${sel.length} oppgaver` : `Frist fjernet fra ${sel.length} oppgaver`);
  _selReset();
  render();
};

HANDLERS.bulkSetProject = (val)=>{
  const sel = _selectedTasks();
  if (!sel.length || !val) return;
  const none = val === '__none__';
  const p = none ? null : (state.projects || []).find(x=>x.id===val);
  if (!none && !p) return;
  sel.forEach(t=>{ if (none) delete t.projectId; else t.projectId = p.id; });
  showToast(none ? `Prosjekt fjernet fra ${sel.length} oppgaver` : `${sel.length} oppgaver flyttet til «${p.title}»`);
  _selReset();
  render();
};

HANDLERS.bulkDone = ()=>{
  const sel = _selectedTasks();
  if (!sel.length) return;
  sel.forEach(t=>_setDone(t, true));   // én dør for done/doneAt/status — ADR 0037
  showToast(`${sel.length} oppgaver markert som gjort`);
  _selReset();
  render();
};

// Massesletting beholder bekreftelsen: angring dekker den, men et feilklikk her
// tar mange rader på én gang, og toasten rekker man ikke alltid. ADR 0039.
HANDLERS.bulkDelete = ()=>{
  const sel = _selectedTasks();
  if (!sel.length) return;
  if (!confirm(`Slett ${sel.length} ${sel.length===1?'oppgave':'oppgaver'}?`)) return;
  const ids = new Set(sel.map(t=>t.id));
  // Indeksene fanges før fjerningen og settes inn igjen i stigende rekkefølge, slik at
  // rekkefølgen i lista blir den samme. Gjenopprettingen er additiv — den skriver aldri
  // over hele lista — så en sky-oppdatering i mellomtiden overlever angringen.
  const removed = [];
  (state.tasks || []).forEach((t, i)=>{ if (ids.has(t.id)) removed.push({ i, t }); });
  state.tasks = (state.tasks || []).filter(t=>!ids.has(t.id));
  registerUndo(`${removed.length} ${removed.length===1?'oppgave':'oppgaver'}`, ()=>{
    const arr = state.tasks;
    if (!Array.isArray(arr)) return false;
    removed.forEach(({ i, t })=>{
      if (!arr.some(x=>x && x.id===t.id)) arr.splice(Math.min(i, arr.length), 0, t);
    });
    return true;
  });
  _selReset();
  render();
};

// Handlingslinja. Datofeltet har stabil id (render-kontrakten, ADR 0029) og
// anvendes på `change` — ingen verdi blir stående og vente på en «Bruk»-knapp som
// en bakgrunns-render kunne rukket å tømme.
function bulkBarHTML(projectsList){
  const n = _selIds.size;
  const all = _selectableTasks();
  const allSelected = all.length > 0 && all.every(t=>_selIds.has(t.id));
  return `<div class="bulkbar" id="bulkbar">
    <span class="bb-count">${n} valgt</span>
    <button data-action="selectAllTodos">${allSelected ? 'Fjern alle' : `Velg alle (${all.length})`}</button>
    ${n ? `
      <label class="bb-field">Frist <input type="date" id="bulk-due" onchange="HANDLERS.bulkSetDue(this.value)"></label>
      <select id="bulk-proj" onchange="if(this.value)HANDLERS.bulkSetProject(this.value)">
        <option value="">▸ Prosjekt…</option>
        <option value="__none__">— fjern prosjekt —</option>
        ${projectsList}
      </select>
      <button data-action="bulkDone">✓ Merk gjort</button>
      <button data-action="bulkDelete" class="danger">× Slett</button>
    ` : '<span class="bb-hint">Kryss av radene du vil endre</span>'}
    <button data-action="toggleSelectMode" class="bb-cancel">Avbryt</button>
  </div>`;
}

// ---------------------------------------------------------------------------
// «FRA PROSJEKTER» I TO DO'S (ADR 0045)
// Prosjektenes egne underoppgaver fantes bare inne i hvert prosjekt. Hun jobber
// fra To Do's, så de var usynlige der hun faktisk ser — mens motsatt retning
// (taggede frie To Do's inn i prosjektet) har virket siden ADR 0033/0037.
//
// Egen bøtte under de fire prioritetsbøttene, gruppert per prosjekt. Ikke blandet
// inn i Urgent/Short/Long: prosjektoppgaver har ingen `priority`, så alle ville
// havnet i «Ukategorisert» — bøtta hun bruker til «disse trenger en plassering» —
// og druknet den i tretti rader den ikke handler om.
//
// Det er SAMME objekt som på prosjektsiden, ikke en kopi. Derfor er toveis-
// oppdateringen ikke en synkronisering som kan drifte: å krysse av her ér å krysse
// av der. `toggleProjectTask` er den samme døren begge steder.
// ---------------------------------------------------------------------------

// Bare prosjektenes EGNE underoppgaver. Taggede frie To Do's står allerede i
// prioritetsbøttene over; å ta dem med her ville vist dem to ganger på samme side.
function projectTodoGroups(){
  const groups = [];
  (state.projects || []).forEach(p=>{
    if (p.archived || !passesFilter(p)) return;
    const own = p.tasks || [];
    const open = own.filter(t=>!t.done).sort(_dateThenOrderCmp);
    const done = state.ui.showCompletedTodos ? own.filter(t=>t.done).sort(_dateThenOrderCmp) : [];
    if (!open.length && !done.length) return;
    // Gruppene sorteres etter tidligste åpne frist, som prosjektkortene — det som
    // forfaller først skal stå øverst. Uten frist sist.
    const first = open.find(t=>t.due);
    groups.push({ p, open, done, sortKey: first ? first.due : '9999-99-99' });
  });
  groups.sort((a,b)=> a.sortKey !== b.sortKey
    ? a.sortKey.localeCompare(b.sortKey)
    : a.p.title.localeCompare(b.p.title, 'nb'));
  return groups;
}

// Rad for en prosjektoppgave i To Do's. Bevisst færre handlinger enn en fri To Do:
// krysse av, utsette frist, åpne. Ingen slett — å slette prosjektinnhold fra en liste
// der resten av saken ikke er synlig er lettere å gjøre ved et uhell enn å angre.
function projectTaskRowHTML(p, t){
  const todayK = todayKey();
  const overdue = t.due && !t.done && t.due < todayK;
  const due = t.due
    ? `<span class="due${overdue?' overdue':''}" title="${escapeAttr(absDateTitle(t.due))}">· ${escapeHTML(relDateLabel(t.due, todayK))}</span>`
    : '';
  return `<div class="todo-row ptodo-row ${t.done?'done':''}" data-task-id="${t.id}" data-task-kind="projecttask" data-project-id="${p.id}">
    <input type="checkbox" ${t.done?'checked':''} onchange="HANDLERS.toggleProjectTask('${p.id}','${t.id}',event)">
    <span class="ttitle" ${act('openProjectTaskForm', p.id, t.id)}>${escapeHTML(t.title)} ${due}</span>
    <div class="actions">
      <select onchange="if(this.value){HANDLERS.postponeProjectTask('${p.id}','${t.id}',this.value);this.value=''}" class="btn-sec-xs" title="Utsett frist">
        <option value="">▸ Utsett</option>
        <option value="1d">+1 dag</option>
        <option value="3d">+3 dager</option>
        <option value="1w">+1 uke</option>
        <option value="1m">+1 måned</option>
      </select>
      <button class="ag" ${act('openProjectTaskForm', p.id, t.id)} title="Rediger detaljer">✎</button>
    </div>
  </div>`;
}

// Hele bøtta. Vises ikke i det hele tatt når det ikke finnes noen prosjektoppgaver —
// en permanent tom boks nederst på siden er kostnad uten nytte (samme regel som
// «uten frist» på Hjem, ADR 0038).
function projectTodosBucketHTML(){
  const groups = projectTodoGroups();
  if (!groups.length) return '';
  const total = groups.reduce((n,g)=>n + g.open.length, 0);
  return `<div class="todo-bucket proj-bucket" id="proj-todos">
    <div class="bh proj">◈ Fra prosjekter <small>${total} · underoppgaver som bor i et prosjekt — kryss av her eller der, det er samme oppgave</small></div>
    ${groups.map(g=>`
      <div class="ptgroup">
        <div class="ptgroup-head" ${act('openProject', g.p.id)} style="--pc-h:${projectHue(g.p.title)}" title="Åpne prosjektet">
          <span class="ptgroup-name">${escapeHTML(g.p.title)}</span>
          <span class="ptgroup-count">${g.open.length}</span>
        </div>
        ${g.open.map(t=>projectTaskRowHTML(g.p, t)).join('')}
        ${g.done.map(t=>projectTaskRowHTML(g.p, t)).join('')}
      </div>`).join('')}
  </div>`;
}

function todoBucketHTML(label, prio, items, projectsList, hint){
  const cls = prio || '';
  return `<div class="todo-bucket" data-prio="${prio}" ondragover="HANDLERS.todoOver(event)" ondragleave="HANDLERS.todoLeave(event)" ondrop="HANDLERS.todoDrop(event,'${prio}')">
    <div class="bh ${cls}">${label} <small>${items.length}${hint?' · '+hint:''}</small></div>
    ${items.length ? items.map(t=>todoRowHTML(t, projectsList)).join('') : `<div class="todo-empty">ren boks</div>`}
  </div>`;
}

function todoRowHTML(t, projectsList){
  // Relativ dato (ADR 0040) med den absolutte i title. Rød når fristen er passert —
  // ordene alene («2 dager på overtid») bærer det, men fargen fanger blikket først.
  const todayK = todayKey();
  const overdue = t.due && !t.done && t.due < todayK;
  const due = t.due
    ? `<span class="due${overdue?' overdue':''}" title="${escapeAttr(absDateTitle(t.due))}">· ${escapeHTML(relDateLabel(t.due, todayK))}</span>`
    : '';
  // Project-tag — clicking removes the tag (returns the task to an untagged state).
  // Title attribute documents the click behaviour.
  const proj = t.projectId ? state.projects.find(p=>p.id===t.projectId) : null;
  // Chip i stedet for «· tittel» i kursiv: taggen ER bæreren av prosjekt-tilhørigheten,
  // og så lenge den så ut som en fotnote følte man behov for å skrive «Meox:» i tittelen
  // i tillegg. ADR 0035. Fargen kommer fra tittelen — ADR 0041.
  const projTag = proj ? projChipHTML(proj.title, `data-action="untagTaskProject" data-args='["${t.id}"]' data-stop="1" title="Klikk for å fjerne prosjekt-tag"`) : '';
  const isPrivat = t.category === 'privat';
  const catColor = isPrivat ? 'var(--privat)' : 'var(--work)';
  const catTitle = isPrivat ? 'Kategori: Privat — klikk for Jobb' : 'Kategori: Jobb — klikk for Privat';
  // Velg-modus (ADR 0042): raden bytter ut draghåndtak, ferdig-boks og handlinger med
  // én avkryssingsboks. To avkryssingsbokser ved siden av hverandre — «valgt» og
  // «ferdig» — ville vært umulig å skille på et halvsekunds blikk.
  if (_selMode){
    const on = _selIds.has(t.id);
    // Chipen rendres UTEN fjern-taggen-handlingen her: hele raden er en velg-flate, og et
    // klikk på chipen skal velge raden — ikke stille fjerne prosjekttilknytningen.
    const plainTag = proj ? projChipHTML(proj.title) : '';
    return `<div class="todo-row selectable ${on?'selected':''} ${t.done?'done':''}" data-task-id="${t.id}" data-task-kind="freetask" ${act('toggleSelectTask', t.id)}>
      <input type="checkbox" class="selbox" ${on?'checked':''} ${act('toggleSelectTask', t.id)} data-stop="1">
      <span class="ttitle">${escapeHTML(t.title)} ${due} ${plainTag}</span>
    </div>`;
  }
  return `<div class="todo-row ${t.done?'done':''}" data-task-id="${t.id}" data-task-kind="freetask" draggable="true" ondragstart="HANDLERS.todoDragStart(event,'${t.id}','task')" ondragend="HANDLERS.todoDragEnd(event)">
    <span class="drag-handle" title="Dra for å sortere">⋮⋮</span>
    <input type="checkbox" ${t.done?'checked':''} onchange="HANDLERS.toggleTask('${t.id}',event)">
    <span class="ttitle" data-edit-id="${t.id}" data-edit-kind="task" ondblclick="HANDLERS.inlineEditStart(event,'${t.id}','task')">${escapeHTML(t.title)} ${due} ${projTag}</span>
    <div class="actions">
      <button data-action="setTaskPriority" data-args='["${t.id}","urgent"]' title="Urgent">⚠</button>
      <button data-action="setTaskPriority" data-args='["${t.id}","short"]' title="Short term">↗</button>
      <button data-action="setTaskPriority" data-args='["${t.id}","long"]' title="Long term">⤳</button>
      <button data-action="setTaskPriority" data-args='["${t.id}",""]' title="Fjern prioritet">○</button>
      <button data-action="toggleTaskCategory" data-args='["${t.id}"]' title="${catTitle}" style="color:${catColor};font-size:14px;line-height:1">●</button>
      <select onchange="if(this.value){HANDLERS.postponeTask('${t.id}',this.value);this.value=''}" class="btn-sec-xs" title="Utsett frist">
        <option value="">▸ Utsett</option>
        <option value="1d">+1 dag</option>
        <option value="3d">+3 dager</option>
        <option value="1w">+1 uke</option>
        <option value="1m">+1 måned</option>
      </select>
      <select onchange="if(this.value){HANDLERS.taskToProject('${t.id}',this.value);this.value=''}" class="btn-sec-xs">
        <option value="">▸ Prosjekt</option>${projectsList}
      </select>
      <button class="ag" data-action="openTaskForm" data-args='["${t.id}"]' title="Rediger detaljer">✎</button>
      <button class="ag" data-action="deleteFreeTask" data-args='["${t.id}"]'>×</button>
    </div>
  </div>`;
}

// Drag-and-drop helpers
HANDLERS.todoDragStart = (e, id, kind)=>{
  e.dataTransfer.setData('application/json', JSON.stringify({id, kind}));
  e.dataTransfer.effectAllowed = 'move';
  e.target.style.opacity = '.4';
};
HANDLERS.todoDragEnd = (e)=>{ e.target.style.opacity = ''; };
HANDLERS.todoOver = (e)=>{
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.style.outline = '2px dashed var(--accent)';
  e.currentTarget.style.outlineOffset = '-2px';
};
HANDLERS.todoLeave = (e)=>{ e.currentTarget.style.outline = ''; };
HANDLERS.todoDrop = (e, prio)=>{
  e.preventDefault();
  e.currentTarget.style.outline = '';
  try {
    const data = JSON.parse(e.dataTransfer.getData('application/json'));
    if (data.kind === 'task'){
      // Dropping a task on Innboks (prio='') with no priority makes no sense — keep it as is
      if (prio === '__inbox__') return;
      HANDLERS.setTaskPriority(data.id, prio);
    } else if (data.kind === 'inbox'){
      if (prio === '__inbox__') return;
      HANDLERS.inboxToTodo(data.id, prio);
    }
  } catch(_){}
};

HANDLERS.quickAddTodo = (kind, projectId)=>{
  const inp = document.getElementById('qt-input');
  if (!inp) return;
  const text = inp.value.trim();
  if (!text) return;
  if (kind==='inbox'){
    state.inbox.push({id:uid(), text, createdAt:new Date().toISOString()});
  } else if (kind==='project' && projectId){
    const p = state.projects.find(x=>x.id===projectId);
    if (p) p.tasks.push({id:uid(), title:text, due:'', endDate:'', notes:'', done:false});
  } else {
    // priority bucket: urgent / short / long
    state.tasks.push({id:uid(), title:text, due:'', category:'arbeid', priority:kind, done:false});
  }
  inp.value = '';
  inp.focus();
  render();
};

// Trigger inline edit on an inbox item from a click (matches the ondblclick path
// that already exists on the title). Added 2026-06-08 — the pencil button on
// each inbox row calls this, so the inline-edit affordance is discoverable
// without users having to know about double-click.
HANDLERS.inboxEditStart = (id) => {
  const row = document.querySelector(`.todo-row[data-task-id="${id}"][data-task-kind="inbox"]`);
  if (!row) return;
  const span = row.querySelector('.ttitle');
  if (!span) return;
  HANDLERS.inlineEditStart({ stopPropagation: ()=>{}, currentTarget: span }, id, 'inbox');
};

// Toggle category on an inbox item. Default is 'arbeid' (Jobb) — first click sets
// 'privat' (Privat), second click returns to 'arbeid'. Mirrors HANDLERS.toggleTaskCategory
// from free-task rows. Category is preserved when the inbox item is promoted to a
// free task via inboxToTodo. Added 2026-06-08 (reported by Maria).
HANDLERS.toggleInboxCategory = (id) => {
  const i = state.inbox.find(x => x.id === id);
  if (!i) return;
  i.category = (i.category === 'privat') ? 'arbeid' : 'privat';
  render();
};

HANDLERS.setTaskPriority = (id, prio)=>{
  const t = state.tasks.find(x=>x.id===id);
  if (t){ t.priority = prio; render(); }
};

// Toggle a free-task between Jobb (arbeid) and Privat. Default for new tasks is
// 'arbeid' — this button lets Maria flip individual to-dos to Privat (and back)
// without opening the edit form. Added 2026-05-27 (reported by Maria).
HANDLERS.toggleTaskCategory = (id)=>{
  const t = state.tasks.find(x=>x.id===id);
  if (!t) return;
  t.category = (t.category === 'privat') ? 'arbeid' : 'privat';
  render();
};

// Tag a free task with a project (does NOT move it). The task keeps its priority,
// category, due-date, and identity — it just gains a projectId that renders as a
// muted "· prosjekt-tittel" tag in the To Do's list. Maria reported that moving
// the task into the project made it disappear from her central To Do's list, and
// she wanted a total overview with project-tags. Behaviour pre-2026-06-08 was to
// splice + push, losing priority and identity; that's gone now.
HANDLERS.taskToProject = (taskId, projectId)=>{
  const t = state.tasks.find(x=>x.id===taskId);
  if (!t) return;
  if (!state.projects.find(x=>x.id===projectId)) return;
  t.projectId = projectId;
  render();
};

// Remove the project-tag from a free task (returns it to "uncategorized project").
HANDLERS.untagTaskProject = (taskId)=>{
  const t = state.tasks.find(x=>x.id===taskId);
  if (!t) return;
  delete t.projectId;
  render();
};

HANDLERS.inboxToTodo = (inboxId, prio)=>{
  const idx = state.inbox.findIndex(x=>x.id===inboxId);
  if (idx===-1) return;
  const i = state.inbox[idx];
  // Preserve category from the inbox item (set by toggleInboxCategory); default to arbeid
  state.tasks.push({id:uid(), title:i.text, due:'', category:(i.category==='privat'?'privat':'arbeid'), priority:prio, done:false});
  state.inbox.splice(idx, 1);
  render();
};

HANDLERS.inboxToProject = (inboxId, projectId)=>{
  const idx = state.inbox.findIndex(x=>x.id===inboxId);
  if (idx===-1) return;
  const i = state.inbox[idx];
  const p = state.projects.find(x=>x.id===projectId);
  if (!p){ return; }
  p.tasks.push({id:uid(), title:i.text, due:'', endDate:'', notes:'', done:false});
  state.inbox.splice(idx, 1);
  render();
};

HANDLERS.deleteFreeTask = (id)=>{
  const t = (state.tasks||[]).find(x=>x.id===id);
  if (!deleteWithUndo(()=>state.tasks, id, `«${t ? t.title : 'oppgaven'}»`)) return;
  render();
};

// Flytter én frist framover. Egen funksjon fordi to handlere trenger den — frie
// To Do's og prosjektoppgaver (ADR 0045) — og en kopi ville drevet fra originalen.
// Returnerer false på ukjent intervall, så kallstedet kan la staten stå urørt.
function _postponeDue(t, by){
  if (!t) return false;
  const base = t.due ? fromKey(t.due) : new Date();
  let newDue;
  if (by === '1d') newDue = addDays(base, 1);
  else if (by === '3d') newDue = addDays(base, 3);
  else if (by === '1w') newDue = addDays(base, 7);
  else if (by === '1m') newDue = new Date(base.getFullYear(), base.getMonth()+1, base.getDate());
  else return false;
  t.due = dKey(newDue);
  return true;
}

HANDLERS.postponeTask = (id, by)=>{
  const t = state.tasks.find(x=>x.id===id);
  if (!_postponeDue(t, by)) return;
  render();
};

// Samme utsettelse for en prosjektoppgave, fra «Fra prosjekter»-bøtta. ADR 0045.
HANDLERS.postponeProjectTask = (pid, tid, by)=>{
  const p = (state.projects||[]).find(x=>x.id===pid);
  const t = p ? (p.tasks||[]).find(x=>x.id===tid) : null;
  if (!_postponeDue(t, by)) return;
  render();
};

// Inline-edit: double-click a .ttitle span to edit the title in place. Enter saves, Escape cancels.
HANDLERS.inlineEditStart = (e, id, kind)=>{
  e.stopPropagation();
  const span = e.currentTarget;
  let original;
  if (kind === 'task'){
    const t = state.tasks.find(x=>x.id===id); if (!t) return; original = t.title;
  } else if (kind === 'inbox'){
    const i = state.inbox.find(x=>x.id===id); if (!i) return; original = i.text;
  } else if (kind === 'projectTask'){
    // id encoded as projectId:taskId
    const [pid, tid] = id.split(':');
    const p = state.projects.find(x=>x.id===pid); if (!p) return;
    const t = p.tasks.find(x=>x.id===tid); if (!t) return; original = t.title;
  } else return;

  const input = document.createElement('input');
  input.type = 'text';
  input.value = original;
  // Injisert imperativt, ikke tegnet fra en mal — kan ikke gjenopprettes etter en
  // render(), bare lagres først. `transient` demper id-advarselen i _captureFocus.
  input.dataset.transient = '1';
  input.style.cssText = 'flex:1;padding:4px 8px;border:1px solid var(--accent);border-radius:4px;font-size:13.5px;font-family:var(--font);width:100%';
  span.replaceWith(input);
  input.focus();
  input.select();

  let committed = false;
  function commit(){
    if (committed) return;
    committed = true;
    unregister();
    const newVal = input.value.trim();
    if (newVal && newVal !== original){
      if (kind === 'task'){
        const t = state.tasks.find(x=>x.id===id); if (t) t.title = newVal;
      } else if (kind === 'inbox'){
        const i = state.inbox.find(x=>x.id===id); if (i) i.text = newVal;
      } else if (kind === 'projectTask'){
        const [pid, tid] = id.split(':');
        const p = state.projects.find(x=>x.id===pid);
        const t = p?.tasks.find(x=>x.id===tid); if (t) t.title = newVal;
      }
      saveState();
    }
    render();
  }
  function cancel(){ if (committed) return; committed = true; unregister(); render(); }

  // En bakgrunns-render() fjerner dette feltet uten å utløse blur. Å lagre først er
  // det eneste som virker her — Esc-avbryt beholdes, men et pull skal ikke oppføre
  // seg som Esc. ADR 0029.
  const unregister = registerPendingCommit(commit);

  input.addEventListener('keydown', ev=>{
    if (ev.key === 'Enter'){ ev.preventDefault(); commit(); }
    else if (ev.key === 'Escape'){ ev.preventDefault(); cancel(); }
  });
  input.addEventListener('blur', commit);
};

// ============================================================
// VIEW: ÅRSOVERSIKT (Gantt timeline + key dates + 24-month grid)
// ============================================================
function renderOverview(){
  const today = new Date();
  const aKey = state.ui.overviewAnchor || dKey(today);
  const anchor = fromKey(aKey);
  const startY = anchor.getFullYear();
  const startM = anchor.getMonth() - 6;
  const months = [];
  for (let i=0; i<24; i++){
    const y = startY + Math.floor((startM + i) / 12);
    const m = ((startM + i) % 12 + 12) % 12;
    months.push({y,m});
  }
  const first = months[0], last = months[23];
  const titleStr = `${I18N.monthsShort[first.m]} ${first.y} – ${I18N.monthsShort[last.m]} ${last.y}`;

  // Gantt range in milliseconds
  const rangeStart = new Date(first.y, first.m, 1).getTime();
  const rangeEnd = new Date(last.y, last.m + 1, 1).getTime() - 1;
  const rangeSpan = rangeEnd - rangeStart;
  const pct = (ts) => Math.max(0, Math.min(100, ((ts - rangeStart) / rangeSpan) * 100));

  // Projects with any date, sorted by start (or target)
  const ganttProjects = projectsActive().filter(p=>p.targetDate||p.startDate).slice().sort((a,b)=>{
    const aS = a.startDate || a.targetDate || '9999';
    const bS = b.startDate || b.targetDate || '9999';
    return aS.localeCompare(bS);
  });

  const ganttRowsHTML = ganttProjects.map(p=>{
    const startTs = fromKey(p.startDate || p.targetDate).getTime();
    const endTs = fromKey(p.targetEndDate || p.targetDate || p.startDate).getTime() + 86400000; // include end day
    if (endTs < rangeStart || startTs > rangeEnd) return null;
    const left = pct(startTs);
    const right = pct(endTs);
    const width = Math.max(right - left, 0.4);
    const isPoint = (endTs - startTs) <= 86400000 + 1000; // single-day
    return `<div class="gantt-row">
      <div class="label" data-action="openProject" data-args='["${p.id}"]'>
        <span class="pcat cat-${p.category}"></span>${escapeHTML(p.title)}
      </div>
      <div class="track">
        <div class="bar cat-${p.category} ${isPoint?'point':''}" style="left:${left}%;width:${width}%" data-action="openProject" data-args='["${p.id}"]' title="${escapeAttr(p.title + (p.startDate?' · start '+fmtDateShort(fromKey(p.startDate)):'') + (p.targetDate?' · '+fmtDateShort(fromKey(p.targetDate)):'') + (p.targetEndDate?'–'+fmtDateShort(fromKey(p.targetEndDate)):''))}">${isPoint?'':escapeHTML(p.title)}</div>
      </div>
    </div>`;
  }).filter(Boolean).join('');

  // Months header for Gantt
  const monthsHeaderHTML = months.map(({y,m},i)=>{
    const ts = new Date(y, m, 1).getTime();
    const left = pct(ts);
    const isYearStart = m === 0 || i === 0;
    const label = m === 0 || i === 0 ? `${I18N.monthsShort[m]} ${y}` : I18N.monthsShort[m];
    return `<div class="mtick ${isYearStart?'year-start':''}" style="left:${left}%">${label}</div>`;
  }).join('');

  // Today line
  const todayTs = today.getTime();
  const todayMarker = (todayTs >= rangeStart && todayTs <= rangeEnd)
    ? `<div class="today-line" style="left:${pct(todayTs)}%"></div>` : '';

  // Key upcoming dates — collect from projects (target, milestones) + important task fristene + own events
  const todayKey0 = todayKey();
  const keyItems = [];
  projectsActive().forEach(p=>{
    if (p.targetDate && p.targetDate >= todayKey0){
      keyItems.push({ date:p.targetDate, title:p.title, kind:'★ måldato', projectId:p.id, category:p.category });
    }
    (p.milestones||[]).forEach(m=>{
      if (m.date && m.date >= todayKey0 && !m.done){
        keyItems.push({ date:m.date, title:m.title, kind:'◆ '+escapeHTML(p.title), projectId:p.id, category:p.category });
      }
    });
  });
  state.events.forEach(e=>{
    if (e.date >= todayKey0 && passesFilter(e)){
      keyItems.push({ date:e.date, title:e.title, kind:'📌 hendelse', eventId:e.id, category:e.category });
    }
  });
  keyItems.sort((a,b)=>a.date.localeCompare(b.date));
  const keyTopN = keyItems.slice(0, 12);
  const keyDatesHTML = keyTopN.length ? keyTopN.map(item=>{
    const d = fromKey(item.date);
    const days = daysUntil(item.date);
    const cd = days===0?'i dag':days===1?'i morgen':days+' dager';
    const urgent = days<=14 ? 'urgent' : '';
    const click = item.projectId
      ? act('openProject', item.projectId)
      : item.eventId ? act('editEvent', item.eventId) : '';
    return `<div class="kd" ${click}>
      <div class="kdate">${I18N.monthsShort[d.getMonth()]} <strong>${d.getDate()}</strong></div>
      <div class="ktitle">${escapeHTML(item.title)}<span class="meta">${item.kind}</span></div>
      <div class="kcountdown ${urgent}">om ${cd}</div>
    </div>`;
  }).join('') : `<div class="empty-state">Ingen kommende nøkkeldatoer</div>`;

  viewEl.innerHTML = `
    <div class="subnav">
      <button class="today-btn" data-action="overviewToday">${I18N.today}</button>
      <h2>Årsoversikt <span class="yr">${titleStr}</span></h2>
      <div class="arrows">
        <button id="ov-prev" title="12 måneder bakover">‹</button>
        <button id="ov-next" title="12 måneder fremover">›</button>
      </div>
    </div>

    <div class="ov-section">
      <h3>Prosjekttidslinje</h3>
      <div class="gantt">
        <div class="gantt-scroll">
          <div class="gantt-inner">
            <div class="gantt-headrow">
              <div class="label-col">Prosjekt</div>
              <div class="gantt-months">${monthsHeaderHTML}${todayMarker}</div>
            </div>
            ${ganttRowsHTML || `<div style="padding:24px;text-align:center;color:var(--ink-muted);font-style:italic">Ingen prosjekter med datoer enda</div>`}
          </div>
        </div>
      </div>
    </div>

    <div class="ov-section">
      <h3>Kommende nøkkeldatoer</h3>
      <div class="keydates">${keyDatesHTML}</div>
    </div>`;

  document.getElementById('ov-prev').onclick = ()=>{ state.ui.overviewAnchor = dKey(addMonths(anchor,-12)); render(); };
  document.getElementById('ov-next').onclick = ()=>{ state.ui.overviewAnchor = dKey(addMonths(anchor,12)); render(); };
}
HANDLERS.overviewToday = ()=>{ state.ui.overviewAnchor=''; render(); };

// ============================================================
// VIEW: MONTH
// ============================================================
function renderMonth(){
  const anchor = fromKey(state.ui.anchor||todayKey());
  const y = anchor.getFullYear(), m = anchor.getMonth();
  const today = new Date();

  viewEl.innerHTML = `
    <div class="subnav">
      <button class="today-btn" data-action="goToday">${I18N.today}</button>
      <h2>${fmtMonth(y,m)}</h2>
      <div class="arrows"><button id="prev">‹</button><button id="next">›</button></div>
    </div>
    <div class="month-grid">
      <div class="row head">${I18N.weekdaysShort.map(w=>`<div class="cell">${w}</div>`).join('')}</div>
      <div id="mgrid"></div>
    </div>`;

  document.getElementById('prev').onclick = ()=>{ state.ui.anchor = dKey(addMonths(anchor,-1)); render(); };
  document.getElementById('next').onclick = ()=>{ state.ui.anchor = dKey(addMonths(anchor,1)); render(); };
  setupSwipeNavigation(document.querySelector('.month-grid'),
    ()=>{ state.ui.anchor = dKey(addMonths(anchor, 1)); render(); },
    ()=>{ state.ui.anchor = dKey(addMonths(anchor, -1)); render(); }
  );

  const grid = document.getElementById('mgrid');
  const first = new Date(y,m,1);
  const offset = monIdx(first);
  const days = monthDays(y,m);
  const totalCells = Math.ceil((offset+days)/7)*7;
  let html = '<div class="row">';
  for (let i=0;i<totalCells;i++){
    if (i>0 && i%7===0) html += '</div><div class="row">';
    const d = new Date(y,m,i-offset+1);
    const key = dKey(d);
    const inMonth = d.getMonth()===m;
    const dayEvents = eventsOnDay(key);
    const tks = tasksOnDay(key);
    const isToday = sameDay(d, today);
    const hol = HOLIDAYS[key];
    // A multi-day run can't be one unbroken bar across two week-rows — the cells live in
    // different .row grids. Instead each row gets its own labelled segment: the Monday
    // piece re-shows the title with a «↳», the Sunday piece ends flush with a «›».
    // See ADR 0027 (amends 0014).
    const rowStart = (i % 7) === 0;
    const rowEnd = (i % 7) === 6;
    const evHTML = dayEvents.slice(0,3).map(e=>{
      const multi = e._isMultiDay ? ' multi' : '';
      const cont = e._isContinuation ? ' multi-cont' : '';
      const last = e._isMultiDay && e._isLastDay ? ' multi-last' : '';
      const rs = (e._isMultiDay && e._isContinuation && rowStart) ? ' multi-rowstart' : '';
      const re = (e._isMultiDay && !e._isLastDay && rowEnd) ? ' multi-rowend' : '';
      const isProj = e._kind === 'project';
      const cls = `ev cat-${e.category||'arbeid'}${e._ics?' ics':''}${isProj?' projevt':''}${multi}${cont}${last}${rs}${re}`;
      const click = e._ics
        ? act('openOutlookEvent', e.id) + ' data-stop="1"'
        : isProj
          ? act('openProject', e._projectId) + ' data-stop="1"'
          : '';
      // Continuation cells get a non-breaking-space placeholder so the visual bar keeps
      // height; the title attribute still shows the full name on hover. Exception: the
      // first cell of a week-row re-labels the segment, otherwise a run crossing Sunday
      // leaves a nameless grey bar on the next row (ADR 0027).
      const inner = (e._isContinuation && !rowStart)
        ? '&nbsp;'
        : e._isContinuation
          ? `↳ ${escapeHTML(e.title)}`
          : `${isProj ? '📍 ' : ''}${e.start ? `<strong>${e.start}</strong> ` : ''}${escapeHTML(e.title)}`;
      return `<div class="${cls}" title="${escapeAttr(e.title)}" ${click}>${inner}</div>`;
    }).join('');
    const taskHTML = tks.slice(0,Math.max(0,4-dayEvents.length)).map(t=>{
      const isProj = t._kind==='projectTask' || t._kind==='milestone';
      const multi = t._isMultiDay ? ' multi' : '';
      const cont = t._isContinuation ? ' multi-cont' : '';
      const last = t._isMultiDay && t._isLastDay ? ' multi-last' : '';
      const rs = (t._isMultiDay && t._isContinuation && rowStart) ? ' multi-rowstart' : '';
      const re = (t._isMultiDay && !t._isLastDay && rowEnd) ? ' multi-rowend' : '';
      const cls = `ev cat-${t.category}${isProj?' proj':''}${multi}${cont}${last}${rs}${re}`;
      const label = isProj ? `${escapeHTML(t._projectTitle)}: ${escapeHTML(t.title)}` : `☐ ${escapeHTML(t.title)}`;
      const inner = (t._isContinuation && !rowStart) ? '&nbsp;' : (t._isContinuation ? `↳ ${label}` : label);
      return `<div class="${cls}" title="${escapeAttr(label)}">${inner}</div>`;
    }).join('');
    const more = (dayEvents.length+tks.length)-4;
    html += `<div class="cell ${inMonth?'':'other'} ${isToday?'today':''}" data-key="${key}">
      <div class="num">${d.getDate()}${hol?`<span class="holiday-tag">${escapeHTML(hol)}</span>`:''}</div>
      ${evHTML}${taskHTML}
      ${more>0?`<div class="more">+ ${more} til</div>`:''}
    </div>`;
  }
  html += '</div>';
  grid.innerHTML = html;
  grid.querySelectorAll('.cell').forEach(c=>c.onclick=()=>{ state.ui.anchor = c.dataset.key; state.ui.view='day'; render(); });
}

function goToday(){ state.ui.anchor = todayKey(); render(); }

// ============================================================
// VIEW: WEEK
// ============================================================
function renderWeek(){
  const anchor = fromKey(state.ui.anchor||todayKey());
  const wk = startOfWeek(anchor);
  const days = [...Array(7)].map((_,i)=>addDays(wk,i));
  const today = new Date();
  const wn = isoWeek(wk);

  viewEl.innerHTML = `
    <div class="subnav">
      <button class="today-btn" data-action="goToday">${I18N.today}</button>
      <h2>Uke ${wn} <span class="yr">${fmtDateShort(wk)} – ${fmtDateShort(addDays(wk,6))} ${wk.getFullYear()}</span></h2>
      <div class="arrows"><button id="prev">‹</button><button id="next">›</button></div>
    </div>
    <div class="week" id="weekgrid"></div>`;

  document.getElementById('prev').onclick = ()=>{ state.ui.anchor = dKey(addDays(wk,-7)); render(); };
  document.getElementById('next').onclick = ()=>{ state.ui.anchor = dKey(addDays(wk,7)); render(); };
  setupSwipeNavigation(document.getElementById('weekgrid'),
    ()=>{ state.ui.anchor = dKey(addDays(wk, 7)); render(); },
    ()=>{ state.ui.anchor = dKey(addDays(wk, -7)); render(); }
  );

  const wg = document.getElementById('weekgrid');
  let html = `<div class="wh"></div>` + days.map(d=>{
    const cls = sameDay(d,today)?'today':'';
    const hol = HOLIDAYS[dKey(d)];
    return `<div class="wh ${cls}">${I18N.weekdaysShort[monIdx(d)]} <strong>${d.getDate()}</strong>${hol?`<div style="font-size:9px;color:var(--alert)">${escapeHTML(hol)}</div>`:''}</div>`;
  }).join('');

  const startHour = 7, endHour = 22;
  // Hentet ut av time-loopen: dette sto inne i `for (h) { days.forEach(...) }` og kalte
  // altså eventsOnDay 16 × 7 = 112 ganger per tegning, 16 av dem med identisk nøkkel.
  // Hvert kall fullskanner outlookEvents (627 og voksende), state.events og projects.
  // renderDay gjorde det riktig hele tiden — regner én gang, filtrerer per time. ADR 0031.
  const evsByKey = new Map(days.map(d=>[dKey(d), eventsOnDay(dKey(d))]));
  for (let h=startHour; h<=endHour; h++){
    html += `<div class="hour-label">${pad(h)}:00</div>`;
    days.forEach(d=>{
      const key = dKey(d);
      const isWeekend = d.getDay()===0||d.getDay()===6;
      const evs = (evsByKey.get(key)||[]).filter(e=>{
        if(!e.start) return h===startHour; // events without time appear at top
        const eh = parseInt(e.start.split(':')[0]);
        return eh===h;
      });
      const evHTML = evs.map(e=>{
        const multi = e._isMultiDay ? ' multi' : '';
        const cont = e._isContinuation ? ' multi-cont' : '';
        const last = e._isMultiDay && e._isLastDay ? ' multi-last' : '';
        const isProj = e._kind === 'project';
        const cls = `ev cat-${e.category||'arbeid'}${e._ics?' ics':''}${isProj?' projevt':''}${multi}${cont}${last}`;
        // These used to be raw JS expressions interpolated as a bare attribute — no
        // onclick=, no data-action — so the DOM got a junk attribute named
        // "handlers.editevent('id')" and the click fell through to the .slot handler,
        // opening an EMPTY «Ny hendelse». Use act() like Dag and Måned do (ADR 0012).
        const click = e._ics
          ? act('openOutlookEvent', e.id)
          : isProj
            ? act('openProject', e._projectId)
            : act('editEvent', e.id);
        const style = evDurationStyle(e, 42);
        const prefix = (!e._isContinuation && isProj) ? '📍 ' : '';
        const timeP = (!e._isContinuation && e.start) ? `<strong>${e.start}${e.end?'–'+e.end:''}</strong> ` : '';
        return `<div class="${cls}" data-id="${e.id}" ${click} data-stop="1" style="${style}">${prefix}${timeP}${escapeHTML(e.title)}</div>`;
      }).join('');
      html += `<div class="slot ${isWeekend?'weekend':''}" data-key="${key}" data-hour="${h}">${evHTML}</div>`;
    });
  }
  wg.innerHTML = html;
  wg.querySelectorAll('.slot').forEach(s=>{
    s.onclick = ()=> openEventForm(null, { date: s.dataset.key, start: pad(s.dataset.hour)+':00' });
  });
  wg.querySelectorAll('.wh').forEach((h,i)=>{
    if(i>0) h.onclick = ()=>{ state.ui.anchor = dKey(days[i-1]); state.ui.view='day'; render(); };
  });
}

// ============================================================
// VIEW: DAY
// ============================================================
// "I dag"-dashboard. Shown above the hour grid only when viewing today.
function renderDay(){
  const anchor = fromKey(state.ui.anchor||todayKey());
  const key = dKey(anchor);
  const today = new Date();
  const evs = eventsOnDay(key);
  const tks = tasksOnDay(key);
  const hol = HOLIDAYS[key];
  const note = state.notes[key]||'';
  const isToday = sameDay(anchor, today);

  viewEl.innerHTML = `
    <div class="subnav">
      <button class="today-btn" data-action="goToday">${I18N.today}</button>
      <h2>${I18N.weekdaysLong[monIdx(anchor)]} ${anchor.getDate()}. ${I18N.months[anchor.getMonth()]} <span class="yr">${anchor.getFullYear()}${hol?' · '+hol:''}</span></h2>
      <div class="arrows"><button id="prev">‹</button><button id="next">›</button></div>
    </div>
    <div class="day-layout">
      <div class="day-main">
        <div class="day-hours" id="dhours"></div>
      </div>
      <div class="day-side">
        <div class="panel tasks-block">
          <h4>Oppgaver i dag <button class="add-link" data-action="openTaskFormWithDate" data-args='["${key}"]' style="float:right;font-size:12px;color:var(--ink-soft)">+ Ny</button></h4>
          ${tks.length?`<ul>${tks.map(t=>taskRowHTML(t)).join('')}</ul>`:`<div class="empty-state">${I18N.noTasks}${emptyAction('+ Ny oppgave', act('openTaskFormWithDate', key))}</div>`}
        </div>
        <div class="panel">
          <h4>Notater</h4>
          <textarea class="notes-area" id="day-notes" placeholder="Refleksjoner, ideer, møtepunkter…">${escapeHTML(note)}</textarea>
        </div>
      </div>
    </div>`;

  document.getElementById('prev').onclick = ()=>{ state.ui.anchor = dKey(addDays(anchor,-1)); render(); };
  document.getElementById('next').onclick = ()=>{ state.ui.anchor = dKey(addDays(anchor,1)); render(); };
  // Swipe to navigate between days on touch
  setupSwipeNavigation(document.querySelector('.day-layout'),
    ()=>{ state.ui.anchor = dKey(addDays(anchor, 1)); render(); },
    ()=>{ state.ui.anchor = dKey(addDays(anchor, -1)); render(); }
  );

  const dh = document.getElementById('dhours');
  const sH=6, eH=23;
  let html='';
  for (let h=sH;h<=eH;h++){
    html += `<div class="hl">${pad(h)}:00</div>`;
    const inSlot = evs.filter(e=>e.start && parseInt(e.start.split(':')[0])===h);
    const evHTML = inSlot.map(e=>{
      const multi = e._isMultiDay ? ' multi' : '';
      const cont = e._isContinuation ? ' multi-cont' : '';
      const last = e._isMultiDay && e._isLastDay ? ' multi-last' : '';
      const cls = `ev cat-${e.category||'arbeid'}${e._ics?' ics':''}${multi}${cont}${last}`;
      const click = e._ics ? act('openOutlookEvent', e.id) : act('editEvent', e.id);
      const tail = e._ics ? (e.location?` <span class="text-mute-small">${escapeHTML(e.location.slice(0,30))}</span>`:'') : (e.notes?` <span class="text-mute-small">${escapeHTML(e.notes.slice(0,40))}</span>`:'');
      const style = evDurationStyle(e, 48);
      return `<div class="${cls}" ${click} data-stop="1" style="${style}"><strong>${e.start}${e.end?'–'+e.end:''}</strong> ${escapeHTML(e.title)}${tail}</div>`;
    }).join('');
    // Time-blocked tasks at this hour
    const tasksAtHour = tks.filter(t=>t.scheduledTime && parseInt(t.scheduledTime.split(':')[0])===h && (t._kind==='task' || t._kind==='projectTask') && !t.done);
    const taskHTML = tasksAtHour.map(t=>{
      const click = t._kind==='projectTask'
        ? act('openProjectTaskForm', t._projectId, t.id)
        : act('openTaskForm', t.id);
      const clearAttrs = t._kind==='projectTask'
        ? act('clearScheduledTime', 'projectTask', t._projectId, t.id)
        : act('clearScheduledTime', 'task', '', t.id);
      const minOff = parseInt((t.scheduledTime||'0:0').split(':')[1])||0;
      const top = (minOff/60)*48;
      return `<div class="ev cat-${t.category||'arbeid'} task-block" ${click} data-stop="1" style="top:${top}px;height:42px" title="Tidsblokk · ${escapeAttr(t.title)}">
        <strong>${t.scheduledTime}</strong> ${escapeHTML(t.title)}
        <span style="float:right;cursor:pointer;color:var(--ink-muted);padding:0 4px" ${clearAttrs} data-stop="1" title="Fjern tidsblokk">×</span>
      </div>`;
    }).join('');
    html += `<div class="hslot" data-hour="${h}" ondragover="HANDLERS.taskToTimeOver(event)" ondragleave="HANDLERS.taskToTimeLeave(event)" ondrop="HANDLERS.taskToTimeDrop(event,${h},'${key}')">${evHTML}${taskHTML}</div>`;
  }
  // events without time at top
  const allDay = evs.filter(e=>!e.start);
  if (allDay.length){
    const ad = allDay.map(e=>{
      const multi = e._isMultiDay ? ' multi' : '';
      const cont = e._isContinuation ? ' multi-cont' : '';
      const last = e._isMultiDay && e._isLastDay ? ' multi-last' : '';
      const isProj = e._kind === 'project';
      const cls = `ev cat-${e.category||'arbeid'}${e._ics?' ics':''}${isProj?' projevt':''}${multi}${cont}${last}`;
      const click = e._ics
        ? act('openOutlookEvent', e.id)
        : isProj
          ? act('openProject', e._projectId)
          : act('editEvent', e.id);
      const icon = e._isContinuation ? '' : (e._ics?'📧 ':(isProj?'📍 ':'📌 '));
      return `<div class="${cls}" ${click}>${icon}${escapeHTML(e.title)}</div>`;
    }).join('');
    dh.innerHTML = `<div class="hl">hele</div><div class="hslot" style="min-height:auto;padding:6px">${ad}</div>` + html;
  } else dh.innerHTML = html;

  dh.querySelectorAll('.hslot').forEach(s=>{
    s.onclick = ()=>{
      const h = s.dataset.hour;
      openEventForm(null, { date: key, start: h?pad(h)+':00':'' });
    };
  });

  // Save on input (debounced) as well as blur. Blur alone lost the text whenever a
  // background sync pull called render() — removing a focused element from the DOM
  // fires no blur event. See ADR 0023.
  const dayNotes = document.getElementById('day-notes');
  if (dayNotes){
    let _dnTimer = null;
    const commitDayNote = ()=>{
      const v = dayNotes.value.trim();
      if (!state.notes) state.notes = {};
      if (v) state.notes[key]=v; else delete state.notes[key];
      saveState();
    };
    // Throttle, not debounce: a debounce that restarts on every keystroke never
    // commits while you type continuously, which is exactly the case that lost text.
    dayNotes.addEventListener('input', ()=>{
      if (_dnTimer) return;
      _dnTimer = setTimeout(()=>{ _dnTimer = null; commitDayNote(); }, 400);
    });
    dayNotes.addEventListener('blur', commitDayNote);
  }
}

function taskRowHTML(t){
  // Time slot: scheduled = clickable to change, unscheduled = subtle "+ tid"-link
  const timeLink = (idStr, kind) => t.scheduledTime
    ? `<span style="color:var(--accent);cursor:pointer;font-size:12px" data-action="setTaskScheduledTime" data-args='["${idStr}","${kind}"]' data-stop="1" title="Klikk for å endre tid">🕒 ${t.scheduledTime}</span>`
    : `<span style="color:var(--ink-muted);cursor:pointer;font-size:11px;font-style:italic" data-action="setTaskScheduledTime" data-args='["${idStr}","${kind}"]' data-stop="1" title="Sett tidspunkt">+ tid</span>`;
  if (t._kind==='projectTask'){
    return `<li class="${t.done?'done':''}" draggable="true" ondragstart="HANDLERS.taskToTimeStart(event,'${t._projectId}:${t.id}','projectTask')">
      <input type="checkbox" ${t.done?'checked':''} onchange="HANDLERS.toggleProjectTask('${t._projectId}','${t.id}',event)">
      <span class="tt" data-action="openProjectTaskForm" data-args='["${t._projectId}","${t.id}"]'>${escapeHTML(t.title)} <span class="text-mute-small">· ${escapeHTML(t._projectTitle)}</span></span>
      ${timeLink(`${t._projectId}:${t.id}`, 'projectTask')}
    </li>`;
  }
  if (t._kind==='milestone'){
    return `<li class="${t.done?'done':''}">
      <input type="checkbox" ${t.done?'checked':''} onchange="HANDLERS.toggleProjectMilestone('${t._projectId}','${t.id}')">
      <span class="tt" data-action="openProject" data-args='["${t._projectId}"]'>◆ ${escapeHTML(t.title)} <span class="text-mute-small">· ${escapeHTML(t._projectTitle)}</span></span>
      <span class="due">${t.category?CAT_BY_ID[t.category]?.label||'':''}</span>
    </li>`;
  }
  const prioPill = t.priority ? `<span class="pill prio-${t.priority}" style="margin-right:4px">${PRIO_BY_ID[t.priority]?.short||t.priority}</span>` : '';
  const proj = t.projectId ? state.projects.find(p=>p.id===t.projectId) : null;
  const projTag = projChipHTML(proj ? proj.title : '');
  return `<li class="${t.done?'done':''}" draggable="true" ondragstart="HANDLERS.taskToTimeStart(event,'${t.id}','task')">
    <input type="checkbox" ${t.done?'checked':''} onchange="HANDLERS.toggleTask('${t.id}',event)">
    <span class="tt" data-action="openTaskForm" data-args='["${t.id}"]'>${prioPill}${escapeHTML(t.title)}${projTag}</span>
    ${timeLink(t.id, 'task')}
  </li>`;
}

// Drag from side panel task → drop on hour slot to time-block it
HANDLERS.taskToTimeStart = (e, id, kind)=>{
  e.dataTransfer.setData('application/json', JSON.stringify({id, kind}));
  e.dataTransfer.effectAllowed = 'move';
};
HANDLERS.taskToTimeOver = (e)=>{
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drop-target');
};
HANDLERS.taskToTimeLeave = (e)=>{ e.currentTarget.classList.remove('drop-target'); };
HANDLERS.taskToTimeDrop = (e, h, key)=>{
  e.preventDefault();
  e.currentTarget.classList.remove('drop-target');
  try {
    const data = JSON.parse(e.dataTransfer.getData('application/json'));
    const time = pad(h) + ':00';
    if (data.kind === 'task'){
      const t = state.tasks.find(x=>x.id===data.id);
      if (t){ t.scheduledTime = time; if (!t.due) t.due = key; render(); }
    } else if (data.kind === 'projectTask'){
      const [pid, tid] = data.id.split(':');
      const p = state.projects.find(x=>x.id===pid);
      const t = p?.tasks.find(x=>x.id===tid);
      if (t){ t.scheduledTime = time; if (!t.due) t.due = key; render(); }
    }
  } catch(_){}
};
// Tap-to-set time (iPhone-friendly alternative to drag-drop)
HANDLERS.setTaskScheduledTime = (idStr, kind)=>{
  let t;
  if (kind === 'projectTask'){
    const [pid, tid] = idStr.split(':');
    const p = state.projects.find(x=>x.id===pid);
    t = p?.tasks.find(x=>x.id===tid);
  } else {
    t = state.tasks.find(x=>x.id===idStr);
  }
  if (!t) return;
  const time = prompt('Tidspunkt for tidsblokk (HH:MM, f.eks. 14:00).\nLa stå tom for å fjerne.', t.scheduledTime || '');
  if (time === null) return;
  if (!time.trim()){
    delete t.scheduledTime;
  } else {
    const m = time.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m){ alert('Ugyldig format. Bruk HH:MM (f.eks. 14:00).'); return; }
    const h = parseInt(m[1]), mn = parseInt(m[2]);
    if (h<0||h>23||mn<0||mn>59){ alert('Ugyldig tidspunkt.'); return; }
    t.scheduledTime = pad(h) + ':' + pad(mn);
  }
  saveState(); render();
};

HANDLERS.clearScheduledTime = (kind, pid, tid)=>{
  if (kind === 'task'){
    const t = state.tasks.find(x=>x.id===tid);
    if (t) delete t.scheduledTime;
  } else if (kind === 'projectTask'){
    const p = state.projects.find(x=>x.id===pid);
    const t = p?.tasks.find(x=>x.id===tid);
    if (t) delete t.scheduledTime;
  }
  render();
};
// Animate task completion — adds .completing class to row, waits, then re-renders
function _animateCompletion(ev, callback){
  const row = ev && ev.target && ev.target.closest('.todo-row, li, .ptask, .kcard');
  if (row){
    row.classList.add('completing');
    setTimeout(callback, 380);
  } else {
    callback();
  }
}
HANDLERS.toggleTask = (id, ev) => {
  const t = state.tasks.find(x=>x.id===id);
  if (!t) return;
  // For recurring tasks: completing advances to next instance instead of marking done
  if (!t.done && t.recurring && t.due){
    const cur = fromKey(t.due);
    let next = null;
    // `addMonthsKeepDay`, ikke `addMonths`: den siste snapper til den 1., så en månedlig
    // oppgave med frist den 25. hoppet til den 1. neste måned første gang du krysset den
    // av — og ble liggende der. Tredje og fjerde forekomst av samme feil, funnet av
    // mønster-sveipet i sjekklista rett før push. Se ADR 0025 og 0032.
    if (t.recurring === 'daily') next = addDays(cur, 1);
    else if (t.recurring === 'weekly') next = addDays(cur, 7);
    else if (t.recurring === 'monthly') next = addMonthsKeepDay(cur, 1);
    else if (t.recurring === 'yearly') next = addMonthsKeepDay(cur, 12);
    if (next){
      t.due = dKey(next);
      try { showToast(`✓ "${t.title}" — flyttet til ${fmtDateShort(next)}`); } catch(_){}
      _animateCompletion(ev, ()=>render());
      return;
    }
  }
  if (!t.done){
    _setDone(t, true);
    _animateCompletion(ev, ()=>render());
  } else {
    _setDone(t, false);
    render();
  }
};

// ============================================================
// VIEW: LIST / AGENDA
// ============================================================
// ============================================================
// EVENT FORM
// ============================================================
function openEventForm(id, defaults={}){
  const e = id ? state.events.find(x=>x.id===id) : null;
  const data = e || Object.assign({title:'',date:todayKey(),endDate:'',start:'',end:'',category:'arbeid',notes:''}, defaults);
  openModal(`
    <h3>${e?'Rediger hendelse':'Ny hendelse'}</h3>
    <div class="body">
      <div class="field"><label>Tittel</label><input id="ev-title" type="text" value="${escapeAttr(data.title)}" placeholder="F.eks. styremøte"></div>
      <div class="field"><label>Dato (start)</label><input id="ev-date" type="date" value="${data.date}"></div>
      <div class="field"><label>Sluttdato <span class="text-note">— valgfritt, hvis flere dager</span></label><input id="ev-endDate" type="date" value="${data.endDate||''}"></div>
      <div class="field"><label>Tid (valgfritt)</label><div class="row"><input id="ev-start" type="time" value="${data.start||''}"><input id="ev-end" type="time" value="${data.end||''}"></div></div>
      <div class="field"><label>Gjenta</label><select id="ev-recurring">
        <option value="" ${!data.recurring?'selected':''}>— én gang —</option>
        <option value="daily" ${data.recurring==='daily'?'selected':''}>Hver dag</option>
        <option value="weekly" ${data.recurring==='weekly'?'selected':''}>Hver uke (samme ukedag)</option>
        <option value="monthly" ${data.recurring==='monthly'?'selected':''}>Hver måned (samme dato)</option>
        <option value="yearly" ${data.recurring==='yearly'?'selected':''}>Hvert år (samme dato)</option>
      </select></div>
      <div class="field"><label>Slutt på gjentakelse <span class="text-note">— valgfritt</span></label><input id="ev-recurringUntil" type="date" value="${data.recurringUntil||''}"></div>
      <div class="field"><label>Kategori</label><select id="ev-cat">${CATEGORIES.map(c=>`<option value="${c.id}" ${data.category===c.id?'selected':''}>${c.label}</option>`).join('')}</select></div>
      <div class="field"><label>Notater</label><textarea id="ev-notes" placeholder="Detaljer, lenker, hva som må forberedes…">${escapeHTML(data.notes||'')}</textarea></div>
    </div>
    <div class="footer">
      ${e?`<button class="danger" data-action="deleteEvent" data-args='["${e.id}"]'>${I18N.delete}</button>`:''}
      <button data-action="closeModal">${I18N.cancel}</button>
      <button class="primary" data-action="saveEventForm" data-args='["${e?e.id:''}"]'>${I18N.save}</button>
    </div>`);
  _focusLater('ev-title');
}
HANDLERS.saveEventForm = id=>{
  const endDateRaw = document.getElementById('ev-endDate').value||'';
  const startDate = document.getElementById('ev-date').value;
  const data = {
    title: document.getElementById('ev-title').value.trim(),
    date: startDate,
    endDate: _endDateOr(endDateRaw, startDate, 'startdatoen'),
    start: document.getElementById('ev-start').value||'',
    end: document.getElementById('ev-end').value||'',
    category: document.getElementById('ev-cat').value,
    recurring: document.getElementById('ev-recurring').value||'',
    recurringUntil: document.getElementById('ev-recurringUntil').value||'',
    notes: document.getElementById('ev-notes').value.trim(),
  };
  if (!data.title || !data.date) return;
  if (id){
    const ex = state.events.find(x=>x.id===id);
    // Posten forsvant mellom åpning og lagring — typisk fordi 60-sekunders-pullet
    // erstattet hele state mens dialogen sto åpen. Før lukket dialogen seg helt som
    // ved suksess, så redigeringen var borte uten et ord. ADR 0031.
    if (!ex){ _warnVanished(); closeModal(); render(); return; }
    Object.assign(ex, data);
  }
  else { state.events.push(Object.assign({id:uid()}, data)); }
  closeModal(); render();
};
// Strip recurring instance suffix (e.g., 'abc-r5') to get the master event ID
function _stripRecurId(id){ return id ? id.replace(/-r\d+$/, '') : id; }
HANDLERS.editEvent = id => openEventForm(_stripRecurId(id));
HANDLERS.deleteEvent = id => {
  const baseId = _stripRecurId(id);
  const e = state.events.find(x=>x.id===baseId);
  if (e && e.recurring){
    if (!confirm('Dette er en gjentakende hendelse. Slette ALLE forekomster?')) return;
  }
  if (!deleteWithUndo(()=>state.events, baseId, `«${e ? e.title : 'hendelsen'}»`)) return;
  closeModal(); render();
};

// ============================================================
// TASK FORM
// ============================================================
function openTaskForm(id, defaults={}){
  const t = id ? state.tasks.find(x=>x.id===id) : null;
  const data = t || Object.assign({title:'',due:'',category:'arbeid',priority:'',notes:'',done:false}, defaults);
  // Auto-expand advanced if any advanced field is set
  const hasAdvanced = !!(data.recurring || data.remindBefore || (data.notes||'').trim());
  openModal(`
    <h3>${t?'Rediger oppgave':'Ny oppgave'}</h3>
    <div class="body">
      <div class="field"><label>Hva må gjøres?</label><input id="tk-title" type="text" value="${escapeAttr(data.title)}" placeholder="F.eks. Ringe blomsterleverandør"></div>
      <div class="field"><label>Frist (valgfritt)</label><input id="tk-due" type="date" value="${data.due||''}"></div>
      <div class="field"><label>Prioritet</label><select id="tk-prio">
        <option value="" ${!data.priority?'selected':''}>— ukategorisert —</option>
        <option value="urgent" ${data.priority==='urgent'?'selected':''}>⚠ Urgent</option>
        <option value="short" ${data.priority==='short'?'selected':''}>↗ Short term</option>
        <option value="long" ${data.priority==='long'?'selected':''}>⤳ Long term</option>
      </select></div>
      <div class="field"><label>Kategori</label><select id="tk-cat">${CATEGORIES.map(c=>`<option value="${c.id}" ${data.category===c.id?'selected':''}>${c.label}</option>`).join('')}</select></div>
      <details ${hasAdvanced?'open':''} style="margin-top:4px">
        <summary style="cursor:pointer;font-size:12px;color:var(--ink-soft);padding:4px 0;list-style:none;-webkit-user-select:none">▸ Avansert (gjenta, påminnelse, notater)</summary>
        <div style="display:flex;flex-direction:column;gap:12px;margin-top:8px">
          <div class="field"><label>Gjenta</label><select id="tk-recurring">
            <option value="" ${!data.recurring?'selected':''}>— én gang —</option>
            <option value="daily" ${data.recurring==='daily'?'selected':''}>Hver dag</option>
            <option value="weekly" ${data.recurring==='weekly'?'selected':''}>Hver uke</option>
            <option value="monthly" ${data.recurring==='monthly'?'selected':''}>Hver måned</option>
            <option value="yearly" ${data.recurring==='yearly'?'selected':''}>Hvert år</option>
          </select></div>
          <div class="field"><label>Påminnelse</label><select id="tk-remind">
            <option value="" ${!data.remindBefore?'selected':''}>— ingen —</option>
            <option value="sameday" ${data.remindBefore==='sameday'?'selected':''}>Samme dag (kl 09:00)</option>
            <option value="1day" ${data.remindBefore==='1day'?'selected':''}>1 dag før</option>
            <option value="3days" ${data.remindBefore==='3days'?'selected':''}>3 dager før</option>
            <option value="1week" ${data.remindBefore==='1week'?'selected':''}>1 uke før</option>
          </select></div>
          <div class="field"><label>Notater</label><textarea id="tk-notes">${escapeHTML(data.notes||'')}</textarea></div>
        </div>
      </details>
    </div>
    <div class="footer">
      ${t?`<button class="danger" data-action="deleteTask" data-args='["${t.id}"]'>${I18N.delete}</button>`:''}
      <button data-action="closeModal">${I18N.cancel}</button>
      <button class="primary" data-action="saveTaskForm" data-args='["${t?t.id:''}"]'>${I18N.save}</button>
    </div>`);
  _focusLater('tk-title');
}
HANDLERS.openTaskForm = openTaskForm;
HANDLERS.saveTaskForm = id=>{
  const data = {
    title: document.getElementById('tk-title').value.trim(),
    due: document.getElementById('tk-due').value||'',
    category: document.getElementById('tk-cat').value,
    priority: document.getElementById('tk-prio').value||'',
    remindBefore: document.getElementById('tk-remind').value||'',
    recurring: document.getElementById('tk-recurring').value||'',
    notes: document.getElementById('tk-notes').value.trim(),
  };
  if (!data.title){
    // Dialogen sto åpen og knappen gjorde ingenting, uten å si hvorfor. ADR 0032.
    if (typeof showToast === 'function') showToast('⚠ Tittel må fylles ut før du kan lagre.', 5000);
    return;
  }
  if (id){
    const ex = state.tasks.find(x=>x.id===id);
    // Posten forsvant mellom åpning og lagring — typisk fordi 60-sekunders-pullet
    // erstattet hele state mens dialogen sto åpen. Før lukket dialogen seg helt som
    // ved suksess, så redigeringen var borte uten et ord. ADR 0031.
    if (!ex){ _warnVanished(); closeModal(); render(); return; }
    Object.assign(ex, data);
  } else { state.tasks.push(Object.assign({id:uid(),done:false}, data)); }
  closeModal(); render();
};
HANDLERS.deleteTask = id => {
  const t = (state.tasks||[]).find(x=>x.id===id);
  if (!deleteWithUndo(()=>state.tasks, id, `«${t ? t.title : 'oppgaven'}»`)) return;
  closeModal(); render();
};



// ============================================================
// QUICK CAPTURE
// ============================================================
function openQuickCapture(){
  const projectsList = state.projects.filter(p=>!p.archived).map(p=>`<option value="${p.id}">${escapeHTML(p.title)}</option>`).join('');
  openModal(`
    <h3>Hurtignotat / Ny To Do</h3>
    <div class="body">
      <div class="field"><label>Hva må gjøres?</label><input id="qc-text" type="text" placeholder="Skriv raskt – velg destinasjon under"></div>
      <div class="field">
        <label>Velg destinasjon</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button data-action="qcSave" data-args='["inbox"]' class="btn-sec-lg">→ Innboks</button>
          <button data-action="qcSave" data-args='["urgent"]' style="padding:8px 14px;font-size:13px;border-radius:6px;border:1px solid #e6b8b8;background:#fce8e8;color:#883333">⚠ Urgent</button>
          <button data-action="qcSave" data-args='["short"]' style="padding:8px 14px;font-size:13px;border-radius:6px;border:1px solid #dfc99a;background:#fbf1e1;color:#7a5a30">↗ Short term</button>
          <button data-action="qcSave" data-args='["long"]' style="padding:8px 14px;font-size:13px;border-radius:6px;border:1px solid #bcc7d8;background:#e8eef7;color:#3a4a66">⤳ Long term</button>
          <button data-action="qcSave" data-args='["event"]' class="btn-sec-lg">📅 Ny hendelse</button>
          <button data-action="closeModalThenVoice" class="btn-sec-lg" title="Snakk inn et notat">🎤 Tale</button>
        </div>
        <select id="qc-project" onchange="if(this.value){HANDLERS.qcSave('project',this.value);this.value=''}" style="margin-top:6px;padding:8px 10px;border:1px solid var(--line);border-radius:6px;font-size:13px;background:#fff;color:var(--ink-soft)">
          <option value="">▸ Eller legg som oppgave i prosjekt…</option>${projectsList}
        </select>
      </div>
      <div class="text-muted-sm">Trykk Enter for innboks (default) · klikk knapp eller velg prosjekt</div>
    </div>
    <div class="footer">
      <button data-action="switchView" data-args='["todos"]'>Se alle To Do's →</button>
      <button data-action="closeModal">${I18N.cancel}</button>
    </div>`);
  _focusLater('qc-text');
  document.getElementById('qc-text').addEventListener('keydown', e=>{
    if(e.key==='Enter'){ e.preventDefault(); HANDLERS.qcSave('inbox'); }
  });
}
HANDLERS.qcSave = (kind, projectId)=>{
  const text = document.getElementById('qc-text').value.trim();
  if (!text) return;
  if (kind==='event'){ closeModal(); openEventForm(null,{title:text}); return; }
  if (kind==='project' && projectId){
    const p = state.projects.find(x=>x.id===projectId);
    if (p) p.tasks.push({id:uid(),title:text,due:'',endDate:'',notes:'',done:false});
  } else if (kind==='inbox'){
    state.inbox.push({id:uid(),text,createdAt:new Date().toISOString()});
  } else {
    state.tasks.push({id:uid(),title:text,category:'arbeid',priority:kind,done:false,due:''});
  }
  closeModal(); render();
};
HANDLERS.deleteInbox = id => {
  const i = (state.inbox||[]).find(x=>x.id===id);
  if (!deleteWithUndo(()=>state.inbox, id, `«${i ? i.text : 'innboks-elementet'}»`)) return;
  render();
};

// ============================================================
// "MER" menu (mobile-only secondary nav)
// ============================================================
function openMoreMenu(){
  const items = [
    {v:'day', label:I18N.views.day, icon:'📅'},
    {v:'week', label:I18N.views.week, icon:'🗓'},
    {v:'month', label:I18N.views.month, icon:'📆'},
    {v:'overview', label:I18N.views.overview, icon:'🧭'}
  ];
  const buttons = items.map(it=>
    `<button data-action="switchView" data-args='["${it.v}"]' style="display:flex;align-items:center;gap:14px;padding:16px 18px;font-size:16px;background:${state.ui.view===it.v?'var(--surface-2)':'transparent'};border:none;border-radius:12px;color:var(--ink);width:100%;text-align:left;${state.ui.view===it.v?'font-weight:600;':''}">
      <span style="font-size:20px">${it.icon}</span>
      <span>${it.label}</span>
    </button>`
  ).join('');
  openModal(`
    <h3>Andre visninger</h3>
    <div class="body" style="gap:4px">
      ${buttons}
    </div>
    <div class="footer">
      <button data-action="closeModal">${I18N.cancel}</button>
    </div>`);
}

// ============================================================
// SEARCH
// ============================================================
function openSearch(){
  const sel = 'padding:6px 10px;border:1px solid var(--line);border-radius:6px;font-size:12.5px;background:#fff;color:var(--ink-soft)';
  openModal(`
    <h3>Søk</h3>
    <div class="body">
      <div class="field"><input id="search-input" type="text" placeholder="Søk i hendelser, oppgaver, prosjekter, personer, notater…" autofocus></div>
      <div class="field" style="display:flex;gap:6px;flex-wrap:wrap;font-size:12px">
        <select id="search-type" style="${sel}">
          <option value="all">Alle typer</option>
          <option value="event">Hendelser</option>
          <option value="outlook">Outlook-events</option>
          <option value="task">Frittstående oppgaver</option>
          <option value="projectTask">Prosjekt-oppgaver</option>
          <option value="project">Prosjekter</option>
          <option value="note">Notater</option>
        </select>
        <select id="search-cat" style="${sel}">
          <option value="all">Alle kategorier</option>
          <option value="arbeid">Jobb</option>
          <option value="privat">Privat</option>
        </select>
        <select id="search-when" style="${sel}">
          <option value="all">Alle datoer</option>
          <option value="upcoming">Kommende (fra i dag)</option>
          <option value="past">Fortid</option>
          <option value="thisweek">Denne uka</option>
          <option value="thismonth">Denne måneden</option>
          <option value="next30">Neste 30 dager</option>
        </select>
        <select id="search-status" style="${sel}">
          <option value="all">Alle statuser</option>
          <option value="open">Ufullført</option>
          <option value="done">Fullført</option>
        </select>
      </div>
      <div class="search-results" id="search-results"><div class="empty">Begynn å skrive eller bruk filtrene… <span style="white-space:nowrap">↑↓ velger, Enter åpner</span></div></div>
    </div>
    <div class="footer"><button data-action="closeModal">Lukk</button></div>`);
  _focusLater('search-input');
  const trigger = ()=>{
    doSearch({
      q: document.getElementById('search-input').value,
      type: document.getElementById('search-type').value,
      cat: document.getElementById('search-cat').value,
      when: document.getElementById('search-when').value,
      status: document.getElementById('search-status').value,
    });
  };
  document.getElementById('search-input').addEventListener('input', trigger);
  document.getElementById('search-type').addEventListener('change', trigger);
  document.getElementById('search-cat').addEventListener('change', trigger);
  document.getElementById('search-when').addEventListener('change', trigger);
  document.getElementById('search-status').addEventListener('change', trigger);
}
function doSearch(filt){
  const res = document.getElementById('search-results');
  const q = (filt.q||'').trim().toLowerCase();
  const today = todayKey();
  // Compute date range from "when" filter
  let dateMin = '0000-00-00', dateMax = '9999-12-31';
  if (filt.when === 'upcoming') dateMin = today;
  else if (filt.when === 'past') dateMax = today;
  else if (filt.when === 'thisweek'){
    const ws = startOfWeek(new Date());
    dateMin = dKey(ws); dateMax = dKey(addDays(ws, 6));
  } else if (filt.when === 'thismonth'){
    const t = new Date();
    dateMin = `${t.getFullYear()}-${pad(t.getMonth()+1)}-01`;
    dateMax = `${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(monthDays(t.getFullYear(), t.getMonth()))}`;
  } else if (filt.when === 'next30'){
    dateMin = today; dateMax = dKey(addDays(new Date(), 30));
  }
  const matchesText = text => !q || (text||'').toLowerCase().includes(q);
  const inDateRange = d => !d ? filt.when === 'all' : (d >= dateMin && d <= dateMax);
  const matchesCat = c => filt.cat === 'all' || (c||'arbeid') === filt.cat;
  const includeType = t => filt.type === 'all' || filt.type === t;
  const matchesStatus = done => filt.status === 'all' || (filt.status === 'open' ? !done : !!done);

  const hits = [];
  if (includeType('event')) state.events.forEach(e=>{
    if (!matchesText(e.title+' '+(e.notes||''))) return;
    if (!inDateRange(e.date)) return;
    if (!matchesCat(e.category)) return;
    hits.push({type:'event',ref:e,date:e.date,title:e.title,sub:`Hendelse · ${fmtDateShort(fromKey(e.date))}${e.start?' · '+e.start:''}`});
  });
  if (includeType('outlook')) (state.outlookEvents||[]).forEach(e=>{
    if (!matchesText(e.title+' '+(e.location||'')+' '+(e.description||''))) return;
    if (!inDateRange(e.date)) return;
    hits.push({type:'outlook',ref:e,date:e.date,title:e.title,sub:`📧 Outlook · ${fmtDateShort(fromKey(e.date))}${e.start?' · '+e.start:''}${e.location?' · '+e.location:''}`});
  });
  if (includeType('task')) state.tasks.forEach(t=>{
    if (!matchesText(t.title+' '+(t.notes||''))) return;
    if (t.due && !inDateRange(t.due)) return;
    if (!matchesCat(t.category)) return;
    if (!matchesStatus(t.done)) return;
    hits.push({type:'task',ref:t,date:t.due||'',title:t.title,sub:`Oppgave${t.due?' · '+fmtDateShort(fromKey(t.due)):''}${t.priority?' · '+t.priority:''}${t.done?' · fullført':''}`});
  });
  state.projects.forEach(p=>{
    if (!matchesCat(p.category)) return;
    if (includeType('project')){
      const allNotes = (p.noteList||[]).map(n=>n.title+' '+(n.content||'').replace(/<[^>]+>/g,' ')).join(' ');
      if (matchesText(p.title+' '+(p.description||'')+' '+(p.notes||'')+' '+allNotes)){
        if (!p.targetDate || inDateRange(p.targetDate)){
          hits.push({type:'project',ref:p,date:p.targetDate||'',title:p.title,sub:`Prosjekt${p.targetDate?' · '+fmtDateShort(fromKey(p.targetDate)):''}${p.archived?' · arkivert':''}`});
        }
      }
    }
    if (includeType('projectTask')){
      (p.tasks||[]).forEach(t=>{
        if (!matchesText(t.title+' '+(t.notes||''))) return;
        if (t.due && !inDateRange(t.due)) return;
        if (!matchesStatus(t.done)) return;
        hits.push({type:'projectTask',ref:t,project:p,date:t.due||'',title:t.title,sub:`▸ ${p.title}${t.due?' · '+fmtDateShort(fromKey(t.due)):''}${t.done?' · fullført':''}`});
      });
    }
    if (filt.type === 'all' || filt.type === 'projectTask'){
      (p.milestones||[]).forEach(m=>{
        if (!matchesText(m.title)) return;
        if (m.date && !inDateRange(m.date)) return;
        if (!matchesStatus(m.done)) return;
        hits.push({type:'milestone',ref:m,project:p,date:m.date||'',title:m.title,sub:`◆ Delmål · ${p.title}${m.date?' · '+fmtDateShort(fromKey(m.date)):''}${m.done?' · nådd':''}`});
      });
    }
    if (includeType('person')){
      (p.people||[]).forEach(pp=>{
        if (!matchesText(pp.name+' '+(pp.role||''))) return;
        hits.push({type:'person',ref:pp,project:p,date:'',title:pp.name,sub:`Person · ${p.title}${pp.role?' · '+pp.role:''}`});
      });
    }
  });
  if (includeType('note')) Object.entries(state.notes||{}).forEach(([k,n])=>{
    if (!matchesText(n)) return;
    if (!inDateRange(k)) return;
    hits.push({type:'note',date:k,title:`Notat fra ${fmtDateShort(fromKey(k))}`,sub: n.slice(0,80)+(n.length>80?'…':'')});
  });
  if (!hits.length){
    const hasFilter = q || filt.type!=='all' || filt.cat!=='all' || filt.when!=='all' || filt.status!=='all';
    res.innerHTML = `<div class="empty">${hasFilter?'Ingen treff':'Begynn å skrive eller bruk filtrene…'}</div>`;
    return;
  }
  res.innerHTML = `<div class="empty" style="text-align:left;font-style:normal;font-size:11.5px;color:var(--ink-muted);padding:6px 10px">${hits.length} treff${hits.length>40?' (viser 40)':''}</div>`+hits.slice(0,40).map((h,i)=>`<div class="sr" data-i="${i}"><strong>${escapeHTML(h.title)}</strong><div class="meta">${escapeHTML(h.sub)}</div></div>`).join('');
  // Én vei inn til «åpne dette treffet», brukt av både klikk og Enter. ADR 0038.
  _searchHits = hits.slice(0, 40);
  _searchIndex = -1;
  res.querySelectorAll('.sr').forEach((el,i)=>el.onclick=()=>{ closeModal(); _searchOpenHit(hits[i]); });
}

function _searchOpenHit(h){
  if (!h) return;
  if (h.type==='event'){ HANDLERS.editEvent(h.ref.id); }
  else if (h.type==='outlook'){ HANDLERS.openOutlookEvent(h.ref.id); }
  else if (h.type==='task'){ openTaskForm(h.ref.id); }
  else if (h.type==='project'){ HANDLERS.openProject(h.ref.id); }
  else if (h.type==='projectTask'){ openProjectTaskForm(h.project.id, h.ref.id); }
  else if (h.type==='milestone' || h.type==='person'){ HANDLERS.openProject(h.project.id); }
  else if (h.type==='note'){ state.ui.anchor = h.date; state.ui.view='day'; render(); }
}

// ============================================================
// UKESOPPSUMMERING (ADR 0038)
// ============================================================
// Tre spørsmål på én skjerm: hva ble gjort, hva glapp, hva kommer. Alt regnes ut av data
// som alt finnes — bortsett fra «gjort», som krever `doneAt`. Den fylles først fra
// 2026-08-12, så for eldre fullførte oppgaver vet vi ikke NÅR. Panelet sier det i stedet
// for å vise en tom liste som om ingenting var gjort.
function _weekReviewData(){
  const todayK = todayKey();
  const from = dKey(addDays(new Date(), -7));
  const to = dKey(addDays(new Date(), 7));

  const all = [];
  (state.tasks||[]).forEach(t=>{
    if (!passesFilter(t)) return;
    const p = t.projectId ? (state.projects||[]).find(x=>x.id===t.projectId) : null;
    all.push({ ...t, _kind:'task', _projectTitle: p ? p.title : '' });
  });
  (state.projects||[]).forEach(p=>{
    if (p.archived || !passesFilter(p)) return;
    (p.tasks||[]).forEach(t=> all.push({ ...t, _kind:'projectTask', _projectId:p.id, _projectTitle:p.title }));
    (p.milestones||[]).forEach(m=> all.push({ ...m, due:m.date, _kind:'milestone', _projectId:p.id, _projectTitle:p.title }));
  });

  const doneKey = t => (t.doneAt || '').slice(0, 10);
  const done = all.filter(t => t.done && doneKey(t) >= from).sort((a,b)=> doneKey(b).localeCompare(doneKey(a)));
  const slipped = all.filter(t => !t.done && t.due && t.due < todayK).sort((a,b)=> (a.due||'').localeCompare(b.due||''));
  const ahead = all.filter(t => !t.done && t.due && t.due >= todayK && t.due <= to).sort((a,b)=> (a.due||'').localeCompare(b.due||''));
  const anyDoneAt = all.some(t => t.done && t.doneAt);
  const doneWithoutStamp = all.filter(t => t.done && !t.doneAt).length;
  return { done, slipped, ahead, anyDoneAt, doneWithoutStamp, from, to, todayK };
}

HANDLERS.openWeekReview = ()=>{
  const d = _weekReviewData();
  const row = (t, dateField)=>{
    const isProj = t._kind === 'projectTask';
    const isMs = t._kind === 'milestone';
    const click = isMs ? act('openProject', t._projectId)
      : isProj ? act('openProjectTaskForm', t._projectId, t.id)
      : act('openTaskForm', t.id);
    const label = dateField === 'doneAt'
      ? ((t.doneAt||'').slice(0,10) ? fmtDateShort(fromKey((t.doneAt||'').slice(0,10))) : '–')
      : (t.due ? fmtDateShort(fromKey(t.due)) : '–');
    const chip = projChipHTML(t._projectTitle);
    return `<div class="wr-row" ${click}>
      <span class="wr-date">${label}</span>
      <span class="wr-title">${isMs?'◆ ':''}${escapeHTML(t.title)}${chip}</span>
    </div>`;
  };
  const list = (items, dateField, empty)=> items.length
    ? items.slice(0, 25).map(t=>row(t, dateField)).join('') + (items.length>25?`<div class="wr-row" style="cursor:default"><span class="wr-date"></span><span class="wr-title" style="color:var(--ink-muted);font-style:italic">+${items.length-25} til</span></div>`:'')
    : `<div class="wr-empty">${empty}</div>`;

  const doneNote = !d.anyDoneAt && d.doneWithoutStamp
    ? `<div class="wr-note">Tidspunkt for fullføring har ikke blitt lagret før i dag, så ${d.doneWithoutStamp} eldre fullførte oppgaver kan ikke plasseres i tid. Fra nå av vises de her.</div>`
    : '';

  openModal(`
    <h3>Ukesoppsummering</h3>
    <div class="body">
      <div class="wr-sec"><h4>✓ Gjort siste 7 dager <small>${d.done.length}</small></h4>
        ${doneNote}
        ${list(d.done, 'doneAt', 'Ingenting registrert som fullført denne uka.')}
      </div>
      <div class="wr-sec"><h4>⚠ Glippet — forfalt og ikke gjort <small>${d.slipped.length}</small></h4>
        ${list(d.slipped, 'due', 'Ingenting har glippet. ')}
      </div>
      <div class="wr-sec"><h4>→ Neste 7 dager <small>${d.ahead.length}</small></h4>
        ${list(d.ahead, 'due', 'Ingen frister de neste sju dagene.')}
      </div>
    </div>
    <div class="footer"><button data-action="closeModal">Lukk</button></div>`);
};

// ============================================================
// SETTINGS / EXPORT / IMPORT / NOTIFICATIONS
// ============================================================
function openSettings(){
  const stat = state.ui.notifications?'På':'Av';
  // «På» alene løy: den sa ingenting om at nettleseren blokkerer varsler eller ikke kan
  // vise dem i det hele tatt. ADR 0031.
  const notifyNote = (()=>{
    if (!state.ui.notifications) return '';
    // `'Notification' in window` er sant også når verdien er undefined, så spør på verdien.
    const N = _notificationAPI();
    if (!N) return '⚠ Nettleseren støtter ikke varsler';
    if (N.permission === 'denied') return '⚠ Blokkert i nettleseren — endre via låsikonet i adressefeltet';
    if (N.permission === 'default') return '⚠ Ikke gitt tilgang ennå';
    if (_notifyStatus.supported === false) return '⚠ Varsler kan ikke vises her: ' + escapeHTML(_notifyStatus.error||'');
    return '✓ Tillatt' + (_notifyStatus.firedCount ? ` · ${_notifyStatus.firedCount} sendt denne økten` : '');
  })();
  const icsUrl = state.sync.icsUrl||'';
  const outlookCount = (state.outlookEvents||[]).length;
  const syncUrl = state.sync.syncUrl||'';
  const syncToken = state.sync.syncToken||'';
  const syncConfigured = !!(syncUrl && syncToken);
  openModal(`
    <h3>Innstillinger</h3>
    <div class="body settings-list">
      <div class="section-break">
        <div class="section-title">Synk PC ↔ iPhone</div>
        <div class="text-muted-sm" style="margin-bottom:8px">Cloudflare KV-basert. URL og token lagres kun lokalt på denne enheten.</div>
        <input id="sync-url" type="text" value="${escapeAttr(syncUrl)}" placeholder="https://your-sync.example.workers.dev" style="width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:6px;font-size:12px;font-family:monospace;margin-bottom:6px">
        <input id="sync-token" type="text" value="${escapeAttr(syncToken)}" placeholder="hemmelig token (lik på alle enhetene dine)" class="input-mono">
        <div class="flex-row-gap">
          <button id="sync-save" class="btn-sec">Lagre</button>
          <button id="sync-pull-now" class="btn-sec" ${syncConfigured?'':'disabled'}>↓ Hent fra sky</button>
          <button id="sync-push-now" class="btn-sec" ${syncConfigured?'':'disabled'}>↑ Send til sky</button>
          <span class="sync-status" id="sync-cv-status">${syncConfigured?('●  '+(_syncStatus.state==='error'?'feil: '+(_syncStatus.error||''):lastSyncRemoteLabel())):'ikke konfigurert'}</span>
        </div>
      </div>
      <div class="section-break">
        <div class="section-title">Outlook-synk</div>
        <div class="text-muted-sm" style="margin-bottom:8px">Lim inn ICS-lenken din. Den lagres kun lokalt i nettleseren din.</div>
        <input id="ics-url" type="text" value="${escapeAttr(icsUrl)}" placeholder="https://outlook.office365.com/owa/calendar/.../calendar.ics" class="input-mono">
        <div class="flex-row-gap">
          <button id="sync-now" class="btn-sec">Oppdater nå</button>
          <div class="pos-rel-ib">
            <button type="button" style="padding:6px 12px;font-size:13px;border-radius:6px;border:1px solid var(--line);background:#fff;color:var(--ink-soft);pointer-events:none">Importer .ics-fil</button>
            <input id="ics-file" type="file" accept=".ics,text/calendar" class="input-overlay">
          </div>
          <span class="sync-status" id="sync-status">${outlookCount} hendelser · ${lastSyncLabel()}</span>
        </div>
        ${_outlookStatusHTML()}
      </div>
      <div class="sl"><span>Tema</span>
        <select onchange="HANDLERS.setTheme(this.value)" style="padding:5px 10px;font-size:12px;border-radius:6px;border:1px solid var(--line);background:var(--surface);color:var(--ink-soft)">
          <option value="auto" ${(state.ui.theme||'auto')==='auto'?'selected':''}>Auto (følg system)</option>
          <option value="light" ${state.ui.theme==='light'?'selected':''}>Lys</option>
          <option value="dark" ${state.ui.theme==='dark'?'selected':''}>Mørk</option>
        </select>
      </div>
      <div class="sl flex-col-stretch">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <span>Påminnelser i nettleseren</span><button data-action="toggleNotifications">${stat}</button>
        </div>
        ${notifyNote ? `<div style="font-size:12px;color:${notifyNote.startsWith('✓')?'var(--ink-muted)':'var(--alert)'};padding:2px 0">${notifyNote}</div>` : ''}
      </div>
      <div class="sl"><span>Eksporter til JSON</span><button data-action="exportData">Last ned</button></div>
      <div class="sl"><span>Importer fra JSON</span><div class="pos-rel-ib"><button type="button" style="padding:5px 10px;font-size:12px;border-radius:6px;border:1px solid var(--line);color:var(--ink-soft);background:#fff;pointer-events:none">Velg fil</button><input id="imp" type="file" accept=".json,application/json" class="input-overlay"></div></div>
      <div class="sl flex-col-stretch">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <span>Ukentlig backup-mappe (lokal fil)</span>
          <span class="text-muted-sm" id="backup-dir-status">Henter…</span>
        </div>
        <div class="text-muted-italic">Lagrer en JSON-fil hver 7. dag. Velg en mappe (f.eks. OneDrive\Claude\Planner\backups) for å lagre direkte der — ellers lander filen i Nedlastinger. Bare på PC (Edge/Chrome).</div>
        <div style="display:flex;gap:6px">
          <button data-action="chooseBackupFolder" style="padding:5px 10px;font-size:12px;border-radius:6px;border:1px solid var(--line);background:#fff;color:var(--ink-soft)">Velg mappe</button>
          <button data-action="clearBackupFolder" id="clear-backup-dir-btn" style="padding:5px 10px;font-size:12px;border-radius:6px;border:1px solid var(--line);background:#fff;color:var(--ink-soft);display:none">Fjern</button>
        </div>
      </div>
      <div class="sl flex-col-stretch"><span>Sky-backups (automatisk hver uke, siste 12 uker)</span>
        <div id="cloud-backups-list" class="text-muted-italic">Henter…</div>
      </div>
      <div class="sl flex-col-stretch"><span>Lokale backups (daglige + før-synk-øyeblikksbilder)</span>
        ${_backupStatusHTML()}
        ${listBackups().length ? listBackups().map(k=>{
          const isPre = k.startsWith('planlegger.preSync.');
          const dateStr = k.replace('planlegger.backup.','').replace('planlegger.preSync.','');
          const label = isPre ? '↓ Før synk: '+dateStr.replace('T',' ').slice(0,16) : dateStr;
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:12px;color:var(--ink-soft)"><span>${label}</span><button data-action="restoreBackup" data-args='["${k}"]' style="padding:3px 8px;font-size:11.5px;border-radius:5px;border:1px solid var(--line);background:#fff;color:var(--ink-soft)">Gjenopprett</button></div>`;
        }).join('') : '<span class="text-muted-italic">Ingen backups ennå (lages automatisk daglig + før hver sync overskriver lokal)</span>'}
      </div>
      <div class="sl"><span>Slett alt</span><button data-action="resetAll" class="text-alert">Tilbakestill</button></div>
      <div class="sl"><span>Versjon</span><span style="color:var(--ink-muted)">v3.1</span></div>
    </div>
    <div class="footer"><button data-action="closeModal">Lukk</button></div>`);
  document.getElementById('imp').addEventListener('change', HANDLERS.importData);
  // ADR 0023 gjaldt dette feltet også, men det ble oversett: her lagret bare `blur`.
  // Å lukke Innstillinger med Esc fjerner feltet fra DOM-en uten å utløse blur, så en
  // innlimt ICS-URL forsvant stille. Strupet på `input`, ikke debounce'et — samme
  // begrunnelse som dag-notatet: en debounce som restarter commiter aldri mens du skriver.
  {
    const icsInput = document.getElementById('ics-url');
    let _icsTimer = null;
    const commitIcsUrl = ()=>{
      const v = icsInput.value.trim();
      if (v !== state.sync.icsUrl){ state.sync.icsUrl = v; saveState(); }
    };
    icsInput.addEventListener('input', ()=>{
      if (_icsTimer) return;
      _icsTimer = setTimeout(()=>{ _icsTimer = null; commitIcsUrl(); }, 400);
    });
    icsInput.addEventListener('blur', commitIcsUrl);
  }
  // Populate backup folder status (async — handle is in IndexedDB)
  getBackupDirHandle().catch(err=>{ console.error('backup-mappe-oppslag feilet', err); return null; }).then(async h => {
    const status = document.getElementById('backup-dir-status');
    const clear = document.getElementById('clear-backup-dir-btn');
    if (!status) return;
    if (h){
      let permLabel = '';
      try {
        const p = await h.queryPermission({ mode: 'readwrite' });
        permLabel = p === 'granted' ? '✓ ' : '⚠ ';
      } catch { permLabel = ''; }
      status.textContent = permLabel + h.name;
      status.style.color = permLabel.startsWith('✓') ? '#588a58' : 'var(--alert)';
      if (clear) clear.style.display = 'inline-block';
    } else if (_backupDirError){
      // «Ingen mappe valgt» og «klarte ikke lese IndexedDB» så identiske ut før.
      status.textContent = '⚠ klarte ikke lese mappevalget (' + _backupDirError + ')';
      status.style.color = 'var(--alert)';
      if (clear) clear.style.display = 'none';
    } else {
      status.textContent = '— bruker Nedlastinger';
      status.style.color = 'var(--ink-muted)';
    }
  });
  // Populate cloud backups list (async)
  loadCloudBackups().catch(err=>({ error: err.message || String(err) })).then(keys=>{
    const list = document.getElementById('cloud-backups-list');
    if (!list) return;
    if (keys && keys.error){
      list.innerHTML = '<span style="font-style:italic;color:var(--alert)">Kunne ikke hente sky-backups: '
        + escapeHTML(keys.error) + '</span>';
      return;
    }
    if (!state.sync.syncUrl || !state.sync.syncToken){
      list.innerHTML = '<span style="font-style:italic">Konfigurér synk over for å aktivere sky-backups</span>';
      return;
    }
    if (!keys.length){
      list.innerHTML = '<span style="font-style:italic">Ingen sky-backups enda. Worker-en må oppdateres med backup-koden for at dette skal aktiveres — se siste melding fra Claude.</span>';
      return;
    }
    list.style.fontStyle = 'normal';
    list.style.color = 'var(--ink-soft)';
    list.innerHTML = keys.map(k=>{
      const dateStr = k.replace('backup-','');
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:12px"><span>Uke ${dateStr}</span><button data-action="restoreCloudBackup" data-args='["${k}"]' style="padding:3px 8px;font-size:11.5px;border-radius:5px;border:1px solid var(--line);background:var(--surface);color:var(--ink-soft)">Gjenopprett</button></div>`;
    }).join('');
  });
  document.getElementById('sync-save').onclick = ()=>{
    state.sync.syncUrl = document.getElementById('sync-url').value.trim();
    state.sync.syncToken = document.getElementById('sync-token').value.trim();
    saveState();
    closeModal(); render(); openSettings();
  };
  document.getElementById('sync-pull-now').onclick = async ()=>{
    const status = document.getElementById('sync-cv-status');
    status.textContent = 'Henter…';
    // force=true: manual button always replaces local with remote
    const r = await pullFromRemote(false, true);
    if (r.ok){
      if (r.pulled){
        status.innerHTML = `<span style="color:#588a58">✓ Hentet data fra skyen</span>`;
        setTimeout(()=>{ closeModal(); render(); }, 1200);
      } else {
        status.innerHTML = `<span class="text-alert">Skyen er tom — gå til enheten med dataene og klikk "↑ Send til sky" først</span>`;
      }
    } else {
      status.innerHTML = `<span class="text-alert">Feil: ${escapeHTML(r.error||r.reason||'ukjent')}</span>`;
    }
  };
  document.getElementById('sync-push-now').onclick = async ()=>{
    const status = document.getElementById('sync-cv-status');
    status.textContent = 'Sender…';
    await pushToRemote();
    if (_syncStatus.state==='synced'){
      status.innerHTML = `<span style="color:#588a58">✓ Sendt til skyen</span>`;
    } else {
      status.innerHTML = `<span class="text-alert">Feil: ${escapeHTML(_syncStatus.error||'ukjent')}</span>`;
    }
  };
  document.getElementById('sync-now').onclick = async ()=>{
    const status = document.getElementById('sync-status');
    const url = document.getElementById('ics-url').value.trim();
    if (url !== state.sync.icsUrl){ state.sync.icsUrl = url; saveState(); }
    status.textContent = 'Henter…'; status.className = 'sync-status';
    const r = await syncOutlook(true);
    if (r.ok){
      status.textContent = `${r.count} hendelser hentet · ${lastSyncLabel()}`;
      status.className = 'sync-status ok';
      setTimeout(()=>render(),300);
    } else {
      const isCors = /cors|fetch|network|failed|cross-origin/i.test(r.error||'');
      status.innerHTML = `<span class="text-alert">${escapeHTML(r.error||'Feil')}</span>${isCors?` <span style="color:var(--ink-muted)">— prøv "Importer .ics-fil" som backup, eller spør Claude om Cloudflare Worker-oppsett</span>`:''}`;
      status.className = 'sync-status error';
    }
  };
  document.getElementById('ics-file').addEventListener('change', async e=>{
    const f = e.target.files[0]; if (!f) return;
    const status = document.getElementById('sync-status');
    status.textContent = 'Leser fil…';
    const r = await importICSFile(f);
    if (r.ok){
      status.textContent = `${r.count} hendelser importert · ${lastSyncLabel()}`;
      status.className = 'sync-status ok';
    } else {
      status.textContent = r.error||'Feil';
      status.className = 'sync-status error';
    }
  });
}
HANDLERS.setTheme = (theme)=>{
  state.ui.theme = theme;
  saveState();
  applyTheme();
};

HANDLERS.toggleNotifications = async ()=>{
  const turningOn = !state.ui.notifications;
  if (turningOn){
    const N = _notificationAPI();
    if (!N){
      _notifyStatus = { supported: false, error: 'Notification finnes ikke i denne nettleseren', lastFiredAt: 0, firedCount: 0 };
      if (typeof showToast === 'function') showToast('⚠ Denne nettleseren støtter ikke varsler. Fristene står fortsatt i planleggeren.', 8000);
      saveState(); openSettings(); return;   // ikke slå PÅ noe som ikke kan virke
    }
    let perm = N.permission;
    if (perm === 'default'){
      // Resultatet ble kastet før, så et AVSLAG etterlot «På» i Innstillinger for alltid.
      try { perm = await N.requestPermission(); }
      catch (err){ perm = 'denied'; console.error('requestPermission feilet', err); }
    }
    if (perm !== 'granted'){
      state.ui.notifications = false;
      _notifyStatus = { supported: false, error: 'ikke tillatt (' + perm + ')', lastFiredAt: 0, firedCount: 0 };
      if (typeof showToast === 'function'){
        showToast('⚠ Varsler er blokkert i nettleseren, så påminnelser kan ikke skrus på. Endre det i nettleserens side-innstillinger (låsikonet i adressefeltet).', 12000);
      }
      saveState(); openSettings(); return;
    }
  }
  state.ui.notifications = turningOn;
  setupNotifications();      // starter eller stopper intervallet nå, ikke ved neste lasting
  saveState(); openSettings();
};
HANDLERS.exportData = ()=>{
  // Dette er rømningsveien hver kvote-toast peker på, så den skal ikke feile stille.
  // Ankeret var ikke i DOM-en (autoWeeklyExport legger sitt inn), URL-en ble aldri
  // frigjort, og ingenting bekreftet at nedlastingen faktisk startet. ADR 0031.
  try {
    const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planlegger-${todayKey()}.json`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 1000);
    if (typeof showToast === 'function'){
      showToast(`💾 planlegger-${todayKey()}.json lastes ned (${Math.round(blob.size/1024)} kB). Finner du den ikke, sjekk nettleserens nedlastinger.`, 8000);
    }
  } catch (err){
    console.error('exportData failed', err);
    if (typeof showToast === 'function') showToast('⚠ Klarte ikke lage eksportfilen: ' + (err.message||err), 12000);
  }
};
HANDLERS.importData = e=>{
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = ev=>{
    try{
      const parsed = JSON.parse(ev.target.result);
      // Validate SHAPE, not just syntax. Any valid JSON used to pass — a package.json
      // or an export from another tool would leave an empty planner. See ADR 0022.
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)){
        alert('Dette ser ikke ut som en Planlegger-eksport (forventet et JSON-objekt).');
        return;
      }
      const buckets = ['projects','tasks','events','inbox','outlookEvents'];
      const present = buckets.filter(k => Array.isArray(parsed[k]));
      if (!present.length){
        alert('Dette ser ikke ut som en Planlegger-eksport — fant ingen av feltene '
          + buckets.join(', ') + '.\n\nIngenting er endret.');
        return;
      }
      const counts = present.map(k => `${parsed[k].length} ${k}`).join(', ');
      if (!confirm(`Importér og overskriv all data?\n\nFilen inneholder: ${counts}.\n\n`
        + 'Et øyeblikksbilde av dagens data lagres først, så du kan rulle tilbake.')) return;
      // Snapshot before overwriting — pullFromRemote and restoreCloudBackup both do
      // this; import used to be the one destructive path without a way back.
      _writePreSyncSnapshot();
      // Preserve this device's sync credentials. The imported file's own sync block
      // used to win, so importing a backup taken before sync was set up silently
      // killed sync with no message.
      const keepSync = { syncUrl: state.sync.syncUrl, syncToken: state.sync.syncToken, icsUrl: state.sync.icsUrl };
      // Write raw blob and re-run loadState so all migrations execute on imported data.
      // Outlook-cachen: har filen en, skal DEN vinne — hun gjenoppretter med vilje. Fjern
      // enhetens egen nøkkel først, ellers ville loadState foretrukket den. Har filen
      // ingen cache, beholdes den nåværende. ADR 0032.
      const fileHasCache = !!(parsed.outlookEvents||[]).length;
      const cacheBefore = localStorage.getItem(OUTLOOK_KEY);
      if (fileHasCache){ try { localStorage.removeItem(OUTLOOK_KEY); _lastOutlookWritten = null; } catch(_){} }
      localStorage.setItem(STORAGE_KEY, ev.target.result);
      state = loadState();
      if (!fileHasCache && cacheBefore){
        try { state.outlookEvents = JSON.parse(cacheBefore) || []; } catch(_){}
      }
      state.sync.syncUrl = keepSync.syncUrl || state.sync.syncUrl;
      state.sync.syncToken = keepSync.syncToken || state.sync.syncToken;
      state.sync.icsUrl = keepSync.icsUrl || state.sync.icsUrl;
      // Mark the import as the newest change, otherwise the 60 s cloud poll sees the
      // file's older lastModified and quietly replaces what was just restored.
      state.meta.lastModified = Date.now();
      _lastSavedBody = null;  // force next saveState() to compute fresh hash
      closeModal(); render();
      if (typeof showToast === 'function') showToast('Importert: ' + counts, 5000);
    }catch(err){ alert('Ugyldig fil: '+err.message); }
  };
  r.readAsText(file);
};
HANDLERS.resetAll = ()=>{
  if (!confirm('Slett alle data? Dette kan ikke angres.')) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(OUTLOOK_KEY);   // ellers står kalenderen igjen etter en reset
  _lastOutlookWritten = null;
  state = structuredClone(DEFAULT_STATE);
  closeModal(); render();
};

// Browser notifications — check upcoming events every minute, plus task reminders
const REMIND_OFFSETS = { sameday:0, '1day':-1, '3days':-3, '1week':-7 };

// Status for påminnelser, slik at Innstillinger kan vise sannheten i stedet for «På».
// ADR 0031: `fired` ble stemplet selv når `new Notification()` kastet, og på iPhone
// kaster konstruktøren alltid — så hver påminnelse ble svelget og deretter markert som
// levert. Nå stemples den bare hvis varselet faktisk ble opprettet, og feiler det, sier
// vi det én gang i stedet for å prøve i evighet.
let _notifyStatus = { supported: null, error: null, lastFiredAt: 0, firedCount: 0 };

// Én dør til API-et. `'Notification' in window` er sant også når verdien er undefined,
// så alle sjekker går gjennom denne.
function _notificationAPI(){
  return (typeof Notification === 'function' || (typeof Notification === 'object' && Notification)) ? Notification : null;
}

// Returnerer true bare hvis varselet faktisk ble konstruert.
function _fireNotification(title, opts){
  const N = _notificationAPI();
  if (!N){
    if (_notifyStatus.supported !== false){
      _notifyStatus = { supported: false, error: 'Notification finnes ikke i denne nettleseren',
                        lastFiredAt: _notifyStatus.lastFiredAt, firedCount: _notifyStatus.firedCount };
    }
    return false;
  }
  try {
    new N(title, opts);
    _notifyStatus.supported = true;
    _notifyStatus.lastFiredAt = Date.now();
    _notifyStatus.firedCount++;
    return true;
  } catch (err){
    // Chrome på Android og Safari på iOS kaster her: varsler krever
    // ServiceWorkerRegistration.showNotification, som vi ikke har (ADR 0010 fjernet
    // service workeren). Meld det én gang, ikke hvert minutt.
    if (_notifyStatus.supported !== false){
      _notifyStatus = { supported: false, error: err.message || String(err),
                        lastFiredAt: _notifyStatus.lastFiredAt, firedCount: _notifyStatus.firedCount };
      console.error('Varsel kunne ikke vises', err);
      if (typeof showToast === 'function'){
        showToast('⚠ Nettleseren din kan ikke vise påminnelser (typisk på iPhone). Fristene står fortsatt i planleggeren.', 12000);
      }
    }
    return false;
  }
}

let _notifyTimer = null;
function setupNotifications(){
  // Kan kalles på nytt når Maria skrur påminnelser av/på. Før kjørte den bare ved
  // oppstart, så å skru dem PÅ gjorde ingenting før neste sidelasting.
  if (_notifyTimer){ clearInterval(_notifyTimer); _notifyTimer = null; }
  if (!state.ui.notifications) return;
  const N = _notificationAPI();
  if (!N){
    _notifyStatus = { supported: false, error: 'Notification finnes ikke i denne nettleseren', lastFiredAt: 0, firedCount: 0 };
    return;
  }
  if (N.permission==='default'){
    N.requestPermission().then(p=>{
      if (p !== 'granted'){
        console.warn('Varsler ikke tillatt:', p);
        updateSyncIndicator && updateSyncIndicator();
      }
    }).catch(err=> console.error('requestPermission feilet', err));
  }
  const checkUpcoming = ()=>{
    const NN = _notificationAPI();
    if (!NN || NN.permission!=='granted') return;
    const now = new Date();
    const todayK = dKey(now);
    // Var uvoktet: en ødelagt verdi kastet inne i minutt-intervallet. ADR 0032.
    let fired = [];
    try {
      const raw = JSON.parse(sessionStorage.getItem('fired') || '[]');
      if (Array.isArray(raw)) fired = raw;
      else throw new Error('ikke en liste');
    } catch (err){
      console.warn('fired-registeret var ødelagt, nullstiller', err);
      sessionStorage.removeItem('fired');
    }
    // Event reminders — 15 min before
    state.events.filter(e=>e.date===todayK && e.start).forEach(e=>{
      const [h,mn] = e.start.split(':').map(Number);
      const evTime = new Date(now.getFullYear(),now.getMonth(),now.getDate(),h,mn);
      const diff = evTime - now;
      if (diff>0 && diff<=15*60*1000 && !fired.includes(e.id)){
        // Stemple KUN hvis varselet faktisk kom ut. Ellers får neste runde prøve igjen.
        if (_fireNotification(e.title, { body: `Om ${Math.round(diff/60000)} min · ${e.start}${e.end?'–'+e.end:''}`, tag: e.id })){
          fired.push(e.id); sessionStorage.setItem('fired', JSON.stringify(fired));
        }
      }
    });
    // Task reminders — fire at 09:00 on the offset day
    const allTasks = [
      ...state.tasks.map(t=>({ ...t, _kind:'task' })),
      ...state.projects.flatMap(p=>(p.tasks||[]).map(t=>({ ...t, _kind:'projectTask', _projectTitle:p.title }))),
    ];
    allTasks.forEach(t=>{
      if (!t.due || !t.remindBefore || t.done) return;
      const offset = REMIND_OFFSETS[t.remindBefore];
      if (offset === undefined) return;
      const dueDate = fromKey(t.due);
      const reminderDate = new Date(dueDate);
      reminderDate.setDate(reminderDate.getDate() + offset);
      reminderDate.setHours(9, 0, 0, 0);
      const diffMin = (now - reminderDate) / 60000;
      // Fire if 0–60 min after the 09:00 trigger time
      const reminderId = 'task-' + t.id + '-' + t.remindBefore;
      if (diffMin >= 0 && diffMin < 60 && !fired.includes(reminderId)){
        const projectPart = t._projectTitle ? `[${t._projectTitle}] ` : '';
        const offsetLabel = t.remindBefore==='sameday' ? 'I dag' : (t.remindBefore==='1day'?'I morgen':(t.remindBefore==='3days'?'Om 3 dager':'Om 1 uke'));
        if (_fireNotification(`${projectPart}${t.title}`, { body: `${offsetLabel} · frist ${fmtDateShort(dueDate)}`, tag: reminderId })){
          fired.push(reminderId); sessionStorage.setItem('fired', JSON.stringify(fired));
        }
      }
    });
  };
  checkUpcoming();
  _notifyTimer = setInterval(checkUpcoming, 60*1000);
}

// ============================================================
// ICS PARSER + OUTLOOK SYNC
// ============================================================
function unfoldICS(text){ return text.replace(/\r?\n[ \t]/g,''); }
function unescapeICS(s){ return s.replace(/\\n/gi,'\n').replace(/\\,/g,',').replace(/\\;/g,';').replace(/\\\\/g,'\\'); }
// ----- Tidssoner i ICS (ADR 0028) -----
// Outlook publiserer TZID med Windows-navn («W. Europe Standard Time»), ikke IANA.
// Denne tabellen dekker sonene som realistisk kan dukke opp i Marias kalender.
// Et navn som ikke står her, men inneholder «/», prøves som IANA. Alt annet — og alt
// runtime avviser — degraderes til flytende tid, som er oppførselen vi hadde før.
const _WINDOWS_TZ = {
  'utc': 'UTC',
  'gmt standard time': 'Europe/London',
  'greenwich standard time': 'Atlantic/Reykjavik',
  'w. europe standard time': 'Europe/Berlin',
  'central europe standard time': 'Europe/Budapest',
  'central european standard time': 'Europe/Warsaw',
  'romance standard time': 'Europe/Paris',
  'e. europe standard time': 'Europe/Chisinau',
  'gtb standard time': 'Europe/Bucharest',
  'fle standard time': 'Europe/Kiev',
  'turkey standard time': 'Europe/Istanbul',
  'russian standard time': 'Europe/Moscow',
  'israel standard time': 'Asia/Jerusalem',
  'egypt standard time': 'Africa/Cairo',
  'south africa standard time': 'Africa/Johannesburg',
  'w. central africa standard time': 'Africa/Lagos',
  'arabian standard time': 'Asia/Dubai',
  'arab standard time': 'Asia/Riyadh',
  'iran standard time': 'Asia/Tehran',
  'pakistan standard time': 'Asia/Karachi',
  'india standard time': 'Asia/Kolkata',
  'sri lanka standard time': 'Asia/Colombo',
  'bangladesh standard time': 'Asia/Dhaka',
  'se asia standard time': 'Asia/Bangkok',
  'singapore standard time': 'Asia/Singapore',
  'china standard time': 'Asia/Shanghai',
  'taipei standard time': 'Asia/Taipei',
  'tokyo standard time': 'Asia/Tokyo',
  'korea standard time': 'Asia/Seoul',
  'w. australia standard time': 'Australia/Perth',
  'aus central standard time': 'Australia/Darwin',
  'cen. australia standard time': 'Australia/Adelaide',
  'aus eastern standard time': 'Australia/Sydney',
  'e. australia standard time': 'Australia/Brisbane',
  'tasmania standard time': 'Australia/Hobart',
  'new zealand standard time': 'Pacific/Auckland',
  'eastern standard time': 'America/New_York',
  'us eastern standard time': 'America/Indiana/Indianapolis',
  'central standard time': 'America/Chicago',
  'central standard time (mexico)': 'America/Mexico_City',
  'mountain standard time': 'America/Denver',
  'us mountain standard time': 'America/Phoenix',
  'pacific standard time': 'America/Los_Angeles',
  'alaskan standard time': 'America/Anchorage',
  'hawaiian standard time': 'Pacific/Honolulu',
  'atlantic standard time': 'America/Halifax',
  'newfoundland standard time': 'America/St_Johns',
  'sa pacific standard time': 'America/Bogota',
  'sa western standard time': 'America/La_Paz',
  'sa eastern standard time': 'America/Cayenne',
  'e. south america standard time': 'America/Sao_Paulo',
  'argentina standard time': 'America/Argentina/Buenos_Aires',
  'pacific sa standard time': 'America/Santiago',
};

// Intl.DateTimeFormat is expensive to construct; one per zone is plenty.
const _tzFmtCache = Object.create(null);
function _tzFormatter(zone){
  if (zone in _tzFmtCache) return _tzFmtCache[zone];
  let fmt = null;
  try {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch (e) { fmt = null; }        // unknown zone → caller degrades to floating
  _tzFmtCache[zone] = fmt;
  return fmt;
}

// TZID value → IANA zone name we can actually use, or null.
function _icsZone(tzid){
  let raw = String(tzid || '').trim().replace(/^"|"$/g, '');
  if (!raw) return null;
  // Outlook sometimes prefixes a registry id: "(UTC+01:00) W. Europe Standard Time"
  raw = raw.replace(/^\([^)]*\)\s*/, '');
  const mapped = _WINDOWS_TZ[raw.toLowerCase()];
  const candidate = mapped || (raw.indexOf('/') > -1 ? raw : null);
  // Degraderingen til flytende tid er riktig (ADR 0028), men den var helt stille: et møte
  // i en umappet sone vises på kilde-veggklokka som om den var lokal — 14:00 New York
  // blir 14:00 norsk tid, seks timer feil, og ser helt normalt ut. Si det minst én gang
  // per ukjent sonenavn, så det finnes et spor når en tid ser rar ut. ADR 0031.
  if (!candidate || !_tzFormatter(candidate)){
    _warnUnknownZone(raw);
    return null;
  }
  return candidate;
}
const _warnedZones = new Set();
function _warnUnknownZone(raw){
  if (!raw || _warnedZones.has(raw)) return;
  _warnedZones.add(raw);
  console.warn('[ics] ukjent tidssone «' + raw + '» — hendelsen vises på kildens veggklokke som om den var lokal tid. Legg sonen til i _WINDOWS_TZ hvis tidene ser feil ut.');
}

// Offset of `zone` from UTC at a given instant, in ms. Read the zone's wall clock at
// that instant, then treat it as if it were UTC — the difference is the offset.
function _tzOffsetMs(instantMs, zone){
  const fmt = _tzFormatter(zone);
  if (!fmt) return 0;
  const parts = fmt.formatToParts(new Date(instantMs));
  const get = (type)=>{
    const p = parts.find(x => x.type === type);
    return p ? parseInt(p.value, 10) : 0;
  };
  let hour = get('hour');
  if (hour === 24) hour = 0;         // some engines render midnight as 24
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
  return asUTC - instantMs;
}

// A wall-clock time in `zone` → the UTC instant it denotes. Two passes, because the
// offset we need depends on the instant we're trying to find: guess with the offset at
// the naive instant, then re-check with the offset at the corrected one. That second
// pass is what makes the DST changeover hours come out right.
function _zonedWallToUTC(y, mo, d, h, mi, zone){
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  const off1 = _tzOffsetMs(naive, zone);
  const utc = naive - off1;
  const off2 = _tzOffsetMs(utc, zone);
  return off2 === off1 ? utc : naive - off2;
}

// An instant → date + clock time in the browser's own zone.
function _localParts(instantMs){
  const dt = new Date(instantMs);
  return { date: dKey(dt), time: pad(dt.getHours()) + ':' + pad(dt.getMinutes()) };
}

// Resolve a source-calendar date against a parsed time spec, giving the local date and
// clock time. Called once per DTSTART and once per recurrence occurrence — that is the
// whole DST fix: every occurrence is converted on its own date instead of inheriting
// the base occurrence's already-converted clock time.
function _resolveICSTime(srcDateKey, spec){
  if (!spec || spec.allDay || spec.mode === 'floating'){
    return { date: srcDateKey, time: spec ? spec.srcTime : '', instant: null };
  }
  const [y, mo, d] = srcDateKey.split('-').map(Number);
  const [h, mi] = spec.srcTime.split(':').map(Number);
  const instant = spec.mode === 'utc'
    ? Date.UTC(y, mo - 1, d, h, mi)
    : _zonedWallToUTC(y, mo, d, h, mi, spec.zone);
  const lp = _localParts(instant);
  return { date: lp.date, time: lp.time, instant: instant };
}

// Parse an ICS date/date-time value. `tzid` is the TZID parameter from the property's
// own parameter list, if it had one.
//
// Returns both views of the same moment, and they are not interchangeable:
//   srcDate / srcTime — the source calendar's own date and wall clock, exactly as written
//   date / time       — the same moment in the browser's local zone
// Recurrence rules must be enumerated on SOURCE dates (a weekly Tokyo meeting is weekly
// in Tokyo, and its local date can be the day before), then each occurrence converted.
function parseICSDate(str, tzid){
  const m = String(str||'').match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  const srcDate = `${y}-${mo}-${d}`;
  if (!h){
    return { date: srcDate, time: '', allDay: true, srcDate, srcTime: '',
             mode: 'allday', zone: null, instant: null };
  }
  const zone = z ? null : _icsZone(tzid);
  // No Z and no usable TZID → floating: the wall clock is taken at face value, which is
  // what every version before ADR 0028 did with every timed event.
  const mode = z ? 'utc' : (zone ? 'zoned' : 'floating');
  const spec = { allDay: false, srcDate, srcTime: `${h}:${mi}`, mode, zone };
  const resolved = _resolveICSTime(srcDate, spec);
  return { ...spec, date: resolved.date, time: resolved.time, instant: resolved.instant };
}

// ISO 8601 duration → minutes (DURATION:PT1H30M, P1D, P1W). Outlook normally sends
// DTEND, but a VEVENT with only DURATION used to lose its end time entirely.
function parseICSDuration(str){
  const m = String(str||'').match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  const w = +(m[2]||0), d = +(m[3]||0), h = +(m[4]||0), mi = +(m[5]||0);
  const total = ((w*7 + d) * 24 * 60) + h*60 + mi;
  return total ? sign * total : 0;
}

// Chronological occurrence dates for an RRULE, from DTSTART up to winEnd.
// Occurrences are computed from baseStart each time (not iteratively) so day-of-month
// and BYDAY don't drift. Supported: FREQ DAILY/WEEKLY/MONTHLY/YEARLY, INTERVAL,
// COUNT, UNTIL, BYDAY (weekly + monthly with ordinals), TZID and per-occurrence DST
// (ADR 0028). Not supported: BYSETPOS, RECURRENCE-ID overrides — see ADR 0025.
// The dates handed in and out of this function are SOURCE-calendar dates; conversion to
// local time happens per occurrence in expandRRule.
function _rruleOccurrences(baseStart, params, winEnd, maxOcc){
  const freq = params.FREQ;
  const interval = Math.max(1, parseInt(params.INTERVAL||'1') || 1);
  const byday = String(params.BYDAY||'').split(',').map(s=>s.trim()).filter(Boolean);
  const out = [];
  if (freq === 'DAILY'){
    for (let k=0; k<maxOcc; k++){
      const d = addDays(baseStart, k*interval);
      if (d > winEnd) break;
      out.push(d);
    }
  } else if (freq === 'WEEKLY'){
    const dows = byday.map(b => _BYDAY_NUM[b.replace(/^[+-]?\d+/,'')]).filter(n => n !== undefined);
    if (!dows.length){
      for (let k=0; k<maxOcc; k++){
        const d = addDays(baseStart, 7*k*interval);
        if (d > winEnd) break;
        out.push(d);
      }
    } else {
      const offsets = [...new Set(dows.map(n => (n + 6) % 7))].sort((a,b)=>a-b); // Mon=0
      const wkStart = startOfWeek(baseStart);
      weeks: for (let w=0; ; w++){
        const base = addDays(wkStart, 7*w*interval);
        if (base > winEnd) break;
        for (const off of offsets){
          const d = addDays(base, off);
          if (d < baseStart) continue;      // series can't start before DTSTART
          if (d > winEnd) break weeks;
          out.push(d);
          if (out.length >= maxOcc) break weeks;
        }
      }
    }
  } else if (freq === 'MONTHLY'){
    const ords = byday.map(b => {
      const m = b.match(/^([+-]?\d+)?([A-Z]{2})$/);
      return m && _BYDAY_NUM[m[2]] !== undefined ? { n: m[1] ? parseInt(m[1]) : 0, d: _BYDAY_NUM[m[2]] } : null;
    }).filter(Boolean);
    months: for (let mo=0; ; mo++){
      const anchor = new Date(baseStart.getFullYear(), baseStart.getMonth() + mo*interval, 1);
      if (anchor > winEnd) break;
      if (!ords.length){
        const d = addMonthsKeepDay(baseStart, mo*interval);
        if (d > winEnd) break;
        if (d >= baseStart){ out.push(d); if (out.length >= maxOcc) break; }
      } else {
        const cands = [];
        ords.forEach(o => cands.push(..._weekdaysOfMonth(anchor.getFullYear(), anchor.getMonth(), o.d, o.n)));
        cands.sort((a,b)=>a-b);
        for (const d of cands){
          if (d < baseStart) continue;
          if (d > winEnd) break months;
          out.push(d);
          if (out.length >= maxOcc) break months;
        }
      }
    }
  } else if (freq === 'YEARLY'){
    for (let k=0; k<maxOcc; k++){
      const d = addMonthsKeepDay(baseStart, 12*k*interval);
      if (d > winEnd) break;
      out.push(d);
    }
  }
  return out;
}

function expandRRule(baseEv, baseDate, rrule, exdates, endSpec){
  const params = {};
  rrule.split(';').forEach(p=>{ const [k,v]=p.split('='); params[k]=v; });
  // COUNT is an occurrence limit counted from DTSTART. It used to default to 500 and
  // the counter was also incremented for occurrences BEFORE the display window, so a
  // series that started years ago spent its whole budget in the past and vanished.
  // No COUNT now means no occurrence limit — the window bounds the loop instead.
  const MAX_OCC = 20000;   // safety net: ~54 years daily, ~384 years weekly
  const count = params.COUNT ? Math.max(0, parseInt(params.COUNT) || 0) : Infinity;
  const until = params.UNTIL ? parseICSDate(params.UNTIL) : null;
  // Window: 12 months back, 24 months forward
  const winStart = addMonths(new Date(), -12);
  const winEnd = addMonths(new Date(), 24);
  // Enumerate on the SOURCE calendar (ADR 0028). Using the local date here would shift
  // the whole series by a day for zones far enough east or west.
  const baseStart = fromKey(baseDate.srcDate || baseDate.date);
  // Excluded occurrences (EXDATE). Matched on the source date, not time — see ADR 0025.
  const exSet = new Set();
  (exdates || []).forEach(entry => {
    const raw = (entry && entry.value !== undefined) ? entry.value : entry;
    const tz = (entry && entry.tz) || null;
    String(raw).split(',').forEach(v => {
      const p = parseICSDate(v.trim(), tz);
      if (p) exSet.add(p.srcDate);
    });
  });
  // Duration in whole days (multi-day events) and in minutes (so each occurrence's end
  // time is derived from its own start instant instead of inheriting a converted clock).
  const durationDays = baseEv.endDate
    ? Math.round((fromKey(baseEv.endDate) - fromKey(baseEv.date)) / 86400000) : 0;
  const durationMin = (baseDate.instant != null && endSpec && endSpec.instant != null)
    ? Math.round((endSpec.instant - baseDate.instant) / 60000) : null;
  const dates = _rruleOccurrences(baseStart, params, winEnd, Math.min(count, MAX_OCC));
  const instances = [];
  // Forekomster genereres fra DTSTART, mens vinduet starter 12 måneder tilbake. En daglig
  // serie som begynte i 2015 lager altså ~4200 forekomster og kaster ~3900 av dem — men
  // hver ble tidssone-konvertert FØRST, og konverteringen er to
  // `Intl.DateTimeFormat.formatToParts`-kall. Kildedatoen avviker maks én dag fra den
  // lokale, så alt som ligger godt før vinduet forkastes nå uten konvertering. Den
  // presise grensen står igjen nedenfor. ADR 0032.
  const winStartSlack = addDays(winStart, -2);
  for (let i = 0; i < dates.length; i++){
    const cur = dates[i];
    const srcKey = dKey(cur);
    if (exSet.has(srcKey)) continue;      // billig — flyttet foran konverteringen
    if (cur < winStartSlack) continue;    // billig — sparer konverteringen
    // Convert this occurrence on its own date — the DST fix.
    const startLocal = _resolveICSTime(srcKey, baseDate);
    if (until){
      if (until.instant != null && startLocal.instant != null){
        if (startLocal.instant > until.instant) break;
      } else if (fromKey(srcKey) > fromKey(until.srcDate || until.date)) break;
    }
    const key = startLocal.date;
    if (fromKey(key) < winStart) continue;
    let endTime = baseEv.end;
    let extraDay = 0;
    if (durationMin != null && startLocal.instant != null){
      const endLocal = _localParts(startLocal.instant + durationMin * 60000);
      endTime = endLocal.time;
      if (durationDays === 0 && endLocal.date > key) extraDay = 1;
    }
    const spanDays = durationDays > 0 ? durationDays : extraDay;
    const newEndDate = spanDays > 0 ? dKey(addDays(fromKey(key), spanDays)) : '';
    instances.push({ ...baseEv, id: baseEv.id+'-'+i, date: key,
                     start: startLocal.time, end: endTime, endDate: newEndDate });
  }
  return instances;
}

function parseICS(text){
  text = unfoldICS(text);
  const lines = text.split(/\r?\n/);
  const events = [];
  let cur = null;
  let inAlarm = false;
  for (const line of lines){
    if (line==='BEGIN:VEVENT'){ cur = {}; inAlarm = false; continue; }
    // A VALARM's own DESCRIPTION ("REMINDER") used to overwrite the event's, wiping
    // the Teams link / agenda text. Skip everything inside the alarm block.
    if (line==='BEGIN:VALARM'){ inAlarm = true; continue; }
    if (line==='END:VALARM'){ inAlarm = false; continue; }
    if (inAlarm) continue;
    if (line==='END:VEVENT'){
      if (cur && cur.dtstart && cur.status!=='CANCELLED'){
        const startD = parseICSDate(cur.dtstart, cur.dtstartTz);
        const endD = cur.dtend ? parseICSDate(cur.dtend, cur.dtendTz) : null;
        if (startD){
          // Compute endDate for multi-day events.
          // For all-day: DTEND is EXCLUSIVE per iCal spec, so subtract 1 day.
          // For timed: only set endDate if DTEND falls on a different day than DTSTART.
          let endDate = '';
          if (endD){
            if (startD.allDay && endD.allDay){
              const ed = fromKey(endD.date);
              ed.setDate(ed.getDate() - 1);
              const edKey = dKey(ed);
              if (edKey > startD.date) endDate = edKey;
            } else if (!startD.allDay && !endD.allDay && endD.date !== startD.date){
              endDate = endD.date;
            }
          }
          // No DTEND but a DURATION: derive the end. Whole days extend endDate,
          // an intraday duration gives the end time.
          let durEnd = null;
          if (!endD && cur.duration){
            const mins = parseICSDuration(cur.duration);
            if (mins && mins > 0){
              const startMin = startD.allDay ? 0
                : (parseInt(startD.time.slice(0,2))*60 + parseInt(startD.time.slice(3,5)));
              const dayShift = Math.floor((startMin + mins) / 1440);
              if (dayShift > 0) endDate = dKey(addDays(fromKey(startD.date), dayShift));
              if (!startD.allDay){
                const em = (startMin + mins) % 1440;
                durEnd = pad(Math.floor(em/60)) + ':' + pad(em%60);
              }
            }
          }
          const ev = {
            id: 'ics-' + (cur.uid || (Math.random().toString(36).slice(2))),
            title: cur.summary || '(uten tittel)',
            date: startD.date,
            endDate,
            start: startD.allDay?'':startD.time,
            end: endD && !endD.allDay ? endD.time : (durEnd || ''),
            location: cur.location||'',
            description: cur.description||'',
            category: 'arbeid',
            _ics: true,
          };
          if (cur.rrule){
            try { events.push(...expandRRule(ev, startD, cur.rrule, cur.exdates, endD)); }
            catch(e){ console.error('RRULE expansion failed for', ev.title, e); events.push(ev); }
          } else {
            events.push(ev);
          }
        }
      }
      cur = null; continue;
    }
    if (!cur) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx===-1) continue;
    const lhs = line.substring(0, colonIdx);
    const rhs = line.substring(colonIdx+1);
    const propName = lhs.split(';')[0].toLowerCase();
    // TZID lives in the property's parameter list, so it has to be read off the LHS.
    // Dropping it was the whole of bug B4 — see ADR 0028.
    const tzidOf = (s)=>{
      const m = String(s).match(/;TZID=("[^"]*"|[^;:]*)/i);
      return m ? m[1] : null;
    };
    if (propName==='dtstart'){ cur.dtstart = rhs; cur.dtstartTz = tzidOf(lhs); }
    else if (propName==='dtend'){ cur.dtend = rhs; cur.dtendTz = tzidOf(lhs); }
    else if (propName==='summary') cur.summary = unescapeICS(rhs);
    else if (propName==='description') cur.description = unescapeICS(rhs);
    else if (propName==='location') cur.location = unescapeICS(rhs);
    else if (propName==='uid') cur.uid = rhs;
    else if (propName==='status') cur.status = rhs;
    else if (propName==='rrule') cur.rrule = rhs;
    else if (propName==='duration') cur.duration = rhs.trim();
    else if (propName==='exdate') (cur.exdates = cur.exdates || []).push({ value: rhs, tz: tzidOf(lhs) });
  }
  return events;
}

async function syncOutlook(silent){
  const url = (state.sync.icsUrl||'').trim();
  if (!url) return { error:'Ingen URL satt' };
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Svaret ser ikke ut som ICS');
    const events = parseICS(text);
    state.outlookEvents = events;
    state.sync.lastSync = new Date().toISOString();
    _outlookStatus = { failedAt: 0, error: null };   // en vellykket synk fjerner advarselen
    saveState();
    if (!silent) render();
    return { ok:true, count: events.length };
  } catch (e) {
    // Sett status her, ikke bare i auto-synk-grenen: en feilet manuell «Oppdater nå»
    // etterlot ingen varig spor i det hele tatt.
    _outlookStatus = { failedAt: Date.now(), error: e.message || String(e) };
    return { error: e.message || String(e) };
  }
}

function importICSFile(file){
  return new Promise((resolve)=>{
    const r = new FileReader();
    r.onload = ev=>{
      try {
        const text = ev.target.result;
        if (!text.includes('BEGIN:VCALENDAR')) { resolve({error:'Ikke en gyldig ICS-fil'}); return; }
        const events = parseICS(text);
        // This replaced the whole synced calendar and stamped lastSync, which also
        // blocked the hourly auto-resync for an hour — so importing one emailed
        // invitation wiped every Outlook event for at least an hour. Ask, and don't
        // touch lastSync so the next auto-sync repairs the list.
        const existing = (state.outlookEvents||[]).length;
        if (existing && !confirm(`Filen inneholder ${events.length} hendelse(r).\n\n`
          + `Dette erstatter de ${existing} Outlook-hendelsene du har nå. `
          + 'Neste automatiske Outlook-sync henter dem tilbake.\n\nFortsett?')){
          resolve({ cancelled:true });
          return;
        }
        state.outlookEvents = events;
        saveState(); render();
        resolve({ ok:true, count: events.length });
      } catch(e){ resolve({error: e.message}); }
    };
    r.readAsText(file);
  });
}

// `_outlookStatus` ble skrevet og aldri lest — den eneste sporen etter en feilet
// Outlook-sync var en toast som forsvant, mens kalenderen fortsatte å vise forrige ukes
// møter som om alt var i orden. Cachen tømmes med vilje ikke ved feil (gamle møter er
// bedre enn ingen), men da MÅ det stå at de er gamle. ADR 0031.
function _outlookStatusHTML(){
  if (!state.sync.icsUrl) return '';
  const failed = _outlookStatus.failedAt;
  if (failed){
    const minSince = Math.round((Date.now() - failed)/60000);
    return `<div style="font-size:12px;color:var(--alert);padding:2px 0">⚠ Siste synk feilet${minSince<60?` for ${minSince} min siden`:''}: ${escapeHTML(_outlookStatus.error||'ukjent')} — møtene under kan være utdaterte.</div>`;
  }
  const t = state.sync.lastSync ? new Date(state.sync.lastSync).getTime() : 0;
  if (!t) return `<div style="font-size:12px;color:var(--alert);padding:2px 0">⚠ Aldri synkronisert — trykk «Oppdater nå».</div>`;
  const hours = (Date.now() - t)/3600000;
  if (hours > 26){
    return `<div style="font-size:12px;color:var(--alert);padding:2px 0">⚠ Ingen vellykket synk på ${Math.round(hours/24)} døgn — kalenderen kan være utdatert.</div>`;
  }
  return '';
}

function lastSyncLabel(){
  const t = state.sync.lastSync;
  if (!t) return 'aldri synkronisert';
  const diff = (Date.now() - new Date(t).getTime())/60000;
  if (diff<1) return 'sist: nå nettopp';
  if (diff<60) return `sist: ${Math.round(diff)} min siden`;
  if (diff<1440) return `sist: ${Math.round(diff/60)} t siden`;
  return `sist: ${Math.round(diff/1440)} d siden`;
}

// Read-only modal for Outlook events
HANDLERS.openOutlookEvent = id => {
  const e = state.outlookEvents.find(x=>x.id===id);
  if (!e) return;
  const multiDay = e.endDate && e.endDate > e.date;
  const dateLine = multiDay
    ? `${fmtDate(fromKey(e.date))} – ${fmtDate(fromKey(e.endDate))}${e.start?` · ${e.start}${e.end?'–'+e.end:''}`:' (hele perioden)'}`
    : (e.start ? `${fmtDateShort(fromKey(e.date))} kl. ${e.start}${e.end?'–'+e.end:''}` : `${fmtDate(fromKey(e.date))} (hele dagen)`);
  openModal(`
    <h3>📧 ${escapeHTML(e.title)}</h3>
    <div class="body">
      <div class="field"><label>${multiDay?'Periode':'Tid'}</label><div>${dateLine}</div></div>
      ${e.location?`<div class="field"><label>Sted</label><div>${escapeHTML(e.location)}</div></div>`:''}
      ${e.description?`<div class="field"><label>Beskrivelse</label><div style="white-space:pre-wrap;font-size:13px">${escapeHTML(e.description)}</div></div>`:''}
      <div class="text-muted-italic">Kommer fra Outlook — kan kun redigeres der.</div>
    </div>
    <div class="footer"><button data-action="closeModal">Lukk</button></div>`);
};

// ============================================================
// HELPERS
// ============================================================
function escapeHTML(s){ return String(s||'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function escapeAttr(s){ return escapeHTML(s).replace(/'/g,"&#39;"); }

// ----- Wikilinks -----
// [[Prosjekttittel]] i notat-tekst blir en klikkbar lenke ved RENDERING, aldri i lagret
// innhold. Lagret note.content beholder alltid rå [[...]]-form — se ADR 0019.
function renderWikilinks(html){
  if (!html) return '';
  return String(html).replace(/\[\[([^\[\]<>]{1,120})\]\]/g, (m, raw) => {
    const target = raw.trim();
    if (!target) return m;
    const lower = target.toLowerCase();
    const projects = (state && state.projects) || [];
    const exists = projects.some(p => (p.title || '').toLowerCase() === lower)
                || projects.some(p => (p.title || '').toLowerCase().includes(lower));
    const cls = exists ? 'wikilink' : 'wikilink wikilink-broken';
    const tip = exists ? `Gå til «${target}»` : `Fant ikke prosjekt «${target}»`;
    return `<a class="${cls}" ${act('openWikilink')} data-target="${escapeAttr(target)}" data-stop="1" title="${escapeAttr(tip)}">${escapeHTML(target)}</a>`;
  });
}

// Inverse of renderWikilinks — turn rendered anchors back into [[...]] text.
// Belt-and-braces: applied on every save path so rendered markup can never be persisted.
function unrenderWikilinks(html){
  if (!html) return '';
  return String(html).replace(/<a\b[^>]*\bclass="[^"]*\bwikilink\b[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
    (m, inner) => '[[' + inner.replace(/<[^>]+>/g, '').trim() + ']]');
}

// URL-whitelist for notat-innhold. javascript: blokkeres alltid; data: kun for
// innlimte raster-bilder (skjermbilder limes inn som data:image/...;base64).
function _noteUrlIsSafe(url){
  let u = String(url == null ? '' : url);
  // Decode numeric HTML entities so java&#115;cript: can't slip through
  u = u.replace(/&#x([0-9a-f]+);?/gi, (m, h) => String.fromCharCode(parseInt(h, 16)))
       .replace(/&#(\d+);?/g, (m, d) => String.fromCharCode(parseInt(d, 10)));
  u = u.replace(/[\s\u0000-\u001f]/g, '');
  if (/^javascript:/i.test(u) || /^vbscript:/i.test(u)) return false;
  if (/^data:/i.test(u)) return /^data:image\/(png|jpe?g|gif|webp|bmp|avif);base64,/i.test(u);
  return true;
}

// Strip inline event handlers + unsafe URLs from rich-text note content.
// Notes are stored as HTML (from contenteditable editor) and rendered into innerHTML.
// Anything pasted in from external sources is sanitized here before re-render.
function sanitizeNoteHTML(html){
  if (!html) return '';
  let out = String(html);
  // Strip dangerous elements (including their contents)
  out = out.replace(/<(script|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  // Also strip self-closing or unmatched opening tags of those
  out = out.replace(/<\/?(?:script|iframe|object|embed)\b[^>]*>/gi, '');
  // Drop a trailing unterminated tag fragment — it can't be attribute-cleaned safely.
  const lastLt = out.lastIndexOf('<');
  if (lastLt !== -1 && out.indexOf('>', lastLt) === -1) out = out.slice(0, lastLt);
  // Clean attributes INSIDE TAGS ONLY, one tag at a time. Running the attribute
  // regexes over the whole string also matched ordinary prose: «Prøvemiddag onsdag =
  // 18:00» looked like an on*= handler and was silently deleted, and the note editor's
  // autosave then persisted the truncated text. See ADR 0021.
  out = out.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g,
    (m, close, tag, attrs) => {
      if (close) return '</' + tag + '>';
      let selfClose = '';
      if (/\/\s*$/.test(attrs)) { attrs = attrs.replace(/\/\s*$/, ''); selfClose = '/'; }
      const cleaned = attrs
        // inline event handlers
        .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
        .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
        .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
        // unsafe URLs. Inline raster images (data:image/...;base64) are kept —
        // pasted screenshots are stored that way. See _noteUrlIsSafe / ADR 0020.
        .replace(/(href|src)\s*=\s*"([^"]*)"/gi, (mm, a, u) => _noteUrlIsSafe(u) ? mm : a + '="#"')
        .replace(/(href|src)\s*=\s*'([^']*)'/gi, (mm, a, u) => _noteUrlIsSafe(u) ? mm : a + "='#'")
        .replace(/(href|src)\s*=\s*([^\s>"']+)/gi, (mm, a, u) => _noteUrlIsSafe(u) ? mm : a + '="#"');
      return '<' + tag + cleaned + selfClose + '>';
    });
  return out;
}


// Generic list-reorder via drag-and-drop. Items must be draggable="true" with data-task-id.
// onReorder(draggedId, targetId, insertBefore) is called when a row is dropped onto another.
function setupListReorder(container, itemSelector, onReorder){
  if (!container) return;
  let draggedId = null;
  let draggedRow = null;
  container.querySelectorAll(itemSelector).forEach(row=>{
    row.addEventListener('dragstart', e=>{
      draggedId = row.dataset.taskId || row.dataset.reorderId;
      draggedRow = row;
      e.dataTransfer.effectAllowed = 'move';
      // Use a sentinel so other drop listeners can decide whether it's a reorder
      try { e.dataTransfer.setData('text/x-reorder', '1'); } catch(_){}
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', ()=>{
      row.classList.remove('dragging');
      container.querySelectorAll('.drop-before,.drop-after').forEach(r=>r.classList.remove('drop-before','drop-after'));
      draggedId = null;
      draggedRow = null;
    });
    row.addEventListener('dragover', e=>{
      const targetId = row.dataset.taskId || row.dataset.reorderId;
      if (!draggedId || draggedId === targetId) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      const rect = row.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height/2;
      container.querySelectorAll('.drop-before,.drop-after').forEach(r=>r.classList.remove('drop-before','drop-after'));
      row.classList.toggle('drop-before', before);
      row.classList.toggle('drop-after', !before);
    });
    row.addEventListener('dragleave', ()=>{
      row.classList.remove('drop-before','drop-after');
    });
    row.addEventListener('drop', e=>{
      const targetId = row.dataset.taskId || row.dataset.reorderId;
      if (!draggedId || draggedId === targetId) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = row.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height/2;
      onReorder(draggedId, targetId, before);
    });
  });
}

// Per-element horizontal swipe with visual feedback. Used for swipe-to-complete on tasks.
function addSwipeActions(element, onRight, onLeft){
  let startX = 0, startY = 0, touching = false, startTime = 0, moved = false;
  element.addEventListener('touchstart', e=>{
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    touching = true;
    moved = false;
    startTime = Date.now();
  }, { passive: true });
  element.addEventListener('touchmove', e=>{
    if (!touching) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 10){
      moved = true;
      element.style.transform = `translateX(${dx*0.6}px)`;
      element.style.transition = 'none';
      if (dx > 60){
        element.style.background = 'rgba(125,167,125,0.18)';
      } else if (dx < -60){
        element.style.background = 'rgba(200,80,62,0.18)';
      } else {
        element.style.background = '';
      }
    }
  }, { passive: true });
  element.addEventListener('touchend', e=>{
    if (!touching) return;
    touching = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    const dt = Date.now() - startTime;
    element.style.transition = 'transform 200ms ease, background 200ms ease';
    element.style.transform = '';
    element.style.background = '';
    if (moved && Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 1000){
      if (dx > 0 && onRight) onRight();
      else if (dx < 0 && onLeft) onLeft();
    }
  }, { passive: true });
}

// Touch swipe helper. Calls onLeft when user swipes left (next), onRight when swipes right (previous).
function setupSwipeNavigation(element, onLeft, onRight){
  if (!element) return;
  let startX = 0, startY = 0, touching = false, startTime = 0;
  element.addEventListener('touchstart', e=>{
    if (e.touches.length !== 1) { touching = false; return; }
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    touching = true;
    startTime = Date.now();
  }, { passive: true });
  element.addEventListener('touchend', e=>{
    if (!touching) return;
    touching = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    const dt = Date.now() - startTime;
    // Require: enough horizontal distance, mostly horizontal (not vertical scroll), reasonably fast
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.8 && dt < 800){
      if (dx < 0) onLeft && onLeft();
      else onRight && onRight();
    }
  }, { passive: true });
}

// ============================================================
// DUMPEFELT — parse messy text into structured To Do's
// ============================================================
const _MONTH_NAMES = ['januar','februar','mars','april','mai','juni','juli','august','september','oktober','november','desember'];
const _MONTH_SHORT = ['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des'];
const _WEEKDAYS = ['mandag','tirsdag','onsdag','torsdag','fredag','lørdag','søndag'];
const _WEEKDAYS_SHORT = ['man','tir','ons','tor','fre','lør','søn'];

function parseDumpLine(line, today){
  let title = line.trim();
  if (!title) return null;
  // Strip common list prefixes
  title = title.replace(/^[-*•▪▫–—]\s+/, '');
  title = title.replace(/^\[\s*[xX✓]?\s*\]\s+/, '');
  title = title.replace(/^\d+[.)]\s+/, '');
  title = title.replace(/^TODO:?\s*/i, '');
  title = title.replace(/^ToDo:?\s*/i, '');
  title = title.replace(/^Oppg(ave)?:?\s*/i, '');

  // Detect priority
  let priority = '';
  const urgentRe = /\b(urgent|asap|kritisk|haster|viktig|prio(rity|ritet)?\s*1)\b/i;
  if (urgentRe.test(title)){
    priority = 'urgent';
    title = title.replace(urgentRe, '').trim();
  } else if (/\b(senere|kanskje|en\s*gang|når\s*det\s*passer|long.?term)\b/i.test(title)){
    priority = 'long';
    title = title.replace(/\b(senere|kanskje|en\s*gang|når\s*det\s*passer|long.?term)\b/gi, '').trim();
  }

  // Detect date
  let due = '';
  const t = new Date(today);
  const tryDate = (re, computeDate) => {
    const m = title.match(re);
    if (m){
      const d = computeDate(m);
      if (d){
        due = dKey(d);
        title = title.replace(re, '').trim();
        return true;
      }
    }
    return false;
  };

  // Relative phrases first
  if (!tryDate(/\bi\s*dag\b|\bidag\b/i, ()=>t)){
  if (!tryDate(/\bi\s*morgen\b|\bimorgen\b/i, ()=>addDays(t,1))){
  if (!tryDate(/\bi\s*overmorgen\b|\bovermorgen\b/i, ()=>addDays(t,2))){
  if (!tryDate(/\bom\s*(\d+)\s*dag(er)?\b/i, m=>addDays(t, parseInt(m[1])))){
  if (!tryDate(/\bom\s*en\s*uke\b|\bneste\s*uke\b/i, ()=>addDays(t,7))){
  if (!tryDate(/\bom\s*(\d+)\s*uke(r)?\b/i, m=>addDays(t, parseInt(m[1])*7))){
  if (!tryDate(/\bneste\s*måned\b/i, ()=>{ const x=new Date(t); x.setMonth(x.getMonth()+1); return x; })){
  // Weekday names — match next occurrence
  const wkRe = new RegExp(`\\b(neste\\s+)?(${_WEEKDAYS.concat(_WEEKDAYS_SHORT).join('|')})\\b`, 'i');
  if (!tryDate(wkRe, m=>{
    const word = m[2].toLowerCase();
    let idx = _WEEKDAYS.findIndex(w=>w.startsWith(word.slice(0,3)));
    if (idx < 0) return null;
    const todayIdx = monIdx(t);
    let ahead = idx - todayIdx;
    if (ahead <= 0 || /neste/i.test(m[1]||'')) ahead += 7;
    return addDays(t, ahead);
  })){
  // ISO date 2026-06-15
  if (!tryDate(/\b(\d{4})-(\d{2})-(\d{2})\b/, m=>new Date(parseInt(m[1]),parseInt(m[2])-1,parseInt(m[3])))){
  // Norwegian "15. juni" or "15 juni 2027"
  const monthRe = new RegExp(`\\b(\\d{1,2})\\.?\\s+(${_MONTH_NAMES.concat(_MONTH_SHORT).join('|')})(\\s+(\\d{4}))?\\b`, 'i');
  if (!tryDate(monthRe, m=>{
    const day = parseInt(m[1]);
    const monthStr = m[2].toLowerCase();
    let mIdx = _MONTH_NAMES.indexOf(monthStr);
    if (mIdx < 0) mIdx = _MONTH_SHORT.indexOf(monthStr);
    if (mIdx < 0 || day < 1 || day > 31) return null;
    let year = m[4] ? parseInt(m[4]) : t.getFullYear();
    const candidate = new Date(year, mIdx, day);
    if (!m[4] && candidate < t) year++;
    return new Date(year, mIdx, day);
  })){
    // No date found — leave due empty
  }}}}}}}}}}

  // Detect category hints
  let category = 'arbeid'; // default
  if (/\b(hans|partner|familie|venn|bryllup|leilighet|ferie|tur|reise|hjem|privat)\b/i.test(title)){
    category = 'privat';
  }

  // Cleanup
  title = title.replace(/\s+/g, ' ').replace(/^[,;:.\s]+|[,;:\s]+$/g, '').trim();
  if (!title) return null;
  // Capitalize first letter
  title = title[0].toUpperCase() + title.slice(1);
  return { title, due, priority, category, include: true };
}

function parseDumpText(text){
  const today = new Date();
  return text.split(/\n/).map(l=>parseDumpLine(l, today)).filter(Boolean);
}

HANDLERS.openDumpModal = ()=>{
  openModal(`
    <h3>Dumpefelt — organisér rotete tekst</h3>
    <div class="body">
      <div style="font-size:12.5px;color:var(--ink-muted);line-height:1.5;margin-bottom:6px">
        Lim inn et notat med flere oppgaver, så plukker planleggeren ut hver linje og prøver å gjette dato og prioritet.<br>
        <strong>Tolker:</strong> "i dag", "i morgen", "fredag", "neste uke", "om 3 dager", "15. juni", "2026-06-15", "urgent", "viktig", "senere"
      </div>
      <textarea id="dump-input" rows="10" placeholder="F.eks.&#10;- Ringe blomsterleverandør i morgen&#10;- urgent: skrive utkast til tale fredag&#10;- Booke fly før 15. juni&#10;- [ ] kjøpe gave til pappa neste uke&#10;- Spør Hans om sommerferie senere&#10;- 2026-09-15 halvmaraton-påmelding" style="width:100%;padding:12px;border:1px solid var(--line);border-radius:8px;font-size:14px;font-family:var(--font);background:var(--surface);color:var(--ink);resize:vertical;min-height:160px"></textarea>
      <button id="dump-parse" class="btn btn-primary" style="align-self:flex-start;margin-top:6px">Analysér →</button>
      <div id="dump-preview"></div>
    </div>
    <div class="footer">
      <button data-action="closeModal" class="btn btn-ghost">${I18N.cancel}</button>
      <button id="dump-save" class="btn btn-primary" style="display:none">Lagre alle</button>
    </div>`);
  _focusLater('dump-input');

  let parsedItems = [];
  document.getElementById('dump-parse').onclick = ()=>{
    const text = document.getElementById('dump-input').value;
    parsedItems = parseDumpText(text);
    const preview = document.getElementById('dump-preview');
    if (!parsedItems.length){
      preview.innerHTML = '<div class="empty-state" style="margin-top:12px">Ingen oppgaver tolket. Sjekk at hver oppgave står på sin egen linje.</div>';
      document.getElementById('dump-save').style.display = 'none';
      return;
    }
    preview.innerHTML = `<div style="margin:14px 0 4px;font-size:12px;color:var(--ink-muted);font-weight:600;letter-spacing:.5px;text-transform:uppercase">${parsedItems.length} oppgaver tolket — sjekk og juster</div>` +
      parsedItems.map((it, i)=>`<div class="dump-item" style="display:grid;grid-template-columns:auto 1fr auto auto auto auto;gap:6px;align-items:center;padding:6px 0;border-top:1px solid var(--line-soft);font-size:12.5px">
        <input type="checkbox" ${it.include?'checked':''} data-i="${i}" class="dump-cb">
        <input type="text" value="${escapeAttr(it.title)}" data-i="${i}" class="dump-title" style="padding:5px 8px;border:1px solid var(--line);border-radius:5px;font-size:13px;background:var(--surface);color:var(--ink)">
        <input type="date" value="${it.due}" data-i="${i}" class="dump-due" style="padding:5px;border:1px solid var(--line);border-radius:5px;font-size:12px;background:var(--surface);color:var(--ink)">
        <select data-i="${i}" class="dump-prio" style="padding:5px;border:1px solid var(--line);border-radius:5px;font-size:11.5px;background:var(--surface);color:var(--ink)">
          <option value="" ${!it.priority?'selected':''}>—</option>
          <option value="urgent" ${it.priority==='urgent'?'selected':''}>⚠</option>
          <option value="short" ${it.priority==='short'?'selected':''}>↗</option>
          <option value="long" ${it.priority==='long'?'selected':''}>⤳</option>
        </select>
        <select data-i="${i}" class="dump-cat" style="padding:5px;border:1px solid var(--line);border-radius:5px;font-size:11.5px;background:var(--surface);color:var(--ink)">
          ${CATEGORIES.map(c=>`<option value="${c.id}" ${it.category===c.id?'selected':''}>${c.label}</option>`).join('')}
        </select>
      </div>`).join('');
    // Wire up live updates
    preview.querySelectorAll('.dump-cb').forEach(el=>el.onchange=e=>{ parsedItems[+e.target.dataset.i].include = e.target.checked; });
    preview.querySelectorAll('.dump-title').forEach(el=>el.oninput=e=>{ parsedItems[+e.target.dataset.i].title = e.target.value; });
    preview.querySelectorAll('.dump-due').forEach(el=>el.onchange=e=>{ parsedItems[+e.target.dataset.i].due = e.target.value; });
    preview.querySelectorAll('.dump-prio').forEach(el=>el.onchange=e=>{ parsedItems[+e.target.dataset.i].priority = e.target.value; });
    preview.querySelectorAll('.dump-cat').forEach(el=>el.onchange=e=>{ parsedItems[+e.target.dataset.i].category = e.target.value; });
    document.getElementById('dump-save').style.display = 'inline-flex';
  };

  document.getElementById('dump-save').onclick = ()=>{
    const toSave = parsedItems.filter(it=>it.include && it.title.trim());
    toSave.forEach(it=>{
      state.tasks.push({
        id: uid(),
        title: it.title.trim(),
        due: it.due || '',
        category: it.category || 'arbeid',
        priority: it.priority || '',
        done: false
      });
    });
    closeModal();
    showToast(`✓ ${toSave.length} oppgaver lagt til`);
    state.ui.view = 'todos';
    render();
  };
};

// Wikilink resolver — match on project title (case-insensitive), navigate to project
HANDLERS.resolveWikilink = (target)=>{
  const targetLower = (target||'').trim().toLowerCase();
  if (!targetLower) return;
  // Navigating with the note modal still open left it sitting on top of the project
  // that had just loaded behind it. Close it first — but don't run the note editor's
  // close-callback render, since we're about to render anyway.
  _onModalClose = null;
  if (document.querySelector('.modal-bg.open')) closeModal();
  const proj = state.projects.find(p=>p.title.toLowerCase() === targetLower);
  if (proj){
    HANDLERS.openProject(proj.id);
    return;
  }
  // Partial match
  const partial = state.projects.find(p=>p.title.toLowerCase().includes(targetLower));
  if (partial){
    if (confirm(`Fant ikke nøyaktig "${target}". Mente du "${partial.title}"?`)){
      HANDLERS.openProject(partial.id);
      return;
    }
  }
  showToast(`Fant ikke prosjekt "${target}"`);
};

// Find all places that reference [[targetTitle]] in their notes/description
function findBacklinks(targetTitle){
  const results = [];
  if (!targetTitle) return results;
  const escaped = targetTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\[\\[\\s*${escaped}\\s*\\]\\]`, 'i');
  state.projects.forEach(p=>{
    if (p.title.toLowerCase() === targetTitle.toLowerCase()) return;
    const noteTexts = (p.noteList||[]).map(n=>(n.content||'').replace(/<[^>]+>/g,' '));
    const sources = [p.notes, p.description, ...noteTexts];
    for (const text of sources){
      if (text && re.test(text)){
        results.push({type:'project', id:p.id, title:p.title, snippet: text.match(re).input.slice(Math.max(0, text.search(re)-20), text.search(re)+targetTitle.length+30) });
        break;
      }
    }
  });
  Object.entries(state.notes||{}).forEach(([k, n])=>{
    if (n && re.test(n)){
      results.push({type:'note', date:k, title:`Notat ${fmtDateShort(fromKey(k))}`, snippet: n });
    }
  });
  return results;
}

// Lightweight toast notification
// Skalerer et data-URL-bilde ned til `maxPx` på lengste side og re-koder som JPEG.
// Degraderer til originalen hvis canvas ikke er tilgjengelig (jsdom) eller lasting feiler
// — et litt for stort bilde er bedre enn et tapt bilde.
function _downscaleDataURL(dataUrl, maxPx, quality){
  return new Promise(resolve=>{
    // Tidsvakt: fyrer verken `onload` eller `onerror` (skjer i miljøer uten
    // bildedekoding, og ved korrupte data), ville løftet aldri blitt innfridd — og da
    // ble bildet hun limte inn aldri satt inn, uten et ord. Løs alltid, én gang.
    let done = false;
    const finish = (v)=>{ if (!done){ done = true; resolve(v); } };
    setTimeout(()=>{
      if (!done) console.warn('nedskalering svarte ikke i tid, bruker originalen');
      finish(dataUrl);
    }, 4000);
    const resolveOnce = finish;
    try {
      const img = new Image();
      img.onload = ()=>{
        try {
          const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
          if (scale >= 1 && dataUrl.length < 300*1024) return resolveOnce(dataUrl);  // alt lite nok
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          if (!ctx) return resolveOnce(dataUrl);
          ctx.drawImage(img, 0, 0, w, h);
          const out = c.toDataURL('image/jpeg', quality || 0.85);
          resolveOnce(out && out.length < dataUrl.length ? out : dataUrl);
        } catch (err){ console.warn('nedskalering feilet, bruker originalen', err); resolveOnce(dataUrl); }
      };
      img.onerror = ()=>{ console.warn('kunne ikke laste innlimt bilde, bruker originalen'); resolveOnce(dataUrl); };
      img.src = dataUrl;
    } catch (err){ console.warn('nedskalering ikke mulig', err); resolveOnce(dataUrl); }
  });
}

// Dialogen kan være lukket igjen før de 50 ms har gått — trykker Maria Esc raskt, eller
// lukker et bakgrunns-pull den, kastet `getElementById(...).focus()` en uncaught
// TypeError. Sju steder hadde samme mønster. ADR 0031.
function _focusLater(id, ms){
  setTimeout(()=>{ const el = document.getElementById(id); if (el) el.focus(); }, ms || 50);
}

// En toast om gangen. To samtidige la seg oppå hverandre i samme hjørne — med
// angre-knappen i toasten ble det plutselig viktig, for da kan den nederste være
// den eneste veien tilbake til slettede data.
// `undoAction` er `{label, action}` der action er et HANDLERS-navn; knappen får
// data-action og går gjennom den vanlige dispatcheren (ADR 0012).
function showToast(msg, duration, undoAction){
  duration = duration || 3000;
  document.querySelectorAll('.toast').forEach(el=>{ if (el.parentNode) el.parentNode.removeChild(el); });
  const t = document.createElement('div');
  t.className = 'toast';
  const span = document.createElement('span');
  span.textContent = msg;
  t.appendChild(span);
  if (undoAction && undoAction.action){
    const b = document.createElement('button');
    b.className = 'toast-action';
    b.textContent = undoAction.label || 'Angre';
    b.dataset.action = undoAction.action;
    t.appendChild(b);
  }
  document.body.appendChild(t);
  setTimeout(()=>{ if (t.parentNode) t.parentNode.removeChild(t); }, duration);
}

// ---------------------------------------------------------------------------
// ANGRE SLETTING (ADR 0039)
// Sletting var endelig: `confirm()` var hele sikkerhetsnettet, og på × for en fri
// To Do fantes ikke engang det. Ett angrepunkt om gangen, åtte sekunder, knapp i
// toasten. Bekreftelsesdialogene på enkeltelementer er fjernet i samme slengen —
// to sikkerhetsnett som gjør samme jobb betyr bare at man klikker seg gjennom det
// ene uten å lese det. `confirm()` står igjen der angring ikke dekker hele tapet:
// et helt prosjekt, alle forekomster av en gjentakende hendelse, massesletting.
// ---------------------------------------------------------------------------
const UNDO_MS = 8000;
let _undoEntry = null;
let _undoTimer = null;

function _clearUndo(){
  if (_undoTimer){ clearTimeout(_undoTimer); _undoTimer = null; }
  _undoEntry = null;
}

function registerUndo(label, restore){
  if (typeof restore !== 'function') return;
  _undoEntry = { label: label || 'slettingen', restore };
  if (_undoTimer) clearTimeout(_undoTimer);
  _undoTimer = setTimeout(()=>{ _undoEntry = null; _undoTimer = null; }, UNDO_MS);
  showToast(`Slettet ${label}`, UNDO_MS, { label: '↩ Angre', action: 'undoLast' });
}

// Fjerner ett element fra en liste og registrerer angrepunktet. `getArr` slås opp
// på nytt ved gjenoppretting i stedet for å fanges: et sky-pull mellom sletting og
// angring bytter ut hele `state`, og en fanget array-referanse ville da vært
// frakoblet — angringen hadde sett ut til å lykkes uten å endre noe synlig.
// Returnerer det fjernede objektet, eller null om det ikke fantes.
function deleteWithUndo(getArr, id, label){
  const arr = getArr();
  if (!Array.isArray(arr)) return null;
  const i = arr.findIndex(x => x && x.id === id);
  if (i < 0) return null;
  const removed = arr.splice(i, 1)[0];
  registerUndo(label, ()=>{
    const a = getArr();
    if (!Array.isArray(a)) return false;
    if (a.some(x => x && x.id === removed.id)) return true;
    a.splice(Math.min(i, a.length), 0, removed);
    return true;
  });
  return removed;
}

HANDLERS.undoLast = ()=>{
  const entry = _undoEntry;
  _clearUndo();
  if (!entry){ showToast('Ingenting å angre'); return; }
  let ok = false;
  try { ok = entry.restore() !== false; }
  catch (err){ console.warn('[undo] gjenoppretting feilet', err); ok = false; }
  if (!ok){ showToast('Kunne ikke angre — plasseringen finnes ikke lenger'); return; }
  render();
  showToast('Angret');
};

// Voice capture — converts speech to text and adds to inbox.
HANDLERS.startVoiceCapture = ()=>{
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR){
    alert('Talegjenkjenning er ikke støttet i denne nettleseren. Funker i Chrome/Edge på PC og Safari på iPhone.');
    return;
  }
  // Visual indicator while listening
  const indicator = document.createElement('div');
  indicator.style.cssText = 'position:fixed;bottom:90px;right:24px;background:var(--alert);color:#fff;padding:14px 22px;border-radius:30px;font-size:14px;z-index:200;box-shadow:0 6px 20px rgba(0,0,0,.2);display:flex;align-items:center;gap:10px';
  indicator.innerHTML = '<span style="width:10px;height:10px;background:#fff;border-radius:50%;display:inline-block;animation:pulse 1s ease-in-out infinite"></span>🎤 Lytter — snakk nå';
  document.body.appendChild(indicator);

  const recognition = new SR();
  recognition.lang = 'no-NO';
  recognition.continuous = false;
  recognition.interimResults = false;
  const cleanup = ()=>{ if (indicator.parentNode) indicator.parentNode.removeChild(indicator); };

  recognition.onresult = (event)=>{
    const text = event.results[0][0].transcript.trim();
    cleanup();
    if (text){
      state.inbox.push({id:uid(), text, createdAt:new Date().toISOString()});
      saveState();
      showToast(`✓ Lagt til i innboks: "${text.slice(0,50)}${text.length>50?'…':''}"`);
      render();
    }
  };
  recognition.onerror = (event)=>{
    cleanup();
    if (event.error && event.error !== 'aborted' && event.error !== 'no-speech'){
      alert('Talegjenkjenning feilet: ' + event.error);
    }
  };
  recognition.onend = cleanup;
  try { recognition.start(); }
  catch(err){
    // Var `catch(_){ cleanup(); }` — knappen så ut som den ikke gjorde noe. ADR 0032.
    console.error('talegjenkjenning startet ikke', err);
    cleanup();
    if (typeof showToast === 'function') showToast('⚠ Mikrofonen startet ikke: ' + (err.message||err) + '. Sjekk at nettleseren har mikrofontilgang.', 8000);
  }
};

// Paste handler for image-into-textarea
HANDLERS.goToday = goToday;

// ============================================================
// AUTO WEEKLY EXPORT — backup to a user-chosen folder (Edge/Chrome PC)
// or fall back to the browser's Downloads folder (iPhone, no folder set).
// File System Access API lets us write directly into e.g. OneDrive\Claude\Planner\backups
// after the user picks the folder ONCE. The handle is stored in IndexedDB and
// permission persists across sessions when the user clicks "Allow on every visit".
// ============================================================

// IndexedDB helpers — directory handles must be stored in IDB (not localStorage)
const BACKUP_IDB_NAME = 'planlegger-backup';
const BACKUP_IDB_STORE = 'handles';
const BACKUP_IDB_KEY = 'backupDir';

function _openBackupIDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BACKUP_IDB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(BACKUP_IDB_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function getBackupDirHandle(){
  try {
    const db = await _openBackupIDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(BACKUP_IDB_STORE, 'readonly');
      const req = tx.objectStore(BACKUP_IDB_STORE).get(BACKUP_IDB_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Skille «ingen mappe valgt» fra «klarte ikke spørre»: begge ga null, så en
    // forbigående IndexedDB-feil fikk Innstillinger til å si «bruker Nedlastinger» som
    // om hun aldri hadde valgt mappe. ADR 0031.
    console.error('Kunne ikke lese backup-mappe fra IndexedDB', err);
    _backupDirError = err.message || String(err);
    return null;
  }
}
let _backupDirError = null;
async function setBackupDirHandle(handle){
  try {
    const db = await _openBackupIDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(BACKUP_IDB_STORE, 'readwrite');
      tx.objectStore(BACKUP_IDB_STORE).put(handle, BACKUP_IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    _backupDirError = null;
    return { ok: true };
  } catch (e) {
    // Returnerte `undefined` både ved suksess og feil, så kalleren toastet
    // «✓ Backup-mappe satt» uansett.
    console.error('Could not save backup dir handle', e);
    _backupDirError = e.message || String(e);
    return { ok: false, error: _backupDirError };
  }
}
async function clearBackupDirHandle(){
  try {
    const db = await _openBackupIDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(BACKUP_IDB_STORE, 'readwrite');
      tx.objectStore(BACKUP_IDB_STORE).delete(BACKUP_IDB_KEY);
      tx.oncomplete = () => resolve({ ok: true });
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    // Var `catch {}`, og kalleren toastet «Backup-mappe fjernet» uansett. ADR 0032.
    console.error('kunne ikke fjerne backup-mappe fra IndexedDB', err);
    return { ok: false, error: err.message || String(err) };
  }
}

// User clicks "Velg backup-mappe" in Settings — must be inside a user gesture
HANDLERS.chooseBackupFolder = async () => {
  if (!window.showDirectoryPicker){
    alert('Din nettleser støtter ikke å velge mappe (denne funksjonen fungerer best i Edge/Chrome på PC). Backup-filer lagres til Nedlastinger som vanlig.');
    return;
  }
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    // Request explicit write permission (often persistent if user picks "Allow on every visit")
    const perm = await handle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted'){
      alert('Skrivetillatelse ble ikke gitt. Velg mappen på nytt og klikk Tillat.');
      return;
    }
    const res = await setBackupDirHandle(handle);
    if (typeof showToast === 'function'){
      if (res && res.ok) showToast(`✓ Backup-mappe satt: ${handle.name}`, 4000);
      else showToast(`⚠ Klarte ikke huske mappevalget (${(res&&res.error)||'ukjent feil'}). Backupene går til Nedlastinger.`, 12000);
    }
    // Refresh Settings UI if open
    if (document.querySelector('.modal-bg.open')){ closeModal(); openSettings(); }
  } catch (e){
    if (e.name !== 'AbortError') console.error('chooseBackupFolder failed', e);
  }
};
HANDLERS.clearBackupFolder = async () => {
  if (!confirm('Fjern den valgte backup-mappen? Etter dette går backups til Nedlastinger igjen til du velger en ny mappe.')) return;
  const res = await clearBackupDirHandle();
  if (typeof showToast === 'function'){
    if (res && res.ok === false) showToast('⚠ Klarte ikke fjerne mappevalget (' + res.error + ') — det kan komme tilbake ved neste omstart.', 10000);
    else showToast('Backup-mappe fjernet', 3000);
  }
  if (document.querySelector('.modal-bg.open')){ closeModal(); openSettings(); }
};

// Main auto-export: tries chosen folder first, falls back to Downloads. Runs on boot.
async function autoWeeklyExport(){
  try {
    const last = state.sync.lastWeeklyExport;
    const hasData = (state.projects||[]).length
      + (state.tasks||[]).length
      + (state.events||[]).length > 0;
    if (!hasData) return;

    const today = new Date();
    const lastDate = last ? new Date(last) : null;
    const daysSince = lastDate ? Math.floor((today.getTime() - lastDate.getTime()) / 86400000) : Infinity;
    if (daysSince < 7) return;

    const dateStr = todayKey();
    const filename = `planlegger-backup-${dateStr}.json`;
    const jsonData = JSON.stringify(state, null, 2);

    // 1. Try chosen folder via File System Access API
    const dirHandle = await getBackupDirHandle();
    if (dirHandle && dirHandle.queryPermission){
      try {
        const perm = await dirHandle.queryPermission({ mode: 'readwrite' });
        if (perm === 'granted'){
          const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(jsonData);
          await writable.close();
          state.sync.lastWeeklyExport = today.toISOString();
          saveState();
          if (typeof showToast === 'function') setTimeout(() => showToast(`💾 Ukentlig sikkerhetskopi lagret i ${dirHandle.name}`, 5000), 800);
          return;
        }
        // Permission lapsed. requestPermission() requires user activation, and this
        // runs at boot — Chrome throws SecurityError, which used to be swallowed so
        // the backup silently degraded to Downloads on every browser restart. Only
        // try it if the document currently has activation; otherwise skip straight to
        // the download and let Settings show the ⚠. See ADR 0023.
        if (!(navigator.userActivation && navigator.userActivation.isActive)){
          console.warn('Backup folder permission needs a click to renew — falling back to Downloads');
          throw new Error('permission-needs-activation');
        }
        const newPerm = await dirHandle.requestPermission({ mode: 'readwrite' });
        if (newPerm === 'granted'){
          const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(jsonData);
          await writable.close();
          state.sync.lastWeeklyExport = today.toISOString();
          saveState();
          if (typeof showToast === 'function') setTimeout(() => showToast(`💾 Ukentlig sikkerhetskopi lagret i ${dirHandle.name}`, 5000), 800);
          return;
        }
        // Otherwise fall through to download
      } catch (e){ console.error('Could not write to backup folder, falling back to Downloads', e); }
    }

    // 2. Fallback: trigger download to default Downloads folder
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);

    // Deliberately NOT stamping lastWeeklyExport here. a.click() gives no confirmation
    // that anything was written — on iOS, or when the browser blocks the download,
    // nothing lands anywhere. Stamping it made the 7-day timer claim success and hid
    // months of silent no-ops. Leaving it unstamped means we retry next load, and the
    // wording below no longer promises a saved file. See ADR 0023.
    if (typeof showToast === 'function') setTimeout(() => showToast('💾 Ukentlig sikkerhetskopi lastes ned. Velg en mappe i ⚙ Innstillinger for å lagre den automatisk.', 8000), 800);
  } catch (err) { console.error('autoWeeklyExport failed', err); }
}

// Auto-backup: once per day, save current state to localStorage. Keep last 7 days.
let _backupStatus = { ok: null, at: 0, error: null };
function autoBackup(){
  const todayK = todayKey();
  const backupKey = 'planlegger.backup.' + todayK;
  if (localStorage.getItem(backupKey)) return;   // already backed up today
  _pruneSnapshotsToBudget();                     // make room before, not after
  try {
    localStorage.setItem(backupKey, _snapshotJSON());
    const allKeys = Object.keys(localStorage).filter(k=>k.startsWith('planlegger.backup.')).sort();
    while (allKeys.length > 7) localStorage.removeItem(allKeys.shift());
    _pruneSnapshotsToBudget();
    // Beskjæringen kan ha spist backupen vi nettopp skrev. Å stemple `ok` uten å sjekke
    // er samme feil som `catch(_){}` — bare med et hyggeligere ansikt. ADR 0031.
    if (!localStorage.getItem(backupKey)){
      _backupStatus = { ok: false, at: Date.now(), error: 'skrevet, men beskåret bort — for lite plass' };
      console.error('autoBackup: dagens backup ble beskåret bort igjen', backupKey);
      if (typeof showToast === 'function'){
        showToast('⚠ Dagens lokale backup fikk ikke plass. Eksportér til JSON fra ⚙ Innstillinger.', 12000);
      }
      return;
    }
    _backupStatus = { ok: true, at: Date.now() };
  } catch (err){
    // Dette var `catch(_){}`. Kvoten ble full rundt 26. mai 2026 og hver eneste
    // dagsbackup siden har kastet i stillhet — 2,5 måneder uten lokal backup, uten
    // et tegn noe sted. Nøyaktig samme signatur som ICS-URL-en. Se ADR 0022 og 0030.
    _backupStatus = { ok: false, at: Date.now(), error: err.message || String(err) };
    console.error('autoBackup failed', err);
    if (typeof showToast === 'function'){
      showToast('⚠ Klarte ikke lagre dagens lokale backup: lagringsplassen er full. Eksportér til JSON fra ⚙ Innstillinger.', 12000);
    }
  }
}
function listBackups(){
  // Kronologisk på parset tid, ikke på strengen — se _snapshotTime. `unreadable.*` vises
  // ikke i lista (den er en ødelagt blob, ikke noe å gjenopprette fra med vilje).
  return Object.keys(localStorage)
    .filter(k=>k.startsWith('planlegger.backup.') || k.startsWith('planlegger.preSync.'))
    .sort((a,b)=> _snapshotTime(b) - _snapshotTime(a));
}
// «En feil som ikke vises, finnes ikke» (ADR 0022). Toasten kommer i det øyeblikket
// det feiler, men den forsvinner — og dagsbackupen var død i 2,5 måneder nettopp fordi
// ingenting viste tilstanden noe sted. Her står den.
function _backupStatusHTML(){
  const used = Object.keys(localStorage).reduce((s,k)=> s + k.length + (localStorage.getItem(k)||'').length, 0);
  const usedKB = Math.round(used/1024);
  const newest = Object.keys(localStorage).filter(k=>k.startsWith('planlegger.backup.'))
    .sort((a,b)=> _snapshotTime(a) - _snapshotTime(b)).pop();
  const dayStr = newest ? newest.replace('planlegger.backup.','') : null;
  const stale = dayStr && dayStr !== todayKey();
  // Fordelingen skal vises uansett status. Den lå bare i den siste grenen, så en feilet
  // backup skjulte hele oversikten over hvor plassen går — presis når man trenger den.
  if (_backupStatus.ok === false){
    return `<div style="font-size:12px;color:var(--alert);padding:2px 0">⚠ Dagens backup feilet: ${escapeHTML(_backupStatus.error||'ukjent')}. Eksportér til JSON.</div>`
      + `<div style="font-size:12px;color:var(--alert);padding:2px 0">localStorage bruker ${usedKB} kB av ~5000</div>`
      + _storageBreakdownHTML();
  }
  const note = !dayStr ? '⚠ Ingen dagsbackup ennå'
    : stale ? `⚠ Nyeste dagsbackup er fra ${dayStr}`
    : `✓ Dagsbackup tatt i dag (${dayStr})`;
  const col = (!dayStr || stale) ? 'var(--alert)' : 'var(--ink-muted)';
  return `<div style="font-size:12px;color:${col};padding:2px 0">${note} · localStorage bruker ${usedKB} kB av ~5000</div>`
    + _storageBreakdownHTML();
}

// Hvor plassen faktisk går. Uten dette var «4951 kB brukt» et tall uten handling bak.
function _storageBreakdownHTML(){
  const kb = o => Math.round(JSON.stringify(o == null ? null : o).length / 1024);
  const doneCount = (state.tasks||[]).filter(t=>t.done).length;
  const totalTasks = (state.tasks||[]).length;
  const doneKB = kb((state.tasks||[]).filter(t=>t.done));
  const parts = [
    `Outlook-cache ${kb(state.outlookEvents||[])} kB`,
    `oppgaver ${kb(state.tasks||[])} kB`,
    `prosjekter ${kb(state.projects||[])} kB`,
    `dagsnotater ${kb(state.notes||{})} kB`,
  ];
  let html = `<div style="font-size:11.5px;color:var(--ink-muted);padding:1px 0">${parts.join(' · ')}</div>`;
  if (doneCount >= 25){
    // Fullførte oppgaver akkumulerer for alltid; visningen kappes til 20, lageret ikke.
    // Ikke automatisk sletting — det er datatap. Et eksplisitt valg, med øyeblikksbilde
    // først, slik at det kan rulles tilbake. ADR 0032.
    html += `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;padding:3px 0">
      <span style="color:var(--ink-muted)">${doneCount} av ${totalTasks} oppgaver er fullført (${doneKB} kB)</span>
      <button data-action="purgeDoneTasks" style="padding:3px 8px;font-size:11.5px;border-radius:5px;border:1px solid var(--line);background:#fff;color:var(--ink-soft)">Rydd bort</button>
    </div>`;
  }
  // Titler som gjentar prosjektnavnet. Raden vises bare når det finnes noe å gjøre. ADR 0035.
  const dupes = findRedundantPrefixes().length;
  if (dupes){
    html += `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;padding:3px 0">
      <span style="color:var(--ink-muted)">${dupes} ${dupes===1?'tittel gjentar':'titler gjentar'} prosjektnavnet (taggen viser det alt)</span>
      <button data-action="cleanProjectPrefixes" style="padding:3px 8px;font-size:11.5px;border-radius:5px;border:1px solid var(--line);background:#fff;color:var(--ink-soft)">Rydd opp</button>
    </div>`;
  }
  return html;
}

// ============================================================
// REDUNDANT PROSJEKT-PREFIKS I TITLER (ADR 0035)
// ============================================================
// Prosjektnavnet skrives inn i tittelen selv om taggen alt viser det:
// «Meox: Sende EOGF protokoll til signering». Dobbelt opp — og etter ADR 0033 spiser det
// plassen på prosjektkortene, der titlene kappes.
//
// **Regelen er streng med vilje.** Målt på Marias egne data 2026-08-12: 8 titler hadde et
// ledende «Ord:», og én av dem var «Shive: Lage en peer analyse» — tagget til prosjektet
// *Dealflow*. «Shive» er et selskap i pipelinen, ikke prosjektnavnet, så å fjerne det
// ville slettet informasjon. Derfor må prefikset matche det TAGGEDE prosjektets tittel,
// på ordgrense: «Meox» → «Meox AS» ✓, «Shive» → «Dealflow» ✗.
const PREFIX_MIN_LEN = 3;

// Tittelen uten prefikset, eller null hvis den ikke kvalifiserer.
function _stripProjectPrefix(title, projectTitle){
  if (!title || !projectTitle) return null;
  const m = /^\s*([^:]{2,60}?)\s*:\s*(.+)$/.exec(title);
  if (!m) return null;
  const prefix = m[1].trim();
  const rest = m[2].trim();
  if (prefix.length < PREFIX_MIN_LEN || !rest) return null;
  const pt = projectTitle.trim().toLowerCase();
  const px = prefix.toLowerCase();
  if (!pt.startsWith(px)) return null;
  // Ordgrense: «Meox» mot «Meox AS» er greit, «Me» mot «Meox AS» er det ikke.
  const next = pt.charAt(px.length);
  if (next && /[a-zæøåéèü0-9]/i.test(next)) return null;
  return rest;
}

// Alle titler som ville blitt endret, med nok kilde til å gjøre endringen.
function findRedundantPrefixes(){
  const out = [];
  (state.tasks||[]).forEach(t=>{
    if (!t.projectId) return;
    const p = (state.projects||[]).find(x=>x.id===t.projectId);
    if (!p) return;
    const stripped = _stripProjectPrefix(t.title, p.title);
    if (stripped) out.push({ kind:'free', id:t.id, project:p.title, from:t.title, to:stripped });
  });
  (state.projects||[]).forEach(p=>(p.tasks||[]).forEach(t=>{
    const stripped = _stripProjectPrefix(t.title, p.title);
    if (stripped) out.push({ kind:'sub', id:t.id, projectId:p.id, project:p.title, from:t.title, to:stripped });
  }));
  return out;
}

// Aldri automatisk. Hun skal se hver enkelt endring før noe skjer.
HANDLERS.cleanProjectPrefixes = ()=>{
  const hits = findRedundantPrefixes();
  if (!hits.length){
    if (typeof showToast === 'function') showToast('Ingen titler gjentar prosjektnavnet.', 4000);
    return;
  }
  const preview = hits.slice(0, 12).map(h=>`  «${h.from}»\n    → «${h.to}»   (${h.project})`).join('\n');
  const more = hits.length > 12 ? `\n  … og ${hits.length - 12} flere` : '';
  if (!confirm(`Fjerne prosjektnavnet fra ${hits.length} ${hits.length===1?'tittel':'titler'}?\n\n`
    + `Taggen viser prosjektet allerede.\n\n${preview}${more}\n\n`
    + `Et øyeblikksbilde lagres først, så du kan rulle tilbake fra «Lokale backups».`)) return;
  const snap = _writePreSyncSnapshot();
  if (!snap.ok && !confirm('Øyeblikksbildet kunne ikke lagres, så dette kan IKKE angres. Fortsette likevel?')) return;

  let n = 0;
  hits.forEach(h=>{
    if (h.kind === 'free'){
      const t = (state.tasks||[]).find(x=>x.id===h.id);
      if (t && t.title === h.from){ t.title = h.to; n++; }
    } else {
      const p = (state.projects||[]).find(x=>x.id===h.projectId);
      const t = p && (p.tasks||[]).find(x=>x.id===h.id);
      if (t && t.title === h.from){ t.title = h.to; n++; }
    }
  });
  saveState();
  if (typeof showToast === 'function') showToast(`✓ Prosjektnavnet fjernet fra ${n} ${n===1?'tittel':'titler'}. Angre via «Lokale backups».`, 8000);
  closeModal(); openSettings(); render();
};

// Fjerner fullførte oppgaver fra state — etter et øyeblikksbilde, så det kan angres via
// «Lokale backups» under. Aldri automatisk, aldri uten bekreftelse.
HANDLERS.purgeDoneTasks = ()=>{
  const done = (state.tasks||[]).filter(t=>t.done);
  if (!done.length){ if (typeof showToast === 'function') showToast('Ingen fullførte oppgaver å rydde bort.', 4000); return; }
  if (!confirm(`Fjerne ${done.length} fullførte oppgaver?\n\nEt øyeblikksbilde lagres først, så du kan rulle tilbake fra «Lokale backups» i Innstillinger.`)) return;
  const snap = _writePreSyncSnapshot();
  if (!snap.ok && !confirm('Øyeblikksbildet kunne ikke lagres, så dette kan IKKE angres. Fortsette likevel?')) return;
  state.tasks = (state.tasks||[]).filter(t=>!t.done);
  saveState();
  if (typeof showToast === 'function') showToast(`✓ ${done.length} fullførte oppgaver ryddet bort. Angre via «Lokale backups».`, 8000);
  closeModal(); openSettings(); render();
};
HANDLERS.restoreBackup = (key)=>{
  const dateStr = key.replace('planlegger.backup.','').replace('planlegger.preSync.','');
  if (!confirm(`Erstatt ALL nåværende data med backup fra ${dateStr}? Dette kan ikke angres.`)) return;
  const data = localStorage.getItem(key);
  if (!data){ alert('Backup ikke funnet'); return; }
  // Øyeblikksbilde først — restoreCloudBackup gjorde det, den lokale varianten ikke,
  // så å gjenopprette feil dag etterlot ingenting å rulle tilbake til. Se ADR 0022.
  // Skrives etter confirm(): før flyttet et avbrutt forsøk likevel ringen framover.
  // Merk: nøkkelen vi gjenoppretter FRA kan bli beskåret bort av øyeblikksbildet vi
  // skriver nå, så `data` er lest ut på forhånd. Ikke bytt om på rekkefølgen.
  _writePreSyncSnapshot();
  try {
    // Et øyeblikksbilde uten Outlook-cachen skal ikke tømme kalenderen. Se ADR 0030.
    state = _mergeSnapshot(JSON.parse(data));
    saveState();
    closeModal();
    render();
  } catch(e){ alert('Klarte ikke gjenopprette: '+e.message); }
};

// Auto-archive: any project past its target where everything is done.
function autoArchivePastProjects(){
  const today = todayKey();
  let archived = 0;
  (state.projects||[]).forEach(p=>{
    if (p.archived) return;
    if (!p.targetDate) return;
    const endDate = p.targetEndDate || p.targetDate;
    if (endDate >= today) return;
    const hasIncompleteTasks = (p.tasks||[]).some(t=>!t.done);
    const hasIncompleteMilestones = (p.milestones||[]).some(m=>!m.done);
    if (hasIncompleteTasks || hasIncompleteMilestones) return;
    p.archived = true;
    archived++;
  });
  if (archived){ saveState(); }
}

// Inject SVG icons into static HTML elements
(function injectStaticIcons(){
  const search = document.querySelector('#search-btn .icon');
  if (search) search.innerHTML = ICONS.search;
  const settings = document.querySelector('#settings-btn .icon');
  if (settings) settings.innerHTML = ICONS.settings;
  const fab = document.getElementById('fab');
  if (fab) fab.innerHTML = `<span class="icon" style="width:24px;height:24px">${ICONS.plus}</span>`;
})();

// Boot
// Rydd ringene før noe annet skriver: en full kvote her betyr at dagsbackupen,
// ukesbackupen og hver saveState() feiler på rad. Se ADR 0030.
_pruneSnapshotsToBudget();
autoBackup();
autoWeeklyExport();
autoArchivePastProjects();
applyTheme();
// Adressen vinner over lagret posisjon ved oppstart, slik at et bokmerke eller en delt
// lenke åpner det den peker på. Uten hash speiles den lagrede tilstanden inn i URL-en,
// uten historikk-oppføring. Må skje FØR første render(). ADR 0036.
(function bootRoute(){
  const h = (location.hash || '').replace(/^#/, '');
  if (h && !_applyRoute(h)) console.warn('[route] ukjent adresse, bruker lagret posisjon:', h);
  _syncHash(false);
})();
render();
setupNotifications();
updateSyncIndicator();

// Re-render nav when crossing mobile/desktop breakpoint
(function watchBreakpoint(){
  const mq = window.matchMedia('(max-width: 700px)');
  let wasMobile = mq.matches;
  const onChange = () => {
    if (mq.matches !== wasMobile){
      wasMobile = mq.matches;
      renderTopbar();
    }
  };
  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else if (mq.addListener) mq.addListener(onChange);
  window.addEventListener('resize', onChange);
})();

// Sync on load + poll every 60s
// Polling som roer seg. Før: hvert 60. sekund, døgnet rundt, uansett om fanen var i
// bruk — og hvert kall lastet hele sky-blobben. Nå henter den ~35 kB i stedet for 652 kB
// (ADR 0032), men frekvensen var uansett feil: den pollet i timevis mens PC-en sto låst.
// Nå: pause når fanen er skjult, umiddelbart pull når den blir synlig igjen, og
// dobling av intervallet opp til 8 minutter når ingenting endrer seg.
const SYNC_POLL_MIN_MS = 60*1000;
const SYNC_POLL_MAX_MS = 8*60*1000;
let _pollTimer = null;
let _pollDelay = SYNC_POLL_MIN_MS;

// Egen funksjon fordi den er verdt å teste: endret noe seg, tilbake til hyppig; ellers
// dobling opp til taket.
function _nextPollDelay(current, changed){
  if (changed) return SYNC_POLL_MIN_MS;
  return Math.min(SYNC_POLL_MAX_MS, Math.max(SYNC_POLL_MIN_MS, current) * 2);
}
function _stopPolling(){ if (_pollTimer){ clearTimeout(_pollTimer); _pollTimer = null; } }
function _schedulePoll(delay){
  _stopPolling();
  if (!state.sync.syncUrl || !state.sync.syncToken) return;
  _pollTimer = setTimeout(async ()=>{
    if (typeof document !== 'undefined' && document.hidden){
      _schedulePoll(_pollDelay);          // skjult: ikke hent, bare planlegg på nytt
      return;
    }
    let changed = false;
    try { const r = await pullFromRemote(true); changed = !!(r && r.pulled); } catch(_){}
    _pollDelay = _nextPollDelay(_pollDelay, changed);
    _schedulePoll(_pollDelay);
  }, delay);
}

(function bootSync(){
  if (!state.sync.syncUrl || !state.sync.syncToken) return;
  pullFromRemote();
  _schedulePoll(SYNC_POLL_MIN_MS);
  if (typeof document !== 'undefined' && document.addEventListener){
    document.addEventListener('visibilitychange', ()=>{
      if (document.hidden){ _stopPolling(); return; }
      // Tilbake i bruk: hent med én gang og start på det korte intervallet igjen.
      _pollDelay = SYNC_POLL_MIN_MS;
      pullFromRemote(true).catch(err=>console.error('pull ved fokus feilet', err));
      _schedulePoll(_pollDelay);
    });
  }
})();

// Auto-sync Outlook on load if URL is set and last sync > 1 hour ago (or never)
(function autoSyncOutlook(){
  if (!state.sync.icsUrl) return;
  const last = state.sync.lastSync ? new Date(state.sync.lastSync).getTime() : 0;
  const ageMin = (Date.now() - last) / 60000;
  if (ageMin > 60){
    syncOutlook(true).then(r=>{
      if (r.ok) render();
      // Errors used to be dropped entirely — a rotated feed URL or a worker outage
      // just left yesterday's meetings on screen with no hint. See ADR 0023.
      else if (r.error){
        _outlookStatus = { failedAt: Date.now(), error: r.error };
        console.error('Outlook auto-sync failed:', r.error);
        if (typeof showToast === 'function') showToast('⚠ Outlook-sync feilet: ' + r.error + ' — kalenderen kan være utdatert.', 10000);
        updateSyncIndicator();
      }
    });
  }
})();

