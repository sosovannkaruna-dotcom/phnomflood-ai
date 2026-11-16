import { existsSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Serves the Vercel functions in /api during `npm run dev` (photo check, open data feed,
 * AI briefing), so the live app works locally too. Server-only secrets (GEMINI_API_KEY) come
 * from .env and never reach the browser bundle, which only sees VITE_ variables.
 */
function localApi(env) {
  return {
    name: 'local-api',
    configureServer(server) {
      for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v
      server.middlewares.use('/api', async (req, res, next) => {
        const name = (req.url ?? '').split('?')[0].replace(/^\/+|\/+$/g, '')
        // Files starting with "_" are shared helpers, not routes (the same rule Vercel uses).
        if (!/^[a-z0-9-]+$/.test(name) || !existsSync(`api/${name}.js`)) return next()
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        const raw = Buffer.concat(chunks).toString('utf8')
        const { default: handler } = await server.ssrLoadModule(`/api/${name}.js`)
        const shim = {
          statusCode: 200,
          setHeader: (k, v) => res.setHeader(k, v),
          status(code) {
            this.statusCode = code
            return this
          },
          json(data) {
            res.statusCode = this.statusCode
            if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(data))
          },
          send(body) {
            res.statusCode = this.statusCode
            res.end(body)
          },
          end(body) {
            res.statusCode = this.statusCode
            res.end(body)
          },
        }
        let body = {}
        try {
          body = raw ? JSON.parse(raw) : {}
        } catch {
          body = raw
        }
        // Vercel passes the original URL (with its query string) to the function.
        await handler({ method: req.method, url: req.originalUrl ?? req.url, headers: req.headers, socket: req.socket, body }, shim)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), localApi(env)],
    server: { port: 5173, open: false, watch: { ignored: ['**/.impeccable/**'] } },
  }
})
