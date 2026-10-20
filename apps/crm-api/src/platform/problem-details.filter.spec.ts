import { describeForLog } from './problem-details.filter';

describe('describeForLog', () => {
  it("n'écrit jamais les valeurs d'une erreur Prisma (hachage, e-mail) dans les journaux", () => {
    const error = new Error('Invalid `prisma.user.create()` invocation: data: { passwordHash: "$argon2id$v=19$SECRET", email: "x@y.test" }');
    error.name = 'PrismaClientValidationError';
    const logged = describeForLog(error);
    expect(logged).toContain('PrismaClientValidationError');
    expect(logged).not.toContain('argon2id');
    expect(logged).not.toContain('x@y.test');
  });

  it('garde le code d\'une erreur Prisma connue', () => {
    const error = Object.assign(new Error('Unique constraint failed on (email_key)'), { name: 'PrismaClientKnownRequestError', code: 'P2002' });
    expect(describeForLog(error)).toContain('P2002');
    expect(describeForLog(error)).not.toContain('email_key');
  });

  it("conserve la trace des erreurs ordinaires pour le diagnostic", () => {
    expect(describeForLog(new Error('boum'))).toContain('boum');
  });

  it('gère une valeur levée qui n\'est pas une Error', () => {
    expect(describeForLog('secret-dans-une-chaine')).toBe('Erreur non standard');
    expect(describeForLog(undefined)).toBe('Erreur non standard');
  });
});
