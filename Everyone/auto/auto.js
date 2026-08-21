const axios = require('axios');
const sendMessage = require('../../handles/sendMessage');

const userImageMemory = new Map();

const API_CONFIG = {
    // Endpoint principal partagé avec la commande standard du bot.
    PRIMARY_URL: process.env.EVERYONE_AI_URL || "https://norch-project.gleeze.com/api/gemini",
    // Secours direct Groq ; nécessite GROQ_API_KEY dans Render.
    GROQ_URL: process.env.GROQ_API_URL || "https://api.groq.com/openai/v1/chat/completions",
    GROQ_MODEL: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
    GROQ_VISION_MODEL: process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct",
    TIMEOUT: 90000,
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

// === FIX: Télécharger l'image en base64 pour éviter l'expiration des URLs Facebook ===
async function downloadImageAsBase64(url) {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 30000
        });
        const contentType = response.headers['content-type'] || 'image/jpeg';
        const base64 = Buffer.from(response.data, 'binary').toString('base64');
        return `data:${contentType};base64,${base64}`;
    } catch (error) {
        console.error('[AUTO] Erreur téléchargement image:', error.message);
        return null;
    }
}

const SYSTEM_INSTRUCTION = `Tu es un assistant généraliste capable de répondre à des questions sur tous les sujets : sciences, mathématiques, physique, histoire, géographie, langues, littérature, informatique, technologie, culture générale, actualité, vie pratique et bien d'autres domaines.

Réponds directement à la demande de l'utilisateur avec une réponse globale, claire, naturelle, précise et adaptée au contexte. Ne limite jamais tes réponses aux mathématiques ou à la physique. N'organise jamais la réponse en niveaux, parties, étapes numérotées, chapitres ou sections artificielles. N'ajoute pas de titres comme « Partie 1 », « Partie 2 », « Étape 1 », etc. Lorsque le sujet nécessite une explication, rédige-la de manière continue et fluide dans un seul ensemble cohérent, sans découpage en parties.

N'utilise jamais d'émojis ni de marqueurs Markdown comme *, **, #, ##, ___ ou ---. Pour les expressions mathématiques utiles, utilise une notation lisible en texte simple, par exemple a/b, x^2 et lim(x→+∞) f(x). Sois honnête lorsque l'information est incertaine ou manque de contexte.`;

function convertToSubscript(text) {
    if (!text) return "";
    const subscriptMap = {
        '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
        '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
        '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
        'a': 'ₐ', 'e': 'ₑ', 'o': 'ₒ', 'x': 'ₓ', 'h': 'ₕ',
        'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'p': 'ₚ',
        's': 'ₛ', 't': 'ₜ'
    };
    return text.replace(/_([0-9a-z+\-=()]+)/g, (match, p1) => {
        return p1.split('').map(char => subscriptMap[char] || char).join('');
    });
}

function convertToSuperscript(text) {
    if (!text) return "";
    const superscriptMap = {
        '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
        '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
        '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
        'n': 'ⁿ', 'i': 'ⁱ'
    };
    const convert = (str) => str.split('').map(char => superscriptMap[char] || char).join('');
    return text
        .replace(/\^\{([0-9n+\-=()]+)\}/g, (match, p1) => convert(p1))
        .replace(/\^([0-9n+\-=()]+)/g, (match, p1) => convert(p1));
}

function convertToBold(text) {
    if (!text) return "";
    const boldMap = {
        'A': '𝐀', 'B': '𝐁', 'C': '𝐂', 'D': '𝐃', 'E': '𝐄', 'F': '𝐅', 'G': '𝐆', 'H': '𝐇',
        'I': '𝐈', 'J': '𝐉', 'K': '𝐊', 'L': '𝐋', 'M': '𝐌', 'N': '𝐍', 'O': '𝐎', 'P': '𝐏',
        'Q': '𝐐', 'R': '𝐑', 'S': '𝐒', 'T': '𝐓', 'U': '𝐔', 'V': '𝐕', 'W': '𝐖', 'X': '𝐗',
        'Y': '𝐘', 'Z': '𝐙',
        'a': '𝐚', 'b': '𝐛', 'c': '𝐜', 'd': '𝐝', 'e': '𝐞', 'f': '𝐟', 'g': '𝐠', 'h': '𝐡',
        'i': '𝐢', 'j': '𝐣', 'k': '𝐤', 'l': '𝐥', 'm': '𝐦', 'n': '𝐧', 'o': '𝐨', 'p': '𝐩',
        'q': '𝐪', 'r': '𝐫', 's': '𝐬', 't': '𝐭', 'u': '𝐮', 'v': '𝐯', 'w': '𝐰', 'x': '𝐱',
        'y': '𝐲', 'z': '𝐳',
        '0': '𝟎', '1': '𝟏', '2': '𝟐', '3': '𝟑', '4': '𝟒',
        '5': '𝟓', '6': '𝟔', '7': '𝟕', '8': '𝟖', '9': '𝟗'
    };
    return text.split('').map(char => boldMap[char] || char).join('');
}

function replaceBranding(text) {
    if (!text) return "";
    return text
        .replace(/Claude/gi, 'Cours mathématiques et PC Madagascar')
        .replace(/Anthropic/gi, 'Bruno Rakotomalala');
}

function removeEmojis(text) {
    if (!text) return "";
    return text.replace(
        /[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{2300}-\u{23FF}]|[\u{2B00}-\u{2BFF}]|[\u{FE00}-\u{FEFF}]|[\u{1F1E0}-\u{1F1FF}]/gu,
        ''
    ).replace(/[\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF]/g, '');
}

function cleanMarkdown(text) {
    if (!text) return "";
    return text
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*\n]+)\*/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^[-_]{3,}$/gm, '─────────────────────')
        .replace(/^>\s+/gm, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/```[\s\S]*?```/g, (match) => match.replace(/```\w*\n?/g, '').trim());
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
        .replace(/\\lim_\{?([^{}]+)\}?/g, (match, sub) => {
            const cleaned = sub.replace(/\\to/g, '→').replace(/\\infty/g, '∞');
            return `lim(${cleaned})`;
        })
        .replace(/\\lim/g, "lim")
        .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)")
        .replace(/\\implies/g, " ⟹ ")
        .replace(/\\Rightarrow/g, " ⟹ ")
        .replace(/\\rightarrow/g, "→")
        .replace(/\\to/g, "→")
        .replace(/\\leftarrow/g, "←")
        .replace(/\\Leftrightarrow/g, " ⟺ ")
        .replace(/\\leq/g, "≤")
        .replace(/\\geq/g, "≥")
        .replace(/\\neq/g, "≠")
        .replace(/\\approx/g, "≈")
        .replace(/\\infty/g, "∞")
        .replace(/\\sqrt\{([^{}]+)\}/g, "√($1)")
        .replace(/\\sqrt([^{])/g, "√$1")
        .replace(/\\boxed\{([^{}]+)\}/g, "[ $1 ]")
        .replace(/\\quad/g, "  ")
        .replace(/\\,|\\;|\\:|\\!/g, " ")
        .replace(/\\ /g, " ")
        .replace(/\\cdot/g, "·")
        .replace(/\\times/g, "×")
        .replace(/\\div/g, "÷")
        .replace(/\\pm/g, "±")
        .replace(/\\mp/g, "∓")
        .replace(/\\sum/g, "∑")
        .replace(/\\prod/g, "∏")
        .replace(/\\int/g, "∫")
        .replace(/\\partial/g, "∂")
        .replace(/\\nabla/g, "∇")
        .replace(/\\forall/g, "∀")
        .replace(/\\exists/g, "∃")
        .replace(/\\in/g, "∈")
        .replace(/\\notin/g, "∉")
        .replace(/\\subset/g, "⊂")
        .replace(/\\cup/g, "∪")
        .replace(/\\cap/g, "∩")
        .replace(/\\emptyset/g, "∅")
        .replace(/\\mathbb\{R\}/g, "ℝ")
        .replace(/\\mathbb\{N\}/g, "ℕ")
        .replace(/\\mathbb\{Z\}/g, "ℤ")
        .replace(/\\mathbb\{Q\}/g, "ℚ")
        .replace(/\\mathbb\{C\}/g, "ℂ")
        .replace(/\\pi/g, "π")
        .replace(/\\lambda/g, "λ").replace(/\\mu/g, "μ").replace(/\\alpha/g, "α")
        .replace(/\\beta/g, "β").replace(/\\gamma/g, "γ").replace(/\\delta/g, "δ")
        .replace(/\\epsilon/g, "ε").replace(/\\varepsilon/g, "ε").replace(/\\zeta/g, "ζ")
        .replace(/\\eta/g, "η").replace(/\\theta/g, "θ").replace(/\\vartheta/g, "θ")
        .replace(/\\iota/g, "ι").replace(/\\kappa/g, "κ").replace(/\\nu/g, "ν")
        .replace(/\\xi/g, "ξ").replace(/\\rho/g, "ρ").replace(/\\sigma/g, "σ")
        .replace(/\\tau/g, "τ").replace(/\\upsilon/g, "υ").replace(/\\phi/g, "φ")
        .replace(/\\varphi/g, "φ").replace(/\\chi/g, "χ").replace(/\\psi/g, "ψ")
        .replace(/\\omega/g, "ω")
        .replace(/\\Lambda/g, "Λ").replace(/\\Gamma/g, "Γ").replace(/\\Delta/g, "Δ")
        .replace(/\\Theta/g, "Θ").replace(/\\Sigma/g, "Σ").replace(/\\Omega/g, "Ω")
        .replace(/\\Phi/g, "Φ").replace(/\\Psi/g, "Ψ").replace(/\\Xi/g, "Ξ")
        .replace(/\\[a-zA-Z]+/g, "")
        .replace(/\\\\/g, "\n")
        .replace(/\{|\}/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function fixLimitNotation(text) {
    if (!text) return "";
    return text
        .replace(/lim\s*x\s*(?:→|->|->)\s*([+\-]?∞|\+inf|-inf|[+\-]?\d+)/gi, 'lim(x→$1)')
        .replace(/\blim\b(?!\()/g, 'lim');
}

function formatText(text) {
    if (!text) return "";
    let result = text;
    result = cleanMarkdown(result);
    result = cleanLatexSyntax(result);
    result = convertToSuperscript(result);
    result = convertToSubscript(result);
    result = fixLimitNotation(result);
    result = removeEmojis(result);
    result = result.replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n');
    result = result.replace(/\n{3,}/g, '\n\n');
    return result;
}

function removeArtificialSections(text) {
    if (!text) return "";
    return text
        .replace(/\b(?:partie|étape|niveau|section|phase|chapitre|question|exercice)\s+\d+(?:\s*\/\s*\d+)?\s*[:.)-]?\s*/gim, '')
        .replace(/^\s*(?:partie|étape|niveau|section|phase|chapitre)\s*[:.)-]\s*/gim, '')
        .replace(/^\s*◆\s*/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function applyFinalStructure(responseBody) {
    const header = [
        "━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "  𝐀𝐌𝐏𝐈𝐍𝐆𝐀 𝐃'𝐎𝐑 𝐀𝐈  |  𝐌𝐚𝐝𝐚𝐠𝐚𝐬𝐜𝐚𝐫",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━",
        ""
    ].join('\n');

    const footer = [
        "",
        "──────────────────────────",
        "  Propulsé par Bruno | Ampinga AI",
        "──────────────────────────"
    ].join('\n');

    let body = responseBody;
    body = formatText(body);
    body = removeArtificialSections(body);

    return `${header}${body}${footer}`;
}

async function callAutoApi(params) {
    const rawPrompt = params.prompt || params.pro || "Décrivez bien cette photo.";
    const imageUrls = params.images && params.images.length > 0
        ? params.images
        : (params.image ? [params.image] : []);
    const uid = params.uid || "123";

    const finalPrompt = `${SYSTEM_INSTRUCTION}\n\n---\n\n${rawPrompt}`;

    const extractAnswer = (result) => {
        if (!result) return null;
        return result.response ||
            result.réponse ||
            result.answer ||
            result.reply ||
            result.message ||
            result.text ||
            result.content ||
            (result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content) ||
            (typeof result === 'string' ? result : null);
    };

    const attempts = [
        {
            name: 'Gemini principal',
            request: () => axios.get(API_CONFIG.PRIMARY_URL, {
                params: {
                    prompt: finalPrompt,
                    uid,
                    ...(imageUrls[0] ? { imageurl: imageUrls[0] } : {})
                },
                timeout: API_CONFIG.TIMEOUT,
                headers: { 'User-Agent': API_CONFIG.USER_AGENT }
            })
        },
        {
            name: 'Groq direct',
            request: () => {
                const apiKey = process.env.GROQ_API_KEY;
                if (!apiKey) throw new Error('GROQ_API_KEY non configurée dans Render');
                const content = imageUrls.length > 0
                    ? [{ type: 'text', text: finalPrompt }, ...imageUrls.map(url => ({ type: 'image_url', image_url: { url } }))]
                    : finalPrompt;
                return axios.post(API_CONFIG.GROQ_URL, {
                    model: imageUrls.length > 0 ? API_CONFIG.GROQ_VISION_MODEL : API_CONFIG.GROQ_MODEL,
                    messages: [{ role: 'user', content }],
                    temperature: 0.2,
                    max_tokens: 2048
                }, {
                    timeout: API_CONFIG.TIMEOUT,
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        'User-Agent': API_CONFIG.USER_AGENT
                    }
                });
            }
        }
    ];

    let lastError;
    for (const attempt of attempts) {
        try {
            console.log(`[AUTO] Appel ${attempt.name}: ${imageUrls.length} image(s)`);
            const response = await attempt.request();
            const answer = extractAnswer(response.data);
            if (!answer) throw new Error(`Réponse vide depuis ${attempt.name}`);
            const finalAnswer = typeof answer === 'string' ? answer : JSON.stringify(answer);
            return applyFinalStructure(replaceBranding(finalAnswer));
        } catch (error) {
            lastError = error;
            console.error(`[AUTO] ${attempt.name} indisponible:`, error.message);
            if (error.response) {
                console.error('[AUTO] Status:', error.response.status);
                console.error('[AUTO] Data:', JSON.stringify(error.response.data));
            }
        }
    }

    throw lastError || new Error('Aucun service IA disponible');
}

// === FIX: Fallback intelligent — si l'appel avec image échoue, réessayer sans image ===
async function chat(prompt, uid) {
    if (userImageMemory.has(uid)) {
        const imageData = userImageMemory.get(uid);
        try {
            return await callAutoApi({ prompt, uid, image: imageData });
        } catch (error) {
            console.error('[AUTO] Échec appel avec image:', error.message);
            // Image expirée ou inaccessible → on efface la mémoire et on réessaie sans image
            userImageMemory.delete(uid);
            console.log('[AUTO] Image supprimée de la mémoire, réessai sans image...');
            return await callAutoApi({ prompt, uid });
        }
    }
    return await callAutoApi({ prompt, uid });
}

async function chatWithMultipleImages(prompt, uid, imageUrls) {
    const params = {
        prompt: prompt && prompt.trim() !== "" ? prompt : "Décrivez bien cette photo.",
        uid,
        images: imageUrls && imageUrls.length > 0 ? imageUrls : []
    };
    return await callAutoApi(params);
}

async function sendLongMessage(senderId, message) {
    const MAX_LENGTH = 2000;
    if (message.length <= MAX_LENGTH) {
        await sendMessage(senderId, message);
        return;
    }
    let start = 0;
    while (start < message.length) {
        let end = start + MAX_LENGTH;
        if (end < message.length) {
            const separators = ['\n\n', '\n', '. ', ', ', ' '];
            let best = -1;
            for (const sep of separators) {
                const pos = message.lastIndexOf(sep, end);
                if (pos > start && pos > best) best = pos + sep.length;
            }
            if (best !== -1) end = best;
        } else {
            end = message.length;
        }
        await sendMessage(senderId, message.substring(start, end));
        await new Promise(r => setTimeout(r, 1000));
        start = end;
    }
}

async function handleTextMessage(senderId, message) {
    try {
        if (message && message.toLowerCase() === 'clear') {
            userImageMemory.delete(senderId);
            await sendMessage(senderId, "Conversation réinitialisée avec succès.");
            return;
        }
        if (!message || message.trim() === '') {
            await sendMessage(senderId, "Bonjour ! Je suis AMPINGA AI. Posez-moi une question ou envoyez une image.");
            return;
        }
        await sendMessage(senderId, "Analyse en cours, veuillez patienter...");
        const response = await chat(message, senderId);
        await sendLongMessage(senderId, response);
    } catch (error) {
        console.error('[AUTO] Erreur handleTextMessage:', error);
        await sendMessage(senderId, "Le service IA est temporairement indisponible. Veuillez réessayer dans quelques instants.");
    }
}

// === FIX: Télécharger l'image immédiatement en base64 au lieu de stocker l'URL éphémère ===
async function handleImageMessage(senderId, imageUrl) {
    try {
        await sendMessage(senderId, "Image reçue. Analyse en cours, veuillez patienter...");

        // Télécharger l'image en base64 pour éviter l'expiration de l'URL Facebook.
        // L'API accepte désormais les requêtes POST, ce qui permet d'envoyer de gros volumes de données.
        const dataUrl = await downloadImageAsBase64(imageUrl);
        const imageToUse = dataUrl || imageUrl;

        userImageMemory.set(senderId, imageToUse);
        const response = await chatWithMultipleImages("Décrivez bien cette image.", senderId, [imageToUse]);
        await sendLongMessage(senderId, response);
    } catch (error) {
        console.error('[AUTO] Erreur handleImageMessage:', error.message);
        if (error.response) {
            console.error('[AUTO] Détails erreur:', error.response.status, error.response.data);
        }
        await sendMessage(senderId, "Le service IA est temporairement indisponible pour l'analyse de l'image. Veuillez réessayer dans quelques instants.");
    }
}

module.exports = {
    handleTextMessage,
    handleImageMessage,
    chat,
    chatWithMultipleImages
};