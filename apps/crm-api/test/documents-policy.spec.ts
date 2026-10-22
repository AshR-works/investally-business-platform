import { MAX_FILE_BYTES, checkCategory, checkUpload, detectFormat, extensionOf, sanitizeFileName } from '../src/modules/documents/domain/document-policy';

const pdf = (extra = '') => Buffer.from(`%PDF-1.7\n${extra}%%EOF`);
const png = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
/** Archive ZIP minimale : seule la signature et les noms d'entrées comptent pour la reconnaissance. */
const zip = (...names: string[]) => Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from(names.join('\u0000'))]);
const docx = () => zip('[Content_Types].xml', 'word/document.xml');
const xlsx = () => zip('[Content_Types].xml', 'xl/workbook.xml');

describe('detectFormat — le format vient du CONTENU, jamais du nom ni du type déclaré', () => {
  it('reconnaît PDF, PNG, JPEG, DOCX et XLSX', () => {
    expect([pdf(), png(), jpeg(), docx(), xlsx()].map(detectFormat)).toEqual(['PDF', 'PNG', 'JPEG', 'DOCX', 'XLSX']);
  });
  it('refuse un exécutable, un script, du texte, une archive quelconque', () => {
    for (const bytes of [Buffer.from('MZ\u0090\u0000'), Buffer.from('#!/bin/sh\nrm -rf /'), Buffer.from('<?php echo 1;'), Buffer.from('<script>alert(1)</script>'), Buffer.from('juste du texte'), zip('fichier.txt')]) {
      expect(detectFormat(bytes)).toBeNull();
    }
  });
  it('refuse un document Office qui embarque des macros', () => {
    expect(detectFormat(zip('[Content_Types].xml', 'word/document.xml', 'word/vbaProject.bin'))).toBeNull();
    expect(detectFormat(zip('[Content_Types].xml', 'xl/workbook.xml', 'xl/vbaProject.bin'))).toBeNull();
  });
  it('refuse une archive sans [Content_Types].xml (pas un document Office)', () => {
    expect(detectFormat(zip('word/document.xml'))).toBeNull();
  });
  it('un tampon vide ou trop court n\'est pas un format', () => {
    expect(detectFormat(Buffer.alloc(0))).toBeNull();
    expect(detectFormat(Buffer.from([0xff]))).toBeNull();
  });
});

describe('sanitizeFileName — aucun chemin, aucun caractère dangereux', () => {
  it('retire les répertoires (Unix et Windows) et ne garde que le nom', () => {
    expect(sanitizeFileName('../../etc/passwd.pdf')).toBe('passwd.pdf');
    expect(sanitizeFileName('C:\\Users\\x\\rapport.pdf')).toBe('rapport.pdf');
  });
  it('retire les caractères de contrôle et réservés, compacte les espaces, retire les points de tête', () => {
    expect(sanitizeFileName('  a\u0000b\u0007c<>:"|?*  d.pdf ')).toBe('abc d.pdf');
    expect(sanitizeFileName('...cache.pdf')).toBe('cache.pdf');
  });
  it('un nom qui se réduit à rien est vide (refusé ensuite)', () => {
    expect(sanitizeFileName('../')).toBe('');
    expect(sanitizeFileName('...')).toBe('');
  });
  it('borne la longueur en gardant la fin (l\'extension)', () => {
    const name = sanitizeFileName(`${'a'.repeat(500)}.pdf`);
    expect(name.length).toBeLessThanOrEqual(200);
    expect(name.endsWith('.pdf')).toBe(true);
  });
  it('extensionOf : minuscules, sans le point ; vide sans extension', () => {
    expect(extensionOf('Rapport.PDF')).toBe('pdf');
    expect(extensionOf('archive.tar.gz')).toBe('gz');
    expect(extensionOf('LISEZMOI')).toBe('');
    expect(extensionOf('.pdf')).toBe('');
  });
});

describe('checkUpload — taille, format, extension', () => {
  it('accepte un PDF et renvoie nom assaini, format et type MIME', () => {
    expect(checkUpload('Décharge Horizon.PDF', pdf())).toEqual({ fileName: 'Décharge Horizon.PDF', format: 'PDF', mimeType: 'application/pdf' });
  });
  it('accepte .jpg et .jpeg pour un JPEG, .docx, .xlsx, .png', () => {
    expect(checkUpload('a.jpg', jpeg()).format).toBe('JPEG');
    expect(checkUpload('a.jpeg', jpeg()).format).toBe('JPEG');
    expect(checkUpload('a.docx', docx()).format).toBe('DOCX');
    expect(checkUpload('a.xlsx', xlsx()).format).toBe('XLSX');
    expect(checkUpload('a.png', png()).format).toBe('PNG');
  });
  it('refuse un fichier vide, trop gros, ou sans nom exploitable', () => {
    expect(() => checkUpload('a.pdf', Buffer.alloc(0))).toThrow(/vide/);
    expect(() => checkUpload('a.pdf', Buffer.concat([pdf(), Buffer.alloc(MAX_FILE_BYTES)]))).toThrow(/taille maximale/);
    expect(() => checkUpload('../', pdf())).toThrow(/Nom de fichier/);
  });
  it('refuse un exécutable renommé en .pdf (le contenu ne ment pas)', () => {
    expect(() => checkUpload('facture.pdf', Buffer.from('MZ\u0090\u0000programme'))).toThrow(/Format non accepté/);
  });
  it('refuse une extension qui ne correspond pas au contenu (un PNG nommé .pdf, un PDF nommé .png, un DOCX nommé .xlsx)', () => {
    expect(() => checkUpload('a.pdf', png())).toThrow(/ne correspond pas/);
    expect(() => checkUpload('a.png', pdf())).toThrow(/ne correspond pas/);
    expect(() => checkUpload('a.xlsx', docx())).toThrow(/ne correspond pas/);
    expect(() => checkUpload('sans-extension', pdf())).toThrow(/ne correspond pas/);
  });
  it('un document Office avec macros est refusé même avec la bonne extension', () => {
    expect(() => checkUpload('a.docx', zip('[Content_Types].xml', 'word/document.xml', 'word/vbaProject.bin'))).toThrow(/Format non accepté/);
  });
});

describe('checkCategory', () => {
  it('absente, vide ou connue : acceptée ; inconnue : refusée', () => {
    expect(checkCategory(undefined)).toBeNull();
    expect(checkCategory('')).toBeNull();
    expect(checkCategory('CONTRAT')).toBe('CONTRAT');
    expect(() => checkCategory('PIRATE')).toThrow(/inconnue/);
  });
});
