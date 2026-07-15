#!/usr/bin/env bash
# deploy.sh — push src/ ke Apps Script lalu deploy ke deployment PRODUKSI
# (URL /exec yang sama dengan frontend/src/lib/api.ts). Jalankan dari mana saja:
#   bash backend/deploy.sh
#
# Prasyarat (sekali saja):
#   npm install -g @google/clasp
#   clasp login          # login akun Google pemilik Apps Script
#   backend/.clasp.json  # berisi {"scriptId":"..."} (sudah ada di mesin ini)
set -euo pipefail

# ID deployment PRODUKSI = segmen di URL /exec (frontend/src/lib/api.ts).
# clasp deploy -i <ID> memperbarui deployment ITU → URL produksi tak berubah.
PROD_DEPLOYMENT_ID="AKfycbwNocZaP2vV_PSbXkpQ3doLHCyo_14ueUSjWpwTLG5Lq8ge68YfBgBO8sVJw4YSaoY2nQ"

cd "$(dirname "$0")"   # pindah ke folder backend/ (tempat .clasp.json)

if [ ! -f .clasp.json ]; then
  echo "✖ backend/.clasp.json tidak ditemukan. Salin dari .clasp.json.example lalu isi scriptId." >&2
  exit 1
fi

DESKRIPSI="${1:-deploy $(date +%Y-%m-%d\ %H:%M)}"

echo "▶ 1/2 clasp push (unggah src/ ke Apps Script)…"
clasp push -f

echo "▶ 2/2 clasp deploy ke deployment produksi…"
clasp deploy -i "$PROD_DEPLOYMENT_ID" -d "$DESKRIPSI"

echo "✔ Selesai. URL produksi /exec sudah memakai kode terbaru."
