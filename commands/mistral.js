const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Stockage des images et historique de conversation par utilisateur
const pendingImages = {};
const conversationHistory = {};

// Fonction pour découper un message en morceaux de moins de 2000 caractères
function splitMessage(text, maxLength = 2000) {
    const chunks = [];
    
    if (text.length <= maxLength) {
        return [text];
    }
    
    let currentChunk = '';
    const sentences = text.split(/(?<=[.!?])\s+/);
    
    for (const sentence of sentences) {
        if (sentence.length > maxLength) {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }
            
            const words = sentence.split(' ');
            for (const word of words) {
                if ((currentChunk + ' ' + word).length > maxLength) {
                    chunks.push(currentChunk.trim());
                    currentChunk = word;
                } else {
                    currentChunk += (currentChunk ? ' ' : '') + word;
                }
            }
        } else {
            if ((currentChunk + ' ' + sentence).length > maxLength) {
                chunks.push(currentChunk.trim());
                currentChunk = sentence;
            } else {
                currentChunk += (currentChunk ? ' ' : '') + sentence;
            }
        }
    }
    
    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }
    
    return chunks;
}

module.exports = async (senderId, prompt, uid, imageAttachments) => {
    try {
        // Initialiser l'historique de conversation pour l'utilisateur s'il n'existe pas
        if (!conversationHistory[senderId]) {
            conversationHistory[senderId] = {
                hasImage: false,
                imageUrl: null,
                messageCount: 0
            };
        }

        // Gérer les images attachées
        if (imageAttachments && imageAttachments.length > 0) {
            const imageUrl = imageAttachments[0].payload.url;
            pendingImages[senderId] = imageUrl;
            conversationHistory[senderId].hasImage = true;
            conversationHistory[senderId].imageUrl = imageUrl;

            await sendMessage(senderId, `✨📸 J'ai bien reçu votre image ! 🖼️

💭 Quelle est votre question concernant cette image ? 🤔

💡 Exemples :
• Décris cette image en détail
• Qu'est-ce qu'il y a sur cette photo ?
• Analyse cette image
• Que vois-tu sur cette image ?`);
            return;
        }

        // Vérifier si un prompt a été fourni
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, `🤖 𝗚𝗥𝗢𝗞-𝟰 𝗔𝗜 𝗔𝗦𝗦𝗜𝗦𝗧𝗔𝗡𝗧 🤖
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👋 Bonjour ! Je suis Grok-4, votre assistant IA intelligent.

📝 𝗨𝘁𝗶𝗹𝗶𝘀𝗮𝘁𝗶𝗼𝗻 :
• mistral <votre question>
• Envoyez une image + mistral pour l'analyser

💡 𝗘𝘅𝗲𝗺𝗽𝗹𝗲𝘀 :
• mistral Bonjour comment ça va ?
• mistral Explique-moi la relativité
• mistral [+ image] Décris cette photo

🌟 Conversation continue activée !`);
            return;
        }

        // Envoyer un message de confirmation
        await sendMessage(senderId, "✨🌟 Magie en cours... Préparez-vous à découvrir la réponse ! 🌟✨");

        let apiUrl;
        let hasImage = false;

        // Vérifier s'il y a une image en attente pour cet utilisateur
        if (conversationHistory[senderId].hasImage && conversationHistory[senderId].imageUrl) {
            // API avec image
            hasImage = true;
            apiUrl = `https://api-geminiplusieursphoto2026.vercel.app/grok4?uid=${uid || senderId}&prompt=${encodeURIComponent(prompt)}&imageurl=${encodeURIComponent(conversationHistory[senderId].imageUrl)}`;
        } else {
            // API sans image
            apiUrl = `https://api-geminiplusieursphoto2026.vercel.app/grok4?uid=${uid || senderId}&prompt=${encodeURIComponent(prompt)}`;
        }

        // Appeler l'API
        const response = await axios.get(apiUrl, {
            timeout: 60000
        });

        // Vérifier si la réponse est valide
        if (response.data && response.data.success && response.data.response) {
            const botResponse = response.data.response;
            const model = response.data.model || 'Grok-4';
            
            // Incrémenter le compteur de messages
            conversationHistory[senderId].messageCount++;

            // Formater la réponse
            let formattedReply = `🤖 𝗚𝗥𝗢𝗞-𝟰 𝗔𝗜 ${hasImage ? '📸' : '💬'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${botResponse}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔢 Message #${conversationHistory[senderId].messageCount} | 🧠 ${model}`;

            // Réinitialiser l'image après l'avoir utilisée
            if (hasImage) {
                conversationHistory[senderId].hasImage = false;
                conversationHistory[senderId].imageUrl = null;
                delete pendingImages[senderId];
            }

            // Découper et envoyer la réponse
            const messageChunks = splitMessage(formattedReply);
            
            for (let i = 0; i < messageChunks.length; i++) {
                const chunk = messageChunks[i];
                const prefix = messageChunks.length > 1 ? `📨 Partie ${i + 1}/${messageChunks.length}\n\n` : '';
                
                await sendMessage(senderId, prefix + chunk);
                
                if (i < messageChunks.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

        } else {
            await sendMessage(senderId, `❌ 𝗘𝗥𝗥𝗘𝗨𝗥 𝗗𝗘 𝗠𝗔𝗚𝗜𝗘... ❌
😞 L'API n'a pas retourné de réponse valide.
🔄 Veuillez réessayer.`);
        }

    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Grok-4 :", error);

        let errorMessage = "❌ 𝗘𝗥𝗥𝗘𝗨𝗥 𝗗𝗘 𝗠𝗔𝗚𝗜𝗘... ❌\n\n";
        
        if (error.code === 'ECONNABORTED') {
            errorMessage += "⏱️ La requête a expiré. Veuillez réessayer.";
        } else if (error.response) {
            errorMessage += `🔴 Erreur API : ${error.response.status}\n`;
            errorMessage += `📝 ${error.response.data?.message || 'Erreur inconnue'}`;
        } else if (error.request) {
            errorMessage += "🌐 Impossible de contacter l'API.\n💡 Vérifiez votre connexion.";
        } else {
            errorMessage += `⚠️ ${error.message}`;
        }

        await sendMessage(senderId, errorMessage);
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "mistral",
    description: "Discutez avec Grok-4 AI, un assistant intelligent avec support d'images et conversation continue.",
    usage: "Utilisez 'mistral <message>' pour poser une question ou 'mistral' avec une image pour l'analyser.\n\nExemples :\n• mistral Bonjour comment ça va ?\n• mistral Explique-moi la physique quantique\n• [Envoyer une image] mistral Décris cette photo en détail\n\nLa conversation est continue, vous pouvez poser plusieurs questions à la suite !"
};
