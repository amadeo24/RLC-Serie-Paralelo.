# Analizador fasorial RLC

Aplicación web para modelar redes R-L-C con grupos anidados en serie y paralelo. Calcula la impedancia equivalente, la corriente de fuente y la tensión y corriente de cada elemento, en forma polar y rectangular. Los análisis se guardan en MySQL y pueden recuperarse desde el historial.

## Requisitos

- Node.js 18 o posterior
- MySQL 8 o posterior

## Puesta en marcha

1. Instala las dependencias con `npm install`.
2. Crea la base y la tabla: `mysql -u root -p < schema.sql`.
3. Copia `.env.example` a `.env` y configura el usuario, contraseña y base de datos de MySQL.
4. Inicia el servidor con `npm run dev` y abre `http://localhost:3000`.

La aplicación también crea `circuit_runs` al iniciar si la base indicada ya existe y el usuario tiene permisos para crear tablas. Si MySQL no está disponible, los cálculos siguen funcionando, pero no se guardan.

## Modelo de cálculo

La tensión de entrada se interpreta como fasor RMS y su ángulo se ingresa en grados. La frecuencia se ingresa en Hz. Los valores aceptan Ω/kΩ/MΩ, H/mH/µH y F/µF/nF/pF.

- Resistencia: $Z_R = R$
- Inductancia: $Z_L = j 2\pi f L$
- Capacitancia: $Z_C = -j/(2\pi f C)$
- Serie: $Z_{eq} = \sum Z_k$
- Paralelo: $1/Z_{eq} = \sum 1/Z_k$

El modelo supone componentes ideales y régimen sinusoidal permanente. No incluye tolerancias, pérdidas ni condiciones transitorias.

## Comprobaciones

- `npm test` ejecuta pruebas de redes serie, paralelo y mixtas.
- `npm run check` comprueba la sintaxis de servidor, cálculo, base de datos y cliente.