// Downloads the bundled typefaces from the Google Fonts repository into
// resources/fonts, together with each family's licence.
//
// The fonts are committed, so this script is not part of the build — it exists
// so their provenance is reproducible and adding a face is a one-line change
// rather than an unexplained binary appearing in a commit.
//
//   node scripts/fetch-fonts.mjs
//
// Every family here is under the SIL Open Font License, which permits
// bundling and redistribution provided the licence travels with the font and
// the font is not sold on its own. Do not add a family without checking that
// its directory in google/fonts is `ofl/` and not `apache/` or `ufl/`.

import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'resources', 'fonts');
const BASE = 'https://raw.githubusercontent.com/google/fonts/main';

/**
 * `dir` is the family's directory in google/fonts, `licence` its top-level
 * directory (which is also its licence), and `files` the faces to take.
 *
 * Only static faces are listed. Several families — Montserrat, Oswald,
 * Playfair Display — now ship as variable fonts only, and opentype.js reads a
 * variable font's default instance and nothing else. Bundling one would put a
 * family in the picker whose Bold silently rendered as Regular, and weight is
 * the main lever for making lettering thick enough to satin. Better to leave
 * them out than to ship a face whose weights do not work.
 */
const FAMILIES = [
  // Formal scripts — the monogram and wedding workhorses.
  { dir: 'greatvibes', files: ['GreatVibes-Regular.ttf'] },
  { dir: 'allura', files: ['Allura-Regular.ttf'] },
  { dir: 'alexbrush', files: ['AlexBrush-Regular.ttf'] },
  { dir: 'parisienne', files: ['Parisienne-Regular.ttf'] },
  { dir: 'sacramento', files: ['Sacramento-Regular.ttf'] },
  { dir: 'italianno', files: ['Italianno-Regular.ttf'] },
  { dir: 'tangerine', files: ['Tangerine-Regular.ttf', 'Tangerine-Bold.ttf'] },
  { dir: 'petitformalscript', files: ['PetitFormalScript-Regular.ttf'] },
  { dir: 'rougescript', files: ['RougeScript-Regular.ttf'] },
  { dir: 'pinyonscript', files: ['PinyonScript-Regular.ttf'] },

  // Casual scripts. Satisfy and Yellowtail sit under `apache/` rather than
  // `ofl/`; Apache-2.0 permits redistribution on the same terms that matter
  // here, provided the licence ships with them.
  { dir: 'pacifico', files: ['Pacifico-Regular.ttf'] },
  { dir: 'satisfy', licence: 'apache', files: ['Satisfy-Regular.ttf'] },
  { dir: 'courgette', files: ['Courgette-Regular.ttf'] },
  { dir: 'kaushanscript', files: ['KaushanScript-Regular.ttf'] },
  { dir: 'yellowtail', licence: 'apache', files: ['Yellowtail-Regular.ttf'] },
  { dir: 'cookie', files: ['Cookie-Regular.ttf'] },
  { dir: 'grandhotel', files: ['GrandHotel-Regular.ttf'] },
  { dir: 'marckscript', files: ['MarckScript-Regular.ttf'] },
  { dir: 'playball', files: ['Playball-Regular.ttf'] },
  { dir: 'lobster', files: ['Lobster-Regular.ttf'] },

  // Not scripts, but the shapes embroidery actually wants: heavy slabs, tall
  // condensed caps, blackletter, varsity block.
  { dir: 'alfaslabone', files: ['AlfaSlabOne-Regular.ttf'] },
  { dir: 'bebasneue', files: ['BebasNeue-Regular.ttf'] },
  { dir: 'graduate', files: ['Graduate-Regular.ttf'] },
  { dir: 'unifrakturmaguntia', files: ['UnifrakturMaguntia-Book.ttf'] },
  { dir: 'bungee', files: ['Bungee-Regular.ttf'] },
  { dir: 'staatliches', files: ['Staatliches-Regular.ttf'] },
  { dir: 'ultra', licence: 'apache', files: ['Ultra-Regular.ttf'] },
];

async function fetchBinary(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const failures = [];
  let fonts = 0;

  for (const family of FAMILIES) {
    const group = family.licence ?? 'ofl';
    const licenceFile = group === 'apache' ? 'LICENSE.txt' : 'OFL.txt';

    // The licence first: a font whose licence cannot be fetched must not ship.
    let licence;
    try {
      licence = await fetchBinary(`${BASE}/${group}/${family.dir}/${licenceFile}`);
    } catch (error) {
      failures.push(`${family.dir}: ${licenceFile} — ${error.message}`);
      continue;
    }

    const got = [];
    for (const file of family.files) {
      const name = file.split('/').pop();
      try {
        const bytes = await fetchBinary(`${BASE}/${group}/${family.dir}/${file}`);
        await writeFile(join(OUT, name), bytes);
        got.push(name);
        fonts++;
      } catch (error) {
        failures.push(`${family.dir}/${file} — ${error.message}`);
      }
    }

    if (got.length > 0) {
      await writeFile(join(OUT, `${family.dir}-${licenceFile}`), licence);
      console.log(`${family.dir} (${group}): ${got.join(', ')}`);
    }
  }

  const present = (await readdir(OUT)).filter((name) => /\.(ttf|otf)$/i.test(name));
  console.log(`\n${fonts} fonts downloaded, ${present.length} in ${OUT}`);
  if (failures.length > 0) {
    console.log(`\n${failures.length} failed:`);
    for (const failure of failures) console.log(`  ${failure}`);
    process.exitCode = 1;
  }
}

await main();
