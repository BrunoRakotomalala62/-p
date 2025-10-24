
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// URL de base pour l'API GPT-4.1
const API_BASE_URL = 'https://miko-utilis.vercel.app/api/gpt-4.1';

module.exports = async (senderId, prompt) => {
    try {
        // Si le prompt est vide
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, "🇲🇬 Bonjour! Je peux générer des histoires en malgache. Demandez-moi par exemple: 'milaza angano iray' ou posez votre question en malgache!");
            return;
        }

        // Envoyer un message d'attente
        await sendMessage(senderId, "⏳ Création d'une histoire en malgache...");

        // Construire l'URL de l'API
        const apiUrl = `${API_BASE_URL}?query=${encodeURIComponent(prompt)}&userId=${senderId}`;
        
        // Appel à l'API
        const response = await axios.get(apiUrl);
        
        // Vérifier si la réponse est valide
        if (response.data && response.data.data && response.data.data.response) {
            const reply = response.data.data.response;
            
            // Formater la réponse
            const formattedReply = `🇲🇬✅ FITIAVANA MLG ✅🇲🇬

${reply}`;

            // Envoyer la réponse
            await sendMessage(senderId, formattedReply);
        } else {
            await sendMessage(senderId, "❌ Aucune réponse reçue de l'API. Veuillez réessayer.");
        }

    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Malagasy:", error);
        
        // Message d'erreur
        await sendMessage(senderId, `
⚠️ *ERREUR TECHNIQUE* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors de la génération de l'histoire.
Veuillez réessayer dans quelques instants.

🔄 Si le problème persiste, contactez l'administrateur.
━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "malagasy",
    description: "Génère des histoires et répond à vos questions en malgache avec GPT-4.1.",
    usage: "Envoyez 'malagasy <votre question en malgache>' par exemple: 'malagasy milaza angano iray'"
};
