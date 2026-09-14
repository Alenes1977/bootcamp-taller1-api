import express from 'express'
import { assertBootConfig, config } from './config.js'
import { getDb } from './db.js'
import { registerAdminRoutes } from './routes/admin.js'
import { registerResultsRoutes } from './routes/results.js'
import { registerWebhookRoutes } from './routes/webhook.js'

assertBootConfig()
getDb()

const app = express()
app.set('trust proxy', 1)
app.use(express.json({ limit: '1mb' }))

app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', config.corsOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (_req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }
  next()
})

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', version: '1.0.0', service: 'bootcamp-taller1-api' })
})

registerWebhookRoutes(app)
registerResultsRoutes(app)
registerAdminRoutes(app)

app.use((_req, res) => {
  res.status(404).json({ error: 'No encontrado' })
})

app.listen(config.port, () => {
  console.log(`bootcamp-taller1-api escuchando en :${config.port}`)
})
