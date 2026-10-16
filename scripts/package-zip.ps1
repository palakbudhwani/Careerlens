# Builds a shareable ZIP of CareerLens for a clean handoff.
#
#   npm run package:zip      (or: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\package-zip.ps1)
#
# Includes every source file, manifest, lockfile, asset and the synthetic
# test resumes. Excludes dependencies, build output, caches, logs, archives,
# temporary/editor files, private resumes, key material and every
# environment/secret file (.env, .env.*, backend/.env).
# .env.example templates are always included.

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$outName = 'CareerLens.zip'
$outPath = Join-Path $root $outName

# Directory names that are never distributed (checked per path segment).
$excludeDirs = @(
  'node_modules',
  'dist',
  'dist-ssr',
  '.git',
  '.vscode',
  '.idea',
  '.vite',
  'coverage',
  'logs'
)

# File names that are never distributed (wildcards allowed).
$excludeFiles = @(
  '*.zip',
  '*.log',
  '*.tsbuildinfo',
  '*.local',
  # Temporary / editor files.
  '*.tmp',
  '*.temp',
  '*.bak',
  '*.orig',
  '*.swp',
  '*.swo',
  '*.rej',
  'Thumbs.db',
  'desktop.ini',
  '.DS_Store',
  '~$*',
  # Key material and credentials of any kind.
  '*.pem',
  '*.key',
  '*.pfx',
  '*.p12',
  'credentials.json',
  'service-account*.json'
)

function Test-ExcludedDir([string]$segment) {
  return $excludeDirs -contains $segment
}

function Test-ExcludedFile([string]$name) {
  foreach ($pattern in $excludeFiles) {
    if ($name -like $pattern) { return $true }
  }
  # Environment / secret files: .env, .env.local, .env.production, ...
  # .env.example is the only one that may ship (at any depth).
  if ($name -eq '.env') { return $true }
  if ($name -like '.env.*' -and $name -ne '.env.example') { return $true }
  return $false
}

# Personal resumes never leave this machine. The only document files allowed
# in the archive are the synthetic fixtures named CareerLens_Test_Resume_*.pdf
# and the synthetic extraction fixtures in backend/tests/fixtures/.
function Test-PrivateDocument([string]$relative, [string]$name) {
  if ($name -like 'CareerLens_Test_Resume_*.pdf') { return $false }
  # Paths arrive with native separators; normalize before matching.
  $rel = $relative.Replace('\', '/')
  if ($rel -like 'backend/tests/fixtures/*') { return $false }
  return ($name -like '*.pdf') -or
         ($name -like '*.doc') -or
         ($name -like '*.docx') -or
         ($name -like '*.rtf') -or
         ($name -like '*.odt')
}

if (Test-Path -LiteralPath $outPath) {
  Remove-Item -LiteralPath $outPath -Force
}

Add-Type -AssemblyName System.IO.Compression | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null

$files = @(Get-ChildItem -LiteralPath $root -Recurse -File -Force |
  Where-Object {
    $full = $_.FullName
    $relative = $full.Substring($root.Length).TrimStart('\', '/')
    $segments = $relative -split '[\\/]'
    $dirSegments = $segments[0..($segments.Count - 2)]
    $name = $segments[$segments.Count - 1]

    $excluded = $false
    foreach ($segment in $dirSegments) {
      if (Test-ExcludedDir $segment) { $excluded = $true; break }
    }
    if (-not $excluded -and (Test-ExcludedFile $name)) { $excluded = $true }
    if (-not $excluded -and (Test-PrivateDocument $relative $name)) { $excluded = $true }
    -not $excluded
  })

if ($files.Count -eq 0) {
  Write-Error 'No files selected - refusing to write an empty archive.'
  exit 1
}

$zip = [System.IO.Compression.ZipFile]::Open($outPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in $files) {
    $relative = $file.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
    $entry = $zip.CreateEntry($relative, [System.IO.Compression.CompressionLevel]::Optimal)
    $entryStream = $entry.Open()
    try {
      $fileStream = [System.IO.File]::OpenRead($file.FullName)
      try { $fileStream.CopyTo($entryStream) } finally { $fileStream.Dispose() }
    } finally {
      $entryStream.Dispose()
    }
  }
} finally {
  $zip.Dispose()
}

# --- Verification: the archive must be complete and clean -------------------
Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null
$archive = [System.IO.Compression.ZipFile]::OpenRead($outPath)
try {
  $entries = @($archive.Entries | ForEach-Object { $_.FullName })
} finally {
  $archive.Dispose()
}

$required = @(
  '.gitattributes',
  'package.json',
  'package-lock.json',
  'README.md',
  '.env.example',
  '.gitignore',
  'index.html',
  'vite.config.ts',
  'tsconfig.json',
  'backend/package.json',
  'backend/package-lock.json',
  'backend/server.js',
  'backend/loadEnv.js',
  'backend/.env.example',
  'backend/pdfExtract.js',
  'backend/tessdata/eng.traineddata.gz',
  'backend/tests/fixtures/unseen-textual.pdf',
  'backend/tests/fixtures/scanned-resume.pdf',
  'src/lib/api-service.ts',
  'src/lib/api-config.ts',
  'src/assets/logos/kpmg.svg',
  'public/favicon.svg',
  'scripts/package-zip.ps1',
  'Resume/CareerLens_Test_Resume_01_AI_FullStack.pdf'
)

$missing = @($required | Where-Object { $entries -notcontains $_ })
if ($missing.Count -gt 0) {
  Write-Host 'ERROR: the archive is missing required files:' -ForegroundColor Red
  $missing | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
  Remove-Item -LiteralPath $outPath -Force
  exit 1
}

$leaked = @($entries | Where-Object {
    $base = ($_ -split '/')[-1]
    $_ -match '(^|/)node_modules/' -or
    $_ -match '(^|/)dist/' -or
    $base -eq '.env' -or
    ($base -like '.env.*' -and $base -ne '.env.example') -or
    $_ -like '*.log' -or
    $_ -like '*.pem' -or
    $_ -like '*.key' -or
    $_ -like '*.pfx' -or
    $_ -like '*.p12' -or
    (
      ($base -like '*.pdf' -or $base -like '*.doc' -or $base -like '*.docx' -or $base -like '*.rtf' -or $base -like '*.odt') -and
      $base -notlike 'CareerLens_Test_Resume_*.pdf' -and
      $_ -notlike 'backend/tests/fixtures/*'
    )
  })
if ($leaked.Count -gt 0) {
  Write-Host 'ERROR: the archive contains files that must never be shared:' -ForegroundColor Red
  $leaked | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
  Remove-Item -LiteralPath $outPath -Force
  exit 1
}

$sizeMB = [math]::Round((Get-Item -LiteralPath $outPath).Length / 1MB, 2)
Write-Host "OK: $outName created with $($entries.Count) files ($sizeMB MB)." -ForegroundColor Green
Write-Host 'Excluded: node_modules, dist, caches, logs, archives, temp files, private resumes, key material, .env and other secret files.'
