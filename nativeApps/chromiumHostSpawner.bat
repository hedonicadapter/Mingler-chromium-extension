@echo off
wmic process where "name='shchromiumhost.exe'" get ProcessID | find /i "ProcessId" > nul || (start "" "C:\Program Files\ShareHub\shchromiumhost.exe")