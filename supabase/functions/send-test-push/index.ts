// Notification de test : l'utilisateur connecté s'envoie une push à lui-même
// (bouton « Tester » dans Paramètres → Rappels). Sert à vérifier, téléphone en
// main, que toute la chaîne marche : abonnement, clés VAPID, service worker.
//
// Limité à 5 envois par heure et par utilisateur.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:contact@monjeton.app";

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "not_authenticated" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "not_authenticated" }, 401);

  const rl = await checkRateLimit(user.id, "send-test-push", 5, 3600);
  if (!rl.allowed) return rateLimitResponse("send-test-push", rl.retryAfter, cors);

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: "missing_vapid_secret" }, 500);
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", user.id)
    .is("disabled_at", null);
  if (error) return json({ error: "db_error" }, 500);
  if (!subs || subs.length === 0) return json({ error: "no_subscription" }, 404);

  const payload = JSON.stringify({
    title: "Mon Jeton",
    body: "Ça marche ! Tu recevras tes rappels et alertes ici, même app fermée.",
    url: "/parametres",
    tag: "test-push",
  });

  let sent = 0;
  let failed = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { TTL: 60, urgency: "high" },
      );
      sent++;
    } catch (e) {
      failed++;
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await admin
          .from("push_subscriptions")
          .update({ disabled_at: new Date().toISOString() })
          .eq("id", s.id);
      } else {
        console.error("test push failed", { status });
      }
    }
  }

  return json({ sent, failed, devices: subs.length }, sent > 0 ? 200 : 502);
});
