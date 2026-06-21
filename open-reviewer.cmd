@echo off
rem Open the reviewer manually (no file; paste a .md path in the bar) -> bin\md-reviewer.js.
rem Comments kept ASCII on purpose: cmd.exe misreads non-ASCII bytes under some codepages.
node "%~dp0bin\md-reviewer.js"
