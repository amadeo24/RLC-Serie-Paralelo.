const mysql = require('mysql2/promise');

const configured = Boolean(process.env.MYSQL_HOST && process.env.MYSQL_DATABASE && process.env.MYSQL_USER);
const pool = configured ? mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 5,
  decimalNumbers: true
}) : null;

async function initialize() {
  if (!pool) return false;
  await pool.query(`CREATE TABLE IF NOT EXISTS circuit_runs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    frequency_hz DOUBLE NOT NULL,
    source_voltage JSON NOT NULL,
    circuit JSON NOT NULL,
    result JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  return true;
}

async function health() {
  if (!pool) return 'unconfigured';
  try {
    await pool.query('SELECT 1');
    return 'connected';
  } catch {
    return 'unavailable';
  }
}

async function saveRun({ name, frequency, source, circuit, result }) {
  if (!pool) return null;
  const [insert] = await pool.execute(
    'INSERT INTO circuit_runs (name, frequency_hz, source_voltage, circuit, result) VALUES (?, ?, ?, ?, ?)',
    [name, frequency, JSON.stringify(source), JSON.stringify(circuit), JSON.stringify(result)]
  );
  return insert.insertId.toString();
}

async function listRuns() {
  if (!pool) throw new Error('MySQL no está configurado.');
  const [rows] = await pool.query(
    'SELECT id, name, frequency_hz, source_voltage, circuit, created_at, result FROM circuit_runs ORDER BY created_at DESC LIMIT 20'
  );
  return rows;
}

module.exports = { initialize, listRuns, saveRun, health };