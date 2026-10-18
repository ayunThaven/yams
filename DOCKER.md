# Validation Docker isolée

Le job `docker` de Quality lance `bash scripts/validate-docker.sh` sur un runner
GitHub Actions éphémère. Il ne publie aucune image et ne déploie rien. Il ne lit
aucun secret GitHub ni fichier d'environnement local. Aucun service Compose,
volume existant ou port de l'hôte n'est utilisé.

Le script nécessite Docker et Git. Son contexte temporaire contient uniquement
les fichiers suivis par Git (avec leur contenu courant). Les changements de
nouveaux fichiers doivent donc être ajoutés à l'index avant une exécution locale.
Deux fichiers `.env.validation` factices, dont un imbriqué, vérifient les exclusions.
Le contexte temporaire, les images de validation et le conteneur sont nettoyés
à la sortie. Le cache de build Docker reste disponible.

## Contrôles automatisés

- Construction réelle des stages builder et runner pour `linux/amd64`.
- Node `24.22.0`, architecture x64 et glibc dans les deux stages.
- Chargement des modules natifs Sharp et SWC GNU dans les deux stages.
- Absence de fichiers `.env*` et de la valeur témoin dans `/app`, dans les deux
  stages ; présence des artefacts nécessaires et absence des sources racines
  inutiles dans l'image finale.
- Démarrage du vrai serveur avec `--network none`, sans montage ni port publié.
  Seul `/api/health` est interrogé depuis le conteneur, pendant au plus 60 secondes.

Les seules valeurs de compilation sont `http://127.0.0.1:9` et
`public-docker-validation-only`. Au démarrage, la même clé factice remplit le
champ service role ; aucun secret Supabase, JWT ou Brevo n'est fourni.
La restauration initiale des parties échoue sur le port loopback fermé et le
serveur intercepte cet échec. Ce comportement est attendu. Le test ne vérifie
ni authentification, ni persistance, ni courriels, ni interactions Supabase.

## Choix et limites

Builder et runner utilisent tous deux `node:24.22.0-bookworm-slim` afin de conserver
la même libc : copier les modules natifs Debian/glibc vers Alpine/musl rendait
leur chargement incertain. Les dépendances applicatives ne sont pas modifiées.
Le runner conserve actuellement l'ensemble de `node_modules`, y compris les
outils de développement, ainsi que `.next` ; une réduction d'image est hors de
cette validation.

Le contrôle des fichiers et le contexte suivi par Git réduisent les risques de
fuite, mais ne constituent pas une détection exhaustive des secrets qui auraient
été codés en dur dans des sources suivies. Ne jamais ajouter de secrets au dépôt
ni fournir de variables de production au build. Les valeurs publiques compilées
restent celles du test ; cette image de validation ne doit pas être déployée.
Les tags de base ne sont pas figés par digest et les téléchargements npm/Docker
nécessitent le réseau pendant le build. Seule l'exécution du conteneur est privée
de réseau. ARM64 n'est pas testé.

Aucune commande ne lance `docker-start.sh`, `docker compose up`, migration,
push d'image ou déploiement. L'exécution locale sans Docker ne permet pas de
conclure à un build réussi : attendre le résultat du job GitHub Actions.
