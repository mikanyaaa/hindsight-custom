/** Graph chrome reads the Quiet Paper tokens.
 *
 * Canvas cannot see a CSS variable, so these values are the same hex and rgba
 * as src/custom/theme/tokens.css. A test fails if the two drift. The heat ramp
 * stays the cool-to-warm data scale; it is not a brand color.
 */

export const GRAPH_LINK = {
  semantic: "#2c82f5",
  temporal: "#009296",
  entity: "#f59e0b",
  causal: "#8b5cf6",
} as const;

export const GRAPH_NODE = GRAPH_LINK.semantic;

/** Fact-type nodes on the memory map. Same hues as the chart tokens. */
export const GRAPH_FACT = {
  world: "#2c82f5",
  experience: "#10b981",
  observation: "#8b5cf6",
  entity: "#ec4899",
} as const;

export interface GraphPaint {
  background: string;
  card: string;
  foreground: string;
  muted: string;
  border: string;
  accent: string;
  onAccent: string;
  chip: string;
  chipText: string;
}

const LIGHT: GraphPaint = {
  background: "#faf9f7",
  card: "#ffffff",
  foreground: "#1c1b19",
  muted: "#5e584f",
  border: "rgba(28, 27, 25, 0.12)",
  accent: "#5b47d6",
  onAccent: "#ffffff",
  chip: "#f1efea",
  chipText: "#3c3844",
};

const DARK: GraphPaint = {
  background: "#090a0d",
  card: "#15171d",
  foreground: "#f5f5f7",
  muted: "#b4bac6",
  border: "rgba(241, 245, 255, 0.14)",
  accent: "#78b3ff",
  onAccent: "#101722",
  chip: "#242933",
  chipText: "#e3e9f4",
};

export function graphPalette(dark: boolean): GraphPaint {
  return dark ? DARK : LIGHT;
}

let sansFamily = "";
let monoFamily = "";

function cssFamily(variable: string, fallback: string, cached: string): string {
  if (cached) return cached;
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || fallback;
}

export function graphFont(weight = ""): string {
  const family = cssFamily("--font-sans", "ui-sans-serif, system-ui, sans-serif", sansFamily);
  if (family !== "ui-sans-serif, system-ui, sans-serif") sansFamily = family;
  return `${weight ? `${weight} ` : ""}12px ${family}`;
}

export function graphMono(): string {
  const family = cssFamily("--font-mono", "ui-monospace, monospace", monoFamily);
  if (family !== "ui-monospace, monospace") monoFamily = family;
  return `12px ${family}`;
}

/** Ink or paper, whichever stays readable on a saturated node fill. */
export function inkOn(fill: string): string {
  const hex = fill.trim().replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((char) => char + char)
          .join("")
      : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return "#ffffff";
  const channels = [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return luminance > 0.35 ? "#1c1b19" : "#ffffff";
}
