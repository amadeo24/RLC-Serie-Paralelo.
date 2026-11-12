const EPSILON = 1e-12;

const complex = (real = 0, imag = 0) => ({ real, imag });
const add = (a, b) => complex(a.real + b.real, a.imag + b.imag);
const subtract = (a, b) => complex(a.real - b.real, a.imag - b.imag);
const multiply = (a, b) => complex(
  a.real * b.real - a.imag * b.imag,
  a.real * b.imag + a.imag * b.real
);
const magnitude = (value) => Math.hypot(value.real, value.imag);
const divide = (a, b) => {
  const denominator = b.real ** 2 + b.imag ** 2;
  if (denominator < EPSILON ** 2) {
    throw new Error('La impedancia de una rama es prácticamente cero; no se puede determinar una corriente finita.');
  }
  return complex(
    (a.real * b.real + a.imag * b.imag) / denominator,
    (a.imag * b.real - a.real * b.imag) / denominator
  );
};
const polar = (value) => ({
  magnitude: magnitude(value),
  angle: Math.atan2(value.imag, value.real) * 180 / Math.PI
});

const units = {
  R: { ohm: 1, kohm: 1e3, Mohm: 1e6 },
  L: { H: 1, mH: 1e-3, uH: 1e-6 },
  C: { F: 1, uF: 1e-6, nF: 1e-9, pF: 1e-12 }
};

function parseNetwork(node, frequency, count = { components: 0 }, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 8) {
    throw new Error('La estructura del circuito no es válida o supera 8 niveles.');
  }

  if (node.type === 'group') {
    if (!['series', 'parallel'].includes(node.mode) || !Array.isArray(node.children) || node.children.length === 0) {
      throw new Error('Cada grupo debe ser serie o paralelo y contener al menos un elemento.');
    }
    const children = node.children.map((child) => parseNetwork(child, frequency, count, depth + 1));
    const impedance = node.mode === 'series'
      ? children.reduce((total, child) => add(total, child.impedance), complex())
      : divide(complex(1), children.reduce((total, child) => add(total, divide(complex(1), child.impedance)), complex()));
    return { ...node, children, impedance };
  }

  if (!['R', 'L', 'C'].includes(node.type) || !units[node.type]?.[node.unit]) {
    throw new Error('Componente o unidad no reconocidos.');
  }
  if (!Number.isFinite(node.value) || node.value <= 0) {
    throw new Error('Los valores de los componentes deben ser mayores que cero.');
  }
  count.components += 1;
  if (count.components > 32) throw new Error('El circuito admite hasta 32 componentes.');

  const value = node.value * units[node.type][node.unit];
  const omega = 2 * Math.PI * frequency;
  const impedance = node.type === 'R'
    ? complex(value)
    : node.type === 'L'
      ? complex(0, omega * value)
      : complex(0, -1 / (omega * value));
  return { ...node, impedance };
}

function summarize(value) {
  const rectangular = { real: value.real, imag: value.imag };
  const polarValue = polar(value);
  return { rectangular, polar: polarValue };
}

function assignPhasors(node, voltage, current) {
  const result = {
    id: node.id,
    type: node.type,
    impedance: summarize(node.impedance),
    voltage: summarize(voltage),
    current: summarize(current)
  };
  if (node.type === 'group') {
    result.mode = node.mode;
    result.children = node.children.map((child) => {
      if (node.mode === 'series') {
        return assignPhasors(child, multiply(current, child.impedance), current);
      }
      return assignPhasors(child, voltage, divide(voltage, child.impedance));
    });
  }
  return result;
}

function calculate(input) {
  const frequency = Number(input.frequency);
  const voltageMagnitude = Number(input.source?.magnitude);
  const voltageAngle = Number(input.source?.angle);
  if (!Number.isFinite(frequency) || frequency <= 0) throw new Error('La frecuencia debe ser mayor que cero.');
  if (!Number.isFinite(voltageMagnitude) || voltageMagnitude < 0 || !Number.isFinite(voltageAngle)) {
    throw new Error('Ingrese una magnitud de tensión válida y un ángulo finito.');
  }

  const network = parseNetwork(input.circuit, frequency);
  const sourceVoltage = complex(
    voltageMagnitude * Math.cos(voltageAngle * Math.PI / 180),
    voltageMagnitude * Math.sin(voltageAngle * Math.PI / 180)
  );
  const sourceCurrent = divide(sourceVoltage, network.impedance);
  return {
    frequency,
    angularFrequency: 2 * Math.PI * frequency,
    source: {
      voltage: summarize(sourceVoltage),
      current: summarize(sourceCurrent),
      impedance: summarize(network.impedance)
    },
    circuit: assignPhasors(network, sourceVoltage, sourceCurrent)
  };
}

module.exports = { calculate };