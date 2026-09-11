# Centex Walkaround — first-time setup on Windows.
# Installs and runs the gates only. Ship commands are printed at the end for you to paste.
$ErrorActionPreference = "Stop"
$Repo = "C:\dev\centex-walkaround"
$Zip  = Join-Path $env:USERPROFILE "Downloads\centex-walkaround.zip"

if (-not (Test-Path $Repo)) { New-Item -ItemType Directory -Force -Path $Repo | Out-Null }
Expand-Archive -Path $Zip -DestinationPath $Repo -Force
Set-Location $Repo
Write-Host "Installing dependencies..." -ForegroundColor Cyan
npm install
Write-Host "Running gates (expect: 37+ files parse, 0 lint problems, 25 tests, dist/ built)..." -ForegroundColor Cyan
npm run preship

Write-Host ""
Write-Host "Gates passed. When you're ready, in this order:" -ForegroundColor Green
Write-Host "  1. Copy .env.example to .env.local and fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (skip for an offline build)"
Write-Host "  2. supabase login ; supabase link --project-ref <ref>"
Write-Host "  3. supabase secrets set ANTHROPIC_API_KEY=<key>      # optional: ANTHROPIC_MODEL=claude-sonnet-5"
Write-Host "  4. supabase functions deploy compare-zone ; supabase functions deploy draft-notice"
Write-Host "  5. (Phase 2 only) run supabase/schema.sql in the SQL editor"
Write-Host "  6. git init ; git add . ; git commit -m 'Walkaround v1.0.0' ; connect the repo to Netlify (build: npm run build, publish: dist)"
Write-Host "  Local preview any time: npm run dev"
