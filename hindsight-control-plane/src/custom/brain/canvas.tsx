"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ConstellationProps } from "../../components/constellation";
import type { BrainRenderer } from "./render-model";
import { createBrainCamera, mountBrainCanvas } from "./controller";
import { prepareBrainScene } from "./scene";
import styles from "./brain.module.css";

/** A custom canvas host, not a copy of the upstream constellation renderer. */
export function BrainCanvas({
  renderer,
  options,
}: {
  renderer: BrainRenderer;
  options: ConstellationProps;
}) {
  const t = useTranslations("constellation");
  const canvas = useRef<HTMLCanvasElement>(null);
  const camera = useRef(createBrainCamera());
  const controller = useRef<ReturnType<typeof mountBrainCanvas> | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const {
    data,
    nodeColorFn,
    nodeHeatFn,
    linkColorFn,
    clusterKeyFn,
    clusterColorFn,
    onNodeClick,
    nodeSizeFn,
  } = options;
  const scene = useMemo(
    () =>
      prepareBrainScene(
        { data, nodeColorFn, nodeHeatFn, linkColorFn, clusterKeyFn, clusterColorFn },
        renderer
      ),
    [data, nodeColorFn, nodeHeatFn, linkColorFn, clusterKeyFn, clusterColorFn, renderer]
  );
  useEffect(() => {
    if (!canvas.current) return;
    const mounted = mountBrainCanvas(
      canvas.current,
      renderer,
      scene,
      camera.current,
      onNodeClick,
      nodeSizeFn
    );
    controller.current = mounted;
    return () => {
      mounted.dispose();
      controller.current = null;
    };
  }, [renderer, scene, fullscreen, onNodeClick, nodeSizeFn]);
  useEffect(() => {
    if (!fullscreen) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [fullscreen]);
  return (
    <div
      style={
        fullscreen
          ? { position: "fixed", inset: 0, zIndex: 50, background: "#09090b" }
          : { position: "relative", width: "100%", height: `${options.height ?? 700}px` }
      }
    >
      <canvas ref={canvas} style={{ width: "100%", height: "100%", display: "block" }} />
      <div className={styles.toolbar}>
        <button
          type="button"
          title={t("exportSvgTitle")}
          onClick={() => controller.current?.exportSvg()}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
            <polyline points="8 8 12 4 16 8" />
            <line x1="12" y1="4" x2="12" y2="15" />
          </svg>
          {t("exportSvgLabel")}
        </button>
        <button
          type="button"
          title={fullscreen ? t("exitFullscreenTitle") : t("enterFullscreenTitle")}
          onClick={() => setFullscreen((value) => !value)}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {fullscreen ? (
              <>
                <polyline points="4 14 10 14 10 20" />
                <polyline points="20 10 14 10 14 4" />
                <line x1="14" y1="10" x2="21" y2="3" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </>
            ) : (
              <>
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </>
            )}
          </svg>
          {fullscreen ? t("exitFullscreenLabel") : t("enterFullscreenLabel")}
        </button>
      </div>
    </div>
  );
}
