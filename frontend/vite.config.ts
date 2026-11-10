import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      proxy: {
        "/langgraph-api": {
          target: env.VITE_LANGGRAPH_API_URL || "http://127.0.0.1:2024",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/langgraph-api/, ""),
        },
      },
    },
  };
});
