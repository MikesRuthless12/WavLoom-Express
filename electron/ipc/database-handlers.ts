import { ipcMain } from 'electron';
import { getDatabase } from './database';

export function registerDatabaseHandlers(): void {
  // Settings
  ipcMain.handle('db:getSetting', (_event, key: string) => {
    const db = getDatabase();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  });

  ipcMain.handle('db:setSetting', (_event, key: string, value: string) => {
    const db = getDatabase();
    db.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    ).run(key, value);
  });

  // Presets
  ipcMain.handle('db:getPresets', () => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM presets ORDER BY name').all();
  });

  ipcMain.handle('db:getPreset', (_event, id: number) => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM presets WHERE id = ?').get(id) ?? null;
  });

  ipcMain.handle(
    'db:savePreset',
    (
      _event,
      data: {
        name: string;
        category: string;
        effects_defaults: string;
        mode: string;
        file_path: string | null;
      },
    ) => {
      const db = getDatabase();
      const result = db
        .prepare(
          `INSERT INTO presets (name, category, effects_defaults, mode, file_path, preset_type)
           VALUES (@name, @category, @effects_defaults, @mode, @file_path, 'user')`,
        )
        .run(data);
      return result.lastInsertRowid;
    },
  );

  ipcMain.handle('db:deletePreset', (_event, id: number) => {
    const db = getDatabase();
    // Only allow deleting user presets
    db.prepare("DELETE FROM presets WHERE id = ? AND preset_type = 'user'").run(id);
  });

  // Analyses
  ipcMain.handle(
    'db:saveAnalysis',
    (
      _event,
      data: {
        source_file_path: string;
        source_file_hash: string;
        instrument_type: string;
        spectral_data: string;
        temporal_data: string;
        waveform_data: string;
      },
    ) => {
      const db = getDatabase();
      const result = db
        .prepare(
          `INSERT INTO analyses (source_file_path, source_file_hash, instrument_type, spectral_data, temporal_data, waveform_data)
         VALUES (@source_file_path, @source_file_hash, @instrument_type, @spectral_data, @temporal_data, @waveform_data)`,
        )
        .run(data);
      return result.lastInsertRowid;
    },
  );

  ipcMain.handle('db:getAnalysisByHash', (_event, hash: string) => {
    const db = getDatabase();
    return (
      db
        .prepare('SELECT * FROM analyses WHERE source_file_hash = ?')
        .get(hash) ?? null
    );
  });

  ipcMain.handle('db:getAnalysisById', (_event, id: number) => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM analyses WHERE id = ?').get(id) ?? null;
  });

  // Designs
  ipcMain.handle(
    'db:saveDesign',
    (
      _event,
      data: {
        name: string;
        source_type: string;
        source_id: number;
        effects_state: string;
        mode: string;
      },
    ) => {
      const db = getDatabase();
      const result = db
        .prepare(
          `INSERT INTO designs (name, source_type, source_id, effects_state, mode)
         VALUES (@name, @source_type, @source_id, @effects_state, @mode)`,
        )
        .run(data);
      return result.lastInsertRowid;
    },
  );

  ipcMain.handle(
    'db:updateDesign',
    (
      _event,
      id: number,
      data: {
        name?: string;
        effects_state?: string;
        mode?: string;
        exported_path?: string;
      },
    ) => {
      const db = getDatabase();
      const fields: string[] = [];
      const values: unknown[] = [];
      for (const [key, val] of Object.entries(data)) {
        if (val !== undefined) {
          fields.push(`${key} = ?`);
          values.push(val);
        }
      }
      if (fields.length === 0) return;
      fields.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE designs SET ${fields.join(', ')} WHERE id = ?`).run(
        ...values,
      );
    },
  );

  ipcMain.handle('db:getDesigns', () => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM designs ORDER BY updated_at DESC').all();
  });

  ipcMain.handle('db:getLastDesign', () => {
    const db = getDatabase();
    return (
      db
        .prepare('SELECT * FROM designs ORDER BY updated_at DESC LIMIT 1')
        .get() ?? null
    );
  });

  // Kits
  ipcMain.handle(
    'db:saveKit',
    (
      _event,
      data: { name: string; description: string; slot_count: number },
    ) => {
      const db = getDatabase();
      const result = db
        .prepare(
          'INSERT INTO kits (name, description, slot_count) VALUES (@name, @description, @slot_count)',
        )
        .run(data);
      return result.lastInsertRowid;
    },
  );

  ipcMain.handle(
    'db:updateKitSlots',
    (
      _event,
      kitId: number,
      slots: Array<{
        slot_index: number;
        design_id: number | null;
        label: string;
        sound_name: string | null;
        file_path: string | null;
      }>,
    ) => {
      const db = getDatabase();
      const upsert = db.prepare(
        `INSERT INTO kit_slots (kit_id, slot_index, design_id, label, sound_name, file_path)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(kit_id, slot_index) DO UPDATE SET
         design_id = excluded.design_id,
         label = excluded.label,
         sound_name = excluded.sound_name,
         file_path = excluded.file_path`,
      );
      // Also remove slots beyond the current set
      const deleteExtra = db.prepare(
        'DELETE FROM kit_slots WHERE kit_id = ? AND slot_index >= ?',
      );
      const transaction = db.transaction(() => {
        for (const slot of slots) {
          upsert.run(kitId, slot.slot_index, slot.design_id, slot.label, slot.sound_name, slot.file_path);
        }
        deleteExtra.run(kitId, slots.length);
      });
      transaction();
    },
  );

  ipcMain.handle(
    'db:updateKit',
    (
      _event,
      id: number,
      data: { name?: string; description?: string; slot_count?: number; exported_path?: string },
    ) => {
      const db = getDatabase();
      const fields: string[] = [];
      const values: unknown[] = [];
      for (const [key, val] of Object.entries(data)) {
        if (val !== undefined) {
          fields.push(`${key} = ?`);
          values.push(val);
        }
      }
      if (fields.length === 0) return;
      fields.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE kits SET ${fields.join(', ')} WHERE id = ?`).run(
        ...values,
      );
    },
  );

  ipcMain.handle('db:getKits', () => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM kits ORDER BY updated_at DESC').all();
  });

  ipcMain.handle('db:getKitWithSlots', (_event, id: number) => {
    const db = getDatabase();
    const kit = db.prepare('SELECT * FROM kits WHERE id = ?').get(id);
    if (!kit) return null;
    const slots = db
      .prepare('SELECT * FROM kit_slots WHERE kit_id = ? ORDER BY slot_index')
      .all(id);
    return { ...kit, slots };
  });

  ipcMain.handle('db:deleteKit', (_event, id: number) => {
    const db = getDatabase();
    db.prepare('DELETE FROM kits WHERE id = ?').run(id);
  });

  // Recent Files
  ipcMain.handle('db:getRecentFiles', () => {
    const db = getDatabase();
    return db
      .prepare('SELECT * FROM recent_files ORDER BY accessed_at DESC LIMIT 10')
      .all();
  });

  ipcMain.handle(
    'db:addRecentFile',
    (
      _event,
      data: { file_path: string; file_name: string; file_type: string },
    ) => {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO recent_files (file_path, file_name, file_type, accessed_at)
       VALUES (@file_path, @file_name, @file_type, datetime('now'))
       ON CONFLICT(file_path) DO UPDATE SET
         file_name = excluded.file_name,
         file_type = excluded.file_type,
         accessed_at = datetime('now')`,
      ).run(data);
    },
  );

  ipcMain.handle('db:deleteRecentFile', (_event, filePath: string) => {
    const db = getDatabase();
    db.prepare('DELETE FROM recent_files WHERE file_path = ?').run(filePath);
  });

  ipcMain.handle('db:clearRecentFiles', () => {
    const db = getDatabase();
    db.prepare('DELETE FROM recent_files').run();
  });
}
