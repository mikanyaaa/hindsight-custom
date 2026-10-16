export interface Point2 {
  readonly x: number;
  readonly y: number;
}

export interface Point3 extends Point2 {
  readonly z: number;
}

export type Hemisphere = "left" | "right";

export interface ProjectedPoint extends Point2 {
  /** Camera-space depth; larger values are nearer the viewer. */
  readonly depth: number;
}

export interface BrainBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface BrainNodeInput {
  readonly id: string;
  /** Stable scope key, never a group index or a list of currently visible groups. */
  readonly group?: string;
}

export interface BrainNodePosition {
  readonly id: string;
  readonly hemisphere: Hemisphere;
  readonly position: Point3;
  readonly projected: ProjectedPoint;
}

export interface BrainLayout {
  readonly version: string;
  readonly nodes: readonly BrainNodePosition[];
  /** Fixed geometry bounds, including for empty layouts, so filtering never refits the camera. */
  readonly bounds: BrainBounds;
}
