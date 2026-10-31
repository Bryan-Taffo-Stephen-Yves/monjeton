/**
 * Bébé Jeton — logique pure (aucun accès réseau, aucun React).
 *
 * L'utilisateur nourrit son bébé en notant ses transactions :
 *   • la faim dépend du nombre de jours calendaires depuis le dernier repas
 *     (dernière transaction, ou naissance du bébé) ;
 *   • l'âge dépend du nombre de jours distincts où il a été nourri.
 *
 * Règles de ton : le bébé n'est jamais malade, jamais maigre, ne pleure
 * jamais fort. Au pire : biberon vide, ventre qui gargouille, petites larmes.
 * Il ne rapetisse jamais.
 */

export type BabyVariant = "boy" | "girl";
export type BabyAge = "newborn" | "baby" | "toddler" | "kid";
export type BabyMood = "happy" | "peckish" | "hungry" | "starving";

/** État du bébé tel que l'application le manipule. */
export interface BabyStatus {
  name: string;
  variant: BabyVariant;
  /** ISO 8601 */
  bornAt: string;
  notificationsEnabled: boolean;
  /** Jours distincts où l'utilisateur a noté au moins une transaction. */
  fedDays: number;
  /** ISO 8601 : dernière transaction, ou naissance si aucune depuis. */
  lastFedAt: string;
}

/** Ligne renvoyée par la RPC public.get_baby_status(). */
export interface BabyStatusRow {
  name: string;
  variant: string;
  born_at: string;
  notifications_enabled: boolean;
  fed_days: number;
  last_fed_at: string;
}

export const BABY_VARIANTS: readonly BabyVariant[] = ["girl", "boy"];
export const BABY_AGES: readonly BabyAge[] = ["newborn", "baby", "toddler", "kid"];
export const BABY_MOODS: readonly BabyMood[] = ["happy", "peckish", "hungry", "starving"];

export const BABY_NAME_MAX_LENGTH = 24;
export const BABY_NAME_SUGGESTIONS = ["Kofi", "Awa", "Ama", "Yao"] as const;

// ─── React Query ──────────────────────────────────────────────

/** Racine commune : invalider cette clé rafraîchit le bébé de tout le monde. */
export const BABY_STATUS_QUERY_ROOT = ["baby-status"] as const;

/** Clé stable de la requête get_baby_status, une par utilisateur. */
export const babyStatusQueryKey = (userId: string | null | undefined) =>
  [...BABY_STATUS_QUERY_ROOT, userId ?? "anonymous"] as const;

/** Une minute : évite de rappeler la RPC à chaque focus ou montage. */
export const BABY_STATUS_STALE_TIME = 60_000;

// ─── Conversion ───────────────────────────────────────────────

export const normalizeVariant = (value: string | null | undefined): BabyVariant =>
  value === "girl" ? "girl" : "boy";

export function toBabyStatus(row: BabyStatusRow): BabyStatus {
  const fed = Number(row.fed_days);
  return {
    name: (row.name ?? "").trim(),
    variant: normalizeVariant(row.variant),
    bornAt: row.born_at,
    notificationsEnabled: row.notifications_enabled !== false,
    fedDays: Number.isFinite(fed) && fed > 0 ? Math.floor(fed) : 0,
    lastFedAt: row.last_fed_at || row.born_at,
  };
}

/**
 * La croissance ne recule jamais : si des transactions sont supprimées,
 * on garde le plus grand nombre de jours nourris déjà constaté.
 */
export function withGrowthFloor(status: BabyStatus, storedMax: number | null | undefined): BabyStatus {
  const floor = Number.isFinite(storedMax) ? Math.max(0, Math.floor(storedMax as number)) : 0;
  return floor > status.fedDays ? { ...status, fedDays: floor } : status;
}

/** Clé de stockage local du plancher de croissance (un par bébé). */
export const growthFloorStorageKey = (userId: string, bornAt: string) => `mj_baby_growth:${userId}:${bornAt}`;

// ─── Faim ─────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

const startOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Nombre de jours calendaires (heure locale) entre le dernier repas et
 * maintenant. 0 = nourri aujourd'hui. Jamais négatif.
 */
export function daysSinceFed(lastFedAt: Date | string | number | null | undefined, now: Date = new Date()): number {
  if (lastFedAt === null || lastFedAt === undefined || lastFedAt === "") return 0;
  const last = lastFedAt instanceof Date ? lastFedAt : new Date(lastFedAt);
  if (Number.isNaN(last.getTime()) || Number.isNaN(now.getTime())) return 0;
  // Math.round absorbe les journées de 23 h / 25 h (changement d'heure).
  const diff = Math.round((startOfLocalDay(now).getTime() - startOfLocalDay(last).getTime()) / DAY_MS);
  return Math.max(0, diff);
}

const HUNGER_BY_DAY = [100, 85, 70, 55, 40, 25, 10] as const;

/** Remplissage du ventre en % : 100 nourri aujourd'hui → 5 après une semaine. */
export function hungerPercent(days: number): number {
  if (!Number.isFinite(days) || days <= 0) return 100;
  const d = Math.floor(days);
  return d < HUNGER_BY_DAY.length ? HUNGER_BY_DAY[d] : 5;
}

/** 0-1 content, 2-3 petit creux, 4-5 faim, 6+ très faim. */
export function moodFromDays(days: number): BabyMood {
  if (!Number.isFinite(days) || days < 2) return "happy";
  if (days < 4) return "peckish";
  if (days < 6) return "hungry";
  return "starving";
}

export type HungerTone = "full" | "low" | "empty";

/** Couleur de la jauge : vert ≥ 55 %, orange ≥ 25 %, rouge en dessous. */
export function hungerTone(percent: number): HungerTone {
  if (percent >= 55) return "full";
  if (percent >= 25) return "low";
  return "empty";
}

// ─── Croissance ───────────────────────────────────────────────

/** Jours nourris nécessaires pour atteindre chaque âge. */
export const AGE_THRESHOLDS: Record<BabyAge, number> = {
  newborn: 0,
  baby: 7,
  toddler: 30,
  kid: 90,
};

export const AGE_LABELS: Record<BabyAge, string> = {
  newborn: "Nouveau-né",
  baby: "Bébé",
  toddler: "Petit marcheur",
  kid: "Grand bébé",
};

const AGE_LABELS_GIRL: Record<BabyAge, string> = {
  newborn: "Nouveau-née",
  baby: "Bébé",
  toddler: "Petite marcheuse",
  kid: "Grand bébé",
};

/** Libellé de l'âge accordé au genre du bébé. */
export const ageLabel = (age: BabyAge, variant: BabyVariant = "boy") =>
  (variant === "girl" ? AGE_LABELS_GIRL : AGE_LABELS)[age];

export function ageFromFedDays(fedDays: number): BabyAge {
  const d = Number.isFinite(fedDays) ? fedDays : 0;
  if (d < AGE_THRESHOLDS.baby) return "newborn";
  if (d < AGE_THRESHOLDS.toddler) return "baby";
  if (d < AGE_THRESHOLDS.kid) return "toddler";
  return "kid";
}

export interface NextAge {
  age: BabyAge;
  label: string;
  remainingDays: number;
}

/** Prochain âge et jours nourris restants, ou null s'il est déjà grand. */
export function nextAge(fedDays: number, variant: BabyVariant = "boy"): NextAge | null {
  const current = ageFromFedDays(fedDays);
  const idx = BABY_AGES.indexOf(current);
  const next = BABY_AGES[idx + 1];
  if (!next) return null;
  const d = Number.isFinite(fedDays) ? Math.max(0, Math.floor(fedDays)) : 0;
  return { age: next, label: ageLabel(next, variant), remainingDays: AGE_THRESHOLDS[next] - d };
}

/** Avancement (0 → 1) dans l'âge actuel, vers le suivant. 1 quand il est grand. */
export function growthProgress(fedDays: number): number {
  const current = ageFromFedDays(fedDays);
  const next = BABY_AGES[BABY_AGES.indexOf(current) + 1];
  if (!next) return 1;
  const start = AGE_THRESHOLDS[current];
  const end = AGE_THRESHOLDS[next];
  const d = Number.isFinite(fedDays) ? Math.max(0, fedDays) : 0;
  return Math.min(1, Math.max(0, (d - start) / (end - start)));
}

/** Nouvel âge atteint entre deux mesures, sinon null (jamais de recul). */
export function grewUp(previousFedDays: number, nextFedDays: number): BabyAge | null {
  const before = ageFromFedDays(previousFedDays);
  const after = ageFromFedDays(nextFedDays);
  return BABY_AGES.indexOf(after) > BABY_AGES.indexOf(before) ? after : null;
}

// ─── Textes ───────────────────────────────────────────────────

/** Accord il / elle : agree("girl", "content", "contente") → "contente". */
export const agree = (variant: BabyVariant, masculine: string, feminine: string) =>
  variant === "girl" ? feminine : masculine;

export const pronoun = (variant: BabyVariant) => agree(variant, "il", "elle");

/** Élision devant un prénom : elide("que", "Awa") → « qu'Awa », elide("de", "Kofi") → « de Kofi ». */
export function elide(word: "que" | "de", name: string): string {
  // « y » se prononce comme une consonne dans les prénoms (de Yao, de Yasmine).
  return /^[aeiouàâäæéèêëîïôöœùûü]/i.test(name.trim()) ? `${word.slice(0, -1)}'${name}` : `${word} ${name}`;
}

/** « un petit marcheur », « une petite marcheuse », « un bébé »… */
export function ageWithArticle(age: BabyAge, variant: BabyVariant): string {
  const label = ageLabel(age, variant).toLowerCase();
  const feminineNoun = variant === "girl" && (age === "newborn" || age === "toddler");
  return `${feminineNoun ? "une" : "un"} ${label}`;
}

/** Message court affiché sous le nom, selon l'humeur. */
export function moodMessage(name: string, variant: BabyVariant, mood: BabyMood): string {
  const il = pronoun(variant);
  switch (mood) {
    case "happy":
      return `${name} est ${agree(variant, "tout content", "toute contente")}, le ventre bien rempli 💚`;
    case "peckish":
      return `${name} a un petit creux. Note une dépense pour ${agree(variant, "le", "la")} nourrir 🍼`;
    case "hungry":
      return `${name} a faim… son biberon est vide 🍼`;
    case "starving":
      return `${name} pleure un peu, ${il} t'attend 🥺`;
  }
}

/** Petite bulle « parlée » par le bébé (Talking Tom). */
export function moodBubble(mood: BabyMood): string | null {
  switch (mood) {
    case "happy":
      return null;
    case "peckish":
      return "un petit creux…";
    case "hungry":
      return "j'ai faim…";
    case "starving":
      return "tu reviens ?";
  }
}

/** Réaction quand on touche le bébé. */
export function pokeBubble(mood: BabyMood, seed = 0): string {
  const happy = ["hihi !", "encore !", "areuh 💚", "bisou !"];
  const hungry = ["j'ai faim…", "un biberon ?", "miam ?"];
  const list = mood === "happy" ? happy : hungry;
  return list[Math.abs(Math.floor(seed)) % list.length];
}

/** Célébration après une transaction enregistrée. */
export const fedMessage = (name: string, variant: BabyVariant) =>
  `${name} s'est ${agree(variant, "régalé", "régalée")} 😋`;

/** Célébration quand le bébé passe à l'âge suivant. */
export const levelUpMessage = (name: string, variant: BabyVariant, age: BabyAge) =>
  `${name} a grandi ! C'est maintenant ${ageWithArticle(age, variant)} 🎉`;

/** Ligne de croissance : « Bébé dans 5 jours de repas ». */
export function growthMessage(name: string, variant: BabyVariant, fedDays: number): string {
  const next = nextAge(fedDays, variant);
  if (!next) return `${name} est ${agree(variant, "devenu", "devenue")} ${ageWithArticle("kid", variant)} 🎉`;
  const n = next.remainingDays;
  // Un « jour de repas » = un jour où au moins une transaction a été notée.
  return `${next.label} dans ${n} jour${n > 1 ? "s" : ""} de repas`;
}

// ─── Prénom ───────────────────────────────────────────────────

/** Espaces fusionnés, caractères invisibles retirés. */
export function cleanBabyName(raw: string): string {
  return (raw ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2060-\u2064\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Prénom court pour les boutons : « Marie-Christelle Kouassi » → « Marie ». */
export function shortBabyName(name: string, max = 12): string {
  const clean = cleanBabyName(name);
  if ([...clean].length <= max) return clean;
  const first = clean.split(/[\s-]+/)[0];
  return first || clean;
}

/** Message d'erreur en français, ou null si le prénom est valable. */
export function validateBabyName(raw: string): string | null {
  const name = cleanBabyName(raw);
  if (!name) return "Donne-lui un prénom.";
  if ([...name].length > BABY_NAME_MAX_LENGTH) return `${BABY_NAME_MAX_LENGTH} caractères maximum.`;
  return null;
}

// ─── Vue complète ─────────────────────────────────────────────

export interface BabyView {
  daysSinceFed: number;
  hunger: number;
  tone: HungerTone;
  mood: BabyMood;
  age: BabyAge;
  ageLabel: string;
  next: NextAge | null;
  progress: number;
  message: string;
  bubble: string | null;
}

/** Tout ce qu'il faut pour dessiner le bébé à l'instant `now`. */
export function describeBaby(status: BabyStatus, now: Date = new Date()): BabyView {
  const days = daysSinceFed(status.lastFedAt, now);
  const hunger = hungerPercent(days);
  const mood = moodFromDays(days);
  const age = ageFromFedDays(status.fedDays);
  return {
    daysSinceFed: days,
    hunger,
    tone: hungerTone(hunger),
    mood,
    age,
    ageLabel: ageLabel(age, status.variant),
    next: nextAge(status.fedDays, status.variant),
    progress: growthProgress(status.fedDays),
    message: moodMessage(status.name, status.variant, mood),
    bubble: moodBubble(mood),
  };
}
