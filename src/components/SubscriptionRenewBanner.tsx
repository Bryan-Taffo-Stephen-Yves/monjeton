import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { openJekoPro, openJekoMax } from "@/lib/jeko";
import { isStoreApp } from "@/lib/platform";

interface SubInfo {
  status: string;
  plan_name: string | null;
  expires_at: string | null;
  grace_until: string | null;
}

const SubscriptionRenewBanner = () => {
  const { user } = useAuth();
  const [sub, setSub] = useState<SubInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("subscriptions")
      .select("status, plan_name, expires_at, grace_until")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setSub(data as SubInfo | null));
  }, [user]);

  if (isStoreApp()) return null;
  if (!sub || dismissed) return null;
  if (sub.status !== "active") return null;
  if (!sub.expires_at) return null;

  const now = Date.now();
  const expiresAt = new Date(sub.expires_at).getTime();
  const graceUntil = sub.grace_until ? new Date(sub.grace_until).getTime() : expiresAt + 3 * 86400000;
  const msLeft = expiresAt - now;
  const daysLeft = Math.ceil(msLeft / 86400000);
  const inGrace = now > expiresAt && now <= graceUntil;

  if (!inGrace && daysLeft > 7) return null;

  const plan = sub.plan_name || "Pro";
  const isUltra = plan.toLowerCase().includes("ultra");
  const renew = () => (isUltra ? openJekoMax() : openJekoPro());

  const message = inGrace
    ? `Période de grâce : ton plan ${plan} a expiré. Renouvelle pour éviter la coupure.`
    : daysLeft <= 0
    ? `Ton plan ${plan} expire aujourd'hui — renouvelle maintenant.`
    : `Ton accès ${plan} expire dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""} — Renouveler maintenant`;

  const urgent = inGrace || daysLeft <= 1;
  const style = urgent
    ? "bg-destructive/15 border-destructive/40 text-destructive"
    : "bg-primary/10 border-primary/30 text-primary";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className={`rounded-xl border p-3 mb-3 ${style}`}
      >
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="text-sm font-medium flex-1 min-w-0">{message}</p>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={renew}
              className="text-xs font-semibold flex items-center gap-1 hover:underline"
            >
              Renouveler <ArrowRight className="w-3 h-3" />
            </button>
            <button onClick={() => setDismissed(true)} className="p-1 opacity-60 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SubscriptionRenewBanner;
