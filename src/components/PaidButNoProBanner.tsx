import { useEffect, useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isIOSNative } from "@/lib/platform";
import { checkoutStartedRecently } from "@/lib/jeko";

const DISMISS_KEY = "paid_no_pro_banner_dismissed";
const SUPPORT_EMAIL = "support@monjeton.app";

/**
 * Cas rare : l'utilisateur a payé avec une adresse e-mail différente de celle
 * de son compte, son paiement reste donc orphelin. On lui offre un contact.
 */
const PaidButNoProBanner = () => {
  const { user, profile } = useAuth();
  const [isPro, setIsPro] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === "1"
  );

  useEffect(() => {
    if (!user) return;
    supabase
      .rpc("has_active_pro", { _user_id: user.id })
      .then(({ data }) => setIsPro(data === true));
  }, [user]);

  if (isIOSNative()) return null;
  // Seulement pour qui a lancé un paiement récemment : sinon le message
  // « tu as déjà payé ? » s'affichait à tous les comptes gratuits.
  if (!checkoutStartedRecently()) return null;
  if (!user || dismissed || isPro !== false) return null;

  const subject = encodeURIComponent("Paiement Pro non activé");
  const body = encodeURIComponent(
    `Bonjour,\n\nJ'ai payé l'abonnement Pro mais mon compte est encore en gratuit.\nEmail du compte : ${profile?.email ?? ""}\nEmail utilisé au paiement : \nNuméro utilisé au paiement : \n\nMerci.`
  );

  return (
    <div className="mb-3 flex items-start gap-2.5 rounded-2xl border border-border bg-secondary/60 px-3.5 py-3">
      <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <p className="flex-1 min-w-0 text-xs text-muted-foreground">
        Tu as déjà payé mais ton plan n'est pas activé ?{" "}
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`}
          className="font-semibold text-primary underline underline-offset-2"
        >
          Contacte-nous
        </a>
        , on l'active à la main.
      </p>
      <button
        aria-label="Masquer"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, "1");
          setDismissed(true);
        }}
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default PaidButNoProBanner;
