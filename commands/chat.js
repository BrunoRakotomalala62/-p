const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const userSessionIds = {};

const pendingImages = {};

function toBoldUnicode(text) {
    const boldMap = {
        'A': '𝐀', 'B': '𝐁', 'C': '𝐂', 'D': '𝐃', 'E': '𝐄', 'F': '𝐅', 'G': '𝐆', 'H': '𝐇', 'I': '𝐈', 'J': '𝐉',
        'K': '𝐊', 'L': '𝐋', 'M': '𝐌', 'N': '𝐍', 'O': '𝐎', 'P': '𝐏', 'Q': '𝐐', 'R': '𝐑', 'S': '𝐒', 'T': '𝐓',
        'U': '𝐔', 'V': '𝐕', 'W': '𝐖', 'X': '𝐗', 'Y': '𝐘', 'Z': '𝐙',
        'a': '𝐚', 'b': '𝐛', 'c': '𝐜', 'd': '𝐝', 'e': '𝐞', 'f': '𝐟', 'g': '𝐠', 'h': '𝐡', 'i': '𝐢', 'j': '𝐣',
        'k': '𝐤', 'l': '𝐥', 'm': '𝐦', 'n': '𝐧', 'o': '𝐨', 'p': '𝐩', 'q': '𝐪', 'r': '𝐫', 's': '𝐬', 't': '𝐭',
        'u': '𝐮', 'v': '𝐯', 'w': '𝐰', 'x': '𝐱', 'y': '𝐲', 'z': '𝐳',
        '0': '𝟎', '1': '𝟏', '2': '𝟐', '3': '𝟑', '4': '𝟒', '5': '𝟓', '6': '𝟔', '7': '𝟕', '8': '𝟖', '9': '𝟗'
    };
    return text.split('').map(char => boldMap[char] || char).join('');
}

function cleanLatex(text) {
    let cleaned = text;
    
    cleaned = cleaned.replace(/\\\(/g, '');
    cleaned = cleaned.replace(/\\\)/g, '');
    
    cleaned = cleaned.replace(/\\\[/g, '');
    cleaned = cleaned.replace(/\\\]/g, '');
    
    cleaned = cleaned.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2');
    
    cleaned = cleaned.replace(/\\cdot/g, '×');
    cleaned = cleaned.replace(/\\times/g, '×');
    cleaned = cleaned.replace(/\\div/g, '÷');
    cleaned = cleaned.replace(/\\pm/g, '±');
    cleaned = cleaned.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');
    cleaned = cleaned.replace(/\\sqrt/g, '√');
    cleaned = cleaned.replace(/\\pi/g, 'π');
    cleaned = cleaned.replace(/\\infty/g, '∞');
    cleaned = cleaned.replace(/\\alpha/g, 'α');
    cleaned = cleaned.replace(/\\beta/g, 'β');
    cleaned = cleaned.replace(/\\gamma/g, 'γ');
    cleaned = cleaned.replace(/\\delta/g, 'δ');
    cleaned = cleaned.replace(/\\theta/g, 'θ');
    cleaned = cleaned.replace(/\\lambda/g, 'λ');
    cleaned = cleaned.replace(/\\mu/g, 'μ');
    cleaned = cleaned.replace(/\\sigma/g, 'σ');
    cleaned = cleaned.replace(/\\omega/g, 'ω');
    cleaned = cleaned.replace(/\\sum/g, '∑');
    cleaned = cleaned.replace(/\\int/g, '∫');
    cleaned = cleaned.replace(/\\leq/g, '≤');
    cleaned = cleaned.replace(/\\geq/g, '≥');
    cleaned = cleaned.replace(/\\neq/g, '≠');
    cleaned = cleaned.replace(/\\approx/g, '≈');
    cleaned = cleaned.replace(/\\rightarrow/g, '→');
    cleaned = cleaned.replace(/\\leftarrow/g, '←');
    cleaned = cleaned.replace(/\\Rightarrow/g, '⇒');
    cleaned = cleaned.replace(/\\Leftarrow/g, '⇐');
    
    cleaned = cleaned.replace(/\^{([^}]+)}/g, '^$1');
    cleaned = cleaned.replace(/\^(\d)/g, '^$1');
    
    cleaned = cleaned.replace(/_{([^}]+)}/g, '_$1');
    
    cleaned = cleaned.replace(/\\text\{([^}]+)\}/g, '$1');
    cleaned = cleaned.replace(/\\textbf\{([^}]+)\}/g, '$1');
    cleaned = cleaned.replace(/\\textit\{([^}]+)\}/g, '$1');
    cleaned = cleaned.replace(/\\mathrm\{([^}]+)\}/g, '$1');
    cleaned = cleaned.replace(/\\mathbf\{([^}]+)\}/g, '$1');
    
    cleaned = cleaned.replace(/\\([a-zA-Z]+)/g, '$1');
    
    return cleaned;
}

function formatResponse(text) {
    let formattedText = cleanLatex(text);
    
    const emojiMap = {
        'bonjour': '👋',
        'merci': '🙏',
        'question': '❓',
        'réponse': '💡',
        'aide': '🆘',
        'important': '⚠️',
        'attention': '⚡',
        'exemple': '📋',
        'conseil': '💡',
        'astuce': '✨',
        'information': 'ℹ️',
        'note': '📝',
        'image': '🖼️',
        'photo': '📸',
        'analyse': '🔍',
        'résultat': '✅',
        'erreur': '❌',
        'succès': '🎉',
        'problème': '⚠️',
        'solution': '💡',
        'créer': '🎨',
        'art': '🎨',
        'design': '✨',
        'couleur': '🎨',
        'composition': '🖼️',
        'chat': '🐱',
        'chien': '🐕',
        'animal': '🐾',
        'nature': '🌿',
        'fleur': '🌸',
        'arbre': '🌳',
        'ciel': '☁️',
        'soleil': '☀️',
        'lune': '🌙',
        'étoile': '⭐',
        'eau': '💧',
        'feu': '🔥',
        'terre': '🌍',
        'musique': '🎵',
        'livre': '📚',
        'étude': '📖',
        'science': '🔬',
        'technologie': '💻',
        'code': '💻',
        'programmation': '⌨️',
        'temps': '⏰',
        'calendrier': '📅',
        'histoire': '📜',
        'futur': '🔮',
        'idée': '💭',
        'pensée': '🧠',
        'cœur': '❤️',
        'amour': '💕',
        'joie': '😊',
        'tristesse': '😢',
        'bonheur': '😄',
        'force': '💪',
        'santé': '🏥',
        'nourriture': '🍽️',
        'voyage': '✈️',
        'maison': '🏠',
        'ville': '🏙️',
        'pays': '🗺️'
    };

    formattedText = formattedText.replace(/^### (.+)$/gm, (match, title) => `▸▸▸ ${toBoldUnicode(title)}`);
    
    formattedText = formattedText.replace(/^## (.+)$/gm, (match, title) => `▸▸ ${toBoldUnicode(title)}`);
    
    formattedText = formattedText.replace(/^# (.+)$/gm, (match, title) => `▸ ${toBoldUnicode(title)}`);
    
    formattedText = formattedText.replace(/\*\*([^*]+)\*\*/g, (match, content) => toBoldUnicode(content));
    
    formattedText = formattedText.replace(/^- /gm, '• ');
    
    for (const [keyword, emoji] of Object.entries(emojiMap)) {
        const regex = new RegExp(`\\b${keyword}s?\\b`, 'gi');
        if (regex.test(formattedText) && !formattedText.includes(emoji)) {
            const match = formattedText.match(regex);
            if (match) {
                formattedText = formattedText.replace(regex, (matched) => `${matched} ${emoji}`);
                break;
            }
        }
    }
    
    formattedText = formattedText.replace(/^▸ (.+)$/gm, '\n╔═══════════════════════\n║ ✨ $1\n╚═══════════════════════');
    formattedText = formattedText.replace(/^▸▸ (.+)$/gm, '\n┌───────────────\n│ 💫 $1\n└───────────────');
    formattedText = formattedText.replace(/^▸▸▸ (.+)$/gm, '\n├─ ⭐ $1');
    
    const header = `
╔═══════════════════════════════════╗
║   🤖 ✨ RÉPONSE DE CHAT ✨ 🤖    ║
╚═══════════════════════════════════╝
`;
    
    const footer = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Propulsé par GPT-5-nano | ⚡ Rapide & Précis
`;
    
    return header + formattedText + footer;
}

async function sendLongMessage(senderId, message) {
    const MAX_MESSAGE_LENGTH = 2000;

    if (message.length <= MAX_MESSAGE_LENGTH) {
        await sendMessage(senderId, message);
        return;
    }

    let startIndex = 0;
    let partNumber = 1;
    const totalParts = Math.ceil(message.length / MAX_MESSAGE_LENGTH);

    while (startIndex < message.length) {
        let endIndex = startIndex + MAX_MESSAGE_LENGTH;

        if (endIndex < message.length) {
            const separators = ['\n\n', '\n', '. ', ', ', ' • ', '• ', ' : ', ' - ', ' ', '! ', '? ', '.\n', ',\n', '!\n', '?\n'];
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

        let messagePart = message.substring(startIndex, endIndex);
        
        if (totalParts > 1) {
            if (partNumber === 1) {
                messagePart = `${messagePart}\n\n📄 Partie ${partNumber}/${totalParts}`;
            } else {
                messagePart = `📄 Partie ${partNumber}/${totalParts}\n\n${messagePart}`;
            }
        }
        
        await sendMessage(senderId, messagePart);
        await new Promise(resolve => setTimeout(resolve, 1000));

        startIndex = endIndex;
        partNumber++;
    }
}

module.exports = async (senderId, prompt, api, imageAttachments) => { 
    try {
        if (prompt === "RESET_CONVERSATION") {
            delete userSessionIds[senderId];
            delete pendingImages[senderId];
            return { skipCommandCheck: true };
        }

        if (!userSessionIds[senderId]) {
            userSessionIds[senderId] = senderId;
        }

        if (imageAttachments && imageAttachments.length > 0) {
            pendingImages[senderId] = imageAttachments[0].payload.url;

            await sendMessage(senderId, "✨📸 J'ai bien reçu votre image! Que voulez-vous savoir à propos de cette photo? Posez-moi votre question! 🔍🖼️");
            return { skipCommandCheck: true };
        }

        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, "🤖✨ Bonjour! Je suis Chat, votre assistant IA propulsé par GPT-5-nano. Comment puis-je vous aider aujourd'hui? Posez-moi n'importe quelle question!");
            return;
        }

        await sendMessage(senderId, "✨🧠 Analyse en cours... ⏳💫");

        let apiUrl;
        if (pendingImages[senderId]) {
            apiUrl = `https://puter-gold-phi.vercel.app/puter?prompt=${encodeURIComponent(prompt)}&image_url=${encodeURIComponent(pendingImages[senderId])}&uid=${senderId}`;
            delete pendingImages[senderId];
        } else {
            apiUrl = `https://puter-gold-phi.vercel.app/puter?prompt=${encodeURIComponent(prompt)}`;
        }

        const response = await axios.get(apiUrl, {
            timeout: 60000,
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });

        let reply = '';
        if (response.data && response.data.response && response.data.response.message && response.data.response.message.content) {
            reply = response.data.response.message.content;
        } else if (response.data && response.data.result) {
            reply = response.data.result;
        } else if (response.data && response.data.response) {
            reply = typeof response.data.response === 'string' ? response.data.response : JSON.stringify(response.data.response);
        } else {
            console.error('Structure de réponse inattendue:', JSON.stringify(response.data));
            reply = "Désolé, j'ai reçu une réponse inattendue de l'API.";
        }

        const formattedReply = formatResponse(reply);

        await sendLongMessage(senderId, formattedReply);

    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Chat:", error.message);
        console.error("Détails de l'erreur:", error.response?.data || error);

        let errorMessage = '';
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            errorMessage = `⏱️ L'API met trop de temps à répondre. L'analyse peut prendre jusqu'à 30 secondes pour les images complexes. Veuillez réessayer.`;
        } else if (error.response) {
            errorMessage = `❌ L'API a retourné une erreur (Code: ${error.response.status}).\nDétails: ${JSON.stringify(error.response.data)}`;
        } else if (error.request) {
            errorMessage = `🌐 Impossible de contacter l'API. Vérifiez votre connexion internet.`;
        } else {
            errorMessage = `⚠️ Erreur: ${error.message}`;
        }

        await sendMessage(senderId, `
⚠️ *OUPS! ERREUR TECHNIQUE* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
${errorMessage}

🔄 Suggestions:
• Vérifiez votre connexion internet
• Réessayez dans quelques instants
• Pour les images, assurez-vous qu'elles sont accessibles publiquement

💡 Si le problème persiste, contactez l'administrateur.
━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    }

    return { skipCommandCheck: true };
};

module.exports.info = {
    name: "chat",
    description: "Discutez avec Chat, une IA avancée propulsée par GPT-5-nano via Puter.",
    usage: "Envoyez 'chat <question>' pour discuter avec Chat, ou envoyez une image puis posez une question."
};
