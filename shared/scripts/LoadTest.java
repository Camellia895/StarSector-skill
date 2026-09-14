import com.fs.starfarer.api.BaseModPlugin;
import com.fs.starfarer.api.campaign.SectorGeneratorPlugin;
import com.fs.starfarer.api.combat.BaseEveryFrameCombatPlugin;
import com.fs.starfarer.api.combat.BaseHullMod;
import com.fs.starfarer.api.combat.EveryFrameCombatPlugin;
import com.fs.starfarer.api.combat.EveryFrameWeaponEffectPlugin;
import com.fs.starfarer.api.combat.MissileAIPlugin;
import com.fs.starfarer.api.combat.OnHitEffectPlugin;
import com.fs.starfarer.api.combat.ShipSystemAIScript;
import com.fs.starfarer.api.impl.campaign.rulecmd.BaseCommandPlugin;

import java.io.*;
import java.lang.reflect.Modifier;
import java.util.*;
import java.util.zip.*;

/**
 * 离线验证：镜像游戏的类加载/实例化路径，检查重建后的 jar 是否与 0.98a 运行环境自洽。
 * 1) 对 jar 内每个 class 做 Class.forName（会跑 static 初始化）
 * 2) 对"游戏会实例化"的类做 newInstance（hullmod / 舰船系统脚本 / 武器脚本 / 战斗插件 / modPlugin / 星域生成器 / 规则命令）
 * 3) 校验 data/*.csv 里引用的 script 类是否真实存在
 *
 * 运行：java -Dcom.fs.starfarer.settings.paths.logs=<tmp> -cp <core jars;mods jars;SylphonRnD.jar;.> LoadTest <jar> <modDir>
 */
public class LoadTest {

    static int total = 0, loaded = 0, instantiated = 0, failed = 0;
    static List<String> failures = new ArrayList<String>();

    public static void main(String[] args) throws Exception {
        String jarPath = args[0];
        String modDir = args.length > 1 ? args[1] : null;

        List<String> classes = new ArrayList<String>();
        ZipFile zf = new ZipFile(jarPath);
        for (Enumeration<? extends ZipEntry> e = zf.entries(); e.hasMoreElements();) {
            ZipEntry ze = e.nextElement();
            if (ze.getName().endsWith(".class")) {
                classes.add(ze.getName().substring(0, ze.getName().length() - 6).replace('/', '.'));
            }
        }
        zf.close();
        Collections.sort(classes);

        System.out.println("== jar 内 class 数: " + classes.size());

        // ---- 1) 全部类加载 ----
        List<Class<?>> loadedClasses = new ArrayList<Class<?>>();
        for (String cn : classes) {
            total++;
            try {
                Class<?> c = Class.forName(cn, true, LoadTest.class.getClassLoader());
                loaded++;
                loadedClasses.add(c);
            } catch (Throwable t) {
                failed++;
                failures.add("LOAD  " + cn + " -> " + t);
            }
        }

        // ---- 2) 对游戏会实例化的类做实例化 ----
        for (Class<?> c : loadedClasses) {
            if (c.isInterface() || Modifier.isAbstract(c.getModifiers())) continue;
            if (c.getName().indexOf('$') >= 0) continue;
            boolean gameInstantiates =
                    BaseHullMod.class.isAssignableFrom(c)
                 || BaseModPlugin.class.isAssignableFrom(c)
                 || SectorGeneratorPlugin.class.isAssignableFrom(c)
                 || BaseEveryFrameCombatPlugin.class.isAssignableFrom(c)
                 || EveryFrameCombatPlugin.class.isAssignableFrom(c)
                 || EveryFrameWeaponEffectPlugin.class.isAssignableFrom(c)
                 || OnHitEffectPlugin.class.isAssignableFrom(c)
                 || MissileAIPlugin.class.isAssignableFrom(c)
                 || ShipSystemAIScript.class.isAssignableFrom(c)
                 || BaseCommandPlugin.class.isAssignableFrom(c);
            if (!gameInstantiates) continue;
            try {
                c.getDeclaredConstructor().newInstance();
                instantiated++;
            } catch (Throwable t) {
                // 只有"无参构造本身抛异常"才算问题；NoSuchMethod 说明需要参数的类跳过
                if (t instanceof NoSuchMethodException) {
                    System.out.println("SKIP  (no no-arg ctor) " + c.getName());
                } else {
                    failed++;
                    Throwable root = t;
                    while (root.getCause() != null) root = root.getCause();
                    failures.add("NEW   " + c.getName() + " -> " + t + " | root=" + root);
                }
            }
        }

        // ---- 3) CSV 里引用的 script 类是否都存在 ----
        if (modDir != null) {
            checkCsvScripts(modDir, "data/hullmods/hull_mods.csv", "script");
            checkSystemScripts(modDir);
        }

        System.out.println();
        System.out.println("== 汇总: class 总数=" + total + " 加载成功=" + loaded
                + " 实例化成功=" + instantiated + " 失败=" + failed);
        if (!failures.isEmpty()) {
            System.out.println("== 失败明细:");
            for (String f : failures) System.out.println("   " + f);
            System.exit(1);
        }
        System.out.println("ALL PASS");
    }

    /** 扫描 data/shipsystems/*.system 里的 statsScript / aiScript 类是否存在 */
    static void checkSystemScripts(String modDir) throws Exception {
        File dir = new File(modDir, "data/shipsystems");
        if (!dir.isDirectory()) return;
        int checked = 0;
        Set<String> missing = new LinkedHashSet<String>();
        for (File f : dir.listFiles()) {
            if (!f.getName().endsWith(".system")) continue;
            String txt = readAll(f);
            for (String key : new String[] { "statsScript", "aiScript" }) {
                int i = txt.indexOf("\"" + key + "\"");
                if (i < 0) continue;
                int a = txt.indexOf('"', i + key.length() + 2);
                if (a < 0) continue;
                int b = txt.indexOf('"', a + 1);
                if (b < 0) continue;
                String cls = txt.substring(a + 1, b).trim();
                if (cls.isEmpty()) continue;
                checked++;
                try {
                    Class.forName(cls, false, LoadTest.class.getClassLoader());
                } catch (Throwable t) {
                    missing.add(f.getName() + " -> " + cls + " (" + t.getClass().getSimpleName() + ")");
                }
            }
        }
        System.out.println("SYS   data/shipsystems/*.system: 检查 " + checked + " 个脚本类，缺失 " + missing.size());
        for (String m : missing) {
            failed++;
            failures.add("SYS   " + m);
        }
    }

    static String readAll(File f) throws Exception {
        BufferedReader r = new BufferedReader(new InputStreamReader(new FileInputStream(f), "UTF-8"));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = r.readLine()) != null) sb.append(line).append('\n');
        r.close();
        return sb.toString();
    }

    /** 引号感知的 CSV 行切分 */
    static List<String> splitCsv(String line) {
        List<String> out = new ArrayList<String>();
        StringBuilder cur = new StringBuilder();
        boolean inQ = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (inQ) {
                if (c == '"') {
                    if (i + 1 < line.length() && line.charAt(i + 1) == '"') { cur.append('"'); i++; }
                    else inQ = false;
                } else cur.append(c);
            } else {
                if (c == '"') inQ = true;
                else if (c == ',') { out.add(cur.toString()); cur.setLength(0); }
                else cur.append(c);
            }
        }
        out.add(cur.toString());
        return out;
    }

    /** 极简 CSV 解析：取表头列名 -> 值，检查脚本类可加载 */
    static void checkCsvScripts(String modDir, String rel, String col) throws Exception {
        File f = new File(modDir, rel);
        if (!f.exists()) { System.out.println("SKIP  " + rel + " (不存在)"); return; }
        BufferedReader r = new BufferedReader(new InputStreamReader(new FileInputStream(f), "UTF-8"));
        String header = r.readLine();
        if (header == null) { r.close(); return; }
        List<String> cols = splitCsv(header);
        int idx = -1;
        for (int i = 0; i < cols.size(); i++) {
            if (cols.get(i).trim().replace("\"", "").equalsIgnoreCase(col)) idx = i;
        }
        if (idx < 0) { r.close(); System.out.println("NOTE  " + rel + " 无 '" + col + "' 列"); return; }
        String line;
        int checked = 0;
        Set<String> missing = new LinkedHashSet<String>();
        while ((line = r.readLine()) != null) {
            if (line.trim().isEmpty()) continue;
            List<String> parts = splitCsv(line);
            if (idx >= parts.size()) continue;
            String v = parts.get(idx).trim().replace("\"", "");
            if (v.isEmpty()) continue;
            checked++;
            try {
                Class.forName(v, false, LoadTest.class.getClassLoader());
            } catch (Throwable t) {
                missing.add(v + " (" + t.getClass().getSimpleName() + ")");
            }
        }
        r.close();
        System.out.println("CSV   " + rel + ": 检查 " + checked + " 个 " + col + " 类，缺失 " + missing.size());
        for (String m : missing) {
            failed++;
            failures.add("CSV   " + rel + " -> " + m);
        }
    }
}
