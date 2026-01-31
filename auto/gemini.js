const axios = require('axios');
const sendMessage = require('../handles/sendMessage');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Mémorisation des images par utilisateur
const userImageMemory = new Map();

// Configuration de l'API Replit et ImgBB
const API_CONFIG = {
    BASE_URL: "https://gemini-api-wrapper--dukgiqn.replit.app/gemini",
    TIMEOUT: 90000,
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    IMGBB_API_KEY: 'fa76a43cd1f8d1e193f4b3329dda455f'
};

/**
 * Upload une image vers ImgBB pour obtenir une URL publique stable
 */
async function uploadImageToPublic(imageUrl) {
    try {
        console.log('📥 Téléchargement de l\'image depuis:', imageUrl);

        const imageResponse = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 15000,
            maxContentLength: Infinity,
            headers: {
                'User-Agent': API_CONFIG.USER_AGENT
            }
        });

        const imageBuffer = Buffer.from(imageResponse.data);
        console.log('✅ Image téléchargée, taille:', imageBuffer.length, 'bytes');

        const formData = new FormData();
        formData.append('image', imageBuffer.toString('base64'));

        console.log('📤 Upload vers ImgBB...');
        const uploadResponse = await axios.post(`https://api.imgbb.com/1/upload?key=${API_CONFIG.IMGBB_API_KEY}`, formData, {
            headers: formData.getHeaders(),
            timeout: 20000,
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        });

        if (uploadResponse.data && uploadResponse.data.success) {
            const directUrl = uploadResponse.data.data.url;
            console.log('✅ Image uploadée avec succès sur ImgBB:', directUrl);
            return directUrl;
        } else {
            throw new Error('Échec de l\'upload vers ImgBB');
        }
    } catch (error) {
        console.error('❌ Erreur lors de l\'upload de l\'image vers ImgBB:', error.message);
        throw error;
    }
}

// --- Fonctions de formatage de texte ---

function convertMathSubscript(text) {
    if (!text) return "";
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
    return text.replace(/([a-zA-Z])_([0-9a-zA-Z])/g, (match, p1, p2) => {
        return p1 + (subscriptMap[p2] || p2);
    });
}

function convertToBold(text) {
    if (!text) return "";
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

function replaceBranding(text) {
    if (!text) return "";
    return text
        .replace(/Claude/gi, '🍟Cours mathématiques et PC Madagascar✅')
        .replace(/Anthropic/gi, '👉Bruno Rakotomalala ✅');
}

function formatText(text) {
    if (!text) return "";
    let formattedText = text.replace(/^#{1,6}\s+/gm, '');
    
    // Exposants
    formattedText = formattedText.replace(/([a-zA-Z])\^([a-zA-Z0-9])/g, (match, p1, p2) => {
        const subscriptMap = {'0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'};
        return p1 + (subscriptMap[p2] || p2);
    });
    
    formattedText = convertMathSubscript(formattedText);
    
    // Gras
    formattedText = formattedText.replace(/\*\*([^*]+)\*\*/g, (match, p1) => {
        return convertToBold(p1);
    });
    
    return formattedText;
}

function cleanLatexSyntax(text) {
    if (!text) return "";
    return text
        .replace(/\$\$/g, "")
        .replace(/\$/g, "")
        .replace(/\\\[/g, "")
        .replace(/\\\]/g, "")
        .replace(/\\\(|\\\\\(|\\\\\\\(/g, "")
        .replace(/\\\)|\\\\\)|\\\\\\\)/g, "")
        .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "$1/$2")
        .replace(/\\implies/g, "⟹")
        .replace(/\\Rightarrow/g, "⟹")
        .replace(/\\rightarrow/g, "→")
        .replace(/\\leftarrow/g, "←")
        .replace(/\\Leftrightarrow/g, "⟺")
        .replace(/\\leq/g, "≤")
        .replace(/\\geq/g, "≥")
        .replace(/\\neq/g, "≠")
        .replace(/\\approx/g, "≈")
        .replace(/\\infty/g, "∞")
        .replace(/\\sqrt\{([^{}]+)\}/g, "√($1)")
        .replace(/\\boxed\{([^{}]+)\}/g, "【$1】")
        .replace(/\\quad/g, " ")
        .replace(/\\cdot/g, "·")
        .replace(/\\times/g, "×")
        .replace(/\\div/g, "÷")
        .replace(/\\pm/g, "±")
        .replace(/\\sum/g, "∑")
        .replace(/\\prod/g, "∏")
        .replace(/\\int/g, "∫")
        .replace(/\\pi/g, "π")
        .replace(/\\[a-zA-Z]+/g, "")
        .replace(/\\\\/g, "\n")
        .replace(/\{|\}/g, "")
        .replace(/\n\s*\n\s*\n/g, "\n\n")
        .trim();
}

function formatDynamicResponse(text) {
    if (!text) return "";
    let result = text;
    
    // Numérotation en gras
    result = result.replace(/^(\d+)\.\s+/gm, (match, num) => {
        const boldNums = {'0': '𝟎', '1': '𝟏', '2': '𝟐', '3': '𝟑', '4': '𝟒', '5': '𝟓', '6': '𝟔', '7': '𝟕', '8': '𝟖', '9': '𝟗'};
        const boldNum = num.split('').map(d => boldNums[d] || d).join('');
        return `${boldNum}. `;
    });
    
    result = result.replace(/\n(𝟏\.|𝟐\.|𝟑\.|𝟒\.|𝟓\.|𝟔\.|𝟕\.|𝟖\.|𝟗\.)/g, '\n\n▸ $1');
    result = result.replace(/(x\s*=\s*\d+)/gi, '✦ $1 ✦');
    result = result.replace(/(la solution|le résultat|donc|conclusion)/gi, '🔹 $1');
    
    return result;
}

// --- Fonctions d'appel API ---

/**
 * Appelle l'API Gemini en utilisant la méthode POST
 * Paramètres attendus: pro, image, uid
 */
async function callGeminiApi(params) {
    const postData = {
        pro: params.prompt || params.pro,
        image: params.image || null,
        uid: params.uid || null
    };

    console.log(`🔗 Appel API Gemini (POST): ${API_CONFIG.BASE_URL}`);

    try {
        const response = await axios.post(API_CONFIG.BASE_URL, postData, {
            timeout: API_CONFIG.TIMEOUT,
            headers: { 
                'User-Agent': API_CONFIG.USER_AGENT,
                'Content-Type': 'application/json'
            }
        });

        const result = response.data;
        
        // L'API renvoie désormais { status: "success", answer: "..." }
        const answer = result.answer || result.response || (result.status === 'success' ? result.data : null);

        if (!answer) {
            console.error('❌ Réponse API invalide:', result);
            throw new Error(result?.message || result?.error || 'Aucune réponse exploitable reçue de l\'API');
        }

        return replaceBranding(formatText(answer));
    } catch (error) {
        console.error('❌ Erreur API Gemini:', error.message);
        
        // Fallback GET en cas d'erreur persistante sur POST
        if (error.response && (error.response.status === 405 || error.response.status === 404)) {
            console.warn('⚠️ Erreur sur POST, tentative de secours en GET...');
            const getParams = new URLSearchParams();
            getParams.append('pro', postData.pro);
            if (postData.image) getParams.append('image', postData.image);
            if (postData.uid) getParams.append('uid', postData.uid);
            
            const response = await axios.get(`${API_CONFIG.BASE_URL}?${getParams.toString()}`, {
                timeout: API_CONFIG.TIMEOUT,
                headers: { 'User-Agent': API_CONFIG.USER_AGENT }
            });
            const result = response.data;
            const answer = result.answer || result.response || (result.status === 'success' ? result.data : null);
            return replaceBranding(formatText(answer));
        }

        throw error;
    }
}

async function chat(prompt, uid) {
    // Vérifier si l'utilisateur a une image en mémoire
    if (userImageMemory.has(uid)) {
        const imageUrl = userImageMemory.get(uid);
        console.log(`📸 Utilisation de l'image en mémoire pour ${uid}`);
        
        try {
            const response = await callGeminiApi({ prompt, uid, image: imageUrl });
            // Effacer l'image de la mémoire après une réponse réussie
            userImageMemory.delete(uid);
            return response;
        } catch (error) {
            if (error.message.includes("visualiser l'image") || error.message.includes("URL")) {
                userImageMemory.delete(uid);
                throw new Error("L'image en mémoire a expiré ou est inaccessible. Veuillez renvoyer l'image.");
            }
            throw error;
        }
    }
    return await callGeminiApi({ prompt, uid });
}

async function chatWithMultipleImages(prompt, uid, imageUrls) {
    const params = {
        prompt: prompt && prompt.trim() !== "" ? prompt : "Que vois-tu sur cette image",
        uid: uid
    };
    if (imageUrls && imageUrls.length > 0) {
        params.image = await uploadImageToPublic(imageUrls[0]);
    }
    return await callGeminiApi(params);
}

// --- Gestionnaires de messages ---

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
            if (bestBreakPoint !== -1) endIndex = bestBreakPoint;
        } else {
            endIndex = message.length;
        }
        await sendMessage(senderId, message.substring(startIndex, endIndex));
        await new Promise(r => setTimeout(r, 1000));
        startIndex = endIndex;
    }
}

async function handleTextMessage(senderId, message) {
    try {
        if (message && message.toLowerCase() === 'clear') {
            userImageMemory.delete(senderId);
            await sendMessage(senderId, "🔄 Conversation et images réinitialisées avec succès!");
            return;
        }

        if (!message || message.trim() === '') {
            await sendMessage(senderId, "✨🧠 Bonjour! Je suis ✨AMPINGA AI🌟. Posez-moi une question ou envoyez une image!");
            return;
        }

        await sendMessage(senderId, "✨🧠 Analyse en cours... AMPINGA AI réfléchit! ⏳💫");

        const response = await chat(message, senderId);
        const cleanedResponse = cleanLatexSyntax(response);
        const dynamicResponse = formatDynamicResponse(cleanedResponse);

        const formattedResponse = `✅ 𝐀𝐌𝐏𝐈𝐍𝐆𝐀 𝐃'𝐎𝐑 𝐀𝐈 🇲🇬\n━━━━━━━━━━━━━━━━━━━━\n\n✍️ 𝐑é𝐩𝐨𝐧𝐬𝐞 👇\n\n${dynamicResponse}\n\n━━━━━━━━━━━━━━━━━━━━\n🧠 𝙋𝙤𝙬𝙚𝙧𝙚𝙙 𝙗𝙮 👉 @Bruno | Ampinga AI`;

        await sendLongMessage(senderId, formattedResponse);
    } catch (error) {
        console.error("❌ Erreur:", error.message);
        await sendMessage(senderId, `✅ 𝐀𝐌𝐏𝐈𝐍𝐆𝐀 𝐃'𝐎𝐑 𝐀𝐈 🇲🇬\n━━━━━━━━━━━━━━━━━━━━\n\n✍️ 𝐑é𝐩𝐨𝐧𝐬𝐞 👇\n\nDésolé, je n'ai pas pu traiter votre demande.\n\nErreur: ${error.message}\n\n━━━━━━━━━━━━━━━━━━━━\n🧠 𝙋𝙤𝙬𝙚𝙧𝙚𝙙 𝙗𝙮 👉 @Bruno | Ampinga AI`);
    }
}

async function handleImageMessage(senderId, imageUrl) {
    try {
        await sendMessage(senderId, "⏳ Traitement de votre image en cours...");
        
        let finalImageUrl = imageUrl;
        let uploadSuccess = false;

        try {
            finalImageUrl = await uploadImageToPublic(imageUrl);
            uploadSuccess = true;
        } catch (uploadError) {
            console.warn("⚠️ Échec de l'upload public, utilisation de l'URL directe Facebook comme secours.");
            finalImageUrl = imageUrl;
        }
        
        const isUpdate = userImageMemory.has(senderId);
        userImageMemory.set(senderId, finalImageUrl);
        
        const statusMsg = uploadSuccess 
            ? "✅ Image reçue et mémorisée ! ✨🧠" 
            : "✅ Image reçue (mode secours activé) ! ✨🧠";
            
        const updateMsg = isUpdate 
            ? "\n\n🔄 (Une ancienne image a été remplacée)" 
            : "";

        await sendMessage(senderId, `${statusMsg}${updateMsg}\n\nPosez maintenant votre question sur cette image.`);
        
    } catch (error) {
        console.error('❌ Erreur image:', error.message);
        await sendMessage(senderId, `✅ 𝐀𝐌𝐏𝐈𝐍𝐆𝐀 𝐃'𝐎𝐑 𝐀𝐈 🇲🇬\n━━━━━━━━━━━━━━━━━━━━\n\n✍️ 𝐑é𝐩𝐨𝐧𝐬𝐞 👇\n\nDésolé, je n'ai pas pu traiter votre image.\n\nErreur: ${error.message}\n\n━━━━━━━━━━━━━━━━━━━━\n🧠 𝙋𝙤𝙬𝙚𝙧𝙚𝙙 𝙗𝙮 👉 @Bruno | Ampinga AI`);
    }
}

module.exports = {
    handleTextMessage,
    handleImageMessage,
    chat,
    chatWithMultipleImages,
    resetConversation: async (uid) => {
        userImageMemory.delete(uid);
    }
};
