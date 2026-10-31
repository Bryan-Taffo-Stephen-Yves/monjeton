// Tests de la logique pure de baby-reminders.
// Lancer : deno test supabase/functions/baby-reminders/logic.test.ts
// (aucune dépendance réseau : node:assert est fourni par Deno)

import assert from "node:assert/strict";
import {
  buildHungerMessage,
  daysSinceFedUtc,
  displayName,
  hungerStage,
} from "./logic.ts";

const NOW = new Date("2026-10-31T12:00:00Z"); // heure du cron

Deno.test("daysSinceFedUtc : jours calendaires UTC entiers", () => {
  assert.equal(daysSinceFedUtc("2026-10-31T00:00:00Z", NOW), 0);
  assert.equal(daysSinceFedUtc("2026-10-31T11:59:00Z", NOW), 0);
  // Hier soir 23h59 UTC = 1 jour, même si moins de 24 h se sont écoulées.
  assert.equal(daysSinceFedUtc("2026-10-30T23:59:59Z", NOW), 1);
  assert.equal(daysSinceFedUtc("2026-10-30T00:00:00Z", NOW), 1);
  assert.equal(daysSinceFedUtc("2026-10-29T23:59:59Z", NOW), 2);
  assert.equal(daysSinceFedUtc("2026-10-24T13:00:00Z", NOW), 7);
  assert.equal(daysSinceFedUtc("2026-10-23T08:00:00Z", NOW), 8);
  // Fuseau horaire dans la chaîne : on raisonne en UTC.
  assert.equal(daysSinceFedUtc("2026-10-30T01:30:00+02:00", NOW), 2); // = 29/10 23:30 UTC
  // Jamais négatif (horloge décalée, repas « dans le futur »).
  assert.equal(daysSinceFedUtc("2026-11-02T10:00:00Z", NOW), 0);
  // Changement de mois / d'année.
  assert.equal(
    daysSinceFedUtc("2026-12-30T22:00:00Z", new Date("2027-01-01T12:00:00Z")),
    2,
  );
  // Entrées invalides.
  assert.equal(daysSinceFedUtc(null, NOW), null);
  assert.equal(daysSinceFedUtc("", NOW), null);
  assert.equal(daysSinceFedUtc("pas une date", NOW), null);
  assert.equal(daysSinceFedUtc(new Date("2026-10-28T09:00:00Z"), NOW), 3);
});

Deno.test("hungerStage : escalade J2 → J7 puis silence", () => {
  const expected: Record<number, string | null> = {
    0: null,
    1: null,
    2: "petit_creux",
    3: "faim",
    4: "faim",
    5: "pleure",
    6: "pleure",
    7: "endormi",
    8: null,
    30: null,
    365: null,
  };
  for (const [d, stage] of Object.entries(expected)) {
    assert.equal(hungerStage(Number(d)), stage, `jour ${d}`);
  }
  assert.equal(hungerStage(null), null);
  assert.equal(hungerStage(-1), null);
  assert.equal(hungerStage(2.5), null);
  assert.equal(hungerStage(Number.NaN), null);
});

Deno.test("buildHungerMessage : textes garçon", () => {
  assert.deepEqual(buildHungerMessage("Kofi", "boy", 2), {
    stage: "petit_creux",
    title: "🍼 Kofi a un petit creux",
    body: "Kofi a un petit creux 🍼 Note une dépense pour le nourrir.",
  });
  for (const d of [3, 4]) {
    assert.deepEqual(buildHungerMessage("Kofi", "boy", d), {
      stage: "faim",
      title: "🍼 Kofi a faim",
      body: "Kofi a faim… son biberon est vide 🍼",
    });
  }
  for (const d of [5, 6]) {
    assert.deepEqual(buildHungerMessage("Kofi", "boy", d), {
      stage: "pleure",
      title: "🥺 Kofi t'attend",
      body: "Kofi pleure un peu, il t'attend 🥺",
    });
  }
  assert.deepEqual(buildHungerMessage("Kofi", "boy", 7), {
    stage: "endormi",
    title: "💤 Kofi s'est endormi",
    body: "Kofi s'est endormi en t'attendant. Il sera tellement content de te revoir 💚",
  });
});

Deno.test("buildHungerMessage : accords au féminin", () => {
  assert.equal(
    buildHungerMessage("Awa", "girl", 2)?.body,
    "Awa a un petit creux 🍼 Note une dépense pour la nourrir.",
  );
  assert.equal(buildHungerMessage("Awa", "girl", 3)?.body, "Awa a faim… son biberon est vide 🍼");
  assert.equal(buildHungerMessage("Awa", "girl", 6)?.body, "Awa pleure un peu, elle t'attend 🥺");
  assert.deepEqual(buildHungerMessage("Awa", "girl", 7), {
    stage: "endormi",
    title: "💤 Awa s'est endormie",
    body: "Awa s'est endormie en t'attendant. Elle sera tellement contente de te revoir 💚",
  });
});

Deno.test("buildHungerMessage : rien en dehors de J2-J7", () => {
  for (const d of [null, 0, 1, 8, 9, 100]) {
    assert.equal(buildHungerMessage("Yao", "boy", d), null, `jour ${d}`);
  }
});

Deno.test("nom et variante robustes", () => {
  assert.equal(displayName("  Ama  "), "Ama");
  assert.equal(displayName("Petit   Yao"), "Petit Yao");
  assert.equal(displayName(""), "Bébé Jeton");
  assert.equal(displayName(null), "Bébé Jeton");
  assert.equal(displayName("A".repeat(40)).length, 24);
  // Variante inconnue → garçon (valeur par défaut de la table).
  assert.equal(
    buildHungerMessage("Yao", "autre", 5)?.body,
    "Yao pleure un peu, il t'attend 🥺",
  );
  assert.equal(buildHungerMessage(null, "girl", 3)?.title, "🍼 Bébé Jeton a faim");
});

Deno.test("scénario complet : la date du cron décide du message", () => {
  const lastFed = "2026-10-26T18:45:00Z"; // dernier repas le 26/10 au soir
  const msgs = [27, 28, 29, 30, 31, 1, 2, 3].map((day) => {
    const month = day >= 27 ? "10" : "11";
    const now = new Date(`2026-${month}-${String(day).padStart(2, "0")}T12:00:00Z`);
    return buildHungerMessage("Kofi", "boy", daysSinceFedUtc(lastFed, now))?.stage ?? null;
  });
  assert.deepEqual(msgs, [
    null, // 27/10 : J1
    "petit_creux", // 28/10 : J2
    "faim", // 29/10 : J3
    "faim", // 30/10 : J4
    "pleure", // 31/10 : J5
    "pleure", // 01/11 : J6
    "endormi", // 02/11 : J7
    null, // 03/11 : J8 → silence
  ]);
});
