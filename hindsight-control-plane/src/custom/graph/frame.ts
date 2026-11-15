/**
 * Frame budget for the memory graph and the brain canvas.
 *
 * Both views redraw on the main thread. Ambient drift at overview zoom moves
 * less than a pixel per frame, but a full raster of thousands of curves still
 * runs every frame and becomes a long task on a retina buffer or a slow CPU.
 * Sampling waits until that drift is visible, and a gesture reuses the last
 * crisp frame instead of rebuilding the vectors while the camera eases.
 */

export const GRAPH_DPR_CAP = 1.5;
/** Backing-store ceiling. A 1440×700 retina canvas would otherwise be ~4 megapixels. */
export const GRAPH_BACKING_PIXELS = 1_600_000;
const DRIFT_PX_PER_SEC = 9.6;

export interface GraphCamera {
  W: number;
  H: number;
  dpr: number;
  panX: number;
  panY: number;
  zoom: number;
}

export interface CameraSnapshot extends GraphCamera {
  canvas: HTMLCanvasElement;
  active: boolean;
}

export function graphDevicePixelRatio(cssWidth: number, cssHeight: number): number {
  const native = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const area = Math.max(1, cssWidth * cssHeight);
  const areaCap = Math.sqrt(GRAPH_BACKING_PIXELS / area);
  return Math.max(1, Math.min(native, GRAPH_DPR_CAP, areaCap));
}

/** No saved choice follows the OS. An explicit on/off choice wins. */
export function motionStartsPaused(saved: string | null, reduceMotion: boolean): boolean {
  if (saved === "off") return true;
  if (saved === "on") return false;
  return reduceMotion;
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Milliseconds until the next ambient sample. Zoomed-in graphs stay on the next
 * frame. Overview waits until about half a pixel of drift is visible, and a
 * sample that took longer than a frame waits four times that long (at most 1s)
 * so input can run between rasters.
 */
export function ambientDelayMs(zoom: number, costMs: number): number {
  const speed = Math.max(0.35, zoom) * DRIFT_PX_PER_SEC;
  const pixelWait = Math.max(32, Math.min(240, 500 / speed));
  if (pixelWait <= 32) return 32;
  if (costMs > 32) return Math.max(pixelWait, Math.min(1000, costMs * 4));
  return pixelWait;
}

/** High zoom (and the unit-test graphs) stay on the next animation frame. */
export function ambientUsesNextFrame(delayMs: number): boolean {
  return delayMs <= 32;
}

export function snapshotTransform(
  snap: GraphCamera,
  camera: GraphCamera
): { scale: number; tx: number; ty: number } {
  const scale = camera.zoom / (snap.zoom || 1);
  return {
    scale,
    tx: ((camera.W / 2) * (1 - scale) + camera.panX - snap.panX * scale) * camera.dpr,
    ty: ((camera.H / 2) * (1 - scale) + camera.panY - snap.panY * scale) * camera.dpr,
  };
}

let snapshotUnsupported = false;

export function retainCameraSnapshot(
  source: HTMLCanvasElement,
  camera: GraphCamera,
  current: CameraSnapshot | null
): CameraSnapshot | null {
  if (snapshotUnsupported || !source.width || !source.height) return current;
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe || typeof probe.drawImage !== "function") {
    snapshotUnsupported = true;
    return current;
  }
  const snap = current ?? { canvas: document.createElement("canvas"), active: false, ...camera };
  if (snap.canvas.width !== source.width || snap.canvas.height !== source.height) {
    snap.canvas.width = source.width;
    snap.canvas.height = source.height;
  }
  const ctx = snap.canvas.getContext("2d");
  if (!ctx) return current;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, snap.canvas.width, snap.canvas.height);
  ctx.drawImage(source, 0, 0);
  snap.W = camera.W;
  snap.H = camera.H;
  snap.dpr = camera.dpr;
  snap.panX = camera.panX;
  snap.panY = camera.panY;
  snap.zoom = camera.zoom;
  snap.active = true;
  return snap;
}

export function blitCameraSnapshot(
  ctx: CanvasRenderingContext2D,
  snap: CameraSnapshot,
  camera: GraphCamera,
  background: string
): void {
  const { scale, tx, ty } = snapshotTransform(snap, camera);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(scale, 0, 0, scale, tx, ty);
  ctx.drawImage(snap.canvas, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
