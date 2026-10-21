// Prototype statique : navigation entre écrans, thème clair/sombre, menu mobile, filtres de démonstration.
// Aucune donnée réelle, aucun appel réseau.
const screens = [...document.querySelectorAll('[data-screen]')];
const navLinks = [...document.querySelectorAll('[data-nav]')];

/** Affiche un écran (ou la page de connexion) et met à jour la navigation. */
function go(name) {
  document.body.dataset.view = name === 'login' ? 'login' : 'app';
  if (name === 'login') return;
  const agendaMode = name === 'agenda-mois' ? 'mois' : 'semaine';
  if (name === 'agenda-mois') name = 'agenda';
  if (name === 'agenda' && window.setAgendaView) window.setAgendaView(agendaMode);
  if (name === 'opportunites') name = 'pipeline';
  const target = screens.some((s) => s.dataset.screen === name) ? name : 'soon';
  if (window.applyNav) window.applyNav(target);
  screens.forEach((s) => s.classList.toggle('on', s.dataset.screen === target));
  navLinks.forEach((a) => (a.dataset.nav === target ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  document.getElementById('sidebar').classList.remove('open');
  window.scrollTo(0, 0);
}

function fromHash() {
  const name = location.hash.replace('#', '') || 'login';
  go(name);
}
window.addEventListener('hashchange', fromHash);
fromHash();

// Thème : clair, sombre ; mémorisé si le navigateur le permet (jamais obligatoire).
const root = document.documentElement;
const themeIcon = document.querySelector('#themeBtn use');
function applyTheme(theme) {
  root.dataset.theme = theme;
  themeIcon.setAttribute('href', theme === 'dark' ? '#i-sun' : '#i-moon');
}
try {
  const asked = new URLSearchParams(location.search).get('theme'); // ?theme=dark : lien de démonstration
  const saved = asked === 'dark' || asked === 'light' ? asked : localStorage.getItem('investally-theme');
  if (saved) applyTheme(saved);
  else if (matchMedia('(prefers-color-scheme: dark)').matches) applyTheme('dark');
} catch { /* stockage indisponible : on garde le thème par défaut */ }
document.getElementById('themeBtn').addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem('investally-theme', next); } catch { /* ignoré */ }
});

// Menu mobile
const menuBtn = document.getElementById('menuBtn');
menuBtn.addEventListener('click', () => {
  const open = document.getElementById('sidebar').classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', String(open));
});

// Onglets et filtre de démonstration de la liste d'entreprises
document.querySelectorAll('[role=tablist]').forEach((list) => {
  list.addEventListener('click', (event) => {
    const tab = event.target.closest('[role=tab]');
    if (!tab) return;
    list.querySelectorAll('[role=tab]').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
    const filter = tab.dataset.filter;
    if (!filter) return;
    document.querySelectorAll('[data-screen=companies] tbody tr').forEach((row) => {
      row.hidden = filter === 'mine' ? !row.dataset.mine : filter === 'late' ? !row.dataset.late : false;
    });
  });
});

// Le logo Investudy fourni est un petit PNG (199×63) : si le fichier manque, on affiche le mot-symbole de secours.
document.querySelectorAll('.logo-investudy').forEach((img) => {
  img.addEventListener('error', () => {
    const fallback = document.createElement('span');
    fallback.className = 'wordmark';
    fallback.innerHTML = 'Invest<b>udy</b>';
    img.replaceWith(fallback);
  });
});

// ---------- EXD-02 : sélection persistante des lignes ----------
function syncBulk(table, bar, label) {
  const selected = table.querySelectorAll('tbody tr.is-selected').length;
  if (!bar) return;
  bar.hidden = selected === 0;
  label.textContent = selected + (selected > 1 ? ' sélectionnées' : ' sélectionnée');
  const all = table.querySelector('thead input[type=checkbox]');
  if (all) all.checked = selected > 0 && selected === table.querySelectorAll('tbody tr').length;
}
document.querySelectorAll('table').forEach((table) => {
  const isCompanies = !!table.closest('[data-screen=companies]');
  const bar = isCompanies ? document.getElementById('rowBulk') : null;
  const label = isCompanies ? document.getElementById('rowBulkCount') : null;
  const setRow = (row, on) => { row.classList.toggle('is-selected', on); const box = row.querySelector('input[type=checkbox]'); if (box) box.checked = on; };
  table.querySelector('tbody')?.addEventListener('click', (event) => {
    if (event.target.closest('button, a, select')) return;
    const row = event.target.closest('tr');
    if (!row) return;
    setRow(row, !row.classList.contains('is-selected'));
    syncBulk(table, bar, label);
  });
  table.querySelector('thead input[type=checkbox]')?.addEventListener('change', (event) => {
    table.querySelectorAll('tbody tr').forEach((row) => setRow(row, event.target.checked));
    syncBulk(table, bar, label);
  });
  if (isCompanies) {
    syncBulk(table, bar, label);
    document.getElementById('rowClear')?.addEventListener('click', () => { table.querySelectorAll('tbody tr').forEach((row) => setRow(row, false)); syncBulk(table, bar, label); });
  }
});

// ---------- EXD-04 + DEC-003 : Opportunités hybrides (cartes, bandeau d'étapes, tri, sélection persistante) ----------
const STAGES = ['Prospection', 'RDV décideur', 'Offre envoyée', 'Accord de principe', 'Agrément reçu', 'Inscrit'];
const OPPS = [
  ['Société Horizon SA', 'RDV décideur', 'info', '42', 'MK', 'RDV 21 oct.'], ['Groupe Kora Assurances', 'Offre envoyée', 'warn', '68,5', 'YM', 'Relance en retard'],
  ['Atlas Négoce', 'Agrément reçu', 'ok', '19,2', 'LM', '12 places'], ['Banque du Wouri', 'Accord de principe', 'warn', '120', 'MK', 'Agrément attendu'],
  ['Énergie Littoral', 'Prospection', '', '35', 'YM', 'Appel 23 oct.'], ['Sahel Logistique', 'Prospection', '', '12', 'LM', 'Sans action'],
  ['Cacao Mbalmayo', 'Offre envoyée', 'warn', '27', 'YM', 'Relance 24 oct.'], ['Télécom Équateur', 'RDV décideur', 'info', '88', 'MK', 'RDV 28 oct.'],
  ['Assur’Afrique', 'Prospection', '', '15', 'LM', 'Appel 22 oct.'], ['Port de Kribi Services', 'Accord de principe', 'warn', '64', 'MK', 'Comité 30 oct.'],
  ['Mutuelle du Littoral', 'Agrément reçu', 'ok', '23', 'LM', '8 places'], ['Brasserie Sanaga', 'Offre envoyée', 'warn', '31', 'YM', 'Offre à relire'],
  ['Banque Équatoriale', 'Prospection', '', '52', 'MK', 'Appel 25 oct.'], ['Palmeraie du Sud', 'RDV décideur', 'info', '18', 'YM', 'RDV 27 oct.'],
  ['Coopérative Moungo', 'Prospection', '', '9', 'LM', 'Sans action'], ['Logis Immobilier', 'Inscrit', 'ok', '14', 'LM', 'Session nov.'],
  ['Atlas Santé', 'Offre envoyée', 'warn', '40', 'MK', 'Relance 26 oct.'], ['Finance Douala Corp', 'RDV décideur', 'info', '76', 'YM', 'RDV 29 oct.'],
].map(([name, stage, tone, amount, owner, next]) => {
  const day = /retard/.test(next) ? -5 : /(\d+) oct/.test(next) ? Number(/(\d+) oct/.exec(next)[1]) - 21 : 90;
  return { name, stage, tone, amount, value: parseFloat(amount.replace(',', '.')), owner, next, day };
});
const oppGrid = document.getElementById('oppGrid');
if (oppGrid) {
  const picked = new Set(['Groupe Kora Assurances', 'Banque du Wouri']); // sélection persistante : survit au tri et au filtre
  let stageFilter = null;
  let sortKey = 'next';
  const bulk = document.getElementById('oppBulk');
  const count = document.getElementById('oppBulkCount');
  const bar = document.getElementById('stageBar');
  const sorters = {
    next: (x, y) => x.day - y.day,
    amount: (x, y) => y.value - x.value,
    stage: (x, y) => STAGES.indexOf(x.stage) - STAGES.indexOf(y.stage) || x.day - y.day,
  };
  const fmt = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',');
  function renderBar() {
    const total = OPPS.reduce((s, o) => s + o.value, 0);
    const chips = [{ label: 'Toutes', n: OPPS.length, sum: total, key: null }].concat(STAGES.map((s) => {
      const list = OPPS.filter((o) => o.stage === s);
      return { label: s, n: list.length, sum: list.reduce((t, o) => t + o.value, 0), key: s };
    }));
    bar.innerHTML = chips.map((c) => `<button type="button" class="stage-chip" aria-pressed="${stageFilter === c.key}" data-stage="${c.key ?? ''}"><b>${c.label}</b><span>${c.n} · ${fmt(c.sum)} M XAF</span></button>`).join('');
  }
  function renderCards() {
    const list = OPPS.filter((o) => !stageFilter || o.stage === stageFilter).sort(sorters[sortKey]);
    oppGrid.innerHTML = list.map((o) => {
      const initials = o.name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
      return `<button type="button" class="opp" data-name="${o.name}" aria-pressed="${picked.has(o.name)}" aria-label="${o.name}, ${o.stage}, ${o.amount} millions de francs CFA"><span class="top"><span class="logo-sq">${initials}</span><span class="avatar sm">${o.owner}</span></span><strong>${o.name}</strong><span class="badge ${o.tone}">${o.stage}</span><span class="amt">${o.amount} M <small>XAF</small></span><span class="next">${o.next}</span></button>`;
    }).join('');
    const total = list.reduce((s, o) => s + o.value, 0);
    const summary = document.getElementById('oppSummary');
    if (summary) summary.textContent = `${list.length} opportunité${list.length > 1 ? 's' : ''} · ${fmt(total)} M XAF${stageFilter ? ' · étape « ' + stageFilter + ' »' : ''}`;
    refreshBulk();
  }
  function refreshBulk() {
    const n = picked.size;
    bulk.hidden = n === 0;
    count.textContent = n + (n > 1 ? ' sélectionnées' : ' sélectionnée');
  }
  oppGrid.addEventListener('click', (event) => {
    const card = event.target.closest('.opp');
    if (!card) return;
    const name = card.dataset.name;
    if (picked.has(name)) picked.delete(name); else picked.add(name);
    card.setAttribute('aria-pressed', String(picked.has(name)));
    refreshBulk();
  });
  bar.addEventListener('click', (event) => {
    const chip = event.target.closest('.stage-chip');
    if (!chip) return;
    stageFilter = chip.dataset.stage || null;
    renderBar();
    renderCards();
  });
  document.getElementById('oppSort')?.addEventListener('change', (event) => { sortKey = event.target.value; renderCards(); });
  document.getElementById('oppClear')?.addEventListener('click', () => { picked.clear(); renderCards(); });
  renderBar();
  renderCards();
  const params = new URLSearchParams(location.search);
  if (params.get('etape')) { stageFilter = params.get('etape'); renderBar(); renderCards(); }
}
document.querySelectorAll('[data-opp]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('[data-opp]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  const cards = b.dataset.opp === 'cartes';
  document.getElementById('oppCards').hidden = !cards;
  document.getElementById('oppStages').hidden = cards;
  if (!cards) document.getElementById('oppBulk').hidden = true; else document.getElementById('oppBulk').hidden = document.querySelectorAll('.opp[aria-pressed=true]').length === 0;
}));
if (location.hash === '#opportunites-etapes') document.querySelector('[data-opp=etapes]')?.click();

// ---------- DEC-002 : navigation B+ ----------
// Vue d'ensemble : navigation complète. Autres écrans : rail compact par défaut, bouton « Déplier » (préférence mémorisée).
const mobileQuery = matchMedia('(max-width: 900px)');
const railToggle = document.getElementById('railToggle');
let expanded = new URLSearchParams(location.search).get('nav') === 'full';
try { if (!expanded) expanded = localStorage.getItem('investally-nav') === 'full'; } catch { /* préférence non lisible : rail par défaut */ }
let currentView = 'dashboard';
function setNavMode(view) {
  currentView = view ?? currentView;
  const hub = currentView === 'dashboard';
  const full = hub || expanded || mobileQuery.matches;
  document.body.dataset.nav = full ? 'full' : 'rail';
  if (railToggle) {
    railToggle.hidden = hub || mobileQuery.matches;
    railToggle.setAttribute('aria-expanded', String(full));
    const label = full ? 'Replier' : 'Déplier';
    document.getElementById('railLabel').textContent = label;
    railToggle.dataset.label = full ? 'Replier la navigation' : 'Déplier la navigation';
  }
  // Fil d'Ariane : retour à la vue d'ensemble sur tous les écrans sauf le hub
  document.querySelectorAll('.screen .crumbs').forEach((crumb) => {
    const existing = crumb.querySelector('.back');
    if (existing) existing.remove();
    if (!crumb.closest('[data-screen=dashboard]')) crumb.insertAdjacentHTML('afterbegin', '<a class="back" href="#dashboard">← Vue d’ensemble</a>');
  });
}
window.applyNav = setNavMode; // exposé après les déclarations (évite l'accès avant initialisation)
railToggle?.addEventListener('click', () => {
  expanded = !expanded;
  try { localStorage.setItem('investally-nav', expanded ? 'full' : 'rail'); } catch { /* ignoré */ }
  setNavMode();
});
mobileQuery.addEventListener('change', () => setNavMode());
setNavMode(location.hash.replace('#', '').split('?')[0] === '' ? 'dashboard' : (location.hash.replace('#', '') === 'agenda-mois' ? 'agenda' : location.hash.replace('#', '')));

// ---------- Hub : recherche globale (données fictives, groupées par type) ----------
const INDEX = [
  ['Entreprises', 'Société Horizon SA', 'Banque · Douala'], ['Entreprises', 'Groupe Kora Assurances', 'Assurance · Yaoundé'], ['Entreprises', 'Atlas Négoce', 'Distribution · Douala'],
  ['Contacts', 'Marie Ndongo', 'Directrice financière · Société Horizon'], ['Contacts', 'Paul Essomba', 'Responsable formation · Groupe Kora'],
  ['Offres', 'Offre n° 214 — Groupe Kora', '68,5 M XAF · envoyée'], ['Offres', 'Offre n° 207 — Atlas Négoce', '19,2 M XAF · acceptée'],
  ['Formations', 'Analyse financière — niveau 1', 'Catalogue Investudy'], ['Formations', 'Conformité et lutte anti-blanchiment', 'Catalogue Investudy'],
  ['Sessions', 'Session de novembre — Atlas Négoce', '12–14 nov. · 12 inscrits'], ['Sessions', 'Session de décembre — Banque du Wouri', '3–5 déc. · 8 inscrits'],
  ['Utilisateurs', 'Yann Morel', 'Chargé de compte'], ['Utilisateurs', 'Lina Mensah', 'Chargée de compte'],
  ['Documents', 'Décharge — Atlas Négoce.pdf', 'Ajouté le 20 oct.'], ['Documents', 'Convention — Groupe Kora.pdf', 'Version 2'],
  ['Rapports', 'Rapport hebdomadaire — semaine 42', 'Soumis'], ['Rapports', 'Rapport mensuel — septembre', 'Validé'],
];
const hubQuery = document.getElementById('hubQuery');
const hubResults = document.getElementById('hubResults');
let hubKind = 'all';
function renderResults() {
  if (!hubQuery) return;
  const q = hubQuery.value.trim().toLowerCase();
  if (!q) { hubResults.hidden = true; hubQuery.setAttribute('aria-expanded', 'false'); return; }
  const hits = INDEX.filter(([kind, title, meta]) => (hubKind === 'all' || kind === hubKind) && (title + ' ' + meta).toLowerCase().includes(q));
  const groups = {};
  hits.forEach(([kind, title, meta]) => { (groups[kind] ||= []).push([title, meta]); });
  hubResults.innerHTML = hits.length
    ? Object.entries(groups).map(([kind, items]) => `<div class="res-group" role="group" aria-label="${kind}"><h3>${kind}</h3>${items.map(([t, m], i) => `<div class="res-item" role="option" aria-selected="false"><span>${t}</span><small>${m}</small></div>`).join('')}</div>`).join('')
    : '<div class="res-empty">Aucun résultat dans vos droits d’accès.</div>';
  hubResults.hidden = false;
  hubQuery.setAttribute('aria-expanded', 'true');
}
hubQuery?.addEventListener('input', renderResults);
hubQuery?.addEventListener('keydown', (e) => { if (e.key === 'Escape') { hubQuery.value = ''; renderResults(); } });
document.querySelectorAll('.chip-btn').forEach((btn) => btn.addEventListener('click', () => {
  document.querySelectorAll('.chip-btn').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  hubKind = btn.dataset.kind;
  renderResults();
}));
// Raccourci ⌘K / Ctrl+K : met le focus sur la recherche (hub ou barre supérieure)
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    (currentView === 'dashboard' ? hubQuery : document.querySelector('.topbar .search input'))?.focus();
  }
});
// Lien de démonstration : ?q=kora affiche des résultats
const demoQuery = new URLSearchParams(location.search).get('q');
if (demoQuery && hubQuery) { hubQuery.value = demoQuery; renderResults(); }
