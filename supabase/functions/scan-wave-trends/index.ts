import { createClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.25.76';
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts';
import { getCorsHeaders } from "../_shared/cors.ts";
import { findMatchingCategory } from "../_shared/categoryMatch.ts";

/**
 * Lecture d'une capture de l'écran « Tendances » (Trends) de Wave.
 *
 * L'utilisateur fait lui-même une capture de ses dépenses du mois par
 * catégorie dans Wave ; on en extrait les totaux pour servir de base au mois
 * dans Mon Jeton. Aucun accès à Wave : seule l'image envoyée est lue.
 *
 * Un import compte pour 1 scan IA (quota décompté ici, avant l'appel à l'IA).
 */

const BodySchema = z.object({
  imageBase64: z.string().min(100, 'Image trop petite').max(15_000_000, 'Image > 10 Mo refusée'),
  mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic']).optional(),
});

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Authorization required' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: 'Invalid token' }, 401);

    const rl = await checkRateLimit(user.id, 'scan-wave-trends', 10, 300);
    if (!rl.allowed) return rateLimitResponse('scan-wave-trends', rl.retryAfter, corsHeaders);

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
    const { imageBase64, mediaType } = parsed.data;

    // Quota : 1 import = 1 scan IA (gratuit 5, Pro 30, Ultra illimité).
    const { data: quota, error: quotaErr } = await supabase.rpc('consume_feature', {
      _user_id: user.id,
      _feature: 'scan',
    });
    if (quotaErr) console.warn('scan-wave-trends: consume_feature indisponible', quotaErr.message);
    else if ((quota as any)?.allowed === false) return json({ error: 'quota', quota }, 402);

    const { data: cats } = await supabase.from('categories').select('name, type').eq('user_id', user.id);
    const userCategories = (cats || []).map((c: any) => ({ name: String(c.name), type: String(c.type) }));
    const expenseNames = userCategories.filter((c) => c.type === 'expense').map((c) => c.name);

    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const currentYear = now.getUTCFullYear();

    const systemPrompt = `Tu lis une capture d'écran de l'écran « Tendances » (en anglais « Trends ») de l'application de mobile money Wave, en Côte d'Ivoire ou au Sénégal. L'application peut être en français ou en anglais.

Cet écran affiche les dépenses d'une période (« Dépenses en octobre » / « Spend in October »), un sélecteur Semaine/Mois (Week/Month) et la liste des dépenses par catégorie (Shopping, Transferts/Transfers, Nourriture/Food, Transport, Factures/Bills, Crédit téléphonique/Airtime, etc.).

RÈGLES DE LECTURE DES MONTANTS (très important)
- Les montants sont en francs CFA (F), sans centimes.
- Le point, l'espace ou la virgule entre les chiffres sont des SÉPARATEURS DE MILLIERS : « 12.514F » = 12514, « 2.000F » = 2000, « 1 250 F » = 1250, « 800F » = 800.
- Donne des valeurs positives (ignore le signe moins).

Date d'aujourd'hui : ${now.toISOString().slice(0, 10)} (mois ${currentMonth}, année ${currentYear}).
- Si l'année n'est pas affichée : prends ${currentYear}, sauf si le mois affiché est après le mois en cours (alors ${currentYear - 1}).

Retourne UNIQUEMENT ce JSON :
{
  "is_wave_trends": true | false,
  "period": "month" | "week" | "unknown",
  "month": 1-12 | null,
  "year": nombre | null,
  "total": nombre (total affiché en haut, positif) | null,
  "categories": [ { "label": "nom exact affiché", "amount": nombre, "category_suggestion": "..." } ],
  "warnings": [ "..." ]
}
- "period" : "month" si l'onglet Mois/Month est sélectionné, "week" si c'est Semaine/Week.
- "categories" : une entrée par ligne visible, dans l'ordre, sans en inventer.
- Si l'image n'est pas l'écran Tendances de Wave : "is_wave_trends": false et "categories": [].${expenseNames.length ? `
- "category_suggestion" : la catégorie de l'utilisateur qui correspond le mieux, copiée à l'identique parmi : ${expenseNames.join(', ')}. Si aucune ne convient, mets le nom français naturel (ex. « Transferts », « Factures »).` : `
- "category_suggestion" : le nom français naturel de la catégorie (ex. « Shopping », « Transferts », « Alimentation », « Transport »).`}`;

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: 'Lis cette capture et retourne uniquement le JSON demandé.' },
          ],
        }],
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      console.error('scan-wave-trends: AI error', aiRes.status, err);
      const lower = err.toLowerCase();
      const reason = lower.includes('credit') || lower.includes('balance')
        ? 'Crédits IA épuisés. Recharge le compte Anthropic.'
        : aiRes.status === 429 ? 'Trop de demandes. Réessaie dans une minute.'
        : 'Le service de lecture est momentanément indisponible.';
      return json({ error: reason, status: aiRes.status }, 502);
    }

    const aiData = await aiRes.json();
    const text: string | undefined = aiData.content?.[0]?.text;
    if (!text) throw new Error('Empty AI response');
    let raw: any;
    try {
      raw = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch {
      console.error('scan-wave-trends: invalid JSON', text);
      throw new Error('Invalid JSON from AI');
    }

    const toAmount = (v: unknown) => Math.max(0, Math.min(999_999_999, Math.round(Math.abs(Number(v) || 0))));

    const categories = (Array.isArray(raw.categories) ? raw.categories : [])
      .slice(0, 30)
      .map((c: any) => {
        const label = String(c?.label || '').trim().slice(0, 60);
        const suggestion = String(c?.category_suggestion || label).trim().slice(0, 60);
        const match = findMatchingCategory(suggestion, userCategories, 'expense')
          ?? findMatchingCategory(label, userCategories, 'expense');
        return { label, amount: toAmount(c?.amount), category: match ? match.name : suggestion, existing: !!match };
      })
      .filter((c: any) => c.label && c.amount > 0);

    let month = Number(raw.month);
    let year = Number(raw.year);
    if (!(month >= 1 && month <= 12)) month = currentMonth;
    if (!(year >= 2000 && year <= currentYear)) year = currentYear;
    // Pas de mois dans le futur, ni de plus de 12 mois en arrière.
    const monthIndex = year * 12 + (month - 1);
    const nowIndex = currentYear * 12 + (currentMonth - 1);
    const monthOutOfRange = monthIndex > nowIndex || monthIndex < nowIndex - 12;

    const total = raw.total == null ? null : toAmount(raw.total);
    const sum = categories.reduce((s: number, c: any) => s + c.amount, 0);

    return json({
      is_wave_trends: raw.is_wave_trends === true && categories.length > 0,
      period: raw.period === 'month' || raw.period === 'week' ? raw.period : 'unknown',
      month,
      year,
      month_label: `${MONTHS_FR[month - 1]} ${year}`,
      month_out_of_range: monthOutOfRange,
      total,
      sum,
      // Contrôle anti-erreur de lecture : les catégories doivent retomber sur le total affiché.
      sum_matches: total != null && Math.abs(total - sum) <= Math.max(1, categories.length),
      categories,
      warnings: Array.isArray(raw.warnings) ? raw.warnings.map((w: unknown) => String(w).slice(0, 200)).slice(0, 5) : [],
      quota: quota ?? null,
    });
  } catch (e: any) {
    console.error('scan-wave-trends error:', e);
    return json({ error: e?.message || 'Internal error' }, 500);
  }
});
