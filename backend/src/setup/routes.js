import { tickersRouter } from '../routes/tickers.js'
import cors from 'cors'
import { inversionesRouter } from '../routes/inversiones.js'
import { searchRouter } from '../routes/search.js'
import { historicosRouter } from '../routes/historicos.js'
import { dashboardRouter } from '../routes/dashboard.js'
import { configRouter } from '../routes/config.js'
import { optionsRouter } from '../routes/options.js'
import { dividendosRouter } from '../routes/dividendos.js'
import { tiposInversionRouter } from '../routes/tiposInversion.js'
import { bvlRouter } from '../routes/bvl.js'
import { plataformasRouter } from '../routes/plataformas.js'
import { exchangesRouter } from '../routes/exchanges.js'
import { sectoresRouter } from '../routes/sectores.js'

export function buildRoutes(app, db) {
  // Configuración CORS mejorada con paquete 'cors'
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000'
  ]

  app.use(cors({
    origin: function (origin, callback) {
      // Permitir request sin origin (como mobile apps o curl)
      if (!origin) return callback(null, true)
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400 // 24 hours
  }))

  // Middleware de logging para debugging
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
    next()
  })
  app.use('/tickers', tickersRouter(db))
  app.use('/inversiones', inversionesRouter(db))
  app.use('/search', searchRouter(db))
  app.use('/historicos', historicosRouter(db))
  app.use('/dashboard', dashboardRouter(db))
  app.use('/config', configRouter(db))
  app.use('/options', optionsRouter(db))
  app.use('/dividendos', dividendosRouter(db))
  app.use('/tipos-inversion', tiposInversionRouter(db))
  app.use('/bvl', bvlRouter(db))
  app.use('/plataformas', plataformasRouter(db))
  app.use('/exchanges', exchangesRouter(db))
  app.use('/sectores', sectoresRouter(db))
  app.get('/health', (req, res) => res.json({ ok: true }))
}