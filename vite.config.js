import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import scorecardHandler from './api/scorecard.js'

function vercelStyleRes(res) {
  return {
    status(code) {
      res.statusCode = code
      return this
    },
    json(payload) {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(payload))
    },
  }
}

function localScorecardApi(env) {
  return {
    name: 'local-scorecard-api',
    configureServer(server) {
      server.middlewares.use('/api/scorecard', (req, res) => {
        if (env.SCORECARD_API_KEY) process.env.SCORECARD_API_KEY = env.SCORECARD_API_KEY
        if (req.method !== 'POST') {
          scorecardHandler({ method: req.method, body: {} }, vercelStyleRes(res))
          return
        }
        const chunks = []
        req.on('data', (chunk) => chunks.push(chunk))
        req.on('end', async () => {
          try {
            const raw = Buffer.concat(chunks).toString('utf8')
            const body = raw ? JSON.parse(raw) : {}
            await scorecardHandler({ method: 'POST', body }, vercelStyleRes(res))
          } catch (err) {
            console.error('[vite /api/scorecard]', err)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'local_api_failed' }))
          }
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), localScorecardApi(env)],
  }
})
