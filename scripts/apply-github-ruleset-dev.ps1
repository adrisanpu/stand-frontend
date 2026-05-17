# Apply dev-squash-merge ruleset to stand-frontend (requires gh CLI)
$ErrorActionPreference = "Stop"
$Ruleset = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\docs\github-ruleset-dev-squash.json"
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Error "gh CLI not found. Install from https://cli.github.com/ then: gh auth login"
}
gh api repos/adrisanpu/stand-frontend/rulesets --method POST --input $Ruleset
Write-Host "Done. Verify: Settings -> Rules -> Rulesets -> dev-squash-merge"
