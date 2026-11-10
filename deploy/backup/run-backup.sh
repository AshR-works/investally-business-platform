#!/bin/sh
# À lancer sur le SERVEUR (cron ou minuterie systemd, voir investally-backup.service et .timer) : sauvegarde, vérifie qu'elle se restaure, puis, si un
# emplacement distant est configuré, en envoie une copie HORS du serveur (une sauvegarde sur le même disque ne protège pas d'une perte du serveur).
#
#   BACKUP_RCLONE_REMOTE="nom-du-remote:chemin"   (facultatif ; rclone installé et configuré par l'opérateur : l'emplacement n'est pas encore choisi)
#
# Code de sortie différent de zéro à la moindre erreur : la minuterie le signale.
set -eu

cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.prod.yml"

$COMPOSE run --rm backup
$COMPOSE run --rm backup /scripts/restore-check.sh

if [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
  # Dossier des sauvegardes sur l'hôte (BACKUP_HOST_DIR dans deploy/.env, ./backups par défaut).
  dir="${BACKUP_HOST_DIR:-./backups}"
  rclone copy "$dir" "$BACKUP_RCLONE_REMOTE" --include 'investally-*.dump' --include 'documents-*.tar.gz' --include 'backup-*.sha256' \
    || { echo "BACKUP ÉCHEC : la copie hors du serveur a échoué" >&2; exit 1; }
  echo "BACKUP COPIÉ vers $BACKUP_RCLONE_REMOTE"
else
  echo "attention : BACKUP_RCLONE_REMOTE n'est pas défini : la sauvegarde reste sur ce serveur" >&2
fi
