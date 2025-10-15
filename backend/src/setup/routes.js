import { tickersRouter } from '../routes/tickers.js'
import { inversionesRouter } from '../routes/inversiones.js'
import { searchRouter } from '../routes/search.js'
import { historicosRouter } from '../routes/historicos.js'
import { dashboardRouter } from '../routes/dashboard.js'
import { configRouter } from '../routes/config.js'
import { optionsRouter } from '../routes/options.js'
import { dividendosRouter } from '../routes/dividendos.js'
import { tiposInversionRouter } from '../routes/tiposInversion.js'

export function buildRoutes(app, db){
  // Configuración CORS mejorada
  app.use((req,res,next)=>{
    const origin = req.headers.origin
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000'
    ]
    
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
    }
    
    res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization, X-Requested-With')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Max-Age', '86400')
    
    if(req.method==='OPTIONS') return res.sendStatus(200)
    next()
  })
  
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
  app.get('/health', (req,res)=>res.json({ok:true}))
}