const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sendMessage = require('../handles/sendMessage');

// Stockage temporaire des images en attente de question (par utilisateur)
const pendingImages = {};

// Stockage du modèle préféré par utilisateur ('edu' | 'claude')
const userModels = {};

const API_BASE = 'https://claude-46-replit--lalaofano.replit.app/api';
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

        const explanation = data.explanation || '';
        const hasFigure = data.has_figure || false;
        const turnCount = data.turn_count || 1;
        const figureSvgB64 = data.figure_svg_b64 || null;

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

        if (hasFigure && figureSvgB64) {
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

        if (responseText) {
            await sendSplit(senderId, responseText);
        } else {
            await sendMessage(senderId, `⚠️ Aucune réponse reçue de Claude.`);
        }

        // Afficher les figures si l'API en retourne
        const figures = data.figures || [];
        for (const fig of figures) {
            if (fig.svg_b64 || fig.svg) {
                await delay(400);
                await sendMessage(senderId, `📊 Envoi de la figure...`);
                const b64 = fig.svg_b64 || Buffer.from(fig.svg).toString('base64');
                await sendFigureAsImage(senderId, b64);
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
