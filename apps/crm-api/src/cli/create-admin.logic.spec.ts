import { parseAdminArgs } from './create-admin.logic';

describe('parseAdminArgs', () => {
  it('lit --email et --name (formes séparée et avec =)', () => {
    expect(parseAdminArgs(['--email', 'a@b.test', '--name', 'Marie Kamga'])).toEqual({ email: 'a@b.test', name: 'Marie Kamga' });
    expect(parseAdminArgs(['--email=a@b.test', '--name=Marie Kamga'])).toEqual({ email: 'a@b.test', name: 'Marie Kamga' });
  });

  it("REFUSE le mot de passe en argument (historique du shell, liste des processus)", () => {
    expect(() => parseAdminArgs(['--email', 'a@b.test', '--name', 'M', '--password', 'secret'])).toThrow(/jamais le mot de passe/);
    expect(() => parseAdminArgs(['--email', 'a@b.test', '--name', 'M', '--password=secret'])).toThrow(/jamais le mot de passe/);
  });

  it('exige les deux options et refuse les options inconnues', () => {
    expect(() => parseAdminArgs(['--name', 'M'])).toThrow('--email est obligatoire');
    expect(() => parseAdminArgs(['--email', 'a@b.test'])).toThrow('--name est obligatoire');
    expect(() => parseAdminArgs(['--email', 'a@b.test', '--name', 'M', '--role', 'x'])).toThrow(/Option inconnue/);
  });

  it('refuse une valeur manquante ou qui ressemble à une option', () => {
    expect(() => parseAdminArgs(['--email', '--name', 'M'])).toThrow(/Valeur manquante/);
    expect(() => parseAdminArgs(['--email', 'a@b.test', '--name'])).toThrow(/Valeur manquante/);
  });
});
