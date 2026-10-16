import type { GraphNode } from "../../components/graph-data";
import type { Point2 } from "./types";
import type { ReactNode } from "react";
import type { ConstellationProps } from "../../components/constellation";

export interface BrainView {
  W: number;
  H: number;
  zoom: number;
  panX: number;
  panY: number;
}

export interface BrainNodeStyle {
  node: GraphNode;
  wx: number;
  wy: number;
  heatColor: string;
  linkCount: number;
}

export interface BrainLinkStyle {
  a: number;
  b: number;
  color: string;
  type: string;
}

/** One dispatch boundary keeps the custom view's entire lifecycle out of upstream code. */
export interface BrainRenderer {
  render: (props: ConstellationProps) => ReactNode;
  positions: ReadonlyMap<string, Point2>;
  fitZoom: (width: number, height: number) => number;
  decoration: (ctx: CanvasRenderingContext2D, view: BrainView) => void;
  links: (
    ctx: CanvasRenderingContext2D,
    x: Float32Array,
    y: Float32Array,
    links: readonly BrainLinkStyle[],
    hover: number
  ) => number;
  node: (
    ctx: CanvasRenderingContext2D,
    node: BrainNodeStyle,
    x: number,
    y: number,
    hovered: boolean,
    neighbor: boolean,
    dimmed: boolean,
    size?: number
  ) => number;
  svg: (
    view: BrainView,
    nodes: readonly BrainNodeStyle[],
    links: readonly BrainLinkStyle[],
    hover: number,
    size?: (node: GraphNode) => number
  ) => string;
}

export function cameraMoving(
  state: BrainView & { targetPanX: number; targetPanY: number; targetZoom: number }
): boolean {
  return (
    Math.abs(state.panX - state.targetPanX) +
      Math.abs(state.panY - state.targetPanY) +
      Math.abs(state.zoom - state.targetZoom) >
    0.001
  );
}

/** Request frames only after interactions; a paused/static brain has no ambient RAF loop. */
export function watchBrainCanvas(canvas: HTMLCanvasElement, redraw: () => void): () => void {
  const events = ["mousemove", "mousedown", "mouseup", "mouseleave", "wheel"] as const;
  for (const event of events) canvas.addEventListener(event, redraw);
  return () => {
    for (const event of events) canvas.removeEventListener(event, redraw);
  };
}
