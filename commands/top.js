
const axios = require('axios');

module.exports = {
  config: {
    name: "top",
    version: "1.0.0",
    permission: 0,
    credits: "Claude Bot",
    description: "Analyse des images avec Claude AI",
    prefix: true,
    category: "AI",
    usages: "top [question sur l'image]",
    cooldowns: 5,
  },

  languages: {
    "fr": {
      "noImage": "Veuillez envoyer une image en pièce jointe.",
      "imageReceived": "J'ai bien reçu l'image, posez vos questions alors",
      "noQuestion": "Veuillez poser une question sur l'image.",
      "error": "Erreur lors de l'analyse de l'image."
    }
  },

  onStart: async function({ api, message, event, args, getLang }) {
    const { threadID, messageID, messageReply } = event;

    try {
      // Cas 1: L'utilisateur envoie une image avec la commande "top"
      if (event.attachments && event.attachments.length > 0) {
        const attachment = event.attachments[0];
        
        if (attachment.type === "photo") {
          // Stocker l'URL de l'image pour usage futur (optionnel)
          global.lastImageUrl = attachment.url;
          return api.sendMessage(getLang("imageReceived"), threadID, messageID);
        }
      }

      // Cas 2: L'utilisateur répond à un message contenant une image avec une question
      if (event.messageReply && event.messageReply.attachments && event.messageReply.attachments.length > 0) {
        const attachment = event.messageReply.attachments[0];
        
        if (attachment.type === "photo" && args.length > 0) {
          const imageUrl = attachment.url;
          const question = args.join(" ");
          
          // Construire l'URL de l'API
          const apiUrl = `https://rapido.zetsu.xyz/api/anthropic?q=${encodeURIComponent(question)}&uid=123&model=claude-sonnet-4-20250514&image=${encodeURIComponent(imageUrl)}&system=&max_token=3000`;

          // Appeler l'API
          const response = await axios.get(apiUrl);
          
          if (response.data && response.data.response) {
            const claudeResponse = response.data.response;
            
            // Formater la réponse avec l'en-tête
            const formattedResponse = `😍 CLAUDE BOT🤖\n\n${claudeResponse}`;
            
            return api.sendMessage(formattedResponse, threadID, messageID);
          } else {
            return api.sendMessage(getLang("error"), threadID, messageID);
          }
        }
      }

      // Cas 3: L'utilisateur pose une question mais il n'y a pas d'image dans le message répondu
      if (args.length > 0 && (!event.messageReply || !event.messageReply.attachments || event.messageReply.attachments.length === 0)) {
        // Utiliser l'image stockée globalement si disponible
        if (global.lastImageUrl) {
          const question = args.join(" ");
          const apiUrl = `https://rapido.zetsu.xyz/api/anthropic?q=${encodeURIComponent(question)}&uid=123&model=claude-sonnet-4-20250514&image=${encodeURIComponent(global.lastImageUrl)}&system=&max_token=3000`;

          const response = await axios.get(apiUrl);
          
          if (response.data && response.data.response) {
            const claudeResponse = response.data.response;
            const formattedResponse = `😍 CLAUDE BOT🤖\n\n${claudeResponse}`;
            
            // Effacer l'image stockée après utilisation
            delete global.lastImageUrl;
            
            return api.sendMessage(formattedResponse, threadID, messageID);
          } else {
            return api.sendMessage(getLang("error"), threadID, messageID);
          }
        } else {
          return api.sendMessage(getLang("noImage"), threadID, messageID);
        }
      }

      // Cas par défaut
      return api.sendMessage(getLang("noImage"), threadID, messageID);

    } catch (error) {
      console.error("Erreur dans la commande top:", error);
      return api.sendMessage(getLang("error"), threadID, messageID);
    }
  }
};
