$ErrorActionPreference = 'Stop'
$repo = 'ZZJJR/zjrportfolio'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw '未找到 gh（GitHub CLI）。请先安装并执行 gh auth login。'
}

$head = gh api "repos/$repo/git/ref/heads/main" --jq '.object.sha'
if (-not $head) { throw '无法读取远端 HEAD，请检查 gh auth status。' }
Write-Output "remote HEAD: $head"

$remoteTree = gh api "repos/$repo/git/trees/main?recursive=1" | ConvertFrom-Json
$remote = @{}
foreach ($entry in $remoteTree.tree) {
    if ($entry.type -eq 'blob') { $remote[$entry.path] = $entry.sha }
}
$headTree = gh api "repos/$repo/git/commits/$head" --jq '.tree.sha'

function Get-GitBlobHash([string]$path) {
    $bytes = [System.IO.File]::ReadAllBytes($path)
    $header = [System.Text.Encoding]::ASCII.GetBytes("blob $($bytes.Length)`0")
    $sha1 = [System.Security.Cryptography.SHA1]::Create()
    try {
        $hash = $sha1.ComputeHash([byte[]]($header + $bytes))
    } finally {
        $sha1.Dispose()
    }
    return ([System.BitConverter]::ToString($hash)).Replace('-', '').ToLower()
}

$files = Get-ChildItem -LiteralPath $root -Recurse -File -Force |
    Where-Object {
        $_.FullName -notmatch '\\\.git\\' -and
        $_.Name -notin @('auth.json', 'access-log.json', 'data.json.bak') -and
        $_.FullName -notmatch '\\__pycache__\\' -and
        $_.FullName -notmatch '\\portfolio-static\\' -and
        $_.FullName -notmatch '\\portfolio-spa\\index\.html$' -and
        $_.FullName -notmatch '\\\.env$'
    } | Sort-Object FullName

$tmpDir = Join-Path $env:TEMP ('zjr-deploy-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmpDir | Out-Null
$entries = New-Object System.Collections.Generic.List[object]
$uploaded = 0
$i = 0
try {
    foreach ($f in $files) {
        $rel = $f.FullName.Substring($root.Length + 1).Replace('\', '/')
        $hash = Get-GitBlobHash $f.FullName
        if ($remote.ContainsKey($rel) -and $remote[$rel] -eq $hash) {
            $sha = $hash
        } else {
            $b64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($f.FullName))
            $obj = @{ content = $b64; encoding = 'base64' } | ConvertTo-Json -Compress
            $jsonPath = Join-Path $tmpDir 'blob.json'
            [System.IO.File]::WriteAllText($jsonPath, $obj, (New-Object System.Text.UTF8Encoding($false)))
            $sha = gh api "repos/$repo/git/blobs" --method POST --input $jsonPath --jq '.sha'
            if (-not $sha) { throw "blob failed: $rel" }
            $uploaded++
            Write-Output ("upload [{0}] {1}" -f $uploaded, $rel)
        }
        $entries.Add([pscustomobject]@{ path = $rel; mode = '100644'; type = 'blob'; sha = $sha })
        $i++
    }

    $treeJson = @{ tree = $entries.ToArray() } | ConvertTo-Json -Depth 6 -Compress
    $treePath = Join-Path $tmpDir 'tree.json'
    [System.IO.File]::WriteAllText($treePath, $treeJson, (New-Object System.Text.UTF8Encoding($false)))
    $treeSha = gh api "repos/$repo/git/trees" --method POST --input $treePath --jq '.sha'
    if (-not $treeSha) { throw 'tree creation failed' }
    Write-Output "tree: $treeSha ($uploaded blobs uploaded, $($files.Count) files)"

    if ($treeSha -eq $headTree) {
        Write-Output 'no changes: remote tree is already up to date'
        exit 0
    }

    $commitObj = @{
        message = 'publish: update portfolio content ' + (Get-Date -Format 'yyyy-MM-dd HH:mm')
        tree = $treeSha
        parents = @($head)
    } | ConvertTo-Json -Compress
    $commitPath = Join-Path $tmpDir 'commit.json'
    [System.IO.File]::WriteAllText($commitPath, $commitObj, (New-Object System.Text.UTF8Encoding($false)))
    $commitSha = gh api "repos/$repo/git/commits" --method POST --input $commitPath --jq '.sha'
    if (-not $commitSha) { throw 'commit creation failed' }
    Write-Output "commit: $commitSha"

    $refObj = @{ sha = $commitSha; force = $false } | ConvertTo-Json -Compress
    $refPath = Join-Path $tmpDir 'ref.json'
    [System.IO.File]::WriteAllText($refPath, $refObj, (New-Object System.Text.UTF8Encoding($false)))
    gh api "repos/$repo/git/refs/heads/main" --method PATCH --input $refPath --jq '.object.sha'
    Write-Output 'pushed main'
} finally {
    Remove-Item -LiteralPath $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
}
