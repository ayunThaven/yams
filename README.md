# Yams

Application Next.js 15 + serveur Socket.IO custom pour jouer au Yams en temps réel.

## Stack

- Next.js App Router, React 19, Tailwind/DaisyUI
- Serveur Node custom dans `server.ts`
- Socket.IO pour les parties en temps réel
- Supabase/Postgres pour utilisateurs, parties, stats et achievements
- Auth locale par JWT applicatif : cookie HTTP-only pour les API, token local uniquement pour le handshake Socket.IO

## Démarrage local

```bash
npm ci
npm run dev
```

L'application écoute par défaut sur `http://localhost:3000`.

## Variables d'environnement

Copier `env.template` vers `.env.local` ou `.env`, puis renseigner au minimum :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTH_JWT_SECRET`
- `BACKOFFICE_JWT_SECRET` et `BACKOFFICE_TOTP_ENCRYPTION_KEY`
- `AUTH_COOKIE_SECURE=false` en HTTP local, `true` en HTTPS

## Base de données

Appliquer toutes les migrations `supabase/migrations` dans l'ordre. Les migrations récentes rendent le schéma reproductible pour :

- `achievements`, `user_achievements`, `achievements_with_rarity_rank`
- `unlock_achievement`
- `game_player_results`
- `record_game_player_result`, idempotent via `(game_id, user_id)`

Les stats de partie ne doivent plus être envoyées par le client. Elles sont calculées côté serveur à la fin de la partie, lors d'un abandon ou après expiration du délai de déconnexion.

## Vérifications

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Ou tout lancer :

```bash
npm run check
```

## Bootstrap du back-office

Après la migration `022_backoffice_foundation.sql`, créer la première invitation privée :

```bash
npm run backoffice:bootstrap -- --email=admin@example.com
```

Pour tester en local avec le serveur sur `http://localhost:3000`, définir
`BACKOFFICE_COOKIE_SECURE=false` dans `.env`, puis générer le lien local :

```bash
npm run backoffice:bootstrap -- --email=admin@example.com --base-url=http://localhost:3000
```

Ajouter `--print-link` pour afficher le lien sans envoyer d’e-mail :

```bash
npm run backoffice:bootstrap -- --email=admin@example.com --base-url=http://localhost:3000 --print-link
```

Le lien reçu autorise un seul appareil. Sans cet appareil autorisé, les pages et API du back-office répondent `404`.

## Docker

```bash
docker compose up -d --build
```

Le Dockerfile utilise `npm ci` pour garantir une installation reproductible.
