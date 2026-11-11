// Ordre d'exécution des tests d'intégration (D163). Les suites qui SEMENT beaucoup de données dans la base partagée (contrat IDOR : un objet par route et par test ;
// jeu de démonstration) passent en DERNIER : leurs données ne peuvent plus remplir les premières pages triées des listes lues par les autres suites.
// Le reste garde l'ordre alphabétique des fichiers, donc stable d'une exécution à l'autre.
const LAST = [/idor-contract\.integration/, /seed-demo\.integration/];
const rank = (test) => LAST.findIndex((re) => re.test(String(test.path).split('\\').join('/')));

module.exports = class StableSequencer {
  async shard(tests) {
    return tests;
  }
  async sort(tests) {
    return [...tests].sort((a, b) => rank(a) - rank(b) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  }
  allFailedTests(tests) {
    return tests;
  }
  cacheResults() {}
};
