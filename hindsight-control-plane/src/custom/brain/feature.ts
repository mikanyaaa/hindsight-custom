/** Public build-time flag. Missing, false, mixed case and whitespace all mean off. */
export const BRAIN_ENABLED = process.env.NEXT_PUBLIC_HINDSIGHT_BRAIN_ENABLED === "true";

export type BrainLayoutMode = "network" | "brain";

export function brainRequestLimit(limit: number, active: boolean): number {
  return active ? Math.min(500, limit > 0 ? limit : 500) : limit;
}
