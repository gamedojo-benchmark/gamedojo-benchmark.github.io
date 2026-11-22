#!/bin/sh
# GameDojo site: start a local server and open the page in your browser.  Run:  ./start.sh
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then exec python3 serve.py "$@"; fi
if command -v python >/dev/null 2>&1; then exec python serve.py "$@"; fi
echo "Python 3 was not found. Install it, or open index.html directly in Chrome / Edge (see README.txt)."
exit 1
