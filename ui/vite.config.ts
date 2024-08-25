import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vitejs.dev/config/
export default defineConfig({
  base: "",
  build: {
    manifest: true,
    rollupOptions: {
      input: "src/main.tsx",
      output: {
        manualChunks: {
          // use vite-bundle-visualizer to find good candidates for manual chunks:
          dagrejs: ["@dagrejs/dagre"],
          "react-dom": ["react-dom"],
          reactflow: ["reactflow"],
        },
      },
    },
    target: "esnext",
  },
  plugins: [react(), TanStackRouterVite(), tsconfigPaths()],
});
