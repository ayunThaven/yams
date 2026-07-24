# Yams Tour par Tour

Application multijoueur de Yams construite avec Next.js, Socket.IO et
Supabase. Le serveur Node personnalisé héberge Next.js et les événements temps
réel sur le même port.

## Prérequis

- Node.js 20
- Une instance Supabase PostgreSQL
- Un fournisseur SendGrid pour les emails transactionnels en production

Copiez `env.template` vers `.env`, puis renseignez au minimum :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTH_JWT_SECRET`

Les clés `NEXT_PUBLIC_*` peuvent être présentes au build. Les clés serveur et
les secrets d'email sont fournis uniquement à l'exécution.

## Commandes

```bash
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
npm run build:server
```

Le serveur de développement écoute sur `http://localhost:3000` par défaut.

## Base de données

Les migrations incrémentales vivent dans `supabase/migrations` et doivent être
appliquées dans leur ordre numérique. Elles ne doivent jamais être réécrites
après déploiement.

`supabase/bootstrap/reset-public-schema.sql` est un outil destructif réservé à
un environnement local vierge. Il supprime le schéma `public` et ne doit ni être
appliqué à une base existante ni être traité comme une migration.

## Architecture

- `src/app` : pages et routes HTTP Next.js.
- `src/server` : règles de room, Socket.IO, timers et persistance de jeu.
- `src/lib` : règles de Yams, authentification et accès Supabase.
- `server.ts` : point d'entrée du serveur personnalisé.

Les contributions doivent passer par des branches et des pull requests. Les
contrôles CI exécutent lint, TypeScript, tests et les deux builds.

## Docker

```bash
docker compose up --build
```

Les variables sensibles sont injectées au runtime par Docker Compose ; ne les
utilisez pas comme arguments de build.
