import org.codehaus.janino.JavaSourceClassLoader;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Loads every class listed in the manifest through janino's JavaSourceClassLoader
 * (same mechanism the game uses for data/scripts), forcing full compilation.
 * Manifest lines: <absPath>.java<TAB><fqcn>
 * Args: <manifest> <classpath-jars-separated-by-;> <sourceRoot>
 */
public class JaninoProbe {
    public static void main(String[] args) throws Exception {
        File manifest = new File(args[0]);
        String[] jars = args[1].split(";");
        File sourceRoot = new File(args[2]);
        List<URL> urls = new ArrayList<URL>();
        for (String j : jars) {
            urls.add(new File(j).toURI().toURL());
        }
        URLClassLoader parent = new URLClassLoader(urls.toArray(new URL[0]), JaninoProbe.class.getClassLoader());
        JavaSourceClassLoader loader = new JavaSourceClassLoader(
                parent, new File[]{sourceRoot}, "UTF-8");

        List<String> paths = new ArrayList<String>();
        List<String> fqcns = new ArrayList<String>();
        BufferedReader r = new BufferedReader(new InputStreamReader(new FileInputStream(manifest), StandardCharsets.UTF_8));
        String line;
        while ((line = r.readLine()) != null) {
            line = line.trim();
            if (line.isEmpty()) continue;
            int tab = line.indexOf('\t');
            paths.add(line.substring(0, tab));
            fqcns.add(line.substring(tab + 1));
        }
        r.close();

        int fails = 0;
        for (int i = 0; i < fqcns.size(); i++) {
            String fqcn = fqcns.get(i);
            try {
                Class<?> c = loader.loadClass(fqcn);
                System.out.println("OK   " + fqcn);
            } catch (Throwable t) {
                fails++;
                if (System.getenv("PROBE_VERBOSE") != null) { t.printStackTrace(); }
                Throwable cause = t;
                int depth = 0;
                while (cause.getCause() != null && depth < 5) { cause = cause.getCause(); depth++; }
                String msg = cause.getMessage();
                if (msg != null) msg = msg.replace('\n', ' ');
                System.out.println("FAIL " + fqcn + " :: " + cause.getClass().getName() + " :: "
                        + (msg == null ? "" : msg.substring(0, Math.min(400, msg.length()))));
                StackTraceElement[] st = cause.getStackTrace();
                for (int k = 0; k < Math.min(4, st.length); k++) System.out.println("       at " + st[k]);
            }
        }
        System.out.println("SUMMARY total=" + fqcns.size() + " fail=" + fails);
        System.exit(fails > 0 ? 1 : 0);
    }
}
