const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Gestion des sessions utilisateur avec historique de conversation
const conversationHistory = {};

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

// Fonction pour obtenir la date et l'heure actuelles à Madagascar
const getMadagascarDateTime = () => {
    const options = { 
        timeZone: 'Indian/Antananarivo',
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
    };
    return new Date().toLocaleString('fr-FR', options);
};

// Fonction pour formater la réponse
const formatResponse = (content) => {
    const dateTime = getMadagascarDateTime();
    return `🌴 SANS BOT 🏡\n${content}\n\nAuteur : 🌞 Bruno 🏡\nDate et heure à Madagascar: ${dateTime}`;
};

// Fonction pour construire le contexte de conversation
const buildConversationContext = (senderId, currentPrompt) => {
    if (!conversationHistory[senderId] || conversationHistory[senderId].length === 0) {
        return currentPrompt;
    }

    // Limiter l'historique aux 5 derniers échanges pour éviter les prompts trop longs
    const recentHistory = conversationHistory[senderId].slice(-5);

    let context = "Historique de la conversation:\n";
    recentHistory.forEach((entry, index) => {
        context += `${index + 1}. Utilisateur: ${entry.user}\n   Assistant: ${entry.assistant}\n`;
    });

    context += `\nQuestion actuelle: ${currentPrompt}`;
    return context;
};

module.exports = async (senderId, prompt, api, imageAttachments) => {
    try {
        // Initialiser l'historique de conversation si nécessaire
        if (!conversationHistory[senderId]) {
            conversationHistory[senderId] = [];
        }

        // Si c'est le premier message et qu'il est juste "sans"
        if (prompt.toLowerCase() === 'sans' && conversationHistory[senderId].length === 0) {
            const welcomeMessage = formatResponse("Bonjour je m'appelle Sans, comment puis-je vous aider aujourd'hui ?");
            await sendLongMessage(senderId, welcomeMessage);
            return;
        }

        // Si l'utilisateur envoie "clear", réinitialiser la conversation
        if (prompt.toLowerCase() === 'clear') {
            delete conversationHistory[senderId];
            await sendMessage(senderId, "✅ Conversation réinitialisée avec succès.");
            return;
        }

        // Vérifier que le prompt n'est pas vide
        if (!prompt || prompt.trim() === '' || prompt === 'IMAGE_ATTACHMENT') {
            await sendMessage(senderId, "❓ Veuillez poser une question ou envoyer un message.");
            return { skipCommandCheck: true };
        }

        // Envoyer un message de confirmation
        await sendMessage(senderId, "📜✨ Préparation de la réponse... ✨📜");

        // Construire le contexte avec l'historique de conversation
        const conversationContext = buildConversationContext(senderId, prompt);

        // Appeler l'API Perplexity avec le contexte
        const apiUrl = `https://apis-keith.vercel.app/ai/perplexity?q=${encodeURIComponent(conversationContext)}`;

        console.log('=== DEBUG PERPLEXITY API ===');
        console.log('Question avec contexte:', conversationContext);
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

        if (apiResponse.data && apiResponse.data.result && typeof apiResponse.data.result === 'string' && apiResponse.data.result.trim() !== '') {
            response = apiResponse.data.result;
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
            assistant: response
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
    description: "Discutez avec Sans Bot alimenté par Perplexity AI avec conversation continue et découpage intelligent des réponses.",
    usage: "Envoyez 'sans <message>' pour poser une question, ou 'clear' pour réinitialiser la conversation."
};