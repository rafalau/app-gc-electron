import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin, bytecodePlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const appMode = process.env.APP_MODE ?? ''
const disableBytecode = process.env.APP_DISABLE_BYTECODE === '1'
const mainPlugins = disableBytecode
  ? [externalizeDepsPlugin()]
  : [externalizeDepsPlugin(), bytecodePlugin()]

export default defineConfig({
  main: {
    define: {
      __APP_MODE__: JSON.stringify(appMode)
    },
    plugins: mainPlugins,
    build: {
      rollupOptions: {
        external: [
          '@prisma/client',
          '@prisma/adapter-better-sqlite3',
          'better-sqlite3',
          'bindings',
          'xlsx',
          '.prisma/client/default',
          '.prisma/client/index-browser'
        ]
      }
    }
  },
  preload: {
    define: {
      __APP_MODE__: JSON.stringify(appMode)
    },
    plugins: mainPlugins
  },
  renderer: {
    define: {
      __APP_MODE__: JSON.stringify(appMode)
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [tailwindcss(), vue()]
  }
})
