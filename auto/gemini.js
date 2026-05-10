const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const userImageMemory = new Map();

const API_CONFIG = {
    GROQ_URL: "https://groqapi--malalatianasay.replit.app/prompt",
    TIMEOUT: 90000,
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

const SYSTEM_INSTRUCTION = `Tu es un assistant mathématique et scientifique expert. Réponds TOUJOURS en respectant ces règles strictes :
1. N'utilise JAMAIS d'émojis dans ta réponse.
2. N'utilise JAMAIS de marqueurs Markdown comme *, **, #, ##, ___, ---, etc.
3. Pour les fractions, écris sous la forme a/b.
4. Pour les limites, écris : lim(x→+∞) f(x) ou lim(x→-∞) f(x).
5. Pour les exposants, utilise la notation ^ : x^2, e^(-x), 10^(-2).
6. Pour les indices, utilise la notation _ : x_0, f_n.
7. Pour les intervalles, écris [0 ; +∞[ ou ]-∞ ; 0].
8. Sépare chaque étape de calcul sur une nouvelle ligne.
9. Structure ta réponse avec des titres clairs en texte simple (ex: Partie 1 : Limites).
10. Sois précis, rigoureux et pédagogique.`;

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

function formatSectionTitle(text) {
    return text.replace(
        /^(Partie\s+\d+\s*:.*|Question\s+\d+.*|Exercice\s+\d+.*)$/gim,
        (match) => `\n◆ ${convertToBold(match.trim())}`
    );
}

function formatSteps(text) {
    return text
        .replace(/^(\d+)\.\s+([a-z]\.\s+)?/gm, (match, num, sub) => {
            const boldNum = convertToBold(num);
            const boldSub = sub ? convertToBold(sub.trim()) + ' ' : '';
            return `\n▸ ${boldNum}. ${boldSub}`;
        })
        .replace(/^(Réponse\s*:?|Solution\s*:?|Démonstration\s*:?|Interprétation\s*:?)/gim, (match) => {
            return `  ${convertToBold(match.replace(':', '').trim())} :`;
        });
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
    body = formatSectionTitle(body);
    body = formatSteps(body);
    body = body.trim();

    return `${header}${body}${footer}`;
}

async function callGeminiApi(params) {
    const rawPrompt = params.prompt || params.pro || "Décrivez bien cette photo.";
    const image_url = params.image || null;
    const uid = params.uid || "123";

    const finalPrompt = `${SYSTEM_INSTRUCTION}\n\n---\n\n${rawPrompt}`;

    console.log(`Appel API Groq: ${API_CONFIG.GROQ_URL}`);

    try {
        const queryParams = {
            prompt: finalPrompt,
            uid: uid
        };

        if (image_url) {
            queryParams.image_url = image_url;
        }

        const response = await axios.get(API_CONFIG.GROQ_URL, {
            params: queryParams,
            timeout: API_CONFIG.TIMEOUT,
            headers: { 'User-Agent': API_CONFIG.USER_AGENT }
        });

        const result = response.data;

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
            console.log('Structure de réponse inhabituelle:', result);
            return applyFinalStructure(JSON.stringify(result));
        }

        const finalAnswer = typeof answer === 'string' ? answer : JSON.stringify(answer);
        return applyFinalStructure(replaceBranding(finalAnswer));
    } catch (error) {
        console.error('Erreur API Groq:', error.message);
        throw error;
    }
}

async function chat(prompt, uid) {
    if (userImageMemory.has(uid)) {
        const imageUrl = userImageMemory.get(uid);
        try {
            return await callGeminiApi({ prompt, uid, image: imageUrl });
        } catch (error) {
            if (error.message.includes("visualiser l'image") || error.message.includes("URL")) {
                userImageMemory.delete(uid);
                throw new Error("L'image en mémoire a expiré. Veuillez renvoyer l'image.");
            }
            throw error;
        }
    }
    return await callGeminiApi({ prompt, uid });
}

async function chatWithMultipleImages(prompt, uid, imageUrls) {
    const params = {
        prompt: prompt && prompt.trim() !== "" ? prompt : "Décrivez bien cette photo.",
        uid
    };
    if (imageUrls && imageUrls.length > 0) {
        params.image = imageUrls[0];
    }
    return await callGeminiApi(params);
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
        console.error('Erreur handleTextMessage:', error);
        await sendMessage(senderId, "Une erreur est survenue. Veuillez réessayer.");
    }
}

async function handleImageMessage(senderId, imageUrl) {
    try {
        await sendMessage(senderId, "Image reçue. Analyse en cours, veuillez patienter...");
        userImageMemory.set(senderId, imageUrl);
        const response = await chatWithMultipleImages("Décrivez bien cette image.", senderId, [imageUrl]);
        await sendLongMessage(senderId, response);
    } catch (error) {
        console.error('Erreur handleImageMessage:', error);
        await sendMessage(senderId, "Erreur lors de l'analyse de l'image.");
    }
}

module.exports = {
    handleTextMessage,
    handleImageMessage,
    chat,
    chatWithMultipleImages
};
