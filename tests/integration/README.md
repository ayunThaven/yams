# Tests d'intégration

`npm run test` exécute les tests de session et de gameplay de phase 1, sans réseau externe :

- routes réelles de session invitée, login et création, avec transport Supabase simulé ;
- middleware Next.js et authentification Socket.IO réelle ;
- handlers réels de lobby, gameplay, timers, reconnexion et finalisation avec fixtures en mémoire ;
- quatre compositions USER/GUEST et les trois variantes, jusqu'aux résultats ;
- anciennes sauvegardes USER, capacité, pseudo identique, score automatique, expiration et abandon.

Les effets PostgreSQL sont vérifiés séparément par `npm run test:db` :
les assertions de phase 0 sont conservées, puis la migration 029 et les assertions invités
sont exécutées pour les deux types de clés étrangères historiques. Les finalisations
concurrentes restent testées après la migration 029.

Configurer `TEST_DATABASE_URL` vers une base PostgreSQL locale **jetable**, nommée
`yams_v2_test`, avec `psql` disponible. Le script recrée ses schémas.

Sur Windows sans `psql`, le conteneur de test dédié est aussi pris en charge :

```powershell
docker run --name yams-phase1-sql-test -e POSTGRES_PASSWORD=yams-test-only -e POSTGRES_DB=yams_v2_test -p 127.0.0.1:55439:5432 -d postgres:16-alpine
$env:TEST_DATABASE_URL='postgresql://postgres:yams-test-only@localhost:55439/yams_v2_test'
$env:TEST_DATABASE_CONTAINER='yams-phase1-sql-test'
npm run test:db
docker rm -f yams-phase1-sql-test
```

Ces tests ne modifient pas le Supabase de l'application. Aucun test navigateur sur une
instance Supabase déployée n'est inclus dans cette suite.
