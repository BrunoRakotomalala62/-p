const axios = require('axios');
const sendMessage = require('../handles/sendMessage');
const fs = require('fs');
const path = require('path');

const conversationHistory = new Map();

// Fonction pour convertir uniquement les notations mathématiques avec underscore en subscript Unicode
function convertMathSubscript(text) {
    const subscriptMap = {
        '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
        'a': 'ₐ', 'b': '♭', 'c': '𝒸', 'd': '𝒹', 'e': 'ₑ', 'f': '𝒻', 'g': 'ℊ', 'h': '𝒽', 'i': 'ᵢ', 'j': 'ⱼ',
        'k': '𝓀', 'l': '𝓁', 'm': 'ℳ', 'n': 'ₙ', 'o': 'ℴ', 'p': '𝓅', 'q': '𝓆', 'r': '𝓇', 's': '𝓈', 't': '𝓉',
        'u': '𝓊', 'v': '𝓋', 'w': '𝓌', 'x': '𝓍', 'y': '𝓎', 'z': '𝓏',
        'A': 'Ɐ', 'B': 'B', 'C': 'C', 'D': 'D', 'E': 'E', 'F': 'F', 'G': 'G', 'H': 'H', 'I': 'I', 'J': 'J',
        'K': 'K', 'L': 'L', 'M': 'M', 'N': 'N', 'O': 'O', 'P': 'P', 'Q': 'Q', 'R': 'R', 'S': 'S', 'T': 'T',
        'U': 'U', 'V': 'V', 'W': 'W', 'X': 'X', 'Y': 'Y', 'Z': 'Z',
        '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾'
    };

    // Utilise une expression régulière pour trouver les motifs comme U_n, U_0, etc.
    // et remplace seulement la partie qui suit l'underscore par le caractère subscript
    return text.replace(/([a-zA-Z])_([0-9a-zA-Z])/g, (match, p1, p2) => {
        return p1 + (subscriptMap[p2] || p2);
    });
}

// Fonction pour convertir en superscript Unicode
function convertToSuperscript(text) {
    const superscriptMap = {
        '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
        'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ', 'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ',
        'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'n': 'ⁿ', 'o': 'ᵒ', 'p': 'ᵖ', 'q': '𝓆', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ',
        'u': 'ᵘ', 'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ',
        'A': 'ᴬ', 'B': 'ᴮ', 'C': 'ᶜ', 'D': 'ᴰ', 'E': 'ᴱ', 'F': 'ᶠ', 'G': 'ᴳ', 'H': 'ᴴ', 'I': 'ᴵ', 'J': 'ᴶ',
        'K': 'ᴷ', 'L': 'ᴸ', 'M': 'ᴹ', 'N': 'ᴺ', 'O': 'ᴼ', 'P': 'ᴾ', 'Q': 'Q', 'R': 'ᴿ', 'S': 'ˢ', 'T': 'ᵀ',
        'U': 'ᵁ', 'V': 'ⱽ', 'W': 'ᵂ', 'X': 'ˣ', 'Y': 'ʸ', 'Z': 'ᶻ',
        '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾'
    };
    let result = '';
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        result += superscriptMap[char] || char;
    }
    return result;
}

// Fonction pour le chat simple
async function chat(prompt, uid) {
    try {
        const API_ENDPOINT = "https://gemimagprompt.vercel.app/";

        const queryParams = new URLSearchParams({
            question: prompt,
            uid: uid
        });

        const response = await axios.get(`${API_ENDPOINT}?${queryParams.toString()}`);
        const result = response.data;

        // La réponse est directement le texte
        if (!result) {
            throw new Error('Aucune réponse reçue');
        }

        // Convertir les indices mathématiques en format subscript
        return convertMathSubscript(result);
    } catch (error) {
        console.error('Erreur chat Gemini:', error);
        throw error;
    }
}

// Fonction pour le chat avec image
async function chatWithImage(prompt, uid, imagePath) {
    try {
        const API_ENDPOINT = "https://gemimagprompt.vercel.app/";

        // Vérifier si imagePath est une URL ou un chemin local
        let imageUrl = imagePath;

        // Si c'est un chemin local, on ne peut pas l'utiliser directement avec cette API
        // L'API nécessite une URL d'image accessible
        if (!imagePath.startsWith('http')) {
            throw new Error('Cette API nécessite une URL d\'image accessible publiquement');
        }

        const queryParams = new URLSearchParams({
            question: prompt,
            image: imageUrl,
            uid: uid
        });

        const response = await axios.get(`${API_ENDPOINT}?${queryParams.toString()}`);
        const result = response.data;

        if (!result) {
            throw new Error('Aucune réponse reçue');
        }

        // Convertir les indices mathématiques en format subscript
        return convertMathSubscript(result);
    } catch (error) {
        console.error('Erreur chat avec image Gemini:', error);
        throw error;
    }
}

// Fonction pour réinitialiser la conversation
async function resetConversation(uid) {
    conversationHistory.delete(uid);
}

// Stockage des images en attente par utilisateur
const pendingImages = {};

// Stockage de l'historique de conversation par utilisateur
const conversationHistoryOld = {};

// Fonction pour nettoyer la syntaxe LaTeX
function cleanLatexSyntax(text) {
    return text
        .replace(/\$\$/g, "")
        .replace(/\$/g, "")
        .replace(/\\\(|\\\\\(|\\\\\\\(/g, "")
        .replace(/\\\)|\\\\\)|\\\\\\\)/g, "")
        .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "$1/$2")
        .replace(/\\implies/g, "=>")
        .replace(/\\boxed\{([^{}]+)\}/g, "[$1]")
        .replace(/\\quad/g, " ")
        .replace(/\\cdot/g, "×")
        .replace(/\\times/g, "×")
        .replace(/\\div/g, "÷")
        .replace(/\\text\{([^{}]+)\}/g, "$1")
        .replace(/\\equiv[^\\]*\\pmod\{([^{}]+)\}/g, "≡ (mod $1)")
        .replace(/\\[a-zA-Z]+/g, "")
        .replace(/\\\\/g, "")
        .replace(/\{|\}/g, "");
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

// Fonction pour traiter les messages texte
async function handleTextMessage(senderId, message) {
    try {
        // Initialiser l'historique de conversation si nécessaire
        if (!conversationHistoryOld[senderId]) {
            conversationHistoryOld[senderId] = {
                messages: [],
                hasImage: false,
                imageUrl: null
            };
        }

        // Si l'utilisateur veut effacer la conversation
        if (message && message.toLowerCase() === 'clear') {
            delete conversationHistoryOld[senderId];
            delete pendingImages[senderId];
            await resetConversation(senderId);
            await sendMessage(senderId, "🔄 Conversation réinitialisée avec succès!");
            return;
        }

        // Si le message est vide et qu'il n'y a pas d'image
        if ((!message || message.trim() === '') && !pendingImages[senderId] && !conversationHistoryOld[senderId].hasImage) {
            await sendMessage(senderId, "✨🧠 Bonjour! Je suis ✨AMPINGA AI🌟. Comment puis-je vous aider aujourd'hui? Posez-moi n'importe quelle question ou partagez une image pour que je puisse l'analyser!");
            return;
        }

        // Envoyer un message d'attente
        await sendMessage(senderId, "✨🧠 Analyse en cours... AMPINGA AI réfléchit à votre requête! ⏳💫");

        let response;
        let imageUrl = pendingImages[senderId] || conversationHistoryOld[senderId].imageUrl || null;

        if (imageUrl) {
            try {
                response = await chatWithImage(message || "Décrivez cette photo", senderId, imageUrl);
                conversationHistoryOld[senderId].hasImage = true;
                conversationHistoryOld[senderId].imageUrl = imageUrl;
            } catch (error) {
                console.error("Erreur lors de l'appel à chatWithImage:", error);
                response = "Désolé, je n'ai pas pu traiter votre image. Assurez-vous que l'URL de l'image est accessible publiquement.";
                delete pendingImages[senderId];
                conversationHistoryOld[senderId].imageUrl = null;
                conversationHistoryOld[senderId].hasImage = false;
            }
        } else {
            try {
                response = await chat(message, senderId);
                conversationHistoryOld[senderId].hasImage = false;
                conversationHistoryOld[senderId].imageUrl = null;
            } catch (error) {
                console.error("Erreur lors de l'appel à chat:", error);
                response = "Désolé, je n'ai pas pu traiter votre demande.";
            }
        }

        if (!response) {
            await sendMessage(senderId, "⚠️ Aucune réponse reçue de l'API.");
            return;
        }

        // Nettoyer les symboles LaTeX de la réponse
        const cleanedResponse = cleanLatexSyntax(response);

        // Formater la réponse
        const formattedResponse = `
✅ AMPINGA D'OR AI 🇲🇬
━━━━━━━━━━━━━━

✍️Réponse 👇

${cleanedResponse}
━━━━━━━━━━━━━━━━━━
🧠 Powered by 👉@Bruno | Ampinga AI
`;

        // Envoyer la réponse formatée
        await sendLongMessage(senderId, formattedResponse);

        // Supprimer de pendingImages après traitement
        if (pendingImages[senderId]) {
            delete pendingImages[senderId];
        }

    } catch (error) {
        console.error("❌ Erreur AMPINGA AI:", error?.response?.data || error.message || error);
        await sendMessage(senderId, `
⚠️ *OUPS! ERREUR TECHNIQUE* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors de la communication avec AMPINGA AI.
Veuillez réessayer dans quelques instants.

🔄 Si le problème persiste, essayez une autre commande
ou contactez l'administrateur.
━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    }
}

// Fonction pour traiter les images
async function handleImageMessage(senderId, imageUrl) {
    try {
        // Stocker l'URL de l'image pour cet utilisateur
        pendingImages[senderId] = imageUrl;

        if (!conversationHistoryOld[senderId]) {
            conversationHistoryOld[senderId] = {
                messages: [],
                hasImage: false,
                imageUrl: null
            };
        }

        conversationHistoryOld[senderId].hasImage = true;
        conversationHistoryOld[senderId].imageUrl = imageUrl;

        // Envoyer un message confirmant la réception de l'image
        await sendMessage(senderId, "✨📸 J'ai bien reçu votre image! Que voulez-vous savoir à propos de cette photo? Posez-moi votre question! 🔍🖼️");

    } catch (error) {
        console.error('Erreur lors du traitement de l\'image :', error.response ? error.response.data : error.message);
        await sendMessage(senderId, "✨📸 J'ai bien reçu votre image! Que voulez-vous savoir à propos de cette photo? Posez-moi votre question! 🔍🖼️");
    }
}

module.exports = {
    handleTextMessage,
    handleImageMessage,
    chat,
    chatWithImage,
    resetConversation
};