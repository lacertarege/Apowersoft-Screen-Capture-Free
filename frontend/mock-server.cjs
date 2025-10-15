// Mock server para proporcionar datos de ejemplo
const express = require('express');
const cors = require('cors');
const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Datos de ejemplo
const mockData = {
  tickers: [
    { 
      id: 1, 
      ticker: 'AAPL', 
      nombre: 'Apple Inc.', 
      tipo_inversion_id: 1, 
      tipo_inversion_nombre: 'Acciones',
      moneda: 'USD', 
      precio_reciente: 180.25, 
      importe_total: 5000, 
      cantidad_total: 30, 
      rendimiento: 405.5, 
      rentabilidad: 0.081,
      primera_compra: '2025-01-15',
      fecha: '2025-09-22',
      balance: 5405.5
    },
    { 
      id: 2, 
      ticker: 'MSFT', 
      nombre: 'Microsoft Corp.', 
      tipo_inversion_id: 1, 
      tipo_inversion_nombre: 'Acciones',
      moneda: 'USD', 
      precio_reciente: 320.15, 
      importe_total: 6000, 
      cantidad_total: 20, 
      rendimiento: 403, 
      rentabilidad: 0.067,
      primera_compra: '2025-02-10',
      fecha: '2025-09-22',
      balance: 6403
    },
    { 
      id: 3, 
      ticker: 'GOOGL', 
      nombre: 'Alphabet Inc.', 
      tipo_inversion_id: 1, 
      tipo_inversion_nombre: 'Acciones',
      moneda: 'USD', 
      precio_reciente: 140.50, 
      importe_total: 4000, 
      cantidad_total: 30, 
      rendimiento: 215, 
      rentabilidad: 0.054,
      primera_compra: '2025-03-05',
      fecha: '2025-09-22',
      balance: 4215
    },
    { 
      id: 4, 
      ticker: 'BVN', 
      nombre: 'Buenaventura', 
      tipo_inversion_id: 1, 
      tipo_inversion_nombre: 'Acciones',
      moneda: 'PEN', 
      precio_reciente: 85.20, 
      importe_total: 8000, 
      cantidad_total: 100, 
      rendimiento: 520, 
      rentabilidad: 0.065,
      primera_compra: '2025-01-20',
      fecha: '2025-09-22',
      balance: 8520
    }
  ],
  tipos: [
    { id: 1, nombre: 'Acciones', descripcion: 'Acciones de empresas' },
    { id: 2, nombre: 'ETFs', descripcion: 'Exchange Traded Funds' },
    { id: 3, nombre: 'Bonos', descripcion: 'Bonos gubernamentales y corporativos' }
  ],
  presupuesto: {
    id: 1,
    nombre: 'Presupuesto de Inversiones',
    version: '1.0.0',
    monto_pen: 10000,
    monto_usd: 5000
  },
  historicos: {
    1: [
      { fecha: '2025-09-20', precio: 178.25, fuente_api: 'mock' },
      { fecha: '2025-09-21', precio: 179.50, fuente_api: 'mock' },
      { fecha: '2025-09-22', precio: 180.25, fuente_api: 'mock' }
    ]
  }
};

// Rutas
app.get('/tickers', (req, res) => {
  res.json({ items: mockData.tickers });
});

app.get('/config/tipos-inversion', (req, res) => {
  res.json({ items: mockData.tipos });
});

app.get('/config/presupuesto', (req, res) => {
  res.json({ item: mockData.presupuesto });
});

app.get('/historicos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  res.json({ items: mockData.historicos[id] || [] });
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`Mock server running at http://localhost:${port}`);
});