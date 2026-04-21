# WavLoom Express

Audio production workstation — a lightweight Electron + React/TypeScript companion to WavLoom Studio.

## Tech Stack

- React 19 + TypeScript
- Vite 6
- Electron 41
- Tailwind CSS
- Zustand (state), i18next (i18n), wavesurfer.js (waveform UI)
- better-sqlite3 (local project storage)
- lamejs / libflacjs (audio encoding)

## Quick Start

```bash
npm install
npm run dev                # Vite dev server
npm run electron:dev       # Electron shell with hot reload
npm run build              # Production build
npm run electron:build     # Build installers (current OS)
```

Platform-specific installers:

```bash
npm run build:mac
npm run build:win
npm run build:linux
```

---

## License

![License](https://img.shields.io/badge/license-All%20Rights%20Reserved-red)

**All Rights Reserved.** Copyright (c) 2026 Mike Weaver. See [`LICENSE`](LICENSE)
for the full terms.

This repository is publicly visible for reference and review only. No license
or permission is granted to use, copy, modify, distribute, or sell the code,
in whole or in part, without the express prior written permission of the
copyright holder. Third-party dependencies remain under their respective
upstream licenses.
