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
 *
 * PWA : une fois Mon Jeton installé sur l'écran d'accueil (iPhone, Android,
 * ordinateur), « / » peut suivre aussi le parcours de l'app : bienvenue →
 * inscription ou connexion → tableau de bord. Une personne déjà connectée
 * arrive directement sur le tableau de bord. Interrupteur : PWA_APP_ENTRY_ENABLED.
 */

export const APP_ENTRY_ENABLED = false;

/**
 * Parcours de l'app pour la PWA installée sur l'écran d'accueil.
 *
 * ÉTEINT POUR L'INSTANT : dans ce parcours, /login et /signup ouvrent
 * AppAuth, qui n'a pas encore de bouton « Continuer avec Apple ». Les
 * comptes Apple ne pourraient plus se connecter dans la PWA (sur iPhone,
 * l'app de l'écran d'accueil ne partage pas la session de Safari : tout le
 * monde doit s'y reconnecter). On le passera à true dès qu'AppAuth proposera
 * Apple hors de l'app native. En attendant, la PWA garde la landing et les
 * pages web /login et /signup, comme avant.
 */
export const PWA_APP_ENTRY_ENABLED = false;

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

/**
 * PWA ouverte depuis l'écran d'accueil (fenêtre sans barre d'adresse).
 * Faux dans un onglet de navigateur et dans l'app Capacitor.
 */
export const isStandalonePwa = (): boolean => {
  if (typeof window === "undefined" || isNativeShell()) return false;
  try {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    return window.matchMedia?.("(display-mode: standalone)")?.matches === true || nav.standalone === true;
  } catch {
    return false;
  }
};

/** Application installée (parcours activé), PWA installée, ou aperçu local avec ?app=1. */
export const isAppExperience = (): boolean => {
  if (APP_ENTRY_ENABLED && isNativeShell()) return true;
  // PWA installée (l'app Capacitor reste gouvernée par APP_ENTRY_ENABLED seul).
  if (PWA_APP_ENTRY_ENABLED && isStandalonePwa()) return true;
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
