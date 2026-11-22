@echo off
rem GameDojo site: double-click to start a local server and open the page in your browser.
cd /d "%~dp0"
where py >nul 2>nul && (py -3 serve.py & goto :eof)
where python >nul 2>nul && (python serve.py & goto :eof)
echo Python 3 was not found.
echo Install it from https://www.python.org/downloads/ (tick "Add python.exe to PATH"), then run this file again.
echo Or open index.html directly in Chrome / Edge - see README.txt.
pause
