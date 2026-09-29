/**
 * Conformité App Store / Google Play : dans l'app installée, aucun prix,
 * aucun bouton de paiement et aucune invitation à s'abonner. Sur le web,
 * rien ne change.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const native = vi.hoisted(() => ({ value: false }));
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => native.value,
    getPlatform: () => (native.value ? "android" : "web"),
  },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { UpgradeSheet } from "@/components/UpgradeSheet";
import { limitReachedMessage, type FeatureQuota } from "@/lib/freePlan";
import { openJekoPro } from "@/lib/jeko";

const quotaGratuit: FeatureQuota = { allowed: false, unlimited: false, plan: "free", used: 5, limit: 5, resetsAt: null };

function ouvrirFenetre() {
  render(<UpgradeSheet open onOpenChange={() => {}} title="Limite atteinte" description="" />);
}

describe("Achats dans l'app installée (Android / iOS)", () => {
  beforeEach(() => {
    native.value = true;
    Object.assign(window, { __jekoCheckoutMounted: true });
  });

  it("la fenêtre de limite n'affiche ni prix ni bouton de paiement", () => {
    ouvrirFenetre();
    expect(screen.queryByText(/Passer à/)).toBeNull();
    expect(screen.queryByText(/\/ mois/)).toBeNull();
  });

  it("le message de limite n'invite pas à s'abonner", () => {
    const msg = limitReachedMessage("scan", quotaGratuit);
    expect(msg.description).not.toMatch(/passe/i);
  });

  it("le paiement Jèko ne s'ouvre jamais", () => {
    const ecoute = vi.fn();
    window.addEventListener("jeko:open-checkout", ecoute);
    openJekoPro();
    window.removeEventListener("jeko:open-checkout", ecoute);
    expect(ecoute).not.toHaveBeenCalled();
  });
});

describe("Achats sur le web", () => {
  beforeEach(() => {
    native.value = false;
    Object.assign(window, { __jekoCheckoutMounted: true });
  });

  it("la fenêtre de limite affiche le prix et le bouton", () => {
    ouvrirFenetre();
    expect(screen.getByText(/Passer à Pro/)).toBeTruthy();
    expect(screen.getByText(/\/ mois/)).toBeTruthy();
  });

  it("le message de limite propose le Pro", () => {
    expect(limitReachedMessage("scan", quotaGratuit).description).toMatch(/passe au Pro/);
  });

  it("le paiement Jèko s'ouvre", () => {
    const ecoute = vi.fn();
    window.addEventListener("jeko:open-checkout", ecoute);
    openJekoPro();
    window.removeEventListener("jeko:open-checkout", ecoute);
    expect(ecoute).toHaveBeenCalledOnce();
  });
});
