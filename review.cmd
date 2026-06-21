@echo off
rem Windows double-click convenience -> bin\md-reviewer.js (cross-platform CLI).
rem   review.cmd "C:\path\to\foo.md"   open and load foo.md
rem   review.cmd                       open reviewer only
rem Comments kept ASCII on purpose: cmd.exe misreads non-ASCII bytes under some codepages.
node "%~dp0bin\md-reviewer.js" %*
