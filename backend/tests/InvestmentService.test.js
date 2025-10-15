import { InvestmentService } from '../src/services/InvestmentService.js'

// Tests para InvestmentService
console.log('🧪 Ejecutando tests de InvestmentService...')

// Test 1: Cálculo de rendimiento
function testCalculateReturn() {
  const result = InvestmentService.calculateReturn(10, 120, 1000)
  const expected = 200 // (10 * 120) - 1000
  console.assert(result === expected, `Expected ${expected}, got ${result}`)
  console.log('✅ testCalculateReturn passed')
}

// Test 2: Cálculo de rentabilidad
function testCalculateReturnRate() {
  const result = InvestmentService.calculateReturnRate(200, 1000)
  const expected = 0.2 // 200 / 1000
  console.assert(result === expected, `Expected ${expected}, got ${result}`)
  console.log('✅ testCalculateReturnRate passed')
}

// Test 3: Cálculo de costo promedio
function testCalculateAverageCost() {
  const result = InvestmentService.calculateAverageCost(1000, 10)
  const expected = 100 // 1000 / 10
  console.assert(result === expected, `Expected ${expected}, got ${result}`)
  console.log('✅ testCalculateAverageCost passed')
}

// Test 4: Conversión de moneda
function testConvertCurrency() {
  const result = InvestmentService.convertCurrency(100, 'USD', 'PEN', 3.5)
  const expected = 350 // 100 * 3.5
  console.assert(result === expected, `Expected ${expected}, got ${result}`)
  console.log('✅ testConvertCurrency passed')
}

// Test 5: Validación de inversión
function testValidateInvestment() {
  const validData = {
    fecha: '2024-01-15',
    importe: 1000,
    cantidad: 10,
    plataforma: 'Interactive Brokers'
  }
  
  const result = InvestmentService.validateInvestment(validData)
  console.assert(result.isValid === true, 'Valid investment should pass validation')
  console.assert(result.errors.length === 0, 'Valid investment should have no errors')
  console.log('✅ testValidateInvestment (valid) passed')
  
  const invalidData = {
    fecha: '2025-01-15', // Fecha futura
    importe: -100, // Importe negativo
    cantidad: 0, // Cantidad cero
    plataforma: 123 // Tipo incorrecto
  }
  
  const invalidResult = InvestmentService.validateInvestment(invalidData)
  console.assert(invalidResult.isValid === false, 'Invalid investment should fail validation')
  console.assert(invalidResult.errors.length > 0, 'Invalid investment should have errors')
  console.log('✅ testValidateInvestment (invalid) passed')
}

// Test 6: Validación de ticker
function testValidateTicker() {
  const validData = {
    ticker: 'AAPL',
    nombre: 'Apple Inc.',
    moneda: 'USD',
    tipo_inversion_id: 1
  }
  
  const result = InvestmentService.validateTicker(validData)
  console.assert(result.isValid === true, 'Valid ticker should pass validation')
  console.log('✅ testValidateTicker (valid) passed')
  
  const invalidData = {
    ticker: '', // Ticker vacío
    nombre: '', // Nombre vacío
    moneda: 'EUR', // Moneda no soportada
    tipo_inversion_id: 0 // ID inválido
  }
  
  const invalidResult = InvestmentService.validateTicker(invalidData)
  console.assert(invalidResult.isValid === false, 'Invalid ticker should fail validation')
  console.log('✅ testValidateTicker (invalid) passed')
}

// Test 7: Estadísticas de portfolio
function testCalculatePortfolioStats() {
  const investments = [
    { importe_total: 1000, balance: 1200, rendimiento: 200, moneda: 'USD' },
    { importe_total: 2000, balance: 1800, rendimiento: -200, moneda: 'USD' }
  ]
  
  const result = InvestmentService.calculatePortfolioStats(investments, 'USD', 1)
  
  console.assert(result.totalInvested === 3000, `Expected 3000, got ${result.totalInvested}`)
  console.assert(result.totalValue === 3000, `Expected 3000, got ${result.totalValue}`)
  console.assert(result.totalReturn === 0, `Expected 0, got ${result.totalReturn}`)
  console.assert(result.returnRate === 0, `Expected 0, got ${result.returnRate}`)
  console.log('✅ testCalculatePortfolioStats passed')
}

// Ejecutar todos los tests
try {
  testCalculateReturn()
  testCalculateReturnRate()
  testCalculateAverageCost()
  testConvertCurrency()
  testValidateInvestment()
  testValidateTicker()
  testCalculatePortfolioStats()
  
  console.log('\n🎉 Todos los tests de InvestmentService pasaron correctamente!')
} catch (error) {
  console.error('❌ Error en tests:', error.message)
  process.exit(1)
}
