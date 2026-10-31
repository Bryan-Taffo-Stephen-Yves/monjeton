// Rappels quotidiens "note tes dépenses" — envoyés en push aux abonnés.
// Déclenché par pg_cron matin (slot=morning) et soir (slot=evening).
//
// AIGUILLAGE PAR PAYS
// - Utilisateurs en CI (Côte d'Ivoire) → banque en parler abidjanais
// - Tous les autres → banque en français neutre
// Le pays vient de profiles.country. Si non renseigné : français neutre par défaut.
//
// ROTATION
// Chaque utilisateur reçoit un message DIFFÉRENT chaque jour :
// index = (hash(user_id) + jour) % taille_banque
// → défile toute la banque en ~100 jours sans doublon, décale les utilisateurs entre eux.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// CORS restreint aux domaines de production (monjeton.app + previews Lovable).
// Les appels cron server-to-server n'envoient pas d'Origin : aucun header Allow-Origin
// n'est alors émis, mais la requête aboutit quand même (le navigateur seul bloque).
import { getCorsHeaders as _getCorsHeaders } from "../_shared/cors.ts";
function buildCorsHeaders(req: Request) {
  const h = _getCorsHeaders(req);
  h["Access-Control-Allow-Headers"] =
    (h["Access-Control-Allow-Headers"] || "") + ", x-cron-token";
  return h;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:contact@monjeton.app";
const CRON_TOKEN_ENV = Deno.env.get("REMINDERS_CRON_TOKEN") || "";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const TITLES = ["Mon Jeton", "Petit rappel", "Ton journal", "Deux secondes", "On note ?", "Rappel du jour"];

// ============================================================
// BANQUE FRANÇAIS NEUTRE — pour tout le monde sauf CI
// ============================================================

const EVENING_FR: string[] = [
  "Zéro dépense aujourd'hui ? Soit tu es un moine, soit tu as oublié de noter.",
  "Ton journal est vide aujourd'hui. Tu as vraiment rien dépensé ?",
  "Même 100 F, ça se note. Surtout 100 F en fait.",
  "Rien noté depuis ce matin. Le taxi t'a transporté gratuitement ?",
  "Aujourd'hui : 0 dépense enregistrée. On y croit moyennement.",
  "Tu as passé la journée sans dépenser un franc ? Impressionnant. Ou pas.",
  "Ton carnet du jour est vide. Deux secondes suffisent pour le remplir.",
  "Personne ne t'a vu dépenser aujourd'hui. Même pas toi apparemment.",
  "Journée blanche dans ton journal. On corrige ça ?",
  "Rien pour aujourd'hui. Ton porte-monnaie a fait la grève ?",
  "Note tes dépenses du jour tant que tu t'en souviens encore.",
  "Dans 3 jours tu auras oublié ce que tu as dépensé aujourd'hui. Note maintenant.",
  "Ta mémoire est bonne, mais pas à ce point. Note tes dépenses.",
  "Les dépenses non notées, c'est de l'argent qui disparaît.",
  "Tu as mangé aujourd'hui ? Alors tu as dépensé. Note.",
  "Le jour est presque fini et ton journal aussi... vide.",
  "Une journée sans note, c'est une journée qu'on ne peut plus expliquer.",
  "Ton argent a bougé aujourd'hui. Ton journal, non.",
  "Deux secondes. C'est tout ce que demande ton journal.",
  "Journée non renseignée. On ne va pas se mentir, tu as dépensé quelque chose.",
  "Ton journal t'attend depuis ce matin. Il commence à s'ennuyer.",
  "Pas de dépense enregistrée. Tu as trouvé un sponsor ?",
  "Rappelle-toi ce que tu as dépensé aujourd'hui. Vite, avant que ça parte.",
  "Aucune trace de ta journée. Répare ça en 10 secondes.",
  "Le meilleur moment pour noter une dépense, c'est maintenant.",
  "Journée vide au tableau. Un petit effort ?",
  "La journée se termine. Ton journal est-il à jour ?",
  "Avant de dormir : deux minutes pour noter ta journée.",
  "Bilan du soir : qu'est-ce que tu as dépensé aujourd'hui ?",
  "Petit point avant de te coucher. Ta journée en chiffres.",
  "Demain tu ne te souviendras plus. Ce soir, si.",
  "C'est le moment idéal : tout est encore frais.",
  "Ta journée financière se ferme. Tu valides ?",
  "Note ce soir, dors tranquille.",
  "Avant que la journée ne s'efface, note-la.",
  "Une minute maintenant t'évite une heure de recherche en fin de mois.",
  "Ferme ta journée proprement. Note tes dépenses.",
  "Dernier appel avant minuit : tes dépenses du jour.",
  "Bonne nuit. Mais d'abord, ton journal.",
  "Rituel du soir : note, puis dors.",
  "100 F par-ci, 200 F par-là… à la fin du mois ça fait mal.",
  "Les petites dépenses sont les plus dangereuses. Elles ne font pas de bruit.",
  "Ce n'est pas les 50 000 F qui te ruinent. C'est les 500 F répétés.",
  "Tu crois que 200 F c'est rien ? Multiplie par 30 jours.",
  "Les micro-dépenses sont invisibles. Sauf dans ton journal.",
  "300 F ici, 400 F là. Personne ne compte. C'est bien le problème.",
  "Cette petite dépense que tu allais ignorer : note-la.",
  "Ce que tu ne notes pas, tu ne le vois pas. Ce que tu ne vois pas, tu le répètes.",
  "Une dépense n'est jamais trop petite pour être notée.",
  "Personne ne se ruine d'un coup. On se ruine par petites touches.",
  "Tu te souviens de tes grosses dépenses. Note plutôt les petites.",
  "100 F noté aujourd'hui, c'est 3 000 F compris à la fin du mois.",
  "Ne néglige pas ce petit achat. Ton bilan mensuel ne l'oubliera pas.",
  "Ce truc à 250 F, note-le. Sinon on ne saura jamais.",
  "Additionne tes « pas grave » de la semaine. Tu vas comprendre.",
  "Trop long à taper ? Dis-le simplement : « 3 000 au marché ».",
  "Tu as un reçu dans la poche ? Prends-le en photo, c'est fait.",
  "Parle, on note. Essaie une fois, tu ne reviendras pas en arrière.",
  "Le scan lit le montant, la date et le commerçant. Toi tu ne fais rien.",
  "Une phrase suffit pour enregistrer deux dépenses. Teste.",
  "Ce reçu va finir à la poubelle. Scanne-le avant.",
  "Deux secondes de voix valent mieux qu'une minute de saisie.",
  "Le plus dur, c'est de commencer. Après, ça prend deux secondes.",
  "C'est le week-end. C'est aussi là que l'argent part le plus vite.",
  "Jour de marché. Pense à noter en rentrant.",
  "Milieu du mois. Tu en es où ?",
  "Longtemps sans nouvelles. Ton journal a pris la poussière.",
  "Bienvenue de retour. On rattrape tes dépenses ?",
  "Le mois se termine bientôt. Ton bilan va parler.",
  "Regarde ton mois. Il a beaucoup de choses à te dire.",
];

const MORNING_FR: string[] = [
  "Nouvelle journée. Note au fur et à mesure, c'est plus facile.",
  "Bonjour. Aujourd'hui, essaie de tout noter. Même les 100 F.",
  "Un nouveau jour, un nouveau journal à remplir.",
  "Commence la journée en sachant où tu en es.",
  "Aujourd'hui, chaque dépense compte. Surtout les petites.",
  "Prends deux secondes après chaque achat. C'est tout.",
  "La journée démarre. Ton budget aussi.",
  "Bonjour. Tu sais combien tu peux dépenser aujourd'hui ?",
  "Note au moment où tu dépenses, pas le soir. C'est plus sûr.",
  "Bonne journée. Et bonne gestion.",
  "Ton objectif avance. Encore un petit versement ?",
  "Tu es plus près de ton objectif que tu ne le crois.",
  "Chaque versement compte, même petit.",
  "Ton objectif d'épargne t'attend depuis un moment.",
  "Épargner, ce n'est pas ce qui reste. C'est ce qu'on met de côté d'abord.",
  "Ton objectif est à mi-chemin. Ne lâche pas maintenant.",
  "Tu as pensé à mettre quelque chose de côté ce mois-ci ?",
  "Ton projet ne se financera pas tout seul.",
  "Un petit versement aujourd'hui, un grand soulagement plus tard.",
  "Mettre 1 000 F de côté aujourd'hui, c'est déjà commencer.",
  "Ton fonds d'urgence te remerciera le jour où ça ira mal.",
  "Ce n'est pas le montant qui compte, c'est la régularité.",
  "Un objectif sans versement, c'est juste un souhait.",
  "Tu as cotisé ce mois-ci ? Vérifie avant qu'on te le demande.",
  "Ta caisse attend ta cotisation. Ne sois pas celui qu'on relance.",
  "Ta tontine avance. Toi aussi ?",
  "Ne sois pas le dernier de la caisse. Ça se remarque.",
  "La caisse tourne, les cotisations attendent.",
  "Petit rappel : ta part dans la caisse n'est pas encore arrivée.",
  "La caisse ne se remplit pas toute seule.",
  "Cotisation du mois : c'est le moment.",
  "On te doit encore de l'argent. Tu comptes le récupérer un jour ?",
  "« Je te rends la semaine prochaine. » C'était il y a combien de semaines ?",
  "Quelqu'un te doit quelque chose depuis un moment.",
  "Argent prêté, argent oublié. Sauf ici.",
  "Tu as prêté de l'argent récemment ? Note-le avant d'oublier.",
  "Une dette non notée, c'est une dette perdue.",
  "Rembourser à temps, c'est garder ses amis.",
  "Prête si tu veux, mais note. C'est plus sûr.",
  "Tu approches de ta limite sur une catégorie. Doucement.",
  "Ton budget du mois se consomme vite. Il reste des jours.",
  "Attention, une catégorie chauffe ce mois-ci.",
  "Tu as fixé un budget. Il aimerait être respecté.",
  "Tu dépenses plus vite que d'habitude ce mois-ci.",
  "Ta régularité paie. Regarde tes chiffres.",
  "Tu as noté hier. Fais pareil aujourd'hui.",
  "Tu tiens le rythme. C'est comme ça qu'on progresse.",
  "Bravo, tu es à jour. C'est plus rare qu'on ne croit.",
  "Jour de paie ? Le meilleur moment pour fixer ton budget du mois.",
  "Début de mois. Tout est encore possible.",
  "Lundi. Nouvelle semaine, nouveau départ pour ton journal.",
  "Nouveau mois, nouvelle chance de mieux gérer.",
  "Un mois de plus. Tu as appris quelque chose sur ton argent ?",
  "Tu veux fixer un budget ce mois-ci ? C'est le bon moment.",
];

// ============================================================
// BANQUE IVOIRIENNE — pour les utilisateurs en CI
// ============================================================

const EVENING_CI: string[] = [
  "Aujourd'hui tu n'as rien noté. Le garba de midi là, il est parti où ?",
  "Zéro dépense aujourd'hui ? Djo, on te connaît un peu hein.",
  "Tu n'as rien dépensé aujourd'hui ? Gbê est mieux que drap.",
  "Même 100 F d'eau glacée, ça se note dèh.",
  "Ton journal est vide. Le woro-woro t'a transporté gratuitement ?",
  "Rien noté depuis ce matin. C'est comment ?",
  "Tu as mangé aujourd'hui ou bien ? Alors tu as dépensé.",
  "Ton carnet est vide dèh. Deux secondes seulement.",
  "Aujourd'hui zéro dépense. Bon, on va dire qu'on te croit.",
  "Le gbaka t'a déposé pour rien ? Note ton transport.",
  "Ton journal t'attend depuis le matin. Il commence à fatiguer.",
  "Rien du tout aujourd'hui ? Même pas les unités ?",
  "Tu es où ? Ton journal ne te voit plus.",
  "Aujourd'hui c'est vide. Pourtant ton argent, lui, il a bougé.",
  "Tu n'as rien noté. Demain tu vas dire « l'argent est parti où ? »",
  "Ton carnet du jour est propre. Trop propre même.",
  "Note maintenant tant que tu te rappelles encore.",
  "Dans deux jours tu ne sauras plus. Note chap-chap.",
  "Ta mémoire est bonne, mais pas à ce point dèh.",
  "Aujourd'hui : rien. Ton porte-monnaie a fait grève ?",
  "Tu as bougé toute la journée sans dépenser ? On applaudit.",
  "Tu as sorti la monnaie aujourd'hui. Note-la.",
  "Rien enregistré. Tu as trouvé un sponsor ?",
  "Deux secondes dèh. C'est tout ce qu'on demande.",
  "Journée vide au tableau. Un petit effort.",
  "Tu peux noter en parlant, tu sais. Donc pas d'excuse.",
  "Aucune trace de ta journée. Répare ça vite.",
  "Ton journal est là, il attend. Comme un vrai ami.",
  "Le meilleur moment pour noter, c'est maintenant.",
  "100 F par-ci, 200 F par-là. À la fin du mois c'est ça qui gâte.",
  "Ce n'est pas 50 000 qui te finit. C'est les 500 F que tu ne comptes pas.",
  "Les petits sous là, c'est eux les vrais voleurs.",
  "Ton sachet d'eau aussi compte dèh.",
  "Tu dis que 200 F c'est rien ? Multiplie par 30 jours et reviens.",
  "Le kiosque du matin, le garba de midi. Tout ça s'additionne.",
  "Chaque « ce n'est rien » devient un grand « l'argent est où ? »",
  "Cette petite dépense que tu allais laisser passer : note-la.",
  "Les petites dépenses ne font pas de bruit. C'est pour ça qu'elles sont dangereuses.",
  "Ce que tu ne notes pas, tu ne le vois pas. Et tu recommences.",
  "300 F ici, 400 F là. Personne ne compte. Voilà le problème.",
  "Personne ne devient fauché d'un coup. C'est petit à petit.",
  "Le pain du matin aussi. Oui, même ça.",
  "Ce truc à 250 F, note-le. Sinon on ne saura jamais.",
  "Additionne tes « pas grave » de la semaine, tu vas comprendre.",
  "Tu te rappelles tes grosses dépenses. Note plutôt les petites.",
  "100 F noté aujourd'hui, c'est 3 000 F compris à la fin du mois.",
  "L'alloco de 500 F, il compte aussi hein.",
  "Les unités que tu achètes chaque jour, tu les as comptées ?",
  "Aucune dépense n'est trop petite pour être notée.",
  "La monnaie que tu as donnée ce matin, elle sortait de ta poche dèh.",
  "Tu ne sauras jamais où va ton argent si tu notes que le gros.",
  "Petite dépense, petit effort. Note et continue ta route.",
  "Le gnamankoudji aussi, note-le.",
  "C'est justement les montants que tu trouves ridicules qu'il faut noter.",
  "La journée est finie. Ton journal aussi ?",
  "Avant de dormir : deux minutes pour ta journée.",
  "Bilan du soir. Tu as dépensé combien aujourd'hui ?",
  "Note ce soir, dors tranquille.",
  "Demain tu ne vas plus te rappeler. Ce soir, si.",
  "C'est le bon moment : tout est encore frais dans ta tête.",
  "Ferme ta journée proprement. Note tes dépenses.",
  "Dernier appel avant minuit.",
  "Tu as fait quoi de ton argent aujourd'hui ? Réponds à ton journal.",
  "Bonne nuit. Mais d'abord, note.",
  "Une minute maintenant t'évite une heure de recherche plus tard.",
  "La nuit efface la mémoire. Note avant.",
  "Ta journée financière se ferme. Tu valides ?",
  "Le soir c'est le meilleur moment pour se rappeler.",
  "Journée terminée. Et ton journal, il en est où ?",
  "Avant que la journée parte, note-la.",
  "Petit point avant de te coucher.",
  "Rituel du soir : note, puis dors.",
  "L'argent dépensé ne revient pas. Note au moins.",
  "Il est tard. Ton journal attend toujours.",
  "Vendredi soir. Le maquis t'attend, ton journal aussi.",
  "Tu étais au maquis hier ? Ton portefeuille s'en souvient encore.",
  "Après le maquis, note dèh. Demain tu ne sauras plus rien.",
  "Les sucreries d'hier soir, tu les as notées ?",
  "C'est le week-end. C'est aussi là que l'argent court le plus vite.",
  "Samedi. Doucement avec la monnaie dèh.",
  "Le week-end est fini. On fait le point avant lundi.",
  "Tu t'es enjaillé ce week-end ? Ton journal veut les détails.",
  "Faroter c'est bien. Savoir combien tu as faroté, c'est mieux.",
  "Le boucantier qui ne compte pas, il finit gaou.",
  "Tu peux farot. Mais note d'abord.",
  "Après la sortie, deux secondes pour noter. C'est tout.",
  "Dimanche soir. Le week-end a coûté combien ?",
  "La nuit a été bonne ? Et le portefeuille alors ?",
  "Sortie prévue ce soir ? Fixe ton budget avant de partir.",
  "Jour de marché. Pense à noter en rentrant.",
  "Tu as pris un taxi compteur hier soir ? Note-le.",
  "Les sorties c'est la vie. Mais les comptes aussi.",
  "Ce week-end, essaie de tout noter. Juste pour voir.",
  "Fin du mois arrive. Tu es prêt ou bien ?",
  "Le 25 est passé. Ton compte, il dit quoi ?",
  "Fin du mois c'est chaud. C'est pour ça qu'on note depuis le 1er.",
  "Le mois se termine. Tu veux savoir où l'argent est parti ?",
  "Ton bilan du mois est prêt. Courage dèh.",
  "Compare avec le mois dernier. C'est intéressant.",
  "Un mois de plus. Tu as appris quelque chose ?",
];

const MORNING_CI: string[] = [
  "Nouvelle journée. Note au fur et à mesure, c'est plus facile.",
  "Bonjour dèh. Aujourd'hui, essaie de tout noter. Même les 100 F.",
  "Un nouveau jour, un nouveau journal à remplir.",
  "Commence la journée en sachant où tu en es.",
  "Aujourd'hui, chaque dépense compte. Surtout les petites.",
  "Prends deux secondes après chaque achat. C'est tout.",
  "La journée démarre. Ton budget aussi.",
  "Bonjour. Tu sais combien tu peux dépenser aujourd'hui ?",
  "Note au moment où tu dépenses, pas le soir. C'est plus sûr.",
  "Bonne journée. Et bonne gestion.",
  "Mettre de côté aujourd'hui, c'est éviter d'appeler ton grand frère demain.",
  "Ton objectif avance doucement. Continue dèh.",
  "1 000 F de côté, c'est déjà commencer.",
  "Tu es plus près de ton objectif que tu ne crois.",
  "Chaque versement compte, même petit.",
  "Ton objectif t'attend depuis un moment.",
  "Épargner ce n'est pas ce qui reste. C'est ce qu'on met de côté d'abord.",
  "Ton objectif est à mi-chemin. Ne lâche pas maintenant.",
  "Tu as mis quelque chose de côté ce mois-ci ?",
  "Ton projet ne va pas se financer tout seul.",
  "Un petit versement aujourd'hui, un grand soulagement demain.",
  "Le jour où ça va chauffer, ton épargne va te sauver.",
  "Ce n'est pas le montant qui compte, c'est la régularité.",
  "Un objectif sans versement, c'est juste un souhait.",
  "Tu as cotisé ce mois-ci ou bien ? Vérifie avant qu'on t'appelle.",
  "Ta caisse attend ta part. Ne sois pas le dernier dèh.",
  "Dans la caisse, pas de palabre. Tout est écrit.",
  "Qui a payé, qui n'a pas payé ? Regarde, c'est marqué.",
  "Ta tontine avance. Toi aussi ?",
  "La caisse ne se remplit pas toute seule.",
  "Cotisation du mois : c'est le moment.",
  "Ne sois pas celui qu'on relance chaque fois.",
  "Ta caisse a bougé. Va voir ce qui se passe.",
  "La caisse approche de son objectif. Ne lâche pas.",
  "Fini les « j'ai payé », « non tu n'as pas payé ». Tout est là.",
  "La transparence évite les palabres.",
  "Vérifie qui a cotisé, sans te fâcher avec personne.",
  "« Je te rends la semaine prochaine. » Ça fait combien de semaines déjà ?",
  "Ton môgô te doit encore. Il a oublié, toi non.",
  "L'argent que tu as prêté là, tu comptes le revoir un jour ?",
  "Prête si tu veux, mais note. Sinon c'est cadeau.",
  "Celui qui te doit, il dort bien lui.",
  "Une dette arrive à échéance. Petit rappel.",
  "Tu as prêté récemment ? Note avant d'oublier.",
  "C'est le moment de relancer. Gentiment.",
  "Rembourser à temps, c'est garder ses amis.",
  "Tu approches de ta limite sur une catégorie. Doucement.",
  "Attention, une catégorie chauffe ce mois-ci.",
  "Tu as fixé un budget. Il aimerait être respecté.",
  "Tu dépenses plus vite que d'habitude ce mois-ci.",
  "Une semaine sans rater. Tu es sérieux dèh.",
  "Tu notes tous les jours. Respect.",
  "Ta régularité paie. Regarde tes chiffres.",
  "Tu as noté hier. Fais pareil aujourd'hui.",
  "Bravo, tu es à jour. C'est plus rare qu'on ne croit.",
  "Un mois complet de suivi. Tu fais partie des sérieux.",
  "Pas le temps de taper ? Dis seulement : « garba 500 ».",
  "Dis « woro-woro 300 » et c'est noté. Essaie une fois.",
  "Le scan lit le montant tout seul. Toi tu ne fais rien.",
  "Ce reçu va finir à la poubelle. Scanne-le avant.",
  "Une phrase, deux dépenses enregistrées. Teste dèh.",
  "Jour de paie ? Le meilleur moment pour fixer ton budget du mois.",
  "Début de mois. Tout est encore possible.",
  "Lundi. Nouvelle semaine, nouveau départ.",
  "Nouveau mois, nouvelle chance de mieux gérer.",
];

// ============================================================
// LOGIQUE DE ROTATION ET AIGUILLAGE
// ============================================================

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function dayNumber(): number {
  return Math.floor(Date.now() / 86_400_000);
}

function pickPool(country: string | null, slot: "morning" | "evening"): string[] {
  const isCI = country === "CI";
  if (slot === "morning") return isCI ? MORNING_CI : MORNING_FR;
  return isCI ? EVENING_CI : EVENING_FR;
}

function pickMessage(userId: string, pool: string[], day: number) {
  const offset = hashString(userId);
  const body = pool[(offset + day) % pool.length];
  const title = TITLES[(offset + day) % TITLES.length];
  return { title, body };
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const token = url.searchParams.get("token") || req.headers.get("x-cron-token") || "";
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Vérif token (identique à l'existant)
  const { data: cfg } = await supabase
    .from("system_config").select("value").eq("key", "reminders_cron_token").maybeSingle();
  const expected = cfg?.value || CRON_TOKEN_ENV;
  if (!expected || token !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const slot = (url.searchParams.get("slot") || "evening") as "morning" | "evening";
  const day = dayNumber();

  // Abonnements actifs
  const { data: subs, error: subsErr } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .is("disabled_at", null);

  if (subsErr) {
    console.error("Failed to load subscriptions:", subsErr);
    return new Response(JSON.stringify({ error: subsErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userIds = [...new Set((subs || []).map((s) => s.user_id))];

  // Utilisateurs qui ont déjà noté une dépense aujourd'hui → on saute
  const today = new Date().toISOString().slice(0, 10);
  const alreadyLogged = new Set<string>();
  if (userIds.length > 0) {
    const { data: txs } = await supabase
      .from("transactions")
      .select("user_id")
      .eq("type", "expense").eq("date", today).in("user_id", userIds);
    (txs || []).forEach((t: any) => alreadyLogged.add(t.user_id));
  }

  // ── Pays par user (aiguillage banque) ──
  const countryByUser = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles").select("user_id, country").in("user_id", userIds);
    (profs || []).forEach((p: any) => countryByUser.set(p.user_id, p.country));
  }

  const staleEndpoints: string[] = [];
  let sent = 0, skipped = 0, ciCount = 0, frCount = 0;

  for (const sub of subs || []) {
    if (alreadyLogged.has(sub.user_id)) { skipped++; continue; }

    const country = countryByUser.get(sub.user_id) || null;
    const pool = pickPool(country, slot);
    if (country === "CI") ciCount++; else frCount++;

    const msg = pickMessage(sub.user_id, pool, day);
    const payload = JSON.stringify({
      title: msg.title, body: msg.body, url: "/transactions/new", tag: `daily-${slot}`,
    });

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      sent++;
    } catch (e: any) {
      const status = e?.statusCode || 0;
      if (status === 404 || status === 410) staleEndpoints.push(sub.endpoint);
      else console.error("push failed", status, e?.body);
    }
  }

  if (staleEndpoints.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
  }

  return new Response(
    JSON.stringify({
      ok: true, slot, sent, skipped, cleaned: staleEndpoints.length,
      breakdown: { CI: ciCount, other: frCount },
      poolSizes: {
        CI: (slot === "morning" ? MORNING_CI : EVENING_CI).length,
        FR: (slot === "morning" ? MORNING_FR : EVENING_FR).length,
      },
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
