"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { ArrowUpRight, Maximize, Minus, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { GraphNode } from "@/components/graph-data";
import { mapCopyFor } from "./copy";
import { layoutAtlas, type AtlasModel, type AtlasNode, type Point } from "./layout";
import styles from "./atlas-map.module.css";

interface AtlasMapProps {
  model: AtlasModel | null;
  loading?: boolean;
  error?: boolean;
  onNodeClick?: (node: GraphNode) => void;
  onOpenGraph?: () => void;
}

interface Camera extends Point {
  scale: number;
}

interface Drag {
  pointerId: number;
  origin: Point;
  camera: Camera;
  moved: boolean;
}

const fitCamera: Camera = { x: 0, y: 0, scale: 1 };
const initialSize = { width: 1200, height: 405 };
const minScale = 0.67;
const maxScale = 3;
const tones = [
  ["#057aff", "#0c8dff", "#00cadc", "#185ff7"],
  ["#d407f4", "#b23dff", "#ff19bb", "#814bff"],
  ["#ff710b", "#fc4b22", "#ffad18", "#ff512d"],
  ["#73849d", "#8193ae", "#7489a7", "#73849d"],
];
const navigation: Record<string, Point | undefined> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

function closestNode(nodes: AtlasNode[], node: AtlasNode, direction: Point) {
  let closest: AtlasNode | undefined;
  let best = Infinity;
  for (const candidate of nodes) {
    const dx = candidate.x - node.x;
    const dy = candidate.y - node.y;
    const along = dx * direction.x + dy * direction.y;
    if (along <= 0) continue;
    const across = Math.abs(dx * direction.y - dy * direction.x);
    const cost = along + 2.4 * across + (across * across) / along;
    if (cost < best) {
      closest = candidate;
      best = cost;
    }
  }
  return closest;
}

function nodeTone(node: AtlasNode) {
  const index = node.featured ? 0 : 1 + ((Math.round(node.x * 13 + node.y * 11) >>> 0) % 3);
  return `${node.tone}-${index}`;
}

export function AtlasMap({
  model,
  loading = false,
  error = false,
  onNodeClick,
  onOpenGraph,
}: AtlasMapProps) {
  const copy = mapCopyFor(useLocale());
  const home = useTranslations("home");
  const common = useTranslations("common");
  const controls = useTranslations("dataView");
  const mapId = useId();
  const panel = useRef<HTMLElement>(null);
  const drag = useRef<Drag | null>(null);
  const dragged = useRef(false);
  const nodesById = useRef(new Map<string, SVGGElement>());
  const [size, setSize] = useState(initialSize);
  const [camera, setCamera] = useState(fitCamera);
  const [activeId, setActiveId] = useState<string | null>(null);
  const layout = useMemo(() => model && layoutAtlas(model, size.width, size.height), [model, size]);
  const orderedNodes = useMemo(
    () => layout && [...layout.nodes].sort((a, b) => Number(a.featured) - Number(b.featured)),
    [layout]
  );
  const ready = !loading && !error && Boolean(layout?.nodes.length);
  const start = layout?.nodes.find((node) => node.featured) ?? layout?.nodes[0];
  const currentId = layout?.nodes.some((node) => node.memory.id === activeId)
    ? activeId
    : start?.memory.id;

  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    const measure = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      if (width && height) {
        setSize((current) =>
          current.width === width && current.height === height ? current : { width, height }
        );
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function zoom(factor: number) {
    setCamera((current) => {
      const scale = Math.max(minScale, Math.min(maxScale, current.scale * factor));
      const ratio = scale / current.scale;
      return { scale, x: current.x * ratio, y: current.y * ratio };
    });
  }

  function showNode(node: AtlasNode) {
    setActiveId(node.memory.id);
    setCamera((current) => {
      const x = (node.x - size.width / 2) * current.scale + size.width / 2 + current.x;
      const y = (node.y - size.height / 2) * current.scale + size.height / 2 + current.y;
      if (x >= 22 && x <= size.width - 22 && y >= 40 && y <= size.height - 39) return current;
      return { ...current, x: current.x + size.width / 2 - x, y: current.y + size.height / 2 - y };
    });
  }

  function keyDown(event: KeyboardEvent<SVGGElement>, node: AtlasNode) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onNodeClick?.(node.memory);
      return;
    }
    const direction = Object.hasOwn(navigation, event.key) ? navigation[event.key] : undefined;
    if (!direction || !layout) return;
    event.preventDefault();
    const next = closestNode(layout.nodes, node, direction);
    if (next) nodesById.current.get(next.memory.id)?.focus();
  }

  function openFromPointer(event: MouseEvent<SVGGElement>, node: AtlasNode) {
    if (!onNodeClick || (event.detail !== 0 && dragged.current)) return;
    const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    const onLabel = event.target instanceof Element && event.target.closest("foreignObject");
    if (!layout || !rect?.width || !rect.height || !event.detail || onLabel) {
      onNodeClick(node.memory);
      return;
    }

    // Interaction circles can overlap on narrow screens. Resolve a tap to
    // the nearest visible center so the last-drawn node doesn't win by default.
    const x = ((event.clientX - rect.left) * size.width) / rect.width;
    const y = ((event.clientY - rect.top) * size.height) / rect.height;
    const mapX = (x - size.width / 2 - camera.x) / camera.scale + size.width / 2;
    const mapY = (y - size.height / 2 - camera.y) / camera.scale + size.height / 2;
    const distance = (point: Point) => (point.x - mapX) ** 2 + (point.y - mapY) ** 2;
    const nearest = layout.nodes.reduce(
      (current, candidate) => (distance(candidate) < distance(current) ? candidate : current),
      node
    );
    onNodeClick(nearest.memory);
  }

  function pointerDown(event: PointerEvent<SVGSVGElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    dragged.current = false;
    drag.current = {
      pointerId: event.pointerId,
      origin: { x: event.clientX, y: event.clientY },
      camera,
      moved: false,
    };
  }

  function pointerMove(event: PointerEvent<SVGSVGElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.origin.x;
    const dy = event.clientY - current.origin.y;
    if (!current.moved) {
      if (Math.hypot(dx, dy) < 5) return;
      current.moved = true;
      dragged.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setCamera({ ...current.camera, x: current.camera.x + dx, y: current.camera.y + dy });
  }

  function pointerEnd(event: PointerEvent<SVGSVGElement>) {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  }

  return (
    <section
      className={styles.map}
      ref={panel}
      aria-labelledby={`${mapId}-title`}
      aria-busy={loading}
    >
      <h2 className={styles.heading} id={`${mapId}-title`}>
        {copy.title}
      </h2>
      {onOpenGraph && (
        <button
          type="button"
          className={styles.explore}
          title={copy.explore}
          aria-label={copy.explore}
          onClick={onOpenGraph}
        >
          <ArrowUpRight aria-hidden />
        </button>
      )}
      {!ready || !layout || !orderedNodes ? (
        <p className={styles.message} role="status">
          {loading ? common("loading") : error ? copy.error : home("constellationEmpty")}
        </p>
      ) : (
        <>
          {onNodeClick && (
            <p className="sr-only" id={`${mapId}-keys`}>
              {copy.keyboard}
            </p>
          )}
          <svg
            className={styles.scene}
            viewBox={`0 0 ${size.width} ${size.height}`}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerEnd}
            onPointerCancel={pointerEnd}
            onPointerLeave={(event) => {
              if (!drag.current?.moved) pointerEnd(event);
            }}
          >
            <defs>
              {tones.map(([color], index) => (
                <radialGradient key={color} id={`${mapId}-bloom-${index}`}>
                  <stop offset="0%" stopColor={color} stopOpacity="0.28" />
                  <stop offset="36%" stopColor={color} stopOpacity="0.14" />
                  <stop offset="76%" stopColor={color} stopOpacity="0.036" />
                  <stop offset="100%" stopColor={color} stopOpacity="0" />
                </radialGradient>
              ))}
              {tones.flatMap((band, tone) =>
                band.map((color, index) => (
                  <radialGradient
                    key={`${tone}-${index}`}
                    id={`${mapId}-orb-${tone}-${index}`}
                    cx="32%"
                    cy="21%"
                    r="82%"
                  >
                    <stop offset="0%" stopColor="#fff" />
                    <stop offset="17%" stopColor={`color-mix(in srgb, ${color} 53%, white)`} />
                    <stop offset="48%" stopColor={color} />
                    <stop offset="100%" stopColor={`color-mix(in srgb, ${color} 77%, #111537)`} />
                  </radialGradient>
                ))
              )}
            </defs>
            <g
              transform={`translate(${size.width / 2 + camera.x} ${size.height / 2 + camera.y}) scale(${camera.scale}) translate(${-size.width / 2} ${-size.height / 2})`}
            >
              <g aria-hidden="true" pointerEvents="none">
                {layout.blooms.map((bloom, index) => (
                  <ellipse
                    key={index}
                    className={styles.bloom}
                    cx={bloom.x}
                    cy={bloom.y}
                    rx={bloom.rx * (bloom.featured ? 1.58 : 1.32)}
                    ry={bloom.ry * (bloom.featured ? 1.56 : 1.24)}
                    fill={`url(#${mapId}-bloom-${bloom.tone})`}
                  />
                ))}
                {layout.edges.map(({ source, target, strength }) => (
                  <line
                    key={`${source.memory.id}:${target.memory.id}`}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={source.tone === target.tone ? tones[source.tone][1] : tones[1][3]}
                    strokeOpacity={
                      (source.tone === target.tone ? 0.46 : 0.32) *
                      Math.min(1.3, Math.sqrt(strength))
                    }
                    strokeWidth={source.featured || target.featured ? 1.05 : 0.68}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {layout.nodes.map((node) => (
                  <circle
                    key={node.memory.id}
                    className={styles.orb}
                    cx={node.x}
                    cy={node.y}
                    r={node.radius}
                    color={tones[node.tone][0]}
                    fill={`url(#${mapId}-orb-${nodeTone(node)})`}
                  />
                ))}
              </g>
              {orderedNodes.map((node) => {
                const id = node.memory.id;
                const compact = size.width < 640;
                const screenX =
                  (node.x - size.width / 2) * camera.scale + size.width / 2 + camera.x;
                const labelOffset = node.radius * camera.scale + (compact ? 8 : 12);
                const labelLimit = compact ? 160 : 236;
                const leftSpace = screenX - labelOffset - 14;
                const rightSpace = size.width - screenX - labelOffset - 14;
                const labelLeft = rightSpace < labelLimit && leftSpace > rightSpace;
                const labelWidth = Math.min(labelLimit, labelLeft ? leftSpace : rightSpace);
                const labelX = labelLeft ? -labelOffset - labelWidth : labelOffset;
                return (
                  <g
                    key={id}
                    transform={`translate(${node.x} ${node.y})`}
                    className={onNodeClick ? styles.node : undefined}
                    color={tones[node.tone][0]}
                    onClick={onNodeClick ? (event) => openFromPointer(event, node) : undefined}
                  >
                    <title>{node.name}</title>
                    {onNodeClick && (
                      <g
                        className={styles.target}
                        role="button"
                        tabIndex={id === currentId ? 0 : -1}
                        aria-label={node.name}
                        aria-describedby={`${mapId}-keys`}
                        ref={(element) => {
                          if (element) nodesById.current.set(id, element);
                          else nodesById.current.delete(id);
                        }}
                        onFocus={() => showNode(node)}
                        onKeyDown={(event) => keyDown(event, node)}
                      >
                        <circle
                          className={styles.focusRing}
                          r={node.radius + 4}
                          fill="none"
                          stroke="currentColor"
                          vectorEffect="non-scaling-stroke"
                        />
                        <circle
                          r={Math.max(node.radius + 4, compact ? 12 : 9)}
                          fill="transparent"
                        />
                      </g>
                    )}
                    {node.label && labelWidth >= 56 && (
                      <g transform={`scale(${1 / camera.scale})`}>
                        <foreignObject
                          x={labelX}
                          y={compact ? -14 : -19}
                          width={labelWidth}
                          height={compact ? 28 : 38}
                          pointerEvents="none"
                        >
                          <div
                            className={styles.labelArea}
                            data-align={labelLeft ? "left" : "right"}
                          >
                            <div className={styles.label} aria-hidden="true" title={node.name}>
                              <span className={styles.dot} />
                              <span className={styles.labelText}>{node.label}</span>
                            </div>
                          </div>
                        </foreignObject>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
          <div className={styles.controls}>
            <button
              type="button"
              aria-label={controls("zoomOut")}
              title={controls("zoomOut")}
              disabled={camera.scale <= minScale}
              onClick={() => zoom(0.8)}
            >
              <Minus aria-hidden />
            </button>
            <button
              type="button"
              aria-label={controls("zoomIn")}
              title={controls("zoomIn")}
              disabled={camera.scale >= maxScale}
              onClick={() => zoom(1.25)}
            >
              <Plus aria-hidden />
            </button>
            <button
              type="button"
              aria-label={copy.fit}
              title={copy.fit}
              onClick={() => setCamera(fitCamera)}
            >
              <Maximize aria-hidden />
            </button>
          </div>
        </>
      )}
    </section>
  );
}
