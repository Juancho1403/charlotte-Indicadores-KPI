import { startKpiPoller } from '../../workers/kpiPoller.js';
import { appendFile } from 'fs/promises';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'data', 'webhooks.log');

async function logEvent(name, body) {
  const line = `${new Date().toISOString()} [${name}] ${JSON.stringify(body)}\n`;
  try {
    await appendFile(LOG_FILE, line, 'utf8');
  } catch (e) {
    // ignore
  }
}

export async function deliveryReady(req, res) {
  try {
    await logEvent('delivery_ready', req.body);
    // Optionally trigger a KPI refresh (quick) — start poller immediately once
    try { startKpiPoller({ intervalSec: 60 }); } catch (e) { }
    // If middleware saved idempotency helper, persist a dummy jobId
    if (req.saveIdempotencyKey) await req.saveIdempotencyKey(`delivery-ready:${Date.now()}`);
    res.json({ success: true });
  } catch (err) {
    console.error('deliveryReady webhook error', err);
    res.status(500).json({ error: 'internal' });
  }
}

export async function kitchenReady(req, res) {
  try {
    await logEvent('kitchen_ready', req.body);
    try { startKpiPoller({ intervalSec: 60 }); } catch (e) { }
    if (req.saveIdempotencyKey) await req.saveIdempotencyKey(`kitchen-ready:${Date.now()}`);
    res.json({ success: true });
  } catch (err) {
    console.error('kitchenReady webhook error', err);
    res.status(500).json({ error: 'internal' });
  }
}
