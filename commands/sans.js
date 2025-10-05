
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Gestion des sessions utilisateur
const userSessions = {}; 
const pendingImages = {};
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
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
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

        // Si c'est le premier message et qu'il est juste "sans"
        if (prompt.toLowerCase() === 'sans' && conversationHistory[senderId].messages.length === 0) {
            const welcomeMessage = formatResponse("Bonjour je m'appelle Sans, comment puis-je vous aider aujourd'hui ?");
            await sendLongMessage(senderId, welcomeMessage);
            return;
        }

        // Vérifier si nous avons des images en pièce jointe
        if (imageAttachments && imageAttachments.length > 0) {
            const imageUrl = imageAttachments[0].payload.url;
            
            // Stocker l'image et attendre la question
            pendingImages[senderId] = imageUrl;
            conversationHistory[senderId].hasImage = true;
            conversationHistory[senderId].imageUrl = imageUrl;
            
            // Si l'utilisateur a envoyé une question avec l'image, traiter directement
            if (prompt && prompt.trim().length > 0 && prompt !== "IMAGE_ATTACHMENT") {
                // Continuer le traitement avec la question
            } else {
                // Si pas de question, demander à l'utilisateur
                await sendMessage(senderId, "🇲🇬 J'ai bien reçu votre photo, quelle question avez-vous posé sur cette image? ❤️\n\n💡 Vous pouvez demander par exemple :\n• Décrivez bien cette image\n• Qu'est-ce qu'il y a sur cette photo?\n• Analysez cette image en détail");
                return { skipCommandCheck: true };
            }
        }

        // Si l'utilisateur envoie "clear", réinitialiser la conversation
        if (prompt.toLowerCase() === 'clear') {
            delete userSessions[senderId];
            delete pendingImages[senderId];
            delete conversationHistory[senderId];
            await sendMessage(senderId, "✅ Conversation réinitialisée avec succès.");
            return;
        }

        // Vérifier si une session existe pour l'utilisateur, sinon en créer une
        if (!userSessions[senderId]) {
            userSessions[senderId] = { uid: senderId };
        }

        // Envoyer un message de confirmation
        await sendMessage(senderId, "📜✨ Préparation de la réponse... ✨📜");

        let response;
        let apiResponse;

        // Si l'utilisateur a une image en attente, utiliser l'API avec image
        if (pendingImages[senderId] || conversationHistory[senderId].hasImage) {
            const imageUrl = pendingImages[senderId] || conversationHistory[senderId].imageUrl;
            
            // Vérifier que le prompt n'est pas vide
            if (!prompt || prompt.trim() === '' || prompt === 'IMAGE_ATTACHMENT') {
                await sendMessage(senderId, "🇲🇬 J'ai bien reçu votre photo, quelle question avez-vous posé sur cette image? ❤️\n\n💡 Vous pouvez demander par exemple :\n• Décrivez bien cette image\n• Qu'est-ce qu'il y a sur cette photo?\n• Analysez cette image en détail");
                return { skipCommandCheck: true };
            }
            
            // URL de l'API avec image
            const apiUrl = `https://claody7.vercel.app/claude?question=${encodeURIComponent(prompt)}&image=${encodeURIComponent(imageUrl)}&uid=${userSessions[senderId].uid}`;
            
            console.log('=== DEBUG IMAGE API ===');
            console.log('Image URL:', imageUrl);
            console.log('Question:', prompt);
            console.log('API URL complète:', apiUrl);
            
            try {
                apiResponse = await axios.get(apiUrl, { 
                    timeout: 30000,
                    validateStatus: function (status) {
                        return status < 500;
                    }
                });
                
                console.log('Statut de la réponse:', apiResponse.status);
                console.log('Réponse API avec image:', JSON.stringify(apiResponse.data, null, 2));
                
                if (apiResponse.data && apiResponse.data.response && typeof apiResponse.data.response === 'string' && apiResponse.data.response.trim() !== '') {
                    response = apiResponse.data.response;
                } else {
                    console.error('Structure de réponse inattendue:', apiResponse.data);
                    response = 'Aucune réponse reçue de l\'API. Veuillez réessayer.';
                }
            } catch (imageApiError) {
                console.error('Erreur lors de l\'appel API avec image:', imageApiError.message);
                response = 'Erreur lors de l\'analyse de l\'image. Veuillez réessayer.';
            }
            
            // Supprimer l'image de pendingImages après avoir répondu
            if (pendingImages[senderId]) {
                delete pendingImages[senderId];
            }
            // Réinitialiser le flag d'image dans l'historique
            conversationHistory[senderId].hasImage = false;
            conversationHistory[senderId].imageUrl = null;
        } else {
            // Utiliser l'API textuelle
            const apiUrl = `https://claody7.vercel.app/Claude?question=${encodeURIComponent(prompt)}&uid=${userSessions[senderId].uid}`;
            
            console.log('API URL textuelle:', apiUrl);
            apiResponse = await axios.get(apiUrl, { timeout: 30000 });
            console.log('Réponse API textuelle:', JSON.stringify(apiResponse.data, null, 2));
            
            if (apiResponse.data && typeof apiResponse.data.response === 'string' && apiResponse.data.response.trim() !== '') {
                response = apiResponse.data.response;
            } else {
                console.error('Structure de réponse inattendue:', apiResponse.data);
                response = 'Aucune réponse reçue de l\'API';
            }
        }
        
        // Vérifier que la réponse n'est pas vide
        if (!response || response.trim() === '') {
            response = 'Désolé, je n\'ai pas pu générer une réponse. Veuillez réessayer.';
        }

        // Ajouter le message de l'utilisateur et la réponse à l'historique
        conversationHistory[senderId].messages.push({ role: 'user', content: prompt });
        conversationHistory[senderId].messages.push({ role: 'assistant', content: response });

        // Attendre 2 secondes avant d'envoyer la réponse
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Formater la réponse et l'envoyer
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
    description: "Discutez avec Sans Bot, capable d'analyser vos images et de répondre à vos questions avec continuité.",
    usage: "Envoyez 'sans <message>' pour poser une question, joignez une image pour l'analyser, ou 'clear' pour réinitialiser la conversation."
};
