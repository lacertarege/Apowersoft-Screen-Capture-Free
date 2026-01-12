import express from 'express'
import logger from '../utils/logger.js'

export function bvlRouter(db) {
    const r = express.Router()

    // POST /api/bvl/search - Buscar empresas en caché local
    r.post('/search', async (req, res) => {
        try {
            const { query = '' } = req.body

            if (!query || query.length < 2) {
                return res.json({ results: [] })
            }

            // Buscar en caché local
            const results = db.prepare(`
        SELECT 
          rpj_code as rpjCode,
          company_name as name,
          sector_code as sectorCode,
          sector_description as sector,
          stock as tickers,
          indices
        FROM bvl_companies
        WHERE 
          company_name LIKE ? OR
          stock LIKE ?
        LIMIT 20
      `).all(`%${query}%`, `%${query}%`)

            // Parsear JSON fields
            const formatted = results.map(r => ({
                ...r,
                tickers: JSON.parse(r.tickers || '[]'),
                indices: JSON.parse(r.indices || '[]')
            }))

            res.json({ results: formatted })
        } catch (error) {
            logger.error('BVL search error', { error: error.message })
            res.status(500).json({ error: error.message })
        }
    })

    // GET /api/bvl/company/:rpjCode - Info completa de empresa desde caché
    r.get('/company/:rpjCode', async (req, res) => {
        try {
            const { rpjCode } = req.params

            const company = db.prepare(`
        SELECT 
          rpj_code as rpjCode,
          company_name as name,
          sector_code as sectorCode,
          sector_description as sector,
          stock as tickers,
          indices
        FROM bvl_companies
        WHERE rpj_code = ?
      `).get(rpjCode)

            if (!company) {
                return res.status(404).json({ error: 'Empresa no encontrada' })
            }

            // Parsear JSON
            res.json({
                ...company,
                tickers: JSON.parse(company.tickers || '[]'),
                indices: JSON.parse(company.indices || '[]')
            })
        } catch (error) {
            logger.error('BVL company lookup error', { error: error.message })
            res.status(500).json({ error: error.message })
        }
    })

    // GET /api/bvl/corporate-actions - Eventos corporativos desde caché
    r.get('/corporate-actions', async (req, res) => {
        try {
            const {
                rpjCode,
                page = 1,
                size = 20
            } = req.query

            const offset = (parseInt(page) - 1) * parseInt(size)

            // Por ahora devolver array vacío ya que no tenemos eventos en caché
            // TODO: Agregar script para importar eventos desde BVL API

            if (!rpjCode) {
                return res.json({
                    totalElements: 0,
                    totalPages: 0,
                    events: []
                })
            }

            const events = db.prepare(`
        SELECT 
          id,
          rpj_code as rpjCode,
          business_name as businessName,
          event_date as date,
          register_date as registerDate,
          session,
          event_types as types,
          documents
        FROM bvl_corporate_events
        WHERE rpj_code = ?
        ORDER BY event_date DESC
        LIMIT ? OFFSET ?
      `).all(rpjCode, parseInt(size), offset)

            const total = db.prepare(`
        SELECT COUNT(*) as count
        FROM bvl_corporate_events
        WHERE rpj_code = ?
      `).get(rpjCode).count

            // Parsear JSON fields
            const formatted = events.map(e => ({
                ...e,
                types: JSON.parse(e.types || '[]'),
                documents: JSON.parse(e.documents || '[]')
            }))

            res.json({
                totalElements: total,
                totalPages: Math.ceil(total / parseInt(size)),
                events: formatted
            })
        } catch (error) {
            logger.error('BVL corporate actions error', { error: error.message })
            res.status(500).json({ error: error.message })
        }
    })

    // GET /api/bvl/benefits/:rpjCode - Beneficios/Dividendos con caché lazy
    r.get('/benefits/:rpjCode', async (req, res) => {
        try {
            const { rpjCode } = req.params

            // 1. Primero buscar en caché local
            const cached = db.prepare(`
        SELECT 
          ticker, isin, value_type, benefit_type as type,
          amount, currency, record_date as recordDate,
          payment_date as paymentDate, ex_date as exDate
        FROM bvl_benefits
        WHERE rpj_code = ?
        ORDER BY payment_date DESC
      `).all(rpjCode)

            if (cached && cached.length > 0) {
                logger.debug('BVL benefits from cache', { rpjCode, count: cached.length })
                return res.json({ benefits: cached, cached: true })
            }

            // 2. Si no está en caché, consultar BVL API
            logger.debug('Fetching BVL benefits from API', { rpjCode })
            const { request } = await import('undici')
            const response = await request(`https://dataondemand.bvl.com.pe/v1/issuers/${rpjCode}/value`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            })

            if (response.statusCode !== 200) {
                return res.status(404).json({ error: 'No se encontraron beneficios' })
            }

            const data = await response.body.json()
            const benefits = []

            // 3. Extraer y guardar en caché
            if (data.fixedValues && Array.isArray(data.fixedValues)) {
                const insertBenefit = db.prepare(`
          INSERT INTO bvl_benefits 
          (rpj_code, ticker, isin, value_type, benefit_type, amount, currency, record_date, payment_date, ex_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)

                const transaction = db.transaction((values) => {
                    for (const value of values) {
                        if (value.listBenefit && value.listBenefit.length > 0) {
                            for (const benefit of value.listBenefit) {
                                insertBenefit.run(
                                    rpjCode,
                                    value.nemonico || null,
                                    value.isin || null,
                                    value.valueType || null,
                                    benefit.typeBenefit || 'Dividendo',
                                    benefit.benefit || null,
                                    benefit.currency || null,
                                    benefit.recordDate || null,
                                    benefit.paymentDate || null,
                                    benefit.exDate || null
                                )

                                benefits.push({
                                    ticker: value.nemonico,
                                    isin: value.isin,
                                    type: benefit.typeBenefit || 'Dividendo',
                                    amount: benefit.benefit,
                                    currency: benefit.currency,
                                    recordDate: benefit.recordDate,
                                    paymentDate: benefit.paymentDate,
                                    exDate: benefit.exDate
                                })
                            }
                        }
                    }
                })

                transaction(data.fixedValues)
                logger.info('BVL benefits cached', { rpjCode, count: benefits.length })
            }

            res.json({ benefits, cached: false })
        } catch (error) {
            logger.error('BVL benefits error', { rpjCode: req.params.rpjCode, error: error.message })
            res.status(500).json({ error: error.message })
        }
    })

    return r
}
