import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/Ziva/",
  plugins: [react()],
  build: {
    target: "es2020",
    outDir: "dist"
  },
  server: {
    host: "0.0.0.0"
  }
});
