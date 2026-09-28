import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { openJekoPro, openJekoMax } from "@/lib/jeko";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import logoImg from "@/assets/logo-monjeton.webp";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { isIOSNative } from "@/lib/platform";

const proFeatures = [
  "Transactions illimitées",
  "Scan IA des reçus (50 / mois)",
  "Multi-portefeuilles (Orange, MTN, Wave...)",
  "Rapports mensuels et annuels",
  "Export PDF",
  "Assistant IA financier",
  "Budgets & alertes",
  "Tontines & dettes",
];

const maxFeatures = [
  "Tout le plan Pro",
  "Scan IA illimité",
  "Support prioritaire",
  "Accès en avant-première aux nouvelles features",
];

const Pricing = () => {
  useDocumentMeta({
    title: "Tarifs Mon Jeton — Plans Gratuit, Pro et Ultra Pro",
    description: "Comparez les plans Mon Jeton. Gratuit pour démarrer, Pro à 2 000 F CFA et Ultra Pro à 5 000 F CFA / mois. Paiement Mobile Money.",
    path: "/pricing",
  });
  const { user } = useAuth();
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    supabase
      .rpc("has_active_pro", { _user_id: user.id })
      .then(async ({ data: active }) => {
        if (active !== true) {
          setCurrentPlan(null);
          return;
        }
        const { data } = await supabase
          .from("subscriptions")
          .select("plan_name")
          .eq("user_id", user.id)
          .eq("status", "active")
          .maybeSingle();
        setCurrentPlan(data?.plan_name ?? null);
      });
  }, [user]);
  const isPro = currentPlan === "Pro";
  const isUltra = currentPlan === "Ultra Pro";

  // Jèko renvoie ici (errorUrl) quand le paiement échoue ou est annulé.
  const [searchParams, setSearchParams] = useSearchParams();
  const [paymentFailed, setPaymentFailed] = useState(false);
  useEffect(() => {
    if (searchParams.get("payment") !== "error") return;
    setPaymentFailed(true);
    const next = new URLSearchParams(searchParams);
    next.delete("payment");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  if (isIOSNative()) {
    return (
      <div className="min-h-screen gradient-bg flex flex-col">
        <header className="flex items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoImg} alt="Mon Jeton" className="h-9 w-auto rounded-lg" />
            <span className="text-xl font-bold text-gradient">Mon Jeton</span>
          </Link>
        </header>
        <main className="flex-1 flex items-center justify-center px-5 py-12">
          <div className="w-full max-w-md text-center space-y-5">
            <h1 className="text-3xl font-bold text-foreground">Mon Jeton Pro</h1>
            <p className="text-muted-foreground">
              Avec Mon Jeton Pro, profite du scan illimité de tes reçus, de la saisie vocale de tes
              dépenses, d'objectifs d'épargne illimités et de rapports détaillés pour mieux
              comprendre ton argent.
            </p>
            <p className="text-sm text-muted-foreground">
              Votre abonnement se gère depuis votre compte.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg flex flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoImg} alt="Mon Jeton" className="h-9 w-auto rounded-lg" />
          <span className="text-xl font-bold text-gradient">Mon Jeton</span>
        </Link>
        <Link to="/login">
          <Button variant="ghost" size="sm">Connexion</Button>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-5 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-4xl"
        >
          {paymentFailed && (
            <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">Le paiement n'a pas abouti</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tu peux réessayer ci-dessous, avec le même moyen de paiement ou un autre. Si ton compte a quand même été débité, ton plan s'activera tout seul d'ici quelques minutes.
                </p>
              </div>
              <button type="button" aria-label="Fermer" onClick={() => setPaymentFailed(false)} className="shrink-0 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Choisis ton plan</h1>
            <p className="text-muted-foreground">Paiement sécurisé via Jèko · Annule quand tu veux</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Pro */}
            <div className="glass-card rounded-2xl p-6 neon-glow border border-primary/40">
              <div className="text-center mb-6">
                <span className="inline-block px-3 py-1 rounded-full gradient-primary text-primary-foreground text-xs font-bold mb-4">⭐ PRO</span>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-black text-foreground">2 000</span>
                  <span className="text-lg text-muted-foreground">F CFA</span>
                </div>
                <p className="text-muted-foreground text-sm">/ mois</p>
              </div>
              <ul className="space-y-3 mb-8">
                {proFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-foreground">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <Button onClick={openJekoPro} variant="hero" size="lg" className="w-full" disabled={isPro || isUltra}>
                {isPro ? "Plan actuel" : isUltra ? "Inclus dans Ultra Pro" : "Payer 2 000 F via Jèko"}
              </Button>
            </div>

            {/* Ultra Pro */}
            <div className="glass-card rounded-2xl p-6">
              <div className="text-center mb-6">
                <span className="inline-block px-3 py-1 rounded-full bg-foreground text-background text-xs font-bold mb-4">💎 ULTRA PRO</span>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-black text-foreground">5 000</span>
                  <span className="text-lg text-muted-foreground">F CFA</span>
                </div>
                <p className="text-muted-foreground text-sm">/ mois</p>
              </div>
              <ul className="space-y-3 mb-8">
                {maxFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-foreground">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <Button onClick={openJekoMax} size="lg" className="w-full gradient-primary text-primary-foreground" disabled={isUltra}>
                {isUltra ? "Plan actuel" : isPro ? "Passer à Ultra Pro" : "Payer 5 000 F via Jèko"}
              </Button>
              {isPro && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Ton cycle redémarre pour 30 jours en Ultra Pro.
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Pricing;
