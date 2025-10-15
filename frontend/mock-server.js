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
    { id: 1, ticker: 'AAPL', nombre: 'Apple Inc.', tipo_id: 1, moneda: 'USD', precio: 180.25, rendimiento: 1.5, rentabilidad: 2.3 },
    { id: 2, ticker: 'MSFT', nombre: 'Microsoft Corp.', tipo_id: 1, moneda: 'USD', precio: 320.15, rendimiento: 0.8, rentabilidad: 1.7 },
    { id: 3, ticker: 'GOOGL', nombre: 'Alphabet Inc.', tipo_id: 1, moneda: 'USD', precio: 140.50, rendimiento: -0.3, rentabilidad: -0.5 }
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