import { describe, expect, it } from 'vitest';
import { ApiError } from '../lib/api';
import { authErrorMessage, isRateLimited, secondsLeft } from '../lib/auth-errors';
import { applyInput, backspaceOnEmpty, digitsOnly, nextFocus } from '../lib/otp';
import { passwordRules } from '../lib/password';

describe('règles du mot de passe affichées en direct', () => {
  it('rien n\'est respecté tant que le champ est vide', () => {
    expect(passwordRules('')).toEqual([{ label: 'Au moins 12 caractères', met: false }]);
  });
  it('avec une adresse connue, aucune règle respectée sur un champ vide', () => {
    expect(passwordRules('', 'prenom.nom@exemple.test').map((r) => r.met)).toEqual([false, false]);
  });
  it('la longueur minimale passe de « à respecter » à « respectée »', () => {
    expect(passwordRules('court')[0].met).toBe(false);
    expect(passwordRules('Zebra-Lampe-Nuage')[0].met).toBe(true);
  });
  it('la règle sur l\'identifiant e-mail n\'apparaît que si l\'adresse est connue et assez longue', () => {
    expect(passwordRules('Zebra-Lampe-Nuage').map((r) => r.label)).toEqual(['Au moins 12 caractères']);
    const rules = passwordRules('prenom.nom-123456', 'prenom.nom@exemple.test');
    expect(rules.map((r) => r.label)).toContain('Ne contient pas votre identifiant e-mail');
    expect(rules.find((r) => r.label.startsWith('Ne contient'))?.met).toBe(false);
  });
});

describe('erreurs d\'authentification', () => {
  it('reconnaît la limitation de débit (429) et elle seule', () => {
    expect(isRateLimited(new ApiError(429, 'TOO_MANY', 'x'))).toBe(true);
    expect(isRateLimited(new ApiError(401, 'UNAUTHENTICATED', 'x'))).toBe(false);
    expect(isRateLimited(new Error('réseau'))).toBe(false);
  });
  it('garde le message du serveur tel quel (jamais enrichi : pas d\'énumération de comptes)', () => {
    expect(authErrorMessage(new ApiError(401, 'UNAUTHENTICATED', 'Identifiants invalides'), 'repli')).toBe('Identifiants invalides');
  });
  it('texte propre pour la limitation de débit, texte de repli pour une panne', () => {
    expect(authErrorMessage(new ApiError(429, 'TOO_MANY', 'quoi que dise le serveur'), 'repli')).toContain('Trop de tentatives');
    expect(authErrorMessage(new TypeError('Failed to fetch'), 'Connexion impossible')).toBe('Connexion impossible');
  });
});

describe('compte à rebours', () => {
  it('arrondit à la seconde supérieure et ne devient jamais négatif', () => {
    expect(secondsLeft(10_000, 0)).toBe(10);
    expect(secondsLeft(10_000, 9_001)).toBe(1);
    expect(secondsLeft(10_000, 10_000)).toBe(0);
    expect(secondsLeft(10_000, 20_000)).toBe(0);
  });
});

describe('saisie du code en six cases', () => {
  it('ne garde que les chiffres, y compris pour un code collé avec espaces ou tirets', () => {
    expect(digitsOnly('123 456')).toBe('123456');
    expect(digitsOnly('12-34-56')).toBe('123456');
    expect(digitsOnly('abc')).toBe('');
  });
  it('un chiffre complète à la suite, remplace sur place, et ne laisse jamais de trou', () => {
    expect(applyInput('', 0, '4')).toBe('4');
    expect(applyInput('48', 2, '1')).toBe('481');
    expect(applyInput('481', 1, '9')).toBe('491');
    expect(applyInput('4', 4, '7')).toBe('47');
  });
  it('un code collé ou rempli automatiquement remplit toutes les cases et reste borné à 6', () => {
    expect(applyInput('', 0, '123456')).toBe('123456');
    expect(applyInput('', 0, '1234567890')).toBe('123456');
    expect(applyInput('12', 2, '3456')).toBe('123456');
  });
  it('effacer une case retire son chiffre ; Retour arrière sur case vide retire le précédent', () => {
    expect(applyInput('1234', 1, '')).toBe('134');
    expect(backspaceOnEmpty('12', 2)).toBe('1');
    expect(backspaceOnEmpty('12', 0)).toBe('12');
  });
  it('le focus suit la saisie sans dépasser la dernière case', () => {
    expect(nextFocus('')).toBe(0);
    expect(nextFocus('123')).toBe(3);
    expect(nextFocus('123456')).toBe(5);
  });
});

