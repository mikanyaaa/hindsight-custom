/** One stored memory in the home week's activity list. */
export interface WeekMemory {
  id: string;
  text: string;
  tags: string[];
  at: string;
}

/** Memories that share a tag, newest first as the list endpoint returned them. */
export interface TagGroup {
  tag: string;
  count: number;
  samples: WeekMemory[];
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SAMPLES = 3;

/** Memories with no tag share this bucket. It is not a real tag. */
export const UNTAGGED = "";

/**
 * The home week is ingestion time, not the date the fact mentions.
 * "Learned" is when the bank stored it. The end is exclusive, so it sits
 * just after `now` and a memory written this second is included.
 */
export function weekWindow(now: Date): { start: string; end: string } {
  return {
    start: new Date(now.getTime() - WEEK_MS).toISOString(),
    end: new Date(now.getTime() + 1000).toISOString(),
  };
}

/** Query string the home recall field hands to the recall page. */
export function recallQuery(query: string): string {
  return `?view=recall&q=${encodeURIComponent(query.trim())}`;
}

export function tagLabel(tag: string, untagged: string): string {
  if (!tag) return untagged;
  return tag.startsWith("harness:") ? tag.slice("harness:".length) : tag;
}

/** Coding-agent tags are `harness:<id>`. Other tags are not a bot. */
export function harnessId(tag: string): string | null {
  if (!tag.startsWith("harness:")) return null;
  const id = tag.slice("harness:".length);
  return id || null;
}

/**
 * Group the loaded week by tag. A memory with two tags counts in both,
 * because each tag is a bot (or a topic) that learned it.
 * `tag` keeps a single bucket when the list was already filtered.
 * Harness tags lead: they are the bot identity the home filter is for.
 */
export function groupWeek(items: WeekMemory[], tag: string | null): TagGroup[] {
  const buckets = new Map<string, WeekMemory[]>();
  for (const item of items) {
    const tags = item.tags.filter((value) => value.length > 0);
    const keys = tags.length > 0 ? tags : [UNTAGGED];
    for (const key of keys) {
      if (tag !== null && key !== tag) continue;
      const list = buckets.get(key);
      if (list) list.push(item);
      else buckets.set(key, [item]);
    }
  }
  return [...buckets.entries()]
    .map(([key, samples]) => ({
      tag: key,
      count: samples.length,
      samples: samples.slice(0, SAMPLES),
    }))
    .sort((a, b) => {
      const rank = (value: string) => (value.startsWith("harness:") ? 0 : value ? 1 : 2);
      const byKind = rank(a.tag) - rank(b.tag);
      if (byKind !== 0) return byKind;
      if (b.count !== a.count) return b.count - a.count;
      return a.tag.localeCompare(b.tag);
    });
}
