
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Stockage des images en attente par utilisateur
const pendingImages = {};

// Fonction pour télécharger l'image et la convertir en base64
async function downloadImageAsBase64(imageUrl) {
    try {
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 30000
        });
        
        const base64 = Buffer.from(response.data, 'binary').toString('base64');
        const contentType = response.headers['content-type'] || 'image/jpeg';
        
        return `data:${contentType};base64,${base64}`;
    } catch (error) {
        console.error('Erreur lors du téléchargement de l\'image:', error.message);
        throw new Error('Impossible de télécharger l\'image');
    }
}

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
        const API_BASE_URL = 'https://rapido.zetsu.xyz/api/anthropic';
        
        // Vérifier si nous avons affaire à un attachement image
        if (imageAttachments && imageAttachments.length > 0) {
            pendingImages[senderId] = imageAttachments[0].payload.url;
            await sendMessage(senderId, "✨📸 J'ai bien reçu votre image! Que voulez-vous savoir à propos de cette photo? Posez-moi votre question! 🔍🖼️");
            return { skipCommandCheck: true };
        }

        // Si le prompt est vide
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, "🤖✨ Bonjour! Je suis Mais, votre assistant IA. Comment puis-je vous aider aujourd'hui? Posez-moi n'importe quelle question ou partagez une image pour que je puisse l'analyser!");
            return;
        }

        // Envoyer un message d'attente
        await sendMessage(senderId, "🇲🇬 ⏳ Generating...");

        let response;
        
        // Vérifier si nous avons une image en attente pour cet utilisateur
        if (pendingImages[senderId]) {
            const imageUrl = pendingImages[senderId];
            
            try {
                // Télécharger et convertir l'image en base64
                const base64Image = await downloadImageAsBase64(imageUrl);
                
                // Construire l'URL de l'API avec l'image en base64
                const apiUrl = `${API_BASE_URL}?q=${encodeURIComponent(prompt)}&uid=${senderId}&model=claude-3-7-sonnet-20250219&image=${encodeURIComponent(base64Image)}&system=&max_tokens=3000`;
                
                response = await axios.get(apiUrl);
                
                // Supprimer l'image après utilisation
                delete pendingImages[senderId];
            } catch (imageError) {
                delete pendingImages[senderId];
                await sendMessage(senderId, "❌ Désolé, je n'ai pas pu accéder à votre image. Veuillez réessayer avec une autre image.");
                return;
            }
        } else {
            // Appel à l'API sans image (texte seulement)
            const apiUrl = `${API_BASE_URL}?q=${encodeURIComponent(prompt)}&uid=${senderId}&model=claude-3-7-sonnet-20250219&system=&max_tokens=3000`;
            response = await axios.get(apiUrl);
        }
        
        // Récupérer la réponse de l'API (gérer différents formats de réponse)
        let reply = response.data.response || response.data.message || response.data.result || response.data.text || response.data;
        
        // Si c'est un objet, essayer de le convertir en chaîne
        if (typeof reply === 'object') {
            reply = JSON.stringify(reply, null, 2);
        }
        
        // Vérifier si la réponse est valide
        if (!reply || reply === 'undefined' || reply === '{}') {
            console.error('Réponse API invalide:', response.data);
            await sendMessage(senderId, "⚠️ Désolé, je n'ai pas pu obtenir une réponse valide de l'API. Veuillez réessayer.");
            return;
        }
        
        // Créer une réponse formatée
        const formattedReply = `😊BOT😊\n${reply}`;

        // Envoyer la réponse formatée
        await sendLongMessage(senderId, formattedReply);
        
    } catch (error) {
        console.error("Erreur lors de l'appel à l'API:", error);
        
        await sendMessage(senderId, `⚠️ *OUPS! ERREUR TECHNIQUE* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors de la communication avec l'API.
Veuillez réessayer dans quelques instants.

🔄 Si le problème persiste, essayez une autre commande
ou contactez l'administrateur.
━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    }
    
    return { skipCommandCheck: true };
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "mais",
    description: "Analysez des images et posez des questions avec l'IA Claude.",
    usage: "Envoyez 'mais <question>' pour discuter, ou envoyez une image suivie de questions à son sujet."
};
