import { csvCell, neutralizeCell, toCsv } from './csv';

describe('CSV d’export : tableur français et sûr', () => {
  it('commence par la marque d’ordre des octets (accents lus par Excel), sépare par « ; » et termine chaque ligne par CRLF', () => {
    const csv = toCsv(['Nom', 'Ville'], [['Élodie', 'Douala']]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toBe('﻿Nom;Ville\r\nÉlodie;Douala\r\n');
  });

  it('met entre guillemets une cellule qui contient « ; », un guillemet ou un saut de ligne, et double les guillemets', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('dit "oui"')).toBe('"dit ""oui"""');
    expect(csvCell('ligne 1\nligne 2')).toBe('"ligne 1\nligne 2"');
    expect(csvCell('retour\rchariot')).toBe('"retour\rchariot"');
    expect(csvCell('simple, avec virgule')).toBe('simple, avec virgule');
  });

  it('écrit les booléens « oui » / « non », l’absence en cellule vide, et les nombres tels quels', () => {
    expect(csvCell(true)).toBe('oui');
    expect(csvCell(false)).toBe('non');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(42)).toBe('42');
    expect(csvCell(-3.5)).toBe('-3.5');
    expect(csvCell(Number.NaN)).toBe('');
    expect(csvCell('')).toBe('');
  });

  it('neutralise l’injection de formule : un texte qui commence par = + - @ tabulation ou retour chariot reçoit une apostrophe', () => {
    for (const dangerous of ['=1+1', '+33 6', '-2+3', '@SUM(A1)', '\t=x', '\r=x', '=HYPERLINK("http://mal.example","clic")']) {
      expect(neutralizeCell(dangerous)).toBe(`'${dangerous}`);
      expect(csvCell(dangerous).replace(/^"/, '').startsWith("'")).toBe(true);
    }
    // Un texte ordinaire, ou qui contient ces signes ailleurs qu'en tête, reste intact.
    for (const safe of ['Jean Dupont', 'a=b', 'x+y', 'ana@exemple.test', ' =espace avant']) expect(neutralizeCell(safe)).toBe(safe);
  });

  it('ne neutralise pas un nombre négatif (ce n’est pas du texte libre)', () => {
    expect(toCsv(['n'], [[-5]])).toBe('﻿n\r\n-5\r\n');
  });

  it('refuse une ligne dont la longueur n’est pas celle de l’en-tête : une colonne décalée fausserait un audit', () => {
    expect(() => toCsv(['a', 'b'], [['x']])).toThrow(/1 colonnes pour un en-tête de 2/);
    expect(() => toCsv(['a'], [['x', 'y']])).toThrow(/2 colonnes/);
  });

  it('un fichier sans ligne ne contient que l’en-tête', () => {
    expect(toCsv(['a', 'b'], [])).toBe('﻿a;b\r\n');
  });
});
