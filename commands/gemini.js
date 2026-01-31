const axios = require('axios');
const sendMessage = require('../handles/sendMessage');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const conversationHistory = new Map();

// Configuration de l'API Replit et Catbox
const API_CONFIG = {
    BASE_URL: "https://gemini-api-wrapper--dukgiqn.replit.app/gemini",
    TIMEOUT: 90000,
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

async function uploadImageToCatbox(imageUrl) {
    try {
        console.log('📥 Téléchargement de l\'image depuis:', imageUrl);

        const imageResponse = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            maxContentLength: Infinity,
            headers: {
                'User-Agent': API_CONFIG.USER_AGENT
            }
        });

        const imageBuffer = Buffer.from(imageResponse.data);
        console.log('✅ Image téléchargée, taille:', imageBuffer.length, 'bytes');

        const formData = new FormData();
        formData.append('reqtype', 'fileupload');
        formData.append('fileToUpload', imageBuffer, {
            filename: 'image.jpg',
            contentType: imageResponse.headers['content-type'] || 'image/jpeg'
        });

        console.log('📤 Upload vers catbox.moe...');
        const uploadResponse = await axios.post('https://catbox.moe/user/api.php', formData, {
            headers: formData.getHeaders(),
            timeout: 30000,
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        });

        const publicUrl = uploadResponse.data.trim();

        if (!publicUrl.startsWith('https://')) {
            console.error('❌ Réponse invalide de catbox:', publicUrl);
            throw new Error('Service d\'hébergement indisponible');
        }

        console.log('✅ Image uploadée avec succès:', publicUrl);

        return publicUrl;
    } catch (error) {
        console.error('❌ Erreur lors de l\'upload de l\'image:', error.message);
        throw new Error(`Impossible d'uploader l'image: ${error.message}`);
    }
}

// Fonction pour convertir uniquement les notations mathématiques avec underscore en subscript Unicode
function convertMathSubscript(text) {
    if (!text) return "";
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

    return text.replace(/([a-zA-Z])_([0-9a-zA-Z])/g, (match, p1, p2) => {
        return p1 + (subscriptMap[p2] || p2);
    });
}

// Fonction pour le chat simple
async function chat(prompt, uid) {
    try {
        const response = await axios.get(API_CONFIG.BASE_URL, {
            params: {
                pro: prompt,
                uid: uid
            },
            timeout: API_CONFIG.TIMEOUT,
            headers: { 'User-Agent': API_CONFIG.USER_AGENT }
        });
        
        const result = response.data;
        const answer = result.answer || result.response || (result.status === 'success' ? result.data : null);

        if (!answer) {
            throw new Error('Aucune réponse reçue');
        }

        return convertMathSubscript(answer);
    } catch (error) {
        console.error('Erreur chat Gemini:', error);
        throw error;
    }
}

// Fonction pour le chat avec plusieurs images
async function chatWithMultipleImages(prompt, uid, imageUrls) {
    try {
        const params = {
            pro: prompt,
            uid: uid
        };

        // L'API actuelle semble ne supporter qu'une seule image via le paramètre 'image'
        // Si plusieurs images sont envoyées, on utilise la première
        if (imageUrls && imageUrls.length > 0) {
            params.image = imageUrls[0];
        }

        const response = await axios.get(API_CONFIG.BASE_URL, {
            params: params,
            timeout: API_CONFIG.TIMEOUT,
            headers: { 'User-Agent': API_CONFIG.USER_AGENT }
        });
        
        const result = response.data;
        const answer = result.answer || result.response || (result.status === 'success' ? result.data : null);

        if (!answer) {
            throw new Error('Aucune réponse reçue');
        }

        return convertMathSubscript(answer);
    } catch (error) {
        console.error('Erreur chat avec images Gemini:', error);
        throw error;
    }
}

// Fonction pour réinitialiser la conversation
async function resetConversation(uid) {
    conversationHistory.delete(uid);
}

// Stockage des images en attente par utilisateur
const pendingImages = {}; 
const conversationHistoryOld = {};

// Fonction pour nettoyer la syntaxe LaTeX
function cleanLatexSyntax(text) {
    if (!text) return "";
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

// Fonction pour envoyer des messages longs
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
        await sendMessage(senderId, message.substring(startIndex, endIndex));
        await new Promise(resolve => setTimeout(resolve, 1000));
        startIndex = endIndex;
    }
}

// Fonction pour traiter les messages texte
async function handleTextMessage(senderId, message) {
    try {
        if (!conversationHistoryOld[senderId]) {
            conversationHistoryOld[senderId] = { hasImage: false, imageUrl: null };
        }

        if (message && message.toLowerCase() === 'clear') {
            delete conversationHistoryOld[senderId];
            delete pendingImages[senderId];
            await resetConversation(senderId);
            await sendMessage(senderId, "🔄 Conversation réinitialisée avec succès!");
            return;
        }

        const hasImages = pendingImages[senderId] && pendingImages[senderId].length > 0;
        if ((!message || message.trim() === '') && !hasImages && !conversationHistoryOld[senderId].hasImage) {
            await sendMessage(senderId, "✨🧠 Bonjour! Je suis ✨AMPINGA AI🌟. Comment puis-je vous aider aujourd'hui? Posez-moi n'importe quelle question ou partagez une image pour que je puisse l'analyser!");
            return;
        }

        await sendMessage(senderId, "✨🧠 Analyse en cours... AMPINGA AI réfléchit à votre requête! ⏳💫");

        let response;
        let imageUrls = pendingImages[senderId] || (conversationHistoryOld[senderId].imageUrl ? [conversationHistoryOld[senderId].imageUrl] : null);

        if (imageUrls && imageUrls.length > 0) {
            response = await chatWithMultipleImages(message || "Décrivez cette photo", senderId, imageUrls);
            conversationHistoryOld[senderId].hasImage = true;
            conversationHistoryOld[senderId].imageUrl = imageUrls[0];
        } else {
            response = await chat(message, senderId);
            conversationHistoryOld[senderId].hasImage = false;
            conversationHistoryOld[senderId].imageUrl = null;
        }

        if (!response) {
            await sendMessage(senderId, "⚠️ Aucune réponse reçue de l'API.");
            return;
        }

        const cleanedResponse = cleanLatexSyntax(response);
        const formattedResponse = `✅ AMPINGA D'OR AI 🇲🇬\n━━━━━━━━━━━━━━\n\n✍️Réponse 👇\n\n${cleanedResponse}\n━━━━━━━━━━━━━━━━━━\n🧠 Powered by 👉@Bruno | Ampinga AI`;

        await sendLongMessage(senderId, formattedResponse);

        if (pendingImages[senderId]) {
            delete pendingImages[senderId];
        }

    } catch (error) {
        console.error("❌ Erreur AMPINGA AI:", error.message);
        await sendMessage(senderId, `⚠️ *OUPS! ERREUR TECHNIQUE* ⚠️\n━━━━━━━━━━━━━━━━━━━━━━━━━━\nUne erreur s'est produite lors de la communication avec AMPINGA AI.\n\n🔄 Si le problème persiste, essayez une autre commande ou contactez l'administrateur.\n━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    }
}

// Fonction pour traiter les images
async function handleImageMessage(senderId, imageUrl) {
    try {
        await sendMessage(senderId, "⏳ Traitement de votre image en cours...");
        
        let publicImageUrl;
        try {
            publicImageUrl = await uploadImageToCatbox(imageUrl);
        } catch (uploadError) {
            console.error('❌ Erreur upload catbox:', uploadError);
            publicImageUrl = imageUrl; // Secours
        }

        if (!pendingImages[senderId]) {
            pendingImages[senderId] = [];
        }
        pendingImages[senderId].push(publicImageUrl);

        if (!conversationHistoryOld[senderId]) {
            conversationHistoryOld[senderId] = { hasImage: false, imageUrl: null };
        }
        conversationHistoryOld[senderId].hasImage = true;
        conversationHistoryOld[senderId].imageUrl = publicImageUrl;

        await sendMessage(senderId, `✨📸 J'ai bien reçu votre image! Que voulez-vous savoir à propos de cette photo? Posez-moi votre question! 🔍🖼️`);

    } catch (error) {
        console.error('Erreur lors du traitement de l\'image :', error.message);
        await sendMessage(senderId, "❌ Une erreur s'est produite lors du traitement de votre image.");
    }
}

module.exports = {
    handleTextMessage,
    handleImageMessage,
    chat,
    chatWithMultipleImages,
    resetConversation
};
