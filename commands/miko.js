
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const MAX_MESSAGE_LENGTH = 2000;

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
        if (line.trim().match(/^#{1,6}\s+/)) {
            const titleText = line.replace(/^#{1,6}\s*/, '').trim();
            formattedText += '\n' + toBoldUnicode(titleText) + '\n';
        } else {
            let processedLine = line.replace(/\*\*(.*?)\*\*/g, (match, p1) => toBoldUnicode(p1));
            formattedText += processedLine + '\n';
        }
    }
    
    return formattedText.trim();
}

async function splitAndSendMessage(senderId, text, header, footer) {
    const formattedText = formatTextWithBold(text);
    const fullMessage = `${header}\n\n${formattedText}\n\n${footer}`;
    
    if (fullMessage.length <= MAX_MESSAGE_LENGTH) {
        await sendMessage(senderId, fullMessage);
        return;
    }
    
    await sendMessage(senderId, header);
    await new Promise(resolve => setTimeout(resolve, 300));
    
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
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    await sendMessage(senderId, footer);
}

module.exports = async (senderId, prompt) => {
    try {
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, '❌ Veuillez fournir une question pour Miko.\n\nExemple: miko Firy ny daty androany?');
            return;
        }

        await sendMessage(senderId, '⏳ Miko est en train de réfléchir...');

        const apiUrl = `https://miko-utilis.vercel.app/api/miko?query=${encodeURIComponent(prompt)}&userId=${senderId}`;
        const response = await axios.get(apiUrl);
        
        if (!response.data || !response.data.status || !response.data.data || !response.data.data.response) {
            await sendMessage(senderId, '❌ Désolé, Miko n\'a pas pu générer de réponse.');
            return;
        }

        const reply = response.data.data.response;
        
        const header = '📝👩‍🚀 𝗠𝗜𝗞𝗢 𝗕𝗢𝗧 👷🌻\n━━━━━━━━━━━━━━━━━━━━━━━━━━';
        const footer = '━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 Powered by Miko AI | 🇲🇬 Madagascar';
        
        await splitAndSendMessage(senderId, reply, header, footer);

    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API Miko:', error.message);
        await sendMessage(senderId, '❌ Une erreur s\'est produite lors de la communication avec Miko. Veuillez réessayer plus tard.');
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "miko",
    description: "Posez des questions à Miko, votre assistant intelligent malgache.",
    usage: "Envoyez 'miko <question>' pour obtenir une réponse de Miko."
};
