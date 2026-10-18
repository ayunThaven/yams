# Développement local et Devbox

## Versions et installation

Le dépôt utilise Node.js **24.22.0** (`.nvmrc`) et npm **11.19.1**.
Les métadonnées `engines` annoncent Node 24 et npm 11; `packageManager`
documente npm sans l'installer automatiquement. Les types Node existants restent
inchangés : aucune nouvelle API d'exécution n'est introduite.

```bash
nvm install
nvm use
node --version
npm --version
npm ci
```

`nvm` est facultatif si ces versions sont déjà installées. Utiliser le lockfile
sans mise à jour automatique des dépendances.

## Configuration locale

Pour une nouvelle installation seulement, copier `env.template` vers
`.env.local`. Ne jamais écraser un fichier existant ni reprendre les secrets de
production. Les fichiers `.env*` sont ignorés par Git et exclus du contexte Docker.

Le navigateur utilise `NEXT_PUBLIC_SUPABASE_URL` et
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Le serveur utilise `SUPABASE_SERVICE_ROLE_KEY`
et éventuellement `SUPABASE_URL`, qui doit désigner le même projet dédié aux tests.
Les variables publiques sont intégrées au bundle au moment du build; la clé de
service reste exclusivement côté serveur.

Les comptes utilisent `AUTH_JWT_SECRET` (`JWT_SECRET` est un ancien fallback).
Le back-office nécessite un `BACKOFFICE_JWT_SECRET` distinct et une
`BACKOFFICE_TOTP_ENCRYPTION_KEY` de 32 octets en base64 ou 64 caractères hexadécimaux.
Ne jamais afficher les valeurs dans les logs.

Ne pas définir `NODE_ENV` dans `.env.local` : les commandes choisissent leur mode.
En HTTP local uniquement, régler les options de cookies Secure sur `false` dans
la configuration locale. Le modèle conserve `BACKOFFICE_COOKIE_SECURE=true`;
le désactiver explicitement si nécessaire, puis utiliser `true` avec HTTPS.
Laisser `BREVO_API_KEY` vide pour éviter tout envoi d'email pendant les contrôles.
Les liens privés de bootstrap peuvent apparaître dans les logs : ne pas lancer
ce bootstrap dans une simple mission de compilation.

Le serveur personnalisé charge le shell, `.env.local`, puis `.env`, sans écraser
les variables déjà définies. Next charge également les fichiers de son mode.
Le bootstrap historique charge `.env` : vérifier séparément sa configuration.

## Contrôles sans base distante

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run build:server
```

`npm run check` regroupe les trois premiers contrôles. Les tests de cette branche
utilisent des données locales; ils ne valident pas PostgreSQL ni un environnement
Supabase réel. Les builds peuvent être exécutés sans credentials Supabase et sans
copier de fichier `.env.local` dans un nouveau worktree.

GitHub Actions utilise `.nvmrc`, `npm ci`, les contrôles statiques, les tests et les
deux builds. Le token est limité à la lecture du contenu, les credentials checkout
ne sont pas persistés et le job est limité à 15 minutes. Ce workflow ne déploie rien
et n'a besoin d'aucun secret Supabase.

## Lancement et Docker

Après validation explicite du projet de test, `HOSTNAME=127.0.0.1 npm run dev`
lance Next et Socket.IO. Le démarrage restaure les parties depuis Supabase :
ce lancement implique un accès à la base, contrairement aux contrôles ci-dessus.
`npm start` démarre le serveur compilé en production.

Le Dockerfile sélectionne Node 24.22.0 pour le builder et sa variante Alpine
pour le runner. Les arguments de build Supabase restent publics uniquement.
Docker Compose lit `.env` par défaut; il ne lit pas automatiquement `.env.local`.
Sélectionner explicitement la configuration de test avant un éventuel lancement
autorisé. `docker-start.sh` arrête des conteneurs et relance l'application : ne pas
l'utiliser pour un contrôle de compilation.

La compatibilité des images, d'Alpine et du démarrage Docker doit être validée
dans un environnement dédié. Aucun Docker ni PostgreSQL ne doit être installé
sur la Devbox pour les seuls contrôles Node. Aucun déploiement n'est requis.

## Publication après validation humaine

Depuis le worktree `chore/devbox-tooling`, après examen des commits locaux :

```bash
git push -u origin chore/devbox-tooling
gh pr create --base main --head chore/devbox-tooling --title "Standardize Node 24 development tooling" --body-file DEVELOPMENT.md
```

Ces commandes sont une procédure; leur présence n'autorise pas leur exécution.
