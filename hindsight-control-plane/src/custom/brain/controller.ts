import type { GraphNode } from "../../components/graph-data";
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
  const draw = () => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    camera.panX += (camera.targetPanX - camera.panX) * 0.12;
    camera.panY += (camera.targetPanY - camera.panY) * 0.12;
    camera.zoom += (camera.targetZoom - camera.zoom) * 0.12;
    const x = new Float32Array(
      scene.nodes.map((node) => camera.W / 2 + camera.panX + node.wx * camera.zoom)
    );
    const y = new Float32Array(
      scene.nodes.map((node) => camera.H / 2 + camera.panY + node.wy * camera.zoom)
    );
    if (camera.mouseX >= 0 && !camera.isDragging) {
      let distance = camera.zoom > 1.5 ? 80 : 30;
      camera.hoverIndex = -1;
      for (let index = 0; index < scene.nodes.length; index++) {
        if (
          x[index] < -60 ||
          x[index] > camera.W + 60 ||
          y[index] < -60 ||
          y[index] > camera.H + 60
        )
          continue;
        const candidate = Math.hypot(camera.mouseX - x[index], camera.mouseY - y[index]);
        if (candidate < distance) {
          distance = candidate;
          camera.hoverIndex = index;
        }
      }
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(camera.dpr, camera.dpr);
    renderer.decoration(ctx, camera);
    renderer.links(ctx, x, y, scene.links, camera.hoverIndex);
    const neighbours = scene.neighbours.get(camera.hoverIndex);
    const order = scene.nodes
      .map((_, index) => index)
      .filter((index) => index !== camera.hoverIndex);
    if (camera.hoverIndex >= 0 && scene.nodes[camera.hoverIndex]) order.push(camera.hoverIndex);
    for (const index of order) {
      if (x[index] < -60 || x[index] > camera.W + 60 || y[index] < -60 || y[index] > camera.H + 60)
        continue;
      const node = scene.nodes[index];
      renderer.node(
        ctx,
        node,
        x[index],
        y[index],
        index === camera.hoverIndex,
        neighbours?.has(index) ?? false,
        camera.hoverIndex >= 0,
        size?.(node.node)
      );
    }
    ctx.restore();
    if (cameraMoving(camera)) frame = requestAnimationFrame(draw);
  };
  const redraw = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  };
  const measure = (refit: boolean) => {
    const rect = canvas.getBoundingClientRect();
    camera.W = rect.width;
    camera.H = rect.height;
    camera.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = camera.W * camera.dpr;
    canvas.height = camera.H * camera.dpr;
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
  canvas.addEventListener("mousemove", move);
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
