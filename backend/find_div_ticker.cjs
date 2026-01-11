
const dbBuffer = require('fs').readFileSync('data/investments.db');
const db = require('better-sqlite3')('data/investments.db');

const row = db.prepare(`
  SELECT t.ticker, t.id, count(*) as c 
  FROM dividendos d 
  JOIN tickers t ON d.ticker_id = t.id 
  GROUP BY t.id 
  ORDER BY c DESC 
  LIMIT 1
`).get();

console.log(JSON.stringify(row, null, 2));
