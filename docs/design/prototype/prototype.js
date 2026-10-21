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

// ---------- EXD-04 : Opportunités en cartes (6 par ligne), sélection persistante ----------
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
];
const oppGrid = document.getElementById('oppGrid');
if (oppGrid) {
  oppGrid.innerHTML = OPPS.map(([name, stage, tone, amount, owner, next], i) => {
    const initials = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    const selected = i === 1 || i === 3;
    return `<button type="button" class="opp" aria-pressed="${selected}" aria-label="${name}, ${stage}, ${amount} millions de francs CFA"><span class="top"><span class="logo-sq">${initials}</span><span class="avatar sm">${owner}</span></span><strong>${name}</strong><span class="badge ${tone}">${stage}</span><span class="amt">${amount} M <small>XAF</small></span><span class="next">${next}</span></button>`;
  }).join('');
  const bulk = document.getElementById('oppBulk');
  const count = document.getElementById('oppBulkCount');
  const refresh = () => {
    const n = oppGrid.querySelectorAll('.opp[aria-pressed=true]').length;
    bulk.hidden = n === 0;
    count.textContent = n + (n > 1 ? ' sélectionnées' : ' sélectionnée');
  };
  oppGrid.addEventListener('click', (event) => {
    const card = event.target.closest('.opp');
    if (!card) return;
    card.setAttribute('aria-pressed', String(card.getAttribute('aria-pressed') !== 'true'));
    refresh();
  });
  document.getElementById('oppClear')?.addEventListener('click', () => { oppGrid.querySelectorAll('.opp').forEach((c) => c.setAttribute('aria-pressed', 'false')); refresh(); });
  refresh();
}
document.querySelectorAll('[data-opp]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('[data-opp]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  const cards = b.dataset.opp === 'cartes';
  document.getElementById('oppCards').hidden = !cards;
  document.getElementById('oppStages').hidden = cards;
  if (!cards) document.getElementById('oppBulk').hidden = true; else document.getElementById('oppGrid') && oppGrid.dispatchEvent(new Event('refresh'));
}));
if (location.hash === '#opportunites-etapes') document.querySelector('[data-opp=etapes]')?.click();
