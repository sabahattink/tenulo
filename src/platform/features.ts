import Constants from "expo-constants";
import { parseFeatures, type Features } from "@/domain/features";

/** Read once at startup; throws if app.json does not set expo.extra.medication. */
export const features: Features = parseFeatures(Constants.expoConfig?.extra);
