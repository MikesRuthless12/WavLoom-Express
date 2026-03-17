import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'node:path';

let db: Database.Database | null = null;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    type TEXT,
    file_path TEXT,
    metadata TEXT,
    effects_defaults TEXT,
    mode TEXT,
    tags TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_file_path TEXT NOT NULL,
    source_file_hash TEXT,
    instrument_type TEXT,
    spectral_data TEXT,
    temporal_data TEXT,
    waveform_data TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS designs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    source_type TEXT,
    source_id INTEGER,
    effects_state TEXT,
    mode TEXT,
    exported_path TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    slot_count INTEGER DEFAULT 16,
    exported_path TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kit_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kit_id INTEGER NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
    slot_index INTEGER NOT NULL,
    design_id INTEGER REFERENCES designs(id) ON DELETE SET NULL,
    label TEXT,
    sound_name TEXT,
    file_path TEXT,
    UNIQUE (kit_id, slot_index)
  );

  CREATE TABLE IF NOT EXISTS license (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    serial_key TEXT,
    activation_status TEXT,
    device_fingerprint TEXT,
    activated_at TEXT,
    last_validated_at TEXT,
    tier TEXT
  );

  CREATE TABLE IF NOT EXISTS recent_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL UNIQUE,
    file_name TEXT NOT NULL,
    file_type TEXT,
    accessed_at TEXT DEFAULT (datetime('now'))
  );
`;

export function initDatabase(): Database.Database {
  if (db) return db;

  const dbPath = path.join(app.getPath('userData'), 'wavloom-express.db');
  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);

  // Migrate kit_slots: add sound_name and file_path columns if missing
  const kitSlotCols = db.prepare("PRAGMA table_info(kit_slots)").all() as Array<{ name: string }>;
  const colNames = new Set(kitSlotCols.map((c) => c.name));
  if (!colNames.has('sound_name')) {
    db.exec('ALTER TABLE kit_slots ADD COLUMN sound_name TEXT');
  }
  if (!colNames.has('file_path')) {
    db.exec('ALTER TABLE kit_slots ADD COLUMN file_path TEXT');
  }

  // Migrate recent_files: ensure UNIQUE constraint on file_path
  const rfIndexes = db.prepare("PRAGMA index_list(recent_files)").all() as Array<{ name: string }>;
  const hasUnique = rfIndexes.some((idx) => {
    const cols = db!.prepare(`PRAGMA index_info("${idx.name}")`).all() as Array<{ name: string }>;
    return cols.length === 1 && cols[0].name === 'file_path';
  });
  if (!hasUnique) {
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_recent_files_path ON recent_files(file_path)
    `);
  }

  // Migrate presets: add preset_type column if missing
  const presetCols = db.prepare("PRAGMA table_info(presets)").all() as Array<{ name: string }>;
  const presetColNames = new Set(presetCols.map((c) => c.name));
  if (!presetColNames.has('preset_type')) {
    db.exec("ALTER TABLE presets ADD COLUMN preset_type TEXT DEFAULT 'built-in'");
  }

  seedPresets(db);

  return db;
}

function seedPresets(database: Database.Database): void {
  // Remove any previously seeded built-in presets — users create their own
  database.prepare("DELETE FROM presets WHERE preset_type = 'built-in' OR preset_type IS NULL").run();
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
