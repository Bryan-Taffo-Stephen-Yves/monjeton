import { createClient } from 'jsr:@supabase/supabase-js@2';
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts';
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });


  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ ok: false, reason: 'unauthorized' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return json({ ok: false, reason: 'unauthorized' }, 401);
    }
    const userId = claimsData.claims.sub as string;
    const userEmail = String((claimsData.claims as any)?.email ?? '').trim().toLowerCase();


    // Rate limit per user
    const rl = await checkRateLimit(userId, 'activate-pro-token', 10, 60);
    if (!rl.allowed) return rateLimitResponse('activate-pro-token', rl.retryAfter, corsHeaders);

    // Body
    let body: any;
    try { body = await req.json(); } catch { return json({ ok: false, reason: 'invalid' }, 400); }
    const activationToken = String(body?.token ?? '').trim();
    if (!activationToken || activationToken.length < 16) {
      return json({ ok: false, reason: 'invalid' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // Lookup token
    const { data: row, error: lookErr } = await admin
      .from('pro_activation_tokens')
      .select('*')
      .eq('token', activationToken)
      .maybeSingle();
    if (lookErr) {
      console.error('lookup error', lookErr.message);
      return json({ ok: false, reason: 'invalid' }, 500);
    }
    if (!row) return json({ ok: false, reason: 'invalid' }, 404);
    if (row.used) return json({ ok: false, reason: 'already_used' }, 409);
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return json({ ok: false, reason: 'expired' }, 410);
    }

    // Le jeton appartient a son acheteur : l'email doit correspondre (insensible a la casse)
    const tokenEmail = String(row.email ?? '').trim().toLowerCase();
    if (tokenEmail && tokenEmail !== userEmail) {
      console.warn('[activate-pro-token] email_mismatch', {
        user_id: userId,
        token_id: row.id,
      });
      return json({ ok: false, reason: 'email_mismatch' }, 403);
    }


    const now = new Date();
    // Un abonnement encore actif est prolongé, pas remplacé : les jours déjà
    // payés ne sont pas perdus.
    const { data: currentSub } = await admin
      .from('subscriptions')
      .select('status, expires_at')
      .eq('user_id', userId)
      .maybeSingle();
    const currentEnd = currentSub?.status === 'active' && currentSub.expires_at
      ? new Date(currentSub.expires_at).getTime()
      : 0;
    const expiresAt = new Date(Math.max(now.getTime(), currentEnd) + 30 * 24 * 60 * 60 * 1000);
    const graceUntil = new Date(expiresAt.getTime() + 3 * 24 * 60 * 60 * 1000);
    const plan = String(row.plan || 'pro');
    const planName = plan === 'ultra' ? 'Ultra Pro' : 'Pro';
    const priceXof = plan === 'ultra' ? 5000 : 2000;

    // ATOMIC consume: only flip if still unused & not expired
    const { data: consumed, error: consErr } = await admin
      .from('pro_activation_tokens')
      .update({
        used: true,
        used_by_user_id: userId,
        used_at: now.toISOString(),
      })
      .eq('token', activationToken)
      .eq('used', false)
      .gt('expires_at', now.toISOString())
      .select('id')
      .maybeSingle();
    if (consErr) {
      console.error('consume error', consErr.message);
      return json({ ok: false, reason: 'invalid' }, 500);
    }
    if (!consumed) {
      // raced
      return json({ ok: false, reason: 'already_used' }, 409);
    }

    // Activate Pro
    const { error: upErr } = await admin.from('subscriptions').upsert(
      {
        user_id: userId,
        status: 'active',
        plan_name: planName,
        price_xof: priceXof,
        activated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        grace_until: graceUntil.toISOString(),
        last_reminder_sent: null,
        updated_at: now.toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (upErr) {
      console.error('subscription upsert failed', upErr.message);
      // Rollback token consumption so user can retry
      await admin
        .from('pro_activation_tokens')
        .update({ used: false, used_by_user_id: null, used_at: null })
        .eq('token', activationToken);
      return json({ ok: false, reason: 'activation_failed' }, 500);
    }

    return json({ ok: true, plan });
  } catch (e) {
    console.error('activate-pro-token fatal', e);
    return json({ ok: false, reason: 'invalid' }, 500);
  }
});
