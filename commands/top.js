const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Stockage des IDs de session par utilisateur pour maintenir les conversations continues
const userSessionIds = {};

// URL de base pour l'API
const API_BASE_URL = 'https://rapido.zetsu.xyz/api/anthropic';

// Stockage des images en attente
const pendingImages = {};

// Fonction pour envoyer des messages longs en plusieurs parties si nécessaire
async function sendLongMessage(senderId, message) {
    const MAX_MESSAGE_LENGTH = 2000; // Limite de caractères par message Facebook

    if (message.length <= MAX_MESSAGE_LENGTH) {
        // Si le message est assez court, l'envoyer directement
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
            const separators = ['. ', ', ', ' ', '! ', '? ', '.\n', ',\n', '!\n', '?\n', '\n\n', '\n'];
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
        await new Promise(resolve => setTimeout(resolve, 1000));  // Pause de 1s entre chaque message
        
        // Passer à la partie suivante
        startIndex = endIndex;
    }
}

module.exports = async (senderId, prompt, api, imageAttachments) => { 
    try {
        // Initialiser l'ID de session si ce n'est pas déjà fait
        if (!userSessionIds[senderId]) {
            userSessionIds[senderId] = senderId; // Utiliser senderId comme ID de session
        }

        // Vérifier si nous avons affaire à un attachement image
        if (imageAttachments && imageAttachments.length > 0) {
            // Stocker l'URL de l'image pour cet utilisateur
            pendingImages[senderId] = imageAttachments[0].payload.url;
            
            // Envoyer un message confirmant la réception de l'image selon les spécifications
            await sendMessage(senderId, "J'ai bien reçu l'image, posé de questions alors");
            return { skipCommandCheck: true };
        }

        // Si le prompt est vide (commande 'top' sans texte)
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, "🤖 Commande TOP activée! Envoyez-moi une image et posez ensuite vos questions pour que je puisse l'analyser avec Claude!");
            return;
        }

        // Vérifier si nous avons une image en attente pour cet utilisateur
        if (!pendingImages[senderId]) {
            await sendMessage(senderId, "❌ Aucune image en attente. Veuillez d'abord envoyer une image puis poser votre question.");
            return;
        }

        const imageUrl = pendingImages[senderId];
        
        // Construire l'URL de l'API avec l'image selon les spécifications
        const apiUrl = `${API_BASE_URL}?q=${encodeURIComponent(prompt)}&uid=${userSessionIds[senderId]}&model=claude-sonnet-4-20250514&image=${encodeURIComponent(imageUrl)}&system=&max_token=3000`;
        
        // Appel à l'API avec l'image
        const response = await axios.get(apiUrl);
        
        // Débogage : afficher la structure de la réponse
        console.log('Structure complète de la réponse API:', JSON.stringify(response.data, null, 2));
        
        // Récupérer la réponse de l'API
        let reply;
        if (response.data.response) {
            reply = response.data.response;
        } else if (response.data.content) {
            reply = response.data.content;
        } else if (response.data.message) {
            reply = response.data.message;
        } else if (response.data.text) {
            reply = response.data.text;
        } else if (typeof response.data === 'string') {
            reply = response.data;
        } else {
            // Si aucune propriété connue n'est trouvée, utiliser la première valeur non-vide
            const keys = Object.keys(response.data);
            reply = keys.length > 0 ? response.data[keys[0]] : 'Aucune réponse reçue de l\'API';
        }
        
        console.log('Réponse extraite:', reply);
        
        // Créer une réponse formatée selon les spécifications
        const formattedReply = `😍 CLAUDE BOT🤖

${reply}`;

        // Envoyer la réponse formatée en utilisant la fonction de découpage dynamique
        await sendLongMessage(senderId, formattedReply);
        
    } catch (error) {
        console.error("Erreur lors de l'appel à l'API:", error);
        
        // Message d'erreur
        await sendMessage(senderId, `❌ Erreur lors de l'analyse de l'image. Veuillez réessayer plus tard.`);
    }
    
    return { skipCommandCheck: true };
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "top",
    description: "Analysez des images avec Claude AI. Envoyez une image puis posez vos questions.",
    usage: "Envoyez 'top' puis une image, ensuite posez vos questions sur l'image."
};
