
import { request } from 'undici'
import { strict as assert } from 'assert'

const BASE_URL = 'http://localhost:3001'

async function checkRateLimit() {
    console.log('--- Testing Rate Limit (20 req/s) ---')
    let blocked = false
    for (let i = 1; i <= 25; i++) {
        try {
            const { statusCode } = await request(`${BASE_URL}/health`)
            process.stdout.write(statusCode === 429 ? 'X' : '.')
            if (statusCode === 429) blocked = true
        } catch (e) {
            console.error(e.message)
        }
    }
    console.log('\n')
    if (blocked) console.log('✅ Rate Limit functioning (caught 429)')
    else console.error('❌ Rate Limit FAILED (did not catch 429)')
}

async function checkCORS() {
    console.log('--- Testing CORS ---')
    const { headers, statusCode } = await request(`${BASE_URL}/health`, {
        method: 'OPTIONS',
        headers: {
            'Origin': 'http://localhost:5173',
            'Access-Control-Request-Method': 'GET'
        }
    })

    // CORS middleware sends 204 for OPTIONS
    if (statusCode === 204 || statusCode === 200) {
        if (headers['access-control-allow-origin'] === 'http://localhost:5173') {
            console.log('✅ CORS Valid for Allowed Origin')
        } else {
            console.error(`❌ CORS Header missing or wrong: ${headers['access-control-allow-origin']}`)
        }
    } else {
        console.error(`❌ CORS OPTIONS request failed with ${statusCode}`)
    }

    // Test blocked origin
    const blocked = await request(`${BASE_URL}/health`, {
        method: 'OPTIONS',
        headers: { 'Origin': 'http://evil.com' }
    })

    if (!blocked.headers['access-control-allow-origin']) {
        console.log('✅ CORS Blocked Evil Origin (No Allow Header)')
    } else {
        console.error('❌ CORS Failed to block evil origin')
    }
}

async function run() {
    try {
        await checkCORS()
        await checkRateLimit()
    } catch (err) {
        console.error(err)
    }
}

run()
