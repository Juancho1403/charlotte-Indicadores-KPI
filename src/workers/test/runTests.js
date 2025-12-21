// tests/runTests.js
import { strictEqual, ok } from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import dayjs from 'dayjs';
import { computeKpiSnapshot } from './kpiProcessor.js';

// Helper para cargar JSON
function loadFixture(name) {
  const p = join(join(process.cwd(), "/src/workers/test"), 'json', name);
  return JSON.parse(readFileSync(p, 'utf8'));
}

// Test 1: cálculo básico con json
async function testBasicCalculation() {
  const clients = loadFixture('clients.json');
  const comandas = loadFixture('comandas.json');
  const targetDay = dayjs('2025-12-16T00:00:00.000Z');

  return computeKpiSnapshot(clients, comandas, {
    outlierK: 2,
    outlierStrategy: 'adjust',
    timezone: 'UTC',
    targetDay
  }).then(snapshot => {
    strictEqual(typeof snapshot.totalVentas, 'number', 'totalVentas debe ser número');
    ok(snapshot.totalVentas > 0, 'totalVentas debe ser mayor que 0');
    strictEqual(snapshot.totalPedidos, 2, 'totalPedidos debe ser 2');
    ok(snapshot.tiempoPromedioMin > 0, 'tiempoPromedioMin debe ser > 0');
    strictEqual(Number(snapshot.ticketPromedio.toFixed(2)), 40.00, 'ticketPromedio debe ser 40.00');
    console.log('✓ testBasicCalculation passed');
  });
}

// Test 2: outlier exclude
async function testOutlierExclude() {
  const clients = [
    { id: 1, status: 'CLOSED', total_amount: 10, closed_at: '2025-12-16T10:00:00Z' },
    { id: 2, status: 'CLOSED', total_amount: 10000, closed_at: '2025-12-16T11:00:00Z' }
  ];
  const comandas = [];
  const targetDay = dayjs('2025-12-16T00:00:00Z');

  return computeKpiSnapshot(clients, comandas, { outlierK: 1, outlierStrategy: 'exclude', timezone: 'UTC', targetDay })
    .then(snapshot => {
      strictEqual(snapshot.totalPedidos, 1, 'Con exclude debe quedar 1 pedido');
      strictEqual(Number(snapshot.totalVentas.toFixed(2)), 10000.00, 'totalVentas debe ser 10.00');
      console.log('✓ testOutlierExclude passed');
    });
}

// Test runner
async function runAll() {
  console.log('Running tests (no external libs required)...');
  try {
    await testBasicCalculation();
    await testOutlierExclude();
    console.log('\nAll tests passed ✅');
    process.exit(0);
  } catch (err) {
    console.error('\nTest failed ❌');
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

runAll();
