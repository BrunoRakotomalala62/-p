const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Mémorisation des images par utilisateur
const userImageMemory = new Map();

// Configuration des APIs
const API_CONFIG = {
    GROQ_URL: "https://groqapi--h0kdld.replit.app/prompt",
    TIMEOUT: 90000,
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};


// --- Fonctions de formatage de texte ---

/**
 * Convertit les indices mathématiques (ex: H2O -> H₂O)
 */
function convertToSubscript(text) {
    if (!text) return "";
    const subscriptMap = {
        '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
        '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎', 'a': 'ₐ', 'e': 'ₑ', 'o': 'ₒ', 'x': 'ₓ', 'h': 'ₕ',
        'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'p': 'ₚ', 's': 'ₛ', 't': 'ₜ'
    };
    return text.replace(/_([0-9a-z+\-=()]+)/g, (match, p1) => {
        return p1.split('').map(char => subscriptMap[char] || char).join('');
    });
}

/**
 * Convertit les exposants mathématiques (ex: 2^3 -> 2³)
 */
function convertToSuperscript(text) {
    if (!text) return "";
    const superscriptMap = {
        '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
        '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', 'n': 'ⁿ', 'i': 'ⁱ'
    };
    return text.replace(/\^([0-9n+\-=()]+)/g, (match, p1) => {
        return p1.split('').map(char => superscriptMap[char] || char).join('');
    });
}

/**
 * Convertit le texte en caractères Unicode gras (Serif Bold)
 */
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
    return text.split('').map(char => boldMap[char] || char).join('');
}

function replaceBranding(text) {
    if (!text) return "";
    return text
        .replace(/Claude/gi, '🍟Cours mathématiques et PC Madagascar✅')
        .replace(/Anthropic/gi, '👉Bruno Rakotomalala ✅');
}

/**
 * Formate le texte avec les styles Unicode et mathématiques
 */
function formatText(text) {
    if (!text) return "";
    
    let formattedText = text;

    // Supprimer les en-têtes Markdown superflus
    formattedText = formattedText.replace(/^#{1,6}\s+/gm, '');
    
    // Gérer les exposants (2^3 -> 2³)
    formattedText = convertToSuperscript(formattedText);
    
    // Gérer les indices (H_2O -> H₂O)
    formattedText = convertToSubscript(formattedText);
    
    // Convertir les sections entre ** en Unicode gras
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
        // Lettres grecques minuscules
        .replace(/\\lambda/g, "λ")
        .replace(/\\mu/g, "μ")
        .replace(/\\alpha/g, "α")
        .replace(/\\beta/g, "β")
        .replace(/\\gamma/g, "γ")
        .replace(/\\delta/g, "δ")
        .replace(/\\epsilon/g, "ε")
        .replace(/\\varepsilon/g, "ε")
        .replace(/\\zeta/g, "ζ")
        .replace(/\\eta/g, "η")
        .replace(/\\theta/g, "θ")
        .replace(/\\vartheta/g, "θ")
        .replace(/\\iota/g, "ι")
        .replace(/\\kappa/g, "κ")
        .replace(/\\nu/g, "ν")
        .replace(/\\xi/g, "ξ")
        .replace(/\\rho/g, "ρ")
        .replace(/\\sigma/g, "σ")
        .replace(/\\tau/g, "τ")
        .replace(/\\upsilon/g, "υ")
        .replace(/\\phi/g, "φ")
        .replace(/\\varphi/g, "φ")
        .replace(/\\chi/g, "χ")
        .replace(/\\psi/g, "ψ")
        .replace(/\\omega/g, "ω")
        // Lettres grecques majuscules
        .replace(/\\Lambda/g, "Λ")
        .replace(/\\Mu/g, "Μ")
        .replace(/\\Alpha/g, "Α")
        .replace(/\\Beta/g, "Β")
        .replace(/\\Gamma/g, "Γ")
        .replace(/\\Delta/g, "Δ")
        .replace(/\\Epsilon/g, "Ε")
        .replace(/\\Zeta/g, "Ζ")
        .replace(/\\Eta/g, "Η")
        .replace(/\\Theta/g, "Θ")
        .replace(/\\Sigma/g, "Σ")
        .replace(/\\Omega/g, "Ω")
        .replace(/\\Phi/g, "Φ")
        .replace(/\\Psi/g, "Ψ")
        .replace(/\\Xi/g, "Ξ")
        // Supprimer les commandes LaTeX restantes inconnues
        .replace(/\\[a-zA-Z]+/g, "")
        .replace(/\\\\/g, "\n")
        .replace(/\{|\}/g, "")
        .replace(/\n\s*\n\s*\n/g, "\n\n")
        .trim();
}

/**
 * Applique la structure finale demandée par l'utilisateur
 */
function applyFinalStructure(responseBody) {
    const header = "✅ 𝐀𝐌𝐏𝐈𝐍𝐆𝐀 𝐃'𝐎𝐑 𝐀𝐈 🇲🇬\n━━━━━━━━━━━━━━━━━━━━\n✍️ 𝐑é𝐩𝐨𝐧𝐬𝐞 👇";
    const footer = "\n━━━━━━━━━━━━━━━━━━━━\n🧠 𝙋𝙤𝙬𝙚𝙧𝙚𝙙 𝙗𝙮 👉 @Bruno | Ampinga AI";
    
    // Formater le corps de la réponse dynamiquement
    let formattedBody = formatText(responseBody);
    formattedBody = cleanLatexSyntax(formattedBody);
    
    // Rendre le texte dynamique et intelligent (ex: numérotation en gras)
    formattedBody = formattedBody.replace(/^(\d+)\.\s+/gm, (match, num) => {
        return `${convertToBold(num)}. `;
    });
    
    // Ajouter des puces stylisées pour la structure
    formattedBody = formattedBody.replace(/\n(𝟏\.|𝟐\.|𝟑\.|𝟒\.|𝟓\.|𝟔\.|𝟕\.|𝟖\.|𝟗\.)/g, '\n\n▸ $1');
    
    return `${header}\n${formattedBody}${footer}`;
}

// --- Fonctions d'appel API ---

/**
 * Appelle l'API Groq
 */
async function callGeminiApi(params) {
    const prompt = params.prompt || params.pro || "décrivez bien cette photo?";
    const image_url = params.image || null;
    const uid = params.uid || "123";

    console.log(`🔗 Appel API Groq: ${API_CONFIG.GROQ_URL}`);

    try {
        const queryParams = {
            prompt: prompt,
            uid: uid
        };

        if (image_url) {
            queryParams.image_url = image_url;
        }

        const response = await axios.get(API_CONFIG.GROQ_URL, {
            params: queryParams,
            timeout: API_CONFIG.TIMEOUT,
            headers: {
                'User-Agent': API_CONFIG.USER_AGENT
            }
        });

        const result = response.data;

        // Extraction dynamique de la réponse selon les champs possibles
        const answer =
            result.response ||
            result.réponse ||
            result.answer ||
            result.reply ||
            result.message ||
            result.text ||
            result.content ||
            (typeof result === 'string' ? result : null);

        if (!answer) {
            console.log('⚠️ Structure de réponse inhabituelle:', result);
            return applyFinalStructure(JSON.stringify(result));
        }

        const finalAnswer = typeof answer === 'string' ? answer : JSON.stringify(answer);
        return applyFinalStructure(replaceBranding(finalAnswer));
    } catch (error) {
        console.error('❌ Erreur API Groq:', error.message);
        throw error;
    }
}

async function chat(prompt, uid) {
    // Vérifier si l'utilisateur a une image en mémoire
    if (userImageMemory.has(uid)) {
        const imageUrl = userImageMemory.get(uid);
        console.log(`📸 Utilisation de l'image en mémoire pour ${uid}`);
        
        try {
            const response = await callGeminiApi({ prompt: prompt, uid, image: imageUrl });
            return response;
        } catch (error) {
            if (error.message.includes("visualiser l'image") || error.message.includes("URL")) {
                userImageMemory.delete(uid);
                throw new Error("L'image en mémoire a expiré ou est inaccessible. Veuillez renvoyer l'image.");
            }
            throw error;
        }
    }
    return await callGeminiApi({ prompt: prompt, uid });
}

async function chatWithMultipleImages(prompt, uid, imageUrls) {
    const params = {
        prompt: prompt && prompt.trim() !== "" ? prompt : "décrivez bien cette photo?",
        uid: uid
    };
    if (imageUrls && imageUrls.length > 0) {
        // L'API Groq accepte directement l'URL de l'image
        params.image = imageUrls[0];
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
            if (bestBreakPoint !== -1) {
                endIndex = bestBreakPoint;
            }
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
        // La structure est déjà appliquée dans callGeminiApi
        await sendLongMessage(senderId, response);
    } catch (error) {
        console.error('❌ Erreur handleTextMessage:', error);
        await sendMessage(senderId, "❌ Une erreur est survenue lors de l'analyse. Veuillez réessayer.");
    }
}

async function handleImageMessage(senderId, imageUrl) {
    try {
        await sendMessage(senderId, "📸 Image reçue! ✨AMPINGA AI l'analyse... ⏳💫");
        
        // Mémoriser l'image pour les questions suivantes
        userImageMemory.set(senderId, imageUrl);
        
        const response = await chatWithMultipleImages("décrivez bien cette photo?", senderId, [imageUrl]);
        // La structure est déjà appliquée dans callGeminiApi
        await sendLongMessage(senderId, response);
    } catch (error) {
        console.error('❌ Erreur handleImageMessage:', error);
        await sendMessage(senderId, "❌ Erreur lors de l'analyse de l'image.");
    }
}

module.exports = {
    handleTextMessage,
    handleImageMessage,
    chat,
    chatWithMultipleImages
};
