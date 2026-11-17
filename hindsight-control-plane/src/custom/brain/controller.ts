import type { GraphNode } from "../../components/graph-data";
import { graphPalette } from "../theme/graph-palette";
import {
  blitCameraSnapshot,
  graphDevicePixelRatio,
  prefersReducedMotion,
  retainCameraSnapshot,
  type CameraSnapshot,
} from "../graph/frame";
import { cameraMoving, watchBrainCanvas, type BrainRenderer } from "./render-model";
import type { BrainScene } from "./scene";

export function createBrainCamera() {
  return {
    W: 0,
    H: 0,
    dpr: 1,
    panX: 0,
    panY: 0,
    zoom: 0.5,
    targetPanX: 0,
    targetPanY: 0,
    targetZoom: 0.5,
    mouseX: -1,
    mouseY: -1,
    hoverIndex: -1,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    panStartX: 0,
    panStartY: 0,
  };
}

/** Retain the existing mouse/camera behaviour; no touch or bank-reset changes here. */
export function mountBrainCanvas(
  canvas: HTMLCanvasElement,
  renderer: BrainRenderer,
  scene: BrainScene,
  camera: ReturnType<typeof createBrainCamera>,
  onNodeClick?: (node: GraphNode) => void,
  size?: (node: GraphNode) => number
) {
  let frame = 0;
  let painted = false;
  let paintedHover = -2;
  let presentedBlit = false;
  let snapshot: CameraSnapshot | null = null;
  const reduceMotion = prefersReducedMotion();
  const screenX = new Float32Array(scene.nodes.length);
  const screenY = new Float32Array(scene.nodes.length);
  const project = () => {
    for (let index = 0; index < scene.nodes.length; index++) {
      const node = scene.nodes[index];
      screenX[index] = camera.W / 2 + camera.panX + node.wx * camera.zoom;
      screenY[index] = camera.H / 2 + camera.panY + node.wy * camera.zoom;
    }
  };
  const draw = () => {
    frame = 0;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rendered = {
      W: camera.W,
      H: camera.H,
      dpr: camera.dpr,
      panX: camera.panX,
      panY: camera.panY,
      zoom: camera.zoom,
    };
    if (reduceMotion) {
      camera.panX = camera.targetPanX;
      camera.panY = camera.targetPanY;
      camera.zoom = camera.targetZoom;
    } else {
      camera.panX += (camera.targetPanX - camera.panX) * 0.12;
      camera.panY += (camera.targetPanY - camera.panY) * 0.12;
      camera.zoom += (camera.targetZoom - camera.zoom) * 0.12;
    }
    const moving = cameraMoving(camera);
    if (moving) {
      if (!snapshot?.active) snapshot = retainCameraSnapshot(canvas, rendered, snapshot);
      if (snapshot?.active) {
        blitCameraSnapshot(
          ctx,
          snapshot,
          camera,
          graphPalette(document.documentElement.classList.contains("dark")).background
        );
        presentedBlit = true;
        frame = requestAnimationFrame(draw);
        return;
      }
    }
    const wasBlit = presentedBlit;
    presentedBlit = false;
    if (snapshot) snapshot.active = false;
    project();
    let nextHover = camera.mouseX < 0 ? -1 : camera.hoverIndex;
    if (camera.mouseX >= 0 && !camera.isDragging) {
      let distance = camera.zoom > 1.5 ? 80 : 30;
      nextHover = -1;
      for (let index = 0; index < scene.nodes.length; index++) {
        if (
          screenX[index] < -60 ||
          screenX[index] > camera.W + 60 ||
          screenY[index] < -60 ||
          screenY[index] > camera.H + 60
        )
          continue;
        const candidate = Math.hypot(
          camera.mouseX - screenX[index],
          camera.mouseY - screenY[index]
        );
        if (candidate < distance) {
          distance = candidate;
          nextHover = index;
        }
      }
    }
    if (painted && !moving && !wasBlit && nextHover === paintedHover) return;
    camera.hoverIndex = nextHover;
    paintedHover = nextHover;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(camera.dpr, camera.dpr);
    renderer.decoration(ctx, camera);
    renderer.links(ctx, screenX, screenY, scene.links, camera.hoverIndex, camera);
    const neighbours = scene.neighbours.get(camera.hoverIndex);
    const order = scene.nodes
      .map((_, index) => index)
      .filter((index) => index !== camera.hoverIndex);
    if (camera.hoverIndex >= 0 && scene.nodes[camera.hoverIndex]) order.push(camera.hoverIndex);
    for (const index of order) {
      if (
        screenX[index] < -60 ||
        screenX[index] > camera.W + 60 ||
        screenY[index] < -60 ||
        screenY[index] > camera.H + 60
      )
        continue;
      const node = scene.nodes[index];
      renderer.node(
        ctx,
        node,
        screenX[index],
        screenY[index],
        index === camera.hoverIndex,
        neighbours?.has(index) ?? false,
        camera.hoverIndex >= 0,
        size?.(node.node)
      );
    }
    ctx.restore();
    painted = true;
    if (moving) frame = requestAnimationFrame(draw);
  };
  const redraw = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  };
  const measure = (refit: boolean) => {
    const rect = canvas.getBoundingClientRect();
    camera.W = rect.width;
    camera.H = rect.height;
    if (snapshot) snapshot.active = false;
    camera.dpr = graphDevicePixelRatio(rect.width, rect.height);
    canvas.width = camera.W * camera.dpr;
    canvas.height = camera.H * camera.dpr;
    painted = false;
    if (refit) camera.zoom = camera.targetZoom = renderer.fitZoom(camera.W, camera.H);
    redraw();
  };
  const resize = () => measure(true);
  const move = (event: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    camera.mouseX = event.clientX - rect.left;
    camera.mouseY = event.clientY - rect.top;
    if (camera.isDragging) {
      camera.targetPanX = camera.panStartX + event.clientX - camera.dragStartX;
      camera.targetPanY = camera.panStartY + event.clientY - camera.dragStartY;
      canvas.style.cursor = "grabbing";
    } else canvas.style.cursor = camera.hoverIndex >= 0 ? "pointer" : "default";
  };
  const down = (event: MouseEvent) => {
    camera.isDragging = true;
    camera.dragStartX = event.clientX;
    camera.dragStartY = event.clientY;
    camera.panStartX = camera.panX;
    camera.panStartY = camera.panY;
  };
  const up = () => {
    if (
      camera.isDragging &&
      Math.abs(camera.panX - camera.panStartX) < 3 &&
      Math.abs(camera.panY - camera.panStartY) < 3 &&
      camera.hoverIndex >= 0
    ) {
      const node = scene.nodes[camera.hoverIndex]?.node;
      if (node) onNodeClick?.(node);
    }
    camera.isDragging = false;
    canvas.style.cursor = camera.hoverIndex >= 0 ? "pointer" : "default";
  };
  const leave = () => {
    camera.mouseX = camera.mouseY = camera.hoverIndex = -1;
    camera.isDragging = false;
  };
  const wheel = (event: WheelEvent) => {
    event.preventDefault();
    camera.targetZoom = Math.max(
      0.03,
      Math.min(8, camera.targetZoom * (event.deltaY > 0 ? 0.9 : 1.1))
    );
  };
  const onVisibility = () => {
    if (!document.hidden) return;
    cancelAnimationFrame(frame);
    frame = 0;
  };
  canvas.addEventListener("mousemove", move);
  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("mousedown", down);
  canvas.addEventListener("mouseup", up);
  canvas.addEventListener("mouseleave", leave);
  canvas.addEventListener("wheel", wheel, { passive: false });
  const stopRedraw = watchBrainCanvas(canvas, redraw);
  window.addEventListener("resize", resize);
  const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
  observer?.observe(canvas);
  resize();
  // Keep the existing post-layout remeasure used by the fullscreen control.
  const timer = setTimeout(() => measure(false), 50);
  return {
    exportSvg: () =>
      downloadBrainSvg(renderer.svg(camera, scene.nodes, scene.links, camera.hoverIndex, size)),
    dispose() {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
      observer?.disconnect();
      stopRedraw();
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", move);
      canvas.removeEventListener("mousedown", down);
      canvas.removeEventListener("mouseup", up);
      canvas.removeEventListener("mouseleave", leave);
      canvas.removeEventListener("wheel", wheel);
    },
  };
}

function downloadBrainSvg(svg: string) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "hindsight-constellation.svg";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
