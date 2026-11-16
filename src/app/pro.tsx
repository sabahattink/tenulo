import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { StoreProduct } from "../../modules/tenulo-native";
import type { Messages } from "@/i18n";
import { useI18n } from "@/i18n/provider";
import { billingAvailable, buyPro, proProduct, refreshPro, useIsPro, useProState } from "@/platform/billing";
import { Illustration } from "@/ui/Illustration";
import { Icon, type IconName } from "@/ui/icons";
import { Button, useScrollEndPadding } from "@/ui/kit";
import { type Theme, radius, space, type, useTheme } from "@/ui/theme";

const FEATURES: readonly { key: keyof Messages["pro"]["features"]; icon: IconName }[] = [
  { key: "report", icon: "report" },
  { key: "healthConnect", icon: "heart" },
  { key: "private", icon: "shield" },
];

/** The error code the billing module rejected with ("E_NO_PRODUCT", "E_BILLING_12"), if any. */
function errorCode(e: unknown): string | undefined {
  return typeof e === "object" && e !== null && "code" in e && typeof e.code === "string" ? e.code : undefined;
}

export default function ProScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const endPadding = useScrollEndPadding();
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
        Alert.alert(t.pro.pendingTitle, t.pro.pendingBody);
      }
    } catch (e) {
      Alert.alert(t.pro.failedTitle, t.pro.failedBody(errorCode(e), e instanceof Error ? e.message : undefined));
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      const { title, body } = t.pro.restoreResult[await refreshPro()];
      Alert.alert(title, body);
    } finally {
      setBusy(false);
    }
  };

  const available = billingAvailable() && product !== null;
  const price = product?.price;

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={[styles.content, { paddingBottom: endPadding }]}>
      <View style={styles.hero}>
        <Illustration name="report" theme={theme} size={Math.min(width - space.xl * 2, 300)} />
        <Text style={[type.title, styles.center, { color: theme.text }]}>Tenulo Pro</Text>
        <Text style={[type.body, styles.center, { color: theme.muted }]}>{t.pro.tagline}</Text>
      </View>

      {FEATURES.map((f) => (
        <Feature key={f.key} theme={theme} icon={f.icon} {...t.pro.features[f.key]} />
      ))}

      {isPro ? (
        <View style={[styles.owned, { backgroundColor: theme.accentSoft }]}>
          <Icon name="check" color={theme.accent} />
          <Text style={[type.bodyStrong, styles.flex, { color: theme.text }]}>{t.pro.unlocked}</Text>
        </View>
      ) : (
        <View style={styles.actions}>
          <Button
            theme={theme}
            label={busy ? t.pro.opening : price ? t.pro.unlockFor(price) : t.pro.unlock}
            onPress={() => void buy()}
            disabled={!available || busy || pending}
          />
          <Button theme={theme} kind="secondary" label={t.pro.restore} onPress={() => void restore()} disabled={busy} />
          <Text style={[type.small, styles.note, { color: theme.muted }]}>
            {pending ? t.pro.pendingNote : !available ? t.pro.unavailableNote : t.pro.paidOnce}
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
  content: { padding: space.xl, gap: space.xl },
  hero: { alignItems: "center", gap: space.s },
  center: { textAlign: "center" },
  feature: { flexDirection: "row", gap: space.l, alignItems: "flex-start" },
  featureIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1, gap: 2 },
  actions: { gap: space.m },
  note: { textAlign: "center" },
  owned: { flexDirection: "row", gap: space.m, alignItems: "center", padding: space.l, borderRadius: radius.l },
});
