import { describe, expect, it } from 'vitest';
// Cohérence interface ↔ serveur : les domaines RÉELS de l'API sont interrogés sur les mêmes cas.
import { CourseModule as ServerModule } from '../../crm-api/src/modules/training/domain/course-module';
import { Program as ServerProgram } from '../../crm-api/src/modules/training/domain/program';
import { RHYTHMS } from '../../crm-api/src/modules/training/domain/rhythms';
import { Room as ServerRoom } from '../../crm-api/src/modules/training/domain/room';
import { Trainer as ServerTrainer } from '../../crm-api/src/modules/training/domain/trainer';
import { Training as ServerTraining } from '../../crm-api/src/modules/training/domain/training';
import {
  amountText, ARCHIVE_LABEL, ARCHIVE_PERMISSION, CATALOGUE_SECTIONS, EMPTY_MODULE_FORM, EMPTY_PROGRAM_FORM, EMPTY_ROOM_FORM, EMPTY_TRAINER_FORM, EMPTY_TRAINING_FORM,
  formFromRoom, formFromTraining, moduleBody, moveModule, pricingText, programBody, ROOM_KIND_LABEL, roomBody, seatsText, seatWord, slotsText, trainerBody, trainingBody, validateModule, validateProgram,
  validateRoom, validateTrainer, validateTraining, weeksText, type Room, type Training,
} from '../lib/catalogue';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { availableModules } from '../lib/modules';
import type { Profile } from '../lib/types';

const now = new Date('2026-11-12T10:00:00Z');
const serverAccepts = (build: () => unknown) => {
  try {
    build();
    return true;
  } catch {
    return false;
  }
};
const profileWith = (...permissions: string[]) => ({ permissions: permissions.map((code) => ({ code, scope: 'ALL' })) }) as unknown as Profile;
const valid = (errors: object) => Object.keys(errors).length === 0;

describe('catalogue : formulaires', () => {
  it('programme : le nom est obligatoire, les textes sont bornés ; le corps efface les champs vidés', () => {
    expect(validateProgram(EMPTY_PROGRAM_FORM()).name).toMatch(/obligatoire/);
    expect(validateProgram({ name: 'x'.repeat(151), description: '', audience: '' }).name).toMatch(/150/);
    expect(validateProgram({ name: 'Finance', description: '', audience: '' })).toEqual({});
    expect(programBody({ name: ' Finance ', description: '', audience: ' Cadres ' }, 3)).toEqual({ version: 3, name: 'Finance', description: '', audience: 'Cadres' });
  });

  it('module : le titre est obligatoire et borné', () => {
    expect(validateModule(EMPTY_MODULE_FORM()).title).toMatch(/obligatoire/);
    expect(validateModule({ title: 'x'.repeat(151), description: '', requiresWorkstations: false }).title).toMatch(/150/);
    expect(validateModule({ title: 'Fondations', description: 'x'.repeat(1001), requiresWorkstations: false }).description).toMatch(/1000/);
    expect(moduleBody({ title: ' Fondations ', description: '', requiresWorkstations: true }, 2)).toEqual({ version: 2, title: 'Fondations', description: '', requiresWorkstations: true });
    expect(EMPTY_MODULE_FORM().requiresWorkstations).toBe(false);
  });

  it('certificat : programme, titre, prix positifs à deux décimales, devise de trois lettres si un prix est donné', () => {
    const ok = { ...EMPTY_TRAINING_FORM('p1'), title: 'Certificat Expert' };
    expect(validateTraining(ok, { creating: true })).toEqual({});
    expect(validateTraining(EMPTY_TRAINING_FORM(), { creating: true }).programId).toMatch(/programme/);
    expect(validateTraining({ ...ok, programId: '' }, { creating: false }).programId).toBeUndefined();
    for (const priceAmount of ['0', '-3', '10.123', 'abc']) expect(validateTraining({ ...ok, priceAmount }, { creating: true }).priceAmount).toMatch(/positif/);
    for (const modulePriceAmount of ['0', '-3', '10.123', 'abc']) expect(validateTraining({ ...ok, modulePriceAmount }, { creating: true }).modulePriceAmount).toMatch(/positif/);
    expect(validateTraining({ ...ok, priceAmount: '750 000', modulePriceAmount: '125 000,50' }, { creating: true })).toEqual({});
    expect(validateTraining({ ...ok, priceAmount: '100', priceCurrency: 'FCFA' }, { creating: true }).priceCurrency).toMatch(/trois lettres/);
    expect(validateTraining({ ...ok, priceCurrency: 'FCFA' }, { creating: true }).priceCurrency).toBeUndefined();
  });

  it('certificat : le corps de création porte le programme, celui de modification la version ; des prix vidés sont retirés seulement à la modification', () => {
    const form = { ...EMPTY_TRAINING_FORM('p1'), title: ' A ', priceAmount: '750 000', modulePriceAmount: '125000,5', priceCurrency: 'eur', moduleIds: ['m2', 'm1'] };
    expect(trainingBody(form)).toMatchObject({ programId: 'p1', title: 'A', priceAmount: '750000', modulePriceAmount: '125000.5', priceCurrency: 'EUR', moduleIds: ['m2', 'm1'] });
    expect(trainingBody(form)).not.toHaveProperty('version');
    const cleared = { ...form, priceAmount: '', modulePriceAmount: '' };
    expect(trainingBody(cleared)).not.toHaveProperty('priceAmount');
    expect(trainingBody(cleared, 4)).toMatchObject({ version: 4, priceAmount: null, modulePriceAmount: null });
    expect(trainingBody(cleared, 4)).not.toHaveProperty('programId');
    expect(trainingBody({ ...form, priceAmount: '' }, 4)).toMatchObject({ priceAmount: null, modulePriceAmount: '125000.5' });
  });

  it('les modules se déplacent d’un cran, sans sortir de la liste', () => {
    expect(moveModule(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveModule(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
    expect(moveModule(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveModule(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
    expect(moveModule(['a'], 5, 1)).toEqual(['a']);
  });

  it('salle : postes apprenants de 1 à 1000, hors service jusqu’aux postes apprenants, postes formateur de 0 à 10', () => {
    expect(validateRoom(EMPTY_ROOM_FORM())).toMatchObject({ name: expect.any(String), learnerSeats: expect.any(String) });
    const ok = { name: 'Salle de marchés', kind: 'WORKSTATIONS' as const, learnerSeats: '14', unavailableSeats: '1', trainerSeats: '1', equipment: '' };
    expect(validateRoom(ok)).toEqual({});
    for (const learnerSeats of ['0', '1001', '2.5']) expect(validateRoom({ ...ok, learnerSeats }).learnerSeats).toMatch(/entre 1 et 1000/);
    expect(validateRoom({ ...ok, unavailableSeats: '15' }).unavailableSeats).toMatch(/dépasser/);
    expect(validateRoom({ ...ok, unavailableSeats: '-1' }).unavailableSeats).toMatch(/positif ou nul/);
    expect(validateRoom({ ...ok, trainerSeats: '11' }).trainerSeats).toMatch(/entre 0 et 10/);
    expect(roomBody({ ...ok, name: ' Salle ', kind: 'CLASSROOM' }, 3)).toEqual({ version: 3, name: 'Salle', kind: 'CLASSROOM', learnerSeats: 14, unavailableSeats: 1, trainerSeats: 1, equipment: '' });
  });

  it('formateur : nom et prénom obligatoires, e-mail et téléphone facultatifs mais valides ; le téléphone est enregistré sans espace', () => {
    expect(validateTrainer(EMPTY_TRAINER_FORM())).toMatchObject({ lastName: expect.any(String), firstName: expect.any(String) });
    const base = { ...EMPTY_TRAINER_FORM(), lastName: 'A', firstName: 'B' };
    expect(validateTrainer(base)).toEqual({});
    expect(validateTrainer({ ...base, email: 'pas-un-email' }).email).toMatch(/pas valide/);
    expect(validateTrainer({ ...base, phone: '0699123456' }).phone).toMatch(/commencer par 0/);
    expect(trainerBody({ ...base, phone: '+237 699 12 34 56', email: ' a@b.test ' }, 2)).toMatchObject({ version: 2, phone: '+237699123456', email: 'a@b.test' });
  });
});

describe('catalogue : cohérence avec le domaine réel du serveur', () => {
  it('programme et module', () => {
    for (const name of ['', '   ', 'Finance', 'x'.repeat(150), 'x'.repeat(151)]) {
      expect([name, valid(validateProgram({ name, description: '', audience: '' }))]).toEqual([name, serverAccepts(() => ServerProgram.create({ id: 'p', name, now }))]);
      expect([name, valid(validateModule({ title: name, description: '', requiresWorkstations: false }))]).toEqual([name, serverAccepts(() => ServerModule.create({ id: 'm', title: name, now }))]);
    }
  });

  it('certificat : prix complet, prix par module et devise', () => {
    const cases: [string, string, string][] = [
      ['', '', 'XAF'], ['750000', '', 'XAF'], ['', '125000', 'XAF'], ['750000', '125000', 'EUR'], ['0', '', 'XAF'], ['', '10.123', 'XAF'], ['-1', '5', 'XAF'],
      ['1 200,50', '', 'XAF'], ['100', '', 'FCFA'], ['', '', 'FCFA'],
    ];
    for (const [priceAmount, modulePriceAmount, priceCurrency] of cases) {
      const form = { ...EMPTY_TRAINING_FORM('p1'), title: 'T', priceAmount, modulePriceAmount, priceCurrency };
      const body = trainingBody(form) as { priceAmount?: string; modulePriceAmount?: string; priceCurrency?: string };
      const server = serverAccepts(() => ServerTraining.create({ id: 't', programId: 'p1', title: 'T', priceAmount: body.priceAmount, modulePriceAmount: body.modulePriceAmount, priceCurrency: body.priceCurrency, now }));
      expect([priceAmount, modulePriceAmount, priceCurrency, valid(validateTraining(form, { creating: true }))]).toEqual([priceAmount, modulePriceAmount, priceCurrency, server]);
    }
  });

  it('salle : postes apprenants, hors service et postes formateur', () => {
    const cases: [string, string, string][] = [['14', '1', '1'], ['0', '0', '1'], ['1000', '0', '0'], ['1001', '0', '1'], ['2.5', '0', '1'], ['10', '11', '1'], ['10', '10', '1'], ['10', '-1', '1'], ['10', '0', '11'], ['', '0', '1']];
    for (const [learnerSeats, unavailableSeats, trainerSeats] of cases) {
      const form = { name: 'S', kind: 'WORKSTATIONS' as const, learnerSeats, unavailableSeats, trainerSeats, equipment: '' };
      const body = roomBody(form);
      const server = serverAccepts(() => ServerRoom.create({ id: 'r', name: 'S', learnerSeats: body.learnerSeats, unavailableSeats: body.unavailableSeats, trainerSeats: body.trainerSeats, now }));
      expect([learnerSeats, unavailableSeats, trainerSeats, valid(validateRoom(form))]).toEqual([learnerSeats, unavailableSeats, trainerSeats, server]);
    }
  });

  it('formateur : e-mail et téléphone', () => {
    const cases: [string, string][] = [['', ''], ['a@b.test', '+237699123456'], ['pas-un-email', ''], ['', '12'], ['', '0699123456'], ['a@b', ''], ['', '+237 699 12 34 56']];
    for (const [email, phone] of cases) {
      const form = { ...EMPTY_TRAINER_FORM(), lastName: 'A', firstName: 'B', email, phone };
      const body = trainerBody(form);
      const server = serverAccepts(() => ServerTrainer.create({ id: 't', lastName: 'A', firstName: 'B', email: body.email, phone: body.phone, now }));
      expect([email, phone, valid(validateTrainer(form))]).toEqual([email, phone, server]);
    }
  });

  it('rythmes : l’interface affiche ce que le serveur définit', () => {
    expect(RHYTHMS.map((r) => [r.code, weeksText(r.weeks), slotsText(r.slots), r.open])).toEqual([
      ['DAY', '1 semaine', '9h–12h, 13h–17h', true],
      ['EVENING', '2 semaines', '18h–21h', false],
    ]);
  });
});

describe('catalogue : affichage et droits', () => {
  it('montants et tarifs d’un certificat', () => {
    expect(amountText(null, 'XAF')).toBe('—');
    expect(amountText('750000.00', 'XAF')).toBe('750 000 FCFA');
    expect(amountText('1200.50', 'EUR')).toBe('1 200,50 EUR');
    expect(pricingText(null)).toBe('—');
    expect(pricingText({ currency: 'XAF', full: '750000.00', perModule: '125000.00' })).toBe('750 000 FCFA ou 125 000 FCFA par module');
    expect(pricingText({ currency: 'XAF', full: null, perModule: '75000.00' })).toBe('75 000 FCFA par module');
    expect(pricingText({ currency: 'XAF', full: '250000.00', perModule: null })).toBe('250 000 FCFA');
  });

  it('places d’une salle : la capacité utile et les postes en panne', () => {
    const room = (learnerSeats: number, unavailableSeats: number, kind: 'WORKSTATIONS' | 'CLASSROOM' = 'WORKSTATIONS') => ({ kind, learnerSeats, unavailableSeats, usableSeats: learnerSeats - unavailableSeats });
    expect(seatsText(room(14, 1))).toBe('13 places utiles (14 postes, 1 hors service)');
    expect(seatsText(room(16, 2, 'CLASSROOM'))).toBe('14 places utiles (16 places, 2 hors service)');
    expect(seatsText(room(16, 0, 'CLASSROOM'))).toBe('16 places utiles');
    expect([seatWord('WORKSTATIONS'), seatWord('CLASSROOM')]).toEqual(['postes', 'places']);
    expect(ROOM_KIND_LABEL).toEqual({ WORKSTATIONS: 'Avec postes de travail', CLASSROOM: 'Salle de cours' });
    expect(seatsText(room(25, 0))).toBe('25 places utiles');
    expect(formFromRoom({ ...room(14, 1), kind: 'CLASSROOM', id: 'r', name: 'Salle de marchés', trainerSeats: 1, equipment: null, status: 'ACTIVE', version: 1, createdAt: '' } as Room)).toMatchObject({ kind: 'CLASSROOM', learnerSeats: '14', unavailableSeats: '1', trainerSeats: '1' });
  });

  it('les libellés d’archivage sont propres à chaque rubrique (une salle se « désactive »)', () => {
    expect(ARCHIVE_LABEL.rooms.archive).toBe('Désactiver la salle');
    expect(ARCHIVE_LABEL.programs.reactivate).toBe('Réactiver le programme');
    expect(ARCHIVE_PERMISSION.programs).toBe('training.program.archive');
    expect(CATALOGUE_SECTIONS.map((s) => s.id)).toEqual(['programs', 'trainings', 'modules', 'rooms', 'trainers', 'rhythms']);
    expect(CATALOGUE_SECTIONS.find((s) => s.id === 'rhythms')?.write).toBeUndefined();
  });

  it('le module Formation s’ouvre avec le droit de lire les programmes, et seulement avec lui', () => {
    expect(availableModules(profileWith('training.program.read')).map((m) => m.id)).toContain('training');
    expect(availableModules(profileWith('bd.company.read')).map((m) => m.id)).not.toContain('training');
  });

  it('un formulaire de certificat existant reprend ses tarifs, sa devise et ses modules dans l’ordre', () => {
    const training = {
      id: 't', programId: 'p', programName: 'P', title: 'A', objectives: null, prerequisites: 'Bac', pricing: { currency: 'EUR', full: '1000.00', perModule: '300.00' },
      modules: [{ id: 'm2', title: 'B', position: 1, status: 'ACTIVE' }, { id: 'm1', title: 'A', position: 2, status: 'ACTIVE' }], status: 'ACTIVE', version: 2, createdAt: '',
    } as Training;
    expect(formFromTraining(training)).toMatchObject({ priceAmount: '1000.00', modulePriceAmount: '300.00', priceCurrency: 'EUR', prerequisites: 'Bac', objectives: '', moduleIds: ['m2', 'm1'] });
  });
});

describe('tableaux : confinement sur téléphone', () => {
  it('le cadre défilant du tableau est le repère de position des textes réservés aux lecteurs d’écran (sinon la page entière s’élargit)', () => {
    const source = readFileSync(join(__dirname, '..', 'components', 'data', 'data-table.tsx'), 'utf8');
    expect(source).toContain('className="relative overflow-x-auto"');
  });
});
