// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { adaptBrainData } from "@/custom/brain/adapter";
import { createBrainCamera, mountBrainCanvas } from "@/custom/brain/controller";
import { createBrainRenderer } from "@/custom/brain/renderer";
import { prepareBrainScene } from "@/custom/brain/scene";

const graph = {
  nodes: [
    { id: "a", label: "Alpha" },
    { id: "b", label: "Beta" },
  ],
  links: [{ source: "a", target: "b", type: "semantic" }],
};

describe("brain frame budget", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("blits while the camera eases and redraws vectors once it settles", () => {
    const calls: string[] = [];
    const ctx = new Proxy(
      {},
      {
        get(target, prop) {
          if (prop === "canvas") return { width: 800, height: 600 };
          if (prop in target) return Reflect.get(target, prop);
          return () => calls.push(String(prop));
        },
      }
    );
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      }
    );
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 800,
      height: 600,
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON() {},
    });
    const canvas = document.createElement("canvas");
    document.body.append(canvas);
    const adapted = adaptBrainData(graph);
    const renderer = createBrainRenderer(adapted);
    const mounted = mountBrainCanvas(
      canvas,
      renderer,
      prepareBrainScene({ data: adapted.graph }, renderer),
      createBrainCamera()
    );
    const flush = () => {
      const pending = frames.splice(0);
      for (const frame of pending) frame(0);
    };
    flush();
    const painted = calls.filter((call) => call === "clearRect").length;
    expect(painted).toBeGreaterThan(0);
    canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: -200, bubbles: true, cancelable: true }));
    for (let i = 0; i < 80 && frames.length; i++) flush();
    expect(calls).toContain("drawImage");
    expect(calls.filter((call) => call === "clearRect").length).toBeGreaterThan(painted);
    expect(frames).toHaveLength(0);
    mounted.dispose();
  });
});
