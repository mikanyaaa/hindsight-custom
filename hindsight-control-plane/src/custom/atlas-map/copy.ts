import { defaultLocale, locales, type Locale } from "@/i18n/config";

interface MapCopy {
  title: string;
  error: string;
  fit: string;
  explore: string;
  keyboard: string;
}

const copy: Record<Locale, MapCopy> = {
  en: {
    title: "Memory map",
    error: "The memory map couldn’t load.",
    fit: "Fit map to view",
    explore: "Open the full memory explorer",
    keyboard: "Use the arrow keys to move between memories and Enter to open the selected memory.",
  },
  de: {
    title: "Gedächtniskarte",
    error: "Die Gedächtniskarte konnte nicht geladen werden.",
    fit: "Karte einpassen",
    explore: "Vollständige Erinnerungsansicht öffnen",
    keyboard: "Mit den Pfeiltasten zwischen Erinnerungen wechseln und mit Eingabe öffnen.",
  },
  es: {
    title: "Mapa de memorias",
    error: "No se pudo cargar el mapa de memorias.",
    fit: "Ajustar el mapa a la vista",
    explore: "Abrir el explorador de memorias completo",
    keyboard: "Usa las flechas para recorrer las memorias y pulsa Intro para abrir una.",
  },
  fr: {
    title: "Carte des souvenirs",
    error: "Impossible de charger la carte des souvenirs.",
    fit: "Ajuster la carte à la vue",
    explore: "Ouvrir l’explorateur complet des souvenirs",
    keyboard: "Utilisez les flèches pour parcourir les souvenirs et Entrée pour en ouvrir un.",
  },
  pt: {
    title: "Mapa de memórias",
    error: "Não foi possível carregar o mapa de memórias.",
    fit: "Ajustar o mapa à vista",
    explore: "Abrir o explorador completo de memórias",
    keyboard: "Use as teclas de seta para navegar pelas memórias e Enter para abrir uma.",
  },
  ja: {
    title: "メモリマップ",
    error: "メモリマップを読み込めませんでした。",
    fit: "マップ全体を表示",
    explore: "メモリエクスプローラーを開く",
    keyboard: "矢印キーでメモリ間を移動し、Enter キーで開きます。",
  },
  ko: {
    title: "메모리 지도",
    error: "메모리 지도를 불러올 수 없습니다.",
    fit: "지도 전체 보기",
    explore: "전체 메모리 탐색기 열기",
    keyboard: "화살표 키로 메모리 사이를 이동하고 Enter 키를 눌러 엽니다.",
  },
  "zh-CN": {
    title: "记忆地图",
    error: "无法加载记忆地图。",
    fit: "显示完整地图",
    explore: "打开完整的记忆浏览器",
    keyboard: "按方向键在记忆之间切换，按回车键打开记忆。",
  },
  "zh-TW": {
    title: "記憶地圖",
    error: "無法載入記憶地圖。",
    fit: "顯示完整地圖",
    explore: "開啟完整的記憶瀏覽器",
    keyboard: "按方向鍵在記憶之間切換，再按 Enter 鍵開啟。",
  },
  "yue-Hant": {
    title: "記憶地圖",
    error: "載入唔到記憶地圖。",
    fit: "睇晒成張地圖",
    explore: "開啟完整嘅記憶瀏覽器",
    keyboard: "撳方向鍵揀記憶，再撳 Enter 開啟。",
  },
};

export function mapCopyFor(locale: string): MapCopy {
  return copy[locales.find((value) => value === locale) ?? defaultLocale];
}
