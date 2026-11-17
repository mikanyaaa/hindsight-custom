/**
 * Level of detail for the memory-graph canvas.
 *
 * A settled frame strokes up to 6,000 quadratic curves on the main thread.
 * Curves whose ends both sit off screen still get drawn when they merely
 * cross the window, and each of those spans the whole canvas. Rasterizing a
 * few thousand of them is a long task (about 80ms here, several times that
 * on a slowed CPU). The same full stroke was scheduled on every pointer move,
 * including moves that did not change the hovered node, so panning, zooming
 * and hovering all waited on it.
 *
 * Edges stay in the picture when both ends are on screen, which is the whole
 * graph at the fitted overview. Hover still draws every link of the focused
 * node, including spokes that leave the view. Pointer moves repaint only when
 * the camera is being dragged or the hovered node changes.
 */

export interface StrokeBatch {
  capacity: number;
  count: number;
  coords: Float32Array;
  colorIds: Uint8Array;
  colors: string[];
  lookup: Map<string, number>;
  /** Scratch for strokeCurves, reused so a frame does not allocate a colour list. */
  seen: Uint8Array;
  used: number[];
}

export function bothEndpointsOnScreen(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  width: number,
  height: number,
  margin: number
): boolean {
  return (
    ax >= -margin &&
    ax <= width + margin &&
    ay >= -margin &&
    ay <= height + margin &&
    bx >= -margin &&
    bx <= width + margin &&
    by >= -margin &&
    by <= height + margin
  );
}

/** Dragging always paints. A still pointer paints only when the hit node changes. */
export function pointerNeedsFrame(
  dragging: boolean,
  previousHover: number,
  nextHover: number
): boolean {
  return dragging || previousHover !== nextHover;
}

export function hoverPickRadius(zoom: number): number {
  return zoom > 1.5 ? 80 : 30;
}

/** Nearest visible node within `radius` CSS pixels, or -1. Distance is compared squared. */
export function pickNode(
  mouseX: number,
  mouseY: number,
  screenX: ArrayLike<number>,
  screenY: ArrayLike<number>,
  visible: ArrayLike<number>,
  count: number,
  radius: number
): number {
  let best = radius * radius;
  let bestIndex = -1;
  for (let i = 0; i < count; i++) {
    if (!visible[i]) continue;
    const dx = mouseX - screenX[i];
    const dy = mouseY - screenY[i];
    const dist = dx * dx + dy * dy;
    if (dist < best) {
      best = dist;
      bestIndex = i;
    }
  }
  return bestIndex;
}

export function createStrokeBatch(capacity: number): StrokeBatch {
  return {
    capacity,
    count: 0,
    coords: new Float32Array(capacity * 6),
    colorIds: new Uint8Array(capacity),
    colors: [],
    lookup: new Map(),
    seen: new Uint8Array(256),
    used: [],
  };
}

export function clearStrokeBatch(batch: StrokeBatch): void {
  batch.count = 0;
}

/**
 * Record one quadratic curve. The control point matches the on-canvas bow
 * (8% of the segment, perpendicular). Returns false when the batch is full.
 */
export function pushCurve(
  batch: StrokeBatch,
  color: string,
  ax: number,
  ay: number,
  bx: number,
  by: number
): boolean {
  if (batch.count >= batch.capacity) return false;
  let id = batch.lookup.get(color);
  if (id === undefined) {
    id = batch.colors.length;
    if (id > 255) return false;
    batch.colors.push(color);
    batch.lookup.set(color, id);
  }
  const offset = batch.count * 6;
  batch.coords[offset] = ax;
  batch.coords[offset + 1] = ay;
  batch.coords[offset + 2] = (ax + bx) / 2 + (by - ay) * 0.08;
  batch.coords[offset + 3] = (ay + by) / 2 - (bx - ax) * 0.08;
  batch.coords[offset + 4] = bx;
  batch.coords[offset + 5] = by;
  batch.colorIds[batch.count] = id;
  batch.count += 1;
  return true;
}

/** One stroke per colour actually used this frame. Thousands of separate strokes were most of the frame. */
export function strokeCurves(
  ctx: CanvasRenderingContext2D,
  batch: StrokeBatch,
  alpha: number,
  lineWidth: number
): void {
  if (batch.count === 0) {
    ctx.globalAlpha = 1;
    return;
  }
  const seen = batch.seen;
  const used = batch.used;
  seen.fill(0);
  used.length = 0;
  for (let i = 0; i < batch.count; i++) {
    const id = batch.colorIds[i];
    if (seen[id]) continue;
    seen[id] = 1;
    used.push(id);
  }
  ctx.lineWidth = lineWidth;
  ctx.globalAlpha = alpha;
  for (const slot of used) {
    ctx.beginPath();
    ctx.strokeStyle = batch.colors[slot];
    for (let i = 0; i < batch.count; i++) {
      if (batch.colorIds[i] !== slot) continue;
      const offset = i * 6;
      ctx.moveTo(batch.coords[offset], batch.coords[offset + 1]);
      ctx.quadraticCurveTo(
        batch.coords[offset + 2],
        batch.coords[offset + 3],
        batch.coords[offset + 4],
        batch.coords[offset + 5]
      );
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
