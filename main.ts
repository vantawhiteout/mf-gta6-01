// Cielo Bay Heat — make.fun entry program (Node 22, standard library only).
//
// The playable game is the static site in game/: index.html plus its own ES
// modules, all local, with no build step and no network request. This program
// is the hand-in: it copies game/ and screenshots/ into the output directory
// and writes dossier.json, the summary the judge reads, with the kit's library.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.
//
//   node serve.ts                       play at http://localhost:8080
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });

// Four screenshots at most, each a real render kept under the scorer's byte cap.
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
