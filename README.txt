GameDojo project site - offline package (2026-11-22)
=====================================================

GitHub Pages setup and release checks: see README.md.
Validate files before publishing: python3 tools/check_site.py

HOW TO OPEN
  Windows:        double-click  start.bat
  macOS / Linux:  open a terminal in this folder and run  ./start.sh
  (needs Python 3; it starts a small local server and opens the page in your browser)

  Without Python: open index.html directly in Chrome or Edge. Everything shows, but the 3D games
  may not capture the mouse when opened this way - use start.bat / start.sh for those.

Use an up-to-date Chrome, Edge or Firefox. Safari works for the page; the games are best in Chrome / Edge.

WHAT IS IN IT
  index.html               the page
  play/<boss>/index.html   six playable fights (Touhou Remilia, Isaac Duke of Flies, Terraria King Slime,
                           Doom Cyberdemon, Quake II Gladiator, Hexen II Eidolon); reached from the boss wall
  assets/clips, posters    the 120 boss encounters (3 difficulty clips each)
  assets/showcase          "The same fight" grid: GameDojo-4B vs GPT-6.1-Sol vs Claude-Opus-5.5
  assets/covers, opening   game cover art and the opening montage frames (reference titles; see the page footer)
  serve.py, start.bat/.sh  the local launcher (Python standard library only, nothing is installed)

Everything is local: no internet connection is needed and nothing is sent anywhere.

COPYRIGHT
  Game titles, characters and artwork belong to their respective owners. This package is for non-commercial
  scientific research only; see the notice at the bottom of the page.
