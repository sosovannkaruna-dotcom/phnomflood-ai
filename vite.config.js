import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Serves the Vercel functions in /api during `npm run dev`, so the live app's photo check
 * works locally too. Server-only secrets (GEMINI_API_KEY) come from .env and never reach
 * the browser bundle, which only sees VITE_ variables.
 */
function localApi(env) {
  return {
    name: 'local-api',
    configureServer(server) {
      for (const [k, v] of Object.entries(env)) if (!k.startsWith('VITE_') && process.env[k] === undefined) process.env[k] = v
      server.middlewares.use('/api/verify-photo', async (req, res) => {
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        const raw = Buffer.concat(chunks).toString('utf8')
        const { default: handler } = await server.ssrLoadModule('/api/verify-photo.js')
        const shim = {
          statusCode: 200,
          setHeader: (k, v) => res.setHeader(k, v),
          status(code) {
            this.statusCode = code
            return this
          },
          json(data) {
            res.statusCode = this.statusCode
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(data))
          },
        }
        await handler({ method: req.method, headers: req.headers, socket: req.socket, body: raw ? JSON.parse(raw) : {} }, shim)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), localApi(env)],
    server: { port: 5173, open: false },
  }
})
