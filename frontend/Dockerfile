FROM node:20-alpine AS base

WORKDIR /app

COPY package.json ./
# Sin package-lock.json en la imagen: el lock local (gitignored) puede referenciar
# paquetes con auth (@tailwindplus/elements) y provocar E401 en el build.
ENV NPM_CONFIG_USERCONFIG=/tmp/empty-npmrc
RUN touch /tmp/empty-npmrc && npm install --registry=https://registry.npmjs.org/

COPY . .

# --- Development (vite dev server) ---
FROM base AS development
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# --- Build for production ---
FROM base AS build
RUN npm run build

# --- Production (nginx) ---
FROM nginx:alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
