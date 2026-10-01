import { Capacitor } from "@capacitor/core";

/**
 * Entrée de l'application mobile (App Store / Play Store).
 *
 * Dans l'application installée, « / » mène aux écrans de bienvenue puis à
 * l'inscription ou à la connexion. Dans un navigateur, « / » reste la landing
 * publique. Une fois connecté, on va directement au tableau de bord : le
 * parcours de bienvenue n'est plus jamais montré.
 *
 * Aperçu dans un navigateur : ajouter ?app=1 à l'adresse (?app=0 pour en
 * sortir) affiche le parcours de l'application sans téléphone.
 */

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

/** Application installée, ou aperçu forcé avec ?app=1. */
export const isAppExperience = (): boolean => {
  if (isNativeShell()) return true;
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
