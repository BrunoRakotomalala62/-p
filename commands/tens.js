
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Stockage des IDs de session par utilisateur
const userSessionIds = {};

// Stockage des images en attente
const pendingImages = {};

// URL de base pour l'API
const API_BASE_URL = 'https://rapido.zetsu.xyz/api/anthropic';

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
            
            await sendMessage(senderId, "📸 J'ai bien reçu votre image! Que voulez-vous savoir à propos de cette photo? Posez-moi votre question! 🔍");
            return { skipCommandCheck: true };
        }

        // Si le prompt est vide (commande 'tens' sans texte)
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, "🤖 Bonjour! Je suis Tens, votre assistant IA. Comment puis-je vous aider aujourd'hui? Posez-moi n'importe quelle question ou partagez une image pour que je puisse l'analyser!");
            return;
        }

        // Envoyer un message d'attente
        await sendMessage(senderId, "⏳ Analyse en cours...");

        let response;
        
        // Vérifier si nous avons une image en attente pour cet utilisateur
        if (pendingImages[senderId]) {
            const imageUrl = pendingImages[senderId];
            
            // Construire l'URL de l'API avec l'image
            const apiUrl = `${API_BASE_URL}?q=${encodeURIComponent(prompt)}&uid=${userSessionIds[senderId]}&model=claude-3-7-sonnet-20250219&image=${encodeURIComponent(imageUrl)}&system=&max_tokens=3000`;
            
            // Appel à l'API avec l'image
            response = await axios.get(apiUrl);
        } else {
            // Appel à l'API sans image (texte seulement)
            const apiUrl = `${API_BASE_URL}?q=${encodeURIComponent(prompt)}&uid=${userSessionIds[senderId]}&model=claude-sonnet-4-20250514&system=&max_token=3000`;
            response = await axios.get(apiUrl);
        }
        
        // Récupérer la réponse de l'API
        const { response: aiResponse } = response.data;
        
        // Créer une réponse formatée
        const formattedReply = `😊BOT😊\n${aiResponse}`;

        // Envoyer la réponse formatée
        await sendLongMessage(senderId, formattedReply);
        
        // Nettoyer l'image en attente après utilisation
        if (pendingImages[senderId]) {
            delete pendingImages[senderId];
        }
        
    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Tens:", error);
        
        await sendMessage(senderId, `⚠️ Une erreur s'est produite lors de la communication avec Tens. Veuillez réessayer dans quelques instants.`);
    }
    
    return { skipCommandCheck: true };
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "tens",
    description: "Discutez avec Tens, une IA avancée capable d'analyser du texte et des images.",
    usage: "Envoyez 'tens <question>' pour discuter avec Tens, ou envoyez une image suivie de questions à son sujet."
};
