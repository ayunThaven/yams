# Validation CI PostgreSQL V2 — 18 octobre 2026

Branche examinée : `codex/devbox-v2-sql-validation`.
Cible de PR demandée : `codex/v2-phase-1-guest-mode`.

## Isolation et modifications

- `Quality / verify` utilise exclusivement le service jetable `postgres:17`, base `yams_v2_test`, publié sur `127.0.0.1:5432` du runner GitHub hébergé. Aucun secret Supabase ni environnement GitHub de déploiement n'est référencé.
- Le workflow sélectionne directement Node `24.22.0` pour rester indépendant de la branche générique `chore/devbox-tooling`. npm local : `11.19.1`. `npm ci` utilise le lockfile; aucune métadonnée de package ou dépendance modifiée.
- Le durcissement général du token GitHub, du checkout et de la durée du job est réservé à `chore/devbox-tooling`. Les limites SQL sont portées par le harnais.
- `test:db` refuse les protocoles autres que PostgreSQL, les hôtes hors boucle locale, les autres bases, les paramètres/fragments d'URL et le mode conteneur historique. Les URL invalides ne sont pas reprises dans les erreurs.
- Les processus psql reçoivent un environnement explicite : aucune redirection héritée par `PGHOSTADDR`, `PGSERVICE`, `PGSERVICEFILE` ou `PGOPTIONS`; localhost est ramené à 127.0.0.1. Mot de passe hors arguments, pas de fichier de mots de passe, pas de psqlrc (`-X`), pas de prompt (`-w`).
- Une vérification en lecture seule exige PostgreSQL 17 et le nom attendu avant toute suppression de schéma. Limites de connexion, requête et verrou : 5, 30 et 10 secondes.
- Les fixtures réinitialisent les schémas entre scénarios. Un `finally` supprime les données après succès ou échec SQL; les deux processus concurrents se terminent avant ce nettoyage. Les rôles factices restent jusqu'à destruction du service.
- La fixture reproduit désormais les anciens grants clients pour rendre la vérification de leur révocation par 029 effective.

## Couverture préparée

Deux variantes de FK historiques : `auth.users` et `public.users`.
Ordre explicite, sans glob ni découverte par préfixe : fixture → 028 → 028 → assertions V2 → concurrence 028 → 029 → 029 → assertions invités → concurrence 029.

Les assertions existantes couvrent notamment la normalisation owner/host, les parties historiques sans propriétaire, les identités exclusives USER/GUEST, la cohérence participant/partie, les contraintes de classement, la finalisation idempotente et sa reprise, les statistiques et XP, l'expiration des invités, les parties privées Casual, les résultats mixtes, les invités sans XP et les privilèges clients.

La concurrence vérifie deux résultats exactement et une seule application des statistiques/XP. Elle s'exécute maintenant avant ET après 029; une transaction maintient le verrou une seconde et le harnais exige une attente de verrou observable dans `pg_stat_activity`. Un scénario sans chevauchement observé échoue. Les données et le point de comparaison sont renouvelés entre les deux étapes.

Un scénario négatif séparé exige que 028 rejette une partie active sans propriétaire récupérable.

## Contrôles locaux

- `npm run check` : TypeScript et ESLint réussis; 50 tests réussis, 1 test placeholder ignoré.
- `npm run build` : réussi (40 pages générées).
- `npm run build:server` : réussi.
- `node --check scripts/test-v2-migration.mjs` et `git diff --check` : réussis.
- Tests de garde-fous : cibles distantes/autres bases/protocoles/paramètres refusés avant lancement de psql; URL sensible absente des erreurs; variables libpq de routage non transmises. Le psql de ces tests est un exécutable factice qui ne se connecte à aucune base.

Aucun PostgreSQL ni Docker ajouté à la Devbox. `psql` est absent. Aucun test SQL réel n'a été exécuté localement : application et réexécution de 028/029, assertions, concurrence et nettoyage réel restent à confirmer dans GitHub Actions. Aucun accès Supabase, migration distante, déploiement, push ou création de PR effectué.

## Limites et risques résiduels

- Ce harnais valide 028/029 sur une fixture synthétique, pas la reconstruction intégrale de l'historique. Les préfixes 017, 018 et 022 sont dupliqués dans les anciennes migrations. Ils n'affectent pas l'ordre explicite du test; un outil appliquant tout l'historique doit résoudre séparément leur ordre et leur identité. Aucun renommage historique entrepris.
- Les fonctions XP/statistiques et snapshot des anciennes phases sont simplifiées dans la fixture. L'environnement Supabase complet, les politiques RLS sous de véritables sessions clients et les accès service_role de bout en bout ne sont pas reproduits; les assertions SQL s'exécutent comme postgres.
- La concurrence porte sur deux finalisations du même jeu, pas sur toutes les courses possibles (abandon contre finalisation, joins simultanés ou parties distinctes partageant des comptes).
- Les réexécutions de migration sont testées avant les assertions de chaque phase; le replay après toutes les mutations applicatives et le retour de 029 vers 028 ne sont pas couverts.
- Actions référencées par tags majeurs, image par tag `17`, runner `ubuntu-latest` et client psql installé par apt : versions mineures variables. Le serveur est contrôlé à l'exécution, mais ce n'est pas une chaîne figée par digest/SHA.
- Le nom de base et la boucle locale ne prouvent pas à eux seuls qu'une base est jetable hors CI; ne pointer ce script destructif que vers une instance dédiée. Le workflow fournit cette instance dédiée, sans tunnel.
- Téléchargements npm, image PostgreSQL et apt nécessitent le réseau; aucune base distante n'est nécessaire. Un manque de chevauchement observable ou une contention prolongée provoque un échec explicite.

## Déclenchement exact après autorisation de publication

Les commandes suivantes sont uniquement une procédure, elles n'ont pas été exécutées.

1. Vérifier la branche et les changements avec `git branch --show-current`, `git diff --check`, `git diff` et `git status --short`.
2. Après validation humaine des commits locaux, publier :

   ```bash
   git push -u origin codex/devbox-v2-sql-validation
   gh pr create --base codex/v2-phase-1-guest-mode --head codex/devbox-v2-sql-validation --title "Validate V2 migrations on isolated PostgreSQL 17" --body-file tests/sql/README.md
   ```

3. L'ouverture de la PR déclenche `pull_request` dans `.github/workflows/quality.yml`, sans filtre de branche cible. Un push seul sur la branche de travail sans PR ne déclenche pas ce workflow (push limité à main). Si une PR existe déjà, publier le commit la met à jour et déclenche `synchronize`; ne pas en créer une deuxième.
4. Dans la PR, onglet Checks, attendre `Quality / verify`, puis examiner l'étape `Test V2 PostgreSQL migration` : deux variantes de FK, succès des assertions V2 et invités, quatre scénarios de concurrence et rejet attendu de la partie active orpheline. L'étape doit finir avec code 0, nettoyage compris, puis les deux builds doivent réussir.
5. Pour suivre en CLI : `gh pr checks <NUMERO_PR> --watch`. En cas d'échec d'infrastructure, utiliser Re-run failed jobs dans l'exécution Actions. Aucun `workflow_dispatch` n'est configuré. Une PR peut nécessiter une approbation Actions selon les règles du dépôt; aucun merge ni déploiement nécessaire.
