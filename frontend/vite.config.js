import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    host: process.env.VITE_DEV_HOST || "hatiolab.localhost",
    port: parseInt(process.env.VITE_DEV_PORT || "3000"),
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://backend:3001',
        changeOrigin: true,
      },
    },
  },
});
