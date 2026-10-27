import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  branchFromNameRev, buildChangelog, changelogCategory, checkReports, classify, coAuthors, describeCommit, getBlock, isNoise, isoWeek,
  localDate, markdownToHtml, monthFolder, netStatuses, parseFrontMatter, parseNameStatus, renderHtmlPage, reportPaths, setBlock, slug,
  sprintLabel, weekRange, PLACEHOLDER, DRAFT_MARK,
} from './daily-report.mjs';

const commit = (subject, extra = {}) => ({ hash: 'a'.repeat(40), short: 'aaaaaaa', subject, body: '', parents: ['p'], author: 'X', ...extra });

describe('dates et chemins', () => {
  it('la date locale suit le fuseau du projet (UTC+1), pas UTC', () => {
    assert.equal(localDate('2026-10-22T23:30:00Z'), '2026-10-23');
    assert.equal(localDate('2026-10-22T22:30:00Z'), '2026-10-22');
    assert.equal(localDate('2026-10-22T15:56:01+01:00'), '2026-10-22');
  });
  it('le dossier du mois porte son numéro et son nom français', () => {
    assert.equal(monthFolder('2026-01-05'), '01-Janvier');
    assert.equal(monthFolder('2026-02-28'), '02-Février');
    assert.equal(monthFolder('2026-08-01'), '08-Août');
    assert.equal(monthFolder('2026-12-31'), '12-Décembre');
  });
  it('les trois formats d\'un rapport partagent le même nom', () => {
    const p = reportPaths('2026-10-09', '/base');
    assert.match(p.md.replace(/\\/g, '/'), /\/base\/2026\/10-Octobre\/2026-10-09\.md$/);
    assert.equal(p.html, p.md.replace(/\.md$/, '.html'));
    assert.equal(p.pdf, p.md.replace(/\.md$/, '.pdf'));
  });
  it('semaines ISO : bornes d\'année et aller-retour', () => {
    assert.equal(isoWeek('2026-10-22'), '2026-W43');
    assert.equal(isoWeek('2026-01-01'), '2026-W01');
    assert.equal(isoWeek('2027-01-01'), '2026-W53');
    assert.equal(isoWeek('2024-12-30'), '2025-W01');
    assert.deepEqual(weekRange('2026-W43'), { from: '2026-10-19', to: '2026-10-25' });
    for (const d of ['2026-03-02', '2026-06-30', '2026-12-31']) {
      const w = weekRange(isoWeek(d));
      assert.ok(w.from <= d && d <= w.to, d);
    }
  });
});

describe('Git : libellés et attribution', () => {
  it('libellé de session d\'après la branche', () => {
    assert.equal(sprintLabel('sprint/s3-6-documents'), 'S3.6');
    assert.equal(sprintLabel('sprint/h2a-ecrans-d-acces'), 'H2a');
    assert.equal(sprintLabel('sprint/a11y-1-lecteurs-d-ecran'), 'A11Y-1');
    assert.equal(sprintLabel('sprint/s1-skeleton'), 'S1');
    assert.equal(sprintLabel('sprint/cadrage-ux-suivi'), 'cadrage-ux-suivi');
  });
  it('nom de branche d\'après git name-rev', () => {
    assert.equal(branchFromNameRev('sprint/s3-6-documents~3'), 'sprint/s3-6-documents');
    assert.equal(branchFromNameRev('main~12^2~3'), 'main');
    assert.equal(branchFromNameRev('remotes/origin/main'), 'main');
    assert.equal(branchFromNameRev('undefined'), '');
  });
  it('co-auteurs sans adresse e-mail, description sans signature', () => {
    const body = 'Ajout du module.\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>';
    assert.deepEqual(coAuthors(body), ['Claude Sonnet 5.5']);
    assert.equal(describeCommit(body), 'Ajout du module.');
  });
  it('lecture de la sortie name-status', () => {
    assert.deepEqual(parseNameStatus('A\ta/b.ts\nM\tc d.md\nD\te.ts\n'), [{ status: 'A', path: 'a/b.ts' }, { status: 'M', path: 'c d.md' }, { status: 'D', path: 'e.ts' }]);
  });
  it('statut net sur la journée : créé puis supprimé est ignoré', () => {
    const net = netStatuses(new Map([['a', ['A', 'M']], ['b', ['A', 'D']], ['c', ['M', 'M']], ['d', ['M', 'D']]]));
    assert.deepEqual([...net], [['a', 'A'], ['c', 'M'], ['d', 'D']]);
  });
  it('les produits dérivés ne sont pas détaillés, les sources le sont', () => {
    const all = new Set(['docs/A.md', 'docs/A.html']);
    assert.equal(isNoise('docs/A.html', all), 'pages HTML générées');
    assert.equal(isNoise('docs/design/prototype/index.html', new Set(['docs/design/prototype/index.md'])), null);
    assert.equal(isNoise('docs/accessibilite/s36-captures/x.png', all), 'captures');
    assert.equal(isNoise('apps/crm-api/src/main.ts', all), null);
  });
});

describe('classification pour le changelog', () => {
  it('sécurité, correction, ajout, modification', () => {
    assert.equal(changelogCategory(commit('test: contrat anti-IDOR'), []), 'Sécurité');
    assert.equal(changelogCategory(commit('fix(ci): installation pnpm'), []), 'Corrections');
    assert.equal(changelogCategory(commit('feat: pile locale'), []), 'Ajouts');
    assert.equal(changelogCategory(commit('S3.6 (API) : module Documents'), []), 'Ajouts');
    assert.equal(changelogCategory(commit('docs: suivi mis à jour'), []), 'Modifications');
  });
  it('une fusion n\'apparaît pas dans le changelog', () => {
    assert.equal(changelogCategory(commit('Merge sprint/x', { parents: ['a', 'b'] }), []), null);
  });
  it('toucher le module d\'identité ne suffit pas à parler de sécurité', () => {
    assert.ok(!classify(commit('refactor: renommage'), [{ status: 'M', path: 'apps/crm-api/src/modules/iam/x.ts' }]).has('securite'));
  });
});

describe('blocs automatiques et manuels', () => {
  const md = 'a\n<!-- auto:x -->\nancien\n<!-- /auto:x -->\nb\n<!-- manual:y -->\nmon texte\n<!-- /manual:y -->\n';
  it('lit et remplace un bloc sans toucher au reste', () => {
    assert.equal(getBlock(md, 'auto', 'x'), 'ancien');
    const out = setBlock(md, 'auto', 'x', 'nouveau');
    assert.equal(getBlock(out, 'auto', 'x'), 'nouveau');
    assert.equal(getBlock(out, 'manual', 'y'), 'mon texte');
  });
  it('un contenu contenant des symboles de remplacement reste littéral', () => {
    const out = setBlock(md, 'auto', 'x', 'prix $& $1 $$');
    assert.equal(getBlock(out, 'auto', 'x'), 'prix $& $1 $$');
  });
  it('en-tête YAML simple', () => {
    const { data, body } = parseFrontMatter('---\ndate: 2026-10-22\nstatus: draft\n---\n# T\n');
    assert.deepEqual(data, { date: '2026-10-22', status: 'draft' });
    assert.equal(body, '# T\n');
  });
});

describe('rendu HTML', () => {
  it('échappe tout contenu : aucun script ne peut venir d\'un message de commit', () => {
    const { html } = markdownToHtml('# <script>alert(1)</script>\n\n| a |\n|---|\n| <img src=x onerror=alert(1)> |\n\n[x](javascript:alert(1))\n');
    assert.ok(!/<script|<img/i.test(html));
    assert.ok(!/href="javascript/i.test(html));
  });
  it('tableaux, listes à deux niveaux, code et ancres de titres', () => {
    const { html, headings } = markdownToHtml('## Réalisations\n\n| A | B |\n|---|---|\n| 1 | `x` |\n\n- un\n  - sous\n- deux\n\n```\ncode <b>\n```\n');
    assert.match(html, /<table>/);
    assert.match(html, /<li>un<ul><li>sous<\/li><\/ul><\/li>/);
    assert.match(html, /&lt;b&gt;/);
    assert.deepEqual(headings, [{ level: 2, text: 'Réalisations', id: 'realisations' }]);
    assert.equal(slug('Risques / Points bloquants'), 'risques-points-bloquants');
  });
  it('la page contient résumé, sommaire et pagination à l\'impression', () => {
    const md = '---\ndate: 2026-10-22\nauthor: A\nsprint: S\nversion: v\nbranch: main\nstatus: draft\n---\n# Rapport\n\n## Résumé exécutif\n\n<!-- manual:resume -->\nJournée calme.\n<!-- /manual:resume -->\n\n## Réalisations\n\nRien.\n';
    const page = renderHtmlPage(md);
    assert.match(page, /Journée calme/);
    assert.match(page, /<nav class="toc"/);
    assert.match(page, /href="#realisations"/);
    assert.match(page, /counter\(pages\)/);
    assert.equal((page.match(/Journée calme/g) ?? []).length, 1);
  });
});

describe('changelog agrégé', () => {
  it('fusionne le bloc automatique et les compléments manuels, du plus récent au plus ancien', () => {
    const rep = (date, auto, manual) => ({ date, md: `## Changelog du jour\n\n<!-- auto:changelog -->\n${auto}\n<!-- /auto:changelog -->\n\n<!-- manual:changelog -->\n${manual}\n<!-- /manual:changelog -->\n` });
    const out = buildChangelog([
      rep('2026-10-20', '### Ajouts\n\n- un\n\n### Corrections\n\n_Aucun._', '_Aucun complément._'),
      rep('2026-10-21', '### Ajouts\n\n- deux', '### Ajouts\n\n- trois (manuel)\n\n### Sécurité\n\n- quatre'),
    ]);
    assert.ok(out.indexOf('## 2026-10-21') < out.indexOf('## 2026-10-20'));
    assert.match(out, /- deux\n- trois \(manuel\)/);
    assert.match(out, /### Sécurité\n\n- quatre/);
    assert.ok(!out.includes('Corrections'));
  });
});

describe('contrôle des rapports', () => {
  const good = (over = '') => ({
    date: '2026-10-22',
    fm: { date: '2026-10-22', author: 'A', sprint: 'S', version: 'v', branch: 'main', status: 'draft' },
    md: `## Résumé exécutif\n## Réalisations\n## Commits Git\n## Fichiers modifiés\n## Risques / Points bloquants\n## Actions du lendemain\n${over}`,
  });
  it('un rapport complet est conforme', () => assert.deepEqual(checkReports([good()]), []));
  it('signale une adresse e-mail (dépôt public)', () => {
    assert.ok(checkReports([good('contact: nom@exemple.com')]).some((p) => p.includes('e-mail')));
  });
  it('un rapport final ne doit plus contenir de section à compléter ni de brouillon', () => {
    const r = good(PLACEHOLDER);
    r.fm.status = 'final';
    assert.ok(checkReports([r]).some((p) => p.includes('à compléter')));
    const d = good(DRAFT_MARK);
    d.fm.status = 'final';
    assert.ok(checkReports([d]).length > 0);
  });
  it('la date de l\'en-tête doit correspondre au nom du fichier', () => {
    const r = good();
    r.fm.date = '2026-10-23';
    assert.ok(checkReports([r]).some((p) => p.includes('ne correspond pas')));
  });
});

describe('rafraîchissement d\'un rapport existant (le texte de l\'auteur est sacré)', () => {
  const emptyDay = { date: '2026-10-22', day: [], perCommit: new Map(), statuses: new Map(), allPaths: new Set(), add: 0, del: 0, dayTags: [], nearest: '', designVersion: '', appVersion: '' };
  it('conserve les blocs manuels, le statut et l\'origine ; régénère les blocs automatiques', async () => {
    const { renderReportMd } = await import('./daily-report.mjs');
    const first = renderReportMd('2026-10-22', { data: emptyDay, status: 'final', origin: 'reconstitué depuis Git' });
    let edited = setBlock(first, 'manual', 'resume', 'MON RÉSUMÉ ÉCRIT À LA MAIN');
    edited = setBlock(edited, 'manual', 'risques', 'RISQUE : dépendance X');
    edited = setBlock(edited, 'auto', 'stats', 'CONTENU AUTOMATIQUE OBSOLÈTE');
    const again = renderReportMd('2026-10-22', { data: emptyDay, existing: edited });
    assert.equal(getBlock(again, 'manual', 'resume'), 'MON RÉSUMÉ ÉCRIT À LA MAIN');
    assert.equal(getBlock(again, 'manual', 'risques'), 'RISQUE : dépendance X');
    assert.ok(!again.includes('CONTENU AUTOMATIQUE OBSOLÈTE'));
    assert.match(again, /\nstatus: final\n/);
    assert.match(again, /\norigin: reconstitué depuis Git\n/);
  });
  it('un nouveau rapport commence en brouillon avec un résumé automatique à relire', async () => {
    const { renderReportMd } = await import('./daily-report.mjs');
    const md = renderReportMd('2026-10-22', { data: emptyDay });
    assert.match(md, /\nstatus: draft\n/);
    assert.ok(getBlock(md, 'manual', 'resume').startsWith(DRAFT_MARK));
    assert.equal(getBlock(md, 'manual', 'actions'), PLACEHOLDER);
  });
});
