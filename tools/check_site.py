#!/usr/bin/env python3
"""Validate the static site using Python's standard library and optional Node.js."""

import json
import re
import shutil
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
errors = []
references = set()
pending = []


def label(path):
    return str(path.relative_to(ROOT))


def check_ref(source, value):
    parts = urlsplit(value)
    if parts.scheme or parts.netloc or not value or value == "#":
        return
    if parts.path.startswith("/"):
        errors.append(f"{label(source)}: root-relative URL breaks project sites: {value}")
        return
    target = (source.parent / unquote(parts.path)).resolve()
    try:
        relative = target.relative_to(ROOT)
    except ValueError:
        errors.append(f"{label(source)}: URL escapes the site: {value}")
        return
    # macOS is often case-insensitive; check the exact spelling of every component.
    current = ROOT
    for component in relative.parts:
        if not current.is_dir() or component not in {p.name for p in current.iterdir()}:
            errors.append(f"{label(source)}: missing file or incorrect case: {value}")
            return
        current /= component
    if target.is_dir():
        target /= "index.html"
    if not target.is_file():
        errors.append(f"{label(source)}: missing file: {value}")
        return
    references.add(target)
    fragment = unquote(parts.fragment)
    if fragment and target.suffix == ".html":
        ids = pages.get(target)
        if ids is not None and fragment not in ids.ids:
            errors.append(f"{label(source)}: missing anchor: {value}")


class Page(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.source = source
        self.ids = set()
        self.refs = []
        self.lang = False
        self.charset = False
        self.viewport = False

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == "html":
            self.lang = bool(attrs.get("lang"))
        if tag == "meta":
            self.charset |= attrs.get("charset", "").lower() == "utf-8"
            self.viewport |= attrs.get("name") == "viewport"
        if attrs.get("id"):
            if attrs["id"] in self.ids:
                errors.append(f"{label(self.source)}: duplicate id: {attrs['id']}")
            self.ids.add(attrs["id"])
        for name in ("href", "src", "poster"):
            if attrs.get(name):
                self.refs.append(attrs[name])
        if attrs.get("srcset"):
            self.refs.extend(item.strip().split()[0] for item in attrs["srcset"].split(","))
        if tag == "meta" and attrs.get("property") == "og:image":
            self.refs.append(attrs.get("content", ""))
        if tag == "a" and "data-todo" in attrs and attrs.get("href") == "#":
            pending.append(attrs["data-todo"])
            if attrs.get("aria-disabled") != "true":
                errors.append(f"{label(self.source)}: unmarked placeholder: {attrs['data-todo']}")

    handle_startendtag = handle_starttag


def data_file(name):
    source = ROOT / "assets" / "js" / f"{name}.js"
    text = source.read_text(encoding="utf-8")
    match = re.search(r"window\.GD_\w+\s*=\s*", text)
    if not match:
        raise ValueError(f"{label(source)}: missing data assignment")
    return json.JSONDecoder().raw_decode(text[match.end():])[0]


pages = {}
for source in sorted(ROOT.rglob("*.html")):
    if any(part.startswith(".") or part == "_site" for part in source.relative_to(ROOT).parts):
        continue
    page = Page(source)
    page.feed(source.read_text(encoding="utf-8"))
    pages[source] = page

for source, page in pages.items():
    for required in ("lang", "charset", "viewport"):
        if not getattr(page, required):
            errors.append(f"{label(source)}: missing {required}")
    for value in page.refs:
        check_ref(source, value)

for source in sorted((ROOT / "assets" / "css").glob("*.css")):
    for value in re.findall(r"url\(\s*['\"]?([^'\"\s)]+)", source.read_text(encoding="utf-8")):
        check_ref(ROOT / "index.html" if value.startswith("#") else source, value)

index = ROOT / "index.html"
try:
    data = data_file("data")
    bosses = {}
    for game in data["games"]:
        check_ref(index, f"assets/covers/{game['id']}.jpg")
        for boss in game["bosses"]:
            if boss["id"] in bosses:
                errors.append(f"Duplicate boss id: {boss['id']}")
            bosses[boss["id"]] = boss
            check_ref(index, f"assets/posters/{boss['id']}.jpg")
            for tier in ("e", "m", "h"):
                check_ref(index, f"assets/clips/{boss['id']}-{tier}.mp4")
    for portal in data["portals"]:
        if portal["boss"] not in bosses:
            errors.append(f"Portal refers to unknown boss: {portal['boss']}")
    playable = data_file("playable")
    for game in playable:
        check_ref(index, game["src"])
        if game["boss"] not in bosses:
            errors.append(f"Playable entry refers to unknown boss: {game['boss']}")
    showcase = data_file("showcase")
    for row in showcase:
        for model in ("ours", "gpt", "claude"):
            side = row.get(model, {})
            if side.get("src"):
                check_ref(index, side["src"])
                check_ref(index, side["poster"])
    for layer in data_file("logo")["layers"]:
        check_ref(index, f"assets/img/logo-{layer['key']}.webp")
    results = data_file("results")
    if not results.get("medium") or not results.get("tiers"):
        errors.append("Leaderboard results are empty")
    # Opening frames are assembled by opening.js rather than listed in HTML.
    opening = (ROOT / "assets/js/opening.js").read_text(encoding="utf-8")
    cuts = re.search(r"const CUTS = (\[[^;]+\]);", opening)
    if not cuts:
        errors.append("Opening frame list not found")
    else:
        for frame in json.loads(cuts[1]):
            check_ref(index, f"assets/opening/{frame}.jpg")
    print(f"Data: {len(data['games'])} games, {len(bosses)} bosses, "
          f"{len(data['portals'])} portals, {len(playable)} playable pages, "
          f"{len(showcase)} comparison rows")
except (KeyError, ValueError, OSError) as exc:
    errors.append(f"Invalid site data: {exc}")

files = [p for p in ROOT.rglob("*") if p.is_file()
         and not any(part.startswith(".") or part in ("_site", "__pycache__")
                     for part in p.relative_to(ROOT).parts)]
for source in files:
    if source.stat().st_size >= 100 * 1024 * 1024:
        errors.append(f"{label(source)}: file is at least 100 MiB")

node = shutil.which("node")
scripts = [p for p in files if p.suffix == ".js"]
if node:
    for source in sorted(scripts):
        result = subprocess.run([node, "--check", str(source)], capture_output=True, text=True)
        if result.returncode:
            errors.append(f"{label(source)}: JavaScript syntax error\n{result.stderr.strip()}")
    print(f"JavaScript syntax: {len(scripts)} files checked")
else:
    print("NOTICE: Node.js not found; JavaScript syntax checks skipped")

print(f"Static files: {len(pages)} HTML pages, {len(references)} referenced files, "
      f"{sum(p.stat().st_size for p in files) / 1024 / 1024:.1f} MiB total")
if pending:
    print("NOTICE: Awaiting release URLs: " + ", ".join(pending))
if errors:
    print("\n".join("ERROR: " + error for error in errors), file=sys.stderr)
    sys.exit(1)
print("PASS: All available static checks passed")
