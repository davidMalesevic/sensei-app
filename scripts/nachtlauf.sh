#!/bin/sh
# Nachtlauf für die Ablaufentwürfe.
#
# Wird vom Cron des VPS aufgerufen und stösst die Route im laufenden Container
# an. Bewusst kein Timer im App-Prozess: so überlebt der Lauf jeden Neustart
# und ist von aussen prüfbar (erstellungsprozess.md, Abschnitt 5.1).
#
#   0 3 * * * /opt/sensei-app/scripts/nachtlauf.sh >> /var/log/sensei-nachtlauf.log 2>&1

set -eu

VERZEICHNIS="${SENSEI_DIR:-/opt/sensei-app}"
ENV_DATEI="$VERZEICHNIS/.env.production"

if [ ! -f "$ENV_DATEI" ]; then
  echo "$(date -Is) FEHLER: $ENV_DATEI fehlt"
  exit 1
fi

CRON_SECRET="$(grep -E '^CRON_SECRET=' "$ENV_DATEI" | head -1 | cut -d= -f2-)"

if [ -z "$CRON_SECRET" ]; then
  echo "$(date -Is) FEHLER: CRON_SECRET nicht gesetzt"
  exit 1
fi

echo "$(date -Is) Nachtlauf startet"
curl -fsS --max-time 900 -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  http://127.0.0.1:3000/api/entwuerfe/nacht
echo ""
echo "$(date -Is) Nachtlauf fertig"
