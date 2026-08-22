#!/bin/bash

# Script de démarrage rapide pour Docker
# Usage: ./docker-start.sh

echo "🎲 Démarrage de YAMS avec Docker..."
echo ""

# Vérifier si Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Erreur: Docker n'est pas installé"
    echo "Installez Docker depuis: https://docs.docker.com/get-docker/"
    exit 1
fi

# Vérifier si Docker Compose est disponible
if ! docker compose version &> /dev/null; then
    echo "❌ Erreur: Docker Compose n'est pas installé"
    echo "Installez Docker Compose depuis: https://docs.docker.com/compose/install/"
    exit 1
fi

# Vérifier si le fichier .env existe
if [ ! -f .env ]; then
    echo "⚠️  Attention: Fichier .env manquant"
    echo ""
    echo "Créez un fichier .env à partir du template:"
    echo "  cp env.template .env"
    echo ""
    echo "Puis remplissez les valeurs Supabase dans le fichier .env"
    exit 1
fi

# Arrêter les anciens conteneurs si nécessaire
echo "🧹 Nettoyage des anciens conteneurs..."
docker compose down 2>/dev/null

# Construire et démarrer
echo ""
echo "🔨 Construction de l'image Docker..."
docker compose build --no-cache

echo ""
echo "🚀 Démarrage de l'application..."
docker compose up -d

# Attendre que l'application démarre
echo ""
echo "⏳ Attente du démarrage de l'application..."
sleep 5

# Vérifier l'état
if docker compose ps | grep -q "Up"; then
    echo ""
    echo "✅ Application démarrée avec succès!"
    echo ""
    echo "📍 Accédez à l'application: http://localhost:3000"
    echo ""
    echo "📋 Commandes utiles:"
    echo "  - Voir les logs:        docker compose logs -f"
    echo "  - Arrêter l'app:        docker compose down"
    echo "  - Redémarrer:           docker compose restart"
    echo "  - Reconstruire:         docker compose up -d --build"
    echo ""
else
    echo ""
    echo "❌ Erreur lors du démarrage"
    echo "Vérifiez les logs: docker compose logs"
    exit 1
fi

