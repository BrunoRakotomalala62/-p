const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const conversationHistory = {};
const pendingImages = {};

function toBoldUnicode(text) {
    const boldMap = {
        'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚', 'H': '𝗛', 'I': '𝗜', 'J': '𝗝',
        'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧',
        'U': '𝗨', 'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭',
        'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴', 'h': '𝗵', 'i': '𝗶', 'j': '𝗷',
        'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼', 'p': '𝗽', 'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁',
        'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇',
        '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰', '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵'
    };
    
    return text.split('').map(char => boldMap[char] || char).join('');
}

function convertMarkdownHeaders(text) {
    const lines = text.split('\n');
    const processedLines = lines.map(line => {
        if (line.match(/^###\s+(.+)$/)) {
            const content = line.replace(/^###\s+/, '');
            return toBoldUnicode(content);
        }
        else if (line.match(/^##\s+(.+)$/)) {
            const content = line.replace(/^##\s+/, '');
            return toBoldUnicode(content);
        }
        else if (line.match(/^#\s+(.+)$/)) {
            const content = line.replace(/^#\s+/, '');
            return toBoldUnicode(content);
        }
        return line;
    });
    
    return processedLines.join('\n');
}

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
            const separators = ['\n\n', '. ', '.\n', ', ', '! ', '? ', '!\n', '?\n', '\n', ' '];
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
        await new Promise(resolve => setTimeout(resolve, 800));

        startIndex = endIndex;
    }
}

async function callOpenRouteAPI(uid, prompt, imageUrl = null) {
    try {
        let apiUrl = `https://api-geminiplusieursphoto2026.vercel.app/open?uid=${encodeURIComponent(uid)}&route=${encodeURIComponent(prompt)}`;
        
        if (imageUrl) {
            apiUrl += `&imagurl=${encodeURIComponent(imageUrl)}`;
        }

        const response = await axios.get(apiUrl, {
            timeout: 60000
        });

        if (response.data && response.data.success) {
            return {
                success: true,
                response: response.data.response,
                imagesCount: response.data.imagesCount || 0
            };
        } else {
            throw new Error('Réponse API invalide');
        }
    } catch (error) {
        console.error('Erreur API OpenRoute:', error.message);
        throw error;
    }
}

module.exports = async (senderId, prompt, api) => {
    try {
        if (!conversationHistory[senderId]) {
            conversationHistory[senderId] = {
                messages: [],
                hasImage: false,
                imageUrl: null
            };
        }

        if (prompt && prompt.toLowerCase() === 'clear') {
            delete conversationHistory[senderId];
            delete pendingImages[senderId];
            await sendMessage(senderId, "🔄 Conversation OpenRoute réinitialisée avec succès! ✨");
            return;
        }

        const hasAttachments = api && api.attachments && api.attachments.length > 0;
        const imageAttachment = hasAttachments ? api.attachments.find(att => att.type === 'image') : null;

        if (imageAttachment) {
            const imageUrl = imageAttachment.payload.url;
            pendingImages[senderId] = imageUrl;
            conversationHistory[senderId].hasImage = true;
            conversationHistory[senderId].imageUrl = imageUrl;

            await sendMessage(senderId, "✨📸 Super ! J'ai bien reçu votre image ! 🖼️\n\n💭 Quelle est votre question concernant cette photo ? 🤔");
            return;
        }

        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, "👋 Bonjour ! Comment ça va ? 😊\n\n💬 Posez-moi n'importe quelle question ou envoyez une image pour que je puisse l'analyser ! 🔍✨");
            return;
        }

        await sendMessage(senderId, "⏳ Traitement en cours... 🤔💭");

        let apiResponse;
        const currentImageUrl = pendingImages[senderId] || conversationHistory[senderId].imageUrl;

        if (currentImageUrl && conversationHistory[senderId].hasImage) {
            apiResponse = await callOpenRouteAPI(senderId, prompt, currentImageUrl);
        } else {
            apiResponse = await callOpenRouteAPI(senderId, prompt);
        }

        if (!apiResponse || !apiResponse.response) {
            await sendMessage(senderId, "⚠️ Aucune réponse reçue de l'API. Veuillez réessayer.");
            return;
        }

        conversationHistory[senderId].messages.push({
            role: 'user',
            content: prompt
        });
        conversationHistory[senderId].messages.push({
            role: 'assistant',
            content: apiResponse.response
        });

        const cleanedResponse = convertMarkdownHeaders(apiResponse.response);

        const formattedResponse = `🍌 BOT OPENROUTE 🌭
━━━━━━━━━━━━━━━━━━━━
${cleanedResponse}
━━━━━━━━━━━━━━━━━━━━
🇲🇬 Création Bruno Rakotomalala 🇲🇬`;

        await sendLongMessage(senderId, formattedResponse);

        if (pendingImages[senderId]) {
            delete pendingImages[senderId];
        }

    } catch (error) {
        console.error("❌ Erreur OpenRoute:", error?.response?.data || error.message || error);
        await sendMessage(senderId, `⚠️ ERREUR TECHNIQUE ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors de la communication avec l'API OpenRoute.

🔄 Veuillez réessayer dans quelques instants.
━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    }
};

module.exports.info = {
    name: "openroute",
    description: "Bot intelligent utilisant l'API OpenRoute pour répondre à vos questions et analyser vos images",
    usage: "openroute <votre question> ou envoyez une image puis posez une question"
};
