const unitOptions = {
  R: [['ohm', 'Ω'], ['kohm', 'kΩ'], ['Mohm', 'MΩ']],
  L: [['H', 'H'], ['mH', 'mH'], ['uH', 'µH']],
  C: [['F', 'F'], ['uF', 'µF'], ['nF', 'nF'], ['pF', 'pF']]
};
const componentNames = { R: 'Resistencia', L: 'Inductancia', C: 'Capacitancia' };
const symbols = { R: 'Ω', L: 'L', C: 'C' };
const state = {
  circuit: {
    id: crypto.randomUUID(), type: 'group', mode: 'series', children: [
      { id: crypto.randomUUID(), type: 'R', value: 100, unit: 'ohm' },
      { id: crypto.randomUUID(), type: 'L', value: 100, unit: 'mH' },
      { id: crypto.randomUUID(), type: 'C', value: 10, unit: 'uF' }
    ]
  },
  result: null,
  toastTimer: null
};

const treeElement = document.querySelector('#circuit-tree');
const resultsElement = document.querySelector('#results-content');
const formElement = document.querySelector('#circuit-form');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function renderNode(node, root = false) {
  if (node.type === 'group') {
    const children = node.children.map((child) => renderNode(child)).join('');
    return `<section class="network-node ${root ? 'root-network' : ''}" data-node-id="${node.id}">
      <div class="group-heading"><span class="group-symbol" aria-hidden="true">${node.mode === 'series' ? '—' : '∥'}</span>
        <span class="group-title">${root ? 'RED PRINCIPAL' : 'SUBRED'}</span>
        <select class="mode-select" data-action="mode" aria-label="Conexión del grupo">
          <option value="series" ${node.mode === 'series' ? 'selected' : ''}>Serie</option>
          <option value="parallel" ${node.mode === 'parallel' ? 'selected' : ''}>Paralelo</option>
        </select>
        ${root ? '' : '<button class="remove-button" type="button" data-action="remove" aria-label="Eliminar subred" title="Eliminar subred">×</button>'}
      </div>
      <div class="children-list">${children || '<span class="model-note">Añade componentes a esta subred.</span>'}</div>
      <div class="node-actions">
        <button class="add-button" type="button" data-action="add-component" data-kind="R">+ Resistencia</button>
        <button class="add-button" type="button" data-action="add-component" data-kind="L">+ Bobina</button>
        <button class="add-button" type="button" data-action="add-component" data-kind="C">+ Condensador</button>
        <button class="add-button" type="button" data-action="add-group">+ Subred</button>
      </div>
    </section>`;
  }

  const options = unitOptions[node.type].map(([value, label]) =>
    `<option value="${value}" ${node.unit === value ? 'selected' : ''}>${label}</option>`
  ).join('');
  return `<div class="component-row" data-node-id="${node.id}" data-kind="${node.type}">
    <span class="component-symbol" aria-hidden="true">${node.type}</span>
    <label class="sr-only" for="value-${node.id}">${componentNames[node.type]}</label>
    <input class="component-input" id="value-${node.id}" type="number" min="0" step="any" value="${node.value}" data-action="value" aria-label="Valor de ${componentNames[node.type]}" required>
    <select class="unit-select" data-action="unit" aria-label="Unidad de ${componentNames[node.type]}">${options}</select>
    <button class="remove-button" type="button" data-action="remove" aria-label="Eliminar ${componentNames[node.type]}" title="Eliminar componente">×</button>
  </div>`;
}

function renderTree() {
  treeElement.innerHTML = renderNode(state.circuit, true);
}

function findNode(id, node = state.circuit) {
  if (node.id === id) return node;
  if (node.type === 'group') {
    for (const child of node.children) {
      const found = findNode(id, child);
      if (found) return found;
    }
  }
  return null;
}

function removeNode(id, parent = state.circuit) {
  const index = parent.children.findIndex((child) => child.id === id);
  if (index >= 0) {
    parent.children.splice(index, 1);
    return true;
  }
  for (const child of parent.children) {
    if (child.type === 'group' && removeNode(id, child)) return true;
  }
  return false;
}

function makeComponent(type) {
  const defaults = { R: [100, 'ohm'], L: [100, 'mH'], C: [10, 'uF'] };
  return { id: crypto.randomUUID(), type, value: defaults[type][0], unit: defaults[type][1] };
}

treeElement.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const holder = button.closest('[data-node-id]');
  const node = holder && findNode(holder.dataset.nodeId);
  if (!node) return;

  if (button.dataset.action === 'add-component') node.children.push(makeComponent(button.dataset.kind));
  if (button.dataset.action === 'add-group') node.children.push({ id: crypto.randomUUID(), type: 'group', mode: 'series', children: [] });
  if (button.dataset.action === 'remove') removeNode(node.id);
  renderTree();
});

treeElement.addEventListener('change', (event) => {
  const control = event.target.closest('[data-action]');
  if (!control) return;
  const holder = control.closest('[data-node-id]');
  const node = holder && findNode(holder.dataset.nodeId);
  if (!node) return;
  if (control.dataset.action === 'mode') node.mode = control.value;
  if (control.dataset.action === 'unit') node.unit = control.value;
  if (control.dataset.action === 'value') node.value = Number(control.value);
  renderTree();
});

treeElement.addEventListener('input', (event) => {
  const control = event.target.closest('[data-action="value"]');
  if (!control) return;
  const node = findNode(control.closest('[data-node-id]').dataset.nodeId);
  if (node) node.value = Number(control.value);
});

function formatNumber(number, digits = 5) {
  if (Math.abs(number) < 1e-12) number = 0;
  return new Intl.NumberFormat('es-ES', { maximumSignificantDigits: digits }).format(number);
}

function formatPolar(value, unit) {
  return `${formatNumber(value.polar.magnitude)} ${unit} ∠ ${formatNumber(value.polar.angle, 4)}°`;
}

function formatRectangular(value, unit) {
  const real = value.rectangular.real;
  const imag = value.rectangular.imag;
  const sign = imag < -1e-12 ? '−' : '+';
  return `${formatNumber(real)} ${sign} j${formatNumber(Math.abs(imag))} ${unit}`;
}

function resultRows(node, depth = 0) {
  const isGroup = node.type === 'group';
  const label = isGroup ? `Red ${node.mode === 'series' ? 'serie' : 'paralelo'}` : componentNames[node.type];
  const prefix = isGroup ? '' : `<span class="element-kind">${node.type}</span>`;
  const indent = isGroup ? 0 : depth * 17;
  const row = `<tr class="${isGroup ? 'group-row' : ''}">
    <td class="element-cell" style="padding-left:${10 + indent}px">${prefix}${label}${isGroup ? '' : ` · ${escapeHtml(node.value)} ${escapeHtml(node.unit)}`}</td>
    <td>${formatPolar(node.impedance, 'Ω')}</td>
    <td>${formatPolar(node.voltage, 'V')}</td>
    <td>${formatRectangular(node.voltage, 'V')}</td>
    <td>${formatPolar(node.current, 'A')}</td>
    <td>${formatRectangular(node.current, 'A')}</td>
  </tr>`;
  return row + (isGroup ? node.children.map((child) => resultRows(child, depth + 1)).join('') : '');
}

function renderResults(result, saved, saveWarning) {
  document.querySelector('#frequency-readout').textContent = `${formatNumber(result.frequency)} Hz  /  ω ${formatNumber(result.angularFrequency)} rad/s`;
  const source = result.source;
  resultsElement.classList.add('has-results');
  resultsElement.innerHTML = `<div class="summary-grid">
    <article class="summary-card"><div class="summary-label">Tensión fuente <span class="summary-index">01</span></div><div class="summary-polar">${formatPolar(source.voltage, 'V')}</div><div class="summary-rect">${formatRectangular(source.voltage, 'V')}</div></article>
    <article class="summary-card"><div class="summary-label">Impedancia total <span class="summary-index">02</span></div><div class="summary-polar">${formatPolar(source.impedance, 'Ω')}</div><div class="summary-rect">${formatRectangular(source.impedance, 'Ω')}</div></article>
    <article class="summary-card"><div class="summary-label">Corriente fuente <span class="summary-index">03</span></div><div class="summary-polar">${formatPolar(source.current, 'A')}</div><div class="summary-rect">${formatRectangular(source.current, 'A')}</div></article>
  </div>
  <h3 class="detail-heading">Magnitudes por elemento</h3>
  <div class="table-scroll"><table class="results-table"><thead><tr><th>ELEMENTO</th><th>Z (POLAR)</th><th>V (POLAR)</th><th>V (RECTANGULAR)</th><th>I (POLAR)</th><th>I (RECTANGULAR)</th></tr></thead><tbody>${resultRows(result.circuit)}</tbody></table></div>
  <p class="result-save-note ${saved ? 'saved' : 'warning'}">${saved ? 'Análisis guardado en MySQL.' : escapeHtml(saveWarning || 'MySQL no está configurado; este cálculo no quedó guardado.')}</p>`;
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3000);
}

formElement.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = document.querySelector('#calculate-button');
  button.disabled = true;
  button.innerHTML = '<span aria-hidden="true">…</span> Calculando';
  const payload = {
    name: document.querySelector('#circuit-name').value.trim(),
    frequency: Number(document.querySelector('#frequency').value),
    source: {
      magnitude: Number(document.querySelector('#source-magnitude').value),
      angle: Number(document.querySelector('#source-angle').value)
    },
    circuit: state.circuit
  };
  try {
    const response = await fetch('/api/calculate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo calcular.');
    state.result = data.result;
    renderResults(data.result, data.saved, data.saveWarning);
  } catch (error) {
    showToast(error.message || 'No se pudo conectar con el servidor.');
  } finally {
    button.disabled = false;
    button.innerHTML = '<span aria-hidden="true">↗</span> Calcular circuito';
  }
});

async function checkDatabase() {
  const indicator = document.querySelector('#database-status');
  try {
    const response = await fetch('/api/health');
    const data = await response.json();
    const online = data.database === 'connected';
    indicator.className = `database-status ${online ? 'is-online' : 'is-offline'}`;
    indicator.lastElementChild.textContent = online ? 'MySQL conectado' : data.database === 'unconfigured' ? 'MySQL sin configurar' : 'MySQL no disponible';
  } catch {
    indicator.className = 'database-status is-offline';
    indicator.lastElementChild.textContent = 'Servidor no disponible';
  }
}

function formatDate(value) {
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

async function openHistory() {
  const dialog = document.querySelector('#history-dialog');
  const list = document.querySelector('#history-list');
  dialog.showModal();
  list.innerHTML = '<p class="history-empty">Cargando análisis…</p>';
  try {
    const response = await fetch('/api/history');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo cargar el historial.');
    if (data.runs.length === 0) {
      list.innerHTML = '<p class="history-empty">Todavía no hay cálculos guardados en la base de datos.</p>';
      return;
    }
    list.innerHTML = data.runs.map((run, index) => `<button class="history-entry" type="button" data-run-index="${index}">
      <span><span class="history-name">${escapeHtml(run.name)}</span><span class="history-meta">${formatNumber(run.frequency_hz)} Hz · ${formatPolar(run.result.source.current, 'A')}</span></span>
      <span class="history-date">${escapeHtml(formatDate(run.created_at))}</span>
    </button>`).join('');
    list.dataset.runs = JSON.stringify(data.runs);
  } catch (error) {
    list.innerHTML = `<p class="history-empty">${escapeHtml(error.message)}</p>`;
  }
}

document.querySelector('#history-button').addEventListener('click', openHistory);
document.querySelector('#close-history').addEventListener('click', () => document.querySelector('#history-dialog').close());
document.querySelector('#history-list').addEventListener('click', (event) => {
  const entry = event.target.closest('[data-run-index]');
  if (!entry) return;
  const runs = JSON.parse(event.currentTarget.dataset.runs || '[]');
  const run = runs[Number(entry.dataset.runIndex)];
  if (!run) return;
  state.circuit = run.circuit;
  document.querySelector('#circuit-name').value = run.name;
  document.querySelector('#frequency').value = run.frequency_hz;
  document.querySelector('#source-magnitude').value = run.source_voltage.magnitude;
  document.querySelector('#source-angle').value = run.source_voltage.angle;
  state.result = run.result;
  renderTree();
  renderResults(run.result, true, null);
  document.querySelector('#history-dialog').close();
});

renderTree();
checkDatabase();