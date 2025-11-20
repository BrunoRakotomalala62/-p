const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const BASE_API_URL = 'https://miko-utilis.vercel.app/api/gpt5';
const MAX_MESSAGE_LENGTH = 2000;

const userContexts = {};

function toBoldUnicode(text) {
    const boldMap = {
        'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴', 'h': '𝗵',
        'i': '𝗶', 'j': '𝗷', 'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼', 'p': '𝗽',
        'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁', 'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅',
        'y': '𝘆', 'z': '𝘇',
        'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚', 'H': '𝗛',
        'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢', 'P': '𝗣',
        'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨', 'V': '𝗩', 'W': '𝗪', 'X': '𝗫',
        'Y': '𝗬', 'Z': '𝗭',
        '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰', '5': '𝟱', '6': '𝟲', '7': '𝟳',
        '8': '𝟴', '9': '𝟵'
    };
    
    return text.split('').map(char => boldMap[char] || char).join('');
}

function formatTextWithBold(text) {
    const lines = text.split('\n');
    let formattedText = '';
    
    for (let line of lines) {
        if (line.trim().startsWith('#')) {
            const titleText = line.replace(/^#+\s*/, '').trim();
            formattedText += toBoldUnicode(titleText) + '\n';
        } else {
            let processedLine = line.replace(/\*\*(.*?)\*\*/g, (match, p1) => toBoldUnicode(p1));
            formattedText += processedLine + '\n';
        }
    }
    
    return formattedText.trim();
}

async function splitAndSendMessage(senderId, text) {
    const formattedText = formatTextWithBold(text);
    
    if (formattedText.length <= MAX_MESSAGE_LENGTH) {
        await sendMessage(senderId, formattedText);
        return;
    }
    
    const paragraphs = formattedText.split('\n\n');
    let currentMessage = '';
    
    for (const paragraph of paragraphs) {
        if ((currentMessage + '\n\n' + paragraph).length > MAX_MESSAGE_LENGTH) {
            if (currentMessage) {
                await sendMessage(senderId, currentMessage.trim());
                await new Promise(resolve => setTimeout(resolve, 500));
                currentMessage = paragraph;
            } else {
                const sentences = paragraph.split('. ');
                for (const sentence of sentences) {
                    if ((currentMessage + sentence + '. ').length > MAX_MESSAGE_LENGTH) {
                        if (currentMessage) {
                            await sendMessage(senderId, currentMessage.trim());
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                        currentMessage = sentence + '. ';
                    } else {
                        currentMessage += sentence + '. ';
                    }
                }
            }
        } else {
            currentMessage += (currentMessage ? '\n\n' : '') + paragraph;
        }
    }
    
    if (currentMessage.trim()) {
        await sendMessage(senderId, currentMessage.trim());
    }
}

module.exports = async (senderId, userText, api, imageAttachments) => {
    if (userText === 'RESET_CONVERSATION') {
        userContexts[senderId] = null;
        return;
    }
    
    if (!userContexts[senderId]) {
        userContexts[senderId] = {
            pendingImage: null,
            conversationActive: false
        };
    }
    
    const context = userContexts[senderId];
    
    if (userText === 'IMAGE_ATTACHMENT' && imageAttachments && imageAttachments.length > 0) {
        const imageUrl = imageAttachments[0].payload.url;
        context.pendingImage = imageUrl;
        context.conversationActive = true;
        
        await sendMessage(senderId, "📸 𝗝'𝗮𝗶 𝗯𝗶𝗲𝗻 𝗿𝗲𝗰̧𝘂 𝘃𝗼𝘁𝗿𝗲 𝗶𝗺𝗮𝗴𝗲 ! 🖼️\n\n✨ 𝗤𝘂𝗲𝗹𝗹𝗲 𝗲𝘀𝘁 𝘃𝗼𝘁𝗿𝗲 𝗾𝘂𝗲𝘀𝘁𝗶𝗼𝗻 𝗰𝗼𝗻𝗰𝗲𝗿𝗻𝗮𝗻𝘁 𝗰𝗲𝘁𝘁𝗲 𝗽𝗵𝗼𝘁𝗼 ? 🤔");
        return { skipCommandCheck: true };
    }
    
    if (!userText.trim() || userText === 'IMAGE_ATTACHMENT') {
        return;
    }
    
    try {
        await sendMessage(senderId, "⏳ 𝗠𝗲𝘀𝘀𝗮𝗴𝗲 𝗿𝗲𝗰̧𝘂, 𝗷𝗲 𝗽𝗿𝗲́𝗽𝗮𝗿𝗲 𝘂𝗻𝗲 𝗿𝗲́𝗽𝗼𝗻𝘀𝗲...");
        
        let apiUrl = `${BASE_API_URL}?query=${encodeURIComponent(userText)}&userId=${senderId}`;
        
        if (context.pendingImage) {
            apiUrl += `&imgurl=${encodeURIComponent(context.pendingImage)}`;
        }
        
        const response = await axios.get(apiUrl);
        
        if (!response.data || !response.data.data || !response.data.data.response) {
            throw new Error('Réponse API invalide');
        }
        
        const aiResponse = response.data.data.response;
        
        if (context.pendingImage && response.data.data.imageProcessed) {
            context.pendingImage = null;
        }
        
        await splitAndSendMessage(senderId, aiResponse);
        
    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API GPT-5:', error);
        
        await sendMessage(senderId, 
            "❌ 𝗗𝗲́𝘀𝗼𝗹𝗲́, 𝘂𝗻𝗲 𝗲𝗿𝗿𝗲𝘂𝗿 𝘀'𝗲𝘀𝘁 𝗽𝗿𝗼𝗱𝘂𝗶𝘁𝗲 𝗹𝗼𝗿𝘀 𝗱𝘂 𝘁𝗿𝗮𝗶𝘁𝗲𝗺𝗲𝗻𝘁 𝗱𝗲 𝘃𝗼𝘁𝗿𝗲 𝗱𝗲𝗺𝗮𝗻𝗱𝗲.\n\n" +
            "Veuillez réessayer dans quelques instants."
        );
    }
};

module.exports.info = {
    name: "ai",
    description: "Discutez avec GPT-5 et analysez des images. Envoyez du texte ou une image suivie de votre question.",
    usage: "Tapez 'ai <votre question>' ou envoyez une image puis posez votre question."
};
