"use client";

import { useTranslations } from "next-intl";
import type { ConstellationProps } from "../../components/constellation";
import styles from "./brain.module.css";

/** Reflow the existing data semantics outside Canvas instead of clipping them on narrow screens. */
export function BrainLegend(props: ConstellationProps) {
  const t = useTranslations("constellation");
  const heat = props.heatLegendLabel ?? t("legendLinks");
  const endpoints = props.heatLegendEndpoints ?? [t("legendFew"), t("legendMany")];
  return (
    <div className={styles.legend}>
      <ul className={styles.scopes}>
        {(
          [
            ["#0074d9", t("linkTypeSemantic")],
            ["#009296", t("linkTypeTemporal")],
            ["#f59e0b", t("linkTypeEntity")],
            ["#8b5cf6", t("linkTypeCausal")],
          ] as const
        ).map(([color, label]) => (
          <li key={label}>
            <span aria-hidden="true" style={{ color }}>
              ●{" "}
            </span>
            {label}
          </li>
        ))}
      </ul>
      {!props.clusterKeyFn && (
        <div>
          {heat}
          <div className={styles.heat} role="img" aria-label={heat} />
          <span>
            {endpoints[0]} → {endpoints[1]}
          </span>
        </div>
      )}
      {props.sizeLegendLabel && (
        <div>
          {props.sizeLegendLabel}: {t("legendFew")} <span aria-hidden="true">• ●</span>{" "}
          {t("legendMany")}
        </div>
      )}
    </div>
  );
}
