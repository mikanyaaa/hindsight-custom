/** Quiet Paper control metrics.
 *
 * Radii and type come from the token theme: 6px for badges and menu items,
 * 10px for fields and buttons, 14px for cards and panels. Type starts at 12px.
 * Controls are 44px tall so a phone can hit them. Hover borders use the ink.
 * The previous dark hover and shadow used a blue that is not in this palette.
 */

export const buttonBase =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer";

export const buttonSizes = {
  default: "h-11 px-4",
  sm: "h-11 px-3 text-xs",
  lg: "h-12 px-6 text-base",
  icon: "h-11 w-11",
} as const;

export const fieldClass =
  "flex h-11 w-full rounded-md border border-border bg-card px-3 text-sm placeholder:text-muted-foreground transition-colors motion-reduce:transition-none hover:border-foreground/25 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50";

export const cardClass =
  "bg-card text-card-foreground border border-border border-solid rounded-lg";

export const panelClass = "rounded-lg border border-border bg-popover text-popover-foreground";

/** Elevation without the old blue hairline. */
export const floatShadow =
  "shadow-[0_8px_24px_rgba(28,27,25,0.12)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.5)]";

export const dialogShadow =
  "shadow-[0_24px_64px_rgba(28,27,25,0.18)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.8)]";

export const menuItemClass = "min-h-11 rounded-sm text-sm motion-reduce:transition-none";

export const menuLabelClass = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";

export const badgeClass =
  "inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide whitespace-nowrap";

/** Unchecked box. The hairline token disappears on a white card, so the edge uses the ink. */
export const checkClass =
  "border-foreground/45 hover:border-primary focus-visible:ring-ring data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground";

export const chipText = {
  xs: "text-xs gap-0.5",
  sm: "text-sm gap-1",
  md: "text-base gap-1",
} as const;
