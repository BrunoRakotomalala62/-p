
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Gestion des sessions utilisateur
const userSessions = {}; 
const pendingImages = {};
const conversationHistory = {};

// Fonction pour envoyer des messages longs en plusieurs parties intelligemment
async function sendLongMessage(senderId, message) {
    const MAX_MESSAGE_LENGTH = 1900; // Limite inférieure à 2000 pour garder une marge

    // Si le message est assez court, l'envoyer directement
    if (message.length <= MAX_MESSAGE_LENGTH) {
        await sendMessage(senderId, message);
        return;
    }

    // Diviser le message en plusieurs parties intelligemment
    let startIndex = 0;
    
    while (startIndex < message.length) {
        let endIndex = startIndex + MAX_MESSAGE_LENGTH;
        
        // Si on n'est pas à la fin du message
        if (endIndex < message.length) {
            // Chercher le dernier séparateur (point, virgule, espace) avant la limite
            const separators = ['. ', ', ', ' ', '! ', '? ', '.\n', ',\n', '!\n', '?\n', '\n\n', '\n', ':', ';'];
            let bestBreakPoint = -1;
            
            // Chercher du point le plus proche de la fin jusqu'au début
            for (const separator of separators) {
                // Chercher le dernier séparateur dans la plage
                const lastSeparator = message.lastIndexOf(separator, endIndex);
                if (lastSeparator > startIndex && (bestBreakPoint === -1 || lastSeparator > bestBreakPoint)) {
                    bestBreakPoint = lastSeparator + separator.length;
                }
            }
            
            // Si un séparateur a été trouvé, utiliser ce point de coupure
            if (bestBreakPoint !== -1) {
                endIndex = bestBreakPoint;
            }
        } else {
            // Si c'est la dernière partie, prendre jusqu'à la fin
            endIndex = message.length;
        }
        
        // Extraire la partie du message
        const messagePart = message.substring(startIndex, endIndex);
        await sendMessage(senderId, messagePart);
        
        // Pause entre chaque message pour éviter les rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Passer à la partie suivante
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
    return `🌴 AMPINGA D'OR 🏡\n${content}\n\nAuteur : 🌞 Bruno 🏡\nDate et heure à Madagascar: ${dateTime}`;
};

module.exports = async (senderId, prompt, api, imageAttachments) => {
    try {
        // Initialiser l'historique de conversation si nécessaire
        if (!conversationHistory[senderId]) {
            conversationHistory[senderId] = {
                messages: [],
                hasImage: false,
                imageUrl: null
            };
        }

        // Si c'est le premier message et qu'il est juste "ampinga"
        if (prompt.toLowerCase() === 'ampinga' && conversationHistory[senderId].messages.length === 0) {
            const welcomeMessage = formatResponse("Bonjour je m'appelle ampinga comment puis-je faire pour vous aujourd'hui ?");
            await sendLongMessage(senderId, welcomeMessage);
            return;
        }

        // Vérifier si nous avons des images en pièce jointe
        if (imageAttachments && imageAttachments.length > 0) {
            // Stocker l'URL de l'image pour cet utilisateur
            const imageUrl = imageAttachments[0].payload.url;
            pendingImages[senderId] = imageUrl;
            conversationHistory[senderId].hasImage = true;
            conversationHistory[senderId].imageUrl = imageUrl;
            
            // Envoyer un message demandant une question sur l'image
            const imageReceivedMessage = formatResponse("✨📸 J'ai bien reçu votre magnifique image! Quelle est votre question concernant ce visuel? Je suis impatient d'analyser cette photo avec vous! 🔍🖼️✨");
            await sendLongMessage(senderId, imageReceivedMessage);
            return { skipCommandCheck: true };
        }

        // Si l'utilisateur envoie "clear", réinitialiser la conversation
        if (prompt.toLowerCase() === 'clear') {
            delete userSessions[senderId];
            delete pendingImages[senderId];
            delete conversationHistory[senderId];
            await sendMessage(senderId, "Vous avez réinitialisé la conversation.");
            return;
        }

        // Vérifier si une session existe pour l'utilisateur, sinon en créer une
        if (!userSessions[senderId]) {
            userSessions[senderId] = { uid: Math.random().toString(36).substring(7) };
        }

        // Envoyer un message de confirmation que le message a été reçu
        await sendMessage(senderId, "📜✨ Préparation de la réponse parfaite… ✨📜");

        let response;
        let apiResponse;

        // Ajouter le message de l'utilisateur à l'historique
        conversationHistory[senderId].messages.push({ role: 'user', content: prompt });

        // Construire un prompt qui prend en compte l'historique de conversation
        let contextualPrompt = prompt;
        if (conversationHistory[senderId].messages.length > 1) {
            // Extraire les 3 derniers messages pour le contexte (ou moins s'il y en a moins)
            const recentMessages = conversationHistory[senderId].messages.slice(-3);
            const context = recentMessages.map(msg => `${msg.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${msg.content}`).join('\n');
            contextualPrompt = `Étant donné le contexte de notre conversation: \n${context}\n\nRépondre à: ${prompt}`;
        }
        
        // Si l'utilisateur a une image en attente, inclure cette information dans le prompt
        if (pendingImages[senderId] || conversationHistory[senderId].hasImage) {
            contextualPrompt = `En référence à l'image précédente et à notre conversation, ${contextualPrompt}`;
        }
        
        // Appeler la nouvelle API rapido.zetsu.xyz
        const apiUrl = `https://rapido.zetsu.xyz/api/anthropic?q=${encodeURIComponent(contextualPrompt)}&uid=${userSessions[senderId].uid}&model=claude-3-7-sonnet-20250219&system=&max_token=3000`;
        apiResponse = await axios.get(apiUrl);
        response = apiResponse.data.response;

        // Ajouter la réponse à l'historique
        conversationHistory[senderId].messages.push({ role: 'assistant', content: response });

        // Attendre 2 secondes avant d'envoyer la réponse
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Formater la réponse et l'envoyer avec la fonction de découpage intelligent
        const formattedResponse = formatResponse(response);
        await sendLongMessage(senderId, formattedResponse);

        // Supprimer l'image de pendingImages après avoir répondu à la question
        // Mais la garder dans l'historique pour la conversation continue
        if (pendingImages[senderId]) {
            delete pendingImages[senderId];
        }
    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API:', error);

        // Envoyer un message d'erreur à l'utilisateur en cas de problème
        const errorMessage = formatResponse("Désolé, une erreur s'est produite lors du traitement de votre message.");
        await sendLongMessage(senderId, errorMessage);
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "ampinga",
    description: "Discutez avec le bot Ampinga, qui peut analyser vos images et répondre à vos questions avec continuité.",
    usage: "Envoyez 'ampinga <message>' pour poser une question, joignez une image pour l'analyser, ou 'clear' pour réinitialiser la conversation."
};
