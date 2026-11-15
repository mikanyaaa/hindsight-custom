export type GuardState =
  | { kind: "idle" }
  | { kind: "session" }
  | { kind: "timeout"; retry: () => void };

type Listener = (state: GuardState) => void;

let state: GuardState = { kind: "idle" };
const listeners = new Set<Listener>();

function publish(next: GuardState): void {
  state = next;
  for (const listener of listeners) listener(state);
}

export function getGuardState(): GuardState {
  return state;
}

export function subscribeGuard(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Sticky until the page reloads. A timeout banner must not cover this. */
export function reportSessionExpired(): void {
  if (state.kind === "session") return;
  publish({ kind: "session" });
}

export function reportRequestTimeout(retry: () => void): void {
  if (state.kind === "session") return;
  publish({ kind: "timeout", retry });
}

export function clearRequestTimeout(): void {
  if (state.kind === "timeout") publish({ kind: "idle" });
}

export function resetGuardForTests(): void {
  state = { kind: "idle" };
  listeners.clear();
}
