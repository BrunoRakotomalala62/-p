
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
            
            // Stocker l'image et attendre la question
            pendingImages[senderId] = imageUrl;
            conversationHistory[senderId].hasImage = true;
            conversationHistory[senderId].imageUrl = imageUrl;
            
            // Si l'utilisateur a envoyé une question avec l'image, traiter directement
            if (prompt && prompt.trim().length > 0 && prompt !== "IMAGE_ATTACHMENT") {
                // Continuer le traitement avec la question
            } else {
                // Si pas de question, demander à l'utilisateur avec un message d'attente
                await sendMessage(senderId, "🇲🇬 J'ai bien reçu votre photo, quelle question avez-vous posé sur cette image? ❤️\n\n💡 Vous pouvez demander par exemple :\n• Décrivez bien cette image\n• Qu'est-ce qu'il y a sur cette photo?\n• Analysez cette image en détail");
                return { skipCommandCheck: true };
            }
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
            userSessions[senderId] = { uid: senderId };
        }

        // Envoyer un message de confirmation que le message a été reçu
        await sendMessage(senderId, "📜✨ Préparation de la réponse parfaite… ✨📜");

        let response;
        let apiResponse;

        // Si l'utilisateur a une image en attente, utiliser l'API avec image
        if (pendingImages[senderId] || conversationHistory[senderId].hasImage) {
            const imageUrl = pendingImages[senderId] || conversationHistory[senderId].imageUrl;
            
            // Vérifier que le prompt n'est pas vide ou "IMAGE_ATTACHMENT"
            if (!prompt || prompt.trim() === '' || prompt === 'IMAGE_ATTACHMENT') {
                await sendMessage(senderId, "🇲🇬 J'ai bien reçu votre photo, quelle question avez-vous posé sur cette image? ❤️\n\n💡 Vous pouvez demander par exemple :\n• Décrivez bien cette image\n• Qu'est-ce qu'il y a sur cette photo?\n• Analysez cette image en détail");
                return { skipCommandCheck: true };
            }
            
            // Gérer les questions prédéfinies courantes (optionnel - normaliser la question)
            const normalizedPrompt = prompt.toLowerCase().trim();
            if (normalizedPrompt === 'décrivez' || normalizedPrompt === 'describe' || normalizedPrompt === 'décrire') {
                prompt = 'Décrivez bien cette image en détail';
            }
            
            // URL de l'API avec image - CORRIGER L'URL ICI
            const apiUrl = `https://claody7.vercel.app/claude?question=${encodeURIComponent(prompt)}&image=${encodeURIComponent(imageUrl)}&uid=${userSessions[senderId].uid}`;
            
            console.log('=== DEBUG IMAGE API ===');
            console.log('Image URL:', imageUrl);
            console.log('Question:', prompt);
            console.log('API URL complète:', apiUrl);
            
            try {
                apiResponse = await axios.get(apiUrl, { 
                    timeout: 30000,
                    validateStatus: function (status) {
                        return status < 500; // Accepter toutes les réponses < 500
                    }
                });
                
                console.log('Statut de la réponse:', apiResponse.status);
                console.log('Réponse API avec image:', JSON.stringify(apiResponse.data, null, 2));
                
                // Vérifier spécifiquement le champ 'response'
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
            // Utiliser l'API textuelle (noter le 'C' majuscule dans 'Claude')
            const apiUrl = `https://claody7.vercel.app/Claude?question=${encodeURIComponent(prompt)}&uid=${userSessions[senderId].uid}`;
            
            console.log('API URL textuelle:', apiUrl);
            apiResponse = await axios.get(apiUrl, { timeout: 30000 });
            console.log('Réponse API textuelle:', JSON.stringify(apiResponse.data, null, 2));
            
            // Vérifier spécifiquement le champ 'response'
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

        // Formater la réponse et l'envoyer avec la fonction de découpage intelligent
        const formattedResponse = formatResponse(response);
        await sendLongMessage(senderId, formattedResponse);

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
