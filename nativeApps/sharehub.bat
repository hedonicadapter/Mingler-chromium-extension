@echo off
wmic process where "name='ShareHub.exe'" get ProcessID | find /i "ProcessId" > nul || (start "" "C:\Program Files\ShareHub\ShareHub.exe")