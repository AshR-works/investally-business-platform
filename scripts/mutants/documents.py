from pathlib import Path
# Racine du dépôt : ce script se trouve dans scripts/mutants/.
REPO = Path(__file__).resolve().parents[2]
import subprocess, shutil, os, sys
API = str(REPO / 'apps' / 'crm-api')
D = API + r'\src\modules\documents'
SPECS = ['test/documents-policy.spec.ts', 'test/documents-use-cases.spec.ts', 'test/local-disk-storage.spec.ts']
MUTANTS = [
    ('M1 contrôle d\'accès à l\'objet supprimé', D + r'\application\document-use-cases.ts',
     "if (!owner || !decideFor(access, permission, owner.ownerUserId).allowed) throw new DomainError('NOT_FOUND', notFound);",
     "if (!owner) throw new DomainError('NOT_FOUND', notFound);"),
    ('M2 vérification SHA-256 au téléchargement supprimée', D + r'\application\document-use-cases.ts',
     "if (sha256Of(bytes) !== version.sha256) {", "if (false) {"),
    ('M3 cohérence extension/contenu supprimée', D + r'\domain\document-policy.ts',
     "if (!FORMATS[format].extensions.includes(extensionOf(fileName))) {", "if (false) {"),
    ('M4 macros acceptées', D + r'\domain\document-policy.ts',
     "if (bytes.includes('vbaProject.bin')) return null;", ""),
    ('M5 document archivé accepte des versions', D + r'\domain\document.ts',
     "if (this.isArchived) throw new DomainError('CONFLICT', 'Ce document est archivé : on ne peut plus y ajouter de version');", ""),
    ('M6 clé de stockage non contrôlée', D + r'\infrastructure\local-disk-object-storage.ts',
     "if (!KEY_PATTERN.test(key)) throw new Error('Clé de stockage invalide');", ""),
    ('M7 objet orphelin non retiré (envoi)', D + r'\application\document-use-cases.ts',
     "      await this.storage.removeOrphan(version.storageKey);\n      throw error;\n    }\n    return toDocumentView(document, version);\n  }\n}\n\n/** Ce que reçoit l'ajout d'une version. */",
     "      throw error;\n    }\n    return toDocumentView(document, version);\n  }\n}\n\n/** Ce que reçoit l'ajout d'une version. */"),
    ('M8 téléchargement non audité', D + r'\application\document-use-cases.ts',
     "    await this.audit.record({\n      actor: query.actor, module: 'docs', entityType: 'Document', entityId: document.id, action: AuditAction.Download,\n      newValue: { version: version.versionNumber, sha256: version.sha256, sizeBytes: version.sizeBytes },\n    });\n", ""),
    ('M9 chemin du nom de fichier non retiré', D + r'\domain\document-policy.ts',
     "const base = raw.split(/[\\\\/]/).pop() ?? '';", "const base = raw;"),
    ('M10 archivage sans effet de droit (droit delete ignoré)', D + r'\application\document-use-cases.ts',
     "'docs.document.delete', 'Document introuvable');", "'docs.document.read', 'Document introuvable');"),
    ('M11 taille maximale non contrôlée', D + r'\domain\document-policy.ts',
     "if (bytes.length > MAX_FILE_BYTES) throw", "if (false) throw"),
    ('M12 archivage non idempotent (double audit)', D + r'\application\document-use-cases.ts',
     "if (document.isArchived) return;", ""),
]
survived = []
for name, path, old, new in MUTANTS:
    src = open(path, encoding='utf8').read()
    if old not in src:
        print(f'?? {name} : motif introuvable'); survived.append(name + ' (motif introuvable)'); continue
    shutil.copy(path, path + '.bak')
    open(path, 'w', encoding='utf8', newline='\n').write(src.replace(old, new, 1))
    try:
        r = subprocess.run(['pnpm', 'exec', 'jest', *SPECS], cwd=API, capture_output=True, text=True, shell=True, timeout=300)
        out = r.stdout + r.stderr
        killed = r.returncode != 0
    finally:
        shutil.move(path + '.bak', path)
    print(('TUÉ      ' if killed else 'SURVÉCU  ') + name, flush=True)
    if not killed: survived.append(name)
print('SURVIVANTS :', survived)
