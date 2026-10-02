import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Basic per-user rate limiter backed by the `rate_limits` Postgres table.
 * Uses the service role internally so writes bypass RLS.
 *
 * Usage:
 *   const rl = await checkRateLimit(userId, 'chat', 60, 60);
 *   if (!rl.allowed) return new Response(
 *     JSON.stringify({ error: `Rate limit exceeded. Try again in ${rl.retryAfter} seconds.` }),
 *     { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) } }
 *   );
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
}

let _admin: ReturnType<typeof createClient> | null = null;
function getAdmin() {
  if (_admin) return _admin;
  _admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  return _admin;
}

export async function checkRateLimit(
  userId: string,
  endpoint: string,
  maxCalls: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  if (!userId) {
    return { allowed: true, remaining: maxCalls, retryAfter: 0 };
  }

  const admin = getAdmin();
  const sinceISO = new Date(Date.now() - windowSeconds * 1000).toISOString();

  try {
    const { count, error: countErr } = await admin
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .gte('called_at', sinceISO);

    if (countErr) {
      // Fail-open if the table is unreachable so a glitch doesn't break the app.
      console.warn('[rate-limit] count error', countErr.message);
      return { allowed: true, remaining: maxCalls, retryAfter: 0 };
    }

    const used = count ?? 0;
    if (used >= maxCalls) {
      return { allowed: false, remaining: 0, retryAfter: windowSeconds };
    }

    const { error: insErr } = await admin
      .from('rate_limits')
      // Types non générés côté fonctions : on largit le payload.
      .insert({ user_id: userId, endpoint } as any);
    if (insErr) console.warn('[rate-limit] insert error', insErr.message);

    return {
      allowed: true,
      remaining: Math.max(0, maxCalls - used - 1),
      retryAfter: 0,
    };
  } catch (e) {
    console.warn('[rate-limit] unexpected error', e);
    return { allowed: true, remaining: maxCalls, retryAfter: 0 };
  }
}

export function rateLimitResponse(
  endpoint: string,
  retryAfter: number,
  corsHeaders: Record<string, string>,
) {
  return new Response(
    JSON.stringify({
      error: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      endpoint,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      },
    },
  );
}
