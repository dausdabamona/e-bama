@echo off
REM deploy.bat — versi Windows dari deploy.sh (untuk mesin tanpa WSL/bash).
REM Push src/ ke Apps Script lalu deploy ke deployment PRODUKSI (URL /exec sama
REM dengan frontend/src/lib/api.ts). Jalankan dari folder backend\:
REM   deploy.bat
REM   deploy.bat "pesan deploy"
REM
REM Prasyarat (sekali saja):
REM   npm install -g @google/clasp
REM   clasp login
REM   backend\.clasp.json  (berisi {"scriptId":"..."})
setlocal

REM ID deployment PRODUKSI = segmen di URL /exec (frontend/src/lib/api.ts).
REM clasp deploy -i <ID> memperbarui deployment ITU -> URL produksi tak berubah.
set "PROD_DEPLOYMENT_ID=AKfycbwNocZaP2vV_PSbXkpQ3doLHCyo_14ueUSjWpwTLG5Lq8ge68YfBgBO8sVJw4YSaoY2nQ"

REM pindah ke folder tempat file .bat ini berada (backend\)
cd /d "%~dp0"

if not exist ".clasp.json" (
  echo [X] backend\.clasp.json tidak ditemukan. Salin dari .clasp.json.example lalu isi scriptId.
  exit /b 1
)

set "DESKRIPSI=%~1"
if "%DESKRIPSI%"=="" set "DESKRIPSI=deploy manual"

echo.
echo ^> 1/2 clasp push (unggah src\ ke Apps Script)...
call clasp push -f
if errorlevel 1 (
  echo [X] clasp push gagal. Pastikan clasp terpasang ^(npm install -g @google/clasp^) dan sudah clasp login.
  exit /b 1
)

echo.
echo ^> 2/2 clasp deploy ke deployment produksi...
call clasp deploy -i "%PROD_DEPLOYMENT_ID%" -d "%DESKRIPSI%"
if errorlevel 1 (
  echo [X] clasp deploy gagal.
  exit /b 1
)

echo.
echo [OK] Selesai. URL produksi /exec sudah memakai kode terbaru.
endlocal
