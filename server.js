require('dotenv').config();

const express = require('express');
const path = require('path');
const database = require('./src/database');
const { calculate } = require('./src/circuit');

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', async (_request, response) => {
  response.json({ database: await database.health() });
});

app.post('/api/calculate', async (request, response) => {
  try {
    const payload = request.body;
    const result = calculate(payload);
    let runId = null;
    let saved = false;
    let saveWarning = null;
    try {
      runId = await database.saveRun({
        name: String(payload.name || 'Circuito sin nombre').trim().slice(0, 120),
        frequency: result.frequency,
        source: payload.source,
        circuit: payload.circuit,
        result
      });
      saved = Boolean(runId);
    } catch (error) {
      saveWarning = 'Cálculo realizado, pero no se pudo guardar en MySQL.';
      console.error('No se pudo guardar el cálculo:', error.message);
    }
    response.json({ result, runId, saved, saveWarning });
  } catch (error) {
    response.status(400).json({ error: error.message || 'No se pudo calcular el circuito.' });
  }
});

app.get('/api/history', async (_request, response) => {
  try {
    response.json({ runs: await database.listRuns() });
  } catch (error) {
    response.status(503).json({ error: error.message || 'No se pudo cargar el historial.' });
  }
});

app.get('*', (_request, response) => {
  response.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, async () => {
  try {
    await database.initialize();
    console.log(`Analizador RLC disponible en http://localhost:${port}`);
    console.log(database.configured ? 'MySQL conectado; tabla circuit_runs lista.' : 'MySQL sin configurar; los cálculos no se guardarán.');
  } catch (error) {
    console.error('MySQL no está disponible; los cálculos seguirán funcionando sin historial:', error.message);
    console.log(`Analizador RLC disponible en http://localhost:${port}`);
  }
});