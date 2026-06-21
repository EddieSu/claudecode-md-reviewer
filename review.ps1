# Windows PowerShell convenience -> bin/md-reviewer.js (cross-platform CLI).
#   review.ps1 "C:\path\to\foo.md"   open and load foo.md
#   review.ps1                        open reviewer only
# The launcher logic itself lives in bin/md-reviewer.js so it stays in one place.
param([Parameter(ValueFromRemainingArguments = $true)] $Args)
& node (Join-Path $PSScriptRoot 'bin/md-reviewer.js') @Args
