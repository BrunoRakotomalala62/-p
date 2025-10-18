const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Stockage des IDs de session par utilisateur pour maintenir les conversations continues
const userSessionIds = {};

// URL de base pour l'API Claude
const API_BASE_URL = 'https://rapido.zetsu.xyz/api/anthropic';

// Stockage des images en attente
const pendingImages = {};

// Fonction pour envoyer des messages longs en plusieurs parties si nécessaire
async function sendLongMessage(senderId, message) {
    const MAX_MESSAGE_LENGTH = 2000;

    if (message.length <= MAX_MESSAGE_LENGTH) {
        await sendMessage(senderId, message);
        return;
    }

    let startIndex = 0;

    while (startIndex < message.length) {
        let endIndex = startIndex + MAX_MESSAGE_LENGTH;

        if (endIndex < message.length) {
            const separators = ['. ', ', ', ' ', '! ', '? ', '.\n', ',\n', '!\n', '?\n', '\n\n', '\n'];
            let bestBreakPoint = -1;

            for (const separator of separators) {
                const lastSeparator = message.lastIndexOf(separator, endIndex);
                if (lastSeparator > startIndex && (bestBreakPoint === -1 || lastSeparator > bestBreakPoint)) {
                    bestBreakPoint = lastSeparator + separator.length;
                }
            }

            if (bestBreakPoint !== -1) {
                endIndex = bestBreakPoint;
            }
        } else {
            endIndex = message.length;
        }

        const messagePart = message.substring(startIndex, endIndex);
        await sendMessage(senderId, messagePart);
        await new Promise(resolve => setTimeout(resolve, 1000));

        startIndex = endIndex;
    }
}

module.exports = async (senderId, prompt, api, imageAttachments) => {
    try {
        // Initialiser l'ID de session si ce n'est pas déjà fait
        if (!userSessionIds[senderId]) {
            userSessionIds[senderId] = senderId;
        }

        // Vérifier si nous avons affaire à un attachement image
        if (imageAttachments && imageAttachments.length > 0) {
            pendingImages[senderId] = imageAttachments[0].payload.url;
            await sendMessage(senderId, "✨📸 J'ai bien reçu votre image! Que voulez-vous savoir à propos de cette photo? Posez-moi votre question! 🔍🖼️");
            return { skipCommandCheck: true };
        }

        // Si le prompt est vide
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, "🤖✨ Bonjour! Je suis Cool AI, votre assistant IA. Comment puis-je vous aider aujourd'hui? Posez-moi n'importe quelle question ou partagez une image pour que je puisse l'analyser!");
            return;
        }

        // Envoyer un message d'attente
        await sendMessage(senderId, "✨🧠 Analyse en cours... Cool AI réfléchit à votre requête! ⏳💫");

        let response;

        // Vérifier si nous avons une image en attente pour cet utilisateur
        if (pendingImages[senderId]) {
            const imageUrl = pendingImages[senderId];

            // Construire l'URL de l'API avec l'image
            const apiUrl = `${API_BASE_URL}?q=${encodeURIComponent(prompt)}&uid=${userSessionIds[senderId]}&model=claude-3-7-sonnet-20250219&image=${encodeURIComponent(imageUrl)}`;

            console.log('API URL avec image:', apiUrl);

            // Appel à l'API avec l'image
            const apiResponse = await axios.get(apiUrl);
            response = apiResponse.data;
        } else {
            // Appel à l'API sans image (texte seulement)
            const apiUrl = `${API_BASE_URL}?q=${encodeURIComponent(prompt)}&uid=${userSessionIds[senderId]}&model=claude-3-7-sonnet-20250219`;

            console.log('API URL sans image:', apiUrl);

            // Appel à l'API
            const apiResponse = await axios.get(apiUrl);
            response = apiResponse.data;
        }

        // Récupérer la réponse de l'API
        let reply;
        if (response.response) {
            reply = response.response;
        } else if (response.content) {
            reply = response.content;
        } else if (response.message) {
            reply = response.message;
        } else if (response.text) {
            reply = response.text;
        } else if (typeof response === 'string') {
            reply = response;
        } else {
            const keys = Object.keys(response);
            reply = keys.length > 0 ? response[keys[0]] : 'Réponse vide reçue de l\'API';
        }

        console.log('Réponse extraite:', reply);

        // Créer une réponse formatée
        const formattedReply = `
✅COOL AI MADAGASCAR🇲🇬
━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 *Votre question:* 
${prompt}

✨ *Réponse:* 
${reply}
━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 Powered by 👉@Bruno | Cool AI
`;

        // Envoyer la réponse formatée
        await sendLongMessage(senderId, formattedReply);

    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Cool AI:", error);

        await sendMessage(senderId, `
⚠️ *OUPS! ERREUR TECHNIQUE* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors de la communication avec Cool AI.
Veuillez réessayer dans quelques instants.

🔄 Si le problème persiste, essayez une autre commande
ou contactez l'administrateur.
━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    }

    return { skipCommandCheck: true };
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "cool",
    description: "Discutez avec Cool AI, une IA avancée capable d'analyser du texte et des images.",
    usage: "Envoyez 'cool <question>' pour discuter avec Cool AI, ou envoyez une image suivie de questions à son sujet."
};