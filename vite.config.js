import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const isTauri = !!process.env.TAURI_ENV_PLATFORM
  const base =
    command === 'build' && !isTauri ? (process.env.BASE_URL ?? '/') : '/'

  return {
    base,
  // 防止 Vite 清除 Rust 显示的错误
  clearScreen: false,
  server: {
    // Tauri 工作于固定端口，如果端口不可用则报错
    strictPort: isTauri,
    // 如果设置了 host，Tauri 则会使用
    host: 'localhost',
    port: 5173,
    proxy: {
      '/msil': {
        target: 'https://www.msil.go.jp',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/msil/, ''),
      },
      '/iris': {
        target: 'https://service.iris.edu',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/iris/, ''),
      },
      '/exptech-api-1': {
        target: 'https://api-1.exptech.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/exptech-api-1/, ''),
      },
      '/exptech-api-2': {
        target: 'https://api-2.exptech.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/exptech-api-2/, ''),
      },
      '/exptech-lb-1': {
        target: 'https://lb-1.exptech.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/exptech-lb-1/, ''),
      },
      '/exptech-lb-2': {
        target: 'https://lb-2.exptech.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/exptech-lb-2/, ''),
      },
      '/exptech-lb-3': {
        target: 'https://lb-3.exptech.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/exptech-lb-3/, ''),
      },
      '/exptech-lb-4': {
        target: 'https://lb-4.exptech.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/exptech-lb-4/, ''),
      },
    },
  },
  // 添加有关当前构建目标的额外前缀，使这些 CLI 设置的 Tauri 环境变量可以在客户端代码中访问
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    // Tauri 在 Windows 上使用 Chromium，在 macOS 和 Linux 上使用 WebKit
    target:
      process.env.TAURI_ENV_PLATFORM == 'windows'
        ? 'chrome105'
        : 'safari13',
    // 在 debug 构建中不使用 minify
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    // 在 debug 构建中生成 sourcemap
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
  plugins: [
    vue(),
    // Web (PWA) 向け。Tauri ビルドでは Service Worker によるキャッシュが
    // 更新挙動に影響しやすいので無効化する。
    ...(!process.env.TAURI_ENV_PLATFORM
      ? [
          VitePWA({
            registerType: 'autoUpdate',
            injectRegister: 'auto',
            includeAssets: ['favicon.ico'],
            workbox: {
              maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
            },
            manifest: {
              name: '要石 kanameishi',
              short_name: 'kanameishi',
              start_url: '/',
              scope: '/',
              display: 'standalone',
              icons: [
                {
                  src: 'pwa-128.png',
                  sizes: '128x128',
                  type: 'image/png',
                  purpose: 'any maskable',
                },
                {
                  src: 'pwa-256.png',
                  sizes: '256x256',
                  type: 'image/png',
                  purpose: 'any maskable',
                },
                {
                  src: 'pwa-512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'any maskable',
                },
              ],
            },
          }),
        ]
      : []),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      imports: ['vue', 'vue-router'],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
  }
})
