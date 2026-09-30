import glob, os, re

root = r'C:\game\StarSector.v0.9.8a-RC8'
srcs = sorted(glob.glob(os.path.join(root, 'mods', 'MagicMaster', 'data', '**', '*.java'), recursive=True))
srcs = [s for s in srcs if s.lower().endswith('.java')]
lines = []
for s in srcs:
    text = open(s, encoding='utf-8', errors='replace').read()
    m = re.search(r'^\s*package\s+([\w.]+)\s*;', text, re.M)
    pkg = m.group(1) if m else ''
    cls = os.path.splitext(os.path.basename(s))[0]
    fqcn = pkg + '.' + cls if pkg else cls
    lines.append(s.replace(os.sep, '/') + '\t' + fqcn)
out = os.path.join(root, '_work', '_tmp', 'MagicMaster', 'janino_manifest.txt')
with open(out, 'w', newline='\n', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')
print('manifest entries:', len(lines))
