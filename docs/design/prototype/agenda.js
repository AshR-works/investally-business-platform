// Agenda du prototype : vues semaine et mois, filtres par type d'agenda, fenêtre « Nouvel événement ».
// Données de démonstration FICTIVES (octobre 2026). Chargé après prototype.js.

/** Jour du mois → événements [type, libellé]. */
const MONTH_EVENTS = {
  1: [['rdv', 'Appel — Énergie Littoral']], 6: [['formation', 'Atelier — Atlas Négoce']], 8: [['relance', 'Relance — Groupe Kora']],
  13: [['rdv', 'RDV — Banque du Wouri'], ['interne', 'Comité commercial']], 15: [['echeance', 'Échéance agrément']],
  19: [['relance', 'Relance — Groupe Kora']], 20: [['rdv', 'RDV décideur — Horizon']],
  21: [['interne', 'Point pipeline équipe'], ['rdv', 'RDV décideur — Horizon'], ['relance', 'Relance — Banque du Wouri'], ['relance', 'Relance — Atlas']],
  22: [['formation', 'Atelier de préparation'], ['rdv', 'Appel — Sahel Logistique']],
  23: [['rdv', 'Appel — Énergie Littoral'], ['echeance', 'Échéance — agrément'], ['interne', 'Revue sécurité']],
  27: [['rdv', 'RDV — Groupe Kora']], 29: [['relance', 'Relance — Sahel']],
};
const TODAY = 21;

/** Octobre 2026 : le 1er est un jeudi ; la grille de 5 semaines commence le lundi 28 septembre. */
function dayCells(render) {
  const cells = [];
  for (let i = 0; i < 35; i++) {
    const day = i - 3 + 1;
    let n = day;
    let out = false;
    if (day < 1) { n = 30 + day; out = true; } else if (day > 31) { n = day - 31; out = true; }
    cells.push(render(n, out));
  }
  return cells;
}

const miniGrid = document.getElementById('miniGrid');
if (miniGrid) {
  const head = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<span class="dow">${d}</span>`).join('');
  miniGrid.innerHTML = head + dayCells((n, out) => {
    const classes = ['d'];
    if (out) classes.push('out');
    if (!out && n === TODAY) classes.push('today');
    if (!out && MONTH_EVENTS[n]) classes.push('has');
    if (!out && n >= 19 && n <= 25) classes.push('in-week');
    return `<span class="${classes.join(' ')}">${n}</span>`;
  }).join('');
}

const monthGrid = document.getElementById('monthGrid');
if (monthGrid) {
  monthGrid.innerHTML = dayCells((n, out) => {
    const events = out ? [] : MONTH_EVENTS[n] || [];
    const shown = events.slice(0, 3).map(([type, label]) => `<span class="pill ${type}" data-type="${type}">${label}</span>`).join('');
    const more = events.length > 3 ? `<span class="more">+ ${events.length - 3} autre(s)</span>` : '';
    return `<div class="cell${out ? ' out' : ''}${!out && n === TODAY ? ' today' : ''}"><span class="n">${n}</span>${shown}${more}</div>`;
  }).join('');
}

/** Bascule entre la vue semaine et la vue mois. */
function setAgendaView(mode) {
  const week = document.getElementById('weekView');
  const month = document.getElementById('monthView');
  if (!week || !month) return;
  week.hidden = mode !== 'semaine';
  month.hidden = mode !== 'mois';
  document.querySelectorAll('[data-agenda]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.agenda === mode)));
  document.getElementById('rangeLabel').textContent = mode === 'mois' ? 'Octobre 2026' : '19 – 25 octobre 2026';
}
window.setAgendaView = setAgendaView;
document.querySelectorAll('[data-agenda]').forEach((b) => b.addEventListener('click', () => { if (!b.disabled) setAgendaView(b.dataset.agenda); }));
document.getElementById('todayBtn')?.addEventListener('click', () => setAgendaView('semaine'));

// Filtres par type d'agenda (rendez-vous, relances, formations, échéances, interne)
document.querySelectorAll('[data-toggle]').forEach((box) => {
  box.addEventListener('change', () => {
    document.querySelectorAll(`[data-type="${box.dataset.toggle}"]`).forEach((el) => el.classList.toggle('is-hidden', !box.checked));
  });
});

// Fenêtre « Nouvel événement » : Échap ferme, le focus entre dans la fenêtre puis revient au bouton.
const evDialog = document.getElementById('eventDialog');
const evButton = document.getElementById('newEvent');
function closeEvent() { evDialog.hidden = true; evButton?.focus(); }
window.closeEvent = closeEvent;
evButton?.addEventListener('click', () => { evDialog.hidden = false; evDialog.querySelector('input')?.focus(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !evDialog.hidden) closeEvent(); });

// Route directe vers la vue mois : #agenda-mois
if (location.hash === '#agenda-mois') setAgendaView('mois');
