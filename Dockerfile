# Utiliser une image Node.js avec les dépendances pour Puppeteer
FROM ghcr.io/puppeteer/puppeteer:latest

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers package.json et package-lock.json
COPY package*.json ./

# Passer en utilisateur root pour l'installation si nécessaire, puis revenir à l'utilisateur puppeteer
USER root
RUN npm install

# Copier le reste du code
COPY . .

# Donner les permissions appropriées
RUN chown -R pptruser:pptruser /app

# Utiliser l'utilisateur non-root de l'image puppeteer
USER pptruser

# Exposer le port (Render utilise la variable d'environnement PORT)
EXPOSE 5000

# Commande de démarrage
CMD ["node", "index.js"]
