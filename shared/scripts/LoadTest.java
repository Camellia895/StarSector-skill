import java.lang.reflect.*;

public class LoadTest {
    public static void main(String[] args) throws Exception {
        String[] classes = {
            "assortment_of_things.RATModPlugin",
            "assortment_of_things.abyss.boss.GenesisInteraction",
            "assortment_of_things.abyss.abilities.AbyssalBurnAbility",
            "assortment_of_things.exotech.interactions.exoship.ExoshipXanderInteraction",
            "assortment_of_things.frontiers.intel.SettlementIntel",
            "assortment_of_things.misc.RATInteractionPlugin",
            "assortment_of_things.relics.bar.RelicOfThePastBarEvent"
        };
        ClassLoader cl = Thread.currentThread().getContextClassLoader();
        for (String c : classes) {
            try {
                Class<?> k = Class.forName(c, false, cl);
                System.out.println("OK  " + c);
            } catch (Throwable t) {
                System.out.println("FAIL " + c + " -> " + t);
            }
        }
    }
}
