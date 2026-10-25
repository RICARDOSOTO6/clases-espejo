# Empaqueta una entrega reproducible sin secretos, sin node_modules y sin
# archivos subidos.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts/empaquetar-entrega.ps1
#
# Genera `release/ClasesEspejo-entrega-AAAA-MM-DD.zip` y su SHA-256.
# No hace commit, no sube nada y no toca la base de datos.
$ErrorActionPreference = 'Stop'

$raiz = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$fecha = Get-Date -Format 'yyyy-MM-dd'
$release = Join-Path $raiz 'release'
$staging = Join-Path $release ('.staging-' + [guid]::NewGuid().ToString('N'))
$zip = Join-Path $release ("ClasesEspejo-entrega-$fecha.zip")
$hash = "$zip.sha256"

New-Item -ItemType Directory -Path $release -Force | Out-Null
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Path $staging -Force | Out-Null

try {
  # Código versionado: excluye .env, uploads, dependencias y todo lo no seguido.
  git -C $raiz archive --format=zip --output="$staging\fuente.zip" HEAD
  Expand-Archive -Path "$staging\fuente.zip" -DestinationPath $staging -Force
  Remove-Item "$staging\fuente.zip" -Force

  # Frontend compilado y API compilada: no están versionados, pero hacen la
  # entrega ejecutable sin volver a compilar el cliente.
  if (Test-Path (Join-Path $raiz 'backend\public')) {
    Copy-Item (Join-Path $raiz 'backend\public') (Join-Path $staging 'backend\public') -Recurse -Force
  }
  if (Test-Path (Join-Path $raiz 'backend\dist')) {
    Copy-Item (Join-Path $raiz 'backend\dist') (Join-Path $staging 'backend\dist') -Recurse -Force
  }

  # Comprobación de seguridad: nada de secretos, adjuntos ni base de datos.
  $prohibidos = @('.env', 'node_modules', 'uploads', 'respaldos', '*.dump')
  foreach ($patron in $prohibidos) {
    $encontrados = Get-ChildItem -Path $staging -Recurse -Force -Filter $patron -ErrorAction SilentlyContinue
    if ($encontrados) {
      throw "La entrega contiene archivos prohibidos ($patron): $($encontrados[0].FullName)"
    }
  }

  # `uploads` no está versionado, pero el build puede crear la carpeta vacía.
  $uploads = Get-ChildItem -Path $staging -Recurse -Directory -Filter 'uploads' -ErrorAction SilentlyContinue
  if ($uploads) { throw "La entrega contiene una carpeta uploads: $($uploads[0].FullName)" }

  if (Test-Path $zip) { Remove-Item $zip -Force }
  Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $zip -CompressionLevel Optimal
  (Get-FileHash -Path $zip -Algorithm SHA256).Hash | Set-Content -Path $hash -Encoding ASCII

  Write-Output "Entrega creada: $zip"
  Write-Output "SHA-256: $((Get-Content $hash).Trim())"
}
finally {
  if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
}
