import type { Locale } from "@/i18n/config";

export interface HomeCopy {
  searchLabel: string;
  searchPlaceholder: string;
  searchSubmit: string;
  weekTitle: string;
  weekEmpty: string;
  weekAll: string;
  weekLatest: string;
  modelsTitle: string;
  modelsEmpty: string;
  links: string;
  untagged: string;
}

const en: HomeCopy = {
  searchLabel: "Recall",
  searchPlaceholder: "Ask this bank",
  searchSubmit: "Recall",
  weekTitle: "New in the last 7 days",
  weekEmpty: "Nothing new this week",
  weekAll: "All tags",
  weekLatest: "Latest only",
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
    searchPlaceholder: "Diese Bank fragen",
    searchSubmit: "Recall",
    weekTitle: "Neu in den letzten 7 Tagen",
    weekEmpty: "Diese Woche nichts Neues",
    weekAll: "Alle Tags",
    weekLatest: "Nur die neuesten",
    modelsTitle: "Mentale Modelle",
    modelsEmpty: "Noch keine mentalen Modelle",
    links: "Verknüpfungen",
    untagged: "Ohne Tag",
  },
  es: {
    searchLabel: "Recall",
    searchPlaceholder: "Preguntar a este banco",
    searchSubmit: "Recall",
    weekTitle: "Nuevo en los últimos 7 días",
    weekEmpty: "Nada nuevo esta semana",
    weekAll: "Todas las etiquetas",
    weekLatest: "Solo lo más reciente",
    modelsTitle: "Modelos mentales",
    modelsEmpty: "Aún no hay modelos mentales",
    links: "Enlaces",
    untagged: "Sin etiqueta",
  },
  fr: {
    searchLabel: "Recall",
    searchPlaceholder: "Interroger cette banque",
    searchSubmit: "Recall",
    weekTitle: "Nouveau ces 7 derniers jours",
    weekEmpty: "Rien de nouveau cette semaine",
    weekAll: "Toutes les étiquettes",
    weekLatest: "Les plus récents seulement",
    modelsTitle: "Modèles mentaux",
    modelsEmpty: "Pas encore de modèle mental",
    links: "Liens",
    untagged: "Sans étiquette",
  },
  pt: {
    searchLabel: "Recall",
    searchPlaceholder: "Perguntar a este banco",
    searchSubmit: "Recall",
    weekTitle: "Novo nos últimos 7 dias",
    weekEmpty: "Nada de novo esta semana",
    weekAll: "Todas as etiquetas",
    weekLatest: "Só os mais recentes",
    modelsTitle: "Modelos mentais",
    modelsEmpty: "Ainda sem modelos mentais",
    links: "Ligações",
    untagged: "Sem etiqueta",
  },
  ja: {
    searchLabel: "Recall",
    searchPlaceholder: "このバンクに聞く",
    searchSubmit: "Recall",
    weekTitle: "過去7日間の新規",
    weekEmpty: "今週は新しいものがありません",
    weekAll: "すべてのタグ",
    weekLatest: "最新のみ",
    modelsTitle: "メンタルモデル",
    modelsEmpty: "メンタルモデルはまだありません",
    links: "リンク",
    untagged: "タグなし",
  },
  ko: {
    searchLabel: "Recall",
    searchPlaceholder: "이 뱅크에 묻기",
    searchSubmit: "Recall",
    weekTitle: "최근 7일간의 새 항목",
    weekEmpty: "이번 주에는 새 항목이 없습니다",
    weekAll: "모든 태그",
    weekLatest: "최신만",
    modelsTitle: "멘탈 모델",
    modelsEmpty: "아직 멘탈 모델이 없습니다",
    links: "연결",
    untagged: "태그 없음",
  },
  "zh-CN": {
    searchLabel: "Recall",
    searchPlaceholder: "询问此记忆库",
    searchSubmit: "Recall",
    weekTitle: "过去 7 天的新增",
    weekEmpty: "本周没有新增",
    weekAll: "全部标签",
    weekLatest: "仅最新",
    modelsTitle: "心智模型",
    modelsEmpty: "还没有心智模型",
    links: "关联",
    untagged: "无标签",
  },
  "zh-TW": {
    searchLabel: "Recall",
    searchPlaceholder: "詢問此記憶庫",
    searchSubmit: "Recall",
    weekTitle: "過去 7 天的新增",
    weekEmpty: "本週沒有新增",
    weekAll: "全部標籤",
    weekLatest: "僅最新",
    modelsTitle: "心智模型",
    modelsEmpty: "還沒有心智模型",
    links: "關聯",
    untagged: "無標籤",
  },
  "yue-Hant": {
    searchLabel: "Recall",
    searchPlaceholder: "問呢個記憶庫",
    searchSubmit: "Recall",
    weekTitle: "過去 7 日新增",
    weekEmpty: "今個星期冇新增",
    weekAll: "全部標籤",
    weekLatest: "只係最新",
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
