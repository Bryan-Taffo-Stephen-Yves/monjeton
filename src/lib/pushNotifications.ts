import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
const SW_PATH = "/sw.js";

function isPreviewOrDev(): boolean {
  if (!import.meta.env.PROD) return true;
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = window.location.hostname;
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return true;
  if (h === "lovableproject.com" || h.endsWith(".lovableproject.com")) return true;
  if (h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com")) return true;
  if (h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev")) return true;
  if (window.location.search.includes("sw=off")) return true;
  return false;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function bufferToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getOrRegisterSW(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  if (isPreviewOrDev()) {
    // Nettoie un éventuel SW enregistré en preview
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) {
        if (r.active?.scriptURL?.endsWith(SW_PATH)) await r.unregister();
      }
    } catch {}
    return null;
  }
  const existing = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (existing) return existing;
  return navigator.serviceWorker.register(SW_PATH);
}

export async function getNotificationPermission(): Promise<NotificationPermission> {
  if (!pushSupported()) return "denied";
  return Notification.permission;
}

export async function enableDailyReminders(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  if (!pushSupported()) return { ok: false, error: "unsupported" };
  if (!VAPID_PUBLIC_KEY) return { ok: false, error: "missing_vapid_key" };
  if (isPreviewOrDev()) return { ok: false, error: "preview_disabled" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, error: "permission_denied" };

  const reg = await getOrRegisterSW();
  if (!reg) return { ok: false, error: "sw_register_failed" };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
    });
  }

  const p256dh = bufferToBase64Url(sub.getKey("p256dh"));
  const auth = bufferToBase64Url(sub.getKey("auth"));

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: uid,
        endpoint: sub.endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent,
        disabled_at: null,
      },
      { onConflict: "endpoint" }
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function disableDailyReminders(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  const endpoint = sub?.endpoint;
  if (endpoint) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    try { await sub!.unsubscribe(); } catch {}
  }
}

export async function isDailyReminderActive(): Promise<boolean> {
  if (!pushSupported() || isPreviewOrDev()) return false;
  if (Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return !!sub;
}

/**
 * Envoie une notification de test à tous les appareils abonnés de l'utilisateur.
 * Elle arrive même si l'app est fermée : c'est le vrai test de bout en bout.
 */
export async function sendTestPush(): Promise<
  { ok: true; sent: number } | { ok: false; error: string }
> {
  const { data, error } = await supabase.functions.invoke("send-test-push", { body: {} });
  if (error) {
    let code = "send_failed";
    try {
      const ctx = (error as { context?: Response }).context;
      const body = ctx ? await ctx.json() : null;
      if (body?.error) code = String(body.error);
    } catch {
      // Réponse illisible : on garde le code générique.
    }
    return { ok: false, error: code };
  }
  return { ok: true, sent: (data as { sent?: number })?.sent ?? 0 };
}
