# 🎲 Yams

Application web multijoueur permettant de jouer au **Yams en temps réel** directement depuis un navigateur.

Le projet repose sur **Next.js**, **React**, **Socket.IO** et **Supabase**, avec une gestion complète des comptes utilisateurs, des parties, des statistiques, de la progression et des succès.

🌐 **Application en production : https://yams-en-ligne.fr/**

---

## ✨ Fonctionnalités

### 🎮 Parties multijoueur

* Création de parties privées.
* Rejoindre une partie à l'aide de son identifiant.
* Salon d'attente avant le lancement.
* Configuration du nombre maximum de joueurs.
* Jeu synchronisé en temps réel avec **Socket.IO**.
* Gestion des tours et des lancers de dés.
* Conservation individuelle des dés entre les lancers.
* Feuille de score synchronisée entre les joueurs.
* Classement final en fin de partie.
* Gestion de l'abandon.
* Gestion des déconnexions et reconnexions.
* Restauration de l'état d'une partie après reconnexion.

> Les parties sont actuellement **uniquement privées**.
> La gestion de parties publiques est prévue dans une future version.

---

## 🎲 Modes de jeu

Trois variantes sont disponibles.

### Classique

Le joueur choisit librement la catégorie dans laquelle enregistrer son score.

### Descendante

La feuille doit être remplie dans l'ordre, du haut vers le bas.

### Montante

La feuille doit être remplie dans l'ordre inverse, du bas vers le haut.

---

## 👤 Comptes utilisateurs

L'application dispose de son propre système d'authentification :

* création de compte ;
* confirmation de compte ;
* connexion ;
* déconnexion ;
* réinitialisation du mot de passe ;
* authentification JWT ;
* cookie de session `HTTP-only` pour les requêtes HTTP ;
* authentification spécifique lors du handshake Socket.IO ;
* limitation des tentatives sur les routes sensibles.

Les emails de confirmation et de réinitialisation sont envoyés via **Brevo**.

---

## 🏆 Progression

Chaque joueur dispose d'un profil comprenant notamment :

* son niveau ;
* son expérience ;
* sa progression vers le niveau suivant ;
* ses statistiques ;
* son historique de parties ;
* ses succès débloqués.

Les résultats des parties sont enregistrés côté serveur afin d'éviter que le client puisse directement modifier ses statistiques.

---

## 🏅 Succès

Yams intègre un système de succès avec plusieurs niveaux de rareté :

* 🥉 Bronze
* 🥈 Argent
* 🥇 Or
* 💎 Cristal

Les succès peuvent être liés, entre autres :

* au nombre de parties jouées ;
* aux victoires ;
* aux séries de victoires ;
* aux scores réalisés ;
* aux Yams obtenus ;
* aux variantes de jeu ;
* au niveau du joueur ;
* à certaines actions spécifiques.

Les nouveaux succès peuvent être signalés directement pendant ou à la fin d'une partie.

---

## 📊 Classement et statistiques

Un classement global permet de comparer les joueurs selon leurs performances.

L'application conserve également un historique détaillé des parties et des résultats obtenus.

---

## 🛡️ Architecture serveur

Une partie importante de la logique est gérée côté serveur :

* validation des actions de jeu ;
* gestion des salons ;
* gestion des tours ;
* gestion des timers ;
* finalisation des parties ;
* calcul des résultats ;
* mise à jour des statistiques ;
* vérification des succès ;
* gestion des déconnexions ;
* sauvegarde et restauration de l'état des parties.

Les résultats d'une partie sont enregistrés de manière idempotente afin d'éviter une double comptabilisation.

---

## 🧱 Stack technique

### Front-end

* **Next.js 15**
* **React 19**
* **TypeScript**
* **Tailwind CSS**
* **DaisyUI**

### Temps réel

* **Socket.IO**
* Serveur Node.js personnalisé

### Back-end et données

* **Next.js API Routes**
* **Supabase**
* **PostgreSQL**
* **JWT**
* **bcrypt**

### Emails

* **Brevo API**
* **MJML**

### Déploiement et qualité

* **Docker**
* **Docker Compose**
* **ESLint**
* **Node Test Runner**
* **GitHub Actions**

---

## 🚀 Installation locale

### Prérequis

Vous devez disposer au minimum de :

* Node.js
* npm
* un projet Supabase

Clonez ensuite le dépôt :

```bash
git clone https://github.com/ayunThaven/yams.git
cd yams
```

Installez les dépendances :

```bash
npm ci
```

---

## ⚙️ Configuration

Copiez le fichier de configuration :

```bash
cp env.template .env.local
```

Puis renseignez les variables nécessaires.

### Supabase

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### Authentification

```env
AUTH_JWT_SECRET=
AUTH_COOKIE_SECURE=false
```

`AUTH_COOKIE_SECURE` doit être :

* `false` en développement HTTP ;
* `true` en production HTTPS.

### Brevo

```env
BREVO_API_KEY=
BREVO_FROM_EMAIL=
```

`BREVO_API_KEY` correspond à la clé API utilisée pour envoyer les emails via Brevo.

`BREVO_FROM_EMAIL` doit correspondre à une adresse d'expédition autorisée dans votre compte Brevo.

Si `BREVO_API_KEY` n'est pas configurée, les emails ne sont pas envoyés.

### Serveur

```env
PORT=3000
NODE_ENV=development
```

### URL de l'application

```env
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

En production :

```env
NEXT_PUBLIC_BASE_URL=https://yams-en-ligne.fr
```

---

## 🗄️ Base de données

Le projet utilise **Supabase / PostgreSQL**.

Les migrations sont disponibles dans :

```text
supabase/migrations/
```

Elles permettent notamment de créer et maintenir :

* les utilisateurs ;
* les parties ;
* les scores ;
* les statistiques ;
* le système d'XP et de niveaux ;
* les succès ;
* les succès débloqués ;
* les résultats individuels des parties ;
* les snapshots nécessaires à la restauration des parties.

Appliquez les migrations dans leur ordre avant de lancer l'application sur une nouvelle base.

---

## 💻 Lancer l'application

### Développement

```bash
npm run dev
```

L'application est disponible par défaut sur :

```text
http://localhost:3000
```

Le serveur de développement lance à la fois Next.js et le serveur Socket.IO personnalisé.

---

## 📦 Build de production

Construisez l'application Next.js :

```bash
npm run build
```

Puis le serveur Node.js :

```bash
npm run build:server
```

Lancez ensuite le serveur :

```bash
npm start
```

---

## 🐳 Docker

Le projet peut également être lancé avec Docker Compose :

```bash
docker compose up -d --build
```

Pour arrêter les conteneurs :

```bash
docker compose down
```

---

## 🧪 Vérifications

### TypeScript

```bash
npm run typecheck
```

### ESLint

```bash
npm run lint
```

### Tests

```bash
npm run test
```

### Toutes les vérifications

```bash
npm run check
```

Cette commande exécute successivement :

```text
typecheck → lint → test
```

Les tests couvrent notamment :

* les règles du Yams ;
* les variantes de jeu ;
* la validation des données ;
* les règles de déblocage des succès.

---

## 📁 Structure du projet

```text
.
├── public/
│   ├── images/
│   │   └── achievements/
│   └── sounds/
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   ├── dashboard/
│   │   ├── game/
│   │   ├── leaderboard/
│   │   ├── login/
│   │   ├── register/
│   │   └── reset-password/
│   │
│   ├── components/
│   │   ├── auth/
│   │   └── game/
│   │
│   ├── contexts/
│   ├── hooks/
│   ├── lib/
│   ├── server/
│   └── types/
│
├── supabase/
│   └── migrations/
│
├── tests/
│
├── server.ts
├── Dockerfile
└── docker-compose.yml
```

---

## 🌐 Production

La version publique de l'application est disponible à l'adresse :

### 👉 https://yams-en-ligne.fr/

---

## 🔭 Roadmap

Quelques évolutions envisagées pour les prochaines versions :

* parties publiques
* découverte des parties disponibles
* amélioration de l'expérience multijoueur
* amélioration UI
* nouveaux succès
* nouvelles fonctionnalités autour du profil et de la progression
* et plus encore !s

---

## 📄 Licence

Copyright © 2026 Brian VERCHERE. **Tous droits réservés.**

Le code source de ce dépôt est rendu public uniquement à des fins de consultation et de démonstration.

Sauf autorisation écrite préalable du titulaire des droits, il est interdit de :

* copier ou reproduire tout ou partie du code source ;
* modifier ou créer une œuvre dérivée à partir du code ;
* redistribuer ou republier le code ;
* intégrer tout ou partie du code dans un autre projet ;
* utiliser le code à des fins commerciales ou non commerciales ;
* sous-licencier ou vendre tout ou partie du projet.

La disponibilité publique de ce dépôt GitHub **ne constitue pas une licence open source** et n'accorde aucun droit d'utilisation au-delà de ceux strictement nécessaires à sa consultation via GitHub.

Voir le fichier [`LICENSE`](./LICENSE) pour plus d'informations.
