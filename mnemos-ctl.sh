#!/usr/bin/env bash
# mnemos-ctl.sh — control on-demand de MNEMOS (Normateca semántica de SISS)
# MNEMOS consume ~3.1 GiB idle, por eso NO corre 24/7. Se levanta solo cuando
# se necesita: ingestar normas nuevas o búsqueda semántica en vivo.
# El lookup de texto legal por código se sirve desde mnemos_db sin esta app.
#
# Uso:
#   ./mnemos-ctl.sh up       levanta app + worker y espera a que :8300 responda
#   ./mnemos-ctl.sh down     detiene ambos (libera la RAM)
#   ./mnemos-ctl.sh status   estado de contenedores + salud del API
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE="docker compose -f $DIR/docker-compose.mac.yml"
API="http://localhost:8300/api/documents"

case "${1:-status}" in
  up)
    echo "[mnemos] levantando app + worker..."
    $COMPOSE up -d
    printf "[mnemos] esperando API en :8300"
    for _ in $(seq 1 30); do
      if curl -s -m 3 -o /dev/null -w '' "$API" 2>/dev/null; then
        code=$(curl -s -m 3 -o /dev/null -w '%{http_code}' "$API" 2>/dev/null || echo 000)
        [ "$code" = "200" ] && { echo " -> HTTP 200, listo."; exit 0; }
      fi
      printf "."; sleep 2
    done
    echo " -> timeout: el API no respondió 200 en 60s. Revisa: docker logs mnemos-app-1"
    exit 1
    ;;
  down)
    echo "[mnemos] deteniendo (libera ~3.1 GiB)..."
    $COMPOSE stop
    echo "[mnemos] detenido."
    ;;
  status)
    docker ps --format '{{.Names}} | {{.Status}}' | grep -i mnemos || echo "[mnemos] detenido (0 RAM)"
    code=$(curl -s -m 3 -o /dev/null -w '%{http_code}' "$API" 2>/dev/null); code=${code:-000}
    echo "[mnemos] API :8300 -> HTTP $code"
    ;;
  *)
    echo "uso: $0 {up|down|status}"; exit 2
    ;;
esac
