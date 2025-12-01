const puppeteer = require('puppeteer');
const sendMessage = require('../handles/sendMessage');

const userSessionIds = {};

const pendingImages = {};

let browserInstance = null;

async function getBrowser() {
    if (!browserInstance) {
        browserInstance = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
    }
    return browserInstance;
}

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
        'bonjour': '👋', 'merci': '🙏', 'question': '❓', 'réponse': '💡',
        'aide': '🆘', 'important': '⚠️', 'attention': '⚡', 'exemple': '📋',
        'conseil': '💡', 'astuce': '✨', 'information': 'ℹ️', 'note': '📝',
        'image': '🖼️', 'photo': '📸', 'analyse': '🔍', 'résultat': '✅',
        'erreur': '❌', 'succès': '🎉', 'problème': '⚠️', 'solution': '💡',
        'créer': '🎨', 'art': '🎨', 'design': '✨', 'couleur': '🎨',
        'chat': '🐱', 'chien': '🐕', 'animal': '🐾', 'nature': '🌿',
        'fleur': '🌸', 'arbre': '🌳', 'ciel': '☁️', 'soleil': '☀️',
        'lune': '🌙', 'étoile': '⭐', 'eau': '💧', 'feu': '🔥',
        'musique': '🎵', 'livre': '📚', 'science': '🔬', 'code': '💻',
        'temps': '⏰', 'histoire': '📜', 'idée': '💭', 'cœur': '❤️',
        'amour': '💕', 'joie': '😊', 'bonheur': '😄', 'force': '💪',
        'voyage': '✈️', 'maison': '🏠'
    };

    formattedText = formattedText.replace(/^### (.+)$/gm, (match, title) => `▸▸▸ ${toBoldUnicode(title)}`);
    formattedText = formattedText.replace(/^## (.+)$/gm, (match, title) => `▸▸ ${toBoldUnicode(title)}`);
    formattedText = formattedText.replace(/^# (.+)$/gm, (match, title) => `▸ ${toBoldUnicode(title)}`);
    formattedText = formattedText.replace(/\*\*([^*]+)\*\*/g, (match, content) => toBoldUnicode(content));
    formattedText = formattedText.replace(/^- /gm, '• ');
    
    for (const [keyword, emoji] of Object.entries(emojiMap)) {
        const regex = new RegExp(`\\b${keyword}s?\\b`, 'gi');
        if (regex.test(formattedText) && !formattedText.includes(emoji)) {
            formattedText = formattedText.replace(regex, (matched) => `${matched} ${emoji}`);
            break;
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
            const separators = ['\n\n', '\n', '. ', ', ', ' • ', '• ', ' : ', ' - ', ' '];
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

async function callPuterAPI(prompt, imageUrl = null, uid = null) {
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    try {
        let url = `https://puter-gold-phi.vercel.app/puter?prompt=${encodeURIComponent(prompt)}`;
        if (imageUrl) {
            url += `&image_url=${encodeURIComponent(imageUrl)}`;
        }
        if (uid) {
            url += `&uid=${encodeURIComponent(uid)}`;
        }
        
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
        
        await page.waitForFunction(
            () => {
                const pre = document.getElementById('result');
                if (!pre) return false;
                const text = pre.textContent;
                try {
                    const data = JSON.parse(text);
                    return data.response !== undefined || data.error !== undefined;
                } catch {
                    return false;
                }
            },
            { timeout: 60000 }
        );
        
        const result = await page.evaluate(() => {
            const pre = document.getElementById('result');
            return JSON.parse(pre.textContent);
        });
        
        return result;
    } finally {
        await page.close();
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

        let imageUrl = null;
        if (pendingImages[senderId]) {
            imageUrl = pendingImages[senderId];
            delete pendingImages[senderId];
        }

        const result = await callPuterAPI(prompt, imageUrl, senderId);

        let reply = '';
        if (result.error) {
            reply = `Erreur: ${result.message || result.error}`;
        } else if (result.response && result.response.message && result.response.message.content) {
            reply = result.response.message.content;
        } else if (result.response && typeof result.response === 'string') {
            reply = result.response;
        } else {
            console.error('Structure de réponse inattendue:', JSON.stringify(result));
            reply = "Désolé, j'ai reçu une réponse inattendue de l'API.";
        }

        const formattedReply = formatResponse(reply);
        await sendLongMessage(senderId, formattedReply);

    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Chat:", error.message);

        let errorMessage = '';
        if (error.message.includes('timeout') || error.message.includes('Timeout')) {
            errorMessage = `⏱️ L'API met trop de temps à répondre. Veuillez réessayer.`;
        } else {
            errorMessage = `⚠️ Erreur: ${error.message}`;
        }

        await sendMessage(senderId, `
⚠️ *OUPS! ERREUR TECHNIQUE* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
${errorMessage}

🔄 Suggestions:
• Réessayez dans quelques instants
• Pour les images, assurez-vous qu'elles sont accessibles

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
