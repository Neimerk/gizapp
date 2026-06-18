import { useState, useCallback, useRef } from "react";

type Status = "idle" | "listening" | "unsupported";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecognition = any;

export function useVoiceSearch(onResult: (text: string) => void) {
  const [status, setStatus] = useState<Status>("idle");
  const recRef = useRef<AnyRecognition>(null);

  const supported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const start = useCallback(() => {
    if (!supported) { setStatus("unsupported"); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    const rec: AnyRecognition = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    recRef.current = rec;

    rec.onstart = () => setStatus("listening");
    rec.onresult = (e: AnyRecognition) => {
      const text: string = e.results[0]?.[0]?.transcript ?? "";
      if (text) onResult(text);
      setStatus("idle");
    };
    rec.onerror = () => setStatus("idle");
    rec.onend = () => setStatus("idle");
    rec.start();
  }, [supported, onResult]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setStatus("idle");
  }, []);

  return { status, supported, start, stop };
}
