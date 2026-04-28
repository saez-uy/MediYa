# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# Railway pasa las variables de entorno como build args
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ---- Serve stage ---- cache-bust:1
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY server.mjs .

EXPOSE 3000
CMD ["node", "server.mjs"]
