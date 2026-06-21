import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/authStore";

type ErrorType = "uncaught" | "unhandledrejection" | "react";

// Deduplica erros idênticos dentro da mesma sessão (max 20 envios por sessão)
const sentErrors = new Set<string>();
const MAX_PER_SESSION = 20;

// Padrões que indicam erros de extensão de browser ou ruído — não logar
const IGNORE_PATTERNS = [
  /extension/i,
  /chrome-extension/i,
  /moz-extension/i,
  /ResizeObserver loop/i,
  /Non-Error promise rejection/i,
  /Loading chunk/i,          // erros de lazy-load por conexão fraca
  /Failed to fetch dynamically/i,
];

function shouldIgnore(message: string): boolean {
  return IGNORE_PATTERNS.some((p) => p.test(message));
}

// Remove tokens, CPFs e outros dados sensíveis do stack trace antes de logar
function sanitize(text: string | undefined): string | undefined {
  if (!text) return text;
  return text
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
    .replace(/eyJ[A-Za-z0-9_-]{10,}/g, "[JWT_REDACTED]")
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[CPF_REDACTED]")
    .replace(/apikey=[^\s&"']+/gi, "apikey=[REDACTED]");
}

async function sendError(
  type: ErrorType,
  message: string,
  stack?: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  if (sentErrors.size >= MAX_PER_SESSION) return;
  if (shouldIgnore(message)) return;

  // Chave de deduplicação: tipo + primeiras 120 chars da mensagem
  const key = `${type}:${message.slice(0, 120)}`;
  if (sentErrors.has(key)) return;
  sentErrors.add(key);

  const user = useAuthStore.getState().user;

  await supabase.from("error_logs").insert({
    error_type: type,
    message:    message.slice(0, 500),
    stack:      sanitize(stack)?.slice(0, 3000),
    url:        window.location.href,
    user_id:    user?.id ?? null,
    user_agent: navigator.userAgent.slice(0, 300),
    extra:      extra ?? null,
  }).then(({ error }) => {
    // Silencioso — não queremos que o error monitor cause mais erros
    if (error && import.meta.env.DEV) {
      console.warn("[errorMonitor] falha ao logar:", error.message);
    }
  });
}

export function useErrorMonitor(): void {
  useEffect(() => {
    // Erros JS síncronos não capturados
    const onError = (event: ErrorEvent) => {
      sendError(
        "uncaught",
        event.message || "Unknown error",
        event.error?.stack,
        { filename: event.filename, lineno: event.lineno, colno: event.colno },
      );
    };

    // Promises rejeitadas sem .catch()
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
          ? reason
          : JSON.stringify(reason).slice(0, 300);
      const stack = reason instanceof Error ? reason.stack : undefined;
      sendError("unhandledrejection", message || "Unhandled rejection", stack);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);
}

// Chamado manualmente pelo ErrorBoundary do React
export function reportReactError(error: Error, componentStack: string): void {
  sendError("react", error.message, error.stack, {
    componentStack: componentStack.slice(0, 1000),
  });
}
