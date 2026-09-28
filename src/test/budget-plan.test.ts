import { describe, it, expect } from "vitest";
import {
  buildPlanLines,
  balancePlan,
  planTotal,
  categoryStyle,
  withAlpha,
  stepFor,
  fallbackSplit,
} from "@/lib/budgetPlan";
import { CATEGORY_ICON_MAP } from "@/lib/categoryIconMap";

describe("buildPlanLines", () => {
  it("keeps fixed expenses as their own lines and appends the AI split", () => {
    const lines = buildPlanLines(
      [{ nom: "Loyer", montant: 60000 }],
      [
        { categorie: "Alimentation", montant: 75000 },
        { categorie: "Transport", montant: 25000 },
      ]
    );
    expect(lines.map((l) => [l.nom, l.montant, l.fixed])).toEqual([
      ["Loyer", 60000, true],
      ["Alimentation", 75000, false],
      ["Transport", 25000, false],
    ]);
  });

  it("merges an AI line into a matching fixed expense instead of duplicating it", () => {
    const lines = buildPlanLines(
      [{ nom: "Loyer", montant: 60000 }, { nom: "Aide famille", montant: 10000 }],
      [
        { categorie: "Logement", montant: 5000 },
        { categorie: "Famille", montant: 2000 },
      ]
    );
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ nom: "Loyer", montant: 65000, fixed: true });
    expect(lines[1]).toMatchObject({ nom: "Aide famille", montant: 12000, fixed: true });
  });

  it("drops empty and zero lines", () => {
    const lines = buildPlanLines(
      [{ nom: "  ", montant: 5000 }, { nom: "École", montant: 0 }],
      [{ categorie: "", montant: 100 }, { categorie: "Loisirs", montant: 0 }]
    );
    expect(lines).toEqual([]);
  });
});

describe("balancePlan", () => {
  const base = () =>
    buildPlanLines(
      [{ nom: "Loyer", montant: 60000 }],
      [
        { categorie: "Alimentation", montant: 75000 },
        { categorie: "Transport", montant: 25000 },
      ]
    );

  it("fills the remainder on variable lines only, keeping fixed ones intact", () => {
    const out = balancePlan(base(), 250000);
    expect(planTotal(out)).toBe(250000);
    expect(out[0].montant).toBe(60000);
    // 90 000 à répartir au prorata 75/25
    expect(out[1].montant).toBe(142500);
    expect(out[2].montant).toBe(47500);
  });

  it("reduces variable lines when the plan is over the total", () => {
    const out = balancePlan(base(), 140000);
    expect(planTotal(out)).toBe(140000);
    expect(out[0].montant).toBe(60000);
    expect(out.every((l) => l.montant >= 0)).toBe(true);
  });

  it("does not touch lines the user edited while others can absorb the gap", () => {
    const lines = base();
    lines[2] = { ...lines[2], montant: 40000, touched: true };
    const out = balancePlan(lines, 200000);
    expect(planTotal(out)).toBe(200000);
    expect(out[2].montant).toBe(40000);
    expect(out[0].montant).toBe(60000);
    expect(out[1].montant).toBe(100000);
  });

  it("falls back to fixed lines when nothing else can absorb an overrun", () => {
    const lines = buildPlanLines([{ nom: "Loyer", montant: 60000 }, { nom: "École", montant: 30000 }], []);
    const out = balancePlan(lines, 45000);
    expect(planTotal(out)).toBe(45000);
    expect(out.every((l) => l.montant >= 0)).toBe(true);
  });

  it("never produces negative amounts even for a huge overrun", () => {
    const out = balancePlan(base(), 0);
    expect(planTotal(out)).toBe(0);
    expect(out.every((l) => l.montant === 0)).toBe(true);
  });
});

describe("categoryStyle", () => {
  it("maps common Ivorian budget names to icons that exist in the app", () => {
    for (const name of ["Loyer", "Alimentation", "Nourriture", "Transport", "Factures", "Crédit téléphone", "École", "Tontine", "Épargne", "Imprévus", "Loisirs", "Santé", "Aide famille", "Remboursement", "Fêtes", "Truc inconnu"]) {
      const s = categoryStyle(name);
      expect(CATEGORY_ICON_MAP[s.icon], name).toBeDefined();
      expect(s.color).toMatch(/^hsl\(/);
    }
    expect(categoryStyle("Crédit téléphone").icon).toBe("Smartphone");
    expect(categoryStyle("Remboursement crédit").icon).toBe("HandCoins");
    expect(categoryStyle("Truc inconnu").icon).toBe("Wallet");
  });
});

describe("fallbackSplit", () => {
  it("splits what is left into sensible lines that balance to the total", () => {
    const split = fallbackSplit(190000);
    expect(split.map((s) => s.categorie)).toContain("Épargne");
    const lines = balancePlan(buildPlanLines([{ nom: "Loyer", montant: 60000 }], split), 250000);
    expect(planTotal(lines)).toBe(250000);
  });

  it("returns nothing when there is nothing left to split", () => {
    expect(fallbackSplit(0)).toEqual([]);
    expect(fallbackSplit(-5000)).toEqual([]);
  });
});

describe("helpers", () => {
  it("withAlpha handles hsl, hex and unknown colors", () => {
    expect(withAlpha("hsl(28, 90%, 55%)", 0.2)).toBe("hsl(28 90% 55% / 0.2)");
    expect(withAlpha("#FF8A1F", 0.5)).toBe("rgba(255, 138, 31, 0.5)");
    expect(withAlpha(null, 0.3)).toBe("hsl(var(--primary) / 0.3)");
  });

  it("stepFor scales with the amount", () => {
    expect(stepFor(5000)).toBe(500);
    expect(stepFor(50000)).toBe(1000);
    expect(stepFor(150000)).toBe(5000);
  });
});
