"""Convertit les livrables Markdown en pages HTML autonomes, lisibles et imprimables (Fichier > Imprimer > PDF).

    python scripts/md-to-html.py

Gère : titres, paragraphes, listes, tableaux, citations, blocs de code, gras, italique, code en ligne, liens.
Aucune dépendance externe ; la sortie est un fichier HTML unique par document (styles intégrés, mode sombre et impression).
"""
import html
import os
import re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs', 'livrables')

CSS = """
:root{--bg:#fff;--text:#1b2430;--muted:#5b6675;--border:#d5dae1;--accent:#1f4fd8;--code:#f3f5f8;--quote:#eef3ff}
@media (prefers-color-scheme:dark){:root{--bg:#12161c;--text:#e8ecf1;--muted:#9aa5b4;--border:#364050;--accent:#6d95ff;--code:#1b212a;--quote:#1b2536}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
main{max-width:1040px;margin:0 auto;padding:2rem 1.25rem 4rem}
h1{font-size:1.9rem;margin:.2em 0 .6em;line-height:1.25}
h2{font-size:1.4rem;margin:2.2em 0 .6em;padding-bottom:.25em;border-bottom:2px solid var(--border)}
h3{font-size:1.1rem;margin:1.6em 0 .4em}
a{color:var(--accent)}
p,li{max-width:80ch}
code{background:var(--code);padding:.1em .35em;border-radius:4px;font:.88em ui-monospace,Consolas,monospace;overflow-wrap:anywhere}
pre{background:var(--code);padding:1rem;border-radius:8px;overflow-x:auto}
pre code{background:none;padding:0}
blockquote{margin:1rem 0;padding:.6rem 1rem;background:var(--quote);border-left:4px solid var(--accent);border-radius:0 8px 8px 0}
blockquote p{margin:.3em 0}
.table-wrap{overflow-x:auto;margin:1rem 0}
table{border-collapse:collapse;width:100%;font-size:.93rem}
th,td{border:1px solid var(--border);padding:.45rem .6rem;text-align:left;vertical-align:top}
th{background:var(--code)}
hr{border:0;border-top:1px solid var(--border);margin:2rem 0}
nav.top{font-size:.9rem;color:var(--muted);margin-bottom:1rem}
@media print{main{max-width:none;padding:0}a{color:inherit}h2{break-after:avoid}table,pre{break-inside:avoid}}
"""


def inline(text):
    text = html.escape(text, quote=False)
    text = re.sub(r'`([^`]+)`', lambda m: '<code>' + m.group(1) + '</code>', text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])', r'<em>\1</em>', text)
    text = re.sub(r'~~(.+?)~~', r'<del>\1</del>', text)

    text = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', r'<img src="" alt="" loading="lazy" style="max-width:100%;border:1px solid var(--border);border-radius:10px;display:block">', text)

    def link(m):
        target = m.group(2)
        if target.endswith('.md'):
            target = target[:-3] + '.html'
        return f'<a href="{target}">{m.group(1)}</a>'

    return re.sub(r'(?<!")\[([^\]]+)\]\(([^)]+)\)', link, text)


def convert(md):
    lines = md.split('\n')
    out = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith('```'):
            code = []
            i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                code.append(html.escape(lines[i]))
                i += 1
            out.append('<pre><code>' + '\n'.join(code) + '</code></pre>')
            i += 1
            continue
        if re.match(r'^#{1,3} ', line):
            level = len(line.split(' ')[0])
            out.append(f'<h{level}>{inline(line[level + 1:])}</h{level}>')
            i += 1
            continue
        if line.strip() == '---':
            out.append('<hr>')
            i += 1
            continue
        if line.startswith('|') and i + 1 < len(lines) and re.match(r'^\|[\s:|-]+\|\s*$', lines[i + 1]):
            header = [c.strip() for c in re.split(r'(?<!\\)\|', line.strip().strip('|'))]
            i += 2
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                rows.append([c.strip() for c in re.split(r'(?<!\\)\|', lines[i].strip().strip('|'))])
                i += 1
            cell = lambda c: inline(c.replace('\\|', '|'))
            out.append('<div class="table-wrap"><table><thead><tr>' + ''.join(f'<th>{cell(c)}</th>' for c in header) + '</tr></thead><tbody>')
            for row in rows:
                out.append('<tr>' + ''.join(f'<td>{cell(c)}</td>' for c in row) + '</tr>')
            out.append('</tbody></table></div>')
            continue
        if line.startswith('>'):
            quote = []
            while i < len(lines) and lines[i].startswith('>'):
                quote.append(lines[i].lstrip('>').strip())
                i += 1
            out.append('<blockquote><p>' + inline(' '.join(quote)) + '</p></blockquote>')
            continue
        if re.match(r'^\s*([-*]|\d+\.) ', line):
            ordered = bool(re.match(r'^\s*\d+\. ', line))
            items = []
            while i < len(lines) and re.match(r'^\s*([-*]|\d+\.) ', lines[i]):
                items.append(re.sub(r'^\s*([-*]|\d+\.) ', '', lines[i]))
                i += 1
            tag = 'ol' if ordered else 'ul'
            out.append(f'<{tag}>' + ''.join(f'<li>{inline(x)}</li>' for x in items) + f'</{tag}>')
            continue
        if line.strip() == '':
            i += 1
            continue
        para = [line]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r'^(#{1,3} |\||>|```|---$|\s*([-*]|\d+\.) )', lines[i]):
            para.append(lines[i])
            i += 1
        out.append('<p>' + inline(' '.join(para)) + '</p>')
    return '\n'.join(out)


def main():
    design = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs', 'design')
    nav_livrables = (
        'Investally Business Platform — livrables · <a href="01-RECAPITULATIF-REALISATIONS.html">Récapitulatif</a> · '
        '<a href="02-GUIDE-DU-CODE.html">Guide du code</a> · <a href="03-INDEX-DES-FONCTIONS.html">Index des fonctions</a> · '
        '<a href="04-SUIVI-DES-SESSIONS.html">Suivi des sessions</a> · <a href="05-ETAT-D-AVANCEMENT.html">État d&#8217;avancement</a> · '
        '<a href="06-BESOINS-STYLE-GRAPHIQUE.html">Style graphique</a>'
    )
    nav_design = (
        'Investally Business Platform — design · <a href="01-DESIGN-SYSTEM.html">Design system</a> · '
        '<a href="02-SPECIFICATIONS-FRONTEND.html">Spécifications frontend</a> · <a href="03-EXIGENCES-DE-CONCEPTION.html">Exigences</a> · <a href="04-ANALYSE-D-IMPACT.html">Analyse d&#8217;impact</a> · <a href="05-AIDE-A-LA-DECISION.html">Aide à la décision</a> · <a href="prototype/index.html">Prototype</a>'
    )
    docs_root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs')
    nav_root = 'Investally Business Platform — méthode · <a href="design/05-AIDE-A-LA-DECISION.html">Aide à la décision</a>'
    for folder, nav, only in ((ROOT, nav_livrables, None), (design, nav_design, None), (docs_root, nav_root, ('METHODE-D-ARBITRAGE.md',))):
        for name in sorted(n for n in os.listdir(folder) if n.endswith('.md') and (only is None or n in only)):
            md = open(os.path.join(folder, name), encoding='utf-8').read()
            title = re.search(r'^# (.+)$', md, re.M)
            page = (
                '<!doctype html><html lang="fr"><head><meta charset="utf-8">'
                '<meta name="viewport" content="width=device-width,initial-scale=1">'
                f'<title>{html.escape(title.group(1) if title else name)}</title><style>{CSS}</style></head><body><main>'
                f'<nav class="top">{nav}</nav>' + convert(md) + '</main></body></html>'
            )
            out = os.path.join(folder, name[:-3] + '.html')
            open(out, 'w', encoding='utf-8', newline=chr(10)).write(page)
            print('écrit', os.path.relpath(out, os.path.join(ROOT, '..')), len(page) // 1024, 'Ko')


main()
