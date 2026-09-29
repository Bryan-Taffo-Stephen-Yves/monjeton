import { Capacitor } from "@capacitor/core";

// App installée depuis l'App Store ou Google Play : on n'y propose aucun achat.
// Apple (règle 3.1.1) et Google Play (règles de paiement) imposent leur propre
// système pour vendre un abonnement dans l'app ; le paiement Jèko reste sur le web.
export const isStoreApp = () => Capacitor.isNativePlatform();
