export default async function migrate(db){
  // tipos_inversion
  db.prepare(`CREATE TABLE IF NOT EXISTS tipos_inversion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1
  )`).run()

  // tickers
  db.prepare(`CREATE TABLE IF NOT EXISTS tickers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    moneda TEXT NOT NULL CHECK (moneda IN ('USD','PEN')),
    tipo_inversion_id INTEGER NOT NULL,
    estado TEXT DEFAULT 'activo',
    FOREIGN KEY (tipo_inversion_id) REFERENCES tipos_inversion(id)
  )`).run()

  // inversiones
  db.prepare(`CREATE TABLE IF NOT EXISTS inversiones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    importe NUMERIC(14,2) NOT NULL,
    cantidad NUMERIC(14,6) NOT NULL,
    apertura_guardada NUMERIC(14,6) NOT NULL,
    plataforma TEXT,
    FOREIGN KEY (ticker_id) REFERENCES tickers(id)
  )`).run()
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_inversiones_ticker_fecha ON inversiones(ticker_id, fecha)`).run()

  // precios_historicos
  db.prepare(`CREATE TABLE IF NOT EXISTS precios_historicos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    precio NUMERIC(14,6) NOT NULL,
    fuente_api TEXT,
    updated_at TEXT NOT NULL,
    UNIQUE (ticker_id, fecha),
    FOREIGN KEY (ticker_id) REFERENCES tickers(id)
  )`).run()
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_precios_ticker_fecha ON precios_historicos(ticker_id, fecha)`).run()

  // tipos_cambio
  db.prepare(`CREATE TABLE IF NOT EXISTS tipos_cambio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL UNIQUE,
    usd_pen NUMERIC(14,6) NOT NULL,
    fuente_api TEXT
  )`).run()

  // dividendos
  db.prepare(`CREATE TABLE IF NOT EXISTS dividendos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    monto NUMERIC(14,6) NOT NULL,
    moneda TEXT NOT NULL,
    mercado TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (ticker_id) REFERENCES tickers(id) ON DELETE CASCADE,
    UNIQUE(ticker_id, fecha)
  )`).run()
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_dividendos_ticker_id ON dividendos(ticker_id)`).run()
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_dividendos_fecha ON dividendos(fecha)`).run()

  // Agregar columna mercado a dividendos si no existe
  try {
    db.prepare(`ALTER TABLE dividendos ADD COLUMN mercado TEXT`).run()
  } catch (e) {
    // Columna ya existe, ignorar error
    if (!e.message.includes('duplicate column name')) {
      throw e
    }
  }

  // Vista resumen mejorada con cálculos más robustos
  db.prepare(`DROP VIEW IF EXISTS v_resumen_empresas`).run()
  db.prepare(`CREATE VIEW v_resumen_empresas AS
    WITH agg AS (
      SELECT t.id as ticker_id, t.ticker, t.nombre, t.moneda, t.tipo_inversion_id,
             COALESCE(SUM(i.importe), 0) AS importe_total,
             COALESCE(SUM(i.cantidad), 0) AS cantidad_total,
             MIN(i.fecha) AS primera_compra
      FROM tickers t
      LEFT JOIN inversiones i ON i.ticker_id = t.id
      GROUP BY t.id
    ), precio_rec AS (
      SELECT ph.ticker_id, MAX(ph.fecha) AS fecha_rec
      FROM precios_historicos ph
      GROUP BY ph.ticker_id
    ), precio_val AS (
      SELECT ph.ticker_id, ph.precio, pr.fecha_rec
      FROM precios_historicos ph
      JOIN precio_rec pr ON pr.ticker_id = ph.ticker_id AND pr.fecha_rec = ph.fecha
    )
    SELECT 
      a.ticker_id as id, 
      a.ticker, 
      a.nombre, 
      a.moneda,
      a.tipo_inversion_id,
      ti.nombre AS tipo_inversion_nombre,
      a.primera_compra,
      a.importe_total,
      a.cantidad_total,
      pv.fecha_rec AS fecha,
      COALESCE(pv.precio, 0) AS precio_reciente,
      ROUND(a.cantidad_total * COALESCE(pv.precio, 0), 2) AS balance,
      ROUND((a.cantidad_total * COALESCE(pv.precio, 0)) - a.importe_total, 2) AS rendimiento,
      CASE 
        WHEN a.importe_total = 0 THEN 0 
        ELSE ROUND(((a.cantidad_total * COALESCE(pv.precio, 0)) - a.importe_total) / a.importe_total, 4) 
      END AS rentabilidad
    FROM agg a
    LEFT JOIN precio_val pv ON pv.ticker_id = a.ticker_id
    LEFT JOIN tipos_inversion ti ON ti.id = a.tipo_inversion_id
  `).run()

  // Agregar restricción única para evitar duplicados en inversiones
  db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_inversiones_unique ON inversiones(ticker_id, fecha, importe, cantidad, plataforma)`).run()
}