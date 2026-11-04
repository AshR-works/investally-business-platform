import { assertLocalDatabase, assertNotProduction } from '../demo-users.logic';

describe('garde-fous du jeu de données de démonstration', () => {
  it('refuse la production', () => {
    expect(() => assertNotProduction({ NODE_ENV: 'production' })).toThrow('interdits en production');
  });

  it('accepte une base locale', () => {
    for (const url of ['postgresql://u:p@localhost:5432/investally', 'postgresql://u:p@127.0.0.1:54329/investally_test', 'postgresql://u:p@[::1]:5432/db']) {
      expect(() => assertLocalDatabase({ DATABASE_URL: url })).not.toThrow();
    }
  });

  it('refuse une base distante ou partagée', () => {
    for (const url of ['postgresql://u:p@db.investally.example:5432/investally', 'postgresql://u:p@10.0.0.12:5432/db', 'postgresql://u:p@prod-db.internal/db']) {
      expect(() => assertLocalDatabase({ DATABASE_URL: url })).toThrow(/réservé aux bases locales/);
    }
  });

  it('refuse quand l’adresse de la base est absente ou illisible', () => {
    expect(() => assertLocalDatabase({})).toThrow(/DATABASE_URL/);
    expect(() => assertLocalDatabase({ DATABASE_URL: 'pas une adresse' })).toThrow(/DATABASE_URL/);
  });
});
