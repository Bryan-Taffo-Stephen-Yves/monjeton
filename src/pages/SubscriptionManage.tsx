import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CreditCard,
  Sparkles,
  Crown,
  RefreshCw,
  ArrowUpRight,
  HelpCircle,
  Check,
  X,
  CalendarClock,
  Gauge,
  Camera,
  MessageCircle,
  ArrowLeft,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { openJekoPro, openJekoMax } from "@/lib/jeko";
import { fetchMonthlyUsage, type FeatureQuota } from "@/lib/freePlan";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { isIOSNative } from "@/lib/platform";

type PlanName = "Gratuit" | "Pro" | "Ultra Pro";

type Subscription = {
  status: string;
  plan_name: string | null;
  price_xof: number | null;
  updated_at: string;
  created_at: string;
  expires_at: string | null;
};

type JekoPayment = {
  id: string;
  amount: number | null;
  plan_name: string | null;
  phone: string | null;
  created_at: string;
};

// Repli si la base ne répond pas : free_limit('chat') en base.
const FREE_CHAT_LIMIT = 10;

const PLAN_SCAN_LIMITS: Record<PlanName, number> = {
  Gratuit: 5,
  Pro: 50,
  "Ultra Pro": Infinity,
};

const PLAN_FEATURES: Record<PlanName, string[]> = {
  Gratuit: [
    "Transactions illimitées",
    "5 scans OCR par mois",
    "Assistant IA (limité)",
  ],
  Pro: [
    "Transactions illimitées",
    "Scan IA (50 / mois)",
    "Assistant IA financier",
    "Rapports & exports PDF",
  ],
  "Ultra Pro": [
    "Tout ce qui est dans Pro",
    "Scan IA illimité",
    "Support prioritaire",
    "Nouvelles features en avant-première",
  ],
};

const COMPARE_ROWS: { label: string; values: [string, string, string] }[] = [
  { label: "Transactions", values: ["Illimité", "Illimité", "Illimité"] },
  { label: "Scans OCR / mois", values: ["5", "50", "Illimité"] },
  { label: "Assistant IA", values: ["Limité", "✓", "✓"] },
  { label: "Rapports PDF", values: ["—", "✓", "✓"] },
  { label: "Support prioritaire", values: ["—", "—", "✓"] },
  { label: "Avant-premières", values: ["—", "—", "✓"] },
];

const fmtXof = (n: number | null | undefined) =>
  `${Math.round(Number(n ?? 0)).toLocaleString("fr-FR")} F`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const maskPhone = (p?: string | null) => {
  if (!p) return "—";
  const digits = String(p).replace(/[^0-9]/g, "");
  if (digits.length < 4) return "****";
  return `**** ${digits.slice(-4)}`;
};

const nextRenewal = (iso: string) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + 30);
  return d;
};

const startOfMonthISO = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
};

const UsageBar = ({
  icon: Icon,
  label,
  current,
  limit,
}: {
  icon: typeof Camera;
  label: string;
  current: number;
  limit: number;
}) => {
  const unlimited = !isFinite(limit);
  const pct = unlimited ? 0 : Math.min(100, Math.round((current / Math.max(limit, 1)) * 100));
  const color =
    pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-orange-500" : "bg-primary";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-foreground">
          <Icon className="w-4 h-4 text-muted-foreground" />
          {label}
        </span>
        <span className="font-semibold text-foreground tabular-nums">
          {current} {unlimited ? "" : `/ ${limit}`}
          {unlimited && <span className="text-muted-foreground ml-1">· illimité</span>}
        </span>
      </div>
      {!unlimited && (
        <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${color}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
};

const SubscriptionManage = () => {
  useDocumentMeta({
    title: "Mon abonnement — Mon Jeton",
    description:
      "Gère ton abonnement Mon Jeton : plan actuel, usage du mois, renouvellement et historique des paiements Jèko.",
    path: "/settings/subscription",
    noIndex: true,
  });

  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<JekoPayment[]>([]);
  const [scansThisMonth, setScansThisMonth] = useState(0);
  const [aiMsgsThisMonth, setAiMsgsThisMonth] = useState(0);
  const [showCompare, setShowCompare] = useState(false);
  const [usage, setUsage] = useState<Record<string, FeatureQuota> | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchMonthlyUsage(user.id).then(setUsage).catch(() => setUsage(null));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const monthStart = startOfMonthISO();
    (async () => {
      const [subRes, payRes, scansRes, msgsRes] = await Promise.allSettled([
        supabase
          .from("subscriptions")
          .select("status, plan_name, price_xof, updated_at, created_at, expires_at")
          .eq("user_id", user.id)
          .eq("status", "active")
          .maybeSingle(),
        supabase
          .from("jeko_payments")
          .select("id, amount, plan_name, phone, created_at")
          .eq("matched_user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("receipt_scans")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", monthStart),
        supabase
          .from("assistant_messages")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("message_role", "user")
          .gte("created_at", monthStart),
      ]);
      if (cancelled) return;
      setSub(subRes.status === "fulfilled" ? ((subRes.value.data as Subscription | null) ?? null) : null);
      setPayments(payRes.status === "fulfilled" ? ((payRes.value.data as JekoPayment[] | null) ?? []) : []);
      setScansThisMonth(scansRes.status === "fulfilled" ? (scansRes.value.count ?? 0) : 0);
      setAiMsgsThisMonth(msgsRes.status === "fulfilled" ? (msgsRes.value.count ?? 0) : 0);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isActive = sub?.status === "active";
  const plan: PlanName = (sub?.plan_name as PlanName) || "Gratuit";
  const isUltra = plan === "Ultra Pro";
  const isPro = plan === "Pro";
  const isFree = !isActive;
  const scanLimit = PLAN_SCAN_LIMITS[plan];
  // La vraie échéance ; updated_at bouge à chaque rappel et ne convient pas.
  const renewalDate = sub?.expires_at
    ? new Date(sub.expires_at)
    : sub?.updated_at
      ? nextRenewal(sub.updated_at)
      : null;

  // Plan gratuit : compteurs et limites de la base (même source que le Scan
  // et l'Assistant), sinon repli sur un comptage des lignes.
  const freeScan = isFree ? usage?.scan : undefined;
  const freeChat = isFree ? usage?.chat : undefined;
  const scanUsed = freeScan ? freeScan.used : scansThisMonth;
  const scanShownLimit = freeScan ? (freeScan.limit ?? Infinity) : scanLimit;
  const chatUsed = freeChat ? freeChat.used : aiMsgsThisMonth;
  const chatLimit = isFree ? (freeChat?.limit ?? FREE_CHAT_LIMIT) : Infinity;
  const iosHide = isIOSNative();
  const lastPayment = payments[0];

  const planBadge = () => {
    if (isFree)
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-secondary text-muted-foreground border border-border">
          GRATUIT
        </span>
      );
    if (isUltra)
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-foreground text-background">
          <Crown className="w-3 h-3" /> ULTRA PRO
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold gradient-primary text-primary-foreground">
        <Sparkles className="w-3 h-3" /> PRO
      </span>
    );
  };

  return (
    <DashboardLayout
      title="Mon abonnement"
      showBack={false}
      headerLeft={
        <button
          type="button"
          onClick={() => navigate("/settings")}
          className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 hover:bg-secondary/80 transition-colors"
          aria-label="Retour à Plus"
        >
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
      }
    >
      <div className="max-w-2xl mx-auto space-y-5">
        {loading ? (
          <>
            <Skeleton className="h-56 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </>
        ) : (
          <>
            {/* HERO Plan actuel */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`glass-card rounded-2xl p-6 space-y-5 ${
                isActive && !isUltra ? "neon-glow border border-primary/40" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {planBadge()}
                    {isActive && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">
                        Actif
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">
                      {isFree ? "Plan Gratuit" : plan}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isFree
                        ? "Tu utilises Mon Jeton en mode découverte."
                        : `Activé le ${fmtDate(sub!.updated_at)}`}
                    </p>
                  </div>
                </div>
                {!iosHide && (
                  <div className="text-right">
                    <div className="text-2xl font-black text-foreground">
                      {isFree ? "0 F" : fmtXof(sub!.price_xof)}
                    </div>
                    <div className="text-xs text-muted-foreground">/ mois</div>
                  </div>
                )}
              </div>

              <ul className="space-y-2 text-sm text-foreground">
                {PLAN_FEATURES[plan].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {!iosHide && (
                <div className="space-y-2 pt-1">
                  {isFree && (
                    <>
                      <Button onClick={openJekoPro} variant="hero" size="lg" className="w-full">
                        <Sparkles className="w-4 h-4 mr-2" /> Passer à Pro
                      </Button>
                      <Button
                        onClick={openJekoMax}
                        size="lg"
                        className="w-full bg-foreground text-background hover:bg-foreground/90"
                      >
                        <Crown className="w-4 h-4 mr-2" /> Passer à Ultra Pro
                      </Button>
                    </>
                  )}

                  {isActive && (
                    <>
                      <Button
                        onClick={() => (isUltra ? openJekoMax() : openJekoPro())}
                        variant="hero"
                        size="lg"
                        className="w-full"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Renouveler ({fmtXof(sub!.price_xof)})
                      </Button>

                      {isPro && (
                        <>
                          <Button
                            onClick={openJekoMax}
                            size="lg"
                            className="w-full bg-foreground text-background hover:bg-foreground/90"
                          >
                            <ArrowUpRight className="w-4 h-4 mr-2" />
                            Passer à Ultra Pro
                          </Button>
                          <p className="text-xs text-muted-foreground text-center pt-1">
                            Ton cycle redémarre pour 30 jours en Ultra Pro.
                          </p>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </motion.div>

            {/* Renouvellement (si actif) */}
            {isActive && renewalDate && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="glass-card rounded-2xl p-5 flex items-center gap-4"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <CalendarClock className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">
                    Prochaine échéance estimée
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(renewalDate.toISOString())} · renouvelle avant pour ne pas perdre l'accès {plan}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Usage du mois */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card rounded-2xl p-5 space-y-4"
            >
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Usage ce mois-ci</h3>
              </div>
              <UsageBar
                icon={Camera}
                label="Scans OCR"
                current={scanUsed}
                limit={scanShownLimit}
              />
              <UsageBar
                icon={MessageCircle}
                label="Messages Assistant IA"
                current={chatUsed}
                limit={chatLimit}
              />
              {isFree && scanUsed >= scanShownLimit && !iosHide && (
                <div className="text-xs text-destructive bg-destructive/10 rounded-lg p-3 border border-destructive/30">
                  Tu as atteint la limite de scans gratuits ce mois. Passe à Pro pour continuer.
                </div>
              )}
              {isFree && scanUsed >= scanShownLimit && iosHide && (
                <div className="text-xs text-destructive bg-destructive/10 rounded-lg p-3 border border-destructive/30">
                  Tu as atteint la limite de scans gratuits ce mois.
                </div>
              )}
            </motion.div>

            {/* Comparatif */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-card rounded-2xl overflow-hidden"
            >
              <button
                onClick={() => setShowCompare((s) => !s)}
                className="w-full p-5 flex items-center justify-between text-left"
              >
                <span className="text-sm font-bold text-foreground">
                  Comparer les plans
                </span>
                <span className="text-xs text-primary font-semibold">
                  {showCompare ? "Masquer" : "Afficher"}
                </span>
              </button>
              {showCompare && (
                <div className="px-5 pb-5">
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div />
                    {(["Gratuit", "Pro", "Ultra Pro"] as PlanName[]).map((p) => (
                      <div
                        key={p}
                        className={`text-center font-bold py-2 rounded-lg ${
                          p === plan
                            ? "bg-primary/15 text-primary border border-primary/40"
                            : "text-muted-foreground"
                        }`}
                      >
                        {p}
                      </div>
                    ))}
                    {COMPARE_ROWS.flatMap((row) => [
                      <div
                        key={`${row.label}-l`}
                        className="text-muted-foreground py-2 border-t border-border/60"
                      >
                        {row.label}
                      </div>,
                      ...row.values.map((v, i) => (
                        <div
                          key={`${row.label}-${i}`}
                          className={`text-center py-2 border-t border-border/60 ${
                            ["Gratuit", "Pro", "Ultra Pro"][i] === plan
                              ? "text-foreground font-semibold"
                              : "text-foreground/80"
                          }`}
                        >
                          {v === "—" ? (
                            <X className="w-3.5 h-3.5 inline text-muted-foreground" />
                          ) : v === "✓" ? (
                            <Check className="w-3.5 h-3.5 inline text-primary" />
                          ) : (
                            v
                          )}
                        </div>
                      )),
                    ])}
                  </div>

                  {!isUltra && !iosHide && (
                    <div className="mt-4 flex gap-2">
                      {isFree && (
                        <Button onClick={openJekoPro} variant="hero" size="sm" className="flex-1">
                          Passer à Pro
                        </Button>
                      )}
                      <Button
                        onClick={openJekoMax}
                        size="sm"
                        className="flex-1 bg-foreground text-background hover:bg-foreground/90"
                      >
                        Passer à Ultra Pro
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>

            {/* Historique paiements */}
            {!iosHide && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">Historique des paiements</h3>
                  <span className="text-xs text-muted-foreground">{payments.length}</span>
                </div>

                {payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucun paiement enregistré pour le moment.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {payments.map((p) => (
                      <li key={p.id} className="py-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                          <CreditCard className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {p.plan_name ?? "Paiement"}
                            </p>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-semibold">
                              Reçu
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {fmtDate(p.created_at)} · {maskPhone(p.phone)}
                          </p>
                        </div>
                        <div className="text-sm font-bold text-foreground flex-shrink-0">
                          {fmtXof(p.amount)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}

            {/* Support */}
            {!iosHide && (
              <a
                href="mailto:support@monjeton.app?subject=Probl%C3%A8me%20de%20paiement%20J%C3%A8ko"
                className="flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors py-2"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Un problème de paiement ? Contacter le support
              </a>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SubscriptionManage;
