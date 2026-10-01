#!/usr/bin/env python3
"""Inline css/fonts.css + css/globals.css into every _src/screens/*.html -> screens/*.html.
Each output file is self-contained (one <style> block, Google Fonts @import kept) so it can be
uploaded to Claude Design on its own. Run from anywhere: python3 docs/design-package/_src/build.py"""
import pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
css = (root / "css/fonts.css").read_text() + "\n" + (root / "css/globals.css").read_text()
# Package-only rules (NOT in the app): a dashed divider + label around the "other states" blocks
# some screens append so every state is visible on one page.
css += """
/* ---- design-package only: not part of the app's stylesheet ---- */
.pkg-states { margin-top: 40px; padding-top: 18px; border-top: 2px dashed var(--border-hi); }
.pkg-states-label { margin: 0 0 16px; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: var(--warn); }
"""
# Portrait images etc. are absolute URLs; only the two local stylesheet links are replaced.
link_re = re.compile(r'\s*<link rel="stylesheet" href="\.\./css/(fonts|globals)\.css">')
for src in sorted((root / "_src/screens").glob("*.html")):
    html = src.read_text()
    html, n = link_re.subn("", html)
    assert n == 2, f"{src.name}: expected 2 stylesheet links, found {n}"
    html = html.replace("</head>", f"<style>\n{css}\n</style>\n</head>", 1)
    html = html.replace('src="../assets/', 'src="../assets/')  # assets stay relative (same depth)
    (root / "screens" / src.name).write_text(html)
    print("built", src.name)
