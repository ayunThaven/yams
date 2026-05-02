# ============================================================
# 1) PHASE BUILDER : Next.js + server.ts
# ============================================================

FROM node:20 AS builder

# ✅ Injection des variables build-time pour Next.js
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG SUPABASE_URL
ARG SUPABASE_SERVICE_ROLE_KEY

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV SUPABASE_URL=$SUPABASE_URL
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY

WORKDIR /app

COPY package*.json ./
RUN npm ci

# ✅ Copie du projet
COPY . .

# ✅ Build Next.js
RUN npm run build

# ✅ Build server.ts → dist/server.js
RUN npm run build:server


# ============================================================
# 2) PHASE RUNNER : Exécution prod
# ============================================================

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# ✅ Copie du build frontend
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# ✅ Copie du build serveur custom
COPY --from=builder /app/dist ./dist

# ✅ Copie node_modules optimisés
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 3000

# ✅ Lancement de ton serveur custom
CMD ["node", "dist/server.js"]
