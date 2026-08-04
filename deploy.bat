@echo off
REM deploy.bat (root) — jalan pintas deploy dari folder utama repo, supaya
REM cukup mengetik `deploy` dari C:\...\e-bama> tanpa pindah folder.
REM
REM Yang dilakukan:
REM   1) git pull  — ambil kode terbaru dari GitHub
REM   2) backend\deploy.bat — clasp push + clasp deploy ke deployment PRODUKSI
REM Frontend TIDAK perlu langkah lokal: GitHub Actions otomatis deploy ke
REM GitHub Pages setiap ada push yang menyentuh frontend/ (lihat
REM .github\workflows\deploy.yml).
REM
REM Pemakaian:
REM   deploy
REM   deploy "pesan deploy"
setlocal

cd /d "%~dp0"

echo.
echo ^> 0/2 git pull (ambil kode terbaru)...
git pull
if errorlevel 1 (
  echo [X] git pull gagal. Cek koneksi/konflik lalu ulangi.
  exit /b 1
)

call backend\deploy.bat %1
endlocal
