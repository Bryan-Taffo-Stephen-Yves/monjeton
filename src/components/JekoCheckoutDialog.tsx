import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { openJekoCheckout, type JekoMethod } from "@/lib/jeko";

type PlanKey = "pro" | "ultra";

const PLANS: Record<PlanKey, { name: string; price: number; label: string }> = {
  pro: { name: "Plan Pro", price: 2000, label: "2 000 F" },
  ultra: { name: "Plan Ultra Pro", price: 5000, label: "5 000 F" },
};

const METHODS: { id: JekoMethod; label: string; logo: string }[] = [
  { id: "wave", label: "Wave", logo: "/assets/pay/wave.svg" },
  { id: "orange", label: "Orange Money", logo: "/assets/pay/orange-money.svg" },
  { id: "mtn", label: "MTN MoMo", logo: "/assets/pay/mtn-momo.svg" },
  { id: "moov", label: "Moov Money", logo: "/assets/pay/moov-money.svg" },
  { id: "djamo", label: "Djamo", logo: "/assets/pay/djamo.svg" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Modale unique de paiement : le plan est choisi sur la page des tarifs,
 * tout le reste (e-mail invité, numéro Mobile Money, moyen de paiement)
 * se fait ici, sans changer de page. Montée une seule fois dans App.tsx,
 * elle répond à l'événement "jeko:open-checkout".
 */
const JekoCheckoutDialog = () => {
  const [plan, setPlan] = useState<PlanKey | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<JekoMethod | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (window as any).__jekoCheckoutMounted = true;
    const onOpen = async (e: Event) => {
      const detail = (e as CustomEvent).detail as { plan?: PlanKey };
      if (detail?.plan !== "pro" && detail?.plan !== "ultra") return;
      setPlan(detail.plan);
      setError(null);
      setMethod(null);
      setLoading(false);
      void fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jeko-create-payment`, {
        method: "OPTIONS",
      }).catch(() => undefined);
      const { data } = await supabase.auth.getSession();
      setIsLoggedIn(!!data.session);
    };
    window.addEventListener("jeko:open-checkout", onOpen);
    return () => {
      (window as any).__jekoCheckoutMounted = false;
      window.removeEventListener("jeko:open-checkout", onOpen);
    };
  }, []);

  const close = useCallback(() => {
    if (loading) return;
    setPlan(null);
    setEmail("");
    setMethod(null);
    setError(null);
  }, [loading]);

  const pay = async () => {
    if (!plan || !method) return;
    const cleanEmail = email.trim().toLowerCase();

    if (!isLoggedIn && !EMAIL_RE.test(cleanEmail)) {
      setError("Entre une adresse e-mail valide.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jeko-create-payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            plan,
            paymentMethod: method,
            ...(token ? {} : { email: cleanEmail }),
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.redirectUrl) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      setPlan(null);
      await openJekoCheckout(String(json.redirectUrl));
    } catch (e) {
      console.error("Création du paiement Jèko impossible", e);
      setError(
        "Le paiement est momentanément indisponible. Réessaie dans quelques instants — aucun montant n'a été débité."
      );
      setLoading(false);
    }
  };

  const current = plan ? PLANS[plan] : null;

  return (
    <Dialog open={plan !== null} onOpenChange={(o) => !o && close()}>
      <DialogContent
        className="max-w-sm"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {current && (
          <>
            <DialogHeader>
              <DialogTitle>{current.name} — {current.label}/mois</DialogTitle>
              <DialogDescription>
                Paiement par Mobile Money depuis la Côte d'Ivoire.
                <span className="mt-1 block">Paiement sécurisé via Jèko. Activation immédiate après le paiement.</span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {!isLoggedIn && (
                <div className="space-y-1.5">
                  <label htmlFor="jeko-email" className="text-xs font-medium text-muted-foreground">
                    Ton adresse e-mail
                  </label>
                  <Input
                    id="jeko-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="ton@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Utilise la même adresse pour créer ton compte : ton plan sera activé
                    automatiquement à l'inscription.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Moyen de paiement</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {METHODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMethod(m.id)}
                      disabled={loading}
                      aria-pressed={method === m.id}
                      className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2.5 text-sm font-medium transition ${
                        method === m.id
                          ? "border-primary bg-primary/10 text-foreground neon-glow"
                          : "border-border bg-secondary text-foreground hover:border-primary/60 hover:bg-secondary/70"
                      }`}
                    >
                      <img
                        src={m.logo}
                        alt=""
                        aria-hidden="true"
                        width={40}
                        height={40}
                        className="h-10 w-10 shrink-0 rounded-[10px]"
                      />
                      <span className="truncate">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p role="alert" className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                onClick={pay}
                variant="hero"
                size="lg"
                className="w-full"
                disabled={loading || !method}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" />
                    Redirection vers Jèko…
                  </>
                ) : `Payer ${current.label}`}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default JekoCheckoutDialog;
