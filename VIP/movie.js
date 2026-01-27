const axios = require('axios');

module.exports = {
  name: "movie",
  description: "Recherche et téléchargement de vidéos",
  async execute(api, event, args) {
    const { threadID, messageID, senderID } = event;
    const query = args.join(" ");

    if (!query) {
      return api.sendMessage("Veuillez entrer le nom d'un film ou d'une vidéo.", threadID, messageID);
    }

    // Gestion de la pagination (si spécifiée comme dernier argument)
    let page = 1;
    if (args.length > 1 && !isNaN(args[args.length - 1])) {
      page = args.pop();
    }

    // Si l'argument est un nombre seul, on traite comme une demande de téléchargement (simplification pour l'exemple)
    // Dans un vrai bot, on stockerait les résultats de recherche dans une variable globale ou cache
    if (!isNaN(query) && args.length === 1) {
      const index = parseInt(query);
      // Note: Normalement on récupère l'ID du film depuis le cache des résultats précédents
      return api.sendMessage(`Préparation du téléchargement pour le résultat numéro ${index}...`, threadID, messageID);
    }

    try {
      api.sendMessage(`Recherche de "${query}" (Page ${page})...`, threadID, messageID);
      
      const searchUrl = `https://movie--ngz1zcaz.replit.app/recherche?video=${encodeURIComponent(query)}&page=${page}`;
      const response = await axios.get(searchUrl);
      const results = response.data.results || response.data; // Adapter selon la structure réelle de l'API

      if (!results || results.length === 0) {
        return api.sendMessage("Aucun résultat trouvé.", threadID, messageID);
      }

      let message = `Résultats pour "${query}" (Page ${page}):\n\n`;
      const attachments = [];

      for (let i = 0; i < Math.min(results.length, 15); i++) {
        const item = results[i];
        message += `${i + 1}. ${item.title || "Sans titre"}\n`;
        
        if (item.image) {
          try {
            const imageStream = await axios.get(item.image, { responseType: 'stream' });
            attachments.push(imageStream.data);
          } catch (e) {
            console.error("Erreur chargement image:", e);
          }
        }
      }

      message += "\nRépondez avec le numéro pour télécharger.";
      
      api.sendMessage({
        body: message,
        attachment: attachments
      }, threadID, messageID);

    } catch (error) {
      console.error(error);
      api.sendMessage("Une erreur est survenue lors de la recherche.", threadID, messageID);
    }
  }
};
