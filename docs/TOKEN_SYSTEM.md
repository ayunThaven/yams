# Système de Tokens et Autorité Serveur

## Modèle d'authentification

L'application utilise un JWT applicatif généré par `src/lib/authServer.ts`.

- Les API lisent le token depuis le cookie HTTP-only `yams_auth_token`.
- Le client garde aussi le token en `localStorage` uniquement pour authentifier le handshake Socket.IO.
- Le rafraîchissement via Supabase Auth n'est plus utilisé : Supabase sert de base de données, pas de fournisseur de session applicative.

## Points d'entrée

- `POST /api/auth/login` crée le JWT, pose le cookie HTTP-only et retourne le token au client pour Socket.IO.
- `GET /api/auth/me` vérifie le cookie et renvoie le profil.
- `POST /api/auth/logout` efface le cookie.
- `src/lib/authRequest.ts` centralise `requireAuth` pour les API routes.
- `middleware.ts` ne fait qu'une redirection UX basée sur la présence du cookie ; la vérification cryptographique reste côté serveur API/Socket.

## Autorité métier

Le client ne peut plus déclarer directement ses stats ou ses achievements.

- `POST /api/stats/update` retourne `410 Gone`.
- `POST /api/achievements/unlock` retourne `410 Gone`.
- Les stats sont calculées dans `src/server/gameFinalizationService.ts`.
- L'idempotence est garantie en base par `record_game_player_result` et la contrainte unique `(game_id, user_id)`.
- Les achievements sont débloqués côté serveur, puis envoyés au client via l'événement Socket.IO `achievements_unlocked`.

## Stockage client

`src/lib/tokenManager.ts` conserve :

- `yams_access_token`
- `yams_token_expiry`
- `serverRestartId`

Ces valeurs servent à l'expérience client et au handshake Socket.IO. Elles ne remplacent pas la vérification serveur du cookie JWT pour les API.
