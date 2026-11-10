#!/bin/sh
# Vérifie qu'une sauvegarde SE RESTAURE : somme de contrôle, restauration dans une base temporaire (jamais dans la base en service), comparaison avec la
# base en service, puis suppression de la base temporaire. Une sauvegarde jamais restaurée n'est qu'une hypothèse.
#   docker compose -f docker-compose.prod.yml run --rm backup /scripts/restore-check.sh [fichier.dump]
# Sans argument : la sauvegarde la plus récente.
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
fail() {
  echo "RESTAURATION ÉCHEC : $1" >&2
  exit 1
}

file="${1:-}"
if [ -z "$file" ]; then
  file="$(ls -1t "$BACKUP_DIR"/investally-*.dump 2> /dev/null | head -n 1 || true)"
fi
[ -n "$file" ] && [ -f "$file" ] || fail "aucune sauvegarde trouvée dans $BACKUP_DIR"

name="$(basename "$file" .dump)"
stamp="${name#investally-}"
if [ -f "$BACKUP_DIR/backup-$stamp.sha256" ]; then
  (cd "$BACKUP_DIR" && sha256sum -c "backup-$stamp.sha256" > /dev/null 2>&1) || fail "somme de contrôle incorrecte : la sauvegarde est altérée"
else
  echo "avertissement : pas de somme de contrôle pour $name" >&2
fi

scratch="restore_check_$(date -u +%Y%m%d%H%M%S)"
cleanup() {
  psql -d postgres -qAt -c "DROP DATABASE IF EXISTS \"$scratch\"" > /dev/null 2>&1 || true
}
trap cleanup EXIT

psql -d postgres -qAt -c "CREATE DATABASE \"$scratch\"" > /dev/null || fail "la base temporaire n'a pas pu être créée"
pg_restore --no-owner --exit-on-error --dbname="$scratch" "$file" || fail "pg_restore a échoué"

count() { psql -d "$1" -qAt -c "$2"; }
tables="$(count "$scratch" "SELECT count(*) FROM information_schema.tables WHERE table_schema IN ('audit','bd','docs','hr','iam','training')")"
[ "$tables" -gt 0 ] || fail "la base restaurée ne contient aucune table de l'application"

# Comparaison avec la base en service : mêmes migrations appliquées, mêmes rôles.
live_migrations="$(count "${PGDATABASE:-investally}" "SELECT count(*) FROM _prisma_migrations")"
restored_migrations="$(count "$scratch" "SELECT count(*) FROM _prisma_migrations")"
live_roles="$(count "${PGDATABASE:-investally}" "SELECT count(*) FROM iam.roles")"
restored_roles="$(count "$scratch" "SELECT count(*) FROM iam.roles")"
[ "$restored_migrations" -le "$live_migrations" ] && [ "$restored_migrations" -gt 0 ] || fail "migrations restaurées ($restored_migrations) incohérentes avec la base en service ($live_migrations)"
[ "$restored_roles" = "$live_roles" ] || fail "rôles restaurés ($restored_roles) différents de la base en service ($live_roles)"
users="$(count "$scratch" "SELECT count(*) FROM iam.users")"

echo "RESTAURATION OK $name : $tables tables, $restored_migrations migrations, $restored_roles rôles, $users comptes (base temporaire supprimée)"
