
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Stockage des images en attente par utilisateur
const pendingImages = {};

// Stockage de l'historique de conversation par utilisateur
const conversationHistory = {};

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
        const API_ENDPOINT_IMAGE = "https://gemimagprompt.vercel.app/";
        const API_ENDPOINT_TEXT = "https://gemimagprompt.vercel.app/";

        // Initialiser l'historique de conversation si nécessaire
        if (!conversationHistory[senderId]) {
            conversationHistory[senderId] = {
                messages: [],
                hasImage: false,
                imageUrl: null
            };
        }

        // Vérifier si nous avons affaire à un attachement image
        if (imageAttachments && imageAttachments.length > 0) {
            // Stocker l'URL de l'image pour cet utilisateur
            const imageUrl = imageAttachments[0].payload.url;
            pendingImages[senderId] = imageUrl;
            conversationHistory[senderId].hasImage = true;
            conversationHistory[senderId].imageUrl = imageUrl;

            // Envoyer un message confirmant la réception de l'image
            await sendMessage(senderId, "✨📸 J'ai bien reçu votre image! Que voulez-vous savoir à propos de cette photo? Posez-moi votre question! 🔍🖼️");
            return { skipCommandCheck: true };
        }

        // Si l'utilisateur veut effacer la conversation
        if (prompt && prompt.toLowerCase() === 'clear') {
            delete conversationHistory[senderId];
            delete pendingImages[senderId];
            await sendMessage(senderId, "🔄 Conversation réinitialisée avec succès!");
            return;
        }

        // Si le prompt est vide et qu'il n'y a pas d'image
        if ((!prompt || prompt.trim() === '') && !pendingImages[senderId] && !conversationHistory[senderId].hasImage) {
            await sendMessage(senderId, "🤖✨ Bonjour! Je suis Cool AI. Comment puis-je vous aider aujourd'hui? Posez-moi n'importe quelle question ou partagez une image pour que je puisse l'analyser!");
            return;
        }

        // Envoyer un message d'attente
        await sendMessage(senderId, "✨🧠 Analyse en cours... Cool AI réfléchit à votre requête! ⏳💫");

        let response;
        let imageUrl = pendingImages[senderId] || conversationHistory[senderId].imageUrl || null;

        // Si l'utilisateur a une image (actuelle ou précédente dans l'historique)
        if (imageUrl) {
            // Construire les paramètres de la requête avec image
            const queryParams = new URLSearchParams({
                question: prompt || "Décrivez cette photo",
                image: imageUrl,
                uid: senderId
            });

            const fullUrl = `${API_ENDPOINT_IMAGE}?${queryParams.toString()}`;
            
            console.log('=== COOL AI DEBUG IMAGE ===');
            console.log('Image URL:', imageUrl);
            console.log('Question:', prompt);
            console.log('API URL:', fullUrl);
            
            const apiResponse = await axios.get(fullUrl);
            response = apiResponse.data;

            // Ajouter à l'historique
            conversationHistory[senderId].messages.push({
                role: 'user',
                content: prompt,
                hasImage: true,
                imageUrl: imageUrl
            });
            conversationHistory[senderId].messages.push({
                role: 'assistant',
                content: response
            });

        } else {
            // Requête texte simple sans image
            const queryParams = new URLSearchParams({
                question: prompt,
                uid: senderId
            });

            const fullUrl = `${API_ENDPOINT_TEXT}?${queryParams.toString()}`;
            const apiResponse = await axios.get(fullUrl);
            response = apiResponse.data;

            // Ajouter à l'historique
            conversationHistory[senderId].messages.push({
                role: 'user',
                content: prompt
            });
            conversationHistory[senderId].messages.push({
                role: 'assistant',
                content: response
            });
        }

        if (!response) {
            await sendMessage(senderId, "⚠️ Aucune réponse reçue de l'API.");
            return;
        }

        // Formater la réponse
        const formattedResponse = `
✅COOL AI MADAGASCAR🇲🇬
━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 *Votre question:* 
${prompt || "Analyse de l'image"}

✨ *Réponse:* 
${response}
━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 Powered by 👉@Bruno | Cool AI
`;

        // Envoyer la réponse formatée
        await sendLongMessage(senderId, formattedResponse);

        // Ne pas supprimer l'image de l'historique pour permettre les questions de suivi
        // Mais supprimer de pendingImages pour éviter la confusion
        if (pendingImages[senderId]) {
            delete pendingImages[senderId];
        }

    } catch (error) {
        console.error("❌ Erreur Cool AI:", error?.response?.data || error.message || error);
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
    description: "Discutez avec Cool AI, une IA avancée capable d'analyser du texte et des images avec conversation continue.",
    usage: "Envoyez 'cool <question>' pour discuter avec Cool AI, ou envoyez une image suivie de questions à son sujet. Les questions suivantes se souviendront de l'image précédente. Utilisez 'cool clear' pour réinitialiser la conversation."
};
