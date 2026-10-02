import { Capacitor } from "@capacitor/core";

/**
 * Entrée de l'application mobile (App Store / Play Store).
 *
 * Dans l'application installée, « / » mène aux écrans de bienvenue puis à
 * l'inscription ou à la connexion. Dans un navigateur, « / » reste la landing
 * publique. Une fois connecté, on va directement au tableau de bord : le
 * parcours de bienvenue n'est plus jamais montré.
 *
 * INTERRUPTEUR : tant que APP_ENTRY_ENABLED vaut false, ce parcours est
 * entièrement désactivé, y compris dans l'app installée. Tout le monde suit
 * le parcours du site : landing → inscription → questionnaire → tableau de
 * bord. On le passera à true au moment de la publication sur les stores.
 *
 * Aperçu pour les développeurs : en local (npm run dev), ?app=1 affiche le
 * parcours de l'app même désactivé (?app=0 pour en sortir). Jamais en ligne.
 */

export const APP_ENTRY_ENABLED = false;

const PREVIEW_KEY = "mj_app_preview";
const WELCOME_DONE_KEY = "mj_welcome_done";

/** Adresse publique du site, pour les liens envoyés par email depuis l'app. */
export const PUBLIC_WEB_URL = "https://monjeton.lovable.app";

/** Vraie application installée (Capacitor iOS / Android). */
export const isNativeShell = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

/** Application installée (parcours activé), ou aperçu local avec ?app=1. */
export const isAppExperience = (): boolean => {
  if (APP_ENTRY_ENABLED && isNativeShell()) return true;
  // Aperçu : en ligne seulement une fois le parcours activé, toujours en local.
  if (!APP_ENTRY_ENABLED && !import.meta.env.DEV) return false;
  try {
    const flag = new URLSearchParams(window.location.search).get("app");
    if (flag === "1") localStorage.setItem(PREVIEW_KEY, "1");
    if (flag === "0") localStorage.removeItem(PREVIEW_KEY);
    return localStorage.getItem(PREVIEW_KEY) === "1";
  } catch {
    return false;
  }
};

/** Parcours terminé une fois (inscription ou connexion réussie). */
export const hasCompletedWelcome = (): boolean => {
  try {
    return localStorage.getItem(WELCOME_DONE_KEY) === "1";
  } catch {
    return false;
  }
};

export const markWelcomeCompleted = () => {
  try {
    localStorage.setItem(WELCOME_DONE_KEY, "1");
  } catch {
    /* stockage indisponible : on remontrera les slides, sans gravité */
  }
};

/**
 * Base des liens d'email (réinitialisation, confirmation). Dans l'app
 * installée, window.location.origin vaut https://localhost : le lien ne
 * mènerait nulle part, on pointe donc vers le site public.
 */
export const authLinkBase = () => (isNativeShell() ? PUBLIC_WEB_URL : window.location.origin);
