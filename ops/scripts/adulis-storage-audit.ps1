<#
.SYNOPSIS
  Adulis development storage audit (WO-009A; docs/engineering/DEVELOPMENT-STORAGE-POLICY.md).

.DESCRIPTION
  Measures free disk space and ONLY the Adulis development paths and tool-generated artifact
  locations listed in the configuration block below. It never walks a whole drive and never
  follows junctions or symbolic links (pnpm's node_modules links are skipped, so a package is
  not counted twice through them; hard links into the pnpm store are still counted at their
  apparent size).

  Nothing is deleted unless both -Clean and -Execute are given, and even then only Maestro
  driver APKs in %TEMP% (tmp*.apk, maestro-app*.apk, maestro-server*.apk) that are positively
  identified (a zip whose entries name Maestro),
  older than -MinAgeMinutes and not open by any process. Every other candidate is reported for
  a person to decide.

  Classes: Protected (never cleaned by tooling), Rebuildable (a cache: reuse it, clean only when
  space is critical and nothing is running), Disposable (positively identified and safe once the
  evidence is kept), Review (ownership or necessity uncertain: report, never delete).

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File ops/scripts/adulis-storage-audit.ps1 -Label "A before development"

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File ops/scripts/adulis-storage-audit.ps1 -JsonPath "$env:TEMP\audit.json"

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File ops/scripts/adulis-storage-audit.ps1 -Clean           # dry run
  powershell -NoProfile -ExecutionPolicy Bypass -File ops/scripts/adulis-storage-audit.ps1 -Clean -Execute  # remove

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File ops/scripts/adulis-storage-audit.ps1 -SelfTest
#>
[CmdletBinding()]
param(
  [string]$Label = '',
  [string]$JsonPath = '',
  # Extra agent scratch folders to measure (e.g. the current session's); never cleaned here.
  [string[]]$ScratchDir = @(),
  [int]$Top = 8,
  [switch]$Clean,
  [switch]$Execute,
  [int]$MinAgeMinutes = 60,
  [switch]$SkipDocker,
  [switch]$SelfTest,
  # The external SSD's Adulis working directory (WO-010; ops/scripts/adulis-ssd-env.sh). Measured,
  # and searched for Maestro driver APKs in its <WO>\temp folders; never cleaned otherwise.
  [string]$SsdRoot = 'G:\AdulisDevelopment'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2

# The user's own %TEMP% on C: (from the user environment, so a process-scoped TEMP redirect --
# adulis-ssd-env.sh -- does not hide C:), and the SSD work-order temp folders.
$UserTemp = [Environment]::ExpandEnvironmentVariables([string][Environment]::GetEnvironmentVariable('TEMP', 'User'))
if (-not $UserTemp -or -not (Test-Path -LiteralPath $UserTemp)) { $UserTemp = Join-Path $env:LOCALAPPDATA 'Temp' }
$SsdTemps = @()
if (Test-Path -LiteralPath $SsdRoot) { $SsdTemps = @(Get-ChildItem -LiteralPath $SsdRoot -Directory -Force | ForEach-Object { Join-Path $_.FullName 'temp' } | Where-Object { Test-Path -LiteralPath $_ }) }
$ApkDirs = @($UserTemp) + $SsdTemps

# ---------------------------------------------------------------------------------------------
# Measuring
# ---------------------------------------------------------------------------------------------

# Apparent bytes and file count of a directory tree, junctions and symlinks excluded (/XJ).
# robocopy /L lists without copying or creating anything; it is far faster than a PowerShell walk.
function Measure-Tree([string]$Path, [string[]]$ExcludeDirNames = @()) {
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  $item = Get-Item -LiteralPath $Path -Force
  if (-not $item.PSIsContainer) { return [pscustomobject]@{ Bytes = [int64]$item.Length; Files = 1 } }
  $source = $item.FullName
  if ($source.Length -gt 3) { $source = $source.TrimEnd('\') }
  $nowhere = Join-Path $env:TEMP ('adulis-audit-nowhere-' + [guid]::NewGuid().ToString('N'))
  $rc = @($source, $nowhere, '/L', '/S', '/XJ', '/NJH', '/NFL', '/NDL', '/NP', '/BYTES', '/R:0', '/W:0')
  if ($ExcludeDirNames.Count -gt 0) { $rc += '/XD'; $rc += $ExcludeDirNames }
  $out = & robocopy.exe @rc 2>$null
  $bytes = $null; $files = $null
  foreach ($line in $out) {
    if ($null -eq $bytes -and $line -match '^\s*Bytes\s*:\s*(\d+)') { $bytes = [int64]$Matches[1] }
    if ($null -eq $files -and $line -match '^\s*Files\s*:\s*(\d+)') { $files = [int64]$Matches[1] }
  }
  if ($null -eq $bytes) {
    # Fallback (e.g. a localised robocopy): a .NET walk that skips reparse points.
    $bytes = [int64]0; $files = [int64]0
    $stack = New-Object System.Collections.Stack
    $stack.Push($item.FullName)
    while ($stack.Count -gt 0) {
      $dir = New-Object System.IO.DirectoryInfo ($stack.Pop())
      try { $entries = $dir.GetFileSystemInfos() } catch { continue }
      foreach ($e in $entries) {
        if ($e.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
        if ($e -is [IO.DirectoryInfo]) {
          if ($ExcludeDirNames -notcontains $e.Name) { $stack.Push($e.FullName) }
        } else { $bytes += $e.Length; $files++ }
      }
    }
  }
  return [pscustomobject]@{ Bytes = $bytes; Files = $files }
}

function Format-Size([object]$Bytes) {
  if ($null -eq $Bytes) { return 'absent' }
  $b = [double]$Bytes
  if ($b -ge 1GB) { return ('{0:N2} GB' -f ($b / 1GB)) }
  if ($b -ge 1MB) { return ('{0:N1} MB' -f ($b / 1MB)) }
  if ($b -ge 1KB) { return ('{0:N0} KB' -f ($b / 1KB)) }
  return ('{0} B' -f $b)
}

# A Maestro driver APK: a zip in %TEMP% with one of the names below whose binary manifest declares
# Maestro's package (dev.mobile.maestro, UTF-16 in an APK manifest; the server APK's is
# dev.mobile.maestro.test) or whose entry names mention Maestro (the app driver holds
# res/xml/maestro_input_method.xml). A truncated or unreadable file is never identified.
function Test-MaestroApk([IO.FileInfo]$File) {
  try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
    $zip = [IO.Compression.ZipFile]::OpenRead($File.FullName)
    try {
      $manifest = $zip.GetEntry('AndroidManifest.xml')
      if ($manifest -and $manifest.Length -le 1MB) {
        $stream = $manifest.Open()
        try { $buffer = New-Object IO.MemoryStream; $stream.CopyTo($buffer) } finally { $stream.Dispose() }
        if ([Text.Encoding]::Unicode.GetString($buffer.ToArray()).Contains('dev.mobile.maestro')) { return $true }
      }
      foreach ($entry in $zip.Entries) { if ($entry.FullName -match 'maestro') { return $true } }
      return $false
    } finally { $zip.Dispose() }
  } catch { return $false }
}

# True when no process holds the file open (an exclusive open succeeds).
function Test-Unlocked([IO.FileInfo]$File) {
  try {
    $s = [IO.File]::Open($File.FullName, 'Open', 'ReadWrite', 'None')
    $s.Dispose()
    return $true
  } catch { return $false }
}

# Maestro's driver APKs in %TEMP%: tmp*.apk (seen in WO-009, ~120 MB each) and maestro-app*.apk /
# maestro-server*.apk (seen in WO-009A, ~11 MB each, one per run).
$MaestroApkPatterns = @('tmp*.apk', 'maestro-app*.apk', 'maestro-server*.apk')

function Get-MaestroApks([int]$AgeMinutes) {
  $now = Get-Date
  $found = @()
  $files = @()
  foreach ($dir in $ApkDirs) { foreach ($pattern in $MaestroApkPatterns) { $files += @(Get-ChildItem -LiteralPath $dir -Filter $pattern -File -Force -ErrorAction SilentlyContinue) } }
  # -Filter also matches 8.3 short names (e.g. *.apks): keep real .apk files, each once.
  foreach ($f in @($files | Where-Object { $_.Extension -eq '.apk' } | Sort-Object FullName -Unique)) {
    $old = ($now - $f.LastWriteTime).TotalMinutes -ge $AgeMinutes
    $maestro = Test-MaestroApk $f
    $free = Test-Unlocked $f
    $found += [pscustomobject]@{
      Path = $f.FullName; Bytes = [int64]$f.Length; LastWrite = $f.LastWriteTime.ToString('s')
      Maestro = $maestro; OldEnough = $old; Unlocked = $free; Removable = ($maestro -and $old -and $free)
    }
  }
  return ,$found
}

# ---------------------------------------------------------------------------------------------
# Self-test: measuring, junction exclusion and APK identification on a throwaway folder.
# ---------------------------------------------------------------------------------------------
if ($SelfTest) {
  # On the user's NTFS temp: an exFAT SSD (WO-010) cannot hold the junction this test makes.
  $root = Join-Path $UserTemp ('adulis-audit-selftest-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path (Join-Path $root 'a\node_modules') -Force | Out-Null
  [IO.File]::WriteAllBytes((Join-Path $root 'a\one.bin'), (New-Object byte[] 1000))
  [IO.File]::WriteAllBytes((Join-Path $root 'a\node_modules\two.bin'), (New-Object byte[] 2500))
  New-Item -ItemType Junction -Path (Join-Path $root 'loop') -Target (Join-Path $root 'a') | Out-Null
  try {
    $all = Measure-Tree $root
    if ($all.Bytes -ne 3500 -or $all.Files -ne 2) { throw "self-test: expected 3500 B in 2 files (junction skipped), got $($all.Bytes) B in $($all.Files)" }
    $noModules = Measure-Tree $root @('node_modules')
    if ($noModules.Bytes -ne 1000) { throw "self-test: expected 1000 B without node_modules, got $($noModules.Bytes)" }
    if ($null -ne (Measure-Tree (Join-Path $root 'missing'))) { throw 'self-test: a missing path must measure as absent' }
    $fake = New-Object IO.FileInfo (Join-Path $root 'a\one.bin')
    if (Test-MaestroApk $fake) { throw 'self-test: a non-zip must not be identified as a Maestro APK' }
    Write-Output 'adulis-storage-audit self-test: PASS'
  } finally {
    # Only the folder this self-test created, junction first so nothing is followed.
    [IO.Directory]::Delete((Join-Path $root 'loop'))
    Remove-Item -LiteralPath $root -Recurse -Force
  }
  exit 0
}

# ---------------------------------------------------------------------------------------------
# Configuration: the only places this script looks. Missing paths are reported as absent.
# ---------------------------------------------------------------------------------------------
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$workspace = Split-Path $repo -Parent
$prototype = Join-Path $workspace 'AdulisCommercePlatformPrototype'
function UserEnv([string]$Name, [string]$Default) {
  $v = [Environment]::GetEnvironmentVariable($Name, 'User')
  if (-not $v) { $v = [Environment]::GetEnvironmentVariable($Name, 'Process') }
  if (-not $v) { $v = $Default }
  return $v
}
$gradleHome = UserEnv 'GRADLE_USER_HOME' (Join-Path $env:USERPROFILE '.gradle')
$androidHome = UserEnv 'ANDROID_HOME' (Join-Path $env:LOCALAPPDATA 'Android\Sdk')
$avdHome = UserEnv 'ANDROID_AVD_HOME' (Join-Path $env:USERPROFILE '.android\avd')
$pnpmStore = Join-Path $env:LOCALAPPDATA 'pnpm\store'

$targets = @(
  # Repositories
  @{ G = 'Repository'; N = 'Adulis-MobileApp (total, no junctions)'; P = $repo; C = 'Protected'; Note = 'source, Git history, installed dependencies' }
  @{ G = 'Repository'; N = 'Adulis-MobileApp .git'; P = (Join-Path $repo '.git'); C = 'Protected'; Note = '' }
  @{ G = 'Repository'; N = 'apps/api/dist'; P = (Join-Path $repo 'apps\api\dist'); C = 'Rebuildable'; Note = 'pnpm build' }
  @{ G = 'Repository'; N = 'apps/console/dist'; P = (Join-Path $repo 'apps\console\dist'); C = 'Rebuildable'; Note = 'pnpm build' }
  @{ G = 'Repository'; N = 'apps/mobile/dist'; P = (Join-Path $repo 'apps\mobile\dist'); C = 'Rebuildable'; Note = 'expo export (mobile build gate)' }
  @{ G = 'Repository'; N = 'apps/mobile/.expo'; P = (Join-Path $repo 'apps\mobile\.expo'); C = 'Rebuildable'; Note = 'Expo dev state' }
  @{ G = 'Repository'; N = 'apps/mobile/android (prebuild)'; P = (Join-Path $repo 'apps\mobile\android'); C = 'Rebuildable'; Note = 'native builds are done in a copy on G:' }
  @{ G = 'Repository'; N = 'AdulisCommercePlatformPrototype (read-only)'; P = $prototype; C = 'Protected'; Note = 'never modified by Mobile work' }
  # Android
  @{ G = 'Android'; N = 'Gradle user home'; P = $gradleHome; C = 'Rebuildable'; Note = 'reuse; a re-download is slow here' }
  @{ G = 'Android'; N = 'Android SDK'; P = $androidHome; C = 'Protected'; Note = '' }
  @{ G = 'Android'; N = 'Android AVDs'; P = $avdHome; C = 'Protected'; Note = 'emulator data' }
  @{ G = 'Android'; N = '%USERPROFILE%\.gradle'; P = (Join-Path $env:USERPROFILE '.gradle'); C = 'Rebuildable'; Note = 'should stay small: GRADLE_USER_HOME is on G:' }
  @{ G = 'Android'; N = '%USERPROFILE%\.android'; P = (Join-Path $env:USERPROFILE '.android'); C = 'Protected'; Note = 'adb keys, emulator settings' }
  @{ G = 'Android'; N = 'G:\w2 (9 Nov native build copy)'; P = 'G:\w2'; C = 'Review'; Note = 'its debug APK is reused while native deps are unchanged' }
  @{ G = 'Android'; N = 'G:\w2x (CMake staging for w2)'; P = 'G:\w2x'; C = 'Review'; Note = 'rebuildable if w2 is rebuilt' }
  @{ G = 'Android'; N = 'G:\wo001a (WO-001A build copy)'; P = 'G:\wo001a'; C = 'Review'; Note = 'superseded by w2' }
  @{ G = 'Android'; N = 'G:\w10a (WO-010A native build copy, SDK 58 patches)'; P = 'G:\w10a'; C = 'Review'; Note = 'its debug APK is reused while native deps are unchanged' }
  @{ G = 'Android'; N = 'G:\w10ax (CMake staging for w10a)'; P = 'G:\w10ax'; C = 'Review'; Note = 'rebuildable if w10a is rebuilt' }
  # Expo, Metro, Jest
  @{ G = 'Expo/Metro/Jest'; N = '%TEMP%\metro-cache'; P = (Join-Path $UserTemp 'metro-cache'); C = 'Rebuildable'; Note = 'Metro transform cache' }
  @{ G = 'Expo/Metro/Jest'; N = '%TEMP%\jest'; P = (Join-Path $UserTemp 'jest'); C = 'Rebuildable'; Note = 'Jest transform cache' }
  @{ G = 'Expo/Metro/Jest'; N = '%USERPROFILE%\.expo'; P = (Join-Path $env:USERPROFILE '.expo'); C = 'Review'; Note = 'may hold Expo login state' }
  # %TEMP% as a whole: every tool writes there (also non-Adulis ones), measured for attribution only
  @{ G = 'Temp (all tools)'; N = '%TEMP% total'; P = $UserTemp; C = 'Review'; Note = 'includes the rows above and other software' }
  # Maestro
  @{ G = 'Maestro'; N = '%USERPROFILE%\.maestro'; P = (Join-Path $env:USERPROFILE '.maestro'); C = 'Review'; Note = 'test output and screenshots (evidence)' }
  @{ G = 'Maestro'; N = 'C:\maestro (CLI install)'; P = 'C:\maestro'; C = 'Protected'; Note = '' }
  # AI coding agent
  @{ G = 'AI agent'; N = '%TEMP%\claude (session scratch, all sessions)'; P = (Join-Path $UserTemp 'claude'); C = 'Review'; Note = 'may hold evidence of open work' }
  @{ G = 'AI agent'; N = '%USERPROFILE%\.claude'; P = (Join-Path $env:USERPROFILE '.claude'); C = 'Protected'; Note = 'transcripts, memory, plugins' }
  @{ G = 'AI agent'; N = 'G:\adulis-claude-scratch-archive'; P = 'G:\adulis-claude-scratch-archive'; C = 'Protected'; Note = 'deleting needs founder authorisation' }
  # Package caches
  @{ G = 'Package caches'; N = 'npm cache (%LOCALAPPDATA%\npm-cache)'; P = (Join-Path $env:LOCALAPPDATA 'npm-cache'); C = 'Rebuildable'; Note = '' }
  @{ G = 'Package caches'; N = 'G:\npm-cache-adulis'; P = 'G:\npm-cache-adulis'; C = 'Rebuildable'; Note = 'used for npx expo-doctor' }
  @{ G = 'Package caches'; N = 'pnpm store'; P = $pnpmStore; C = 'Rebuildable'; Note = 'hard-linked into node_modules: deleting frees little' }
  # Docker and WSL virtual disks (file size = space taken on the host; they grow, never shrink by themselves)
  @{ G = 'Docker/WSL'; N = 'Docker data disk (docker_data.vhdx)'; P = (Join-Path $env:LOCALAPPDATA 'Docker\wsl\disk\docker_data.vhdx'); C = 'Protected'; Note = 'holds the PostgreSQL and MinIO volumes' }
  @{ G = 'Docker/WSL'; N = 'docker-desktop distro (ext4.vhdx)'; P = (Join-Path $env:LOCALAPPDATA 'Docker\wsl\main\ext4.vhdx'); C = 'Protected'; Note = '' }
)
foreach ($s in $ScratchDir) { $targets += @{ G = 'AI agent'; N = "scratch: $s"; P = $s; C = 'Review'; Note = 'current session' } }
# The external SSD: its Adulis root and each work order's folder (temp, scratch, Maestro, logs...).
if (Test-Path -LiteralPath $SsdRoot) {
  $targets += @{ G = 'External SSD'; N = "$SsdRoot (total)"; P = $SsdRoot; C = 'Review'; Note = 'work-order temporary outputs and caches' }
  foreach ($w in @(Get-ChildItem -LiteralPath $SsdRoot -Directory -Force)) {
    foreach ($sub in @(Get-ChildItem -LiteralPath $w.FullName -Directory -Force)) {
      $targets += @{ G = 'External SSD'; N = "$($w.Name)\$($sub.Name)"; P = $sub.FullName; C = $(if ($w.Name -eq 'shared-cache' -or $sub.Name -eq 'cache') { 'Rebuildable' } else { 'Review' }); Note = '' }
    }
  }
}

# ---------------------------------------------------------------------------------------------
# Audit
# ---------------------------------------------------------------------------------------------
$started = Get-Date
$drives = @(Get-PSDrive -PSProvider FileSystem | Where-Object { $null -ne $_.Used -and ($_.Used + $_.Free) -gt 0 } |
  ForEach-Object { [pscustomobject]@{ Drive = $_.Name; FreeBytes = [int64]$_.Free; UsedBytes = [int64]$_.Used } })

$rows = @()
foreach ($t in $targets) {
  $m = Measure-Tree $t.P
  $rows += [pscustomobject]@{ Group = $t.G; Name = $t.N; Path = $t.P; Class = $t.C; Bytes = $(if ($m) { $m.Bytes } else { $null }); Files = $(if ($m) { $m.Files } else { $null }); Note = $t.Note }
}
# node_modules across the repository = total minus the total without any node_modules folder.
$repoTotal = ($rows | Where-Object { $_.Path -eq $repo } | Select-Object -First 1).Bytes
$repoNoModules = (Measure-Tree $repo @('node_modules')).Bytes
$rows += [pscustomobject]@{ Group = 'Repository'; Name = 'node_modules (all, no junctions)'; Path = "$repo\**\node_modules"; Class = 'Protected'; Bytes = ($repoTotal - $repoNoModules); Files = $null; Note = 'installed dependencies; rebuildable but needed' }

$apks = Get-MaestroApks $MinAgeMinutes
$apkBytes = [int64]0
foreach ($a in $apks) { $apkBytes += $a.Bytes }
$ssdApkBytes = [int64]0; $ssdApkCount = 0
foreach ($a in $apks) { if ($a.Path -notlike "$UserTemp*") { $ssdApkBytes += $a.Bytes; $ssdApkCount++ } }
$rows += [pscustomobject]@{ Group = 'Maestro'; Name = "driver APKs, all temp dirs ($($apks.Count) files; $ssdApkCount on the SSD)"; Path = ($ApkDirs -join ';'); Class = 'Disposable'; Bytes = $apkBytes; Files = $apks.Count; Note = ('Maestro driver APKs, one per run; {0:N0} bytes on the SSD' -f $ssdApkBytes) }

# The Windows page file grows on C: under memory pressure (emulator, Jest, Docker) and is hidden
# from a file read: its allocated size and the free RAM, for attribution only (system managed).
try {
  $pf = @(Get-CimInstance Win32_PageFileUsage -ErrorAction Stop)
  foreach ($p in $pf) {
    $rows += [pscustomobject]@{ Group = 'Windows'; Name = "page file $($p.Name) allocated (in use $($p.CurrentUsage) MB, peak $($p.PeakUsage) MB)"; Path = $p.Name; Class = 'Protected'; Bytes = [int64]$p.AllocatedBaseSize * 1MB; Files = $null; Note = 'system managed; grows under memory pressure' }
  }
  $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
  $rows += [pscustomobject]@{ Group = 'Windows'; Name = 'free physical memory (not disk)'; Path = 'RAM'; Class = 'Review'; Bytes = [int64]$os.FreePhysicalMemory * 1KB; Files = $null; Note = ('of {0:N1} GB' -f ($os.TotalVisibleMemorySize / 1MB)) }
  # Commit charge near the commit limit (RAM + page file) is when a system-managed page file grows.
  $rows += [pscustomobject]@{ Group = 'Windows'; Name = 'commit charge (not disk)'; Path = 'commit'; Class = 'Review'; Bytes = ([int64]$os.TotalVirtualMemorySize - [int64]$os.FreeVirtualMemory) * 1KB; Files = $null; Note = ('of a {0:N1} GB commit limit' -f ($os.TotalVirtualMemorySize / 1MB)) }
} catch { }
# A running Android emulator holds memory backed by C: (WO-010: stopping it returned about 10.6 GB).
foreach ($q in @(Get-Process -Name 'qemu-system-x86_64' -ErrorAction SilentlyContinue)) {
  $rows += [pscustomobject]@{ Group = 'Windows'; Name = "Android emulator running (pid $($q.Id), private memory)"; Path = 'qemu'; Class = 'Review'; Bytes = [int64]$q.PrivateMemorySize64; Files = $null; Note = 'stop it when not testing natively' }
}
$rows += [pscustomobject]@{ Group = 'Windows'; Name = "temp location of this process: $env:TEMP"; Path = 'TEMP'; Class = 'Review'; Bytes = $null; Files = $null; Note = "user TEMP: $UserTemp" }

# pip's unpack folders left in %TEMP% (owner not provable: reported, never cleaned here).
$pipBytes = [int64]0; $pipCount = 0
foreach ($d in @(Get-ChildItem -LiteralPath $UserTemp -Directory -Filter 'pip-unpack-*' -Force -ErrorAction SilentlyContinue)) {
  $pipBytes += (Measure-Tree $d.FullName).Bytes; $pipCount++
}
$rows += [pscustomobject]@{ Group = 'Temp (all tools)'; Name = "%TEMP%\pip-unpack-* ($pipCount folders)"; Path = (Join-Path $UserTemp 'pip-unpack-*'); Class = 'Review'; Bytes = $pipBytes; Files = $null; Note = 'pip leftovers; owner not provable' }

# Largest temporary folders: each agent session scratch folder and each known tool cache.
$tempDirs = @()
$claudeTemp = Join-Path $UserTemp 'claude'
if (Test-Path -LiteralPath $claudeTemp) {
  foreach ($d in @(Get-ChildItem -LiteralPath $claudeTemp -Directory -Force | ForEach-Object { Get-ChildItem -LiteralPath $_.FullName -Directory -Force })) {
    $m = Measure-Tree $d.FullName
    $tempDirs += [pscustomobject]@{ Path = $d.FullName; Bytes = $m.Bytes; LastWrite = $d.LastWriteTime.ToString('s') }
  }
}
foreach ($p in @('metro-cache', 'jest')) {
  $full = Join-Path $UserTemp $p
  $m = Measure-Tree $full
  if ($m) { $tempDirs += [pscustomobject]@{ Path = $full; Bytes = $m.Bytes; LastWrite = (Get-Item -LiteralPath $full).LastWriteTime.ToString('s') } }
}
foreach ($d in @(Get-ChildItem -LiteralPath $UserTemp -Directory -Filter 'haste-map*' -Force -ErrorAction SilentlyContinue)) {
  $tempDirs += [pscustomobject]@{ Path = $d.FullName; Bytes = (Measure-Tree $d.FullName).Bytes; LastWrite = $d.LastWriteTime.ToString('s') }
}
$tempDirs = @($tempDirs | Sort-Object Bytes -Descending)

# Docker's own accounting (inside the virtual disk, not visible as host files).
$docker = @()
if (-not $SkipDocker -and (Get-Command docker -ErrorAction SilentlyContinue)) {
  try {
    $lines = & docker system df --format '{{json .}}' 2>$null
    foreach ($l in $lines) { if ($l) { $docker += ($l | ConvertFrom-Json) } }
  } catch { $docker = @() }
}

# Candidates: what a person (or -Clean for the Disposable class) may act on.
$candidates = @()
foreach ($a in $apks) {
  $why = if ($a.Removable) { 'Maestro driver APK, unused' } elseif (-not $a.Maestro) { 'not identified as Maestro: left alone' } elseif (-not $a.Unlocked) { 'in use' } else { "younger than $MinAgeMinutes min" }
  $candidates += [pscustomobject]@{ Class = $(if ($a.Removable) { 'Disposable' } else { 'Review' }); Path = $a.Path; Bytes = $a.Bytes; Action = $(if ($a.Removable) { 'removed by -Clean -Execute' } else { 'none' }); Reason = $why }
}
$cutoff = (Get-Date).AddDays(-2)
foreach ($d in $tempDirs) {
  # The current session's folder (a parent of a -ScratchDir) is never a candidate.
  $current = @($ScratchDir | Where-Object { $_ -like "$($d.Path)*" }).Count -gt 0
  if ($d.Path -like "$claudeTemp*" -and [datetime]$d.LastWrite -lt $cutoff -and $d.Bytes -gt 50MB -and -not $current) {
    $candidates += [pscustomobject]@{ Class = 'Review'; Path = $d.Path; Bytes = $d.Bytes; Action = 'person decides (move, then delete)'; Reason = 'agent scratch untouched for 2+ days' }
  }
}
foreach ($r in $rows) {
  if ($r.Class -eq 'Rebuildable' -and $r.Bytes -gt 1GB) {
    $candidates += [pscustomobject]@{ Class = 'Rebuildable'; Path = $r.Path; Bytes = $r.Bytes; Action = 'reuse; clean only if space is critical'; Reason = 'large cache' }
  }
  if ($r.Path -like '*pip-unpack-*' -and $r.Bytes -gt 100MB) {
    $candidates += [pscustomobject]@{ Class = 'Review'; Path = $r.Path; Bytes = $r.Bytes; Action = 'person decides'; Reason = 'pip temp leftovers; no running pip needs them, but the owner is not provable' }
  }
  if ($r.Class -eq 'Review' -and $r.Path -like 'G:\*' -and $r.Bytes -gt 1GB) {
    $candidates += [pscustomobject]@{ Class = 'Review'; Path = $r.Path; Bytes = $r.Bytes; Action = 'founder decides'; Reason = $r.Note }
  }
}
foreach ($d in $docker) {
  if ($d.Type -eq 'Build Cache') {
    $candidates += [pscustomobject]@{ Class = 'Review'; Path = 'docker build cache'; Bytes = $null; Action = 'founder decides (never prune volumes)'; Reason = "Docker reports $($d.Size), reclaimable $($d.Reclaimable); may belong to other projects; host space returns only after compacting the vhdx" }
  }
}

# ---------------------------------------------------------------------------------------------
# Cleanup (dry run unless -Execute): verified Maestro driver APKs only.
# ---------------------------------------------------------------------------------------------
$cleaned = @()
if ($Clean) {
  foreach ($a in $apks | Where-Object { $_.Removable }) {
    if ($Execute) {
      # Checked again right before deleting: a run that started since the scan keeps its file.
      $done = $false
      $file = Get-Item -LiteralPath $a.Path -Force -ErrorAction SilentlyContinue
      if ($file -and (Test-Unlocked $file)) {
        try { Remove-Item -LiteralPath $a.Path -Force -ErrorAction Stop; $done = $true } catch { $done = $false }
      }
      $cleaned += [pscustomobject]@{ Path = $a.Path; Bytes = $a.Bytes; Done = $done }
    } else {
      $cleaned += [pscustomobject]@{ Path = $a.Path; Bytes = $a.Bytes; Done = $false }
    }
  }
}

# One removed total for the text report and the JSON (ON-20261111-170): only files actually
# deleted, summed by drive so C: and the SSD stay separate. Never a free-space difference.
$removed = @($cleaned | Where-Object { $_.Done })
$removedByDrive = [ordered]@{}
foreach ($r in $removed) {
  # The path's root, culture-invariant (a UNC path keeps its share; review S-004).
  $drive = [IO.Path]::GetPathRoot($r.Path).TrimEnd('\', ':').ToUpperInvariant()
  if (-not $removedByDrive.Contains($drive)) { $removedByDrive[$drive] = [int64]0 }
  $removedByDrive[$drive] += [int64]$r.Bytes
}
$removedBytes = [int64]0
foreach ($v in $removedByDrive.Values) { $removedBytes += $v }

# ---------------------------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------------------------
$drivesAfter = @(Get-PSDrive -PSProvider FileSystem | Where-Object { $null -ne $_.Used -and ($_.Used + $_.Free) -gt 0 } |
  ForEach-Object { [pscustomobject]@{ Drive = $_.Name; FreeBytes = [int64]$_.Free; UsedBytes = [int64]$_.Used } })

Write-Output ''
Write-Output ("Adulis storage audit  {0}  {1}" -f $started.ToString('yyyy-MM-dd HH:mm:ss'), $Label)
Write-Output ''
Write-Output 'Free space (at start of audit)'
foreach ($d in $drives) { Write-Output ('  {0}:  free {1,12}   used {2,12}   ({3:N0} bytes free)' -f $d.Drive, (Format-Size $d.FreeBytes), (Format-Size $d.UsedBytes), $d.FreeBytes) }
foreach ($g in @($rows | Select-Object -ExpandProperty Group -Unique)) {
  Write-Output ''
  Write-Output $g
  foreach ($r in @($rows | Where-Object { $_.Group -eq $g })) {
    Write-Output ('  {0,-48} {1,12}  {2,-11} {3}' -f $r.Name, (Format-Size $r.Bytes), $r.Class, $r.Note)
  }
}
Write-Output ''
Write-Output ("Largest temporary folders (top {0})" -f $Top)
foreach ($d in @($tempDirs | Select-Object -First $Top)) { Write-Output ('  {0,12}  {1}  (last write {2})' -f (Format-Size $d.Bytes), $d.Path, $d.LastWrite) }
if ($docker.Count -gt 0) {
  Write-Output ''
  Write-Output 'Docker (inside its virtual disk)'
  foreach ($d in $docker) { Write-Output ('  {0,-14} total {1,4}  active {2,4}  size {3,10}  reclaimable {4}' -f $d.Type, $d.TotalCount, $d.Active, $d.Size, $d.Reclaimable) }
}
Write-Output ''
Write-Output 'Cleanup candidates'
if ($candidates.Count -eq 0) { Write-Output '  none' }
foreach ($c in $candidates) { Write-Output ('  [{0}] {1,10}  {2}  -- {3}; {4}' -f $c.Class, (Format-Size $c.Bytes), $c.Path, $c.Reason, $c.Action) }
if ($Clean) {
  Write-Output ''
  Write-Output $(if ($Execute) { 'Cleanup (executed)' } else { 'Cleanup (DRY RUN: add -Execute to remove)' })
  if ($cleaned.Count -eq 0) { Write-Output '  nothing removable' }
  foreach ($c in $cleaned) { Write-Output ('  {0} {1,10}  {2}' -f $(if ($c.Done) { 'removed' } elseif ($Execute) { 'kept (in use or not removable)' } else { 'would remove' }), (Format-Size $c.Bytes), $c.Path) }
  Write-Output ('  removed: {0} file(s), {1:N0} bytes' -f $removed.Count, $removedBytes)
  foreach ($k in $removedByDrive.Keys) { Write-Output ('    {0}: {1:N0} bytes' -f $k, $removedByDrive[$k]) }
  Write-Output ''
  foreach ($d in $drivesAfter) { Write-Output ('  {0}:  free now {1}  ({2:N0} bytes)' -f $d.Drive, (Format-Size $d.FreeBytes), $d.FreeBytes) }
}
Write-Output ''
Write-Output ('Audit took {0:N0} s. Nothing was deleted{1}.' -f ((Get-Date) - $started).TotalSeconds, $(if ($Clean -and $Execute) { ' except the files listed as removed' } else { '' }))

if ($JsonPath) {
  $report = [ordered]@{
    label = $Label; started = $started.ToString('o'); drives = $drives; drivesAfter = $drivesAfter
    targets = $rows; largestTemp = $tempDirs; docker = $docker; candidates = $candidates
    clean = [ordered]@{
      requested = [bool]$Clean; executed = [bool]($Clean -and $Execute)
      removedCount = $removed.Count; removedBytes = $removedBytes; removedBytesByDrive = $removedByDrive
      items = $cleaned
    }
  }
  $report | ConvertTo-Json -Depth 5 | Out-File -FilePath $JsonPath -Encoding utf8
  Write-Output "JSON report: $JsonPath"
}
