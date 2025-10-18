
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

// Fonction pour traiter les messages texte
async function handleTextMessage(senderId, message) {
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

        // Si l'utilisateur veut effacer la conversation
        if (message && message.toLowerCase() === 'clear') {
            delete conversationHistory[senderId];
            delete pendingImages[senderId];
            await sendMessage(senderId, "🔄 Conversation réinitialisée avec succès!");
            return;
        }

        // Si le message est vide et qu'il n'y a pas d'image
        if ((!message || message.trim() === '') && !pendingImages[senderId] && !conversationHistory[senderId].hasImage) {
            await sendMessage(senderId, "🤖✨ Bonjour! Je suis ✨AMPINGA AI🌟. Comment puis-je vous aider aujourd'hui? Posez-moi n'importe quelle question ou partagez une image pour que je puisse l'analyser!");
            return;
        }

        // Envoyer un message d'attente
        await sendMessage(senderId, "✨🧠 Analyse en cours... AMPINGA AI réfléchit à votre requête! ⏳💫");

        let response;
        let imageUrl = pendingImages[senderId] || conversationHistory[senderId].imageUrl || null;

        // Si l'utilisateur a une image (actuelle ou précédente dans l'historique)
        if (imageUrl) {
            // Construire les paramètres de la requête avec image
            const queryParams = new URLSearchParams({
                question: message || "Décrivez cette photo",
                image: imageUrl,
                uid: senderId
            });

            const fullUrl = `${API_ENDPOINT_IMAGE}?${queryParams.toString()}`;
            
            console.log('=== AMPINGA AI DEBUG IMAGE ===');
            console.log('Image URL:', imageUrl);
            console.log('Question:', message);
            console.log('API URL:', fullUrl);
            
            const apiResponse = await axios.get(fullUrl);
            response = apiResponse.data;

            // Ajouter à l'historique
            conversationHistory[senderId].messages.push({
                role: 'user',
                content: message,
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
                question: message,
                uid: senderId
            });

            const fullUrl = `${API_ENDPOINT_TEXT}?${queryParams.toString()}`;
            const apiResponse = await axios.get(fullUrl);
            response = apiResponse.data;

            // Ajouter à l'historique
            conversationHistory[senderId].messages.push({
                role: 'user',
                content: message
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
✅AMPINGA D'OR AI MADAGASCAR🇲🇬
━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 *Votre question:* 
${message || "Analyse de l'image"}

✨ *Réponse:* 
${response}
━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 Powered by 👉@Bruno | Ampinga AI
`;

        // Envoyer la réponse formatée
        await sendLongMessage(senderId, formattedResponse);

        // Ne pas supprimer l'image de l'historique pour permettre les questions de suivi
        // Mais supprimer de pendingImages pour éviter la confusion
        if (pendingImages[senderId]) {
            delete pendingImages[senderId];
        }

    } catch (error) {
        console.error("❌ Erreur AMPINGA AI:", error?.response?.data || error.message || error);
        await sendMessage(senderId, `
⚠️ *OUPS! ERREUR TECHNIQUE* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors de la communication avec AMPINGA AI.
Veuillez réessayer dans quelques instants.

🔄 Si le problème persiste, essayez une autre commande
ou contactez l'administrateur.
━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    }
}

// Fonction pour traiter les images
async function handleImageMessage(senderId, imageUrl) {
    try {
        const API_ENDPOINT_IMAGE = "https://gemimagprompt.vercel.app/";

        // Stocker l'URL de l'image pour cet utilisateur
        if (!pendingImages[senderId]) {
            pendingImages[senderId] = imageUrl;
        } else {
            pendingImages[senderId] = imageUrl;
        }

        if (!conversationHistory[senderId]) {
            conversationHistory[senderId] = {
                messages: [],
                hasImage: false,
                imageUrl: null
            };
        }
        
        conversationHistory[senderId].hasImage = true;
        conversationHistory[senderId].imageUrl = imageUrl;

        // Envoyer un message confirmant la réception de l'image
        await sendMessage(senderId, "✨📸 J'ai bien reçu votre image! Que voulez-vous savoir à propos de cette photo? Posez-moi votre question! 🔍🖼️");
        
    } catch (error) {
        console.error('Erreur lors du traitement de l\'image :', error.response ? error.response.data : error.message);
        await sendMessage(senderId, "✨📸 J'ai bien reçu votre image! Que voulez-vous savoir à propos de cette photo? Posez-moi votre question! 🔍🖼️");
    }
}

module.exports = {
    handleTextMessage,
    handleImageMessage
};
