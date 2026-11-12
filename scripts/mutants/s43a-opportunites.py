from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, os, sys
root = str(REPO / 'apps' / 'api')
base = os.path.join(root, 'src', 'modules', 'business-development')
dom = os.path.join(base, 'domain', 'opportunity.ts')
uc = os.path.join(base, 'application', 'opportunity-use-cases.ts')
repo = os.path.join(base, 'infrastructure', 'prisma-opportunity.repository.ts')
ctrl = os.path.join(base, 'presentation', 'opportunities.controller.ts')
mig = os.path.join(root, 'prisma', 'migrations', '20261105000000_s4_3_opportunities', 'migration.sql')
RULE = "next === OpportunityStage.AgreementInPrinciple && !context.decisionMakerMeetingHeld && !this.props.waivedAt)"
M = [
 ('M1 gagnée avant l’accord de principe', dom, "if (STAGE_ORDER.indexOf(this.props.stage) < STAGE_ORDER.indexOf(OpportunityStage.AgreementInPrinciple)) {", "if (Math.random() > 2) {", 'unit'),
 ('M2 règle du rendez-vous décideur ignorée', dom, RULE, "Math.random() > 2)", 'unit'),
 ('M3 la dérogation ne débloque pas', dom, "next === OpportunityStage.AgreementInPrinciple && !context.decisionMakerMeetingHeld && !this.props.waivedAt)", "next === OpportunityStage.AgreementInPrinciple && !context.decisionMakerMeetingHeld)", 'unit'),
 ('M4 une étape sautée', dom, "const next = this.nextStage;", "const next = STAGE_ORDER[STAGE_ORDER.indexOf(this.props.stage) + 2] ?? null;", 'unit'),
 ('M5 opportunité clôturée modifiable', dom, "if (this.props.status !== OpportunityStatus.Open) throw new DomainError('INVARIANT_VIOLATION', IMMUTABLE);", "if (Math.random() > 2) throw new DomainError('INVARIANT_VIOLATION', IMMUTABLE);", 'unit'),
 ('M6 « autre » sans précision', dom, "if (lossReason === LossReason.Other && typed.length < 3)", "if (Math.random() > 2)", 'unit'),
 ('M7 dérogation sans justification', dom, "const waiverReason = required(reason, 'La justification de la dérogation', 500);", "const waiverReason = (reason ?? '').trim();", 'unit'),
 ('M8 dérogation accordée deux fois', dom, "if (this.props.waivedAt) throw new DomainError('INVARIANT_VIOLATION', 'Une dérogation a déjà été accordée');", "if (Math.random() > 2) throw new DomainError('INVARIANT_VIOLATION', 'x');", 'unit'),
 ('M9 dérogation après l’accord de principe', dom, "STAGE_ORDER.indexOf(this.props.stage) >= STAGE_ORDER.indexOf(OpportunityStage.AgreementInPrinciple)) {\n      throw new DomainError('INVARIANT_VIOLATION', \"L'accord", "Math.random() > 2) {\n      throw new DomainError('INVARIANT_VIOLATION', \"L'accord", 'unit'),
 ('M10 rendez-vous décideur toujours supposé tenu', uc, "const held = needsMeeting ? await this.meetings.hasHeld(opportunity.companyId) : false;", "const held = true;", 'unit'),
 ('M11 gagnée sous le droit « perdue »', uc, "(command.outcome === 'won' ? 'bd.opportunity.close_won' : 'bd.opportunity.close_lost')", "'bd.opportunity.close_lost'", 'unit'),
 ('M12 dérogation sous le droit d’avancer', uc, "protected permission = () => 'bd.opportunity.override';", "protected permission = () => 'bd.opportunity.advance';", 'unit'),
 ('M13 entreprise archivée modifiable', uc, "if (company.status === CompanyStatus.Archived) throw", "if (Math.random() > 2) throw", 'unit'),
 ('M14 portée du pipeline ignorée (base)', repo, "company: { deletedAt: null, ...(query.ownerIds ? { ownerUserId: { in: [...query.ownerIds] } } : {}) },", "company: { deletedAt: null },", 'db'),
 ('M15 verrou optimiste absent (base)', repo, "where: { id: opportunity.id, version: opportunity.version },", "where: { id: opportunity.id },", 'db'),
 ('M16 tri du pipeline inversé (base)', repo, "orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],", "orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],", 'db'),
 ('M17 tout type de rendez-vous compte (base)', repo, "type: 'DECISION_MAKER', status: 'HELD'", "status: 'HELD'", 'db'),
 ('M18 un rendez-vous seulement planifié compte (base)', repo, "status: 'HELD' } })) > 0", "status: { in: ['HELD', 'PLANNED'] } } })) > 0", 'db'),
 ('M19 cohérence de la clôture non garantie par la base', mig, "ALTER TABLE \"bd\".\"opportunities\" ADD CONSTRAINT \"opportunities_closure_coherent\" CHECK (", "-- ALTER TABLE \"bd\".\"opportunities\" ADD CONSTRAINT \"opportunities_closure_coherent_off\" CHECK (true OR (", 'db_mig_closure'),
 ('M20 gagnée sans accord de principe permise par la base', mig, "ALTER TABLE \"bd\".\"opportunities\" ADD CONSTRAINT \"opportunities_won_after_agreement\" CHECK (\n  COALESCE(\"status\" <> 'WON' OR \"stage\" IN ('AGREEMENT_IN_PRINCIPLE', 'ACCREDITATION'), false)\n);", '', 'db'),
 ('M21 dérogation incomplète permise par la base', mig, "ALTER TABLE \"bd\".\"opportunities\" ADD CONSTRAINT \"opportunities_waiver_coherent\" CHECK (\n  COALESCE((\"waiver_reason\" IS NULL) = (\"waived_at\" IS NULL), false)\n);", '', 'db'),
 ('M22 dérogation sous le droit de lecture (route)', ctrl, "@Protected('bd.opportunity.override')", "@Protected('bd.opportunity.read')", 'db'),
 ('M23 clôture gagnée sous le droit de la clôture perdue (route)', ctrl, "@Protected('bd.opportunity.close_won')", "@Protected('bd.opportunity.close_lost')", 'db'),
 ('M24 montant nul permis par la base', mig, "ALTER TABLE \"bd\".\"opportunities\" ADD CONSTRAINT \"opportunities_amount_positive\" CHECK (COALESCE(\"amount\" > 0, false));", '', 'db'),
]
# M19 : le CHECK est multi-lignes ; on le neutralise en remplaçant son corps par une condition toujours vraie.
M = [m for m in M if not m[4].startswith('db_mig')]
M.append(('M19 cohérence de la clôture non garantie par la base', mig, "      WHEN 'LOST' THEN \"closed_at\" IS NOT NULL AND \"loss_reason\" IS NOT NULL", "      WHEN 'LOST' THEN true", 'db'))
only = sys.argv[1:]
if only:
    M = [m for m in M if m[0].split(' ')[0] in only]
env = dict(os.environ, TEST_DB_PORT='54341')
def run(kind):
    if kind == 'unit':
        out = subprocess.run('pnpm exec jest src/modules/business-development --silent', cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=600, shell=True).stdout
    else:
        out = subprocess.run(['node', 'scripts/test-db.mjs', '--tests=opportunities-http'], cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=700, env=env).stdout
    lines = [l for l in out.splitlines() if l.startswith('Tests:')]
    assert lines, 'run inconclusive: ' + out[-300:]
    return ' failed' in lines[-1]
res = []
for name, path, a, b, kind in M:
    s = open(path, encoding='utf8').read()
    assert s.count(a) == 1, name + ' : motif introuvable ou multiple'
    open(path, 'w', encoding='utf8', newline='\n').write(s.replace(a, b))
    try:
        killed = run(kind)
    except AssertionError as e:
        print(name, 'INCONCLUANT', str(e)[:200], flush=True)
        killed = None
    finally:
        open(path, 'w', encoding='utf8', newline='\n').write(s)
    res.append((name, killed))
    print(name, {True: 'TUÉ', False: 'SURVIVANT', None: 'INCONCLUANT'}[killed], flush=True)
print('BILAN', sum(1 for _, k in res if k), '/', len(res), 'tués ;', [n for n, k in res if k is False], 'survivants ;', [n for n, k in res if k is None], 'inconcluants')
