import org.json.JSONArray;
import org.json.JSONObject;
import java.nio.file.Files;
import java.nio.file.Paths;

// Replicates the game's data-CSV pipeline to decide whether a CSV would crash the
// rules engine (or any consumer requiring fixed columns):
//   1. read file (UTF-8)
//   2. normalize curly quotes like the game does (SpecStore.?00000):
//      [\u201c\u201d]+ -> " , [\u2018\u2019\ufffd]+ -> '
//   3. com.fs.starfarer.loading.G.o00000(text)  -> CSV -> JSONArray of row objects
// Then reports rows missing "options"/"script" (unconditional reads in Rules.o00000).
//
// Usage:
//   javac  --release 17 -cp "starfarer_obf.jar;starfarer.api.jar;json.jar;fs.common_obf.jar;log4j-1.2.9.jar" TestCsv.java
//   java -cp "<same>;." TestCsv <file.csv> [idPrefixFilter]
// Exit code 1 when any row is missing options/script.
public class TestCsv {
    public static void main(String[] args) throws Exception {
        String file = args[0];
        String prefix = args.length > 1 ? args[1] : null;
        String text = new String(Files.readAllBytes(Paths.get(file)), "UTF-8");
        // strip UTF-8 BOM if present
        if (text.startsWith("\uFEFF")) text = text.substring(1);
        // game normalization (SpecStore.?00000 equivalent)
        text = text.replaceAll("[\\u201c\\u201d]+", "\"");
        text = text.replaceAll("[\\u2018\\u2019\\ufffd]+", "'");
        JSONArray rows = com.fs.starfarer.loading.G.o00000(text);
        System.out.println("== " + file + " -> rows: " + rows.length());
        int bad = 0;
        for (int i = 0; i < rows.length(); i++) {
            JSONObject o = rows.getJSONObject(i);
            String id = o.has("id") ? o.getString("id") : "(no id)";
            if (id.startsWith("#") || id.trim().isEmpty()) continue;
            boolean hasOpt = o.has("options");
            boolean hasScript = o.has("script");
            boolean hasText = o.has("text");
            boolean shown = prefix == null || id.startsWith(prefix);
            if (!hasOpt || !hasScript) {
                bad++;
                System.out.println("  [MISSING-KEY] row " + i + " id=" + id
                        + " trigger=" + (o.has("trigger") ? o.getString("trigger") : "-")
                        + " options=" + hasOpt + " script=" + hasScript + " text=" + hasText);
            } else if (shown) {
                String opt = o.getString("options");
                System.out.println("  ok " + id + " opt=" + (opt.length() > 44 ? opt.substring(0, 44) + "…" : opt));
            }
        }
        System.out.println("missing-key rows: " + bad + "  (baseline of an English original should be 0; more rows than baseline means rows were split)");
        if (bad > 0) System.exit(1);
    }
}
