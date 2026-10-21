import { describe, expect, it } from 'vitest';
import { parseInvitationFragment } from '../lib/invitation';
import { deviceLabel } from '../lib/device';
import { passwordHints } from '../lib/password';
import { can, roleLabel } from '../lib/permissions';
import type { Profile } from '../lib/types';

describe('parseInvitationFragment', () => {
  const token = 'A1b2-C3d4_E5f6'.repeat(3);
  it('lit le jeton dans le fragment', () => {
    expect(parseInvitationFragment(`#token=${token}`)).toBe(token);
  });
  it('refuse l\'absence, le vide, les caractères inattendus et les jetons démesurés', () => {
    for (const hash of ['', '#', '#token=', '#other=abc', '#token=a b', '#token=<script>', `#token=${'a'.repeat(201)}`, '#token=a/b', '#token=a%20b']) {
      expect(parseInvitationFragment(hash)).toBeNull();
    }
  });
  it('n\'accepte pas le jeton en paramètre de requête', () => {
    expect(parseInvitationFragment(`?token=${token}`)).toBeNull();
  });
});

describe('passwordHints', () => {
  it('signale la longueur minimale de 12 caractères', () => {
    expect(passwordHints('court')).toContain('Au moins 12 caractères');
    expect(passwordHints('un-mot-de-passe-assez-long')).toEqual([]);
  });
  it('signale l\'identifiant e-mail contenu dans le mot de passe', () => {
    expect(passwordHints('jdemefack-2026-xyz', 'jdemefack@geofleetin.com')).toContain('Ne contient pas votre identifiant e-mail');
    expect(passwordHints('une-phrase-sans-rapport', 'jdemefack@geofleetin.com')).toEqual([]);
  });
});

describe('permissions', () => {
  const profile = (codes: string[]): Profile => ({
    userId: 'u', email: 'a@b.c', displayName: 'A', roles: [], mfaEnrolled: true,
    permissions: codes.map((code) => ({ code, scope: 'OWN' as const })),
  });
  it('can() est vrai uniquement pour une permission détenue', () => {
    expect(can(profile(['iam.user.read']), 'iam.user.read')).toBe(true);
    expect(can(profile(['iam.user.read']), 'iam.user.create')).toBe(false);
    expect(can(null, 'iam.user.read')).toBe(false);
  });
  it('libellés de rôles connus, code brut pour un rôle inconnu', () => {
    expect(roleLabel('SUPER_ADMIN')).toBe('Super administrateur');
    expect(roleLabel('AUTRE')).toBe('AUTRE');
  });
});

describe('deviceLabel', () => {
  it('résume un User-Agent', () => {
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0 Safari/537.36')).toBe('Chrome sur Windows');
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/150.0 Safari/537.36 Edg/150.0')).toBe('Edge sur Windows');
    expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Safari/604.1')).toBe('Safari sur iOS');
  });
  it('reste sobre si inconnu ou vide', () => {
    expect(deviceLabel('')).toBe('Appareil inconnu');
    expect(deviceLabel('curl/8.0')).toBe('Appareil inconnu');
  });
});
