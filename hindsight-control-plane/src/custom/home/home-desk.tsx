"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Search } from "lucide-react";
import { client, type KnowledgeNode } from "@/lib/api";
import { bankRoute } from "@/lib/bank-url";
import { formatRelativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Constellation } from "@/components/constellation";
import type { GraphData, GraphLink, GraphNode } from "@/components/graph-data";
import { MemoryDetailModal } from "@/components/memory-detail-modal";
import { StalenessBadge } from "@/components/staleness-badge";
import { HarnessLogo } from "@/components/ui/harness-logo";
import { cardClass } from "@/custom/primitives/classes";
import { GRAPH_FACT, GRAPH_NODE } from "@/custom/theme/graph-palette";
import { homeCopyFor } from "@/custom/home/copy";
import {
  groupWeek,
  harnessId,
  recallQuery,
  tagLabel,
  weekWindow,
  type TagGroup,
  type WeekMemory,
} from "@/custom/home/activity";

const TYPE_COLORS: Record<string, string> = { ...GRAPH_FACT };
// The home map is a card, not the explorer. Fewer nodes keeps the request
// small and the drawing inside a short canvas.
const GRAPH_NODE_CAP = 80;
const GRAPH_HEIGHT = 300;
const WEEK_LIMIT = 100;

interface Counts {
  memories: number;
  documents: number;
  links: number;
}

interface ModelRow {
  id: string;
  name: string;
  is_stale: boolean | null;
  last_refresh_failed_at?: string | null;
  trigger?: {
    refresh_after_consolidation?: boolean;
    refresh_cron?: string | null;
  } | null;
}

function countPages(nodes: KnowledgeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.kind === "page") count += 1;
    if (node.children?.length) count += countPages(node.children);
  }
  return count;
}

function asWeek(item: { id: string; text: string; tags?: string[]; date?: string }): WeekMemory {
  return {
    id: item.id,
    text: item.text,
    tags: item.tags ?? [],
    at: item.date ?? "",
  };
}

export function HomeDesk({
  bankId,
  onNavigate,
}: {
  bankId: string;
  onNavigate: (tab: string) => void;
}) {
  const t = useTranslations("home");
  // CUSTOM-HOOK: relative-time-home begin
  const locale = useLocale();
  // CUSTOM-HOOK: relative-time-home end
  const copy = homeCopyFor(locale);
  const router = useRouter();
  const [ask, setAsk] = useState("");
  const [counts, setCounts] = useState<Counts | null>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [models, setModels] = useState<ModelRow[] | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [week, setWeek] = useState<WeekMemory[]>([]);
  const [weekTotal, setWeekTotal] = useState(0);
  const [weekLoading, setWeekLoading] = useState(true);
  const [graph, setGraph] = useState<GraphData>({ nodes: [], links: [] });
  const [graphReady, setGraphReady] = useState(false);
  const [openMemory, setOpenMemory] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      client.getBankStats(bankId),
      client.getKnowledgeTree(bankId),
      client.listMentalModels(bankId, {
        detail: "metadata",
        excludeKnowledgePages: true,
        limit: 6,
      }),
    ]).then(([stats, tree, modelsResult]) => {
      if (cancelled) return;
      if (stats.status === "fulfilled") {
        const value = stats.value as {
          total_nodes?: number;
          total_documents?: number;
          total_links?: number;
        };
        setCounts({
          memories: value.total_nodes ?? 0,
          documents: value.total_documents ?? 0,
          links: value.total_links ?? 0,
        });
      }
      if (tree.status === "fulfilled") {
        const roots = (tree.value as { roots?: KnowledgeNode[] }).roots ?? [];
        setPages(countPages(roots));
      } else {
        setPages(0);
      }
      if (modelsResult.status === "fulfilled") {
        const items = (modelsResult.value as { items?: ModelRow[] }).items ?? [];
        setModels(items);
      } else {
        setModels([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [bankId]);

  useEffect(() => {
    let cancelled = false;
    setWeekLoading(true);
    const span = weekWindow(new Date());
    client
      .listMemories(bankId, {
        timeField: "created_at",
        startDate: span.start,
        endDate: span.end,
        tags: tag ? [tag] : undefined,
        tagsMatch: "any",
        limit: WEEK_LIMIT,
      })
      .then((page) => {
        if (cancelled) return;
        setWeek((page.items ?? []).map(asWeek));
        setWeekTotal(page.total ?? 0);
      })
      .catch(() => {
        if (!cancelled) {
          setWeek([]);
          setWeekTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setWeekLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bankId, tag]);

  useEffect(() => {
    let cancelled = false;
    setGraphReady(false);
    client
      .getGraph({ bank_id: bankId, limit: GRAPH_NODE_CAP })
      .then((raw) => {
        if (cancelled) return;
        const body = raw as { nodes?: unknown[]; edges?: unknown[] };
        const nodes: GraphNode[] = (body.nodes ?? []).map((rawNode) => {
          const data =
            (rawNode as { data?: Record<string, unknown> }).data ??
            (rawNode as Record<string, unknown>);
          return {
            id: String(data.id),
            label: typeof data.label === "string" ? data.label : undefined,
            group: typeof data.type === "string" ? data.type : undefined,
          };
        });
        const links: GraphLink[] = (body.edges ?? []).map((rawEdge) => {
          const data =
            (rawEdge as { data?: Record<string, unknown> }).data ??
            (rawEdge as Record<string, unknown>);
          return {
            source: String(data.source),
            target: String(data.target),
            weight: typeof data.weight === "number" ? data.weight : undefined,
          };
        });
        setGraph({ nodes, links });
      })
      .catch(() => {
        if (!cancelled) setGraph({ nodes: [], links: [] });
      })
      .finally(() => {
        if (!cancelled) setGraphReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [bankId]);

  const groups = useMemo(() => {
    const grouped = groupWeek(week, tag);
    if (!tag) return grouped;
    return grouped.map((group) => (group.tag === tag ? { ...group, count: weekTotal } : group));
  }, [week, tag, weekTotal]);

  const chips = useMemo(() => {
    const names = new Set<string>();
    for (const item of week) {
      for (const value of item.tags) if (value) names.add(value);
    }
    if (tag) names.add(tag);
    return [...names].sort((a, b) => {
      const rank = (value: string) => (value.startsWith("harness:") ? 0 : 1);
      return rank(a) - rank(b) || a.localeCompare(b);
    });
  }, [week, tag]);

  const nodeWeights = useMemo(() => {
    const weights = new Map<string, number>();
    for (const link of graph.links) {
      const value = typeof link.weight === "number" && link.weight > 0 ? link.weight : 1;
      weights.set(link.source, (weights.get(link.source) ?? 0) + value);
      weights.set(link.target, (weights.get(link.target) ?? 0) + value);
    }
    return weights;
  }, [graph]);
  const maxWeight = useMemo(() => Math.max(1, ...nodeWeights.values()), [nodeWeights]);
  const nodeSizeFn = useCallback(
    (node: GraphNode) => 4 + Math.sqrt((nodeWeights.get(node.id) ?? 0) / maxWeight) * 9,
    [nodeWeights, maxWeight]
  );

  const formatCount = (value: number | null) =>
    value === null ? "—" : value.toLocaleString(locale);

  const askBank = (event: FormEvent) => {
    event.preventDefault();
    const query = ask.trim();
    if (!query) return;
    router.push(bankRoute(bankId, recallQuery(query)));
  };

  const openModels = () => router.push(bankRoute(bankId, "?view=knowledge&knowledgeTab=models"));

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold text-foreground">{t("title")}</h1>
      <p className="mb-4 text-muted-foreground">
        {t("subtitle")} <span className="font-mono text-foreground">{bankId}</span>
      </p>

      <form onSubmit={askBank} className="mb-4 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="home-recall"
            value={ask}
            onChange={(event) => setAsk(event.target.value)}
            placeholder={copy.searchPlaceholder}
            aria-label={copy.searchLabel}
            className="h-12 min-h-12 pl-10 text-base"
          />
        </div>
        <Button type="submit" className="h-12 min-h-12 shrink-0 px-4" disabled={!ask.trim()}>
          {copy.searchSubmit}
        </Button>
      </form>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CountCard
          label={t("statMemories")}
          value={formatCount(counts ? counts.memories : null)}
          onClick={() => onNavigate("data")}
        />
        <CountCard
          label={t("statDocuments")}
          value={formatCount(counts ? counts.documents : null)}
          onClick={() => onNavigate("documents")}
        />
        <CountCard
          label={t("statPages")}
          value={formatCount(pages)}
          onClick={() => onNavigate("knowledge")}
        />
        <CountCard
          label={copy.links}
          value={formatCount(counts ? counts.links : null)}
          onClick={() => onNavigate("data")}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
        <section className={cn(cardClass, "flex min-h-64 flex-col overflow-hidden lg:col-span-3")}>
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">{copy.weekTitle}</h2>
            <span className="text-xs tabular-nums text-muted-foreground">
              {weekLoading ? "—" : weekTotal.toLocaleString(locale)}
            </span>
          </header>
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3">
              <TagChip pressed={tag === null} onClick={() => setTag(null)} label={copy.weekAll} />
              {chips.map((name) => (
                <TagChip
                  key={name}
                  pressed={tag === name}
                  onClick={() => setTag(name)}
                  label={tagLabel(name, copy.untagged)}
                  harness={harnessId(name)}
                />
              ))}
            </div>
          )}
          <div className="min-h-48 flex-1">
            {weekLoading ? null : groups.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                {copy.weekEmpty}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {groups.map((group) => (
                  <TagWeek
                    key={group.tag || "untagged"}
                    group={group}
                    locale={locale}
                    untagged={copy.untagged}
                    onOpen={setOpenMemory}
                  />
                ))}
              </ul>
            )}
            {!weekLoading && week.length < weekTotal && (
              <p className="px-4 py-2 text-xs text-muted-foreground">{copy.weekLatest}</p>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <section className={cn(cardClass, "flex min-h-40 flex-col overflow-hidden")}>
            <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">{copy.modelsTitle}</h2>
              {models && models.length > 0 && (
                <button
                  type="button"
                  onClick={openModels}
                  className="inline-flex min-h-11 items-center gap-1 text-xs text-primary"
                >
                  {t("viewAll")} <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </header>
            {models === null ? (
              <div className="min-h-24" />
            ) : models.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                {copy.modelsEmpty}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {models.map((model) => (
                  <li key={model.id}>
                    <button
                      type="button"
                      onClick={openModels}
                      className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-muted"
                    >
                      <span className="truncate text-sm text-foreground">{model.name}</span>
                      <StalenessBadge
                        isStale={model.is_stale}
                        trigger={model.trigger}
                        refreshFailedAt={model.last_refresh_failed_at}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={cn(cardClass, "overflow-hidden")}>
            <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">{t("constellationTitle")}</h2>
              <button
                type="button"
                onClick={() => onNavigate("data")}
                className="inline-flex min-h-11 items-center gap-1 text-xs text-primary"
              >
                {t("viewAll")} <ArrowRight className="h-3 w-3" />
              </button>
            </header>
            {graph.nodes.length > 0 ? (
              <Constellation
                data={graph}
                height={GRAPH_HEIGHT}
                controls={false}
                onNodeClick={(node) => setOpenMemory(node.id)}
                nodeSizeFn={nodeSizeFn}
                clusterKeyFn={(node) => node.group ?? null}
                clusterColorFn={(key) => TYPE_COLORS[key] || GRAPH_NODE}
                clusterLabelFn={(key) => key}
              />
            ) : (
              <div
                className="flex items-center justify-center text-sm text-muted-foreground"
                style={{ height: GRAPH_HEIGHT }}
              >
                {graphReady ? t("constellationEmpty") : "—"}
              </div>
            )}
          </section>
        </div>
      </div>

      <MemoryDetailModal memoryId={openMemory} onClose={() => setOpenMemory(null)} />
    </div>
  );
}

function CountCard({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(cardClass, "flex h-24 flex-col justify-between px-4 py-3 text-left")}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tabular-nums text-foreground">{value}</span>
    </button>
  );
}

function TagChip({
  label,
  harness,
  pressed,
  onClick,
}: {
  label: string;
  harness?: string | null;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm motion-reduce:transition-none",
        pressed
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground"
      )}
    >
      {harness ? <HarnessLogo harness={harness} size={16} /> : null}
      <span className="max-w-40 truncate">{label}</span>
    </button>
  );
}

function TagWeek({
  group,
  locale,
  untagged,
  onOpen,
}: {
  group: TagGroup;
  locale: string;
  untagged: string;
  onOpen: (id: string) => void;
}) {
  const mark = harnessId(group.tag);
  return (
    <li className="px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
          {mark ? <HarnessLogo harness={mark} size={16} /> : null}
          <span className="truncate">{tagLabel(group.tag, untagged)}</span>
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">{group.count}</span>
      </div>
      <ul className="flex flex-col gap-1">
        {group.samples.map((item) => (
          <li key={`${group.tag}-${item.id}`}>
            <button
              type="button"
              onClick={() => onOpen(item.id)}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-2 text-left hover:bg-muted"
            >
              <span className="line-clamp-2 text-sm text-foreground">{item.text}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatRelativeTime(item.at, locale)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </li>
  );
}
