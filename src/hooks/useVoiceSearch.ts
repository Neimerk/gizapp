import { useState, useCallback, useRef } from "react";

type Status = "idle" | "listening" | "unsupported";

export function useVoiceSearch(onResult: (text: string) => void) {
  const [status, setStatus] = useState<Status>("idle");
  const recRef = useRef<SpeechRecognition | null>(null);

  const supported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const start = useCallback(() => {
    if (!supported) { setStatus("unsupported"); return; }

    const SR =
      window.SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition: typeof SpeechRecognition })
        .webkitSpeechRecognition;

    const rec = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    recRef.current = rec;

    rec.onstart = () => setStatus("listening");
    rec.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript ?? "";
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
