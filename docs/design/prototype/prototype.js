// Prototype statique : navigation entre écrans, thème clair/sombre, menu mobile, filtres de démonstration.
// Aucune donnée réelle, aucun appel réseau.
const screens = [...document.querySelectorAll('[data-screen]')];
const navLinks = [...document.querySelectorAll('[data-nav]')];

/** Affiche un écran (ou la page de connexion) et met à jour la navigation. */
function go(name) {
  document.body.dataset.view = name === 'login' ? 'login' : 'app';
  if (name === 'login') return;
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
