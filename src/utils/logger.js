import { createWriteStream } from 'fs';
import path from 'path';

const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
const LOG_FILE = process.env.LOG_FILE || 'kpi-worker.log';
const LOG_PATH = path.join(LOG_DIR, LOG_FILE);

// Simple helper para asegurar directorio (sin dependencias)
import fs from 'fs';
if (!fs.existsSync(LOG_DIR)) {
  try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch (e) { /* ignore */ }
}

// Formato de timestamp ISO
function timestamp() {
  return new Date().toISOString();
}

// Formatea metadata como string compacta
function metaToString(meta) {
  if (!meta) return '';
  try { return JSON.stringify(meta); } catch (e) { return String(meta); }
}

// Stream para archivo (append)
const fileStream = createWriteStream(LOG_PATH, { flags: 'a' });

// Nivel simple y rotulado
function write(level, message, meta) {
  const line = `${timestamp()} | ${level.toUpperCase()} | ${message} ${meta ? '| ' + metaToString(meta) : ''}\n`;
  // Console
  if (level === 'error') console.error(line.trim());
  else if (level === 'warn') console.warn(line.trim());
  else console.log(line.trim());
  // File
  try { fileStream.write(line); } catch (e) { /* ignore file errors */ }
}

// Exported API
export default {
  info: (msg, meta) => write('info', msg, meta),
  warn: (msg, meta) => write('warn', msg, meta),
  error: (msg, meta) => write('error', msg, meta),

  // Logs especializados para el Worker
  logOutlierSummary: (date, revenueStats, serviceStats, outliersCount) => {
    write('warn', `Outlier summary for ${date}`, { revenueStats, serviceStats, outliersCount });
  },

  logUnexpectedValue: (context, value, expected) => {
    write('warn', `Unexpected value in ${context}`, { value, expected });
  },

  logComputationError: (context, err, extra) => {
    write('error', `Computation error in ${context}: ${err?.message || err}`, { stack: err?.stack, extra });
  },

  logFetchWarning: (endpoint, status, body) => {
    write('warn', `Fetch warning from ${endpoint}`, { status, body });
  },

  // Helper para marcar checkpoints en el job
  checkpoint: (jobId, message, meta) => {
    write('info', `Job ${jobId} checkpoint: ${message}`, meta);
  }
};