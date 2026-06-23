import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.zivaapp.ziva",
  appName: "Ziva",
  webDir: "dist",
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false
  }
};

export default config;
