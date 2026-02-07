const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const MAX_MESSAGE_LENGTH = 2000;

/**
 * Convertit le texte en caractères gras Unicode (style sans-serif bold)
 */
function toBoldUnicode(text) {
    const boldMap = {
        'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴', 'h': '𝗵',
        'i': '𝗶', 'j': '𝗷', 'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼', 'p': '𝗽',
        'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁', 'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅',
        'y': '𝘆', 'z': '𝘇',
        'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗴', 'H': '𝗵',
        'I': '𝗶', 'J': '𝗷', 'K': '𝗸', 'L': '𝗹', 'M': '𝗺', 'N': '𝗻', 'O': '𝗼', 'P': '𝗽',
        'Q': '𝗤', 'R': '𝗿', 'S': '𝘀', 'T': '𝘁', 'U': '𝘂', 'V': '𝘃', 'W': '𝘄', 'X': '𝘅',
        '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰', '5': '𝟱', '6': '𝟲', '7': '𝟳',
        '8': '𝟴', '9': '𝟵'
    };
    return text.split('').map(char => boldMap[char] || char).join('');
}

/**
 * Ajoute des décorations et emojis au texte
 */
function decorateText(text) {
    let lines = text.split('\n');
    let formattedLines = lines.map(line => {
        if (line.trim().startsWith('#')) {
            return '🔹 ' + toBoldUnicode(line.replace(/^#+\s*/, '').trim());
        }
        return line.replace(/\*\*(.*?)\*\*/g, (match, p1) => toBoldUnicode(p1));
    });

    return formattedLines.join('\n');
}

/**
 * Découpage dynamique et envoi des messages longs
 */
async function splitAndSendMessage(senderId, text) {
    const header = '🌟✨ 𝗔𝗜 𝗙𝗥𝗘𝗘 𝗙𝗢𝗥𝗘𝗩𝗘𝗥 🇲🇬 🚀\n━━━━━━━━━━━━━━━━━━━';
    const footer = '━━━━━━━━━━━━━━━━━━━\n👷👉 𝗖𝗿𝗲́𝗲́ 𝗽𝗮𝗿 𝗕𝗿𝘂𝗻𝗼 ✅';
    
    const decoratedContent = decorateText(text);
    
    if ((header.length + decoratedContent.length + footer.length + 4) <= MAX_MESSAGE_LENGTH) {
        await sendMessage(senderId, `${header}\n\n${decoratedContent}\n\n${footer}`);
        return;
    }

    await sendMessage(senderId, header);
    await new Promise(resolve => setTimeout(resolve, 500));

    const paragraphs = decoratedContent.split('\n\n');
    let currentBatch = '';

    for (const paragraph of paragraphs) {
        if ((currentBatch + '\n\n' + paragraph).length > MAX_MESSAGE_LENGTH) {
            if (currentBatch) {
                await sendMessage(senderId, currentBatch.trim());
                await new Promise(resolve => setTimeout(resolve, 800));
            }
            
            if (paragraph.length > MAX_MESSAGE_LENGTH) {
                const sentences = paragraph.split('. ');
                currentBatch = '';
                for (const sentence of sentences) {
                    const sentenceWithDot = sentence.endsWith('.') ? sentence : sentence + '.';
                    if ((currentBatch + ' ' + sentenceWithDot).length > MAX_MESSAGE_LENGTH) {
                        await sendMessage(senderId, currentBatch.trim());
                        await new Promise(resolve => setTimeout(resolve, 800));
                        currentBatch = sentenceWithDot;
                    } else {
                        currentBatch += (currentBatch ? ' ' : '') + sentenceWithDot;
                    }
                }
            } else {
                currentBatch = paragraph;
            }
        } else {
            currentBatch += (currentBatch ? '\n\n' : '') + paragraph;
        }
    }

    if (currentBatch.trim()) {
        await sendMessage(senderId, currentBatch.trim());
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    await sendMessage(senderId, footer);
}

module.exports = async (senderId, userText, api) => {
    if (!userText || userText.trim() === '') {
        await sendMessage(senderId, "❓ 𝗩𝗲𝘂𝗶𝗹𝗹𝗲𝘇 𝗽𝗼𝘀𝗲𝗿 𝘂𝗻𝗲 𝗾𝘂𝗲𝘀𝘁𝗶𝗼𝗻 𝗮𝗽𝗿𝗲̀𝘀 𝗹𝗮 𝗰𝗼𝗺𝗺𝗮𝗻𝗱𝗲.\n𝗘𝘅𝗲𝗺𝗽𝗹𝗲: aifree Qui es-tu ?");
        return;
    }

    if (userText === 'RESET_CONVERSATION') {
        return;
    }

    try {
        await sendMessage(senderId, "🔍 𝗥𝗲𝗰𝗵𝗲𝗿𝗰𝗵𝗲 𝗱𝗲 𝗹𝗮 𝗿𝗲́𝗽𝗼𝗻𝘀𝗲 𝗲𝗻 𝗰𝗼𝘂𝗿𝘀... ⏳");

        const url = "https://aifreeforever.com/api/generate-ai-answer";
        const payload = {
            "question": userText,
            "tone": "friendly",
            "format": "paragraph",
            "file": null,
            "conversationHistory": []
        };

        const headers = {
            'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            'Content-Type': "application/json",
            'Accept': "application/json, text/plain, */*",
            'Origin': "https://aifreeforever.com",
            'Referer': "https://aifreeforever.com/tools/free-chatgpt-no-login",
            'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin'
        };

        const response = await axios.post(url, payload, { 
            headers, 
            timeout: 60000,
            validateStatus: function (status) {
                return status >= 200 && status < 500;
            }
        });
        
        if (response.status !== 200) {
            throw new Error(`L'API a retourné un code d'erreur ${response.status}`);
        }

        let aiResponse = "";
        if (response.data && response.data.answer) {
            aiResponse = response.data.answer;
        } else if (response.data && response.data.response) {
            aiResponse = response.data.response;
        } else if (typeof response.data === 'string') {
            aiResponse = response.data;
        } else {
            aiResponse = JSON.stringify(response.data);
        }

        if (!aiResponse || aiResponse === "{}" || aiResponse.length < 2) {
            throw new Error("Réponse vide ou invalide de l'API");
        }

        await splitAndSendMessage(senderId, aiResponse);

    } catch (error) {
        console.error('Erreur API AIFree:', error.message);
        let errorMsg = "❌ 𝗗𝗲́𝘀𝗼𝗹𝗲́, 𝘂𝗻𝗲 𝗲𝗿𝗿𝗲𝘂𝗿 𝗲𝘀𝘁 𝘀𝘂𝗿𝘃𝗲𝗻𝘂𝗲 lors de la communication avec l'IA.\n\n";
        
        if (error.response) {
            errorMsg += `L'API a répondu avec une erreur (Code: ${error.response.status}).`;
        } else if (error.code === 'ECONNABORTED') {
            errorMsg += "Le délai d'attente de l'API a été dépassé. Veuillez réessayer.";
        } else {
            errorMsg += "Impossible de contacter l'IA pour le moment. Réessayez dans quelques instants.";
        }
        
        await sendMessage(senderId, errorMsg);
    }
};

module.exports.info = {
    name: "aifree",
    description: "Intelligence Artificielle gratuite et illimitée.",
    usage: "aifree <votre question>"
};
