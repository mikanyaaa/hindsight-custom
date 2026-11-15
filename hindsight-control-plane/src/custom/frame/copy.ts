import type { Locale } from "@/i18n/config";

export interface FrameCopy {
  openPalette: string;
  paletteLabel: string;
  placeholder: string;
  empty: string;
  pages: string;
  actions: string;
  navigation: string;
  more: string;
}

const en: FrameCopy = {
  openPalette: "Search",
  paletteLabel: "Open the command menu",
  placeholder: "Jump to a page or action",
  empty: "Nothing matches",
  pages: "Pages",
  actions: "Actions",
  navigation: "Sections",
  more: "More pages",
};

/** Short chrome strings. Page names stay in the shared catalogs. */
export const frameCopy: Record<Locale, FrameCopy> = {
  en,
  de: {
    openPalette: "Suchen",
    paletteLabel: "Befehlsmenü öffnen",
    placeholder: "Seite oder Aktion",
    empty: "Keine Treffer",
    pages: "Seiten",
    actions: "Aktionen",
    navigation: "Bereiche",
    more: "Weitere Seiten",
  },
  es: {
    openPalette: "Buscar",
    paletteLabel: "Abrir el menú de comandos",
    placeholder: "Ir a una página o acción",
    empty: "Sin resultados",
    pages: "Páginas",
    actions: "Acciones",
    navigation: "Secciones",
    more: "Más páginas",
  },
  fr: {
    openPalette: "Rechercher",
    paletteLabel: "Ouvrir le menu de commandes",
    placeholder: "Aller à une page ou une action",
    empty: "Aucun résultat",
    pages: "Pages",
    actions: "Actions",
    navigation: "Sections",
    more: "Plus de pages",
  },
  pt: {
    openPalette: "Pesquisar",
    paletteLabel: "Abrir o menu de comandos",
    placeholder: "Ir para uma página ou ação",
    empty: "Nenhum resultado",
    pages: "Páginas",
    actions: "Ações",
    navigation: "Secções",
    more: "Mais páginas",
  },
  ja: {
    openPalette: "検索",
    paletteLabel: "コマンドメニューを開く",
    placeholder: "ページまたは操作へ",
    empty: "一致なし",
    pages: "ページ",
    actions: "操作",
    navigation: "セクション",
    more: "その他のページ",
  },
  ko: {
    openPalette: "검색",
    paletteLabel: "명령 메뉴 열기",
    placeholder: "페이지 또는 동작으로 이동",
    empty: "결과 없음",
    pages: "페이지",
    actions: "동작",
    navigation: "섹션",
    more: "다른 페이지",
  },
  "zh-CN": {
    openPalette: "搜索",
    paletteLabel: "打开命令菜单",
    placeholder: "跳转到页面或操作",
    empty: "没有匹配",
    pages: "页面",
    actions: "操作",
    navigation: "分区",
    more: "更多页面",
  },
  "zh-TW": {
    openPalette: "搜尋",
    paletteLabel: "開啟命令選單",
    placeholder: "跳至頁面或操作",
    empty: "沒有相符項目",
    pages: "頁面",
    actions: "操作",
    navigation: "分區",
    more: "更多頁面",
  },
  "yue-Hant": {
    openPalette: "搜尋",
    paletteLabel: "打開命令選單",
    placeholder: "跳去頁面或者操作",
    empty: "無相符",
    pages: "頁面",
    actions: "操作",
    navigation: "分區",
    more: "更多頁面",
  },
};

export function frameCopyFor(locale: string): FrameCopy {
  if (locale in frameCopy) return frameCopy[locale as Locale];
  return en;
}
