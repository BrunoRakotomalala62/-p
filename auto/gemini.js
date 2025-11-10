const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Variables globales pour le suivi des états utilisateurs
const pendingImages = {};
const conversationHistory = {};

// Configuration de l'API
const API_CONFIG = {
    ENDPOINT: "https://haji-mix-api.gleeze.com/api/anthropic",
    KEY: "669397c862ff2e8c9b606584f50ccfa7684efe4eccc435c0bf51a3eba23dc225",
    MODEL: "claude-opus-4-20250514"
};

// Fonction pour convertir en gras Unicode
function toBoldUnicode(text) {
    const boldMap = {
        'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚',
        'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡',
        'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨',
        'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭',
        'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴',
        'h': '𝗵', 'i': '𝗶', 'j': '𝗷', 'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻',
        'o': '𝗼', 'p': '𝗽', 'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁', 'u': '𝘂',
        'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇',
        '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰',
        '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵'
    };

    return text.split('').map(char => boldMap[char] || char).join('');
}

// Fonction pour formater le texte Markdown
function formatMarkdown(text) {
    // Convertir les mots entre ** en gras Unicode et enlever les astérisques
    let processedText = text.replace(/\*\*(.*?)\*\*/g, (match, content) => {
        return toBoldUnicode(content);
    });

    // Supprimer les ## utilisés pour les titres Markdown
    processedText = processedText.replace(/##\s*/g, '');

    return processedText;
}

// Fonction pour envoyer des messages longs en plusieurs parties si nécessaire
async function sendLongMessage(senderId, message) {
    const MAX_MESSAGE_LENGTH = 2000;

    if (message.length <= MAX_MESSAGE_LENGTH) {
        await sendMessage(senderId, message);
        return;
    }

    const chunks = [];
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

        chunks.push(message.substring(startIndex, endIndex));
        startIndex = endIndex;
    }

    for (let i = 0; i < chunks.length; i++) {
        await sendMessage(senderId, chunks[i]);
        if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

// Fonction principale pour le chat avec Claude
async function chat(prompt, uid, imageUrl = null) {
    try {
        const queryParams = {
            ask: prompt || "",
            model: API_CONFIG.MODEL,
            uid: uid,
            roleplay: "Text",
            max_tokens: 3000,
            stream: false,
            img_url: imageUrl,
            api_key: API_CONFIG.KEY
        };

        const response = await axios.get(API_CONFIG.ENDPOINT, {
            params: queryParams,
            timeout: 60000
        });

        const result = response?.data?.answer;

        if (!result) {
            throw new Error('Aucune réponse reçue de l\'API');
        }

        return result;
    } catch (error) {
        console.error('Erreur chat Prairie AI:', error);
        throw error;
    }
}

// Fonction pour réinitialiser la conversation
async function resetConversation(uid) {
    delete pendingImages[uid];
    delete conversationHistory[uid];
}

// Fonction pour traiter les messages texte
async function handleTextMessage(senderId, message) {
    try {
        // Initialiser l'historique si nécessaire
        if (!conversationHistory[senderId]) {
            conversationHistory[senderId] = {
                messages: [],
                hasImage: false,
                imageUrl: null
            };
        }

        // Si l'utilisateur veut effacer la conversation
        if (message && message.toLowerCase() === 'clear') {
            await resetConversation(senderId);
            await sendMessage(senderId, "🔄 Conversation réinitialisée avec succès!");
            return;
        }

        const imageUrl = pendingImages[senderId] || conversationHistory[senderId].imageUrl || null;

        // Vérifications de base
        if (!message || message.trim() === '') {
            await sendMessage(senderId, "✅ AMPINGA D'OR AI 🇲🇬\n━━━━━━━━━━━━━━\n\nVeuillez poser une question.");
            return;
        }

        // Message d'attente
        await sendMessage(senderId, "✅ AMPINGA D'OR AI 🇲🇬\n━━━━━━━━━━━━━━\n\n⏳ Analyse en cours...");

        // Appeler l'API
        const result = await chat(message, senderId, imageUrl);

        if (!result) {
            await sendMessage(senderId, "✅ AMPINGA D'OR AI 🇲🇬\n━━━━━━━━━━━━━━\n\n⚠️ Aucune réponse reçue de l'API.");
            return;
        }

        // Formater la réponse
        const processedResult = formatMarkdown(result);
        const formattedResponse = `✅ AMPINGA D'OR AI 🇲🇬\n━━━━━━━━━━━━━━\n\n✍️Réponse 👇\n\n${processedResult}\n━━━━━━━━━━━━━━━━━━\n🧠 Powered by 👉@Bruno | Ampinga AI`;

        // Envoyer la réponse
        await sendLongMessage(senderId, formattedResponse);

        // Mettre à jour l'historique
        conversationHistory[senderId].hasImage = !!imageUrl;
        conversationHistory[senderId].imageUrl = imageUrl;

    } catch (error) {
        console.error("❌ Erreur Ampinga AI:", error?.response?.data || error.message || error);
        await sendMessage(senderId, `✅ AMPINGA D'OR AI 🇲🇬\n━━━━━━━━━━━━━━\n\n✍️Réponse 👇\n\nDésolé, je n'ai pas pu traiter votre demande.\n━━━━━━━━━━━━━━━━━━\n🧠 Powered by 👉@Bruno | Ampinga AI`);
    }
}

// Fonction pour traiter les images
async function handleImageMessage(senderId, imageUrl) {
    try {
        // Stocker l'image en attente
        pendingImages[senderId] = imageUrl;

        // Initialiser l'historique si nécessaire
        if (!conversationHistory[senderId]) {
            conversationHistory[senderId] = {
                messages: [],
                hasImage: false,
                imageUrl: null
            };
        }

        conversationHistory[senderId].hasImage = true;
        conversationHistory[senderId].imageUrl = imageUrl;

        await sendMessage(senderId, "Merci beaucoup pour cette photo et j'ai bien reçu quel est votre question concernant cette photo");

    } catch (error) {
        console.error('Erreur lors du traitement de l\'image:', error);
        await sendMessage(senderId, "❌ Une erreur s'est produite lors du traitement de votre image. Veuillez réessayer.");
    }
}

module.exports = {
    handleTextMessage,
    handleImageMessage,
    chat,
    resetConversation
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "prairie",
    description: "Analysez des images avec l'intelligence artificielle Claude. Envoyez une image puis posez vos questions.",
    usage: "Envoyez une image en pièce jointe, puis posez votre question.",
    author: "Bruno"
};
