const test = require('node:test');
const assert = require('node:assert/strict');
const { calculate } = require('../src/circuit');

const source = { magnitude: 20, angle: 0 };
const resistor = (id, value) => ({ id, type: 'R', value, unit: 'ohm' });
const group = (id, mode, children) => ({ id, type: 'group', mode, children });

test('serie: conserva la corriente y reparte la tensión según cada impedancia', () => {
  const result = calculate({
    frequency: 60,
    source: { magnitude: 120, angle: 0 },
    circuit: group('root', 'series', [resistor('r1', 100), { id: 'l1', type: 'L', value: 100, unit: 'mH' }])
  });
  const [resistance, inductor] = result.circuit.children;

  assert.ok(Math.abs(result.source.impedance.rectangular.real - 100) < 1e-10);
  assert.ok(Math.abs(result.source.impedance.rectangular.imag - 2 * Math.PI * 60 * 0.1) < 1e-10);
  assert.deepEqual(resistance.current.rectangular, result.source.current.rectangular);
  assert.deepEqual(inductor.current.rectangular, result.source.current.rectangular);
  assert.ok(Math.abs(resistance.voltage.rectangular.real + inductor.voltage.rectangular.real - 120) < 1e-10);
  assert.ok(Math.abs(resistance.voltage.rectangular.imag + inductor.voltage.rectangular.imag) < 1e-10);
});

test('paralelo: cada rama recibe la tensión de fuente', () => {
  const result = calculate({
    frequency: 60,
    source,
    circuit: group('root', 'parallel', [resistor('r1', 100), resistor('r2', 100)])
  });

  assert.equal(result.source.impedance.rectangular.real, 50);
  assert.equal(result.source.current.rectangular.real, 0.4);
  for (const branch of result.circuit.children) {
    assert.deepEqual(branch.voltage.rectangular, result.source.voltage.rectangular);
    assert.equal(branch.current.rectangular.real, 0.2);
  }
});

test('red mixta: calcula ramas paralelas dentro de un grupo serie', () => {
  const result = calculate({
    frequency: 50,
    source,
    circuit: group('root', 'series', [
      resistor('r1', 10),
      group('parallel', 'parallel', [resistor('r2', 20), resistor('r3', 20)])
    ])
  });
  const [seriesResistor, parallelGroup] = result.circuit.children;

  assert.equal(result.source.impedance.rectangular.real, 20);
  assert.equal(result.source.current.rectangular.real, 1);
  assert.ok(Math.abs(seriesResistor.voltage.rectangular.real - 10) < 1e-10);
  assert.ok(Math.abs(parallelGroup.voltage.rectangular.real - 10) < 1e-10);
  assert.ok(Math.abs(parallelGroup.children[0].current.rectangular.real - 0.5) < 1e-10);
});

test('rechaza circuitos sin frecuencia positiva', () => {
  assert.throws(() => calculate({ frequency: 0, source, circuit: group('root', 'series', [resistor('r1', 10)]) }), /frecuencia/);
});