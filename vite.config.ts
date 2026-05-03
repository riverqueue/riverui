import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const dagreCjsPath = path.resolve(
  process.cwd(),
  "node_modules/@dagrejs/dagre/dist/dagre.cjs.js",
);

// https://vitejs.dev/config/
export default defineConfig({
  base: "",
  build: {
    manifest: true,
    rollupOptions: {
      input: "src/main.tsx",
      output: {
        manualChunks(id) {
          // use vite-bundle-visualizer to find good candidates for manual chunks:
          const normalizedId = id.replaceAll("\\", "/");

          if (normalizedId.includes("/node_modules/@dagrejs/dagre/")) {
            return "dagrejs";
          }

          if (normalizedId.includes("/node_modules/@headlessui/react/")) {
            return "headlessui";
          }

          if (normalizedId.includes("/node_modules/react-dom/")) {
            return "react-dom";
          }

          if (normalizedId.includes("/node_modules/@xyflow/react/")) {
            return "reactflow";
          }
        },
      },
    },
    sourcemap: true,
    target: "esnext",
  },
  plugins: [
    tailwindcss(),
    react(),
    tanstackRouter({
      routeFileIgnorePattern: ".(const|schema|test).(ts|tsx)",
    }),
    tsconfigPaths(),
  ],
  resolve: {
    alias: {
      "@dagrejs/dagre": dagreCjsPath,
    },
  },
});
