// JsonProbe.java —— 用【游戏自带的 org.json】验证数据文件能否解析（只读）
//
// 为什么必须用它：Starsector 的数据文件用了大量宽松 JSON 扩展——`#` 注释、尾随逗号、裸键、
// `;` 代替 `,`、`[STATIONS]` 这类枚举字面量、`025`、`.0f`、`.5`。用 node 的严格 JSON.parse
// 判定会得到**大量假故障**。本程序复刻游戏的读法：先剥 `#`/`//` 注释（字符串外），再交给 org.json。
//
// 编译/运行（json.jar 来自游戏 core）：
//   javac -encoding UTF-8 --release 17 -cp "C:\game\StarSector.v0.9.8a-RC8\starsector-core\json.jar" -d . JsonProbe.java
//   java -cp ".;C:\game\StarSector.v0.9.8a-RC8\starsector-core\json.jar" JsonProbe <file...>
//
// 输出：每个文件的解析结果 + 顶层键名 + 可选的 `键=值` 探测（默认打印 id/name/version）。
import org.json.*;
import java.nio.file.*;

public class JsonProbe {

    static String stripComments(String s) {
        StringBuilder out = new StringBuilder();
        boolean inStr = false, esc = false;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (inStr) {
                out.append(c);
                if (esc) esc = false;
                else if (c == '\\') esc = true;
                else if (c == '"') inStr = false;
                continue;
            }
            if (c == '"') { inStr = true; out.append(c); continue; }
            if (c == '#') { while (i < s.length() && s.charAt(i) != '\n') i++; out.append('\n'); continue; }
            if (c == '/' && i + 1 < s.length() && s.charAt(i + 1) == '/') { while (i < s.length() && s.charAt(i) != '\n') i++; out.append('\n'); continue; }
            out.append(c);
        }
        return out.toString();
    }

    public static void main(String[] args) throws Exception {
        if (args.length == 0) {
            System.out.println("用法: java -cp \"<json.jar>;.\" JsonProbe <file...>");
            return;
        }
        int fail = 0;
        for (String f : args) {
            String name = Paths.get(f).getFileName().toString();
            String raw;
            try {
                byte[] b = Files.readAllBytes(Paths.get(f));
                if (b.length >= 3 && (b[0] & 0xFF) == 0xEF && (b[1] & 0xFF) == 0xBB && (b[2] & 0xFF) == 0xBF) {
                    System.out.println("WARN " + name + " 含 UTF-8 BOM（部分游戏的严格解析路径会崩）");
                    raw = new String(b, 3, b.length - 3, "UTF-8");
                } else {
                    raw = new String(b, "UTF-8");
                }
            } catch (Exception e) {
                System.out.println("FAIL " + name + " 读取失败: " + e);
                fail++;
                continue;
            }
            String clean = stripComments(raw);
            try {
                JSONObject o = new JSONObject(clean);
                System.out.println("OK   " + name + "  顶层键 " + o.length() + " 个");
                StringBuilder sb = new StringBuilder();
                java.util.Iterator<String> it = o.keys();
                while (it.hasNext()) sb.append(it.next()).append(' ');
                System.out.println("     keys: " + sb.toString().trim());
                for (String k : new String[] { "id", "name", "version", "gameVersion", "modPlugin" }) {
                    if (o.has(k)) System.out.println("     " + k + " = " + o.opt(k));
                }
            } catch (Throwable t) {
                System.out.println("FAIL " + name + " -> " + t.getMessage());
                fail++;
            }
        }
        if (fail > 0) System.exit(1);
    }
}
