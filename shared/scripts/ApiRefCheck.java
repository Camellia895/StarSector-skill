import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;

/**
 * 离线核对 mod jar 对 starfarer.api 的方法/字段引用是否在 0.98a API 中仍存在。
 * 用法: java ApiRefCheck <refs.json>
 * refs.json 格式: { "<mod类>": ["M|owner|name|desc", ...] }
 * 说明: desc 是 JVM 描述符（含返回类型——返回类型变了也算断裂，正对应 spawnEmpArc 案例）。
 */
public class ApiRefCheck {
    static String desc(Class<?> c) {
        if (c.isArray()) return "[" + desc(c.getComponentType());
        if (c == void.class) return "V";
        if (c == int.class) return "I";
        if (c == long.class) return "J";
        if (c == float.class) return "F";
        if (c == double.class) return "D";
        if (c == boolean.class) return "Z";
        if (c == byte.class) return "B";
        if (c == char.class) return "C";
        if (c == short.class) return "S";
        return "L" + c.getName().replace('.', '/') + ";";
    }
    static String methodDesc(Member m) {
        Class<?>[] ps = m instanceof Method ? ((Method) m).getParameterTypes() : ((Constructor<?>) m).getParameterTypes();
        StringBuilder sb = new StringBuilder("(");
        for (Class<?> p : ps) sb.append(desc(p));
        sb.append(')').append(m instanceof Method ? desc(((Method) m).getReturnType()) : "V");
        return sb.toString();
    }
    static boolean findMethod(Class<?> c, String name, String d) {
        for (Class<?> k = c; k != null; k = k.getSuperclass()) {
            if (name.equals("<init>")) {
                for (Constructor<?> m : k.getDeclaredConstructors()) if (methodDesc(m).equals(d)) return true;
            } else {
                for (Method m : k.getDeclaredMethods()) if (m.getName().equals(name) && methodDesc(m).equals(d)) return true;
            }
        }
        ArrayDeque<Class<?>> q = new ArrayDeque<>();
        for (Class<?> k = c; k != null; k = k.getSuperclass()) for (Class<?> i : k.getInterfaces()) q.add(i);
        Set<Class<?>> seen = new HashSet<>();
        while (!q.isEmpty()) {
            Class<?> i = q.poll();
            if (i == null || !seen.add(i)) continue;
            if (name.equals("<init>")) {
                for (Constructor<?> m : i.getDeclaredConstructors()) if (methodDesc(m).equals(d)) return true;
            } else {
                for (Method m : i.getDeclaredMethods()) if (m.getName().equals(name) && methodDesc(m).equals(d)) return true;
            }
            for (Class<?> ii : i.getInterfaces()) q.add(ii);
        }
        return false;
    }

    public static void main(String[] args) throws Exception {
        String json = new String(Files.readAllBytes(Paths.get(args[0])), "UTF-8");
        Map<String, List<String>> clsRefs = new LinkedHashMap<>();
        java.util.regex.Matcher km, rm;
        java.util.regex.Pattern keyP = java.util.regex.Pattern.compile("^\\s*\"([\\w.$]+)\": \\[");
        java.util.regex.Pattern refP = java.util.regex.Pattern.compile("\"([MF])\\|([^|]+)\\|([^|]+)\\|([^\"]+)\"");
        String cur = null;
        for (String line : json.split("\n")) {
            km = keyP.matcher(line);
            if (km.find()) { cur = km.group(1); continue; }
            rm = refP.matcher(line);
            while (rm.find()) clsRefs.computeIfAbsent(cur, k -> new ArrayList<>()).add(rm.group(1) + "|" + rm.group(2) + "|" + rm.group(3) + "|" + rm.group(4));
        }
        int total = 0, broken = 0;
        for (Map.Entry<String, List<String>> e : clsRefs.entrySet()) {
            List<String> misses = new ArrayList<>();
            for (String r : e.getValue()) {
                String[] p = r.split("\\|", 4);
                String kind = p[0], owner = p[1], name = p[2], d = p[3];
                total++;
                Class<?> c;
                try {
                    c = Class.forName(owner, false, ApiRefCheck.class.getClassLoader());
                } catch (Throwable t) {
                    misses.add("CLASS-MISSING " + owner + " (ref " + name + d + ")");
                    continue;
                }
                boolean found;
                if (kind.equals("M")) found = findMethod(c, name, d);
                else {
                    found = false;
                    for (Class<?> k = c; k != null && !found; k = k.getSuperclass())
                        for (Field f : k.getDeclaredFields())
                            if (f.getName().equals(name) && desc(f.getType()).equals(d)) { found = true; break; }
                }
                if (!found) misses.add(kind + " " + owner + "." + name + d);
            }
            if (!misses.isEmpty()) {
                broken++;
                System.out.println("BROKEN " + e.getKey() + " (" + misses.size() + " refs)");
                for (String m : misses) System.out.println("   " + m);
            }
        }
        System.out.println("checked " + total + " refs in " + clsRefs.size() + " classes; broken classes: " + broken);
    }
}
