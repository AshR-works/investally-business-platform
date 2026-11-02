from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, shutil, sys

API = str(REPO / 'apps' / 'crm-api')
B = API + r'\src\modules\business-development'
BS = chr(92)
def p(*parts):
    return B + BS + BS.join(parts)

UNIT = [
    ('U1 version non contrôlée', p('application', 'update-company.use-case.ts'), "if (company.version !== command.version) {", "if (false) {"),
    ('U2 portée de modification ignorée', p('application', 'update-company.use-case.ts'), "if (!company || !decideFor(command.access, 'bd.company.update', company.ownerUserId).allowed) {", "if (!company) {"),
    ('U3 commission perdue si non précisée', p('application', 'facilitation-resolver.ts'), "commission = existing?.commission ?? null;", "commission = null;"),
    ('U4 droit de commission non contrôlé', p('application', 'facilitation-resolver.ts'), "if (!canManageCommission && (input.commission !== null || existing?.commission)) {", "if (false) {"),
    ('U5 retrait du lien sans droit de commission', p('application', 'update-company.use-case.ts'), "if (company.facilitation?.commission && !decideFor(command.access, 'bd.commission.manage', company.ownerUserId).allowed) {", "if (false) {"),
    ('U6 export sans trace', p('application', 'export-company-sheet.query.ts'), "await this.audit.record({", "await Promise.resolve({"),
    ('U7 export : portée ignorée', p('application', 'export-company-sheet.query.ts'), "if (!company || !decideFor(query.access, 'bd.company.read', company.ownerUserId).allowed) {", "if (!company) {"),
    ('U8 export : commission toujours incluse', p('application', 'export-company-sheet.query.ts'), "const canReadCommission = decideFor(query.access, 'bd.commission.read', company.ownerUserId).allowed;", "const canReadCommission = true;"),
    ('U9 échappement HTML incomplet', p('application', 'company-sheet.ts'), ".replace(/</g, '&lt;')", ""),
    ('U10 entreprise archivée modifiable', p('domain', 'company.ts'), "if (this.props.status === CompanyStatus.Archived) {\n      throw new DomainError('INVARIANT_VIOLATION', \"L'entreprise est archivée : elle n'est plus modifiable\");", "if (false) {\n      throw new DomainError('INVARIANT_VIOLATION', \"L'entreprise est archivée : elle n'est plus modifiable\");"),
    ('U11 facilitateur étranger accepté à la modification', p('application', 'facilitation-resolver.ts'), "if (!found || !decideFor(access, 'bd.facilitator.read', found.ownerUserId).allowed) {", "if (!found) {"),
    ('U12 doublon de nom non contrôlé', p('application', 'update-company.use-case.ts'), "(await this.companies.existsByName(name))", "false"),
]
DB = [
    ('D1 retrait du lien non persisté', p('infrastructure', 'prisma-company.repository.ts'), "await this.prisma.db.companyFacilitation.deleteMany({ where: { companyId: company.id } });", "void 0;"),
    ('D2 remplacement du lien non persisté', p('infrastructure', 'prisma-company.repository.ts'), "update: data });", "update: {} });"),
]
mode = sys.argv[1]
LIST = UNIT if mode == 'unit' else DB
killed, survived = [], []
for ident, path, old, new in LIST:
    src = open(path, encoding='utf8').read()
    if src.count(old) != 1:
        print('ANCRE INTROUVABLE', ident, src.count(old)); sys.exit(2)
    shutil.copyfile(path, path + '.orig')
    try:
        open(path, 'w', encoding='utf8', newline='\n').write(src.replace(old, new, 1))
        cmd = 'npx jest src/modules/business-development --runInBand --silent' if mode == 'unit' else 'node scripts/test-db.mjs'
        r = subprocess.run(cmd, shell=True, cwd=API, capture_output=True, text=True, encoding='utf8', errors='replace')
        (killed if r.returncode else survived).append(ident)
        print('TUÉ      ' if r.returncode else 'SURVIVANT', ident, flush=True)
    finally:
        shutil.move(path + '.orig', path)
print('tués', len(killed), '/', len(LIST), '; survivants:', survived)
