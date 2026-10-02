import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod@3.25.76";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";
import { loadUserCurrency } from "../_shared/currency-context.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const BudgetSuggestSchema = z.object({
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2020).max(2100).optional(),
  totalBudget: z.number().min(0).max(999_999_999).optional(),
  userCategories: z.array(z.string().trim().max(100)).max(50).optional(),
}).partial();

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Token invalide" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    {
      const rl = await checkRateLimit(user.id, 'budget-suggest', 20, 60);
      if (!rl.allowed) return rateLimitResponse('budget-suggest', rl.retryAfter, corsHeaders);
    }

    const rawBody = await req.json().catch(() => ({}));
    const parsed = BudgetSuggestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten() }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const month: number = parsed.data.month ?? new Date().getMonth() + 1;
    const year: number = parsed.data.year ?? new Date().getFullYear();
    const totalBudget: number = parsed.data.totalBudget ?? 0;
    const userCategoriesInput: string[] = (parsed.data.userCategories ?? []).filter(Boolean);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Configuration IA manquante" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Date ranges
    const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay =
      month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    // Current month expenses by category + 3-month history
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const histStart = threeMonthsAgo.toISOString().split("T")[0];

    const [currentTxRes, histTxRes] = await Promise.all([
      supabaseAuth
        .from("transactions")
        .select("amount, categories:category_id(name)")
        .eq("user_id", user.id)
        .eq("type", "expense")
        .gte("date", firstDay)
        .lt("date", lastDay),
      supabaseAuth
        .from("transactions")
        .select("amount, categories:category_id(name)")
        .eq("user_id", user.id)
        .eq("type", "expense")
        .gte("date", histStart)
        .lt("date", firstDay),
    ]);

    const currentTx = currentTxRes.data || [];
    const histTx = histTxRes.data || [];

    const expensesByCategory: Record<string, number> = {};
    for (const t of currentTx) {
      const cat = (t as any).categories?.name || "Autre";
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + Number(t.amount);
    }
    const totalSpent = Object.values(expensesByCategory).reduce((s, v) => s + v, 0);
    const budgetRestant = Math.max(0, totalBudget - totalSpent);

    // Historical monthly average per category
    const histByCat: Record<string, number> = {};
    for (const t of histTx) {
      const cat = (t as any).categories?.name || "Autre";
      histByCat[cat] = (histByCat[cat] || 0) + Number(t.amount);
    }
    const avgByCat: Record<string, number> = {};
    for (const [k, v] of Object.entries(histByCat)) {
      avgByCat[k] = Math.round(v / 3);
    }

    // Days remaining
    const lastDayDate = new Date(year, month, 0).getDate();
    const today = new Date();
    const isCurrentMonth =
      today.getMonth() + 1 === month && today.getFullYear() === year;
    const joursRestants = isCurrentMonth
      ? Math.max(1, lastDayDate - today.getDate())
      : lastDayDate;

    const ctx = await loadUserCurrency(supabaseAuth, user.id);
    const fmt = (n: number) => n.toLocaleString(ctx.language === 'en' ? 'en-US' : 'fr-FR');

    const expensesList =
      Object.entries(expensesByCategory)
        .map(([cat, amt]) => `- ${cat} : ${fmt(amt)} ${ctx.label}`)
        .join("\n") || `- Aucune dépense ce mois`;

    const histList =
      Object.entries(avgByCat)
        .map(([cat, amt]) => `- ${cat} : ~${fmt(amt)} ${ctx.label}/mois`)
        .join("\n") || "- Pas d'historique";

    const categoriesList =
      userCategoriesInput.length > 0
        ? userCategoriesInput.map((c) => `- ${c}`).join("\n")
        : "- Alimentation\n- Transport\n- Téléphone\n- Shopping\n- Factures\n- Santé\n- Loisirs\n- Sport\n- Autre";

    const systemPrompt = `Tu es un conseiller financier pour Mon Jeton, app fintech utilisée en ${ctx.region}. L'utilisateur gère son argent en ${ctx.label}.

Moyens de paiement courants : ${ctx.wallets}.
Exemples de charges typiques : ${ctx.costExamples}.
Taux d'épargne réaliste : ${ctx.savingsRate}.

DONNÉES RÉELLES DE L'UTILISATEUR :
- Budget total du mois : ${fmt(totalBudget)} ${ctx.label}
- Total déjà dépensé : ${fmt(totalSpent)} ${ctx.label}
- Budget restant disponible : ${fmt(budgetRestant)} ${ctx.label}
- Jours restants dans le mois : ${joursRestants}

Dépenses actuelles par catégorie ce mois :
${expensesList}

Moyenne historique 3 derniers mois :
${histList}

CATÉGORIES DISPONIBLES DE L'UTILISATEUR (UTILISE EXACTEMENT CES NOMS, AUCUN AUTRE) :
${categoriesList}

RÈGLE ABSOLUE #1 : Le champ "categorie" de chaque suggestion DOIT être STRICTEMENT identique à l'un des noms de la liste ci-dessus (même orthographe, mêmes accents, même casse). N'invente JAMAIS de noms composés type "Business & Entreprise", "Épargne & Investissement", "Factures & Téléphone". Si tu veux regrouper une idée, choisis UNE SEULE catégorie existante de la liste.

RÈGLE ABSOLUE #2 : La somme de TOUTES tes suggestions de budget par catégorie NE DOIT JAMAIS dépasser ${fmt(totalBudget)} ${ctx.label}. C'est le budget que l'utilisateur a fixé. Respecte-le strictement.

RÈGLE CRITIQUE #3 : Pour CHAQUE catégorie, le montant suggéré DOIT être SUPÉRIEUR OU ÉGAL au montant déjà dépensé sur cette catégorie ce mois (voir liste ci-dessus). Il est INTERDIT de proposer un budget inférieur à ce qui a déjà été dépensé — sinon l'utilisateur serait déjà en dépassement. Si une catégorie a déjà dépensé X ${ctx.label}, propose au minimum X ${ctx.label} (idéalement avec une petite marge).

Génère 5 à 7 suggestions de répartition en utilisant UNIQUEMENT les catégories de la liste ci-dessus, en tenant compte des dépenses déjà effectuées et de l'historique. Les montants suggérés doivent être RÉALISTES pour ${ctx.region} et adaptés au budget de ${fmt(totalBudget)} ${ctx.label}. Utilise le tool "suggest_budget" pour répondre.`;

    const aiBody = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Génère mes suggestions de répartition de budget." },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "suggest_budget",
            description: "Renvoie une répartition du budget par catégorie.",
            parameters: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      categorie: { type: "string" },
                      montant_suggere: { type: "number" },
                      pourcentage: { type: "number" },
                      conseil: { type: "string" },
                    },
                    required: ["categorie", "montant_suggere", "pourcentage", "conseil"],
                    additionalProperties: false,
                  },
                },
                conseil_global: { type: "string" },
              },
              required: ["suggestions", "conseil_global"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "suggest_budget" } },
    };

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(aiBody),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, t);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessaie dans un instant." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA épuisés." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erreur du service IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    let aiParsed: any = { suggestions: [], conseil_global: "" };
    try {
      aiParsed = JSON.parse(toolCall?.function?.arguments || "{}");
    } catch (e) {
      console.error("Parse tool args failed:", e);
    }

    let suggestions = Array.isArray(aiParsed.suggestions) ? aiParsed.suggestions : [];
    // Sanitize
    suggestions = suggestions
      .map((s: any) => ({
        categorie: String(s.categorie || "").slice(0, 60),
        montant_suggere: Math.max(0, Math.round(Number(s.montant_suggere) || 0)),
        pourcentage: Math.max(0, Math.round(Number(s.pourcentage) || 0)),
        conseil: String(s.conseil || "").slice(0, 240),
      }))
      .filter((s: any) => s.categorie && s.montant_suggere > 0);

    // Build spent lookup (case-insensitive)
    const spentLookup: Record<string, number> = {};
    for (const [k, v] of Object.entries(expensesByCategory)) {
      spentLookup[k.trim().toLowerCase()] = Number(v) || 0;
    }

    // Enforce floor: montant_suggere >= already spent on that category
    suggestions = suggestions.map((s: any) => {
      const spent = spentLookup[s.categorie.trim().toLowerCase()] || 0;
      if (spent > s.montant_suggere) {
        return { ...s, montant_suggere: Math.ceil(spent) };
      }
      return s;
    });

    // Server-side recalibration safeguard (cap to totalBudget while preserving floors)
    if (totalBudget > 0) {
      const totalSuggere = suggestions.reduce((sum: number, s: any) => sum + s.montant_suggere, 0);
      if (totalSuggere > totalBudget && totalSuggere > 0) {
        const floors = suggestions.map((s: any) => spentLookup[s.categorie.trim().toLowerCase()] || 0);
        const totalFloor = floors.reduce((a: number, b: number) => a + b, 0);
        if (totalFloor >= totalBudget) {
          // Spending already exceeds budget — keep floors, no scaling possible
          suggestions = suggestions.map((s: any, i: number) => ({
            ...s,
            montant_suggere: Math.ceil(floors[i]),
            pourcentage: Math.round((floors[i] / totalBudget) * 100),
          }));
        } else {
          // Scale only the surplus above each floor proportionally
          const surplusBudget = totalBudget - totalFloor;
          const totalSurplus = suggestions.reduce(
            (sum: number, s: any, i: number) => sum + Math.max(0, s.montant_suggere - floors[i]),
            0
          );
          const ratio = totalSurplus > 0 ? surplusBudget / totalSurplus : 0;
          suggestions = suggestions.map((s: any, i: number) => {
            const surplus = Math.max(0, s.montant_suggere - floors[i]);
            const newAmount = Math.floor(floors[i] + surplus * ratio);
            return {
              ...s,
              montant_suggere: newAmount,
              pourcentage: Math.round((newAmount / totalBudget) * 100),
            };
          });
        }
      } else {
        // Recompute pourcentage based on enforced floors
        suggestions = suggestions.map((s: any) => ({
          ...s,
          pourcentage: Math.round((s.montant_suggere / totalBudget) * 100),
        }));
      }
    }

    return new Response(
      JSON.stringify({
        suggestions,
        conseil_global: String(aiParsed.conseil_global || "").slice(0, 500),
        totalBudget,
        totalSpent,
        budgetRestant,
        expensesByCategory,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("budget-suggest error:", e);
    return new Response(JSON.stringify({ error: "Erreur de traitement" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
