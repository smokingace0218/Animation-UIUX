import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// one JS + one CSS bundle, relative paths so the build runs from any folder
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
