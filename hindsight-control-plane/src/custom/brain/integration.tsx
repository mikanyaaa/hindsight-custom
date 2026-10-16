"use client";

import { useMemo } from "react";
import { NextIntlClientProvider, useLocale, useMessages, useTranslations } from "next-intl";
import { Constellation, type ConstellationProps } from "../../components/constellation";
import { adaptBrainData } from "./adapter";
import { createBrainRenderer } from "./renderer";
import { BRAIN_ENABLED, type BrainLayoutMode } from "./feature";
import { brainMessages } from "./messages";
import styles from "./brain.module.css";
import { BrainLegend } from "./legend";

interface Props extends ConstellationProps {
  layoutMode?: BrainLayoutMode;
  onLayoutModeChange?: (mode: BrainLayoutMode) => void;
}

function BrainIntegration({ layoutMode = "network", onLayoutModeChange, ...props }: Props) {
  const t = useTranslations("brain");
  // Multi-group Euler views deliberately stay on the upstream renderer.
  const active = BRAIN_ENABLED && layoutMode === "brain" && !props.nodeGroupsFn;
  const data = useMemo(
    () => (active ? adaptBrainData(props.data, props.clusterKeyFn) : null),
    [active, props.data, props.clusterKeyFn]
  );
  const renderer = useMemo(() => (data ? createBrainRenderer(data) : undefined), [data]);
  const scopes = useMemo(() => {
    const keys = new Set<string>();
    if (data && props.clusterKeyFn)
      for (const node of data.graph.nodes) {
        const key = props.clusterKeyFn(node);
        if (key != null) keys.add(key);
      }
    return [...keys];
  }, [data, props.clusterKeyFn]);
  return (
    <div className={styles.root}>
      {!props.nodeGroupsFn && (
        <div className={styles.controls} role="group" aria-label={t("layout")}>
          <button
            type="button"
            aria-pressed={!active}
            onClick={() => onLayoutModeChange?.("network")}
          >
            {t("network")}
          </button>
          <button type="button" aria-pressed={active} onClick={() => onLayoutModeChange?.("brain")}>
            {t("brain")}
          </button>
        </div>
      )}
      {data && (
        <p className={styles.counts} role="status">
          {t("counts", {
            shown: data.graph.nodes.length,
            loaded: data.loadedNodes,
            edges: Math.min(5000, data.graph.links.length),
            loadedEdges: data.loadedLinks,
          })}
        </p>
      )}
      {active && scopes.length > 0 && (
        <ul className={styles.scopes} aria-label={t("scopes")}>
          {scopes.map((key) => (
            <li key={key} style={{ color: props.clusterColorFn?.(key) }}>
              {props.clusterLabelFn?.(key) ?? key}
            </li>
          ))}
        </ul>
      )}
      {active && <BrainLegend {...props} />}
      <Constellation
        {...props}
        key={active ? "brain" : "network"}
        data={data?.graph ?? props.data}
        brainRenderer={renderer}
      />
    </div>
  );
}

/** Local namespace preserves inherited messages (including the shared renderer's legends). */
export default function BrainProvider(props: Props) {
  const locale = useLocale();
  const messages = useMessages();
  if (!BRAIN_ENABLED) return <Constellation {...props} />;
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={{
        ...messages,
        brain: brainMessages[locale as keyof typeof brainMessages] ?? brainMessages.en,
      }}
    >
      <BrainIntegration {...props} />
    </NextIntlClientProvider>
  );
}
