from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, os, sys
web = str(REPO / 'apps' / 'web')
leave = os.path.join(web, 'lib', 'leave.ts')
mods = os.path.join(web, 'lib', 'modules.ts')
# Chaque mutant est une faute plausible dans la logique des écrans de congés (RH-2b) ; la suite doit la détecter.
M = [
 # --- Dates et durées
 ('A1 le jour n’est pas rempli à deux chiffres', leave, "return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;", "return `${String(d)}/${String(m).padStart(2, '0')}/${y}`;", 'web'),
 ('A2 le mois n’est pas rempli à deux chiffres', leave, "return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;", "return `${String(d).padStart(2, '0')}/${String(m)}/${y}`;", 'web'),
 ('A3 jour et mois sont inversés', leave, "return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;", "return `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}/${y}`;", 'web'),
 ('A4 une absence d’un jour est dite « du … au … »', leave, "if (r.start === r.end) {", "if (false) {", 'web'),
 ('A5 l’après-midi d’un jour seul n’est pas dit', leave, "return `le ${dayText(r.start)}${r.startHalf ? ' (après-midi)' : r.endHalf ? ' (matin)' : ''}`;", "return `le ${dayText(r.start)}${r.endHalf ? ' (matin)' : ''}`;", 'web'),
 ('A6 le matin d’un jour seul n’est pas dit', leave, "return `le ${dayText(r.start)}${r.startHalf ? ' (après-midi)' : r.endHalf ? ' (matin)' : ''}`;", "return `le ${dayText(r.start)}${r.startHalf ? ' (après-midi)' : ''}`;", 'web'),
 ('A7 l’après-midi du premier jour n’est pas dit', leave, "const startNote = r.startHalf ? ' (après-midi)' : '';", "const startNote = '';", 'web'),
 ('A8 le matin du dernier jour n’est pas dit', leave, "const endNote = r.endHalf ? ' (matin)' : '';", "const endNote = '';", 'web'),
 ('A9 « 1 jour » prend un s', leave, "Math.abs(days) > 1 ? 's' : ''", "Math.abs(days) >= 1 ? 's' : ''", 'web'),
 ('A10 « 2 jours » n’a pas de s', leave, "Math.abs(days) > 1 ? 's' : ''", "Math.abs(days) > 2 ? 's' : ''", 'web'),
 ('A11 un nombre à virgule perd sa virgule française', leave, "days.toLocaleString('fr-FR', { maximumFractionDigits: 2 })", "String(days)", 'web'),
 ('A12 les décimales sont tronquées à une', leave, "maximumFractionDigits: 2 }", "maximumFractionDigits: 0 }", 'web'),
 ('A13 les jours de la semaine sont décalés', leave, "return new Date(Date.UTC(y, m - 1, d)).getUTCDay();", "return new Date(Date.UTC(y, m - 1, d + 1)).getUTCDay();", 'web'),
 ('A14 le nom du jour est celui de la veille', leave, "DAYS[weekdayOf(iso)]!", "DAYS[(weekdayOf(iso) + 6) % 7]!", 'web'),
 ('A15 le nom du mois est décalé', leave, "MONTHS[month - 1] ?? ''", "MONTHS[month] ?? ''", 'web'),
 ('A16 ajouter des jours se trompe de sens', leave, "Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);", "Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);", 'web'),
 ('A17 la longueur du mois est celle du suivant', leave, "return new Date(Date.UTC(year, month, 0)).getUTCDate();", "return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();", 'web'),
 ('A18 le mois des bornes n’est pas rempli à deux chiffres', leave, "const mm = String(month).padStart(2, '0');", "const mm = String(month);", 'web'),
 ('A20 le début du mois n’est pas le 1er', leave, "from: `${year}-${mm}-01`", "from: `${year}-${mm}-02`", 'web'),
 ('A21 le mois précédent saute une année', leave, "const index = year * 12 + (month - 1) + by;", "const index = year * 12 + month + by;", 'web'),
 ('A22 le passage de décembre à janvier garde l’année', leave, "return { year: Math.floor(index / 12), month: (index % 12) + 1 };", "return { year, month: (index % 12) + 1 };", 'web'),
 # --- Calendrier d'équipe
 ('B1 une absence est marquée hors de sa période (avant)', leave, "if (day < entry.start || day > entry.end) return null;", "if (day > entry.end) return null;", 'web'),
 ('B2 une absence est marquée hors de sa période (après)', leave, "if (day < entry.start || day > entry.end) return null;", "if (day < entry.start) return null;", 'web'),
 ('B3 le dernier jour n’est pas inclus', leave, "if (day < entry.start || day > entry.end) return null;", "if (day < entry.start || day >= entry.end) return null;", 'web'),
 ('B4 un jour seul à l’après-midi est marqué matin', leave, "return entry.startHalf ? 'afternoon' : entry.endHalf ? 'morning' : 'full';", "return entry.startHalf ? 'morning' : entry.endHalf ? 'morning' : 'full';", 'web'),
 ('B5 un jour seul au matin est marqué journée', leave, "return entry.startHalf ? 'afternoon' : entry.endHalf ? 'morning' : 'full';", "return entry.startHalf ? 'afternoon' : entry.endHalf ? 'full' : 'full';", 'web'),
 ('B6 le premier jour à l’après-midi est marqué journée', leave, "if (day === entry.start && entry.startHalf) return 'afternoon';", "if (false) return 'afternoon';", 'web'),
 ('B7 le dernier jour à midi est marqué journée', leave, "if (day === entry.end && entry.endHalf) return 'morning';", "if (false) return 'morning';", 'web'),
 ('B8 les lignes du calendrier ne sont pas triées par service', leave, "a.department.localeCompare(b.department, 'fr') || ", "", 'web'),
 ('B9 les lignes du calendrier ne sont pas triées par nom', leave, " || a.employeeName.localeCompare(b.employeeName, 'fr')", "", 'web'),
 ('B10 une personne absente deux fois a deux lignes', leave, "const row = rows.get(e.employeeId) ?? {", "const row = {", 'web'),
 # --- Saisie d'une demande
 ('C1 le type d’absence n’est plus exigé', leave, "if (!form.leaveTypeId) errors.leaveTypeId", "if (false) errors.leaveTypeId", 'web'),
 ('C2 la date de début n’est plus exigée', leave, "if (!form.start) errors.start = 'La date de début est obligatoire.';", "if (false) errors.start = 'La date de début est obligatoire.';", 'web'),
 ('C3 une date de début irréelle est acceptée', leave, "else if (!isRealDate(form.start)) errors.start", "else if (false) errors.start", 'web'),
 ('C4 le passé est permis à tous', leave, "else if (form.start < rules.today && !rules.canBackdate) errors.start", "else if (false) errors.start", 'web'),
 ('C5 le jour même est refusé', leave, "form.start < rules.today && !rules.canBackdate", "form.start <= rules.today && !rules.canBackdate", 'web'),
 ('C6 la date de fin n’est plus exigée', leave, "if (!form.end) errors.end = 'La date de fin est obligatoire.';", "if (false) errors.end = 'La date de fin est obligatoire.';", 'web'),
 ('C7 une date de fin irréelle est acceptée', leave, "else if (!isRealDate(form.end)) errors.end", "else if (false) errors.end", 'web'),
 ('C8 une fin avant le début est acceptée', leave, "form.end < form.start) errors.end", "false) errors.end", 'web'),
 ('C9 une fin le jour du début est refusée', leave, "form.end < form.start) errors.end", "form.end <= form.start) errors.end", 'web'),
 ('C10 les demi-journées sont toujours permises', leave, "if (!rules.allowHalfDays && (form.startHalf || form.endHalf)) errors.half", "if (false) errors.half", 'web'),
 ('C11 la demi-journée de fin est ignorée quand elles sont interdites', leave, "(form.startHalf || form.endHalf)) errors.half", "(form.startHalf)) errors.half", 'web'),
 ('C12 le motif n’est pas limité', leave, "if (form.note.trim().length > 500) errors.note", "if (false) errors.note", 'web'),
 ('C13 le motif de 500 caractères est refusé', leave, "form.note.trim().length > 500) errors.note", "form.note.trim().length >= 500) errors.note", 'web'),
 ('C14 l’employé vide est envoyé', leave, "...(form.employeeId ? { employeeId: form.employeeId } : {}),", "employeeId: form.employeeId,", 'web'),
 ('C15 le motif vide est envoyé', leave, "...(form.note.trim() ? { note: form.note.trim() } : {}),", "note: form.note.trim(),", 'web'),
 ('C16 le motif n’est pas nettoyé', leave, "{ note: form.note.trim() } : {}),", "{ note: form.note } : {}),", 'web'),
 ('C17 la demi-journée de début n’est pas envoyée', leave, "...(form.startHalf ? { startHalf: true } : {}),", "", 'web'),
 ('C18 la demi-journée de fin n’est pas envoyée', leave, "...(form.endHalf ? { endHalf: true } : {}),", "", 'web'),
 # --- Annuler, refuser
 ('D1 une demande en attente ne s’annule plus', leave, "if (r.status === 'PENDING') return true;", "if (r.status === 'PENDING') return false;", 'web'),
 ('D2 une absence refusée s’annule', leave, "if (r.status !== 'APPROVED') return false;", "if (r.status === 'CANCELLED') return false;", 'web'),
 ('D3 l’employé annule une absence en cours', leave, "return isHr || r.start > today;", "return true;", 'web'),
 ('D4 l’absence qui commence aujourd’hui s’annule', leave, "return isHr || r.start > today;", "return isHr || r.start >= today;", 'web'),
 ('D5 la RH ne peut plus annuler une absence en cours', leave, "return isHr || r.start > today;", "return r.start > today;", 'web'),
 ('D6 un refus sans motif est accepté', leave, "if (required && !reason) return", "if (false) return", 'web'),
 ('D7 un motif de 500 caractères est refusé', leave, "if (reason.length > 500) return 'Le motif ne peut dépasser 500 caractères.';", "if (reason.length >= 500) return 'Le motif ne peut dépasser 500 caractères.';", 'web'),
 ('D8 un motif facultatif est exigé', leave, "const reason = text.trim();\n  if (required", "const reason = text.trim();\n  if (true", 'web'),
 # --- Ajustement de solde
 ('E1 le nombre de jours n’est plus exigé', leave, "if (!text) errors.days", "if (false) errors.days", 'web'),
 ('E2 un ajustement nul est accepté', leave, "!Number.isFinite(days) || days === 0", "!Number.isFinite(days)", 'web'),
 ('E3 un nombre non numérique est accepté', leave, "!Number.isFinite(days) || days === 0", "days === 0", 'web'),
 ('E4 un ajustement énorme est accepté', leave, "else if (Math.abs(days) > 60) errors.days", "else if (Math.abs(days) > 6000) errors.days", 'web'),
 ('E5 un ajustement négatif est refusé', leave, "Math.abs(days) > 60", "days > 60", 'web'),
 ('E6 un ajustement de 60 jours est refusé', leave, "Math.abs(days) > 60", "Math.abs(days) >= 60", 'web'),
 ('E7 un ajustement hors demi-journée est accepté', leave, "else if (Math.round(days * 2) !== days * 2) errors.days", "else if (false) errors.days", 'web'),
 ('E8 la virgule décimale n’est pas comprise', leave, "const text = form.days.trim().replace(',', '.');", "const text = form.days.trim();", 'web'),
 ('E9 le motif de l’ajustement n’est plus exigé', leave, "if (!reason) errors.reason = 'Le motif est obligatoire.';", "if (false) errors.reason = 'Le motif est obligatoire.';", 'web'),
 ('E10 le motif de l’ajustement n’est pas limité', leave, "else if (reason.length > 500) errors.reason", "else if (false) errors.reason", 'web'),
 ('E11 la conversion en nombre ignore la virgule', leave, "export const parseDays = (text: string): number => Number(text.trim().replace(',', '.'));", "export const parseDays = (text: string): number => Number(text.trim());", 'web'),
 # --- Règles
 ('F1 le taux n’est pas affiché avec une virgule', leave, "accrualDaysPerMonth: String(s.accrualDaysPerMonth).replace('.', ','),", "accrualDaysPerMonth: String(s.accrualDaysPerMonth),", 'web'),
 ('F2 un taux vide est accepté', leave, "if (!form.accrualDaysPerMonth.trim() || !Number.isFinite(value)) return", "if (!Number.isFinite(value)) return", 'web'),
 ('F3 un taux non numérique est accepté', leave, "if (!form.accrualDaysPerMonth.trim() || !Number.isFinite(value)) return", "if (!form.accrualDaysPerMonth.trim()) return", 'web'),
 ('F4 un taux négatif est accepté', leave, "if (value < 0 || value > 5) return", "if (value > 5) return", 'web'),
 ('F5 un taux énorme est accepté', leave, "if (value < 0 || value > 5) return", "if (value < 0 || value > 50) return", 'web'),
 ('F6 un taux de 5 est refusé', leave, "if (value < 0 || value > 5) return", "if (value < 0 || value >= 5) return", 'web'),
 ('F7 un taux à trois décimales est accepté', leave, "if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-9) return", "if (false) return", 'web'),
 # --- Types d'absence
 ('G1 le code d’un type n’est pas exigé', leave, "if (!code) errors.code = 'Le code est obligatoire.';", "if (false) errors.code = 'Le code est obligatoire.';", 'web'),
 ('G2 un code en minuscules est accepté', leave, "!/^[A-Z0-9_]{1,30}$/.test(code)", "!/^[A-Za-z0-9_]{1,30}$/.test(code)", 'web'),
 ('G3 un code de 31 caractères est accepté', leave, "!/^[A-Z0-9_]{1,30}$/.test(code)", "!/^[A-Z0-9_]{1,300}$/.test(code)", 'web'),
 ('G4 le code est contrôlé à la modification', leave, "if (creating) {\n    const code", "if (true) {\n    const code", 'web'),
 ('G5 le libellé d’un type n’est pas exigé', leave, "if (!label) errors.label = 'Le libellé est obligatoire.';", "if (false) errors.label = 'Le libellé est obligatoire.';", 'web'),
 ('G6 le libellé d’un type n’est pas limité', leave, "else if (label.length > 100) errors.label", "else if (false) errors.label", 'web'),
 ('G7 un plafond absurde est accepté', leave, "if (!Number.isFinite(max) || max < 0.5 || max > 365) errors.maxDays", "if (false) errors.maxDays", 'web'),
 ('G8 un plafond de 0,5 est refusé', leave, "max < 0.5 || max > 365", "max <= 0.5 || max > 365", 'web'),
 ('G9 un plafond de 365 est refusé', leave, "max < 0.5 || max > 365", "max < 0.5 || max >= 365", 'web'),
 ('G10 un plafond hors demi-journée est accepté', leave, "else if (Math.round(max * 2) !== max * 2) errors.maxDays", "else if (false) errors.maxDays", 'web'),
 ('G11 l’ordre d’affichage n’est pas contrôlé', leave, "if (!Number.isInteger(order) || order < 0 || order > 10000) errors.sortOrder", "if (false) errors.sortOrder", 'web'),
 ('G12 un ordre négatif est accepté', leave, "order < 0 || order > 10000", "order > 10000", 'web'),
 ('G13 un ordre de 10 000 est refusé', leave, "order < 0 || order > 10000", "order < 0 || order >= 10000", 'web'),
 ('G14 un ordre décimal est accepté', leave, "!Number.isInteger(order) ||", "false ||", 'web'),
 ('G15 le plafond n’est pas repris à la modification', leave, "maxDays: t.maxDaysPerRequest === null ? '' : String(t.maxDaysPerRequest).replace('.', ','),", "maxDays: '',", 'web'),
 ('G16 un plafond à virgule est mal repris', leave, "String(t.maxDaysPerRequest).replace('.', ',')", "String(t.maxDaysPerRequest)", 'web'),
 ('G17 le type vide par défaut ne demande pas de validation', leave, "requiresApproval: true, maxDays: '', sortOrder: '100' };", "requiresApproval: false, maxDays: '', sortOrder: '100' };", 'web'),
 # --- Jours fériés
 ('H1 la date d’un jour férié n’est pas exigée', leave, "if (!day) errors.day = 'La date est obligatoire.';", "if (false) errors.day = 'La date est obligatoire.';", 'web'),
 ('H2 une date de jour férié irréelle est acceptée', leave, "else if (!isRealDate(day)) errors.day", "else if (false) errors.day", 'web'),
 ('H3 le libellé d’un jour férié n’est pas exigé', leave, "if (!label.trim()) errors.label", "if (false) errors.label", 'web'),
 ('H4 le libellé d’un jour férié n’est pas limité', leave, "else if (label.trim().length > 100) errors.label", "else if (false) errors.label", 'web'),
 # --- États, onglets et menu
 ('I1 « validée » est présentée comme une alerte', leave, "APPROVED: { label: 'Validée', tone: 'ok' },", "APPROVED: { label: 'Validée', tone: 'bad' },", 'web'),
 ('I2 « refusée » est présentée comme un succès', leave, "REJECTED: { label: 'Refusée', tone: 'bad' },", "REJECTED: { label: 'Refusée', tone: 'ok' },", 'web'),
 ('I3 « en attente » perd son libellé', leave, "PENDING: { label: 'En attente', tone: 'warn' },", "PENDING: { label: 'Attente', tone: 'warn' },", 'web'),
 ('I4 le filtre « Toutes » disparaît', leave, "{ value: '', label: 'Toutes' },", "", 'web'),
 ('I5 le filtre « Annulées » envoie le mauvais état', leave, "{ value: 'CANCELLED', label: 'Annulées' },", "{ value: 'REJECTED', label: 'Annulées' },", 'web'),
 ('I6 les soldes ne sont plus réservés à la portée Tous', leave, "href: '/hr/leave/balances', permission: 'hr.leave.manage', allScope: true }", "href: '/hr/leave/balances', permission: 'hr.leave.manage', allScope: false }", 'web'),
 ('I7 les paramètres demandent le droit de lecture', leave, "href: '/hr/leave/settings', permission: 'hr.leave.manage', allScope: true }", "href: '/hr/leave/settings', permission: 'hr.leave.read', allScope: true }", 'web'),
 ('I8 la validation demande le droit de lecture', leave, "href: '/hr/leave/approvals', permission: 'hr.leave.approve', allScope: false }", "href: '/hr/leave/approvals', permission: 'hr.leave.read', allScope: false }", 'web'),
 ('I9 le menu des soldes n’est plus réservé à la RH', mods, "href: '/hr/leave/balances', permission: 'hr.leave.manage', allScope: true }", "href: '/hr/leave/balances', permission: 'hr.leave.manage' }", 'web'),
 ('I10 le menu des paramètres n’est plus réservé à la RH', mods, "href: '/hr/leave/settings', permission: 'hr.leave.manage', allScope: true }", "href: '/hr/leave/settings', permission: 'hr.leave.manage' }", 'web'),
 ('I11 le menu de validation est ouvert à tous', mods, "href: '/hr/leave/approvals', permission: 'hr.leave.approve' }", "href: '/hr/leave/approvals' }", 'web'),
 ('I12 le calendrier est caché à ceux qui lisent', mods, "href: '/hr/leave/calendar', permission: 'hr.leave.read' }", "href: '/hr/leave/calendar', permission: 'hr.leave.manage' }", 'web'),
 ('I13 « Mes absences » est caché à ceux qui lisent', mods, "href: '/hr/leave', permission: 'hr.leave.read' }", "href: '/hr/leave', permission: 'hr.leave.manage' }", 'web'),
]
only = sys.argv[1:]
if only:
    M = [m for m in M if m[0].split(' ')[0] in only]


def read(path):
    raw = open(path, 'rb').read()
    return raw, raw.decode('utf8')


if os.environ.get('DRY'):
    bad = 0
    for name, path, a, b, kind in M:
        text = read(path)[1].replace('\r\n', '\n')
        n = text.count(a)
        if n != 1 or a == b:
            bad += 1
        print(name, 'ok' if n == 1 else f'MOTIF {n}')
    print('MOTIFS INVALIDES' if bad else 'tous les motifs sont uniques', bad)
    sys.exit(0)


def run():
    out = subprocess.run('pnpm exec vitest run test/leave.test.ts test/n1-navigation.test.ts test/s38.test.ts', cwd=web, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=600, shell=True).stdout
    lines = [l for l in out.splitlines() if l.strip().startswith('Tests')]
    assert lines, 'run inconclusive: ' + out[-300:]
    return ' failed' in lines[-1]


res = []
for name, path, a, b, kind in M:
    raw, s = read(path)
    crlf = '\r\n' in s
    text = s.replace('\r\n', '\n')
    if text.count(a) != 1:
        print(name, 'MOTIF', text.count(a), flush=True)
        res.append((name, None))
        continue
    mutated = text.replace(a, b)
    open(path, 'wb').write((mutated.replace('\n', '\r\n') if crlf else mutated).encode('utf8'))
    try:
        killed = run()
    except AssertionError as e:
        print(name, 'INCONCLUANT', str(e)[:200], flush=True)
        killed = None
    finally:
        open(path, 'wb').write(raw)
    res.append((name, killed))
    print(name, {True: 'TUÉ', False: 'SURVIVANT', None: 'INCONCLUANT'}[killed], flush=True)
print('BILAN', sum(1 for _, k in res if k), '/', len(res), 'tués ;', [n for n, k in res if k is False], 'survivants ;', [n for n, k in res if k is None], 'inconcluants')
