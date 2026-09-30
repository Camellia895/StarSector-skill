# check_perfile_resolvability.py — R22 逐文件可解析性闸门（只读）
#
# 背景（iron-rules R22）：0.98a 对无 jars/ 的 janino mod（data/**/*.java）按"包名+文件名"
# 逐个按需编译。离线批量编译探针全绿 ≠ 游戏能过：批量会话内兄弟类互相可见，
# 逐文件编译时 import data.* 必须能落到"同名文件"。
#
# 用法：python check_perfile_resolvability.py <modDir> [游戏根]
#   <modDir>  mod 目录（含 data/）
#   [游戏根]  默认 C:\game\StarSector.v0.9.8a-RC8，用于扫描 MagicLib 等依赖 jar 的旧包名垫片
# 输出：多"顶层"类文件清单（花括号深度判定，嵌套类不算）+ 逐文件不可解析的 import；
#       有 UNRESOLVED 时退出码 1。
import glob, os, re, subprocess, sys

mod = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
root = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else r'C:\game\StarSector.v0.9.8a-RC8'

files = [f for f in glob.glob(os.path.join(mod, 'data', '**', '*.java'), recursive=True)
         if f.lower().endswith('.java')]


def toplevel_classes(text):
    """depth-0 的 class 声明（花括号深度跟踪；字符串/行注释粗剥离，嵌套类不算）"""
    out = []
    depth = 0
    for l in text.splitlines():
        s = re.sub(r'"(\\.|[^"\\])*"', '""', l).split('//')[0]
        if depth == 0:
            m = re.match(r'^\s*(?:(?:public|final|abstract)\s+)*class\s+(\w+)', s)
            if m:
                out.append(m.group(1))
        depth += s.count('{') - s.count('}')
    return out


# 1) 顶层类多于一个的文件（R22 约束 1）
print('=== files with >1 top-level class ===')
multi = 0
for f in files:
    decls = toplevel_classes(open(f, encoding='utf-8', errors='replace').read())
    if len(decls) > 1:
        multi += 1
        print('  MULTI-TOPLEVEL:', os.path.relpath(f, mod), '->', decls)
if not multi:
    print('  (none)')

# 2) import data.* 的解析（R22 约束 2）：同名文件 / 依赖 jar 垫片 / 同文件声明
avail = {os.path.splitext(os.path.basename(f))[0] for f in files}
shim_classes = set()
for jar in glob.glob(os.path.join(root, 'mods', '*', 'jars', '*.jar')):
    try:
        r = subprocess.run(['C:\\Program Files\\NVIDIA Corporation\\NVIDIA App\\7z.exe', 'l', jar],
                           capture_output=True, timeout=60)
        out = r.stdout.decode('utf-8', errors='replace')
    except Exception:
        continue
    for m in re.finditer(r'data[\\/][\w\\/]+\.class', out):
        shim_classes.add(m.group(0).replace('\\', '/').replace('/', '.')[:-len('.class')])

unresolved = []
for f in files:
    t = open(f, encoding='utf-8', errors='replace').read()
    own = set(toplevel_classes(t))
    for m in re.finditer(r'(?m)^import\s+(data\.[\w.]+)\s*;', t):
        fq = m.group(1)
        simple = fq.rsplit('.', 1)[-1]
        if simple in avail or fq in shim_classes or simple in own:
            continue
        unresolved.append((os.path.relpath(f, mod), fq))

print('=== import data.* resolution ===')
if unresolved:
    for f, fq in sorted(set(unresolved)):
        print('  UNRESOLVED-PERFILE:', f, '->', fq)
    print('FAIL — 按文件名逐个编译下必然 Fatal；拆分多类文件或改直接引用')
    sys.exit(1)
print('  all import data.* resolve to same-named files or lib jar shims')
