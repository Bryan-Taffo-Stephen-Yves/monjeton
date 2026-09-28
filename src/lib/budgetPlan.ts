import { normalizeCategoryName, categorySimilarity } from "@/lib/categoryMatch";

/**
 * Logique pure du parcours de création de budget (sans React ni Supabase),
 * pour pouvoir la tester unitairement.
 *
 * Modèle : le budget du mois couvre TOUT le revenu. Les dépenses fixes
 * (loyer, factures…) deviennent des lignes du budget avec leur montant exact,
 * et l'IA répartit seulement ce qui reste entre les dépenses variables.
 * Sinon le loyer, noté comme une dépense, ferait dépasser un budget qui ne
 * le contenait pas.
 */

export type PlanLine = {
  key: string;
  nom: string;
  montant: number;
  /** Dépense fixe saisie par l'utilisateur (loyer, factures…). */
  fixed: boolean;
  /** Montant changé à la main : l'équilibrage automatique n'y touche pas. */
  touched: boolean;
  /** Montant proposé au départ, pour l'historique des modifications. */
  original: number;
};

export type CategoryStyle = { icon: string; color: string };

// Mots-clés (normalisés, sans accents) → icône lucide stockée en base + couleur.
// Les icônes doivent exister dans CATEGORY_ICON_MAP.
const STYLE_RULES: Array<{ words: string[]; style: CategoryStyle }> = [
  { words: ["loyer", "logement", "maison", "location"], style: { icon: "Home", color: "hsl(265, 70%, 65%)" } },
  { words: ["alimentation", "nourriture", "courses", "repas", "marche", "cuisine"], style: { icon: "Utensils", color: "hsl(28, 90%, 55%)" } },
  { words: ["transport", "taxi", "gbaka", "carburant", "essence", "deplacement"], style: { icon: "Bus", color: "hsl(200, 80%, 55%)" } },
  { words: ["facture", "factures", "electricite", "courant", "eau", "cie", "sodeci"], style: { icon: "Zap", color: "hsl(48, 95%, 55%)" } },
  { words: ["communication", "telephone", "internet", "data", "recharge", "forfait"], style: { icon: "Smartphone", color: "hsl(170, 70%, 45%)" } },
  { words: ["ecole", "scolarite", "education", "etudes", "formation"], style: { icon: "GraduationCap", color: "hsl(220, 80%, 65%)" } },
  { words: ["tontine", "cotisation"], style: { icon: "Users", color: "hsl(140, 60%, 50%)" } },
  { words: ["epargne", "economies"], style: { icon: "PiggyBank", color: "hsl(100, 80%, 50%)" } },
  { words: ["imprevus", "imprevu", "urgence", "urgences"], style: { icon: "Package", color: "hsl(15, 80%, 60%)" } },
  { words: ["loisirs", "loisir", "sorties", "divertissement", "maquis"], style: { icon: "Gamepad2", color: "hsl(330, 75%, 60%)" } },
  { words: ["sante", "pharmacie", "medical", "soins", "hopital"], style: { icon: "Stethoscope", color: "hsl(355, 75%, 62%)" } },
  { words: ["famille", "enfants", "parents"], style: { icon: "Heart", color: "hsl(340, 70%, 62%)" } },
  { words: ["credit", "dette", "dettes", "remboursement", "remboursements", "pret"], style: { icon: "HandCoins", color: "hsl(38, 90%, 55%)" } },
  { words: ["vetements", "habillement", "shopping", "mode"], style: { icon: "Shirt", color: "hsl(290, 60%, 65%)" } },
  { words: ["fetes", "fete", "cadeaux", "cadeau", "evenement", "ceremonie"], style: { icon: "Gift", color: "hsl(12, 85%, 60%)" } },
  { words: ["business", "commerce", "stock", "boutique", "marchandise"], style: { icon: "Briefcase", color: "hsl(210, 45%, 60%)" } },
];

const FALLBACK_STYLE: CategoryStyle = { icon: "Wallet", color: "hsl(210, 12%, 60%)" };

export function categoryStyle(name: string): CategoryStyle {
  const words = normalizeCategoryName(name).split(" ");
  // « Crédit téléphone » est une dépense de communication, pas une dette.
  if (words.includes("telephone") || words.includes("recharge")) return STYLE_RULES[4].style;
  for (const rule of STYLE_RULES) {
    if (words.some((w) => rule.words.includes(w))) return rule.style;
  }
  return FALLBACK_STYLE;
}

/** Dépenses fixes proposées à l'étape 2. */
export const FIXED_PRESETS: Array<{ key: string; nom: string; hint: string }> = [
  { key: "loyer", nom: "Loyer", hint: "Maison" },
  { key: "factures", nom: "Factures", hint: "Courant, eau" },
  { key: "ecole", nom: "École", hint: "Scolarité" },
  { key: "tontine", nom: "Tontine", hint: "Cotisation" },
  { key: "credit", nom: "Remboursement", hint: "Crédit, dette" },
  { key: "famille", nom: "Aide famille", hint: "Parents, proches" },
];

/** Montants proposés d'un toucher à l'étape du revenu. */
export const INCOME_CHOICES = [50000, 100000, 150000, 250000, 500000];

const round100 = (n: number) => Math.max(0, Math.round(n / 100) * 100);

/**
 * Assemble les dépenses fixes et la répartition de l'IA.
 * Une ligne IA qui correspond à une dépense fixe (« Logement » ≈ « Loyer »)
 * s'y ajoute au lieu de créer un doublon.
 */
export function buildPlanLines(
  fixed: Array<{ nom: string; montant: number }>,
  ai: Array<{ categorie: string; montant: number }>
): PlanLine[] {
  const lines: PlanLine[] = [];
  const add = (nom: string, montant: number, isFixed: boolean) => {
    const amount = Math.max(0, Math.floor(Number(montant) || 0));
    const same = lines.find((l) => categorySimilarity(l.nom, nom) >= 0.85);
    if (same) {
      same.montant += amount;
      same.original = same.montant;
      same.fixed = same.fixed || isFixed;
      return;
    }
    lines.push({
      key: `${isFixed ? "f" : "v"}-${lines.length}-${normalizeCategoryName(nom).replace(/ /g, "-")}`,
      nom: nom.trim().slice(0, 50) || "Autre",
      montant: amount,
      fixed: isFixed,
      touched: false,
      original: amount,
    });
  };
  fixed.filter((f) => f.nom.trim() && f.montant > 0).forEach((f) => add(f.nom, f.montant, true));
  ai.filter((a) => a.categorie && Number(a.montant) > 0).forEach((a) => add(a.categorie, a.montant, false));
  return lines;
}

export const planTotal = (lines: PlanLine[]) => lines.reduce((s, l) => s + l.montant, 0);

/**
 * Répartition de départ utilisée si l'IA ne répond pas (réseau, quota…),
 * pour que l'utilisateur ne reste jamais bloqué. Mêmes fourchettes que le
 * prompt de budget-coaching-plan.
 */
export function fallbackSplit(disponible: number): Array<{ categorie: string; montant: number }> {
  if (disponible <= 0) return [];
  const shares: Array<[string, number]> = [
    ["Alimentation", 0.4],
    ["Transport", 0.15],
    ["Communication", 0.05],
    ["Loisirs", 0.1],
    ["Épargne", 0.15],
    ["Imprévus", 0.15],
  ];
  return shares.map(([categorie, share]) => ({ categorie, montant: round100(disponible * share) }));
}

/**
 * Ramène la somme des lignes au total visé, en répartissant l'écart sur les
 * dépenses variables que l'utilisateur n'a pas modifiées (au prorata de leur
 * montant). Les dépenses fixes et les montants changés à la main restent tels
 * quels, sauf s'il n'y a plus rien d'autre à ajuster.
 */
export function balancePlan(lines: PlanLine[], total: number): PlanLine[] {
  const next = lines.map((l) => ({ ...l }));
  const pools = [
    next.filter((l) => !l.fixed && !l.touched),
    next.filter((l) => !l.fixed),
    next,
  ];
  for (const pool of pools) {
    let diff = total - planTotal(next);
    if (diff === 0) break;
    // Plusieurs passes : une ligne qui tombe à 0 sort du calcul.
    for (let pass = 0; pass < 5 && diff !== 0; pass++) {
      const adjustable = pool.filter((l) => diff > 0 || l.montant > 0);
      if (!adjustable.length) break;
      const base = adjustable.reduce((s, l) => s + l.montant, 0);
      for (const l of adjustable) {
        const share = base > 0 ? l.montant / base : 1 / adjustable.length;
        l.montant = round100(l.montant + diff * share);
      }
      diff = total - planTotal(next);
      // Reste d'arrondi : sur la plus grosse ligne ajustable.
      if (diff !== 0) {
        const biggest = [...adjustable].sort((a, b) => b.montant - a.montant)[0];
        const fixedUp = Math.max(0, biggest.montant + diff);
        diff -= fixedUp - biggest.montant;
        biggest.montant = fixedUp;
      }
    }
  }
  return next;
}

/** Pas du bouton +/− selon la taille du montant. */
export function stepFor(amount: number): number {
  if (amount >= 100000) return 5000;
  if (amount >= 20000) return 1000;
  return 500;
}

/** Une couleur « hsl(h, s%, l%) » ou « #rrggbb » avec de la transparence. */
export function withAlpha(color: string | null | undefined, alpha: number): string {
  const c = (color || "").trim();
  const hsl = c.match(/^hsla?\(\s*([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i);
  if (hsl) return `hsl(${hsl[1]} ${hsl[2]}% ${hsl[3]}% / ${alpha})`;
  const hex = c.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  return `hsl(var(--primary) / ${alpha})`;
}
