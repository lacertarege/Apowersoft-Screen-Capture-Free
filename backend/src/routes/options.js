import express from 'express'
import { fetchOptionsChain } from '../sources/optionsProvider.js'

export function optionsRouter(db){
  const r = express.Router()

  r.get('/:symbol', async (req,res)=>{
    try{
      const symbol = String(req.params.symbol || '').trim().toUpperCase()
      if (!symbol) return res.status(400).json({ error: 'Símbolo requerido' })
      const data = await fetchOptionsChain(symbol)
      res.json(data)
    } catch (e){
      const status = e?.statusCode && Number(e.statusCode) >= 400 ? Number(e.statusCode) : 500
      res.status(status).json({ error: e.message || 'Error consultando opciones' })
    }
  })

  return r
}