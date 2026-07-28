import {
  StitchCommand,
  threadToHex,
  type BoundingBox,
  type EmbPattern,
  type Point,
} from '@embroider-design/engine';
import type { ViewTransform } from '../state/document-store.js';
import { toScreen } from './render.js';

/**
 * Drawing a compiled pattern.
 *
 * This is the honest view: every segment drawn is a stitch the machine will
 * make, in the thread it will make it with. Jumps and trims are drawn too,
 * dimmed, because a design that looks right but is full of jumps is a design
 * that sews badly.
 */

export interface PreviewOptions {
  /** Draw travel moves and trims. */
  showJumps?: boolean;
  /** Stop after this many stitches, for playback. */
  upTo?: number;
  /** Only draw blocks whose index is in this set. */
  visibleBlocks?: Set<number>;
  /** Clip to a region, used to overlay a single text layer on the editor. */
  onlyBounds?: BoundingBox | null;
  /** Highlight the needle position at `upTo`. */
  showNeedle?: boolean;
}

const JUMP_COLOR = 'rgba(255, 255, 255, 0.22)';
const TRIM_COLOR = 'rgba(255, 120, 120, 0.55)';

export function drawPattern(
  context: CanvasRenderingContext2D,
  view: ViewTransform,
  pattern: EmbPattern,
  options: PreviewOptions = {},
): void {
  const stitches = pattern.stitches;
  if (stitches.length === 0) return;

  const limit = Math.min(options.upTo ?? stitches.length, stitches.length);
  const bounds = options.onlyBounds ?? null;
  const inBounds = (p: Point): boolean =>
    !bounds ||
    (p.x >= bounds.minX - 1 && p.x <= bounds.maxX + 1 && p.y >= bounds.minY - 1 && p.y <= bounds.maxY + 1);

  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.lineWidth = Math.max(1, 3 * view.zoom);

  let blockIndex = 0;
  let color = threadToHex(pattern.getThread(0));
  let previous: Point | null = null;
  let needle: Point | null = null;
  let drawing = false;

  const flush = (): void => {
    if (drawing) {
      context.stroke();
      drawing = false;
    }
  };

  const beginPath = (strokeStyle: string, width: number): void => {
    flush();
    context.beginPath();
    context.strokeStyle = strokeStyle;
    context.lineWidth = width;
    drawing = true;
  };

  let currentStyle = '';
  for (let i = 0; i < limit; i++) {
    const stitch = stitches[i];
    const point: Point = { x: stitch.x, y: stitch.y };
    const blockVisible = !options.visibleBlocks || options.visibleBlocks.has(blockIndex);

    switch (stitch.command) {
      case StitchCommand.STITCH: {
        if (previous && blockVisible && inBounds(point) && inBounds(previous)) {
          if (currentStyle !== color) {
            beginPath(color, Math.max(1, 3 * view.zoom));
            currentStyle = color;
            const from = toScreen(view, previous);
            context.moveTo(from.x, from.y);
          } else if (!drawing) {
            beginPath(color, Math.max(1, 3 * view.zoom));
            const from = toScreen(view, previous);
            context.moveTo(from.x, from.y);
          }
          const to = toScreen(view, point);
          context.lineTo(to.x, to.y);
        }
        break;
      }
      case StitchCommand.JUMP: {
        if (options.showJumps && previous && blockVisible) {
          beginPath(JUMP_COLOR, 1);
          currentStyle = JUMP_COLOR;
          const from = toScreen(view, previous);
          const to = toScreen(view, point);
          context.moveTo(from.x, from.y);
          context.lineTo(to.x, to.y);
          flush();
          currentStyle = '';
        } else {
          flush();
          currentStyle = '';
        }
        break;
      }
      case StitchCommand.TRIM: {
        if (options.showJumps && blockVisible) {
          flush();
          currentStyle = '';
          const p = toScreen(view, point);
          context.strokeStyle = TRIM_COLOR;
          context.lineWidth = 1.5;
          context.beginPath();
          context.moveTo(p.x - 4, p.y - 4);
          context.lineTo(p.x + 4, p.y + 4);
          context.moveTo(p.x + 4, p.y - 4);
          context.lineTo(p.x - 4, p.y + 4);
          context.stroke();
        }
        flush();
        currentStyle = '';
        break;
      }
      case StitchCommand.COLOR_CHANGE: {
        flush();
        currentStyle = '';
        blockIndex++;
        color = threadToHex(pattern.getThread(blockIndex));
        break;
      }
      default:
        flush();
        currentStyle = '';
        break;
    }

    previous = point;
    needle = point;
  }
  flush();

  if (options.showNeedle && needle && limit < stitches.length) {
    const p = toScreen(view, needle);
    context.beginPath();
    context.arc(p.x, p.y, 5, 0, Math.PI * 2);
    context.fillStyle = '#ffffff';
    context.fill();
    context.strokeStyle = '#000000';
    context.lineWidth = 1.5;
    context.stroke();
  }

  context.restore();
}
