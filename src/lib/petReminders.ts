import { supabase } from "@/integrations/supabase/client";
import { isNativeShell } from "@/lib/appEntry";
import {
  agree,
  daysSinceFed,
  normalizeVariant,
  pronoun,
  type BabyVariant,
} from "@/lib/baby";

/**
 * Rappel local de l'application installée (Capacitor) : « ton bébé Jeton a
 * faim ». Programmé ~3-4 jours après la dernière transaction, annulé dès
 * qu'une transaction est notée. Sur le web, ce sont les notifications push
 * (fonction baby-reminders) qui prennent le relais : rien n'est programmé ici
 * et aucune autorisation n'est demandée sans geste de l'utilisateur.
 */

// Fixed notification id so we can cancel/replace it reliably.
const PET_REMINDER_ID = 424242;

/** Bébé connu au moment de programmer le rappel (sinon textes génériques). */
export interface PetReminderBaby {
  name: string;
  variant: BabyVariant;
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Textes du rappel : avec le prénom du bébé, ou génériques s'il n'y en a pas. */
export const petReminderMessages = (baby?: PetReminderBaby | null): { title: string; bodies: string[] } => {
  if (!baby?.name) {
    return {
      title: "🍼 Ton bébé Jeton t'attend",
      bodies: [
        "Ça fait quelques jours… Note tes dépenses pour garder le fil 💚",
        "Un petit moment pour noter tes dépenses ? Ton budget te dira merci 🍼",
        "Psst… tes dépenses de la semaine t'attendent. Ça prend 10 secondes 💚",
      ],
    };
  }
  const { name, variant } = baby;
  const il = pronoun(variant);
  return {
    title: `🍼 ${name} a faim`,
    bodies: [
      `${name} a faim… son biberon est vide 🍼 Note une dépense pour ${agree(variant, "le", "la")} nourrir.`,
      `${name} a un petit creux 🍼 Une dépense notée et ${il} retrouve le sourire.`,
      `${capitalize(il)} t'attend… ${name} aimerait bien son biberon 🥺`,
    ],
  };
};

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

/**
 * Compute the next reminder date: in ~3 days, at 19:00 local time.
 * Adds a small random jitter (0-1 day) to feel less robotic.
 */
const nextReminderDate = (): Date => {
  const d = new Date();
  const daysAhead = 3 + Math.floor(Math.random() * 2); // 3 or 4
  d.setDate(d.getDate() + daysAhead);
  d.setHours(19, 0, 0, 0);
  return d;
};

const cancelPetReminder = async () => {
  if (!isNativeShell()) return;
  try {
    const { LocalNotifications } = await import(
      "@capacitor/local-notifications"
    );
    await LocalNotifications.cancel({
      notifications: [{ id: PET_REMINDER_ID }],
    });
  } catch {
    // No-op when plugin unavailable.
  }
};

interface BabyInfo {
  baby: PetReminderBaby | null;
  notificationsEnabled: boolean;
  lastFedAt: string | null;
}

/** Bébé de l'utilisateur connecté (null si aucun, ou RPC indisponible). */
const fetchBabyInfo = async (): Promise<BabyInfo | null> => {
  try {
    const { data, error } = await supabase.rpc("get_baby_status");
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return { baby: null, notificationsEnabled: true, lastFedAt: null };
    return {
      baby: { name: (row.name ?? "").trim(), variant: normalizeVariant(row.variant) },
      notificationsEnabled: row.notifications_enabled !== false,
      lastFedAt: row.last_fed_at ?? null,
    };
  } catch {
    return null;
  }
};

/**
 * Schedule (or reschedule) the reminder for ~3-4 days from now.
 * Safe to call multiple times: cancels any previous instance first.
 * Native app only. Without `baby`, looks up the user's baby to personalise
 * the text (generic text when there is none); does nothing if the user turned
 * the baby's notifications off.
 */
export const schedulePetReminder = async (baby?: PetReminderBaby | null): Promise<void> => {
  if (!isNativeShell()) return;

  let who = baby ?? null;
  if (baby === undefined) {
    const info = await fetchBabyInfo();
    if (info && !info.notificationsEnabled) {
      await cancelPetReminder();
      return;
    }
    who = info?.baby ?? null;
  }

  const { title, bodies } = petReminderMessages(who);
  const body = pick(bodies);
  const at = nextReminderDate();

  try {
    const { LocalNotifications } = await import(
      "@capacitor/local-notifications"
    );
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== "granted") return;
    }
    // Replace any pending reminder.
    await LocalNotifications.cancel({
      notifications: [{ id: PET_REMINDER_ID }],
    });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: PET_REMINDER_ID,
          title,
          body,
          schedule: { at },
          extra: { kind: "pet_reminder", url: "/transactions/new" },
        },
      ],
    });
  } catch {
    // Plugin unavailable: nothing to schedule.
  }
};

interface PetActivityContext {
  userId: string;
}

/**
 * Check the user's last meal (transaction) and decide what to do:
 *  - Recent activity (< 3 days)  → cancel any pending reminder.
 *  - Inactive (>= 3 days or none) → schedule a fresh reminder.
 */
export const checkPetActivity = async ({
  userId,
}: PetActivityContext): Promise<void> => {
  if (!isNativeShell()) return;
  try {
    const info = await fetchBabyInfo();

    if (info?.baby) {
      if (!info.notificationsEnabled) {
        await cancelPetReminder();
        return;
      }
      if (daysSinceFed(info.lastFedAt) < 3) {
        await cancelPetReminder();
        return;
      }
      await schedulePetReminder(info.baby);
      return;
    }

    // Pas de bébé (ou RPC indisponible) : dernière transaction notée.
    const { data, error } = await supabase
      .from("transactions")
      .select("date")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("checkPetActivity error:", error);
      return;
    }

    const now = Date.now();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

    if (data?.date) {
      const last = new Date(data.date).getTime();
      if (now - last < threeDaysMs) {
        await cancelPetReminder();
        return;
      }
    }

    await schedulePetReminder(null);
  } catch (e) {
    console.error("checkPetActivity error:", e);
  }
};

/**
 * Called after a successful transaction insert to "feed" the baby:
 * cancels the pending reminder and re-arms it for ~3-4 days from now.
 */
export const rearmPetReminder = async (): Promise<void> => {
  await schedulePetReminder();
};
