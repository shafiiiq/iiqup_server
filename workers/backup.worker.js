/**
 * MongoDB Automated Backup Worker — AnsariGroup
 * ─────────────────────────────────────────────
 * DO NOT run this file directly.
 * It is automatically started when app.js loads.
 *
 * Behaviour:
 *   • Runs first backup immediately when server starts
 *   • Then repeats every 30 minutes automatically
 *   • Keeps only the 3 most recent backup folders
 *   • Auto-deletes older folders on each run
 *   • Lock flag prevents overlapping runs
 *
 * Output:
 *   backup/ansarigroup/<timestamp>/
 *     ├── users.json
 *     └── backup_manifest.json
 */

const cron            = require('node-cron');
const { MongoClient } = require('mongodb');
const fs              = require('fs');
const path            = require('path');

// ─── Config ────────────────────────────────────────────────────────────────────

const MONGO_URI   = process.env.MONGO_URI;
const BACKUP_ROOT = path.resolve(__dirname, '../backup/ansarigroup');
const MAX_BACKUPS = 3;

// ─── Lock: prevents two backup runs overlapping ────────────────────────────────

let isRunning = false;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getTimestamp() {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function formatBytes(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ─── Rotate: delete oldest folders so only MAX_BACKUPS remain ──────────────────

function rotateOldBackups() {
  if (!fs.existsSync(BACKUP_ROOT)) return;

  const folders = fs
    .readdirSync(BACKUP_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({
      name:     e.name,
      fullPath: path.join(BACKUP_ROOT, e.name),
      mtime:    fs.statSync(path.join(BACKUP_ROOT, e.name)).mtime,
    }))
    .sort((a, b) => a.mtime - b.mtime);

  const toDelete = folders.slice(0, Math.max(0, folders.length - MAX_BACKUPS + 1));

  toDelete.forEach(({ name, fullPath }) => {
    try {
      fs.rmSync(fullPath, { recursive: true, force: true });
      console.log(`[BackupWorker] Deleted old backup: ${name}`);
    } catch (err) {
      console.error(`[BackupWorker] Could not delete ${name}:`, err.message);
    }
  });
}

// ─── Core backup ───────────────────────────────────────────────────────────────

async function runBackup() {
  if (isRunning) {
    console.log('[BackupWorker] Already running — skipped.');
    return;
  }

  if (!MONGO_URI) {
    console.error('[BackupWorker] MONGO_URI not set — skipping backup.');
    return;
  }

  isRunning = true;
  const client    = new MongoClient(MONGO_URI);
  const timestamp = getTimestamp();

  console.log('[BackupWorker] Starting backup...');

  ensureDir(BACKUP_ROOT);
  rotateOldBackups();

  const backupDir = path.join(BACKUP_ROOT, timestamp);
  ensureDir(backupDir);

  try {
    await client.connect();

    const db          = client.db();
    const dbName      = db.databaseName;
    const collections = await db.listCollections().toArray();

    console.log(`[BackupWorker] Database: ${dbName} | Collections: ${collections.length}`);

    if (collections.length === 0) {
      console.log('[BackupWorker] No collections found — skipping.');
      return;
    }

    const manifest = {
      database:    dbName,
      timestamp,
      maxBackups:  MAX_BACKUPS,
      collections: [],
    };

    for (const { name: colName } of collections) {
      try {
        const docs        = await db.collection(colName).find({}).toArray();
        const jsonContent = JSON.stringify(docs, null, 2);
        fs.writeFileSync(path.join(backupDir, `${colName}.json`), jsonContent, 'utf8');
        const size = Buffer.byteLength(jsonContent, 'utf8');
        console.log(`[BackupWorker] ${colName}: ${docs.length} docs (${formatBytes(size)})`);
        manifest.collections.push({ name: colName, documentCount: docs.length, sizeFormatted: formatBytes(size) });
      } catch (err) {
        console.error(`[BackupWorker] Failed to back up "${colName}":`, err.message);
        manifest.collections.push({ name: colName, error: err.message });
      }
    }

    manifest.completedAt    = new Date().toISOString();
    manifest.totalDocuments = manifest.collections.reduce((s, c) => s + (c.documentCount || 0), 0);
    fs.writeFileSync(path.join(backupDir, 'backup_manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    const stored = fs
      .readdirSync(BACKUP_ROOT, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

    console.log(`[BackupWorker] Backup complete — ${manifest.totalDocuments} docs | Stored: ${stored.length}/${MAX_BACKUPS} | Latest: ${timestamp}`);

  } catch (err) {
    console.error('[BackupWorker] Backup failed:', err.message);
    try {
      if (fs.existsSync(backupDir) && fs.readdirSync(backupDir).length === 0) {
        fs.rmdirSync(backupDir);
      }
    } catch (_) {}
  } finally {
    await client.close();
    isRunning = false;
  }
}

// ─── Start ─────────────────────────────────────────────────────────────────────

console.log('[BackupWorker] Initialized — runs every 30 minutes.');

// Run immediately when server starts
runBackup();

// Schedule every 30 minutes
cron.schedule('*/30 * * * *', runBackup);