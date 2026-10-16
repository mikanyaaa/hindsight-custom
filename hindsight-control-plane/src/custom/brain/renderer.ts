import { BRAIN_GEOMETRY, projectBrainPoint } from "./geometry";
import type { BrainData } from "./adapter";
import type { BrainLinkStyle, BrainNodeStyle, BrainRenderer, BrainView } from "./render-model";
import { createElement } from "react";
import { BrainCanvas } from "./canvas";

const BACKGROUND = "#0B0726";
const MAX_LINKS = 5000;

function escapeXml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!
  );
}

function safeColor(value: string): string {
  // Canvas and SVG share the same restricted data colours; SVG must never load URL paints.
  return /^(#[\da-f]{3,8}|rgba?\([\d.,%\s]+\)|hsla?\([\d.,%\s]+\))$/i.test(value)
    ? value
    : "#00FFFF";
}

function screen(view: BrainView, x: number, y: number) {
  return { x: view.W / 2 + view.panX + x * view.zoom, y: view.H / 2 + view.panY + y * view.zoom };
}

function paths(x: Float32Array, y: Float32Array, links: readonly BrainLinkStyle[], hover: number) {
  const selected = (
    hover < 0 ? links : links.filter((link) => link.a === hover || link.b === hover)
  ).slice(0, MAX_LINKS);
  return selected.map((link) => {
    const ax = x[link.a];
    const ay = y[link.a];
    const bx = x[link.b];
    const by = y[link.b];
    // Self-links have a visible loop; parallel types remain distinct real relationships.
    const cx = link.a === link.b ? ax + 15 : (ax + bx) / 2 + (by - ay) * 0.08;
    const cy = link.a === link.b ? ay - 18 : (ay + by) / 2 - (bx - ax) * 0.08;
    const endX = link.a === link.b ? bx + 3 : bx;
    const endY = by;
    const angle = Math.atan2(endY - cy, endX - cx);
    return { link, ax, ay, cx, cy, bx: endX, by: endY, color: safeColor(link.color), angle };
  });
}

function nodeAppearance(
  node: BrainNodeStyle,
  hovered: boolean,
  neighbor: boolean,
  dimmed: boolean,
  size?: number
) {
  return {
    // Preserve supplied source-fact size semantics; otherwise use fine, fixed CSS-pixel dots.
    radius: hovered ? Math.max(3.5, size ?? 0) : (size ?? 1.6),
    color: safeColor(node.heatColor),
    alpha: hovered ? 1 : neighbor ? 0.95 : dimmed ? 0.14 : 0.8,
  };
}

export function createBrainRenderer(data: BrainData): BrainRenderer {
  const decoration = [
    ...Object.values(BRAIN_GEOMETRY.hemispheres).map((points) => ({
      points,
      close: true,
      color: "#9D00FF",
      opacity: 0.035,
    })),
    ...BRAIN_GEOMETRY.furrows.map((points) => ({
      points,
      close: false,
      color: "#00FFFF",
      opacity: 0.1,
    })),
    { points: BRAIN_GEOMETRY.fissure, close: false, color: "#FF007F", opacity: 0.1 },
  ].map((curve) => ({
    ...curve,
    points: curve.points.map((point) => data.toWorld(projectBrainPoint({ ...point, z: 0 }))),
  }));

  const renderer: BrainRenderer = {
    render: (options) => createElement(BrainCanvas, { renderer, options }),
    positions: data.positions,
    fitZoom: (width, height) =>
      Math.max(
        0.03,
        Math.min(
          8,
          Math.min(Math.max(1, width - 100) / data.width, Math.max(1, height - 160) / data.height)
        )
      ),
    decoration(ctx, view) {
      ctx.fillStyle = BACKGROUND;
      ctx.fillRect(0, 0, view.W, view.H);
      if (!data.graph.nodes.length) return;
      for (const curve of decoration) {
        ctx.beginPath();
        curve.points.forEach((point, index) => {
          const p = screen(view, point.x, point.y);
          if (index === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.globalAlpha = curve.opacity;
        if (curve.close) {
          ctx.closePath();
          ctx.fillStyle = curve.color;
          ctx.fill();
        } else {
          ctx.strokeStyle = curve.color;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    },
    links(ctx, x, y, links, hover) {
      const edges = paths(x, y, links, hover);
      ctx.globalAlpha = hover < 0 ? 0.18 : 0.5;
      ctx.lineWidth = 0.5;
      for (const edge of edges) {
        ctx.strokeStyle = edge.color;
        ctx.beginPath();
        ctx.moveTo(edge.ax, edge.ay);
        ctx.quadraticCurveTo(edge.cx, edge.cy, edge.bx, edge.by);
        ctx.stroke();
        // Preserve source → target direction without invented animated activity.
        ctx.beginPath();
        ctx.moveTo(
          edge.bx - 3 * Math.cos(edge.angle - 0.5),
          edge.by - 3 * Math.sin(edge.angle - 0.5)
        );
        ctx.lineTo(edge.bx, edge.by);
        ctx.lineTo(
          edge.bx - 3 * Math.cos(edge.angle + 0.5),
          edge.by - 3 * Math.sin(edge.angle + 0.5)
        );
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      return edges.length;
    },
    node(ctx, node, x, y, hovered, neighbor, dimmed, size) {
      const style = nodeAppearance(node, hovered, neighbor, dimmed, size);
      ctx.beginPath();
      ctx.arc(x, y, style.radius, 0, Math.PI * 2);
      ctx.fillStyle = style.color;
      ctx.globalAlpha = style.alpha;
      ctx.shadowColor = style.color;
      ctx.shadowBlur = 0;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      if (hovered) {
        const label = node.node.label ?? node.node.id;
        ctx.font = "11px sans-serif";
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "left";
        ctx.fillText(
          label.length > 80 ? `${label.slice(0, 80)}…` : label,
          x + style.radius + 5,
          y + 4
        );
      }
      return style.radius;
    },
    svg(view, nodes, links, hover, size) {
      // Use the live camera and identical Float32 screen coordinates, edges and radii.
      const x = new Float32Array(nodes.map((node) => screen(view, node.wx, node.wy).x));
      const y = new Float32Array(nodes.map((node) => screen(view, node.wx, node.wy).y));
      const edges = paths(x, y, links, hover);
      const neighbours = new Set(
        links
          .filter((link) => link.a === hover || link.b === hover)
          .flatMap((link) => [link.a, link.b])
      );
      const parts = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${view.W}" height="${view.H}" viewBox="0 0 ${view.W} ${view.H}">`,
        `<rect width="100%" height="100%" fill="${BACKGROUND}"/>`,
      ];
      if (nodes.length)
        for (const curve of decoration) {
          const points = curve.points
            .map((point) => {
              const p = screen(view, point.x, point.y);
              return `${p.x},${p.y}`;
            })
            .join(" ");
          parts.push(
            curve.close
              ? `<polygon points="${points}" fill="${curve.color}" opacity="${curve.opacity}"/>`
              : `<polyline points="${points}" fill="none" stroke="${curve.color}" stroke-width="0.5" opacity="${curve.opacity}"/>`
          );
        }
      for (const edge of edges) {
        const arrow = `M${edge.bx - 3 * Math.cos(edge.angle - 0.5)} ${edge.by - 3 * Math.sin(edge.angle - 0.5)} L${edge.bx} ${edge.by} L${edge.bx - 3 * Math.cos(edge.angle + 0.5)} ${edge.by - 3 * Math.sin(edge.angle + 0.5)}`;
        parts.push(
          `<g data-source="${escapeXml(nodes[edge.link.a].node.id)}" data-target="${escapeXml(nodes[edge.link.b].node.id)}" data-type="${escapeXml(edge.link.type)}" fill="none" stroke="${edge.color}" stroke-width="0.5" opacity="${hover < 0 ? 0.18 : 0.5}"><path d="M${edge.ax} ${edge.ay} Q${edge.cx} ${edge.cy} ${edge.bx} ${edge.by}"/><path d="${arrow}"/></g>`
        );
      }
      nodes.forEach((node, index) => {
        const style = nodeAppearance(
          node,
          index === hover,
          hover >= 0 && neighbours.has(index),
          hover >= 0,
          size?.(node.node)
        );
        parts.push(
          `<circle data-id="${escapeXml(node.node.id)}" cx="${x[index]}" cy="${y[index]}" r="${style.radius}" fill="${style.color}" opacity="${style.alpha}"><title>${escapeXml(node.node.label ?? node.node.id)}</title></circle>`
        );
        if (index === hover) {
          const label = node.node.label ?? node.node.id;
          parts.push(
            `<text x="${x[index] + style.radius + 5}" y="${y[index] + 4}" fill="#FFFFFF" font-family="sans-serif" font-size="11">${escapeXml(label.length > 80 ? `${label.slice(0, 80)}…` : label)}</text>`
          );
        }
      });
      parts.push("</svg>");
      return parts.join("");
    },
  };
  return renderer;
}
