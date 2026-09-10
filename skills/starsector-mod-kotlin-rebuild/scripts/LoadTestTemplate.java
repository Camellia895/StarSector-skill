// Offline load/instantiation verification for a Kotlin Starsector mod jar (0.98a).
// 1) Class.forName() every class in the jar (runs static init - catches class-load-time
//    landmines like eager Settings(JSONObject()) throwing JSONException).
// 2) newInstance() every concrete hullmod class (mirrors the hull_mods.csv script-column path).
// 3) newInstance() the combat plugin registered via data/config/settings.json "plugins".
//
// Fill in the class lists below, then:
//   compile: <JBR>\bin\javac.exe --release 17 -encoding UTF-8 -cp "<gamecp>" -d <out> LoadTestTemplate.java
//   run:     <game jre>\bin\java.exe -Dcom.fs.starfarer.settings.paths.logs=<temp log dir> -cp "<gamecp>;<out>" LoadTestTemplate
//   gamecp  = starfarer.api.jar;starfarer_obf.jar;fs.common_obf.jar;json.jar;log4j-1.2.9.jar;
//             <game>\mods\LazyLib\jars\internal\Kotlin-Runtime.jar;<mod jar>
// NOTE: the -D...logs property is REQUIRED - without it log4j tries to write \starsector.log at the
// drive root, Global.getLogger throws, and every class init fails for the wrong reason.
public class LoadTestTemplate {
    static int fail = 0;

    static void check(String label, boolean ok, String detail) {
        System.out.println((ok ? "OK   " : "FAIL ") + label + (detail.isEmpty() ? "" : " -> " + detail));
        if (!ok) fail++;
    }

    public static void main(String[] args) throws Exception {
        // 1) classes whose static init must not throw (core classes + plugin classes)
        String[] core = {
            // e.g. "com.example.mod.ModPlugin", "com.example.mod.CombatPlugin",
            // "com.example.mod.Settings", ...
        };
        for (String n : core) {
            try {
                Class.forName(n);
                check("init " + n, true, "");
            } catch (Throwable t) {
                check("init " + n, false, t.toString());
                Throwable c = t.getCause();
                while (c != null) { System.out.println("    cause: " + c); c = c.getCause(); }
            }
        }

        // 3) combat plugin instantiation BEFORE any mod-plugin state is set (early-instantiation scenario)
        String[] plugins = {
            // e.g. "com.example.mod.CombatPlugin"
        };
        for (String n : plugins) {
            try {
                Object p = Class.forName(n).getConstructor().newInstance();
                check("plugin new " + n, true, p.getClass().getSimpleName());
            } catch (Throwable t) {
                check("plugin new " + n, false, String.valueOf(t.getCause() != null ? t.getCause() : t));
            }
        }

        // 2) hullmods (hull_mods.csv script column path)
        String[] hullmods = {
            // e.g. "com.example.mod.hullmods.SomeHullmod", ...
        };
        for (String n : hullmods) {
            try {
                Object o = Class.forName(n).getConstructor().newInstance();
                boolean isHM = o instanceof com.fs.starfarer.api.combat.HullModEffect;
                check("hullmod " + n.substring(n.lastIndexOf('.') + 1), isHM, isHM ? "" : "not a HullModEffect");
            } catch (Throwable t) {
                check("hullmod " + n.substring(n.lastIndexOf('.') + 1), false, t.toString());
            }
        }

        // Optional: exercise Settings-style parsing with config-shaped JSON (map + scalar branches).
        // (Modify to the actual config class/keys of the target mod.)
        // try { JSONObject cfg = new JSONObject(); ...; new Settings(cfg); check(...); } catch ...

        System.out.println(fail == 0 ? "ALL PASS" : ("FAILURES: " + fail));
        if (fail != 0) System.exit(1);
    }
}
