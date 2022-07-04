@echo off
wmic process where "name='minglerchromiumhost.exe'" get ProcessID | find /i "ProcessId" > nul || (start "" "%~dp0minglerchromiumhost.exe")