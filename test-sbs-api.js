// Test simple de la API de SBS sin dependencias externas

async function testSBSApi() {
    const url = 'https://www.sbs.gob.pe/app/pp/SISTIP_PORTAL/Paginas/Publicacion/TipoCambioPromedio.aspx'

    console.log('🔍 Probando API de SBS del Perú...\n')
    console.log('URL:', url)
    console.log('Fecha de prueba: 08/01/2026\n')

    try {
        // Primero, obtener la página inicial para extraer ViewState
        console.log('📥 Paso 1: Obteniendo página inicial para ViewState...')
        const initialResponse = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html'
            }
        })

        if (!initialResponse.ok) {
            throw new Error(`HTTP ${initialResponse.status}: ${initialResponse.statusText}`)
        }

        const initialHtml = await initialResponse.text()

        // Extraer ViewState
        const viewStateMatch = initialHtml.match(/id="__VIEWSTATE"[^>]*value="([^"]*)"/)
        const viewStateGenerator = initialHtml.match(/id="__VIEWSTATEGENERATOR"[^>]*value="([^"]*)"/)
        const eventValidation = initialHtml.match(/id="__EVENTVALIDATION"[^>]*value="([^"]*)"/)

        if (!viewStateMatch || !viewStateGenerator || !eventValidation) {
            throw new Error('No se pudieron extraer los valores de ViewState necesarios')
        }

        console.log('✅ ViewState extraído correctamente')
        console.log('   - ViewState length:', viewStateMatch[1].length, 'chars')
        console.log('   - ViewStateGenerator:', viewStateGenerator[1])
        console.log('   - EventValidation length:', eventValidation[1].length, 'chars\n')

        // Preparar el POST con ViewState
        console.log('📤 Paso 2: Enviando POST con fecha 08/01/2026...')

        const formData = new URLSearchParams({
            '__EVENTTARGET': '',
            '__EVENTARGUMENT': '',
            '__VIEWSTATE': viewStateMatch[1],
            '__VIEWSTATEGENERATOR': viewStateGenerator[1],
            '__EVENTVALIDATION': eventValidation[1],
            'ctl00$cphContent$rdpDate': '2026-01-08',
            'ctl00$cphContent$rdpDate$dateInput': '08/01/2026',
            'ctl00$cphContent$rdpDate$dateInput_ClientState': '',
            'ctl00$cphContent$rdpDate_ClientState': '',
            'ctl00$cphContent$btnConsultar': 'Consultar'
        })

        const postResponse = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
                'Origin': 'https://www.sbs.gob.pe',
                'Referer': url
            },
            body: formData.toString()
        })

        if (!postResponse.ok) {
            throw new Error(`POST failed: HTTP ${postResponse.status}`)
        }

        const responseHtml = await postResponse.text()

        console.log('✅ Respuesta recibida')
        console.log('   - Status:', postResponse.status)
        console.log('   - Content-Length:', responseHtml.length, 'chars\n')

        // Extraer datos del HTML
        console.log('🔎 Paso 3: Extrayendo datos del HTML...\n')

        // Buscar "Dólar de N.A." en la tabla
        const dolarMatch = responseHtml.match(/<td[^>]*>Dólar de N\.A\.<\/td>\s*<td[^>]*>([\d.]+)<\/td>\s*<td[^>]*>([\d.]+)<\/td>/i)

        if (dolarMatch) {
            const compra = dolarMatch[1]
            const venta = dolarMatch[2]

            console.log('✅ ÉXITO: Datos extraídos correctamente\n')
            console.log('╔═════════════════════════════════════╗')
            console.log('║  TIPO DE CAMBIO SBS - 08/01/2026    ║')
            console.log('╠═════════════════════════════════════╣')
            console.log('║  Dólar de N.A. (USD)                ║')
            console.log('║  • Compra:   S/ ' + compra.padEnd(19) + '║')
            console.log('║  • Venta:    S/ ' + venta.padEnd(19) + '║')
            console.log('╚═════════════════════════════════════╝')

            return {
                success: true,
                fecha: '08/01/2026',
                compra: parseFloat(compra),
                venta: parseFloat(venta),
                fuente: 'SBS Perú'
            }
        } else {
            console.log('⚠️  No se encontraron datos del dólar en el HTML')
            console.log('   Buscando en una muestra del contenido...')

            // Buscar cualquier tabla con números que parezcan tipos de cambio
            const tablaMatch = responseHtml.match(/<td[^>]*>(\d\.\d{3})<\/td>/g)
            if (tablaMatch) {
                console.log('   Se encontraron', tablaMatch.length, 'valores numéricos en el HTML')
                console.log('   Primeros valores:', tablaMatch.slice(0, 5).join(', '))
            }

            return {
                success: false,
                error: 'No se encontraron datos del dólar en la respuesta HTML'
            }
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message)
        return {
            success: false,
            error: error.message
        }
    }
}

// Ejecutar prueba
console.log('═══════════════════════════════════════════════')
console.log('  TEST API SBS - TIPO DE CAMBIO')
console.log('═══════════════════════════════════════════════\n')

testSBSApi().then(result => {
    console.log('\n' + '═'.repeat(47))
    console.log('📋 RESULTADO FINAL:')
    console.log('═'.repeat(47))
    console.log(JSON.stringify(result, null, 2))
    console.log('═'.repeat(47) + '\n')
    process.exit(result.success ? 0 : 1)
}).catch(err => {
    console.error('\n💥 Error inesperado:', err)
    process.exit(1)
})
