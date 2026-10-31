import { useEffect, useMemo, useState } from "react";
import { Bell, BellOff, BellRing, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  enableDailyReminders,
  disableDailyReminders,
  isDailyReminderActive,
  pushSupported,
  sendTestPush,
} from "@/lib/pushNotifications";

interface Props {
  variant?: "card" | "row";
}

function detectPlatform(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    nav.standalone === true
  );
}

const EnableNotificationsCard = ({ variant = "card" }: Props) => {
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [supported, setSupported] = useState(true);
  const platform = useMemo(detectPlatform, []);
  const standalone = useMemo(isStandalone, []);

  useEffect(() => {
    setSupported(pushSupported());
    isDailyReminderActive().then(setActive);
  }, []);

  const installHint =
    platform === "ios"
      ? "Sur iPhone : ouvre le menu Partager de Safari → « Sur l'écran d'accueil » pour installer Mon Jeton, puis reviens ici pour activer les rappels."
      : platform === "android"
      ? "Sur Android : ouvre le menu du navigateur → « Installer l'application » ou « Ajouter à l'écran d'accueil » pour recevoir les notifications hors app."
      : "Installe Mon Jeton depuis le menu du navigateur (icône d'installation) pour recevoir les rappels hors du site.";

  if (!supported) {
    return variant === "card" ? (
      <div className="glass-card rounded-2xl p-4 border border-border/50 text-xs text-muted-foreground flex items-start gap-2">
        <Smartphone className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>{installHint}</span>
      </div>
    ) : null;
  }

  const handleEnable = async () => {
    setLoading(true);
    const res = await enableDailyReminders();
    setLoading(false);
    if (res.ok === true) {
      setActive(true);
      toast({ title: "Rappels activés ✅", description: "Tu recevras un rappel matin et soir." });
      return;
    }
    const map: Record<string, string> = {
      permission_denied: "Autorisation refusée. Active les notifications dans ton navigateur.",
      unsupported: "Ton navigateur ne supporte pas les notifications.",
      preview_disabled: "Disponible uniquement sur l'app publiée, pas dans l'aperçu.",
      not_authenticated: "Connecte-toi pour activer les rappels.",
      missing_vapid_key: "Configuration serveur incomplète.",
    };
    const err = res.error;
    toast({
      title: "Impossible d'activer",
      description: map[err] || err,
      variant: "destructive",
    });
  };

  const handleTest = async () => {
    setTesting(true);
    const res = await sendTestPush();
    setTesting(false);
    if (res.ok === true) {
      toast({
        title: "Notification envoyée",
        description: "Elle arrive dans quelques secondes. Tu peux fermer l'app pour voir.",
      });
      return;
    }
    const map: Record<string, string> = {
      no_subscription: "Ce téléphone n'est pas abonné. Désactive puis réactive les rappels.",
      missing_vapid_secret: "Configuration serveur incomplète (clé privée manquante).",
      not_authenticated: "Connecte-toi pour tester.",
    };
    toast({
      title: "Test impossible",
      description: map[res.error] || "Réessaie dans un instant.",
      variant: "destructive",
    });
  };

  const testButton = (
    <Button size="sm" variant="outline" onClick={handleTest} disabled={testing}>
      {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <BellRing className="w-3.5 h-3.5 mr-1" />}
      Tester
    </Button>
  );

  const handleDisable = async () => {
    setLoading(true);
    await disableDailyReminders();
    setLoading(false);
    setActive(false);
    toast({ title: "Rappels désactivés" });
  };

  if (variant === "row") {
    return (
      <div className="flex items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
            {active ? <Bell className="w-4 h-4 text-primary" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Rappels quotidiens</p>
            <p className="text-xs text-muted-foreground truncate">Matin et soir, si aucune dépense saisie.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {active && testButton}
          <Button
            size="sm"
            variant={active ? "outline" : "default"}
            onClick={active ? handleDisable : handleEnable}
            disabled={loading}
            className={active ? "" : "gradient-primary text-primary-foreground"}
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : active ? "Désactiver" : "Activer"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-4 mb-4 border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0 border border-primary/20">
          <Bell className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground text-sm mb-0.5">Active tes rappels quotidiens</p>
          <p className="text-xs text-muted-foreground mb-3">
            Un petit ping le matin et le soir pour ne plus oublier de noter tes dépenses.
          </p>
          <div className="flex gap-2">
            {active ? (
              <>
                {testButton}
                <Button size="sm" variant="outline" onClick={handleDisable} disabled={loading}>
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <BellOff className="w-3.5 h-3.5 mr-1" />}
                  Désactiver
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={handleEnable} disabled={loading} className="gradient-primary text-primary-foreground">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Bell className="w-3.5 h-3.5 mr-1" />}
                Activer les rappels
              </Button>
            )}
          </div>
          {!active && !standalone && (
            <p className="text-[11px] text-muted-foreground mt-3 leading-snug flex items-start gap-1.5">
              <Smartphone className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{installHint}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnableNotificationsCard;
