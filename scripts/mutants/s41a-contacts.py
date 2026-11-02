from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, shutil, sys
API = str(REPO / 'apps' / 'crm-api')
BS = chr(92)
def p(*parts):
    return API + BS + 'src' + BS + 'modules' + BS + 'business-development' + BS + BS.join(parts)
UNIT = [
 ('K1 portée de l’entreprise ignorée', p('application', 'contact-use-cases.ts'), "if (!company || !decideFor(access, permission, company.ownerUserId).allowed) throw new DomainError('NOT_FOUND', NOT_FOUND_COMPANY);", "if (!company) throw new DomainError('NOT_FOUND', NOT_FOUND_COMPANY);"),
 ('K2 portée du contact ignorée', p('application', 'contact-use-cases.ts'), "if (!contact || !company || !decideFor(access, permission, company.ownerUserId).allowed) throw new DomainError('NOT_FOUND', NOT_FOUND_CONTACT);", "if (!contact || !company) throw new DomainError('NOT_FOUND', NOT_FOUND_CONTACT);"),
 ('K3 entreprise archivée acceptée', p('application', 'contact-use-cases.ts'), "if (company.status === CompanyStatus.Archived) throw", "if (false) throw"),
 ('K4 doublons non contrôlés', p('application', 'contact-use-cases.ts'), "if (allowDuplicate) return;", "return;"),
 ('K5 « créer quand même » ignoré', p('application', 'contact-use-cases.ts'), "if (allowDuplicate) return;", "if (false) return;"),
 ('K6 version non contrôlée', p('application', 'contact-use-cases.ts'), "if (contact.version !== command.version) {", "if (false) {"),
 ('K7 liste sans visibilité', p('application', 'contact-use-cases.ts'), "ownerIds: query.visibility.unrestricted ? undefined : query.visibility.ownerIds,", "ownerIds: undefined,"),
 ('K8 filtre par entreprise sans contrôle de portée', p('application', 'contact-use-cases.ts'), "if (query.companyId) await companyInScope(", "if (false) await companyInScope("),
 ('K9 nom du contact non obligatoire', p('domain', 'contact.ts'), "if (!value) throw new DomainError('VALIDATION', `${label} est obligatoire`);", "void 0;"),
 ('K10 fonction inconnue acceptée', p('domain', 'contact.ts'), "if (!ROLES.includes(value)) throw", "if (false) throw"),
]
DB = [
 ('B1 doublon par e-mail ignoré', p('infrastructure', 'prisma-contact.repository.ts'), "OR: [{ nameKey: query.nameKey }, ...(query.emailKey ? [{ emailKey: query.emailKey }] : [])],", "OR: [{ nameKey: query.nameKey }],"),
 ('B2 suppression non persistée', p('infrastructure', 'prisma-contact.repository.ts'), "await this.prisma.db.contact.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });", "void 0;"),
 ('B3 portée de la liste ignorée', p('infrastructure', 'prisma-contact.repository.ts'), "company: { deletedAt: null, ...(query.ownerIds ? { ownerUserId: { in: [...query.ownerIds] } } : {}) },", "company: { deletedAt: null },"),
 ('B4 verrou optimiste ignoré', p('infrastructure', 'prisma-contact.repository.ts'), "where: { id: contact.id, version: contact.version, deletedAt: null },", "where: { id: contact.id, deletedAt: null },"),
]
mode = sys.argv[1]
LIST = UNIT if mode == 'unit' else DB
survived = []
for ident, path, old, new in LIST:
    src = open(path, encoding='utf8').read()
    if src.count(old) != 1:
        print('ANCRE INTROUVABLE', ident, src.count(old)); sys.exit(2)
    shutil.copyfile(path, path + '.orig')
    try:
        open(path, 'w', encoding='utf8', newline='\n').write(src.replace(old, new, 1))
        cmd = 'npx jest src/modules/business-development --runInBand --silent' if mode == 'unit' else 'node scripts/test-db.mjs'
        r = subprocess.run(cmd, shell=True, cwd=API, capture_output=True, text=True, encoding='utf8', errors='replace')
        if not r.returncode: survived.append(ident)
        print('TUÉ      ' if r.returncode else 'SURVIVANT', ident, flush=True)
    finally:
        shutil.move(path + '.orig', path)
print('tués', len(LIST) - len(survived), '/', len(LIST), '; survivants:', survived)
