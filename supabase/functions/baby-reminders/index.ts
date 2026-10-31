// Rappels « bébé Jeton » → push web quand le bébé n'a pas été nourri depuis 2 jours.
// Déclenché par pg_cron tous les jours à 12h UTC (job 'baby-reminders').
//
// Le bébé est nourri dès que l'utilisateur crée une transaction. Ici on calcule,
// pour chaque bébé, les jours entiers UTC depuis son dernier repas
// (last_fed_at = greatest(born_at, dernière transaction créée), lu dans le
// journal baby_feed_days : une transaction supprimée ensuite ne relance pas la
// faim ; même règle que get_baby_status()) et on envoie un message de plus en
// plus tendre :
//   J2 petit creux · J3-J4 a faim · J5-J6 pleure un peu · J7 s'est endormi.
// Au-delà de J7 : silence jusqu'au prochain repas.
//
// Ciblage
//   - Bébés avec notifications_enabled = true dont le propriétaire a au moins
//     un abonnement push actif (fonction SQL baby_hunger_candidates, une seule
//     requête pour tous les bébés : pas de N+1).
//
// Anti-spam
//   - Max 1 push / jour / utilisateur pour le type baby_hunger (dedupKey = date du jour).
//
// Auth : token cron partagé.

import { getCorsHeaders as _getCorsHeaders } from "../_shared/cors.ts";
import {
  checkCronToken,
  makeServiceClient,
  sendPushWithGuard,
  todayKey,
} from "../_shared/push.ts";
import { buildHungerMessage, daysSinceFedUtc, type HungerStage } from "./logic.ts";

function corsHeaders(req: Request) {
  const h = _getCorsHeaders(req);
  h["Access-Control-Allow-Headers"] =
    (h["Access-Control-Allow-Headers"] || "") + ", x-cron-token";
  return h;
}

type Candidate = {
  user_id: string;
  name: string;
  variant: string;
  last_fed_at: string;
};

const PAGE_SIZE = 1000; // limite max-rows de PostgREST
const CONCURRENCY = 8; // envois en parallèle (reste raisonnable pour les services push)

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabase = makeServiceClient();
  if (!(await checkCronToken(supabase, req))) {
    return json({ error: "unauthorized" }, 401);
  }

  // 1) Tous les bébés éligibles, par pages (PostgREST plafonne à 1000 lignes).
  const candidates: Candidate[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .rpc("baby_hunger_candidates")
      .order("user_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error("baby candidates load failed", { msg: error.message });
      return json({ error: error.message }, 500);
    }
    const rows = (data || []) as Candidate[];
    candidates.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }

  // 2) Qui a faim aujourd'hui ? (calcul pur, même règle que l'app)
  const now = new Date();
  const today = todayKey(now);
  const byStage: Record<HungerStage, number> = {
    petit_creux: 0,
    faim: 0,
    pleure: 0,
    endormi: 0,
  };
  const toSend: { userId: string; title: string; body: string; days: number }[] = [];
  for (const c of candidates) {
    const days = daysSinceFedUtc(c.last_fed_at, now);
    const msg = buildHungerMessage(c.name, c.variant, days);
    if (!msg || days === null) continue;
    byStage[msg.stage]++;
    toSend.push({ userId: c.user_id, title: msg.title, body: msg.body, days });
  }

  // 3) Envoi (1 / jour / utilisateur grâce à la garde anti-spam).
  let pushed = 0;
  let skipped = 0;
  let errors = 0;
  for (let i = 0; i < toSend.length; i += CONCURRENCY) {
    const batch = toSend.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((m) =>
        sendPushWithGuard(supabase, {
          userId: m.userId,
          notificationType: "baby_hunger",
          dedupKey: today,
          payload: {
            title: m.title,
            body: m.body,
            url: "/transactions/new",
            tag: "baby-hunger",
            data: { kind: "baby_hunger", days: m.days },
          },
        }).catch((e) => {
          console.error("baby push failed", { msg: (e as Error)?.message });
          return { sent: 0, skipped: false, errors: 1 };
        })
      ),
    );
    for (const r of results) {
      if (r.skipped) skipped++;
      if (r.sent > 0) pushed++;
      errors += r.errors;
    }
  }

  return json({
    ok: true,
    babies: candidates.length,
    hungry: toSend.length,
    pushed,
    skipped,
    errors,
    byStage,
  });
});
