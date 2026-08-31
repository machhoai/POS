// electron.vite.config.ts
import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import vue from "@vitejs/plugin-vue";
import optimizer from "vite-plugin-optimizer";
import svgLoader from "vite-svg-loader";
var electron_vite_config_default = defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src")
      }
      // preserveSymlinks: true
    },
    plugins: [
      vue(),
      svgLoader(),
      optimizer({
        fs: () => ({
          find: /^(node:)?fs$/,
          code: `const fs = require('fs'); export { fs as default }`
        })
      })
    ]
  }
});
export {
  electron_vite_config_default as default
};
