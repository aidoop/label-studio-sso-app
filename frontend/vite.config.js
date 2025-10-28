import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    host: "nubison.localhost",
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://nubison.localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
