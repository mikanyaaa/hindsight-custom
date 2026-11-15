export type GuardCopy = {
  sessionTitle: string;
  sessionBody: string;
  sessionAction: string;
  timeoutTitle: string;
  timeoutBody: string;
  timeoutAction: string;
};

const copy: Record<string, GuardCopy> = {
  en: {
    sessionTitle: "Session expired",
    sessionBody: "Sign in again to continue.",
    sessionAction: "Sign in again",
    timeoutTitle: "Request timed out",
    timeoutBody: "The server took too long to answer.",
    timeoutAction: "Try again",
  },
  de: {
    sessionTitle: "Sitzung abgelaufen",
    sessionBody: "Melden Sie sich erneut an, um fortzufahren.",
    sessionAction: "Erneut anmelden",
    timeoutTitle: "Zeitüberschreitung",
    timeoutBody: "Die Anfrage hat zu lange gedauert.",
    timeoutAction: "Erneut versuchen",
  },
  es: {
    sessionTitle: "Sesión caducada",
    sessionBody: "Vuelva a iniciar sesión para continuar.",
    sessionAction: "Iniciar sesión",
    timeoutTitle: "Tiempo de espera agotado",
    timeoutBody: "El servidor tardó demasiado en responder.",
    timeoutAction: "Reintentar",
  },
  fr: {
    sessionTitle: "Session expirée",
    sessionBody: "Reconnectez-vous pour continuer.",
    sessionAction: "Se reconnecter",
    timeoutTitle: "Délai dépassé",
    timeoutBody: "Le serveur a mis trop de temps à répondre.",
    timeoutAction: "Réessayer",
  },
  pt: {
    sessionTitle: "Sessão expirada",
    sessionBody: "Inicie sessão novamente para continuar.",
    sessionAction: "Iniciar sessão",
    timeoutTitle: "Tempo esgotado",
    timeoutBody: "O servidor demorou demasiado a responder.",
    timeoutAction: "Tentar novamente",
  },
  ja: {
    sessionTitle: "セッションの有効期限が切れました",
    sessionBody: "続行するには再度サインインしてください。",
    sessionAction: "再度サインイン",
    timeoutTitle: "タイムアウト",
    timeoutBody: "サーバーの応答に時間がかかりすぎました。",
    timeoutAction: "再試行",
  },
  ko: {
    sessionTitle: "세션이 만료되었습니다",
    sessionBody: "계속하려면 다시 로그인하세요.",
    sessionAction: "다시 로그인",
    timeoutTitle: "요청 시간 초과",
    timeoutBody: "서버 응답이 너무 오래 걸렸습니다.",
    timeoutAction: "다시 시도",
  },
  "zh-CN": {
    sessionTitle: "会话已过期",
    sessionBody: "请重新登录后继续。",
    sessionAction: "重新登录",
    timeoutTitle: "请求超时",
    timeoutBody: "服务器响应时间过长。",
    timeoutAction: "重试",
  },
  "zh-TW": {
    sessionTitle: "工作階段已過期",
    sessionBody: "請重新登入後繼續。",
    sessionAction: "重新登入",
    timeoutTitle: "要求逾時",
    timeoutBody: "伺服器回應時間過長。",
    timeoutAction: "重試",
  },
  "yue-Hant": {
    sessionTitle: "工作階段已過期",
    sessionBody: "請重新登入後繼續。",
    sessionAction: "重新登入",
    timeoutTitle: "要求逾時",
    timeoutBody: "伺服器回應時間過長。",
    timeoutAction: "重試",
  },
};

export function guardCopy(locale: string): GuardCopy {
  return copy[locale] ?? copy.en;
}
