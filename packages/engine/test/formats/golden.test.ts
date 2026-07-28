import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Point } from '../../src/geometry/point.js';
import { EmbPattern } from '../../src/pattern/emb-pattern.js';
import {
  appendStitchPath,
  beginColorBlock,
  finishPattern,
} from '../../src/pattern/pattern-builder.js';
import { thread } from '../../src/pattern/thread.js';
import { FORMATS, writePattern } from '../../src/formats/format-registry.js';
import type { JefWriteOptions } from '../../src/formats/jef/jef-writer.js';

/**
 * Byte-for-byte fixtures.
 *
 * The round-trip tests prove our reader agrees with our writer, which is a
 * weaker claim than it sounds — both could drift together and stay
 * self-consistent while the machine stops understanding the file. These
 * fixtures pin the actual bytes, so any change to a header field, a padding
 * rule or an encoding shows up as a failing test rather than as a design that
 * silently will not load on a PE900.
 *
 * Regenerate deliberately, and read the diff, with:
 *   npm run goldens:update -w @embroider-design/engine
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = join(HERE, '..', 'fixtures', 'golden');
const UPDATE = process.env.UPDATE_GOLDENS === '1';

/**
 * A deliberately small, hand-checkable pattern: an L in one colour and a
 * separate diagonal in another. Two colour blocks, one trim-and-jump between
 * them, and coordinates that are exact in every format's integer grid.
 */
function goldenPattern(): EmbPattern {
  const pattern = new EmbPattern();
  pattern.metadata.name = 'Golden';

  const ell: Point[] = [
    { x: 0, y: 0 },
    { x: 0, y: 100 },
    { x: 0, y: 200 },
    { x: 100, y: 200 },
    { x: 200, y: 200 },
  ];
  const diagonal: Point[] = [
    { x: 400, y: 0 },
    { x: 450, y: 50 },
    { x: 500, y: 100 },
  ];

  beginColorBlock(pattern, thread(237, 23, 31, 'Red'));
  appendStitchPath(pattern, ell);
  beginColorBlock(pattern, thread(10, 85, 163, 'Blue'));
  appendStitchPath(pattern, diagonal);
  finishPattern(pattern);
  return pattern;
}

function hexDump(data: Uint8Array, limit = 64): string {
  const bytes = [...data.slice(0, limit)].map((b) => b.toString(16).padStart(2, '0'));
  return bytes.join(' ') + (data.length > limit ? ' …' : '');
}

describe('golden files', () => {
  const pattern = goldenPattern();

  // The name is written into several headers, so pin it too.
  it('the fixture pattern itself has not changed', () => {
    expect(pattern.getStatistics().stitchCount).toBe(8);
    expect(pattern.getColorBlockCount()).toBe(2);
    expect(pattern.getBounds()).toMatchObject({ minX: 0, minY: 0, maxX: 500, maxY: 200 });
  });

  for (const format of FORMATS) {
    it(`${format.name} bytes are unchanged`, () => {
      // JEF stamps a creation time into its header, which would make the
      // fixture differ on every run. The writer takes a fixed date for exactly
      // this reason; every other format is already deterministic.
      const options: JefWriteOptions = { center: true, name: 'Golden', date: '20240101120000' };
      const produced = writePattern(pattern, format.id, options);
      const path = join(GOLDEN_DIR, `golden${format.extension}`);

      if (UPDATE || !existsSync(path)) {
        mkdirSync(GOLDEN_DIR, { recursive: true });
        writeFileSync(path, produced);
        if (!UPDATE) {
          throw new Error(
            `No golden file for ${format.name}; wrote ${path}. Review it and re-run.`,
          );
        }
        return;
      }

      const expected = new Uint8Array(readFileSync(path));
      if (produced.length !== expected.length) {
        throw new Error(
          `${format.name}: ${produced.length} bytes, golden has ${expected.length}.\n` +
            `  produced: ${hexDump(produced)}\n  golden:   ${hexDump(expected)}`,
        );
      }

      const at = produced.findIndex((byte, index) => byte !== expected[index]);
      if (at >= 0) {
        const from = Math.max(0, at - 8);
        throw new Error(
          `${format.name}: first difference at byte 0x${at.toString(16)}.\n` +
            `  produced: ${hexDump(produced.slice(from, from + 24), 24)}\n` +
            `  golden:   ${hexDump(expected.slice(from, from + 24), 24)}`,
        );
      }

      // Cheap identity for the failure message when someone greps the file.
      expect(createHash('sha256').update(produced).digest('hex')).toBe(
        createHash('sha256').update(expected).digest('hex'),
      );
    });
  }
});
