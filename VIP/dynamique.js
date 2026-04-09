const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sendMessage = require('../handles/sendMessage');

// Stockage temporaire des images en attente de question (par utilisateur)
const pendingImages = {};

// Stockage du modèle préféré par utilisateur ('edu' | 'claude')
const userModels = {};

const API_BASE = 'https://claude-46-replit--mitiasoa.replit.app/api';
const MAX_MESSAGE_LENGTH = 1900;
const API_TIMEOUT = 120000;

const DECORATIONS = {
    top:       '╔══════════════════════════════╗',
    mid:       '╠══════════════════════════════╣',
    bot:       '╚══════════════════════════════╝',
    divider:   '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    dotted:    '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈',
    stars:     '✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦'
};

const EMOJIS = {
    brain:   ['🧠', '💡', '🔮', '⚡', '🌟', '✨', '🎯', '🚀'],
    science: ['🔬', '⚛️', '🧪', '📐', '📏', '🧮', '📊', '📈']
};

const LOADING_MESSAGES = [
    '🧠 Analyse de ta question en cours...',
    '🔬 Consultation des bases scientifiques...',
    '⚡ Génération de la réponse en cours...',
    '🌟 Préparation d\'une explication détaillée...',
    '🚀 L\'assistant éducatif réfléchit...',
    '💡 Synthèse des connaissances en cours...',
    '🎯 Formulation de la réponse parfaite...',
    '🔮 Traitement de ta requête pédagogique...'
];

const CLAUDE_LOADING_MESSAGES = [
    '🤖 Claude analyse ta demande...',
    '🧩 Réflexion en cours avec Claude...',
    '🌐 Claude traite ta question...',
    '⚡ Claude génère une réponse précise...',
    '🔍 Analyse approfondie par Claude...'
];

// ── Conversion Markdown → texte Unicode formaté pour Messenger ──
const BOLD_MAP = {
    'A':'𝗔','B':'𝗕','C':'𝗖','D':'𝗗','E':'𝗘','F':'𝗙','G':'𝗚','H':'𝗛','I':'𝗜','J':'𝗝',
    'K':'𝗞','L':'𝗟','M':'𝗠','N':'𝗡','O':'𝗢','P':'𝗣','Q':'𝗤','R':'𝗥','S':'𝗦','T':'𝗧',
    'U':'𝗨','V':'𝗩','W':'𝗪','X':'𝗫','Y':'𝗬','Z':'𝗭',
    'a':'𝗮','b':'𝗯','c':'𝗰','d':'𝗱','e':'𝗲','f':'𝗳','g':'𝗴','h':'𝗵','i':'𝗶','j':'𝗷',
    'k':'𝗸','l':'𝗹','m':'𝗺','n':'𝗻','o':'𝗼','p':'𝗽','q':'𝗾','r':'𝗿','s':'𝘀','t':'𝘁',
    'u':'𝘂','v':'𝘃','w':'𝘄','x':'𝘅','y':'𝘆','z':'𝘇',
    '0':'𝟬','1':'𝟭','2':'𝟮','3':'𝟯','4':'𝟰','5':'𝟱','6':'𝟲','7':'𝟳','8':'𝟴','9':'𝟵'
};

function toBold(text) {
    return text.split('').map(c => BOLD_MAP[c] || c).join('');
}

function formatMarkdown(text) {
    if (!text) return '';
    let out = text;

    // # Titre H1 → 📌 𝗧𝗶𝘁𝗿𝗲
    out = out.replace(/^#{1}\s+(.+)$/gm, (_, t) => '📌 ' + toBold(t.trim()));

    // ## Titre H2 → 🔷 𝗧𝗶𝘁𝗿𝗲
    out = out.replace(/^#{2}\s+(.+)$/gm, (_, t) => '\n🔷 ' + toBold(t.trim()));

    // ### Titre H3 → ▫️ 𝗧𝗶𝘁𝗿𝗲
    out = out.replace(/^#{3}\s+(.+)$/gm, (_, t) => '▫️ ' + toBold(t.trim()));

    // #### Titre H4+ → • 𝗧𝗶𝘁𝗿𝗲
    out = out.replace(/^#{4,}\s+(.+)$/gm, (_, t) => '• ' + toBold(t.trim()));

    // **texte** → 𝗯𝗼𝗹𝗱 Unicode (peut être multi-ligne sur une même ligne)
    out = out.replace(/\*\*([^*\n]+)\*\*/g, (_, t) => toBold(t));

    // *texte* (italique seul) → texte simple (Messenger ne supporte pas l'italique)
    out = out.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, (_, t) => t);

    // --- → ligne de séparation légère
    out = out.replace(/^-{3,}$/gm, '┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄');

    // Réduire les lignes vides excessives
    out = out.replace(/\n{3,}/g, '\n\n');

    return out.trim();
}

function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getTimestamp() {
    return new Date().toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function getBaseUrl() {
    if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL;
    if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
    return `http://localhost:${process.env.PORT || 5000}`;
}

function splitMessage(text, maxLen = MAX_MESSAGE_LENGTH) {
    if (text.length <= maxLen) return [text];
    const parts = [];
    const lines = text.split('\n');
    let current = '';
    for (const line of lines) {
        const candidate = current ? current + '\n' + line : line;
        if (candidate.length > maxLen) {
            if (current) parts.push(current.trim());
            if (line.length > maxLen) {
                const words = line.split(' ');
                current = '';
                for (const word of words) {
                    const test = current ? current + ' ' + word : word;
                    if (test.length > maxLen) {
                        if (current) parts.push(current.trim());
                        current = word;
                    } else {
                        current = test;
                    }
                }
            } else {
                current = line;
            }
        } else {
            current = candidate;
        }
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
}

async function sendSplit(senderId, text) {
    const parts = splitMessage(text);
    for (let i = 0; i < parts.length; i++) {
        await sendMessage(senderId, parts[i]);
        if (i < parts.length - 1) await delay(350);
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function svgToPng(svgBuffer) {
    const { Resvg } = require('@resvg/resvg-js');
    const resvg = new Resvg(svgBuffer, {
        fitTo: { mode: 'width', value: 900 },
        background: 'white'
    });
    const rendered = resvg.render();
    return rendered.asPng();
}

async function sendFigureAsImage(senderId, figureSvgB64) {
    try {
        const svgBuffer = Buffer.from(figureSvgB64, 'base64');
        const pngBuffer = await svgToPng(svgBuffer);

        const fileName = `figure_${senderId}_${Date.now()}.png`;
        const tmpPath = path.join('/tmp', fileName);
        fs.writeFileSync(tmpPath, pngBuffer);

        const baseUrl = getBaseUrl();
        const imageUrl = `${baseUrl}/temp/${fileName}`;

        await sendMessage(senderId, {
            attachment: {
                type: 'image',
                payload: {
                    url: imageUrl,
                    is_reusable: false
                }
            }
        });

        setTimeout(() => {
            try {
                if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
            } catch (e) {
                console.error('Erreur suppression figure PNG:', e.message);
            }
        }, 300000);

        return true;
    } catch (err) {
        console.error('Erreur conversion SVG→PNG:', err.message);
        return false;
    }
}

// ── API : /api/edu (modèle éducatif avec figures) ──
async function callEduApi(prompt, uid, imageUrl = null) {
    const params = new URLSearchParams({ prompt, uid });
    if (imageUrl) params.append('image_url', imageUrl);
    const url = `${API_BASE}/edu?${params.toString()}`;
    const response = await axios.get(url, { timeout: API_TIMEOUT });
    return response.data;
}

// ── API : /api/claude (modèle Claude, vision + texte) ──
// Retourne : { meta: {model, image_analyzed, turn_count, ...}, result: {title, sections, raw}, figures: [] }
async function callClaudeApi(prompt, uid, imageUrl = null) {
    const params = new URLSearchParams({ prompt, uid });
    if (imageUrl) params.append('image_url', imageUrl);
    const url = `${API_BASE}/claude?${params.toString()}`;
    const response = await axios.get(url, { timeout: API_TIMEOUT });
    return response.data;
}

// ── Formatage de la réponse Claude en texte lisible ──
function formatClaudeResponse(data) {
    const result = data.result || {};
    const meta   = data.meta   || {};

    // Priorité : raw complet, sinon reconstituer depuis les sections
    if (result.raw && result.raw.trim()) {
        return result.raw.trim();
    }

    const sections = result.sections || [];
    if (sections.length === 0) return '';

    return sections.map(s => {
        const heading = s.heading ? `**${s.heading}**\n` : '';
        const content = s.content || '';
        const bullets = (s.bullets || []).map(b => `• ${b}`).join('\n');
        return [heading + content, bullets].filter(Boolean).join('\n');
    }).join('\n\n').trim();
}

async function getHistory(uid) {
    const url = `${API_BASE}/edu/history?uid=${encodeURIComponent(uid)}`;
    const response = await axios.get(url, { timeout: 20000 });
    return response.data;
}

async function deleteHistory(uid) {
    const url = `${API_BASE}/edu/history?uid=${encodeURIComponent(uid)}`;
    const response = await axios.delete(url, { timeout: 20000 });
    return response.data;
}

// ── Affiche le modèle actif de l'utilisateur ──
function getUserModel(senderId) {
    return userModels[senderId] || 'edu';
}

function getModelLabel(model) {
    return model === 'claude'
        ? '🤖 Claude AI'
        : '🎓 Assistant Éducatif';
}

async function showWelcome(senderId) {
    const currentModel = getUserModel(senderId);
    const welcome = `
${DECORATIONS.top}
║  🎓 𝗔𝗦𝗦𝗜𝗦𝗧𝗔𝗡𝗧 𝗗𝗬𝗡𝗔𝗠𝗜𝗤𝗨𝗘  🎓
║  ✨ Science • Maths • Physique ✨
${DECORATIONS.bot}

${getRandom(EMOJIS.brain)} 𝗖𝗮𝗽𝗮𝗯𝗶𝗹𝗶𝘁𝗲́𝘀 :
${DECORATIONS.divider}
📐 Résolution d'exercices de maths
⚛️ Explication de physique & chimie
📊 Tracé de courbes avec figure envoyée
🖼️ Analyse d'images de sujets
🔢 Arithmétique & algèbre avancée
📈 Statistiques & probabilités

${DECORATIONS.dotted}
🎯 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝗲𝘀 𝗱𝗶𝘀𝗽𝗼𝗻𝗶𝗯𝗹𝗲𝘀 :
${DECORATIONS.divider}
💬 dynamique <question>       → Poser une question
🤖 dynamique claude <question> → Utiliser Claude AI
🎓 dynamique edu <question>   → Utiliser l'assistant éducatif
🖼️ [Image + texte]            → Analyser une image
🔄 dynamique mode claude      → Passer en mode Claude
🔄 dynamique mode edu         → Passer en mode Éducatif
📜 dynamique historique       → Voir l'historique
🗑️ dynamique reset            → Effacer l'historique
⛔ dynamique stop             → Terminer la session

${DECORATIONS.dotted}
⚙️ 𝗠𝗼𝗱𝗲̀𝗹𝗲 𝗮𝗰𝘁𝘂𝗲𝗹 : ${getModelLabel(currentModel)}
${DECORATIONS.stars}
💡 Pose-moi ta question !`.trim();

    await sendMessage(senderId, welcome);
}

async function showHistory(senderId, uid) {
    try {
        await sendMessage(senderId, `📜 Récupération de l'historique...\n${DECORATIONS.divider}\n⏳ Connexion au serveur...`);

        const data = await getHistory(uid);
        const messages = data.messages || [];
        const turnCount = data.turn_count || 0;

        if (messages.length === 0) {
            await sendMessage(senderId, `
📭 𝗛𝗶𝘀𝘁𝗼𝗿𝗶𝗾𝘂𝗲 𝘃𝗶𝗱𝗲
${DECORATIONS.divider}
Aucune conversation enregistrée.

💡 Pose ta première question :
👉 dynamique <ta question>`.trim());
            return;
        }

        const header = `
📜 𝗛𝗜𝗦𝗧𝗢𝗥𝗜𝗤𝗨𝗘 𝗗𝗘 𝗖𝗢𝗡𝗩𝗘𝗥𝗦𝗔𝗧𝗜𝗢𝗡
${DECORATIONS.top}
║ 💬 Tours : ${turnCount}
║ 📅 Créé : ${data.created_at ? new Date(data.created_at).toLocaleString('fr-FR') : 'N/A'}
${DECORATIONS.bot}`.trim();

        await sendMessage(senderId, header);
        await delay(300);

        const recentMessages = messages.slice(-6);
        for (let i = 0; i < recentMessages.length; i++) {
            const msg = recentMessages[i];
            const role = msg.role === 'user' ? '👤 Toi' : '🤖 Assistant';
            const content = msg.content || msg.text || '(vide)';
            const preview = content.length > 300 ? content.substring(0, 300) + '...' : content;
            await sendSplit(senderId, `${DECORATIONS.dotted}\n${role} :\n${preview}`);
            await delay(250);
        }

        await sendMessage(senderId, `
${DECORATIONS.divider}
✅ Fin de l'historique (${messages.length} message(s))
🗑️ Tape "reset" pour effacer.`.trim());

    } catch (error) {
        console.error('Erreur getHistory dynamique:', error.message);
        await sendMessage(senderId, `❌ Impossible de récupérer l'historique.\n🔄 Réessaie dans quelques instants.`);
    }
}

async function handleReset(senderId, uid) {
    try {
        await sendMessage(senderId, `🗑️ Effacement de l'historique...\n${DECORATIONS.divider}\n⏳ En cours...`);
        const result = await deleteHistory(uid);

        if (result.deleted) {
            await sendMessage(senderId, `
✅ 𝗛𝗶𝘀𝘁𝗼𝗿𝗶𝗾𝘂𝗲 𝗲𝗳𝗳𝗮𝗰𝗲́ !
${DECORATIONS.top}
║  🎉 Conversation réinitialisée !
║  🚀 Tu peux repartir à zéro.
${DECORATIONS.bot}

💬 Pose ta prochaine question :
👉 dynamique <ta question>`.trim());
        } else {
            await sendMessage(senderId, `⚠️ Aucun historique à supprimer.\n💡 Commence une nouvelle conversation !`);
        }
    } catch (error) {
        console.error('Erreur reset dynamique:', error.message);
        await sendMessage(senderId, `❌ Erreur lors de la suppression.\n🔄 Réessaie dans quelques instants.`);
    }
}

async function handleStop(senderId) {
    await sendMessage(senderId, `
⛔ 𝗦𝗲𝘀𝘀𝗶𝗼𝗻 𝘁𝗲𝗿𝗺𝗶𝗻𝗲́𝗲
${DECORATIONS.top}
║  👋 À bientôt sur DYNAMIQUE !
║  📚 Continue d'apprendre !
${DECORATIONS.bot}

${DECORATIONS.stars}
💡 Reviens quand tu veux avec :
👉 dynamique <ta question>`.trim());
}

// ── Gestion du changement de mode ──
async function handleModeSwitch(senderId, newModel) {
    const validModels = ['edu', 'claude'];
    if (!validModels.includes(newModel)) {
        await sendMessage(senderId, `
⚠️ 𝗠𝗼𝗱𝗲̀𝗹𝗲 𝗶𝗻𝗰𝗼𝗻𝗻𝘂
${DECORATIONS.divider}
Modèles disponibles :
🎓 edu    → Assistant Éducatif (figures, maths)
🤖 claude → Claude AI (vision, général)

💡 Exemple : dynamique mode claude`.trim());
        return;
    }

    userModels[senderId] = newModel;
    const label = getModelLabel(newModel);

    await sendMessage(senderId, `
✅ 𝗠𝗼𝗱𝗲̀𝗹𝗲 𝗰𝗵𝗮𝗻𝗴𝗲́ !
${DECORATIONS.top}
║  ⚙️ Modèle actif : ${label}
${DECORATIONS.bot}

💬 Tes prochaines questions utiliseront ${label}.
👉 Pose ta question maintenant !`.trim());
}

// ── Question via /api/edu ──
// ── Extrait les blocs <SVG_FIGURE>...</SVG_FIGURE> du texte explanation ──
// Retourne { cleanText, svgList } où svgList est un tableau de base64 SVG
function extractSvgFromText(text) {
    const svgList = [];
    // Capturer tout contenu entre <SVG_FIGURE> et </SVG_FIGURE> (ou <svg> seul)
    const tagRegex = /<SVG_FIGURE>([\s\S]*?)<\/SVG_FIGURE>/gi;
    const rawSvgRegex = /(<svg[\s\S]*?<\/svg>)/gi;

    let cleanText = text.replace(tagRegex, (match, svgContent) => {
        const b64 = Buffer.from(svgContent.trim()).toString('base64');
        svgList.push(b64);
        return '';
    });

    // Si pas de balises SVG_FIGURE mais du SVG brut dans le texte
    if (svgList.length === 0) {
        cleanText = cleanText.replace(rawSvgRegex, (match) => {
            const b64 = Buffer.from(match.trim()).toString('base64');
            svgList.push(b64);
            return '';
        });
    }

    // Nettoyer les lignes vides excessives laissées par l'extraction
    cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();
    return { cleanText, svgList };
}

// ── Supprime les placeholders [FIGURE:Fx] du texte Claude ──
function stripFigurePlaceholders(text) {
    return text.replace(/\[FIGURE:[^\]]+\]/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

async function handleQuestion(senderId, question, imageUrl = null) {
    const isComplex = /courbe|trace|graphe|graph|dessin|repr[eé]sent|fonction|parabole|sinuso|cercle|droite/i.test(question);

    const loadingBubble = imageUrl
        ? `🖼️ 𝗔𝗻𝗮𝗹𝘆𝘀𝗲 𝗱'𝗶𝗺𝗮𝗴𝗲 𝗲𝗻 𝗰𝗼𝘂𝗿𝘀...\n${DECORATIONS.divider}\n🔬 Examen visuel de l'image...\n📝 "${question.substring(0, 80)}${question.length > 80 ? '...' : ''}"`
        : isComplex
            ? `📊 𝗚𝗲́𝗻𝗲́𝗿𝗮𝘁𝗶𝗼𝗻 𝗱𝗲 𝗳𝗶𝗴𝘂𝗿𝗲 𝗲𝗻 𝗰𝗼𝘂𝗿𝘀...\n${DECORATIONS.divider}\n✏️ Tracé de la courbe...\n⏳ Cette opération peut prendre ~1 minute.\n📝 "${question.substring(0, 80)}${question.length > 80 ? '...' : ''}"`
            : `${getRandom(LOADING_MESSAGES)}\n${DECORATIONS.divider}\n📝 "${question.substring(0, 80)}${question.length > 80 ? '...' : ''}"`;

    await sendMessage(senderId, loadingBubble);

    try {
        const data = await callEduApi(question, senderId, imageUrl);

        const rawExplanation = data.explanation || '';
        const hasFigure      = data.has_figure || false;
        const turnCount      = data.turn_count || 1;
        let   figureSvgB64   = data.figure_svg_b64 || null;

        // ── Extraire les SVG embarqués dans le texte explanation ──
        const { cleanText, svgList } = extractSvgFromText(rawExplanation);
        // ── Formater le Markdown en texte Unicode propre pour Messenger ──
        const explanation = formatMarkdown(cleanText);

        // Si l'API n'a pas fourni figure_svg_b64 mais qu'on a extrait du SVG du texte
        if (!figureSvgB64 && svgList.length > 0) {
            figureSvgB64 = svgList[0];
        }

        const header = `
${DECORATIONS.top}
║  ${getRandom(EMOJIS.brain)} 𝗔𝗦𝗦𝗜𝗦𝗧𝗔𝗡𝗧 𝗗𝗬𝗡𝗔𝗠𝗜𝗤𝗨𝗘  ${getRandom(EMOJIS.science)}
║  💬 Tour n°${turnCount} • ${getTimestamp()}
${DECORATIONS.bot}`.trim();

        await sendMessage(senderId, header);
        await delay(300);

        if (explanation) {
            await sendSplit(senderId, explanation);
        }

        // Envoyer la figure principale (figure_svg_b64 ou extraite du texte)
        if ((hasFigure || figureSvgB64) && figureSvgB64) {
            await delay(400);
            await sendMessage(senderId, `📊 Génération de l'image de la figure...`);

            const sent = await sendFigureAsImage(senderId, figureSvgB64);

            if (!sent) {
                await sendMessage(senderId, `
${DECORATIONS.dotted}
⚠️ La figure n'a pas pu être envoyée en image.
💡 L'explication ci-dessus reste complète.`.trim());
            }
        }

        // Envoyer les figures supplémentaires extraites du texte (s'il y en a plusieurs)
        for (let i = 1; i < svgList.length; i++) {
            await delay(400);
            await sendFigureAsImage(senderId, svgList[i]);
        }

        await delay(300);
        const footer = `
${DECORATIONS.stars}
💬 Tour ${turnCount} terminé
${DECORATIONS.dotted}
📝 Pose une autre question ou tape :
⛔ "stop" → Terminer | 📜 "historique" → Voir l'historique
🗑️ "reset" → Effacer | 🔄 "mode claude" → Passer à Claude`.trim();

        await sendMessage(senderId, footer);

    } catch (error) {
        console.error('Erreur API dynamique (edu):', error.message, error.code);
        await sendMessage(senderId, buildErrorMessage(error));
    }
}

// ── Question via /api/claude ──
async function handleClaudeQuestion(senderId, question, imageUrl = null) {
    const loadingBubble = imageUrl
        ? `🖼️ 𝗔𝗻𝗮𝗹𝘆𝘀𝗲 𝗶𝗺𝗮𝗴𝗲 𝗮𝘃𝗲𝗰 𝗖𝗹𝗮𝘂𝗱𝗲...\n${DECORATIONS.divider}\n🤖 Claude examine l'image...\n📝 "${question.substring(0, 80)}${question.length > 80 ? '...' : ''}"`
        : `${getRandom(CLAUDE_LOADING_MESSAGES)}\n${DECORATIONS.divider}\n📝 "${question.substring(0, 80)}${question.length > 80 ? '...' : ''}"`;

    await sendMessage(senderId, loadingBubble);

    try {
        const data = await callClaudeApi(question, senderId, imageUrl);

        // Structure réelle : { meta, result: {title, sections, raw}, figures }
        const meta      = data.meta   || {};
        const turnCount = meta.turn_count || data.turn_count || 1;
        const title     = data.result?.title || '';
        const responseText = formatClaudeResponse(data);

        const header = `
${DECORATIONS.top}
║  🤖 𝗖𝗟𝗔𝗨𝗗𝗘 𝗔𝗜${title ? ' • ' + title.substring(0, 25) : ''} 
║  💬 Tour n°${turnCount} • ${getTimestamp()}
${DECORATIONS.bot}`.trim();

        await sendMessage(senderId, header);
        await delay(300);

        // Nettoyer les placeholders [FIGURE:Fx] et formater le Markdown
        const cleanResponseText = formatMarkdown(stripFigurePlaceholders(responseText));

        if (cleanResponseText) {
            await sendSplit(senderId, cleanResponseText);
        } else {
            await sendMessage(senderId, `⚠️ Aucune réponse reçue de Claude.`);
        }

        // Afficher les figures si l'API en retourne
        const figures = data.figures || [];
        for (const fig of figures) {
            const svgRaw = fig.svg_b64 || fig.svg || fig.data || '';
            if (svgRaw) {
                await delay(400);
                await sendMessage(senderId, `📊 Génération de l'image de la figure...`);
                // svg_b64 est déjà en base64 ; fig.svg est du SVG brut à convertir
                const b64 = fig.svg_b64
                    ? fig.svg_b64
                    : Buffer.from(fig.svg || fig.data).toString('base64');
                const sent = await sendFigureAsImage(senderId, b64);
                if (!sent) {
                    await sendMessage(senderId, `⚠️ La figure n'a pas pu être envoyée en image.`);
                }
            }
        }

        await delay(300);
        const footer = `
${DECORATIONS.stars}
🤖 Claude • Tour ${turnCount} terminé
${DECORATIONS.dotted}
📝 Pose une autre question ou tape :
⛔ "stop" → Terminer | 🔄 "mode edu" → Passer à Éducatif
🗑️ "reset" → Effacer | 📜 "historique" → Historique`.trim();

        await sendMessage(senderId, footer);

    } catch (error) {
        console.error('Erreur API dynamique (claude):', error.message, error.code);

        // Si Claude est indisponible, fallback vers edu (sans image car edu ne supporte pas les images)
        const isUnavailable = error.response?.status === 404 || error.response?.status === 503;
        if (isUnavailable && !imageUrl) {
            await sendMessage(senderId, `
⚠️ 𝗖𝗹𝗮𝘂𝗱𝗲 𝗶𝗻𝗱𝗶𝘀𝗽𝗼𝗻𝗶𝗯𝗹𝗲
${DECORATIONS.divider}
Le modèle Claude est temporairement inaccessible.

🔄 Basculement automatique vers l'assistant éducatif...`.trim());
            await delay(500);
            await handleQuestion(senderId, question, null);
        } else {
            await sendMessage(senderId, buildErrorMessage(error));
        }
    }
}

function buildErrorMessage(error) {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        return `
⏱️ 𝗧𝗲𝗺𝗽𝘀 𝗱𝗲 𝗿𝗲́𝗽𝗼𝗻𝘀𝗲 𝗱𝗲́𝗽𝗮𝘀𝘀𝗲́
${DECORATIONS.divider}
Le serveur met trop de temps à répondre.

🔄 Réessaie dans quelques instants.
💡 Si ça persiste, essaie une question
   plus simple.`.trim();
    }
    return `
❌ 𝗘𝗿𝗿𝗲𝘂𝗿 𝗱𝗲 𝗰𝗼𝗻𝗻𝗲𝘃𝗶𝗼𝗻
${DECORATIONS.divider}
Impossible de contacter l'assistant.

💡 Causes possibles :
◆ Connexion instable
◆ Serveur temporairement indisponible

🔄 Réessaie dans quelques secondes.`.trim();
}

module.exports = async (senderId, prompt, api, attachmentOrEvent) => {
    try {
        const rawInput = (typeof prompt === 'string' ? prompt : '').trim();

        // handleMessage.js passe les images en 4ème param sous forme de tableau
        // ex: [{type:'image', payload:{url:'...'}}]
        let imageUrl = null;
        if (Array.isArray(attachmentOrEvent) && attachmentOrEvent.length > 0) {
            const imgAttach = attachmentOrEvent.find(a => a.type === 'image');
            if (imgAttach) imageUrl = imgAttach.payload.url;
        } else if (attachmentOrEvent && attachmentOrEvent.message && attachmentOrEvent.message.attachments) {
            const imgAttach = attachmentOrEvent.message.attachments.find(a => a.type === 'image');
            if (imgAttach) imageUrl = imgAttach.payload.url;
        }

        // Quand une image est envoyée, prompt vaut "IMAGE_ATTACHMENT" — on l'ignore
        const input = rawInput === 'IMAGE_ATTACHMENT' ? '' : rawInput;
        const lowerInput = input.toLowerCase();

        // ── CAS 1 : l'utilisateur vient d'envoyer une image (pas de texte) ──
        // On stocke l'URL et on demande sa question
        if (imageUrl && !input) {
            pendingImages[senderId] = imageUrl;
            await sendMessage(senderId, `
🖼️ 𝗜𝗺𝗮𝗴𝗲 𝗿𝗲𝗰̧𝘂𝗲 !
${DECORATIONS.divider}
✅ J'ai bien reçu votre image.

❓ Quelle question avez-vous à poser concernant cette image ?

💡 Exemples :
◆ Fais cet exercice
◆ Décris ce que tu vois
◆ Explique ce schéma
◆ Résous ce problème`.trim());
            return;
        }

        if (!input && !imageUrl) {
            await showWelcome(senderId);
            return;
        }

        // Commandes spéciales — on efface aussi l'image en attente
        if (lowerInput === 'stop' || lowerInput === 'quitter' || lowerInput === 'exit') {
            delete pendingImages[senderId];
            await handleStop(senderId);
            return;
        }

        if (lowerInput === 'historique' || lowerInput === 'history') {
            await showHistory(senderId, senderId);
            return;
        }

        if (lowerInput === 'reset' || lowerInput === 'effacer' || lowerInput === 'reinitialiser') {
            delete pendingImages[senderId];
            await handleReset(senderId, senderId);
            return;
        }

        if (lowerInput === 'aide' || lowerInput === 'help' || lowerInput === 'menu') {
            await showWelcome(senderId);
            return;
        }

        // ── Changement de modèle : "mode claude" / "mode edu" ──
        const modeMatch = lowerInput.match(/^mode\s+(claude|edu)$/);
        if (modeMatch) {
            await handleModeSwitch(senderId, modeMatch[1]);
            return;
        }

        // ── Préfixe de modèle explicite : "claude <question>" / "edu <question>" ──
        let forcedModel = null;
        let questionText = input;

        const claudePrefix = input.match(/^claude\s+(.+)/i);
        const eduPrefix = input.match(/^edu\s+(.+)/i);

        if (claudePrefix) {
            forcedModel = 'claude';
            questionText = claudePrefix[1].trim();
        } else if (eduPrefix) {
            forcedModel = 'edu';
            questionText = eduPrefix[1].trim();
        }

        // ── CAS 2 : l'utilisateur envoie du texte avec une image en attente ──
        // On récupère l'image stockée et on la joint à la question
        if (!imageUrl && pendingImages[senderId]) {
            imageUrl = pendingImages[senderId];
            delete pendingImages[senderId];
        }

        const finalQuestion = imageUrl && !questionText
            ? 'Analyse cette image et explique son contenu de façon détaillée.'
            : questionText;

        // ── Détermination du modèle final ──
        // Si une image est présente : toujours utiliser Claude (/api/claude supporte les images,
        // /api/edu échoue systématiquement avec image_url)
        // Sinon : respecter le choix de l'utilisateur ou le modèle par défaut (edu)
        let activeModel;
        if (imageUrl) {
            activeModel = 'claude';  // Claude gère les images correctement
        } else {
            activeModel = forcedModel || getUserModel(senderId);
        }

        if (activeModel === 'claude') {
            await handleClaudeQuestion(senderId, finalQuestion, imageUrl);
        } else {
            await handleQuestion(senderId, finalQuestion, imageUrl);
        }

    } catch (error) {
        console.error('Erreur commande dynamique:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗿𝗿𝗲𝘂𝗿 𝗶𝗻𝗮𝘁𝘁𝗲𝗻𝗱𝘂𝗲
${DECORATIONS.divider}
Une erreur est survenue.
🔄 Réessaie dans quelques instants.

💡 Tape "dynamique aide" pour le guide.`.trim());
    }
};
