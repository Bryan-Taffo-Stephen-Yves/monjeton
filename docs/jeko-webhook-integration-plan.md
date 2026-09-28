# Plan — Intégration du webhook Jèko (via MCP Jèko)

> **Mise à jour :** le job `jeko-reconcile` décrit plus bas a été retiré avant la mise en ligne. Entre-temps, `main` a fait évoluer le webhook (référence = user_id, paiements invités, table `payments`), et le job reprenait l'ancienne logique. Il reste dans l'historique git (commit 950c14a) et devra être réaligné sur le webhook actuel avant d'être réintroduit.

## Contexte / problème

Un utilisateur peut payer son abonnement (Pro / Ultra Pro) via les liens de paiement Jèko, mais l'accès aux fonctionnalités pro n'est pas activé automatiquement. Actuellement l'activation dépend entièrement de la fonction Supabase `jeko-webhook`, qui n'est jamais (ou pas fiablement) appelée par Jèko. Résultat : activation manuelle nécessaire à chaque paiement.

## État actuel du code (déjà en place)

| Fichier | Rôle |
|---|---|
| `supabase/functions/jeko-webhook/index.ts` | Endpoint qui reçoit le callback, vérifie une signature HMAC (header `jeko-signature`), matche l'utilisateur **par numéro de téléphone**, active la souscription dans `subscriptions`. |
| `supabase/functions/_shared/jeko-client.ts` | Client API Jèko (`api.jeko.africa/partner_api`), utilisé seulement pour lister les transactions (`listRecentTransactions`), pas pour créer des paiements. |
| `src/lib/jeko.ts` | Liens de paiement **statiques et partagés** (`pay.jeko.africa/pl/<id>`) — un lien par plan, identique pour tous les clients. |
| `supabase/functions/verify-payment/index.ts` | Lit simplement la table `subscriptions` côté frontend — dépend entièrement du webhook pour être à jour. |
| Table `jeko_payments` | Log de tous les paiements reçus, y compris ceux non matchés à un utilisateur (réconciliation manuelle). |

**Hypothèses de la cause racine** (à confirmer via le MCP) :
1. L'URL du webhook n'a jamais été déclarée côté Jèko (dashboard ou champ API).
2. Les liens de paiement **statiques** ne transmettent peut-être pas de webhook au même titre qu'une transaction créée dynamiquement via l'API avec une référence par utilisateur.
3. Le format du payload/signature attendu diffère de ce que le code vérifie actuellement (un commentaire dans le code note déjà une incohérence dans la doc : champs à la racine vs sous `.data`).
4. Le matching par numéro de téléphone est fragile (formats différents, faux négatifs) — indépendant du problème webhook mais aggrave l'impact.

## Contrainte d'environnement

Le MCP Jèko (`https://mcp.jeko.africa/mcp`) et la doc (`developer.jeko.africa`) sont **inaccessibles depuis cet environnement distant** (bloqués par la politique réseau, et l'outil MCP `jeko` nécessite une autorisation interactive impossible à compléter dans cette session non-interactive). Toute la phase de diagnostic MCP doit donc se faire **en local**, dans VS Code / terminal, avec Claude Code (MCP déjà ajouté via `claude mcp add --scope user --transport http jeko https://mcp.jeko.africa/mcp`).

**Décision prise** : la Phase 2 a été implémentée **sans attendre** la Phase 1, sur la base d'hypothèses raisonnables et du code existant, plutôt que de laisser les utilisateurs sans solution. À corriger dès que la doc/MCP confirme (ou infirme) le schéma réel — voir la section "Écarts restants" en bas de ce document.

---

## Phase 1 — Diagnostic via le MCP Jèko (en local)

- [ ] **1.1** Lancer `/mcp__jeko__integrer_produit webhooks` et décrire le cas d'usage : paiement d'abonnement via lien de paiement, besoin d'un callback fiable pour activer l'accès pro.
- [ ] **1.2** Demander explicitement : *les liens de paiement statiques (`pay.jeko.africa/pl/...`) déclenchent-ils un webhook, ou faut-il créer une transaction par utilisateur via l'API pour recevoir un callback ?*
- [ ] **1.3** Récupérer la checklist officielle via `get_integration_checklist` pour le produit "webhooks" (et "lien de paiement" si distinct).
- [ ] **1.4** Clarifier via `search_docs` / `get_endpoint` :
  - Où/comment enregistrer l'URL de callback (dashboard marchand ? champ `webhookUrl` à la création du paiement ? configuration globale par magasin ?)
  - Le nom exact des champs du payload (racine vs `.data`), les types d'événements (`PaymentRequest`, autres statuts que `success`)
  - L'algorithme et le header de signature exacts (HMAC-SHA256 sur le header `jeko-signature` — à confirmer)
  - Le format du montant (centimes vs XOF direct)
- [ ] **1.5** Faire relire l'implémentation existante avec `/mcp__jeko__implementer_webhook javascript`, en donnant `supabase/functions/jeko-webhook/index.ts` comme code à valider via `validate_webhook`, et noter chaque écart signalé.
- [ ] **1.6** Vérifier s'il existe un moyen recommandé d'identifier l'utilisateur qui paie (référence/metadata personnalisée à la création du paiement) plutôt que le matching par téléphone.

**Livrable de cette phase** : réponses aux points ci-dessus, à ramener dans la session de travail sur le repo pour la phase 2.

---

## Phase 2 — Correctifs dans le repo (implémentés, testés localement)

- [x] **2.3** Refactor `jeko-webhook/index.ts` : la logique de parsing (`_shared/jeko-parse.ts`) et de matching/activation (`_shared/jeko-payment-processor.ts`) est extraite dans des modules partagés, testés unitairement (`src/test/jeko-parse.test.ts`, 10 tests ✓) et réutilisés par le nouveau job de réconciliation.
- [x] **2.6** Les paiements non matchés continuent d'être loggés dans `jeko_payments` (colonne `source` ajoutée : `webhook` ou `reconcile`).
- [x] **Nouveau (pas dans le plan initial) — filet de sécurité indépendant du webhook** : `supabase/functions/jeko-reconcile/index.ts`, un job cron (toutes les 15 min, migration `20260915102418_jeko_payments_reconcile.sql`) qui appelle `listRecentTransactions` (déjà présent dans `jeko-client.ts` mais jamais utilisé) et applique la même logique d'activation. Ça résout le problème même si la cause du webhook manquant reste à diagnostiquer côté Jèko : au pire 15 min de délai au lieu d'une activation manuelle.
- [x] Idempotence : contrainte unique sur `jeko_payments.txn_id` + upsert `ignoreDuplicates`, pour éviter un double-traitement si le webhook et la réconciliation voient la même transaction.
- [ ] **2.1 / 2.4** Migration vers des paiements créés dynamiquement par API (avec référence par utilisateur) — **pas fait**, nécessite de confirmer d'abord si l'API Jèko le permet (Phase 1).
- [ ] **2.2** Enregistrement de l'URL de callback côté Jèko — **action manuelle probable côté dashboard Jèko, pas dans le code**, à faire dès que la Phase 1 confirme la marche à suivre.
- [ ] **2.5** Test en conditions réelles (paiement réel sur magasin de test) — **pas fait depuis cet environnement** (réseau vers `api.jeko.africa` non vérifié/bloqué probable). À faire en local ou en prod avec supervision.
- [ ] **2.7** Déploiement de `jeko-webhook` (modifié) et `jeko-reconcile` (nouveau) sur Supabase — **pas fait**, nécessite les credentials/accès Supabase CLI qui ne sont pas dans cette session.

## Écarts restants / hypothèses non confirmées

Ces points restent des suppositions tant que la Phase 1 (MCP Jèko) n'a pas été faite :
- Nom exact des champs du payload webhook (racine vs `.data`), et si `listRecentTransactions` renvoie le même schéma pour chaque transaction.
- Header/algorithme de signature (`jeko-signature`, HMAC-SHA256) — non vérifié contre la doc réelle.
- Où et comment enregistrer l'URL du webhook côté Jèko (probable cause racine du problème initial).
- Si les liens de paiement statiques déclenchent un webhook du tout — le job `jeko-reconcile` contourne cette question en allant chercher l'info par polling plutôt que d'attendre un push.

## À faire avant déploiement en production

- [ ] Exécuter la Phase 1 en local (voir plus haut) pour confirmer/corriger le schéma et enregistrer l'URL du webhook.
- [ ] `supabase db push` pour appliquer la migration `20260915102418_jeko_payments_reconcile.sql`.
- [ ] `supabase functions deploy jeko-webhook jeko-reconcile`.
- [ ] Vérifier que `JEKO_API_KEY` / `JEKO_API_KEY_ID` sont bien configurés comme secrets Supabase (requis par `jeko-reconcile`, déjà requis par `jeko-client.ts` mais jamais appelé jusqu'ici).
- [ ] Surveiller `jeko_payments` (colonne `source`) sur les premiers paiements réels pour confirmer que le job de réconciliation fonctionne comme attendu.
