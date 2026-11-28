import type { Locale } from "@/i18n/config";

export interface HomeCopy {
  searchLabel: string;
  searchPlaceholder: string;
  searchSubmit: string;
  weekTitle: string;
  weekEmpty: string;
  weekAll: string;
  weekLatest: string;
  weekLess: string;
  modelsTitle: string;
  modelsEmpty: string;
  links: string;
  untagged: string;
}

const en: HomeCopy = {
  searchLabel: "Recall",
  searchPlaceholder: "Search this bank",
  searchSubmit: "Recall",
  weekTitle: "This week",
  weekEmpty: "Nothing new this week",
  weekAll: "All tags",
  weekLatest: "Latest only",
  weekLess: "Show less",
  modelsTitle: "Mental models",
  modelsEmpty: "No mental models yet",
  links: "Links",
  untagged: "No tag",
};

/** Home chrome. Page names stay in the shared catalogs. */
export const homeCopy: Record<Locale, HomeCopy> = {
  en,
  de: {
    searchLabel: "Recall",
    searchPlaceholder: "Diese Bank durchsuchen",
    searchSubmit: "Recall",
    weekTitle: "Diese Woche",
    weekEmpty: "Diese Woche nichts Neues",
    weekAll: "Alle Tags",
    weekLatest: "Nur die neuesten",
    weekLess: "Weniger anzeigen",
    modelsTitle: "Mentale Modelle",
    modelsEmpty: "Noch keine mentalen Modelle",
    links: "Verknüpfungen",
    untagged: "Ohne Tag",
  },
  es: {
    searchLabel: "Recall",
    searchPlaceholder: "Buscar en este banco",
    searchSubmit: "Recall",
    weekTitle: "Esta semana",
    weekEmpty: "Nada nuevo esta semana",
    weekAll: "Todas las etiquetas",
    weekLatest: "Solo lo más reciente",
    weekLess: "Mostrar menos",
    modelsTitle: "Modelos mentales",
    modelsEmpty: "Aún no hay modelos mentales",
    links: "Enlaces",
    untagged: "Sin etiqueta",
  },
  fr: {
    searchLabel: "Recall",
    searchPlaceholder: "Rechercher dans cette banque",
    searchSubmit: "Recall",
    weekTitle: "Cette semaine",
    weekEmpty: "Rien de nouveau cette semaine",
    weekAll: "Toutes les étiquettes",
    weekLatest: "Les plus récents seulement",
    weekLess: "Afficher moins",
    modelsTitle: "Modèles mentaux",
    modelsEmpty: "Pas encore de modèle mental",
    links: "Liens",
    untagged: "Sans étiquette",
  },
  pt: {
    searchLabel: "Recall",
    searchPlaceholder: "Pesquisar neste banco",
    searchSubmit: "Recall",
    weekTitle: "Esta semana",
    weekEmpty: "Nada de novo esta semana",
    weekAll: "Todas as etiquetas",
    weekLatest: "Só os mais recentes",
    weekLess: "Mostrar menos",
    modelsTitle: "Modelos mentais",
    modelsEmpty: "Ainda sem modelos mentais",
    links: "Ligações",
    untagged: "Sem etiqueta",
  },
  ja: {
    searchLabel: "Recall",
    searchPlaceholder: "このバンクを検索",
    searchSubmit: "Recall",
    weekTitle: "今週",
    weekEmpty: "今週は新しいものがありません",
    weekAll: "すべてのタグ",
    weekLatest: "最新のみ",
    weekLess: "折りたたむ",
    modelsTitle: "メンタルモデル",
    modelsEmpty: "メンタルモデルはまだありません",
    links: "リンク",
    untagged: "タグなし",
  },
  ko: {
    searchLabel: "Recall",
    searchPlaceholder: "이 뱅크에서 검색",
    searchSubmit: "Recall",
    weekTitle: "이번 주",
    weekEmpty: "이번 주에는 새 항목이 없습니다",
    weekAll: "모든 태그",
    weekLatest: "최신만",
    weekLess: "접기",
    modelsTitle: "멘탈 모델",
    modelsEmpty: "아직 멘탈 모델이 없습니다",
    links: "연결",
    untagged: "태그 없음",
  },
  "zh-CN": {
    searchLabel: "Recall",
    searchPlaceholder: "搜索此记忆库",
    searchSubmit: "Recall",
    weekTitle: "本周",
    weekEmpty: "本周没有新增",
    weekAll: "全部标签",
    weekLatest: "仅最新",
    weekLess: "收起",
    modelsTitle: "心智模型",
    modelsEmpty: "还没有心智模型",
    links: "关联",
    untagged: "无标签",
  },
  "zh-TW": {
    searchLabel: "Recall",
    searchPlaceholder: "搜尋此記憶庫",
    searchSubmit: "Recall",
    weekTitle: "本週",
    weekEmpty: "本週沒有新增",
    weekAll: "全部標籤",
    weekLatest: "僅最新",
    weekLess: "收合",
    modelsTitle: "心智模型",
    modelsEmpty: "還沒有心智模型",
    links: "關聯",
    untagged: "無標籤",
  },
  "yue-Hant": {
    searchLabel: "Recall",
    searchPlaceholder: "搜尋呢個記憶庫",
    searchSubmit: "Recall",
    weekTitle: "今個星期",
    weekEmpty: "今個星期冇新增",
    weekAll: "全部標籤",
    weekLatest: "只係最新",
    weekLess: "收埋",
    modelsTitle: "心智模型",
    modelsEmpty: "未有心智模型",
    links: "關聯",
    untagged: "無標籤",
  },
};

export function homeCopyFor(locale: string): HomeCopy {
  if (locale in homeCopy) return homeCopy[locale as Locale];
  return en;
}
