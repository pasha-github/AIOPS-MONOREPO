<#
Daily sync: pulls the royal-cyber-inc source repos into this monorepo via
git subtree, then opens a PR on pasha-github/AIOPS-MONOREPO with the result.

Source repos -> monorepo folder:
  aiops-agent-management -> aiops-agent-management/
  aiops-backend-mcps     -> aiops-backend-mcps/
  aiops-frontend         -> aiops-frontend/
  AIOPS-Demo             -> aiops-demo-app/   (bootstrapped via subtree add on first run)

Run manually with: powershell -File scripts\sync-monorepo.ps1
#>

$ErrorActionPreference = 'Continue'
$RepoRoot = "C:\Temp\AIOPS-MONOREPO"
Set-Location $RepoRoot

$LogDir = Join-Path $RepoRoot "scripts\logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Today = Get-Date -Format "yyyy-MM-dd"
$LogFile = Join-Path $LogDir "sync-$Today.log"

function Log($msg) {
    # Write-Host, not Write-Output: this is called from inside Invoke-Git, and
    # Write-Output would leak into that function's return value (which callers
    # compare against 0 as an exit code), silently turning every call into a
    # false failure.
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
    Write-Host $line
    Add-Content -Path $LogFile -Value $line
}

function Invoke-Git {
    param([string[]]$GitArgs)
    Log ("git " + ($GitArgs -join ' '))
    $output = & git @GitArgs 2>&1
    foreach ($line in $output) { Log "  $line" }
    return $LASTEXITCODE
}

# Finds the source-repo commit a given prefix was last synced to, by reading
# the git-subtree-split trailer git-subtree itself writes on every add/pull.
# Works whether that ancestor commit was a full-history merge (the original
# imports) or a --squash commit (daily syncs) - the trailer is present either way.
function Get-SubtreeSplit {
    param([string]$Ref, [string]$Prefix)
    $msg = & git log $Ref --grep="git-subtree-dir: $Prefix" -1 --format=%B 2>$null
    if ($msg -match 'git-subtree-split:\s*([0-9a-f]{40})') {
        return $matches[1]
    }
    return $null
}

$Repos = @(
    @{ Name = "aiops-agent-management"; Remote = "aiops-agent-management"; Url = "git@github-rc:royal-cyber-inc/aiops-agent-management.git"; Branch = "main"; Prefix = "aiops-agent-management" },
    @{ Name = "aiops-backend-mcps";     Remote = "aiops-backend-mcps";     Url = "git@github-rc:royal-cyber-inc/aiops-backend-mcps.git";     Branch = "main"; Prefix = "aiops-backend-mcps" },
    @{ Name = "aiops-frontend";         Remote = "aiops-frontend";         Url = "git@github-rc:royal-cyber-inc/aiops-frontend.git";         Branch = "main"; Prefix = "aiops-frontend" },
    @{ Name = "AIOPS-Demo";             Remote = "aiops-demo-app";         Url = "git@github-rc:royal-cyber-inc/AIOPS-Demo.git";             Branch = "main"; Prefix = "aiops-demo-app" }
)

Log "===== Starting daily monorepo sync ====="

# Refuse to touch a dirty tree - never clobber in-progress work.
$status = & git status --porcelain
if ($status) {
    Log "ERROR: working tree is not clean. Aborting sync so in-progress work isn't disturbed."
    foreach ($line in $status) { Log "  $line" }
    exit 1
}

# Ensure remotes exist (idempotent, matches existing fetch-only convention).
$existingRemotes = & git remote
foreach ($r in $Repos) {
    if ($existingRemotes -notcontains $r.Remote) {
        Log "Adding remote $($r.Remote) -> $($r.Url)"
        Invoke-Git @("remote", "add", $r.Remote, $r.Url) | Out-Null
        Invoke-Git @("remote", "set-url", "--push", $r.Remote, "no_push") | Out-Null
    }
}

Invoke-Git @("checkout", "main") | Out-Null
$code = Invoke-Git @("pull", "personal", "main")
if ($code -ne 0) {
    Log "ERROR: failed to pull latest main from personal remote. Aborting."
    exit 1
}

foreach ($r in $Repos) {
    Invoke-Git @("fetch", $r.Remote, $r.Branch) | Out-Null
}

$BranchName = "daily-sync/$Today"
$branchExists = & git branch --list $BranchName
if ($branchExists) {
    Invoke-Git @("checkout", $BranchName) | Out-Null
} else {
    Invoke-Git @("checkout", "-b", $BranchName, "main") | Out-Null
}

$Synced = @()
$Skipped = @()
$ChangeDetails = @{}

foreach ($r in $Repos) {
    Log "----- Syncing $($r.Name) into $($r.Prefix)/ -----"
    $beforeHead = (& git rev-parse HEAD).Trim()
    $prefixExists = Test-Path (Join-Path $RepoRoot $r.Prefix)
    $oldSplit = Get-SubtreeSplit -Ref $beforeHead -Prefix $r.Prefix

    if (-not $prefixExists) {
        Log "$($r.Prefix)/ does not exist yet - running initial 'subtree add'"
        $code = Invoke-Git @("subtree", "add", "--prefix=$($r.Prefix)", $r.Remote, $r.Branch, "--squash", "-m", "Add '$($r.Prefix)/' from $($r.Name) (initial sync)")
    } else {
        $code = Invoke-Git @("subtree", "pull", "--prefix=$($r.Prefix)", $r.Remote, $r.Branch, "--squash", "-m", "sync: $($r.Name) daily update ($Today)")
    }

    if ($code -ne 0) {
        Log "CONFLICT/ERROR syncing $($r.Name) - aborting this merge and skipping (will retry next run)"
        Invoke-Git @("merge", "--abort") | Out-Null
        $Skipped += $r.Name
        continue
    }

    $afterHead = (& git rev-parse HEAD).Trim()
    if ($afterHead -eq $beforeHead) {
        Log "$($r.Name) already up to date"
        continue
    }

    $Synced += $r.Name
    $newSplit = Get-SubtreeSplit -Ref $afterHead -Prefix $r.Prefix

    $commitLines = @()
    if ($oldSplit -and $newSplit -and ($oldSplit -ne $newSplit)) {
        $commitLines = @(& git log --oneline --no-decorate "$oldSplit..$newSplit")
    }
    $diffStat = (& git diff --shortstat $beforeHead $afterHead -- $r.Prefix) -join ' '

    $ChangeDetails[$r.Name] = @{
        IsInitial   = (-not $oldSplit)
        CommitCount = $commitLines.Count
        Commits     = $commitLines
        DiffStat    = $diffStat
    }
    Log "$($r.Name): $diffStat ($($commitLines.Count) commit(s) pulled)"
}

if ($Synced.Count -eq 0) {
    Log "No repos had updates. Cleaning up branch."
    Invoke-Git @("checkout", "main") | Out-Null
    Invoke-Git @("branch", "-D", $BranchName) | Out-Null
    if ($Skipped.Count -gt 0) {
        Log "WARNING: these repos failed with conflicts and were skipped: $($Skipped -join ', ')"
        Log "===== Sync finished with failures ====="
        exit 1
    }
    Log "===== Sync complete: nothing to do ====="
    exit 0
}

$code = Invoke-Git @("push", "personal", $BranchName)
if ($code -ne 0) {
    Log "ERROR: failed to push branch $BranchName. Leaving local branch in place for inspection."
    exit 1
}

$prBodyLines = @("Automated daily sync from royal-cyber-inc source repos.", "")

foreach ($name in $Synced) {
    $d = $ChangeDetails[$name]
    $prBodyLines += "### $name"
    if ($d.IsInitial) {
        $prBodyLines += "_Initial import - $($d.DiffStat)_"
    } elseif ($d.CommitCount -eq 0) {
        $prBodyLines += "_$($d.DiffStat) (no distinct commits found - remote history may have been rewritten)_"
    } else {
        $prBodyLines += "$($d.DiffStat), $($d.CommitCount) commit(s):"
        $prBodyLines += ""
        $prBodyLines += "<details><summary>Commit list</summary>"
        $prBodyLines += ""
        $prBodyLines += '```'
        $shown = $d.Commits
        if ($shown.Count -gt 25) {
            $prBodyLines += $shown[0..24]
            $prBodyLines += "... and $($shown.Count - 25) more commit(s)"
        } else {
            $prBodyLines += $shown
        }
        $prBodyLines += '```'
        $prBodyLines += "</details>"
    }
    $prBodyLines += ""
}

if ($Skipped.Count -gt 0) {
    $prBodyLines += "**Skipped (conflict - needs manual merge):** $($Skipped -join ', ')"
}
$prBody = $prBodyLines -join "`n"
$prBodyFile = Join-Path $LogDir "pr-body-$Today.md"
Set-Content -Path $prBodyFile -Value $prBody -Encoding utf8NoBOM

Log "Switching gh CLI account to pasha-github to open the PR"
& gh auth switch --user pasha-github --hostname github.com *>&1 | ForEach-Object { Log "  $_" }

$prCode = 0
try {
    & gh pr create --repo pasha-github/AIOPS-MONOREPO --base main --head $BranchName --title "Daily sync: $Today" --body-file $prBodyFile *>&1 | ForEach-Object { Log "  $_" }
    $prCode = $LASTEXITCODE
} finally {
    & gh auth switch --user RCMPasha --hostname github.com *>&1 | ForEach-Object { Log "  $_" }
}

Invoke-Git @("checkout", "main") | Out-Null

if ($prCode -ne 0) {
    Log "ERROR: gh pr create failed. Branch $BranchName is pushed; open the PR manually."
    exit 1
}

if ($Skipped.Count -gt 0) {
    Log "===== Sync finished with a PR, but some repos were skipped: $($Skipped -join ', ') ====="
    exit 1
}

Log "===== Sync complete. PR opened for branch $BranchName ====="
exit 0
