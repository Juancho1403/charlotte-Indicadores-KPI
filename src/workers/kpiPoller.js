import fs from 'fs/promises';
import path from 'path';
import { getDashboardSummary } from '../services/kpi.service.js';
import { envs } from '../config/envs.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const OUT_FILE = path.join(DATA_DIR, 'kpi_aggregates.json');

let intervalId = null;

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (e) {
    // ignore
  }
}

async function appendAggregate(obj) {
  await ensureDataDir();
  let arr = [];
  try {
    const content = await fs.readFile(OUT_FILE, 'utf8');
    arr = JSON.parse(content || '[]');
  } catch (e) {
    arr = [];
  }
  arr.push(obj);
  await fs.writeFile(OUT_FILE, JSON.stringify(arr, null, 2), 'utf8');
}

export function startKpiPoller({ intervalSec = 60 } = {}) {
  if (intervalId) return;
  intervalId = setInterval(async () => {
    try {
      const summary = await getDashboardSummary();
      const record = { timestamp: new Date().toISOString(), summary };
      await appendAggregate(record);
      console.log('[kpiPoller] Saved aggregate at', record.timestamp);
    } catch (err) {
      console.warn('[kpiPoller] Error fetching/saving aggregate:', err.message || err);
    }
  }, (intervalSec || 60) * 1000);
  console.log('[kpiPoller] Started with interval', intervalSec, 'sec');
}

export function stopKpiPoller() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
