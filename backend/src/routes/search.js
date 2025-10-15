import express from 'express'
import { searchSymbols } from '../sources/marketData.js'

export function searchRouter(db){
  const r = express.Router()
  r.get('/symbols', async (req,res)=>{
    const q = req.query.q || ''
    const { items, source } = await searchSymbols(q)
    res.json({ items, source })
  })
  return r
}