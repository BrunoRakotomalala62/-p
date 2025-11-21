const fs = require('fs-extra');
const path = require('path');
const sendMessage = require('../handles/sendMessage');

function sanitizeString(str) {
    return str.replace(/['"\\`]/g, '\\$&');
}

function validateCommandName(name) {
    if (!/^[a-z0-9]+$/.test(name)) {
        throw new Error('Le nom doit contenir uniquement des lettres minuscules et des chiffres');
    }
    if (name.length < 2 || name.length > 20) {
        throw new Error('Le nom doit contenir entre 2 et 20 caractères');
    }
    const reservedNames = ['stop', 'supprimer', 'help', 'commandstore'];
    if (reservedNames.includes(name)) {
        throw new Error('Ce nom de commande est réservé');
    }
}

function validateApiUrl(url) {
    try {
        const urlObj = new URL(url);
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            throw new Error('L\'URL doit utiliser le protocole HTTP ou HTTPS');
        }
        return true;
    } catch (error) {
        throw new Error('URL invalide: ' + error.message);
    }
}

function generateCommandTemplate(commandName, apiUrl, supportsImage = false, queryParam = 'query', imageParam = 'imgurl', uidParam = 'userId') {
    const safeCommandName = sanitizeString(commandName);
    const safeApiUrl = sanitizeString(apiUrl);
    const safeQueryParam = sanitizeString(queryParam);
    const safeImageParam = sanitizeString(imageParam);
    const safeUidParam = sanitizeString(uidParam);
    const imageHandlingCode = supportsImage ? `
    if (userText === 'IMAGE_ATTACHMENT' && imageAttachments && imageAttachments.length > 0) {
        const imageUrl = imageAttachments[0].payload.url;
        context.pendingImage = imageUrl;
        context.conversationActive = true;
        
        await sendMessage(senderId, "📸 𝗝'𝗮𝗶 𝗯𝗶𝗲𝗻 𝗿𝗲𝗰̧𝘂 𝘃𝗼𝘁𝗿𝗲 𝗶𝗺𝗮𝗴𝗲 ! 🖼️\\n\\n✨ 𝗤𝘂𝗲𝗹𝗹𝗲 𝗲𝘀𝘁 𝘃𝗼𝘁𝗿𝗲 𝗾𝘂𝗲𝘀𝘁𝗶𝗼𝗻 𝗰𝗼𝗻𝗰𝗲𝗿𝗻𝗮𝗻𝘁 𝗰𝗲𝘁𝘁𝗲 𝗽𝗵𝗼𝘁𝗼 ? 🤔");
        return { skipCommandCheck: true };
    }
    ` : '';

    const imageUrlCode = supportsImage ? `
        if (context.pendingImage) {
            apiUrl += \`&${safeImageParam}=\${encodeURIComponent(context.pendingImage)}\`;
        }
    ` : '';

    const imageCleanupCode = supportsImage ? `
        if (context.pendingImage) {
            if (response.data && response.data.data && response.data.data.imageProcessed) {
                context.pendingImage = null;
            } else {
                context.pendingImage = null;
            }
        }
    ` : '';

    const usageText = supportsImage 
        ? `Tapez '${safeCommandName} <votre question>' ou envoyez une image puis posez votre question.`
        : `Tapez '${safeCommandName} <votre question>'`;

    const descriptionText = supportsImage
        ? `Commande IA personnalisée avec support de conversation continue et analyse d'images.`
        : `Commande IA personnalisée avec support de conversation continue.`;

    return `const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const BASE_API_URL = '${safeApiUrl}';
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
    const lines = text.split('\\n');
    let formattedText = '';
    
    for (let line of lines) {
        if (line.trim().startsWith('#')) {
            const titleText = line.replace(/^#+\\s*/, '').trim();
            formattedText += toBoldUnicode(titleText) + '\\n';
        } else {
            let processedLine = line.replace(/\\*\\*(.*?)\\*\\*/g, (match, p1) => toBoldUnicode(p1));
            formattedText += processedLine + '\\n';
        }
    }
    
    return formattedText.trim();
}

async function splitAndSendMessage(senderId, text) {
    const header = '✨ ${safeCommandName.toUpperCase()} AI 🤖\\n---------------------------------';
    const footer = '-----++++------+++++-----+++\\n👷 Commande générée automatiquement ✅';
    
    const formattedText = formatTextWithBold(text);
    const fullMessage = \`\${header}\\n\\n\${formattedText}\\n\\n\${footer}\`;
    
    if (fullMessage.length <= MAX_MESSAGE_LENGTH) {
        await sendMessage(senderId, fullMessage);
        return;
    }
    
    await sendMessage(senderId, header);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const paragraphs = formattedText.split('\\n\\n');
    let currentMessage = '';
    
    for (const paragraph of paragraphs) {
        if ((currentMessage + '\\n\\n' + paragraph).length > MAX_MESSAGE_LENGTH) {
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
            currentMessage += (currentMessage ? '\\n\\n' : '') + paragraph;
        }
    }
    
    if (currentMessage.trim()) {
        await sendMessage(senderId, currentMessage.trim());
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    await sendMessage(senderId, footer);
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
    ${imageHandlingCode}
    
    if (!userText.trim() || userText === 'IMAGE_ATTACHMENT') {
        return;
    }
    
    try {
        await sendMessage(senderId, "⏳ 𝗠𝗲𝘀𝘀𝗮𝗴𝗲 𝗿𝗲𝗰̧𝘂, 𝗷𝗲 𝗽𝗿𝗲́𝗽𝗮𝗿𝗲 𝘂𝗻𝗲 𝗿𝗲́𝗽𝗼𝗻𝘀𝗲...");
        
        let apiUrl = \`\${BASE_API_URL}?${safeQueryParam}=\${encodeURIComponent(userText)}&${safeUidParam}=\${senderId}\`;
        ${imageUrlCode}
        
        const response = await axios.get(apiUrl);
        
        if (!response.data) {
            throw new Error('Réponse API invalide');
        }
        
        let aiResponse;
        if (response.data.data && response.data.data.response) {
            aiResponse = response.data.data.response;
        } else if (response.data.response) {
            aiResponse = response.data.response;
        } else if (response.data.message) {
            aiResponse = response.data.message;
        } else if (typeof response.data === 'string') {
            aiResponse = response.data;
        } else {
            throw new Error('Format de réponse API non reconnu');
        }
        ${imageCleanupCode}
        
        await splitAndSendMessage(senderId, aiResponse);
        
    } catch (error) {
        console.error('Erreur lors de l\\'appel à l\\'API:', error);
        
        await sendMessage(senderId, 
            "❌ 𝗗𝗲́𝘀𝗼𝗹𝗲́, 𝘂𝗻𝗲 𝗲𝗿𝗿𝗲𝘂𝗿 𝘀'𝗲𝘀𝘁 𝗽𝗿𝗼𝗱𝘂𝗶𝘁𝗲 𝗹𝗼𝗿𝘀 𝗱𝘂 𝘁𝗿𝗮𝗶𝘁𝗲𝗺𝗲𝗻𝘁 𝗱𝗲 𝘃𝗼𝘁𝗿𝗲 𝗱𝗲𝗺𝗮𝗻𝗱𝗲.\\n\\n" +
            "Veuillez réessayer dans quelques instants."
        );
    }
};

module.exports.info = {
    name: "${safeCommandName}",
    description: "${descriptionText}",
    usage: "${usageText}"
};
`;
}

module.exports = async (senderId, userText, api) => {
    const args = userText.trim().split(/\s+/);
    
    if (args.length < 1) {
        await sendMessage(senderId, 
            "🛠️ 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦𝗧𝗢𝗥𝗘 - 𝗚𝗲́𝗻𝗲́𝗿𝗮𝘁𝗲𝘂𝗿 𝗱𝗲 𝗰𝗼𝗺𝗺𝗮𝗻𝗱𝗲𝘀 𝗔𝗜 🤖\n\n" +
            "📝 𝗨𝘁𝗶𝗹𝗶𝘀𝗮𝘁𝗶𝗼𝗻:\n" +
            "commandstore <nom> <url_api> [options]\n\n" +
            "📌 𝗢𝗽𝘁𝗶𝗼𝗻𝘀:\n" +
            "• image - Active le support des images\n" +
            "• query:<nom> - Nom du paramètre pour le texte (défaut: query)\n" +
            "• imageurl:<nom> - Nom du paramètre pour l'image (défaut: imgurl)\n" +
            "• uid:<nom> - Nom du paramètre pour l'ID utilisateur (défaut: userId)\n\n" +
            "📌 𝗘𝘅𝗲𝗺𝗽𝗹𝗲𝘀:\n" +
            "• commandstore hi https://api.exemple.com/chat\n" +
            "• commandstore assistant https://api.exemple.com/ai image query:prompt imageurl:imageurl uid:user\n" +
            "• commandstore gemini https://norch-project.gleeze.com/api/gemini image query:prompt imageurl:imageurl uid:uid\n\n" +
            "💡 Les paramètres personnalisés permettent d'adapter la commande à n'importe quelle API!\n\n" +
            "✨ Une fois créée, utilisez votre commande:\n" +
            "• hi qui es-tu?\n" +
            "• assistant explique-moi quelque chose"
        );
        return;
    }
    
    const commandName = args[0].toLowerCase();
    const apiUrl = args[1];
    
    // Parse les options
    let supportsImage = false;
    let queryParam = 'query';
    let imageParam = 'imgurl';
    let uidParam = 'userId';
    
    for (let i = 2; i < args.length; i++) {
        const arg = args[i];
        if (arg.toLowerCase() === 'image') {
            supportsImage = true;
        } else if (arg.startsWith('query:')) {
            queryParam = arg.split(':')[1];
        } else if (arg.startsWith('imageurl:')) {
            imageParam = arg.split(':')[1];
        } else if (arg.startsWith('uid:')) {
            uidParam = arg.split(':')[1];
        }
    }
    
    try {
        validateCommandName(commandName);
    } catch (error) {
        await sendMessage(senderId, 
            "❌ 𝗡𝗼𝗺 𝗱𝗲 𝗰𝗼𝗺𝗺𝗮𝗻𝗱𝗲 𝗶𝗻𝘃𝗮𝗹𝗶𝗱𝗲!\n\n" +
            error.message + "\n\n" +
            "Exemple: hi, assistant, bot123"
        );
        return;
    }
    
    try {
        validateApiUrl(apiUrl);
    } catch (error) {
        await sendMessage(senderId, 
            "❌ 𝗨𝗥𝗟 𝗔𝗣𝗜 𝗶𝗻𝘃𝗮𝗹𝗶𝗱𝗲!\n\n" +
            error.message + "\n\n" +
            "Exemple: https://api.exemple.com/chat"
        );
        return;
    }
    
    const commandPath = path.join(__dirname, `${commandName}.js`);
    if (fs.existsSync(commandPath)) {
        await sendMessage(senderId, 
            `⚠️ 𝗟𝗮 𝗰𝗼𝗺𝗺𝗮𝗻𝗱𝗲 "${commandName}" 𝗲𝘅𝗶𝘀𝘁𝗲 𝗱𝗲́𝗷𝗮̀!\n\n` +
            "Choisissez un autre nom ou supprimez l'ancienne commande d'abord."
        );
        return;
    }
    
    try {
        await sendMessage(senderId, 
            `🔨 𝗖𝗿𝗲́𝗮𝘁𝗶𝗼𝗻 𝗱𝗲 𝗹𝗮 𝗰𝗼𝗺𝗺𝗮𝗻𝗱𝗲 "${commandName}"...\n\n` +
            `📡 API: ${apiUrl}\n` +
            `🖼️ Support images: ${supportsImage ? 'Oui ✅' : 'Non ❌'}\n` +
            `📝 Paramètre texte: ${queryParam}\n` +
            `${supportsImage ? `🖼️ Paramètre image: ${imageParam}\n` : ''}` +
            `👤 Paramètre utilisateur: ${uidParam}`
        );
        
        const commandCode = generateCommandTemplate(commandName, apiUrl, supportsImage, queryParam, imageParam, uidParam);
        
        await fs.writeFile(commandPath, commandCode, 'utf8');
        
        const handleMessagePath = path.join(__dirname, '../handles/handleMessage.js');
        if (fs.existsSync(handleMessagePath)) {
            try {
                delete require.cache[require.resolve(handleMessagePath)];
                delete require.cache[require.resolve(commandPath)];
            } catch (cacheError) {
                console.log('Note: Cache non vidé, redémarrage recommandé');
            }
        }
        
        await sendMessage(senderId, 
            `✅ 𝗦𝗨𝗖𝗖𝗘̀𝗦 ! 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝗲 "${commandName}" 𝗰𝗿𝗲́𝗲́𝗲 𝗮𝘃𝗲𝗰 𝘀𝘂𝗰𝗰𝗲̀𝘀! 🎉\n\n` +
            `📂 Fichier créé: commands/${commandName}.js\n\n` +
            `🚀 𝗨𝘁𝗶𝗹𝗶𝘀𝗮𝘁𝗶𝗼𝗻:\n` +
            `• ${commandName} <votre question>\n` +
            `${supportsImage ? `• Envoyez une image, puis utilisez ${commandName}\n` : ''}` +
            `• stop - pour désactiver la commande\n` +
            `• supprimer - pour réinitialiser la conversation\n\n` +
            `⚠️ 𝗡𝗢𝗧𝗘 𝗜𝗠𝗣𝗢𝗥𝗧𝗔𝗡𝗧𝗘:\n` +
            `Le système de commandes charge les commandes au démarrage.\n` +
            `Vous devez redémarrer le bot pour que la commande "${commandName}" soit active.\n\n` +
            `💡 𝗔𝗽𝗿𝗲̀𝘀 𝗹𝗲 𝗿𝗲𝗱𝗲́𝗺𝗮𝗿𝗿𝗮𝗴𝗲, 𝘁𝗲𝘀𝘁𝗲𝘇:\n` +
            `${commandName} Bonjour, qui es-tu?`
        );
        
    } catch (error) {
        console.error('Erreur lors de la création de la commande:', error);
        await sendMessage(senderId, 
            "❌ 𝗘𝗿𝗿𝗲𝘂𝗿 𝗹𝗼𝗿𝘀 𝗱𝗲 𝗹𝗮 𝗰𝗿𝗲́𝗮𝘁𝗶𝗼𝗻 𝗱𝗲 𝗹𝗮 𝗰𝗼𝗺𝗺𝗮𝗻𝗱𝗲.\n\n" +
            `Détails: ${error.message}`
        );
    }
};

module.exports.info = {
    name: "commandstore",
    description: "Génère automatiquement une commande IA personnalisée à partir d'une URL API avec paramètres personnalisables.",
    usage: "commandstore <nom> <url_api> [options]\n\nOptions:\n• image - Active le support des images\n• query:<nom> - Nom du paramètre pour le texte (défaut: query)\n• imageurl:<nom> - Nom du paramètre pour l'image (défaut: imgurl)\n• uid:<nom> - Nom du paramètre pour l'ID utilisateur (défaut: userId)\n\nExemples:\n• commandstore hi https://api.exemple.com/chat\n• commandstore assistant https://api.exemple.com/ai image query:prompt imageurl:imageurl uid:user\n• commandstore gemini https://norch-project.gleeze.com/api/gemini image query:prompt imageurl:imageurl uid:uid"
};
