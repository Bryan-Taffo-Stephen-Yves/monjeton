# Héberger Monjeton sur Cloudflare Pages

Objectif : servir le site sans Lovable (plus de badge « Edit with Lovable »).
La base de données reste à déménager séparément (voir le plan « Quitter Lovable »).

## Réglages du projet Cloudflare Pages

Dans Cloudflare : Workers & Pages → Créer → Pages → Connecter à Git → choisir le dépôt `monjeton`.

| Réglage | Valeur |
|---|---|
| Branche de production | `main` |
| Préréglage du framework | Vite (ou « Aucun ») |
| Commande de build | `npm run build` |
| Dossier de sortie | `dist` |

Variables d'environnement (Paramètres → Variables), pour Production **et** Preview :

| Nom | Valeur |
|---|---|
| `NODE_VERSION` | `20` |
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | clé publique (anon) du projet Supabase |
| `VITE_SUPABASE_PROJECT_ID` | identifiant du projet Supabase |
| `VITE_VAPID_PUBLIC_KEY` | clé publique VAPID des notifications |

Ces valeurs sont publiques (elles finissent dans le site), mais elles doivent
pointer vers le **même** projet Supabase que les fonctions et les secrets VAPID.

## Ce que le dépôt fournit déjà

- `public/_headers` : en-têtes de sécurité (CSP, HSTS, anti-iframe…) et règles de cache.
  Cloudflare les applique automatiquement.
- Pas de `404.html` : Cloudflare renvoie donc `index.html` pour toutes les adresses
  (`/dashboard`, `/tontines`…), ce qui est le comportement voulu pour l'app.
  Ne pas ajouter de règle `/* /index.html 200` dans `_redirects` : Cloudflare la
  considère comme une boucle et l'ignore.
- `package-lock.json` et `bun.lock` pointent vers le registre npm public
  (avant, une partie pointait vers le cache privé de Lovable, inaccessible ailleurs).

## Domaine monjeton.app

1. Tester d'abord sur l'adresse `*.pages.dev` donnée par Cloudflare.
2. Projet Pages → Domaines personnalisés → ajouter `monjeton.app` (et `www.monjeton.app`).
3. Suivre les instructions DNS de Cloudflare chez le registrar du domaine.
4. Retirer ensuite le domaine des réglages de publication Lovable.

## Sécurité recommandée côté Cloudflare (gratuit)

- SSL/TLS : mode « Full (strict) », « Always Use HTTPS » activé.
- Security → Bots : « Bot Fight Mode » activé.
- Activer la double authentification sur le compte Cloudflare.
