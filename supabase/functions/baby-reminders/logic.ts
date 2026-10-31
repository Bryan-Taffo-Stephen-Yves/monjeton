// Logique pure de baby-reminders (aucune dépendance Deno / Supabase) :
// calcul des jours sans repas et choix du message « j'ai faim ».
// Testée par logic.test.ts (deno test).
//
// Règle : jours entiers UTC entre aujourd'hui et last_fed_at
// (last_fed_at = greatest(born_at, dernière transaction créée, même supprimée
// depuis : journal baby_feed_days), voir get_baby_status()).
//
//   J0-J1 : rien (le bébé a mangé récemment)
//   J2    : petit creux
//   J3-J4 : a faim, biberon vide
//   J5-J6 : pleure un peu
//   J7    : s'est endormi en t'attendant
//   J8+   : silence jusqu'au prochain repas (on ne harcèle pas)
//
// Ton : jamais malade, jamais maigre, jamais de grosses larmes.

export type BabyVariant = "boy" | "girl";

export type HungerStage = "petit_creux" | "faim" | "pleure" | "endormi";

export const MIN_REMINDER_DAYS = 2;
export const MAX_REMINDER_DAYS = 7;

const DAY_MS = 86_400_000;
const MAX_NAME_LENGTH = 24;
const FALLBACK_NAME = "Bébé Jeton";

/** Numéro du jour calendaire UTC (0 = 1970-01-01). */
export function utcDayNumber(d: Date): number {
  return Math.floor(d.getTime() / DAY_MS);
}

/**
 * Jours entiers UTC écoulés entre `lastFedAt` et `now` (jamais négatif).
 * Renvoie null si la date est illisible.
 */
export function daysSinceFedUtc(
  lastFedAt: string | Date | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!lastFedAt) return null;
  const last = lastFedAt instanceof Date ? lastFedAt : new Date(lastFedAt);
  if (Number.isNaN(last.getTime()) || Number.isNaN(now.getTime())) return null;
  return Math.max(0, utcDayNumber(now) - utcDayNumber(last));
}

/** Étape de faim pour un nombre de jours, ou null si aucun rappel ce jour-là. */
export function hungerStage(days: number | null): HungerStage | null {
  if (days === null || !Number.isInteger(days)) return null;
  if (days < MIN_REMINDER_DAYS || days > MAX_REMINDER_DAYS) return null;
  if (days === 2) return "petit_creux";
  if (days <= 4) return "faim";
  if (days <= 6) return "pleure";
  return "endormi";
}

export function normalizeVariant(v: string | null | undefined): BabyVariant {
  return v === "girl" ? "girl" : "boy";
}

/** Nom affichable : espaces retirés, 24 caractères max, repli si vide. */
export function displayName(name: string | null | undefined): string {
  const clean = (name || "").replace(/\s+/g, " ").trim();
  if (!clean) return FALLBACK_NAME;
  return Array.from(clean).slice(0, MAX_NAME_LENGTH).join("");
}

/**
 * Titre + texte de la notification pour un nombre de jours sans repas,
 * ou null si on ne doit rien envoyer.
 */
export function buildHungerMessage(
  rawName: string | null | undefined,
  rawVariant: string | null | undefined,
  days: number | null,
): { stage: HungerStage; title: string; body: string } | null {
  const stage = hungerStage(days);
  if (!stage) return null;

  const name = displayName(rawName);
  const girl = normalizeVariant(rawVariant) === "girl";
  const le = girl ? "la" : "le";
  const il = girl ? "elle" : "il";
  const Il = girl ? "Elle" : "Il";
  const endormi = girl ? "endormie" : "endormi";
  const content = girl ? "contente" : "content";

  switch (stage) {
    case "petit_creux":
      return {
        stage,
        title: `🍼 ${name} a un petit creux`,
        body: `${name} a un petit creux 🍼 Note une dépense pour ${le} nourrir.`,
      };
    case "faim":
      return {
        stage,
        title: `🍼 ${name} a faim`,
        body: `${name} a faim… son biberon est vide 🍼`,
      };
    case "pleure":
      return {
        stage,
        title: `🥺 ${name} t'attend`,
        body: `${name} pleure un peu, ${il} t'attend 🥺`,
      };
    case "endormi":
      return {
        stage,
        title: `💤 ${name} s'est ${endormi}`,
        body: `${name} s'est ${endormi} en t'attendant. ${Il} sera tellement ${content} de te revoir 💚`,
      };
  }
}
