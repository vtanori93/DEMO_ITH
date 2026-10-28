import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { getAllowedHosts, getPublicOrigin } from './config/network.ts'
import { gatewayPlugin } from './server/vite-gateway.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const allowedHosts = getAllowedHosts(env.NGROK_HOST)
  const publicOrigin = getPublicOrigin(env.NGROK_URL)
  return {
    plugins: [react(), gatewayPlugin({}, publicOrigin)],
    server: { host: '0.0.0.0', port: 5173, strictPort: true, allowedHosts },
    preview: { host: '0.0.0.0', port: 4173, strictPort: true, allowedHosts },
  }
})
