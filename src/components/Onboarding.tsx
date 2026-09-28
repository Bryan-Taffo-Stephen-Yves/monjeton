import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, ArrowRight, Check, SkipForward, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useCountry } from "@/contexts/CountryContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Screen } from "@/components/layout/Screen";
import logoMonjeton from "@/assets/logo-monjeton.webp";
import WalletIcon from "@/components/WalletIcon";
import {
  PRIMARY_CURRENCIES,
  EXTRA_CURRENCIES,
  ALL_CURRENCIES,
  currencyForCountry,
  type CurrencyCode,
} from "@/lib/currency";
import { setActiveCurrency } from "@/lib/currencyStore";

const WALLET_OPTIONS = [
  { name: "Wave" },
  { name: "Orange Money" },
  { name: "MTN Mobile Money" },
  { name: "Moov Money" },
  { name: "Carte bancaire" },
  { name: "Cash" },
];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
};

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding = ({ onComplete }: OnboardingProps) => {
  const { user, profile } = useAuth();
  const { country } = useCountry();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  // Wallet state
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState("");
  const [creatingWallet, setCreatingWallet] = useState(false);
  const [createdWalletId, setCreatedWalletId] = useState<string | null>(null);

  // Currency state — pre-selected from detected country
  const [currency, setCurrency] = useState<CurrencyCode>(() => currencyForCountry(country?.code));
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [showMoreCurrencies, setShowMoreCurrencies] = useState(false);

  // Re-sync if country detection finishes after mount
  useEffect(() => {
    if (country?.code) setCurrency((prev) => prev || currencyForCountry(country.code));
  }, [country?.code]);

  // Demo state
  const [demoAmount, setDemoAmount] = useState("1000");
  const [demoNote, setDemoNote] = useState("Transport");
  const [creatingTx, setCreatingTx] = useState(false);

  const handleSaveCurrency = async () => {
    if (!user) return;
    setSavingCurrency(true);
    try {
      await supabase
        .from("profiles")
        .update({ currency_preference: currency } as any)
        .eq("user_id", user.id);
      setActiveCurrency(currency);
      goNext();
    } catch {
      toast({ title: "Erreur", description: "Impossible d'enregistrer la devise", variant: "destructive" });
    } finally {
      setSavingCurrency(false);
    }
  };

  const firstName = profile?.full_name?.split(" ")[0] || "ami";

  const goNext = () => {
    setDirection(1);
    setStep((s) => s + 1);
  };

  const handleCreateWallet = async () => {
    if (!selectedWallet || !user) return;
    setCreatingWallet(true);
    try {
      const { data, error } = await supabase.from("wallets").insert({
        user_id: user.id,
        wallet_name: selectedWallet,
        initial_balance: Number(walletBalance) || 0,
      }).select("id").single();

      if (error) throw error;
      setCreatedWalletId(data.id);
      toast({ title: `${selectedWallet} créé ✅` });
      goNext();
    } catch {
      toast({ title: "Erreur", description: "Impossible de créer le portefeuille", variant: "destructive" });
    } finally {
      setCreatingWallet(false);
    }
  };

  const handleCreateDemoTx = async () => {
    if (!user) return;
    setCreatingTx(true);
    try {
      // Find expense category "Transport"
      const { data: cats } = await supabase
        .from("categories")
        .select("id")
        .eq("user_id", user.id)
        .eq("type", "expense")
        .eq("name", "Transport")
        .maybeSingle();

      await supabase.from("transactions").insert({
        user_id: user.id,
        type: "expense",
        amount: Number(demoAmount) || 1000,
        note: demoNote,
        date: new Date().toISOString().split("T")[0],
        category_id: cats?.id || null,
        wallet_id: createdWalletId,
        source: "onboarding",
      });

      toast({ title: "Transaction enregistrée ✅" });
      onComplete();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setCreatingTx(false);
    }
  };

  const renderStickyAction = () => {
    if (step === 0) {
      return (
        <Button variant="hero" size="lg" onClick={goNext} className="w-full gap-2">
          Commencer <ArrowRight className="w-4 h-4" />
        </Button>
      );
    }
    if (step === 1) {
      return (
        <Button
          variant="hero"
          size="lg"
          className="w-full gap-2"
          disabled={savingCurrency}
          onClick={handleSaveCurrency}
        >
          {savingCurrency ? "Enregistrement..." : "Continuer"}
          <ArrowRight className="w-4 h-4" />
        </Button>
      );
    }
    if (step === 2) {
      return (
        <Button
          variant="hero"
          size="lg"
          className="w-full gap-2"
          disabled={!selectedWallet || creatingWallet}
          onClick={handleCreateWallet}
        >
          {creatingWallet ? "Création..." : "Continuer"}
          <ArrowRight className="w-4 h-4" />
        </Button>
      );
    }
    return (
      <div className="space-y-2">
        <Button
          variant="hero"
          size="lg"
          className="w-full gap-2"
          disabled={creatingTx}
          onClick={handleCreateDemoTx}
        >
          {creatingTx ? "Enregistrement..." : "Enregistrer et accéder au dashboard"}
          <Check className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="lg"
          className="w-full gap-2 text-muted-foreground"
          onClick={onComplete}
        >
          <SkipForward className="w-4 h-4" /> Passer
        </Button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <Screen hasBottomNav={false} className="relative z-10 h-full">
        <Screen.Header>
          <div className="px-4 pt-6">
            <div className="flex justify-center gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === step ? "w-8 bg-primary" : i < step ? "w-2 bg-primary/60" : "w-2 bg-muted"
                  }`}
                />
              ))}
            </div>
          </div>
        </Screen.Header>

        <Screen.Content className="overflow-y-auto">
          <div className="px-4 pt-8 pb-4 flex justify-center">
            <div className="relative w-full max-w-md">
              <AnimatePresence mode="wait" custom={direction}>
                {step === 0 && (
                  <motion.div
                    key="step-0"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                    className="flex flex-col items-center text-center"
                  >
                    <motion.img
                      src={logoMonjeton}
                      alt="Mon Jeton"
                      className="w-20 h-20 rounded-2xl mb-6"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                    />
                    <motion.h1
                      className="text-3xl font-bold text-foreground mb-2"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      Bienvenue {firstName} !
                    </motion.h1>
                    <motion.p
                      className="text-muted-foreground"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      Configurons ton espace en 2 minutes
                    </motion.p>
                  </motion.div>
                )}

                {step === 1 && (
                  <motion.div
                    key="step-currency"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                    className="space-y-6"
                  >
                    <div className="text-center">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                        <span className="text-xl">💱</span>
                      </div>
                      <h2 className="text-xl font-bold text-foreground">
                        Quelle est ta devise principale ?
                      </h2>
                      <p className="text-sm text-muted-foreground mt-2">
                        Détectée depuis ton pays. Tu pourras changer à tout moment.
                      </p>
                    </div>

                    <div className="space-y-2">
                      {PRIMARY_CURRENCIES.map((c) => (
                        <button
                          key={c.code}
                          onClick={() => setCurrency(c.code)}
                          className={`w-full p-4 rounded-xl text-left transition-all border flex items-center gap-3 ${
                            currency === c.code
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-secondary text-muted-foreground hover:border-primary/40"
                          }`}
                        >
                          <span className="text-2xl">{c.flag}</span>
                          <span className="font-medium flex-1">{c.label}</span>
                          {currency === c.code && <Check className="w-5 h-5 text-primary" />}
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => setShowMoreCurrencies((v) => !v)}
                        className="w-full p-3 rounded-xl text-sm text-muted-foreground border border-dashed border-border hover:border-primary/40 transition-all flex items-center justify-center gap-2"
                      >
                        Plus de devises
                        <ChevronDown className={`w-4 h-4 transition-transform ${showMoreCurrencies ? "rotate-180" : ""}`} />
                      </button>

                      {showMoreCurrencies && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          className="space-y-2 overflow-hidden"
                        >
                          {EXTRA_CURRENCIES.map((c) => (
                            <button
                              key={c.code}
                              onClick={() => setCurrency(c.code)}
                              className={`w-full p-3 rounded-xl text-left transition-all border flex items-center gap-3 ${
                                currency === c.code
                                  ? "border-primary bg-primary/10 text-foreground"
                                  : "border-border bg-secondary text-muted-foreground hover:border-primary/40"
                              }`}
                            >
                              <span className="text-xl">{c.flag}</span>
                              <span className="font-medium flex-1 text-sm">{c.label}</span>
                              {currency === c.code && <Check className="w-4 h-4 text-primary" />}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step-wallet"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                    className="space-y-6"
                  >
                    <div className="text-center">
                      <Wallet className="w-10 h-10 text-primary mx-auto mb-3" />
                      <h2 className="text-xl font-bold text-foreground">
                        Quel est ton moyen de paiement principal ?
                      </h2>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {WALLET_OPTIONS.map((w) => (
                        <button
                          key={w.name}
                          onClick={() => setSelectedWallet(w.name)}
                          className={`p-3 rounded-xl text-sm font-medium transition-all border flex items-center gap-2 ${
                            selectedWallet === w.name
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-secondary text-muted-foreground hover:border-primary/40"
                          }`}
                        >
                          <WalletIcon name={w.name} size={28} />
                          <span className="text-left">{w.name}</span>
                        </button>
                      ))}
                    </div>

                    {selectedWallet && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        className="space-y-2"
                      >
                        <label className="text-sm font-medium text-foreground">
                          Solde actuel
                        </label>
                        <Input
                          type="number"
                          placeholder="Ex: 25000"
                          value={walletBalance}
                          onChange={(e) => setWalletBalance(e.target.value)}
                          className="bg-secondary border-border text-lg font-bold h-12"
                        />
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    key="step-demo"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                    className="space-y-6"
                  >
                    <div className="text-center">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                        <span className="text-xl">🧾</span>
                      </div>
                      <h2 className="text-xl font-bold text-foreground">
                        Enregistre ta première dépense
                      </h2>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Note</label>
                        <Input
                          value={demoNote}
                          onChange={(e) => setDemoNote(e.target.value)}
                          className="bg-secondary border-border"
                          placeholder="Ex: Transport"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Montant (FCFA)</label>
                        <Input
                          type="number"
                          value={demoAmount}
                          onChange={(e) => setDemoAmount(e.target.value)}
                          className="bg-secondary border-border text-lg font-bold h-12"
                          placeholder="1000"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </Screen.Content>

        <Screen.StickyAction>{renderStickyAction()}</Screen.StickyAction>
      </Screen>
    </div>
  );
};

export default Onboarding;
