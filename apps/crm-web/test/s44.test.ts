import { describe, expect, it } from 'vitest';
import {
  COMPANY_COLUMNS, DEFAULT_COLUMNS, DEFAULT_SORT, hasActiveFilters, listParams, nextSort, NO_FILTERS, overviewParams, parseStoredColumns, statusOptions, toggleColumn,
} from '../lib/company-table';

describe('tableau des entreprises : tri', () => {
  it('un nouveau champ trie en croissant, sauf « Créée le » qui commence par les plus récentes', () => {
    expect(nextSort(DEFAULT_SORT, 'name')).toEqual({ field: 'name', direction: 'asc' });
    expect(nextSort({ field: 'name', direction: 'asc' }, 'createdAt')).toEqual({ field: 'createdAt', direction: 'desc' });
  });
  it('le même champ inverse le sens, dans les deux directions', () => {
    expect(nextSort({ field: 'name', direction: 'asc' }, 'name')).toEqual({ field: 'name', direction: 'desc' });
    expect(nextSort({ field: 'name', direction: 'desc' }, 'name')).toEqual({ field: 'name', direction: 'asc' });
  });
});

describe('tableau des entreprises : paramètres envoyés à l’API', () => {
  it('sans filtre ni tri, seules la page et la taille sont envoyées', () => {
    expect(listParams(NO_FILTERS, DEFAULT_SORT, 1, 20).toString()).toBe('page=1&pageSize=20');
  });
  it('chaque filtre renseigné est envoyé, un filtre vide jamais', () => {
    const params = listParams({ search: 'at', status: 'CLIENT', country: 'Cameroun', sector: '' }, DEFAULT_SORT, 2, 20);
    expect(params.get('search')).toBe('at');
    expect(params.get('status')).toBe('CLIENT');
    expect(params.get('country')).toBe('Cameroun');
    expect(params.has('sector')).toBe(false);
    expect(params.get('page')).toBe('2');
  });
  it('un tri non standard est envoyé avec son sens ; le tri par défaut non', () => {
    const params = listParams(NO_FILTERS, { field: 'country', direction: 'desc' }, 1, 20);
    expect(params.get('sort')).toBe('country');
    expect(params.get('direction')).toBe('desc');
    expect(listParams(NO_FILTERS, { field: 'createdAt', direction: 'asc' }, 1, 20).get('direction')).toBe('asc');
  });
  it('les valeurs saisies sont encodées (pas d’injection dans la requête)', () => {
    const params = listParams({ ...NO_FILTERS, search: 'a&sort=passwordHash' }, DEFAULT_SORT, 1, 20);
    expect(params.has('sort')).toBe(false);
    expect(params.toString()).toContain('search=a%26sort%3DpasswordHash');
  });
  it('la synthèse reprend recherche, pays et secteur mais PAS le statut', () => {
    const params = overviewParams({ search: 'x', status: 'CLIENT', country: 'Cameroun', sector: 'Banque' });
    expect([...params.keys()].sort()).toEqual(['country', 'search', 'sector']);
  });
  it('détecte la présence d’un filtre actif', () => {
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...NO_FILTERS, sector: 'Banque' })).toBe(true);
    expect(hasActiveFilters({ ...NO_FILTERS, status: 'TARGET' })).toBe(true);
  });
});

describe('tableau des entreprises : filtres par statut', () => {
  it('« Toutes » + les cinq statuts, avec leurs effectifs et le total', () => {
    const options = statusOptions({ TARGET: 3, CONTACTED: 1, QUALIFIED: 0, CLIENT: 2, ARCHIVED: 4 });
    expect(options.map((o) => o.label)).toEqual(['Toutes', 'Cible', 'Contactée', 'Qualifiée', 'Cliente', 'Archivée']);
    expect(options.map((o) => o.count)).toEqual([10, 3, 1, 0, 2, 4]);
    expect(options[0]?.value).toBe('');
  });
  it('avant la réponse de l’API, aucun effectif n’est affiché (pas de « 0 » trompeur)', () => {
    expect(statusOptions(null).every((o) => o.count === undefined)).toBe(true);
  });
});

describe('tableau des entreprises : colonnes au choix', () => {
  it('par défaut : nom, secteur, pays, statut, date ; e-mail et téléphone proposés mais masqués', () => {
    expect(DEFAULT_COLUMNS).toEqual(['name', 'sector', 'country', 'status', 'created']);
    expect(COMPANY_COLUMNS.map((c) => c.id)).toEqual(expect.arrayContaining(['email', 'phone']));
  });
  it('active et masque une colonne en gardant l’ordre du tableau', () => {
    expect(toggleColumn(DEFAULT_COLUMNS, 'email')).toEqual(['name', 'sector', 'country', 'email', 'status', 'created']);
    expect(toggleColumn(DEFAULT_COLUMNS, 'sector')).toEqual(['name', 'country', 'status', 'created']);
  });
  it('la colonne du nom ne se masque pas', () => {
    expect(toggleColumn(DEFAULT_COLUMNS, 'name')).toEqual(DEFAULT_COLUMNS);
  });
  it('relit un choix mémorisé ; une valeur absente, abîmée ou inattendue retombe sur le défaut', () => {
    expect(parseStoredColumns(null)).toEqual(DEFAULT_COLUMNS);
    expect(parseStoredColumns('pas du json')).toEqual(DEFAULT_COLUMNS);
    expect(parseStoredColumns('{"a":1}')).toEqual(DEFAULT_COLUMNS);
    expect(parseStoredColumns('["name","phone"]')).toEqual(['name', 'phone']);
  });
  it('ignore les colonnes inconnues et rétablit la colonne verrouillée', () => {
    expect(parseStoredColumns('["phone","<script>","created"]')).toEqual(['name', 'phone', 'created']);
    expect(parseStoredColumns('[]')).toEqual(['name']);
  });
});
