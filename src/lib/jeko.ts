import { toast } from "sonner";
import { isStoreApp } from "@/lib/platform";

export type JekoMethod = "wave" | "orange" | "mtn" | "moov" | "djamo";

/**
 * Ouvre une URL de paiement Jèko.
 * - Sur Capacitor (iOS/Android natif), utilise le Browser plugin (in-app browser).
 * - Sur le web, ouvre un nouvel onglet.
 */
export async function openJekoCheckout(url: string): Promise<void> {
  try {
    // Détection Capacitor à runtime pour ne pas casser le web
    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform?.()) {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url, presentationStyle: "popover" });
      return;
    }
  } catch (e) {
    // fallback web
    console.warn("Capacitor Browser indisponible, fallback web", e);
  }

  // Sur le web, la redirection se fait dans l'onglet courant : window.open()
  // est bloqué par les navigateurs mobiles et les iframes d'aperçu quand
  // l'appel survient après un await (le "geste utilisateur" a expiré).
  try {
    if (window.top && window.top !== window.self) {
      window.top.location.href = url;
      return;
    }
  } catch {
    /* iframe cross-origin : on redirige la fenêtre courante */
  }
  window.location.href = url;
}

const CHECKOUT_STARTED_KEY = "jeko_checkout_started_at";

/** Mémorise qu'un paiement a été lancé depuis cet appareil. */
export function markCheckoutStarted(): void {
  try {
    localStorage.setItem(CHECKOUT_STARTED_KEY, String(Date.now()));
  } catch {
    /* stockage indisponible : sans conséquence */
  }
}

/** Un paiement a-t-il été lancé depuis cet appareil ces derniers jours ? */
export function checkoutStartedRecently(days = 30): boolean {
  try {
    const at = Number(localStorage.getItem(CHECKOUT_STARTED_KEY));
    return at > 0 && Date.now() - at < days * 86400000;
  } catch {
    return false;
  }
}

type JekoPlan = "pro" | "ultra";

/**
 * Ouvre la modale de paiement (<JekoCheckoutDialog />, montée dans App.tsx).
 * Le plan est déjà choisi sur la page des tarifs — la modale recueille
 * uniquement l'e-mail (invité), le numéro Mobile Money et le moyen de
 * paiement, puis crée la demande Jèko. AUCUN repli vers un lien statique :
 * sans référence client, le paiement arriverait orphelin.
 */
function openCheckout(plan: JekoPlan): void {
  if (typeof window === "undefined") return;
  // Aucun achat dans l'app installée (voir isStoreApp), même si un bouton a été oublié.
  if (isStoreApp()) return;
  if (!(window as any).__jekoCheckoutMounted) {
    // Sécurité : la modale doit être montée, sinon on prévient au lieu de
    // perdre le paiement.
    toast.error("Le paiement est momentanément indisponible", {
      description: "Réessaie dans quelques instants. Aucun montant n'a été débité.",
    });
    return;
  }
  window.dispatchEvent(new CustomEvent("jeko:open-checkout", { detail: { plan } }));
}

export const openJekoPro = () => openCheckout("pro");
export const openJekoMax = () => openCheckout("ultra");

/** Paiement sans compte : l'e-mail est demandé dans la modale. */
export const openJekoProGuest = () => openCheckout("pro");
export const openJekoMaxGuest = () => openCheckout("ultra");
