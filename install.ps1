# Headstart one-line installer for Windows (PowerShell).
#
#   irm https://raw.githubusercontent.com/cole10429/headstart/main/install.ps1 | iex
#
# It checks for Claude Code, Git, Node and the GitHub CLI (offering to install any that are missing), downloads this repo to a temporary
# folder, runs install/install.mjs (which shows a plan and asks before changing
# anything), then deletes the temporary folder. Read it before you run it.

& {
    $ErrorActionPreference = 'Stop'
    $Repo = if ($env:HEADSTART_REPO) { $env:HEADSTART_REPO } else { 'cole10429/headstart' }

    function Test-Tool($name) { [bool](Get-Command $name -ErrorAction SilentlyContinue) }

    function Install-WithWinget($name, $id, $cmd) {
        if (-not (Test-Tool 'winget')) { return $false }
        $answer = Read-Host "$name is not installed. Install it now with winget? [Y/n]"
        if ($answer -and $answer -notmatch '^(y|yes)$') { return $false }
        # Out-Host keeps winget's text out of this function's return value.
        winget install --id $id -e --accept-source-agreements --accept-package-agreements | Out-Host
        # Pick up the new PATH without reopening the window.
        $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
        return (Test-Tool $cmd)
    }

    if (-not (Test-Tool 'claude')) {
        # The desktop app keeps its own copy of Claude Code that this window cannot use, so the command-line one is needed too.
        $answer = Read-Host "The claude command is not installed (the desktop app alone does not add it). Install it now with Anthropic's official installer? [Y/n]"
        if ($answer -and $answer -notmatch '^(y|yes)$') {
            Write-Host "Install it later with:  irm https://claude.ai/install.ps1 | iex   then run this again." -ForegroundColor Yellow
            return
        }
        # Run in a separate PowerShell so nothing in Anthropic's script can close this window.
        powershell -NoProfile -Command "irm https://claude.ai/install.ps1 | iex" | Out-Host
        $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User') + ';' + (Join-Path $HOME '.local\bin')
        if (-not (Test-Tool 'claude')) {
            Write-Host "Claude Code was installed, but this window cannot see it yet. Close PowerShell, open a new one and paste the Headstart line again." -ForegroundColor Yellow
            return
        }
    }
    if (-not (Test-Tool 'git')) {
        if (-not (Install-WithWinget 'Git' 'Git.Git' 'git')) {
            Write-Host "Git is needed. Get it from https://git-scm.com/downloads/win and run this again." -ForegroundColor Yellow
            return
        }
    }
    if (-not (Test-Tool 'node')) {
        if (-not (Install-WithWinget 'Node' 'OpenJS.NodeJS.LTS' 'node')) {
            Write-Host "Node.js is needed (the safety hooks run on it). Get the LTS from https://nodejs.org and run this again." -ForegroundColor Yellow
            return
        }
    }

    if (-not (Test-Tool 'gh')) {
        # Optional: Claude uses it to work with GitHub. Sign-in happens later, in /headstart:setup.
        if (-not (Install-WithWinget 'GitHub CLI' 'GitHub.cli' 'gh')) {
            Write-Host "Skipped the GitHub CLI. Claude works without it; get it later from https://cli.github.com" -ForegroundColor Yellow
        }
    }

    $tempRoot = [IO.Path]::GetTempPath()
    $work = Join-Path $tempRoot ('headstart-' + [guid]::NewGuid().ToString('N'))
    try {
        git clone --depth 1 --quiet "https://github.com/$Repo.git" $work
        if ($LASTEXITCODE -ne 0) { throw "Could not download https://github.com/$Repo" }
        node (Join-Path $work 'install\install.mjs') --source $Repo
    }
    finally {
        # Delete only the folder this script created, and only if it is where we put it.
        if ($work -and (Test-Path -LiteralPath $work) -and $work.StartsWith($tempRoot) -and ((Split-Path $work -Leaf) -like 'headstart-*')) {
            Remove-Item -LiteralPath $work -Recurse -Force
        }
    }
}
