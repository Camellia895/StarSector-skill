// ProjSpecCheck.java —— 弹道/导弹 spec 的"引擎语义级"校验（只读）
//
// 为什么需要它（真实事故）：`ProximityFuseAI.updateDamage()` 用的是**严格读法**
//   this.range = (float) this.spec.getParams().getDouble("range");
// 而 `spec.getParams()` 就是 `behaviorSpec` 那个 JSONObject 本体
//   （WeaponSpecLoader: `new OOO0(behavior, jSONObject2)`，OOO0.getParams() 直接返回它）。
// 于是 .proj 里写了 `"behavior":"PROXIMITY_FUSE"` 却漏掉 `"range"` ⇒ 近炸引信导弹一造成伤害就
//   `org.json.JSONException: JSONObject["range"] not found`
//   at ProximityFuseAI.updateDamage / <init> ← Missile.a(...)（a.super 里 new ProximityFuseAI）
// 本工具按**同一个行为**把这些漏键提前暴露出来，不需要开游戏。
//
// 解析用的是游戏自己的 org.json（<core>\json.jar）+ 逐字复刻
// com.fs.starfarer.loading.LoadingUtils.o00000(String,String) 的 `#` 注释剥离算法
// （注意：只剥注释，裸键/尾随逗号由 org.json 自己容忍），所以不会出现"严格 JSON 解析器"的假阳性。
//
// 编译/运行（JBR 17；用游戏自带 JRE 跑也行——只读 json.jar）：
//   javac -encoding UTF-8 --release 17 -cp "<core>\json.jar" -d <outDir> ProjSpecCheck.java
//   java -cp "<outDir>;<core>\json.jar" ProjSpecCheck <data 根目录...>
//
// 退出码：0 = 干净；1 = 有命中（解析失败 / 缺必需键 / PROXIMITY_FUSE 缺 range）。
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

public class ProjSpecCheck {

    // 逐字复刻 com.fs.starfarer.loading.LoadingUtils.o00000(String, String)
    static String gameStrip(String s) {
        StringBuilder b = new StringBuilder();
        boolean comment = false, inStr = false;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '"') inStr = !inStr;
            if (c == '\n' || c == '\r') {
                comment = false;
                inStr = false;
                if (c == '\n') b.append('\n');
            } else if (c == '#' && !inStr) {
                comment = true;
            } else if (!comment) {
                b.append(c);
            }
        }
        return b.toString();
    }

    static List<Path> collect(Path root, String ext) throws IOException {
        List<Path> out = new ArrayList<>();
        if (!Files.isDirectory(root)) return out;
        Files.walk(root).filter(p -> p.toString().toLowerCase().endsWith(ext)).forEach(out::add);
        return out;
    }

    public static void main(String[] args) throws Exception {
        if (args.length == 0) {
            System.out.println("用法: java -cp \"<outDir>;<core>\\json.jar\" ProjSpecCheck <data 根目录...>");
            System.exit(2);
        }
        List<Path> specFiles = new ArrayList<>();
        for (String a : args) {
            Path r = Paths.get(a);
            specFiles.addAll(collect(r, ".proj"));
            specFiles.addAll(collect(r, ".wpn"));
            specFiles.addAll(collect(r, ".system"));
        }
        Collections.sort(specFiles);

        int parseFail = 0, missingRequired = 0, pfaMissing = 0, pfaOk = 0;
        Set<String> projIds = new HashSet<>();

        for (Path p : specFiles) {
            String name = p.getFileName().toString();
            String raw;
            try {
                byte[] bytes = Files.readAllBytes(p);
                if (bytes.length >= 3 && (bytes[0] & 0xFF) == 0xEF && (bytes[1] & 0xFF) == 0xBB && (bytes[2] & 0xFF) == 0xBF) {
                    System.out.println("BOM  " + p + " (UTF-8 BOM present)");
                    raw = new String(bytes, 3, bytes.length - 3, StandardCharsets.UTF_8);
                } else {
                    raw = new String(bytes, StandardCharsets.UTF_8);
                }
            } catch (Exception e) {
                System.out.println("READFAIL " + p + " " + e);
                parseFail++;
                continue;
            }
            JSONObject o;
            try {
                o = new JSONObject(gameStrip(raw));
            } catch (Throwable t) {
                System.out.println("PARSEFAIL " + p + " -> " + t.getMessage());
                parseFail++;
                continue;
            }
            String specClass = o.optString("specClass", null);
            String id = o.optString("id", "?");
            boolean isProj = name.toLowerCase().endsWith(".proj");
            if (isProj) projIds.add(id);

            // 复刻 WeaponSpecLoader 的必备键（只有 .proj 走 projectile/missile 分支；
            // .wpn 是武器 spec，specClass 字段对它无意义）
            List<String> required = new ArrayList<>();
            if (isProj && "projectile".equals(specClass)) {
                required.addAll(Arrays.asList("id", "specClass", "width", "fadeTime"));
            } else if (isProj && "missile".equals(specClass)) {
                required.addAll(Arrays.asList("id", "specClass", "sprite", "center", "size", "collisionRadius", "engineSpec"));
            }
            for (String k : required) {
                if (!o.has(k)) {
                    System.out.println("MISSING-KEY " + p + " required key '" + k + "' absent (specClass=" + specClass + ")");
                    missingRequired++;
                }
            }
            if (isProj && "missile".equals(specClass) && o.has("engineSpec")) {
                JSONObject es = o.optJSONObject("engineSpec");
                if (es == null) {
                    System.out.println("BADTYPE " + p + " engineSpec is not an object");
                    missingRequired++;
                } else {
                    for (String k : new String[]{"turnAcc", "turnRate", "acc", "dec"}) {
                        if (!es.has(k)) {
                            System.out.println("MISSING-KEY " + p + " engineSpec.'" + k + "' absent (getDouble would throw)");
                            missingRequired++;
                        }
                    }
                }
            }

            // ---- ProximityFuseAI 崩溃条件：behaviorSpec.behavior == PROXIMITY_FUSE 且无 range ----
            if (o.has("behaviorSpec")) {
                JSONObject bs = o.optJSONObject("behaviorSpec");
                if (bs == null) {
                    System.out.println("BADTYPE " + p + " behaviorSpec is not an object");
                    continue;
                }
                if (!"PROXIMITY_FUSE".equals(bs.optString("behavior", null))) continue;
                if (!bs.has("range")) {
                    System.out.println("*** PFAI-RANGE-MISSING " + p + " id=" + id
                            + " behavior=PROXIMITY_FUSE 无 \"range\" -> ProximityFuseAI.updateDamage() JSONException");
                    pfaMissing++;
                } else {
                    try {
                        bs.getDouble("range");
                        pfaOk++;
                    } catch (Throwable t) {
                        System.out.println("*** PFAI-RANGE-BAD " + p + " id=" + id + " range=" + bs.opt("range") + " -> " + t);
                        pfaMissing++;
                    }
                }
                if (bs.has("explosionSpec") && bs.optJSONObject("explosionSpec") == null) {
                    System.out.println("BADTYPE " + p + " behaviorSpec.explosionSpec is not an object");
                }
            }
        }

        System.out.println();
        System.out.println("scanned spec files : " + specFiles.size());
        System.out.println("parse failures     : " + parseFail);
        System.out.println("missing required   : " + missingRequired);
        System.out.println("PROXIMITY_FUSE ok  : " + pfaOk);
        System.out.println("PROXIMITY_FUSE bad : " + pfaMissing);
        if (parseFail > 0 || missingRequired > 0 || pfaMissing > 0) System.exit(1);
    }
}
