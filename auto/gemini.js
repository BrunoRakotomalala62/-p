const axios = require('axios');
const sendMessage = require('../handles/sendMessage');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const conversationHistory = new Map();

async function uploadImageToCatbox(imageUrl) {
    try {
        console.log('📥 Téléchargement de l\'image depuis:', imageUrl);

        const imageResponse = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            maxContentLength: Infinity,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
    const subscriptMap = {
        '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
        'a': 'ₐ', 'b': '♭', 'c': '𝒸', 'd': '𝒹', 'e': 'ₑ', 'f': '𝒻', 'g': 'ℊ', 'h': '𝒽', 'i': 'ᵢ', 'j': 'ⱼ',
        'k': '𝓀', 'l': '𝓁', 'm': 'ℳ', 'n': 'ₙ', 'o': 'ℴ', 'p': '𝓅', 'q': '𝓆', 'r': '𝓇', 's': '𝓈', 't': '𝓉',
        'u': '𝓊', 'v': '𝓋', 'w': '𝓌', 'x': '𝓍', 'y': '𝓎', 'z': '𝓏',
        'A': 'ᴬ', 'B': 'ᴮ', 'C': 'ᶜ', 'D': 'ᴰ', 'E': 'ᴱ', 'F': 'ᶠ', 'G': 'ᴳ', 'H': 'ᴴ', 'I': 'ᴵ', 'J': 'ᴶ',
        'K': 'ᴷ', 'L': 'ᴸ', 'M': 'ᴹ', 'N': 'ᴺ', 'O': 'ᴼ', 'P': 'ᴾ', 'Q': 'Q', 'R': 'ᴿ', 'S': 'ˢ', 'T': 'ᵀ',
        'U': 'ᵁ', 'V': 'ⱽ', 'W': 'ᵂ', 'X': 'ˣ', 'Y': 'ʸ', 'Z': 'ᶻ',
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

// Fonction pour convertir en gras Unicode (pour texte entre ** **)
function convertToBold(text) {
    const boldMap = {
        'A': '𝐀', 'B': '𝐁', 'C': '𝐂', 'D': '𝐃', 'E': '𝐄', 'F': '𝐅', 'G': '𝐆', 'H': '𝐇', 'I': '𝐈', 'J': '𝐉',
        'K': '𝐊', 'L': '𝐋', 'M': '𝐌', 'N': '𝐍', 'O': '𝐎', 'P': '𝐏', 'Q': '𝐐', 'R': '𝐑', 'S': '𝐒', 'T': '𝐓',
        'U': '𝐔', 'V': '𝐕', 'W': '𝐖', 'X': '𝐗', 'Y': '𝐘', 'Z': '𝐙',
        'a': '𝐚', 'b': '𝐛', 'c': '𝐜', 'd': '𝐝', 'e': '𝐞', 'f': '𝐟', 'g': '𝐠', 'h': '𝐡', 'i': '𝐢', 'j': '𝐣',
        'k': '𝐤', 'l': '𝐥', 'm': '𝐦', 'n': '𝐧', 'o': '𝐨', 'p': '𝐩', 'q': '𝐪', 'r': '𝐫', 's': '𝐬', 't': '𝐭',
        'u': '𝐮', 'v': '𝐯', 'w': '𝐰', 'x': '𝐱', 'y': '𝐲', 'z': '𝐳',
        '0': '𝟎', '1': '𝟏', '2': '𝟐', '3': '𝟑', '4': '𝟒', '5': '𝟓', '6': '𝟔', '7': '𝟕', '8': '𝟖', '9': '𝟗'
    };
    let result = '';
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        result += boldMap[char] || char;
    }
    return result;
}

// Fonction pour convertir un caractère en subscript
function convertCharToSubscript(char) {
    const subscriptMap = {
        '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
        'a': 'ₐ', 'b': '♭', 'c': '𝒸', 'd': '𝒹', 'e': 'ₑ', 'f': '𝒻', 'g': 'ℊ', 'h': '𝒽', 'i': 'ᵢ', 'j': 'ⱼ',
        'k': '𝓀', 'l': '𝓁', 'm': 'ℳ', 'n': 'ₙ', 'o': 'ℴ', 'p': '𝓅', 'q': '𝓆', 'r': '𝓇', 's': '𝓈', 't': '𝓉',
        'u': '𝓊', 'v': '𝓋', 'w': '𝓌', 'x': '𝓍', 'y': '𝓎', 'z': '𝓏',
        'A': 'ᴬ', 'B': 'ᴮ', 'C': 'ᶜ', 'D': 'ᴰ', 'E': 'ᴱ', 'F': 'ᶠ', 'G': 'ᴳ', 'H': 'ᴴ', 'I': 'ᴵ', 'J': 'ᴶ',
        'K': 'ᴷ', 'L': 'ᴸ', 'M': 'ᴹ', 'N': 'ᴺ', 'O': 'ᴼ', 'P': 'ᴾ', 'Q': 'Q', 'R': 'ᴿ', 'S': 'ˢ', 'T': 'ᵀ',
        'U': 'ᵁ', 'V': 'ⱽ', 'W': 'ᵂ', 'X': 'ˣ', 'Y': 'ʸ', 'Z': 'ᶻ',
        '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾'
    };
    return subscriptMap[char] || char;
}

// Fonction pour remplacer les mentions de Claude et Anthropic
function replaceBranding(text) {
    let result = text;
    // Remplacer Claude (insensible à la casse) par le nouveau nom
    result = result.replace(/Claude/gi, '🍟Cours mathématiques et PC Madagascar✅');
    // Remplacer Anthropic (insensible à la casse) par le nouveau nom
    result = result.replace(/Anthropic/gi, '👉Bruno Rakotomalala ✅');
    return result;
}

// Fonction pour formater le texte avec gras et subscript
function formatText(text) {
    // Supprimer les marqueurs de titre Markdown (#, ##, ###, etc.)
    let formattedText = text.replace(/^#{1,6}\s+/gm, '');
    
    // Convertir les indices avec ^ en subscript (z^A, z^B, etc.)
    formattedText = formattedText.replace(/([a-zA-Z])\^([a-zA-Z0-9])/g, (match, p1, p2) => {
        return p1 + convertCharToSubscript(p2);
    });
    
    // Convertir les subscripts mathématiques (U_0, U_n, etc.)
    formattedText = convertMathSubscript(formattedText);
    
    // Ensuite convertir le texte entre ** ** en gras Unicode
    formattedText = formattedText.replace(/\*\*([^*]+)\*\*/g, (match, p1) => {
        return convertToBold(p1);
    });
    
    return formattedText;
}

// Fonction pour le chat simple
async function chat(prompt, uid) {
    try {
        const API_ENDPOINT = "https://rapido.zetsu.xyz/api/anthropic";
        const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';
        const API_KEY = 'rapi_4806a41790cd4a83921d56b667ab3f16';

        const params = {
            q: prompt,
            uid: uid,
            model: DEFAULT_MODEL,
            image: '',
            max_tokens: '',
            apikey: API_KEY
        };

        const apiUrl = `${API_ENDPOINT}?${new URLSearchParams(params).toString()}`;
        console.log('🔗 Appel API chat:', apiUrl);

        const response = await axios.get(API_ENDPOINT, {
            params: params,
            timeout: 60000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8'
            }
        });
        const result = response.data;

        console.log('✅ Réponse API chat reçue:', JSON.stringify(result).substring(0, 200));

        if (!result || !result.response) {
            console.error('❌ Réponse API invalide:', result);
            throw new Error(result?.error || 'Aucune réponse reçue de l\'API');
        }

        return replaceBranding(formatText(result.response));
    } catch (error) {
        console.error('❌ Erreur chat Anthropic:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
            console.error('Headers:', error.response.headers);
        }
        throw error;
    }
}

// Fonction pour le chat avec plusieurs images
async function chatWithMultipleImages(prompt, uid, imageUrls) {
    try {
        const API_ENDPOINT = "https://rapido.zetsu.xyz/api/anthropic";
        const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';
        const API_KEY = 'rapi_4806a41790cd4a83921d56b667ab3f16';

        const imageUrl = imageUrls[0];
        const finalPrompt = prompt && prompt.trim() !== "" ? prompt : "Décrivez bien cette photo";

        const params = {
            q: finalPrompt,
            uid: uid,
            model: DEFAULT_MODEL,
            image: imageUrl,
            max_tokens: '',
            apikey: API_KEY
        };

        const apiUrl = `${API_ENDPOINT}?${new URLSearchParams(params).toString()}`;
        console.log('🔗 Appel API image:', apiUrl);

        const response = await axios.get(API_ENDPOINT, {
            params: params,
            timeout: 60000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8'
            }
        });
        const result = response.data;

        console.log('✅ Réponse API image reçue:', JSON.stringify(result).substring(0, 200));

        if (!result || !result.response) {
            console.error('❌ Réponse API invalide:', result);
            throw new Error(result?.error || 'Aucune réponse reçue de l\'API');
        }

        return replaceBranding(formatText(result.response));
    } catch (error) {
        console.error('❌ Erreur chat avec images Anthropic:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
            console.error('Headers:', error.response.headers);
        }
        throw error;
    }
}

// Fonction pour le chat avec image (ancienne version, pour compatibilité)
async function chatWithImage(prompt, uid, imagePath) {
    try {
        // Si c'est une URL, utiliser directement la nouvelle API
        if (imagePath.startsWith('http')) {
            return await chatWithMultipleImages(prompt, uid, [imagePath]);
        }

        // Si c'est un chemin local, on ne peut pas l'utiliser directement
        throw new Error('Cette API nécessite une URL d\'image accessible publiquement');
    } catch (error) {
        console.error('Erreur chat avec image Gemini:', error);
        throw error;
    }
}

// Fonction pour réinitialiser la conversation
async function resetConversation(uid) {
    conversationHistory.delete(uid);
}

// Stockage des images en attente par utilisateur (MULTIPLE IMAGES)
const pendingImages = {}; // Format: { senderId: [url1, url2, url3, ...] }

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
        const hasImages = pendingImages[senderId] && pendingImages[senderId].length > 0;
        if ((!message || message.trim() === '') && !hasImages && !conversationHistoryOld[senderId].hasImage) {
            await sendMessage(senderId, "✨🧠 Bonjour! Je suis ✨AMPINGA AI🌟. Comment puis-je vous aider aujourd'hui? Posez-moi n'importe quelle question ou partagez une image pour que je puisse l'analyser!");
            return;
        }

        // Envoyer un message d'attente
        await sendMessage(senderId, "✨🧠 Analyse en cours... AMPINGA AI réfléchit à votre requête! ⏳💫");

        let response;
        let imageUrls = pendingImages[senderId] || (conversationHistoryOld[senderId].imageUrl ? [conversationHistoryOld[senderId].imageUrl] : null);

        if (imageUrls && imageUrls.length > 0) {
            try {
                console.log('📸 Traitement avec image(s):', imageUrls.length);
                response = await chatWithMultipleImages(message || "Décrivez ces photos", senderId, imageUrls);
                conversationHistoryOld[senderId].hasImage = true;
                conversationHistoryOld[senderId].imageUrl = imageUrls[0];
            } catch (error) {
                console.error("❌ Erreur lors de l'appel à chatWithMultipleImages:", error.message);
                console.error("Détails de l'erreur:", error.response?.data || error);
                response = `Désolé, je n'ai pas pu traiter vos images.\n\nErreur: ${error.message}\n\nAssurez-vous que les URLs des images sont accessibles publiquement.`;
                delete pendingImages[senderId];
                conversationHistoryOld[senderId].imageUrl = null;
                conversationHistoryOld[senderId].hasImage = false;
            }
        } else {
            try {
                console.log('💬 Traitement sans image, message:', message);
                response = await chat(message, senderId);
                conversationHistoryOld[senderId].hasImage = false;
                conversationHistoryOld[senderId].imageUrl = null;
            } catch (error) {
                console.error("❌ Erreur lors de l'appel à chat:", error.message);
                console.error("Détails de l'erreur:", error.response?.data || error);
                response = `Désolé, je n'ai pas pu traiter votre demande.\n\nErreur: ${error.message}`;
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

// Fonction pour traiter les images (SUPPORTE PLUSIEURS IMAGES)
async function handleImageMessage(senderId, imageUrl) {
    try {
        await sendMessage(senderId, "⏳ Traitement de votre image en cours...");

        console.log('🖼️ Réception image pour utilisateur:', senderId);
        console.log('📍 URL originale:', imageUrl);

        let publicImageUrl;
        try {
            publicImageUrl = await uploadImageToCatbox(imageUrl);
            console.log('✅ URL publique créée:', publicImageUrl);
        } catch (uploadError) {
            console.error('❌ Erreur upload catbox:', uploadError);
            await sendMessage(senderId, "❌ Désolé, je n'ai pas pu traiter votre image. Veuillez réessayer.");
            return;
        }

        // Initialiser le tableau d'images si nécessaire
        if (!pendingImages[senderId]) {
            pendingImages[senderId] = [];
        }

        // Ajouter l'image au tableau
        pendingImages[senderId].push(publicImageUrl);

        if (!conversationHistoryOld[senderId]) {
            conversationHistoryOld[senderId] = {
                messages: [],
                hasImage: false,
                imageUrl: null
            };
        }

        conversationHistoryOld[senderId].hasImage = true;
        conversationHistoryOld[senderId].imageUrl = publicImageUrl;

        await sendMessage(senderId, `✨📸 Parfait ! J'ai bien reçu votre photo. 

Quelle est votre question concernant cette image ? 🔍

💡 Vous pouvez me demander de :
• Décrire cette photo en détail
• Identifier des éléments spécifiques
• Analyser le contenu
• Ou toute autre question !`);

    } catch (error) {
        console.error('Erreur lors du traitement de l\'image :', error.response ? error.response.data : error.message);
        await sendMessage(senderId, "❌ Une erreur s'est produite lors du traitement de votre image. Veuillez réessayer ou contacter l'administrateur si le problème persiste.");
    }
}

module.exports = {
    handleTextMessage,
    handleImageMessage,
    chat,
    chatWithImage,
    chatWithMultipleImages,
    resetConversation
};
            
