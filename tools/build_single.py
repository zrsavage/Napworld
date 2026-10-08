#!/usr/bin/env python3
"""Bundle Savage Napoleonic War Simulation into single self-contained HTML files.

  dist/napworld.html           full standalone document (open it directly, no server needed)
  dist/napworld.artifact.html  body-only fragment for hosts that supply their own <html>/<head>
"""
import re, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
index = (root / 'index.html').read_text(encoding='utf8')
css = (root / 'css' / 'style.css').read_text(encoding='utf8')

scripts = re.findall(r'<script src="([^"]+)"></script>', index)
js = '\n'.join('/* ---- %s ---- */\n%s' % (s, (root / s).read_text(encoding='utf8').replace('</script', '<\\/script')) for s in scripts)

body = re.search(r'<body>(.*?)<script src=', index, re.S).group(1).strip()
title = 'Savage Napoleonic War Simulation'

full = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Cinzel+Decorative:wght@700;900&family=Crimson+Pro:ital,wght@0,400;0,600;0,700;1,400&family=IM+Fell+English:ital@0;1&display=swap">
<style>
{css}
</style>
</head>
<body>
{body}
<script>
{js}
</script>
</body>
</html>
'''
fragment = f'''<title>{title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Cinzel+Decorative:wght@700;900&family=Crimson+Pro:ital,wght@0,400;0,600;0,700;1,400&family=IM+Fell+English:ital@0;1&display=swap">
<style>
{css}
html, body {{ height: 100%; margin: 0; background: #14181f; color: #e8e2d0; }}
</style>
{body}
<script>
{js}
</script>
'''
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist' / 'napworld.html').write_text(full, encoding='utf8')
(root / 'dist' / 'napworld.artifact.html').write_text(fragment, encoding='utf8')
print('built', len(full) // 1024, 'KB')
