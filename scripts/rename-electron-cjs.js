import { readdirSync, renameSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', 'dist-electron');

// First pass: patch require() calls to add .cjs extension
function patchRequires(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      patchRequires(full);
    } else if (entry.endsWith('.js')) {
      let content = readFileSync(full, 'utf8');
      content = content.replace(/require\("(\.[^"]+)"\)/g, (match, p) => {
        if (!p.endsWith('.js') && !p.endsWith('.cjs') && !p.endsWith('.json') && !p.endsWith('.node')) {
          return `require("${p}.cjs")`;
        }
        return match;
      });
      writeFileSync(full, content, 'utf8');
    }
  }
}

// Second pass: rename .js to .cjs
function renameJsToCjs(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      renameJsToCjs(full);
    } else if (entry.endsWith('.js')) {
      renameSync(full, full.replace(/\.js$/, '.cjs'));
    }
  }
}

patchRequires(root);
renameJsToCjs(root);
