
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Stockage des images en attente par utilisateur
const pendingImages = {};

// Gestion des sessions utilisateur
const userSessions = {};

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

module.exports = async (senderId, prompt, api, imageAttachments) => {
    try {
        // Initialiser la session utilisateur si nécessaire
        if (!userSessions[senderId]) {
            userSessions[senderId] = { uid: senderId };
        }

        // Vérifier si nous avons des images en pièce jointe
        if (imageAttachments && imageAttachments.length > 0) {
            const imageUrl = imageAttachments[0].payload.url;
            
            // Stocker l'image et attendre la question
            pendingImages[senderId] = imageUrl;
            
            // Si l'utilisateur a envoyé une question avec l'image, traiter directement
            if (prompt && prompt.trim().length > 0 && prompt !== "IMAGE_ATTACHMENT") {
                // Continuer le traitement avec la question
            } else {
                // Si pas de question, demander à l'utilisateur
                await sendMessage(senderId, "🇲🇬 J'ai bien reçu votre photo, quel questions avez vous posé sur cette image? ❤️");
                return { skipCommandCheck: true };
            }
        }

        // Si l'utilisateur envoie "clear", réinitialiser la conversation
        if (prompt.toLowerCase() === 'clear') {
            delete userSessions[senderId];
            delete pendingImages[senderId];
            await sendMessage(senderId, "Conversation réinitialisée.");
            return;
        }

        // Envoyer un message de confirmation
        await sendMessage(senderId, "📜✨ Préparation de la réponse... ✨📜");

        let response;
        let apiResponse;

        // Si l'utilisateur a une image en attente, utiliser l'API avec image
        if (pendingImages[senderId]) {
            const imageUrl = pendingImages[senderId];
            
            // Vérifier que le prompt n'est pas vide
            if (!prompt || prompt.trim() === '' || prompt === 'IMAGE_ATTACHMENT') {
                await sendMessage(senderId, "🇲🇬 J'ai bien reçu votre photo, quel questions avez vous posé sur cette image? ❤️");
                return { skipCommandCheck: true };
            }
            
            // URL de l'API avec image
            const apiUrl = `https://claody7.vercel.app/claude?question=${encodeURIComponent(prompt)}&image=${encodeURIComponent(imageUrl)}&uid=${userSessions[senderId].uid}`;
            
            console.log('=== API TOJO IMAGE ===');
            console.log('Image URL:', imageUrl);
            console.log('Question:', prompt);
            console.log('API URL:', apiUrl);
            
            try {
                apiResponse = await axios.get(apiUrl, { 
                    timeout: 30000,
                    validateStatus: function (status) {
                        return status < 500;
                    }
                });
                
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
            
            // Supprimer l'image après avoir répondu
            delete pendingImages[senderId];
        } else {
            // Utiliser l'API textuelle
            const apiUrl = `https://claody7.vercel.app/Claude?question=${encodeURIComponent(prompt)}&uid=${userSessions[senderId].uid}`;
            
            console.log('=== API TOJO TEXTE ===');
            console.log('API URL:', apiUrl);
            
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

        // Attendre 2 secondes avant d'envoyer la réponse
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Envoyer la réponse
        await sendLongMessage(senderId, response);

    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API:', error);

        // Envoyer un message d'erreur à l'utilisateur
        await sendLongMessage(senderId, "Désolé, une erreur s'est produite lors du traitement de votre message.");
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "tojo",
    description: "Discutez avec le bot Tojo, qui peut analyser vos images et répondre à vos questions.",
    usage: "Envoyez 'tojo <message>' pour poser une question, joignez une image pour l'analyser, ou 'clear' pour réinitialiser la conversation."
};
