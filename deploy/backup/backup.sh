#!/bin/sh
# Sauvegarde de la V1 : la base (format personnalisé de pg_dump) et les documents téléversés. Exécuté DANS le conteneur « backup » de la composition
# (image postgres:17-alpine, réseau interne) :
#   docker compose -f docker-compose.prod.yml run --rm backup
# Chaque fichier est écrit sous un nom provisoire, vérifié (lisible, non vide), puis renommé : une sauvegarde incomplète n'est jamais prise pour valide.
# Les fichiers contiennent des données personnelles : droits restreints (umask 077), à ne copier que vers un emplacement protégé.
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
DOCS_DIR="${DOCUMENTS_DIR:-/data/documents}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump="$BACKUP_DIR/investally-$stamp.dump"
docs="$BACKUP_DIR/documents-$stamp.tar.gz"

fail() {
  echo "BACKUP ÉCHEC : $1" >&2
  exit 1
}
trap 'rm -f "$dump.partial" "$docs.partial"' EXIT

case "$KEEP_DAYS" in
  '' | *[!0-9]*) fail "BACKUP_KEEP_DAYS doit être un nombre entier de jours" ;;
esac
[ "$KEEP_DAYS" -ge 1 ] || fail "BACKUP_KEEP_DAYS doit valoir au moins 1"
[ -d "$DOCS_DIR" ] || fail "dossier des documents introuvable ($DOCS_DIR)"

umask 077
mkdir -p "$BACKUP_DIR"

# 1. La base.
pg_dump --format=custom --no-owner --file="$dump.partial" || fail "pg_dump a échoué"
[ -s "$dump.partial" ] || fail "la sauvegarde de la base est vide"
pg_restore --list "$dump.partial" > /dev/null || fail "la sauvegarde de la base est illisible"
mv "$dump.partial" "$dump"

# 2. Les documents.
tar -czf "$docs.partial" -C "$DOCS_DIR" . || fail "l'archive des documents n'a pas pu être créée"
tar -tzf "$docs.partial" > /dev/null || fail "l'archive des documents est illisible"
mv "$docs.partial" "$docs"

# 3. Sommes de contrôle (vérifiées par restore-check.sh).
(cd "$BACKUP_DIR" && sha256sum "investally-$stamp.dump" "documents-$stamp.tar.gz" > "backup-$stamp.sha256") || fail "somme de contrôle impossible"

# 4. Rotation : seulement APRÈS une sauvegarde réussie, et jamais le jeu qui vient d'être créé.
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'investally-*.dump' -o -name 'documents-*.tar.gz' -o -name 'backup-*.sha256' \) -mtime +"$KEEP_DAYS" -delete

echo "BACKUP OK investally-$stamp.dump ($(wc -c < "$dump") octets), documents-$stamp.tar.gz ($(wc -c < "$docs") octets)"
