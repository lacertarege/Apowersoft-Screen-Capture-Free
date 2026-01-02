
import { createDb } from './src/setup/db.js'
import { request } from 'undici'

const dbPath = process.env.DB_PATH || './data/investments.db'
const db = createDb(dbPath)

async function run() {
    // 1. Find a ticker with investments
    const ticker = db.prepare('SELECT id, ticker FROM tickers WHERE id IN (SELECT ticker_id FROM inversiones) LIMIT 1').get()

    if (!ticker) {
        console.log('No tickers with investments found.')
        return
    }

    console.log(`Testing evolution for Ticker: ${ticker.ticker} (ID: ${ticker.id})`)

    // 2. Fetch from running API
    try {
        const { statusCode, body } = await request(`http://localhost:3002/tickers/${ticker.id}/evolucion`)
        console.log(`HTTP Status: ${statusCode}`)
        const data = await body.json()
        console.log('Keys in response:', Object.keys(data))

        if (data.meses) {
            console.log(`Meses count: ${data.meses.length}`)
            console.log('Meses:', data.meses.map(m => m.mesKey).join(', '))
        }

        if (data.items && data.items.length > 0) {
            console.log(`Items count: ${data.items.length}`)
            console.log(`First item date: ${data.items[0].fecha}`)
            console.log(`First item Vi: ${data.items[0].valorInicial}`)
        } else {
            console.log('No items found.')
        }

        // Si hay meses, pedir detalle del primer mes
        if (data.meses && data.meses.length > 0) {
            const { mes, año } = data.meses[0]
            console.log(`Fetching detail for ${mes}/${año}`)
            const r2 = await request(`http://localhost:3002/tickers/${ticker.id}/evolucion?mes=${mes}&año=${año}`)
            const d2 = await r2.body.json()
            console.log(`Items detail count: ${d2.items?.length}`)
        }

    } catch (e) {
        console.error('Request failed:', e)
    }
}

run()
