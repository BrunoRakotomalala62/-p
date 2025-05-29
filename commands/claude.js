
const axios = require('axios');
const { sendMessage, sendLongMessage } = require('../handles/sendMessage');

// Nouvelle URL de l'API
const API_BASE_URL = 'https://zaikyoov3-up.up.railway.app/api/anthropic-claude-3-opus';

// Stockage des sessions utilisateur
const userSessionIds = {};

module.exports = async (senderId, prompt, imageUrl = null) => {
    try {
        // S'assurer que l'utilisateur a un ID de session
        if (!userSessionIds[senderId]) {
            userSessionIds[senderId] = senderId;
        }

        let response;
        
        if (imageUrl) {
            // Appel à l'API avec l'image
            const apiUrl = `${API_BASE_URL}?prompt=${encodeURIComponent(prompt)}&uid=${userSessionIds[senderId]}&imgs=${encodeURIComponent(imageUrl)}`;
            response = await axios.get(apiUrl);
        } else {
            // Appel à l'API sans image (texte seulement)
            const apiUrl = `${API_BASE_URL}?prompt=${encodeURIComponent(prompt)}&uid=${userSessionIds[senderId]}`;
            response = await axios.get(apiUrl);
        }

        // Récupérer la réponse de l'API avec le nouveau format JSON
        const { response: reply, author } = response.data;

        // Créer une réponse formatée et stylisée
        const formattedReply = `
✅ Claude Opus AI 🤖
━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 *Votre question:* 
${prompt}

✨ *Réponse:* 
${reply}
━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 Powered by 👉@Bruno | Claude Opus
`;

        // Envoyer la réponse formatée en utilisant la nouvelle fonction
        await sendLongMessage(senderId, formattedReply);

        // Si c'était une demande liée à une image, on peut maintenant la conserver
        // pour les futures questions mais on ne la mentionne plus dans les messages

    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Claude Opus:", error);

        // Message d'erreur stylisé
        await sendMessage(senderId, `
⚠️ *OUPS! ERREUR TECHNIQUE* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors de la communication avec Claude.
Veuillez réessayer dans quelques instants.

🔄 Si le problème persiste, essayez une autre commande
ou contactez l'administrateur.
━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    }
    
    return { skipCommandCheck: true };
};
