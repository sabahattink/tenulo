import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { StoreProduct } from "../../modules/tenulo-native";
import { billingAvailable, buyPro, proProduct, refreshPro, useIsPro, useProState } from "@/platform/billing";
import { Illustration } from "@/ui/Illustration";
import { Icon, type IconName } from "@/ui/icons";
import { Button } from "@/ui/kit";
import { type Theme, radius, space, type, useTheme } from "@/ui/theme";

const FEATURES: readonly { icon: IconName; title: string; body: string }[] = [
  {
    icon: "report",
    title: "Doctor report",
    body: "Your trend, injections, plan and side effects for any period, as a clean PDF you can print or send.",
  },
  {
    icon: "heart",
    title: "Health Connect",
    body: "Readings from your smart scale appear in your log automatically. Read-only; nothing is written back.",
  },
  {
    icon: "shield",
    title: "Still private",
    body: "No account, no subscription, no tracking. Google Play confirms the purchase; Tenulo never learns who you are.",
  },
];

export default function ProScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isPro = useIsPro();
  const { pending } = useProState();
  const [product, setProduct] = useState<StoreProduct | null | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    proProduct()
      .then((p) => alive && setProduct(p))
      .catch(() => alive && setProduct(null));
    return () => {
      alive = false;
    };
  }, []);

  const buy = async () => {
    setBusy(true);
    try {
      const outcome = await buyPro();
      if (outcome === "purchased") router.back();
      else if (outcome === "pending") {
        Alert.alert("Purchase pending", "Pro unlocks as soon as Google Play confirms your payment.");
      }
    } catch (e) {
      Alert.alert("Purchase did not go through", e instanceof Error ? e.message : "Please try again later.");
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    await refreshPro();
    setBusy(false);
  };

  const available = billingAvailable() && product !== null;
  const price = product?.price;

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Illustration name="report" theme={theme} size={Math.min(width - space.xl * 2, 300)} />
        <Text style={[type.title, styles.center, { color: theme.text }]}>Tenulo Pro</Text>
        <Text style={[type.body, styles.center, { color: theme.muted }]}>
          One purchase. Yours on every phone signed in to your Google account.
        </Text>
      </View>

      {FEATURES.map((f) => (
        <Feature key={f.title} theme={theme} {...f} />
      ))}

      {isPro ? (
        <View style={[styles.owned, { backgroundColor: theme.accentSoft }]}>
          <Icon name="check" color={theme.accent} />
          <Text style={[type.bodyStrong, styles.flex, { color: theme.text }]}>
            Pro is unlocked. Thank you for supporting Tenulo.
          </Text>
        </View>
      ) : (
        <View style={styles.actions}>
          <Button
            theme={theme}
            label={busy ? "Opening Google Play…" : price ? `Unlock Pro · ${price}` : "Unlock Pro"}
            onPress={() => void buy()}
            disabled={!available || busy || pending}
          />
          <Button theme={theme} kind="secondary" label="Restore purchase" onPress={() => void restore()} disabled={busy} />
          <Text style={[type.small, styles.note, { color: theme.muted }]}>
            {pending
              ? "Your purchase is pending with Google Play."
              : !available
                ? "Purchases are available in the version of Tenulo installed from Google Play."
                : "Paid once through Google Play. Refunds follow Google Play policy."}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function Feature({ theme, icon, title, body }: { theme: Theme; icon: IconName; title: string; body: string }) {
  return (
    <View style={styles.feature}>
      <View style={[styles.featureIcon, { backgroundColor: theme.accentSoft }]}>
        <Icon name={icon} color={theme.accent} />
      </View>
      <View style={styles.flex}>
        <Text style={[type.bodyStrong, { color: theme.text }]}>{title}</Text>
        <Text style={[type.small, { color: theme.muted }]}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.xl, paddingBottom: space.xxl },
  hero: { alignItems: "center", gap: space.s },
  center: { textAlign: "center" },
  feature: { flexDirection: "row", gap: space.l, alignItems: "flex-start" },
  featureIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1, gap: 2 },
  actions: { gap: space.m },
  note: { textAlign: "center" },
  owned: { flexDirection: "row", gap: space.m, alignItems: "center", padding: space.l, borderRadius: radius.l },
});
