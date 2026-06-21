import { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0));
}

async function saveSub(sub: PushSubscription): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const p256dh = btoa(String.fromCharCode(...new Uint8Array(sub.getKey("p256dh")!)));
  const auth   = btoa(String.fromCharCode(...new Uint8Array(sub.getKey("auth")!)));

  await supabase.from("push_subscriptions").upsert(
    { user_id: session.user.id, endpoint: sub.endpoint, p256dh, auth },
    { onConflict: "user_id,endpoint" },
  );
}

async function deleteSub(endpoint: string): Promise<void> {
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

export type PushStatus = "unsupported" | "default" | "granted" | "denied" | "subscribed";

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>(() => {
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator))
      return "unsupported";
    if (Notification.permission === "denied") return "denied";
    if (Notification.permission === "granted") return "granted";
    return "default";
  });

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!VAPID_PUBLIC || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return false;
    }

    try {
      const reg   = await navigator.serviceWorker.ready;
      const perm  = await Notification.requestPermission();
      if (perm !== "granted") { setStatus("denied"); return false; }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as unknown as ArrayBuffer,
      });

      await saveSub(sub);
      setStatus("subscribed");
      return true;
    } catch (e) {
      console.warn("[push] subscribe error:", e);
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<void> => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deleteSub(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("default");
    } catch (e) {
      console.warn("[push] unsubscribe error:", e);
    }
  }, []);

  /** Verifica se já existe subscrição ativa e a persiste no banco */
  const syncExisting = useCallback(async (): Promise<void> => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission !== "granted") return;

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await saveSub(sub);
        setStatus("subscribed");
      }
    } catch (e) {
      console.warn("[push] syncExisting error:", e);
    }
  }, []);

  return { status, subscribe, unsubscribe, syncExisting };
}
