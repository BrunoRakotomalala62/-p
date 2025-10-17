
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Gestion des sessions utilisateur avec historique de conversation
const conversationHistory = {};
const pendingImages = {};

// Fonction pour envoyer des messages longs en plusieurs parties intelligemment
async function sendLongMessage(senderId, message) {
    const MAX_MESSAGE_LENGTH = 1900;

    if (message.length <= MAX_MESSAGE_LENGTH) {
        await sendMessage(senderId, message);
        return;
    }

    let startIndex = 0;

    while (startIndex < message.length) {
        let endIndex = startIndex + MAX_MESSAGE_LENGTH;

        if (endIndex < message.length) {
            const separators = ['. ', ', ', ' ', '! ', '? ', '.\n', ',\n', '!\n', '?\n', '\n\n', '\n', ':', ';'];
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

        await new Promise(resolve => setTimeout(resolve, 800));

        startIndex = endIndex;
    }
}

// Fonction pour formater la réponse
const formatResponse = (content) => {
    return `🇲🇬❤️ BOT GPT4-PRO 🎉🎈\n${content}`;
};

module.exports = async (senderId, prompt, api, imageAttachments) => {
    try {
        // Initialiser l'historique de conversation si nécessaire
        if (!conversationHistory[senderId]) {
            conversationHistory[senderId] = [];
        }

        // Si l'utilisateur envoie "clear", réinitialiser la conversation
        if (prompt.toLowerCase() === 'clear') {
            delete conversationHistory[senderId];
            delete pendingImages[senderId];
            await sendMessage(senderId, "✅ Conversation réinitialisée avec succès.");
            return;
        }

        // Gérer les images en pièce jointe
        if (imageAttachments && imageAttachments.length > 0) {
            // Récupérer correctement l'URL de l'image depuis l'objet attachment
            const imageUrl = imageAttachments[0].payload.url;
            pendingImages[senderId] = imageUrl;
            
            await sendMessage(senderId, "✅ J'ai bien reçu votre image. Posez des questions basées sur cette image.");
            return { skipCommandCheck: true };
        }

        // Si c'est le premier message et qu'il est juste "sans"
        if (prompt.toLowerCase() === 'sans' && conversationHistory[senderId].length === 0) {
            const welcomeMessage = formatResponse("Bonjour je m'appelle Sans, comment puis-je vous aider aujourd'hui ?");
            await sendLongMessage(senderId, welcomeMessage);
            return;
        }

        // Vérifier que le prompt n'est pas vide
        if (!prompt || prompt.trim() === '' || prompt === 'IMAGE_ATTACHMENT') {
            await sendMessage(senderId, "❓ Veuillez poser une question ou envoyer un message.");
            return { skipCommandCheck: true };
        }

        // Envoyer un message de confirmation
        await sendMessage(senderId, "📜✨ Préparation de la réponse... ✨📜");

        // Préparer l'URL de l'API
        let apiUrl = `https://kaiz-apis.gleeze.com/api/gpt-4o-pro?ask=${encodeURIComponent(prompt)}&uid=${senderId}&apikey=115e2076-943c-4deb-a25d-9168e3d7b336`;

        // Ajouter l'image si elle existe
        if (pendingImages[senderId]) {
            apiUrl += `&imageUrl=${encodeURIComponent(pendingImages[senderId])}`;
        }

        console.log('=== DEBUG GPT-4o Pro API ===');
        console.log('Question:', prompt);
        console.log('API URL:', apiUrl);

        const apiResponse = await axios.get(apiUrl, { 
            timeout: 30000,
            validateStatus: function (status) {
                return status < 500;
            }
        });

        console.log('Statut de la réponse:', apiResponse.status);
        console.log('Réponse API:', JSON.stringify(apiResponse.data, null, 2));

        let response;

        if (apiResponse.data && apiResponse.data.response && typeof apiResponse.data.response === 'string' && apiResponse.data.response.trim() !== '') {
            response = apiResponse.data.response;
        } else {
            console.error('Structure de réponse inattendue:', apiResponse.data);
            response = 'Aucune réponse reçue de l\'API. Veuillez réessayer.';
        }

        // Vérifier que la réponse n'est pas vide
        if (!response || response.trim() === '') {
            response = 'Désolé, je n\'ai pas pu générer une réponse. Veuillez réessayer.';
        }

        // Ajouter à l'historique de conversation
        conversationHistory[senderId].push({
            user: prompt,
            assistant: response,
            hasImage: !!pendingImages[senderId]
        });

        // Limiter la taille de l'historique (garder les 10 derniers échanges)
        if (conversationHistory[senderId].length > 10) {
            conversationHistory[senderId] = conversationHistory[senderId].slice(-10);
        }

        // Attendre 2 secondes avant d'envoyer la réponse
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Formater la réponse et l'envoyer avec découpage dynamique
        const formattedResponse = formatResponse(response);
        await sendLongMessage(senderId, formattedResponse);

    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API:', error);
        const errorMessage = formatResponse("Désolé, une erreur s'est produite lors du traitement de votre message.");
        await sendLongMessage(senderId, errorMessage);
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "sans",
    description: "Discutez avec Sans Bot alimenté par GPT-4o Pro avec support d'images et conversation continue.",
    usage: "Envoyez 'sans <message>' pour poser une question, envoyez une image pour l'analyser, ou 'clear' pour réinitialiser la conversation."
};
