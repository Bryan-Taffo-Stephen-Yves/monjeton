import { describe, it, expect } from "vitest";
import {
  AGE_LABELS,
  BABY_STATUS_QUERY_ROOT,
  ageFromFedDays,
  ageLabel,
  ageWithArticle,
  babyStatusQueryKey,
  cleanBabyName,
  daysSinceFed,
  describeBaby,
  elide,
  fedMessage,
  grewUp,
  growthMessage,
  growthProgress,
  hungerPercent,
  hungerTone,
  levelUpMessage,
  moodFromDays,
  moodMessage,
  nextAge,
  shortBabyName,
  toBabyStatus,
  validateBabyName,
  withGrowthFloor,
  type BabyStatus,
} from "@/lib/baby";
import { babyImageCandidates, babyImagePath, pickBabyImage } from "@/lib/babyImages";
import { petReminderMessages } from "@/lib/petReminders";

/** Date locale (mois 1-12) : les tests ne dépendent pas du fuseau de la machine. */
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

describe("daysSinceFed", () => {
  it("counts whole local calendar days, not 24 h blocks", () => {
    expect(daysSinceFed(at(2026, 10, 31, 8), at(2026, 10, 31, 22))).toBe(0);
    // 23:50 → 00:10 le lendemain : 20 minutes, mais un jour calendaire.
    expect(daysSinceFed(at(2026, 10, 30, 23, 50), at(2026, 10, 31, 0, 10))).toBe(1);
    expect(daysSinceFed(at(2026, 10, 24, 9), at(2026, 10, 31, 8))).toBe(7);
    expect(daysSinceFed(at(2026, 9, 30, 12), at(2026, 10, 2, 12))).toBe(2);
  });

  it("accepts ISO strings and timestamps", () => {
    const last = at(2026, 10, 29, 10);
    expect(daysSinceFed(last.toISOString(), at(2026, 10, 31))).toBe(2);
    expect(daysSinceFed(last.getTime(), at(2026, 10, 31))).toBe(2);
  });

  it("is never negative and tolerates bad input", () => {
    expect(daysSinceFed(at(2026, 11, 2), at(2026, 10, 31))).toBe(0);
    expect(daysSinceFed(null, at(2026, 10, 31))).toBe(0);
    expect(daysSinceFed(undefined, at(2026, 10, 31))).toBe(0);
    expect(daysSinceFed("pas une date", at(2026, 10, 31))).toBe(0);
  });

  it("survives daylight saving changes (23 h / 25 h days)", () => {
    // Quel que soit le fuseau de la machine, 30 jours calendaires restent 30.
    expect(daysSinceFed(at(2026, 3, 1, 12), at(2026, 3, 31, 12))).toBe(30);
    expect(daysSinceFed(at(2026, 10, 1, 12), at(2026, 10, 31, 12))).toBe(30);
  });
});

describe("hungerPercent", () => {
  it("follows the 100 → 5 scale", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 30].map(hungerPercent)).toEqual([100, 85, 70, 55, 40, 25, 10, 5, 5, 5]);
  });

  it("treats invalid or negative days as fed", () => {
    expect(hungerPercent(-3)).toBe(100);
    expect(hungerPercent(Number.NaN)).toBe(100);
  });

  it("maps to a green / orange / red tone", () => {
    expect(hungerTone(100)).toBe("full");
    expect(hungerTone(55)).toBe("full");
    expect(hungerTone(40)).toBe("low");
    expect(hungerTone(25)).toBe("low");
    expect(hungerTone(10)).toBe("empty");
  });
});

describe("moodFromDays", () => {
  it("goes happy → peckish → hungry → starving", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 40].map(moodFromDays)).toEqual([
      "happy",
      "happy",
      "peckish",
      "peckish",
      "hungry",
      "hungry",
      "starving",
      "starving",
      "starving",
    ]);
  });
});

describe("growth", () => {
  it("picks the age from distinct fed days", () => {
    expect(ageFromFedDays(0)).toBe("newborn");
    expect(ageFromFedDays(6)).toBe("newborn");
    expect(ageFromFedDays(7)).toBe("baby");
    expect(ageFromFedDays(29)).toBe("baby");
    expect(ageFromFedDays(30)).toBe("toddler");
    expect(ageFromFedDays(89)).toBe("toddler");
    expect(ageFromFedDays(90)).toBe("kid");
    expect(ageFromFedDays(500)).toBe("kid");
  });

  it("tells how many fed days remain before the next age", () => {
    expect(nextAge(0)).toEqual({ age: "baby", label: "Bébé", remainingDays: 7 });
    expect(nextAge(12)).toEqual({ age: "toddler", label: "Petit marcheur", remainingDays: 18 });
    expect(nextAge(12, "girl")).toEqual({ age: "toddler", label: "Petite marcheuse", remainingDays: 18 });
    expect(nextAge(89)).toEqual({ age: "kid", label: "Grand bébé", remainingDays: 1 });
    expect(nextAge(90)).toBeNull();
  });

  it("measures progress inside the current age", () => {
    expect(growthProgress(0)).toBe(0);
    expect(growthProgress(7)).toBe(0);
    expect(growthProgress(18.5)).toBeCloseTo(0.5);
    expect(growthProgress(120)).toBe(1);
  });

  it("detects level-ups and never goes backwards", () => {
    expect(grewUp(6, 7)).toBe("baby");
    expect(grewUp(29, 30)).toBe("toddler");
    expect(grewUp(89, 91)).toBe("kid");
    expect(grewUp(7, 8)).toBeNull();
    expect(grewUp(30, 12)).toBeNull();
  });

  it("keeps the highest fed days ever seen", () => {
    const status: BabyStatus = {
      name: "Awa",
      variant: "girl",
      bornAt: "2026-10-01T10:00:00Z",
      notificationsEnabled: true,
      fedDays: 5,
      lastFedAt: "2026-10-30T10:00:00Z",
    };
    expect(withGrowthFloor(status, 9).fedDays).toBe(9);
    expect(withGrowthFloor(status, 3).fedDays).toBe(5);
    expect(withGrowthFloor(status, null)).toBe(status);
    expect(withGrowthFloor(status, Number.NaN)).toBe(status);
  });

  it("has French labels with il / elle agreement", () => {
    expect(AGE_LABELS).toEqual({
      newborn: "Nouveau-né",
      baby: "Bébé",
      toddler: "Petit marcheur",
      kid: "Grand bébé",
    });
    expect(ageLabel("newborn", "girl")).toBe("Nouveau-née");
    expect(ageWithArticle("toddler", "girl")).toBe("une petite marcheuse");
    expect(ageWithArticle("toddler", "boy")).toBe("un petit marcheur");
    expect(ageWithArticle("baby", "girl")).toBe("un bébé");
  });
});

describe("messages", () => {
  it("adapts mood messages to the name and gender", () => {
    expect(moodMessage("Kofi", "boy", "happy")).toContain("Kofi est tout content");
    expect(moodMessage("Awa", "girl", "happy")).toContain("Awa est toute contente");
    expect(moodMessage("Kofi", "boy", "peckish")).toContain("pour le nourrir");
    expect(moodMessage("Awa", "girl", "peckish")).toContain("pour la nourrir");
    expect(moodMessage("Yao", "boy", "hungry")).toBe("Yao a faim… son biberon est vide 🍼");
    expect(moodMessage("Ama", "girl", "starving")).toBe("Ama pleure un peu, elle t'attend 🥺");
    expect(moodMessage("Yao", "boy", "starving")).toBe("Yao pleure un peu, il t'attend 🥺");
  });

  it("never uses harsh words", () => {
    const all = (["boy", "girl"] as const).flatMap((v) =>
      (["happy", "peckish", "hungry", "starving"] as const).map((m) => moodMessage("Kofi", v, m)),
    );
    for (const text of all) expect(text).not.toMatch(/malade|maigre|meurt|mourir|sanglot|hurle/i);
  });

  it("elides before vowels", () => {
    expect(elide("que", "Awa")).toBe("qu'Awa");
    expect(elide("que", "Kofi")).toBe("que Kofi");
    expect(elide("de", "Ama")).toBe("d'Ama");
    expect(elide("de", "Éléonore")).toBe("d'Éléonore");
    expect(elide("de", "Yao")).toBe("de Yao");
  });

  it("celebrates meals and growth", () => {
    expect(fedMessage("Kofi", "boy")).toBe("Kofi s'est régalé 😋");
    expect(fedMessage("Awa", "girl")).toBe("Awa s'est régalée 😋");
    expect(levelUpMessage("Awa", "girl", "toddler")).toBe("Awa a grandi ! C'est maintenant une petite marcheuse 🎉");
    expect(levelUpMessage("Kofi", "boy", "baby")).toBe("Kofi a grandi ! C'est maintenant un bébé 🎉");
    expect(growthMessage("Kofi", "boy", 2)).toBe("Bébé dans 5 jours de repas");
    expect(growthMessage("Kofi", "boy", 89)).toBe("Grand bébé dans 1 jour de repas");
    expect(growthMessage("Awa", "girl", 95)).toBe("Awa est devenue un grand bébé 🎉");
  });
});

describe("baby name", () => {
  it("cleans spaces and invisible characters", () => {
    expect(cleanBabyName("  Kofi   Junior ")).toBe("Kofi Junior");
    expect(cleanBabyName("A\u200bwa")).toBe("Awa");
  });

  it("shortens long names for buttons", () => {
    expect(shortBabyName("Kofi")).toBe("Kofi");
    expect(shortBabyName("Marie-Christelle Kouassi")).toBe("Marie");
    expect(shortBabyName("Ange Emmanuel")).toBe("Ange");
  });

  it("validates 1 to 24 characters", () => {
    expect(validateBabyName("   ")).toBe("Donne-lui un prénom.");
    expect(validateBabyName("Kofi")).toBeNull();
    expect(validateBabyName("x".repeat(24))).toBeNull();
    expect(validateBabyName("x".repeat(25))).toBe("24 caractères maximum.");
  });
});

describe("status from the RPC", () => {
  it("converts a get_baby_status row", () => {
    expect(
      toBabyStatus({
        name: " Awa ",
        variant: "girl",
        born_at: "2026-10-01T10:00:00Z",
        notifications_enabled: false,
        fed_days: 12,
        last_fed_at: "2026-10-30T09:00:00Z",
      }),
    ).toEqual({
      name: "Awa",
      variant: "girl",
      bornAt: "2026-10-01T10:00:00Z",
      notificationsEnabled: false,
      fedDays: 12,
      lastFedAt: "2026-10-30T09:00:00Z",
    });
    expect(
      toBabyStatus({
        name: "Kofi",
        variant: "autre",
        born_at: "2026-10-01T10:00:00Z",
        notifications_enabled: true,
        fed_days: -2,
        last_fed_at: "",
      }),
    ).toMatchObject({ variant: "boy", fedDays: 0, lastFedAt: "2026-10-01T10:00:00Z" });
  });

  it("describes everything the card needs", () => {
    const view = describeBaby(
      {
        name: "Kofi",
        variant: "boy",
        bornAt: at(2026, 10, 1).toISOString(),
        notificationsEnabled: true,
        fedDays: 8,
        lastFedAt: at(2026, 10, 27, 18).toISOString(),
      },
      at(2026, 10, 31, 9),
    );
    expect(view).toMatchObject({
      daysSinceFed: 4,
      hunger: 40,
      tone: "low",
      mood: "hungry",
      age: "baby",
      ageLabel: "Bébé",
      next: { age: "toddler", remainingDays: 22 },
      bubble: "j'ai faim…",
    });
  });

  it("exposes a stable, per-user query key under a shared root", () => {
    expect(babyStatusQueryKey("u1")).toEqual(["baby-status", "u1"]);
    expect(babyStatusQueryKey("u1")).toEqual(babyStatusQueryKey("u1"));
    expect(babyStatusQueryKey("u1").slice(0, 1)).toEqual([...BABY_STATUS_QUERY_ROOT]);
    expect(babyStatusQueryKey(null)).toEqual(["baby-status", "anonymous"]);
  });
});

describe("baby images", () => {
  it("looks for the exact image first, then the same age, then the same mood", () => {
    const list = babyImageCandidates("girl", "baby", "hungry");
    expect(list[0]).toBe(babyImagePath("girl", "baby", "hungry"));
    expect(list.slice(1, 4)).toEqual([
      babyImagePath("girl", "baby", "peckish"),
      babyImagePath("girl", "baby", "starving"),
      babyImagePath("girl", "baby", "happy"),
    ]);
    expect(list.slice(4)).toEqual([
      babyImagePath("girl", "newborn", "hungry"),
      babyImagePath("girl", "toddler", "hungry"),
      babyImagePath("girl", "kid", "hungry"),
    ]);
    expect(list.every((p) => p.startsWith("/src/assets/baby/girl-"))).toBe(true);
  });

  it("falls back gracefully when files are missing", () => {
    const candidates = babyImageCandidates("boy", "kid", "starving");
    expect(pickBabyImage(candidates, { [babyImagePath("boy", "kid", "happy")]: 1 })).toBe(
      babyImagePath("boy", "kid", "happy"),
    );
    expect(pickBabyImage(candidates, { [babyImagePath("boy", "toddler", "starving")]: 1 })).toBe(
      babyImagePath("boy", "toddler", "starving"),
    );
    expect(pickBabyImage(candidates, {})).toBeNull();
  });
});

describe("native reminder texts", () => {
  it("uses the baby's name with il / elle agreement", () => {
    const boy = petReminderMessages({ name: "Kofi", variant: "boy" });
    expect(boy.title).toBe("🍼 Kofi a faim");
    expect(boy.bodies.join(" ")).toContain("pour le nourrir");
    const girl = petReminderMessages({ name: "Awa", variant: "girl" });
    expect(girl.bodies.join(" ")).toContain("pour la nourrir");
    expect(girl.bodies.join(" ")).toContain("Elle t'attend");
  });

  it("falls back to generic texts without a baby", () => {
    const generic = petReminderMessages(null);
    expect(generic.title).toBe("🍼 Ton bébé Jeton t'attend");
    expect(generic.bodies.length).toBeGreaterThan(0);
    expect(generic.bodies.join(" ")).not.toMatch(/panda|animal/i);
  });
});
