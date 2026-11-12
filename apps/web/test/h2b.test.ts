import { describe, expect, it } from 'vitest';
import { describeLoginEvent, formatDateTime } from '../lib/login-events';
import { SESSION_RISK, statusStyle } from '../lib/status';
import type { LoginEvent } from '../lib/types';

const event = (overrides: Partial<LoginEvent>): LoginEvent => ({
  id: 'e1', at: '2026-10-22T08:00:00.000Z', result: 'SUCCESS', ipAddress: '10.0.0.1', device: 'Mozilla/5.0 Firefox/130', ...overrides,
});

describe('lignes de l\'historique des connexions', () => {
  it('une réussite est un succès sans détail', () => {
    expect(describeLoginEvent(event({}))).toEqual({ label: 'Connexion réussie', detail: '', tone: 'ok' });
  });
  it('un échec dit à quelle étape il s\'est produit, sans motif précis', () => {
    expect(describeLoginEvent(event({ result: 'FAILED', stage: 'PASSWORD' }))).toEqual({ label: 'Échec de connexion', detail: 'Identifiants refusés', tone: 'bad' });
    expect(describeLoginEvent(event({ result: 'FAILED', stage: 'SECOND_FACTOR' }))).toEqual({ label: 'Échec de connexion', detail: 'Second facteur refusé', tone: 'bad' });
  });
  it('un échec sans étape connue reste un échec (jamais un succès par défaut)', () => {
    const d = describeLoginEvent(event({ result: 'FAILED' }));
    expect([d.label, d.tone]).toEqual(['Échec de connexion', 'bad']);
  });
  it('date illisible : un tiret, jamais « Invalid Date »', () => {
    expect(formatDateTime('pas une date')).toBe('—');
    expect(formatDateTime('2026-10-22T08:00:00.000Z')).not.toBe('—');
  });
});

describe('niveau de risque d\'une session', () => {
  it('trois niveaux avec libellé français et teinte croissante', () => {
    expect(['LOW', 'MEDIUM', 'HIGH'].map((code) => statusStyle(SESSION_RISK, code).tone)).toEqual(['ok', 'warn', 'bad']);
    expect(statusStyle(SESSION_RISK, 'LOW').label).toBe('Faible');
  });
  it('un niveau inconnu garde son code en teinte neutre', () => {
    expect(statusStyle(SESSION_RISK, 'EXTREME')).toEqual({ label: 'EXTREME', tone: 'neutral' });
  });
});
