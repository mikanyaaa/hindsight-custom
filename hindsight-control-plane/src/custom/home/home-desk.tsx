"use client";

import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
  ChevronDown,
  File,
  FileText,
  Layers,
  Link2,
  Search,
  SquareCheckBig,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { MemoryDetailModal } from "@/components/memory-detail-modal";
import { StalenessBadge } from "@/components/staleness-badge";
import { convertHindsightGraphData, type GraphData } from "@/components/graph-data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HarnessLogo } from "@/components/ui/harness-logo";
import { AtlasMap } from "@/custom/atlas-map/atlas-map";
import { analyzeAtlas } from "@/custom/atlas-map/layout";
import { client, type PageNode } from "@/lib/api";
import { useBank } from "@/lib/bank-context";
import { bankRoute } from "@/lib/bank-url";
import { formatRelativeTime } from "@/lib/relative-time";
import { groupWeek, harnessId, recallQuery, tagLabel, weekWindow } from "./activity";
import { homeCopyFor } from "./copy";
import styles from "./home-desk.module.css";

// The map previews the bank; the explorer can load a larger set on demand.
const GRAPH_NODE_CAP = 150;
const WEEK_LIMIT = 100;
const WEEK_PREVIEW = 3;

interface Counts {
  memories: number;
  documents: number;
  links: number;
}

type ModelRow = Awaited<ReturnType<typeof client.listMentalModels>>["items"][number];
type WeekPage = Awaited<ReturnType<typeof client.listMemories>>;
type WeekItem = WeekPage["items"][number];

interface WeekResult {
  tag: string;
  page: WeekPage | null;
}

function countPages(nodes: PageNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.kind === "page") count += 1;
    if (node.children?.length) count += countPages(node.children);
  }
  return count;
}

interface HomeProps {
  bankId: string;
  onNavigate: (tab: string) => void;
}

export function HomeDesk(props: HomeProps) {
  // Bank switches can keep this route mounted. Drop the old bank's requests and view state together.
  return <BankHome key={props.bankId} {...props} />;
}

function BankHome({ bankId, onNavigate }: HomeProps) {
  const t = useTranslations("home");
  const common = useTranslations("common");
  const data = useTranslations("dataView");
  // CUSTOM-HOOK: relative-time-home begin
  const locale = useLocale();
  // CUSTOM-HOOK: relative-time-home end
  const copy = homeCopyFor(locale);
  const { currentBank, currentBankName } = useBank();
  const bankName = (currentBank === bankId && currentBankName) || bankId;
  const router = useRouter();
  const activityId = useId();
  const [ask, setAsk] = useState("");
  const [counts, setCounts] = useState<Counts | null>();
  const [pages, setPages] = useState<number | null>();
  const [models, setModels] = useState<ModelRow[] | null>();
  const [tag, setTag] = useState("");
  const [weekOverview, setWeekOverview] = useState<WeekItem[]>([]);
  const [weekResult, setWeekResult] = useState<WeekResult>();
  const [weekExpanded, setWeekExpanded] = useState(false);
  const [graph, setGraph] = useState<GraphData | null>();
  const [openMemory, setOpenMemory] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    client.getBankStats(bankId).then(
      (stats) => {
        if (cancelled) return;
        const value = stats as {
          total_nodes?: number;
          total_documents?: number;
          total_links?: number;
        };
        setCounts({
          memories: value.total_nodes ?? 0,
          documents: value.total_documents ?? 0,
          links: value.total_links ?? 0,
        });
      },
      () => {
        if (!cancelled) setCounts(null);
      }
    );
    client.getPageTree(bankId).then(
      (tree) => {
        if (!cancelled) setPages(countPages(tree.roots ?? []));
      },
      () => {
        if (!cancelled) setPages(null);
      }
    );
    client.listMentalModels(bankId, { detail: "metadata", excludePages: true, limit: 6 }).then(
      ({ items }) => {
        if (!cancelled) setModels(items ?? []);
      },
      () => {
        if (!cancelled) setModels(null);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [bankId]);

  useEffect(() => {
    let cancelled = false;
    const span = weekWindow(new Date());
    client
      .listMemories(bankId, {
        timeField: "created_at",
        startDate: span.start,
        endDate: span.end,
        tags: tag ? [tag] : undefined,
        // A selection must exclude untagged memories from both the list and its total.
        tagsMatch: tag ? "any_strict" : "any",
        limit: WEEK_LIMIT,
      })
      .then(
        (page) => {
          if (cancelled) return;
          if (!tag) setWeekOverview(page.items ?? []);
          setWeekResult({ tag, page });
        },
        () => {
          if (!cancelled) setWeekResult({ tag, page: null });
        }
      );
    return () => {
      cancelled = true;
    };
  }, [bankId, tag]);

  useEffect(() => {
    const controller = new AbortController();
    client
      .getGraph({ bank_id: bankId, limit: GRAPH_NODE_CAP }, controller.signal)
      .then((raw) => {
        if (!controller.signal.aborted) {
          setGraph(
            convertHindsightGraphData(raw as Parameters<typeof convertHindsightGraphData>[0])
          );
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setGraph(null);
      });
    return () => controller.abort();
  }, [bankId]);

  // Derive the filter choices from the unfiltered window so switching tags cannot hide other choices.
  const tags = useMemo(
    () =>
      groupWeek(
        weekOverview.map((item) => ({
          id: item.id,
          text: item.text,
          tags: item.tags ?? [],
          at: item.date,
        })),
        null
      ).filter((group) => group.tag),
    [weekOverview]
  );
  const dayFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }),
    [locale]
  );
  const map = useMemo(() => (graph ? analyzeAtlas(graph) : null), [graph]);
  const page = weekResult?.tag === tag ? weekResult.page : undefined;
  const week = page?.items ?? [];
  const weekTotal = page?.total ?? 0;
  const formatCount = (value?: number | null) => value?.toLocaleString(locale) ?? "—";

  const askBank = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = ask.trim();
    if (query) router.push(bankRoute(bankId, recallQuery(query)));
  };

  const openModels = () => router.push(bankRoute(bankId, "?view=pages&pagesTab=models"));

  return (
    <div className={styles.home}>
      <div className={styles.heading}>
        <h1>{bankName}</h1>
        <form role="search" onSubmit={askBank} className={styles.search}>
          <button type="submit" aria-label={copy.searchSubmit} disabled={!ask.trim()}>
            <Search aria-hidden />
          </button>
          <input
            type="text"
            enterKeyHint="search"
            value={ask}
            onChange={(event) => setAsk(event.target.value)}
            placeholder={copy.searchPlaceholder}
            aria-label={copy.searchLabel}
          />
        </form>
      </div>

      <AtlasMap
        model={map}
        loading={graph === undefined}
        error={graph === null}
        onNodeClick={(node) => setOpenMemory(node.id)}
        onOpenGraph={() => onNavigate("data")}
      />

      <div className={styles.details}>
        <div className={styles.metrics} aria-busy={counts === undefined}>
          <Metric
            icon={Layers}
            label={t("statMemories")}
            value={formatCount(counts?.memories)}
            onClick={() => onNavigate("data")}
          />
          <Metric
            icon={File}
            label={t("statDocuments")}
            value={formatCount(counts?.documents)}
            onClick={() => onNavigate("documents")}
          />
          <Metric
            icon={Link2}
            label={copy.links}
            value={formatCount(counts?.links)}
            onClick={() => onNavigate("data")}
          />
          {counts === null && <p role="status">{common("error")}</p>}
        </div>

        <section className={styles.activity} aria-labelledby={`${activityId}-heading`}>
          <header className={styles.sectionHeading}>
            <h2 id={`${activityId}-heading`}>{copy.weekTitle}</h2>
            <div className={styles.sectionActions}>
              {page && weekTotal > 0 && (
                <span
                  className={styles.weekCount}
                  title={data("totalMemories", { count: weekTotal })}
                >
                  {formatCount(weekTotal)}
                </span>
              )}
              {tags.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger className={styles.filter}>
                    <span>{tag ? tagLabel(tag, copy.untagged) : copy.weekAll}</span>
                    <ChevronDown size={16} aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-w-[calc(100vw-2rem)]">
                    <DropdownMenuRadioGroup
                      value={tag}
                      onValueChange={(value) => {
                        setTag(value);
                        setWeekExpanded(false);
                      }}
                    >
                      <DropdownMenuRadioItem value="">{copy.weekAll}</DropdownMenuRadioItem>
                      {tags.map((group) => {
                        const harness = harnessId(group.tag);
                        return (
                          <DropdownMenuRadioItem
                            key={group.tag}
                            value={group.tag}
                            className="gap-2"
                          >
                            {harness && <HarnessLogo harness={harness} size={16} />}
                            <span className="min-w-0 flex-1 break-all">
                              {tagLabel(group.tag, copy.untagged)}
                            </span>
                            <span className="text-muted-foreground tabular-nums">
                              {formatCount(group.count)}
                            </span>
                          </DropdownMenuRadioItem>
                        );
                      })}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </header>
          {page === undefined && (
            <p className={styles.status} role="status">
              {common("loading")}
            </p>
          )}
          {page === null && (
            <p className={styles.status} role="status">
              {common("error")}
            </p>
          )}
          {page && week.length === 0 && <p className={styles.status}>{copy.weekEmpty}</p>}
          {week.length > 0 && (
            <ul id={activityId} className={styles.activityList}>
              {(weekExpanded ? week : week.slice(0, WEEK_PREVIEW)).map((item) => (
                <ActivityRow
                  key={item.id}
                  item={item}
                  tone={map?.toneById.get(item.id)}
                  locale={locale}
                  dayFormat={dayFormat}
                  onOpen={setOpenMemory}
                />
              ))}
            </ul>
          )}
          {week.length > WEEK_PREVIEW && (
            <button
              type="button"
              aria-controls={activityId}
              aria-expanded={weekExpanded}
              className={styles.sectionLink}
              onClick={() => setWeekExpanded(!weekExpanded)}
            >
              {weekExpanded ? copy.weekLess : `${t("viewAll")} (${formatCount(week.length)})`}
              <ChevronDown
                size={16}
                className={weekExpanded ? "rotate-180" : undefined}
                aria-hidden
              />
            </button>
          )}
          {weekExpanded && week.length < weekTotal && (
            <p className={styles.status}>{copy.weekLatest}</p>
          )}
        </section>

        <section className={styles.models}>
          <header className={styles.sectionHeading}>
            <h2>{copy.modelsTitle}</h2>
            <div className={styles.sectionActions}>
              <button
                type="button"
                className={styles.sectionLink}
                onClick={() => onNavigate("pages")}
              >
                <FileText size={17} aria-hidden />
                {t("statPages")} {formatCount(pages)}
              </button>
              {models && models.length > 0 && (
                <button type="button" className={styles.sectionLink} onClick={openModels}>
                  {t("viewAll")} <ArrowRight size={16} aria-hidden />
                </button>
              )}
            </div>
          </header>
          {models === undefined && (
            <p className={styles.status} role="status">
              {common("loading")}
            </p>
          )}
          {models === null && (
            <p className={styles.status} role="status">
              {common("error")}
            </p>
          )}
          {models?.length === 0 && <p className={styles.status}>{copy.modelsEmpty}</p>}
          {models && models.length > 0 && (
            <ul className={styles.modelsList}>
              {models.map((model) => (
                <li key={model.id}>
                  <button type="button" className={styles.modelRow} onClick={openModels}>
                    <span>{model.name}</span>
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
      </div>

      <MemoryDetailModal memoryId={openMemory} onClose={() => setOpenMemory(null)} />
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.metric} onClick={onClick}>
      <Icon aria-hidden />
      <strong>{value}</strong>
      <span>{label}</span>
    </button>
  );
}

function ActivityRow({
  item,
  tone,
  locale,
  dayFormat,
  onOpen,
}: {
  item: WeekItem;
  tone?: number;
  locale: string;
  dayFormat: Intl.DateTimeFormat;
  onOpen: (id: string) => void;
}) {
  const Icon =
    item.fact_type === "experience"
      ? UsersRound
      : item.fact_type === "observation"
        ? SquareCheckBig
        : Search;
  const date = Date.parse(item.date);
  return (
    <li>
      <button type="button" className={styles.activityRow} onClick={() => onOpen(item.id)}>
        <span className={styles.activityIcon} data-tone={tone}>
          <Icon aria-hidden />
        </span>
        <span className={styles.activityContent}>
          <span className={styles.activityText}>{item.text}</span>
          {Number.isFinite(date) && (
            <time dateTime={item.date} title={formatRelativeTime(item.date, locale)}>
              {dayFormat.format(date)}
            </time>
          )}
        </span>
      </button>
    </li>
  );
}
