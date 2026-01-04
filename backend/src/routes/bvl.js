import express from 'express'
import { request } from 'undici'

const BVL_API_BASE = 'https://dataondemand.bvl.com.pe/v1'

export function bvlRouter() {
    const r = express.Router()

    // POST /api/bvl/search - Buscar empresas en BVL
    r.post('/search', async (req, res) => {
        try {
            const { query = '' } = req.body

            const response = await request(`${BVL_API_BASE}/issuers/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    firstLetter: '',
                    sectorCode: '',
                    companyName: query
                })
            })

            if (response.statusCode !== 200) {
                return res.status(response.statusCode).json({
                    error: 'Error al consultar BVL'
                })
            }

            const data = await response.body.json()

            // Formatear respuesta para el frontend
            const results = data.map(company => ({
                rpjCode: company.companyCode,
                name: company.companyName,
                sector: company.sectorDescription,
                sectorCode: company.sectorCode,
                tickers: company.stock || [],
                indices: company.index || []
            }))

            res.json({ results })
        } catch (error) {
            console.error('Error en /api/bvl/search:', error)
            res.status(500).json({ error: error.message })
        }
    })

    // GET /api/bvl/company/:rpjCode - Info completa de empresa
    r.get('/company/:rpjCode', async (req, res) => {
        try {
            const { rpjCode } = req.params

            // Buscar por código exacto
            const response = await request(`${BVL_API_BASE}/issuers/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    firstLetter: '',
                    sectorCode: '',
                    companyName: '' // Buscar todos y filtrar por código
                })
            })

            if (response.statusCode !== 200) {
                return res.status(404).json({ error: 'Empresa no encontrada' })
            }

            const data = await response.body.json()
            const company = data.find(c => c.companyCode === rpjCode)

            if (!company) {
                return res.status(404).json({ error: 'Empresa no encontrada' })
            }

            res.json({
                rpjCode: company.companyCode,
                name: company.companyName,
                sector: company.sectorDescription,
                sectorCode: company.sectorCode,
                tickers: company.stock || [],
                indices: company.index || []
            })
        } catch (error) {
            console.error('Error en /api/bvl/company:', error)
            res.status(500).json({ error: error.message })
        }
    })

    // GET /api/bvl/corporate-actions - Eventos corporativos
    r.get('/corporate-actions', async (req, res) => {
        try {
            const {
                rpjCode,
                page = 1,
                size = 20,
                type = 1  // 1 = Hechos de Importancia
            } = req.query

            const response = await request(`${BVL_API_BASE}/corporate-actions-announcements`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    page: parseInt(page),
                    size: parseInt(size),
                    search: '',
                    type: parseInt(type)
                })
            })

            if (response.statusCode !== 200) {
                return res.status(response.statusCode).json({
                    error: 'Error al consultar eventos corporativos'
                })
            }

            const data = await response.body.json()

            // Filtrar por rpjCode si se proporciona
            let events = data.content?.importantFacts || []
            if (rpjCode) {
                events = events.filter(e => e.rpjCode === rpjCode)
            }

            res.json({
                totalElements: events.length,
                totalPages: Math.ceil(events.length / parseInt(size)),
                events: events.map(event => ({
                    id: event.correlativeCodeBVL,
                    rpjCode: event.rpjCode,
                    businessName: event.businessName,
                    date: event.sessionDate,
                    registerDate: event.registerDate,
                    session: event.session,
                    types: event.codes?.map(c => ({
                        code: c.codeHHII,
                        description: c.descCodeHHII
                    })) || [],
                    documents: event.documents?.map(d => ({
                        path: `https://www.bvl.com.pe${d.path}`,
                        sequence: d.sequence
                    })) || []
                }))
            })
        } catch (error) {
            console.error('Error en /api/bvl/corporate-actions:', error)
            res.status(500).json({ error: error.message })
        }
    })

    return r
}
