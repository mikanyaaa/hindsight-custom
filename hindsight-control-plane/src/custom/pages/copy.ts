import type { Locale } from "@/i18n/config";

export interface PageCopy {
  loading: string;
  errorTitle: string;
  retry: string;
}

const en: PageCopy = {
  loading: "Loading",
  errorTitle: "This page could not be loaded.",
  retry: "Try again",
};

/** Shared loading and error lines. Each page keeps its own empty-state sentence. */
export const pageCopy: Record<Locale, PageCopy> = {
  en,
  de: {
    loading: "Wird geladen",
    errorTitle: "Diese Seite konnte nicht geladen werden.",
    retry: "Erneut versuchen",
  },
  es: {
    loading: "Cargando",
    errorTitle: "No se pudo cargar esta página.",
    retry: "Reintentar",
  },
  fr: {
    loading: "Chargement",
    errorTitle: "Cette page n'a pas pu être chargée.",
    retry: "Réessayer",
  },
  pt: {
    loading: "A carregar",
    errorTitle: "Não foi possível carregar esta página.",
    retry: "Tentar novamente",
  },
  ja: {
    loading: "読み込み中",
    errorTitle: "このページを読み込めませんでした。",
    retry: "再試行",
  },
  ko: {
    loading: "불러오는 중",
    errorTitle: "이 페이지를 불러오지 못했습니다.",
    retry: "다시 시도",
  },
  "zh-CN": {
    loading: "正在加载",
    errorTitle: "无法加载此页面。",
    retry: "重试",
  },
  "zh-TW": {
    loading: "正在載入",
    errorTitle: "無法載入此頁面。",
    retry: "重試",
  },
  "yue-Hant": {
    loading: "載入緊",
    errorTitle: "呢頁載入唔到。",
    retry: "再試",
  },
};

export function pageCopyFor(locale: string): PageCopy {
  if (locale in pageCopy) return pageCopy[locale as Locale];
  return en;
}
