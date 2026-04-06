const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sendMessage = require('../handles/sendMessage');

const API_BASE = 'https://claude-46-replit--maevasoasarobid.replit.app/api';
const MAX_MESSAGE_LENGTH = 1900;

const DECORATIONS = {
    top:       '╔══════════════════════════════╗',
    mid:       '╠══════════════════════════════╣',
    bot:       '╚══════════════════════════════╝',
    divider:   '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    dotted:    '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈',
    stars:     '✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦',
    sparkles:  '✨ ✨ ✨ ✨ ✨ ✨ ✨ ✨ ✨ ✨ ✨'
};

const EMOJIS = {
    brain:    ['🧠', '💡', '🔮', '⚡', '🌟', '✨', '🎯', '🚀'],
    science:  ['🔬', '⚛️', '🧪', '📐', '📏', '🧮', '📊', '📈'],
    loading:  ['⏳', '🔄', '⚙️', '💫', '🌀', '🕐', '🕑', '🕒'],
    success:  ['✅', '🎉', '🏆', '💯', '👑', '🌈', '🎊', '⭐'],
    error:    ['❌', '⚠️', '🚫', '💔', '😔'],
    book:     ['📚', '📖', '📝', '📋', '📌', '🗒️', '✏️', '🖊️']
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

const WELCOME_MESSAGES = [
    'Je suis prêt à t\'aider !',
    'Pose-moi ta question !',
    'En quoi puis-je t\'aider aujourd\'hui ?',
    'Je suis là pour t\'accompagner !'
];

const FIGURE_MESSAGES = [
    '📊 Une figure illustrative a été générée pour cette réponse.',
    '📐 Un schéma accompagne cette explication.',
    '🖼️ Une représentation visuelle est disponible pour cette question.',
    '📈 Une figure a été créée pour mieux illustrer ce concept.'
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
        if (i < parts.length - 1) {
            await delay(350);
        }
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function callEduApi(prompt, uid, imageUrl = null) {
    const params = new URLSearchParams({ prompt, uid });
    if (imageUrl) params.append('image_url', imageUrl);
    const url = `${API_BASE}/edu?${params.toString()}`;
    const response = await axios.get(url, { timeout: 60000 });
    return response.data;
}

async function getHistory(uid) {
    const url = `${API_BASE}/edu/history?uid=${encodeURIComponent(uid)}`;
    const response = await axios.get(url, { timeout: 15000 });
    return response.data;
}

async function deleteHistory(uid) {
    const url = `${API_BASE}/edu/history?uid=${encodeURIComponent(uid)}`;
    const response = await axios.delete(url, { timeout: 15000 });
    return response.data;
}

async function showWelcome(senderId) {
    const welcome = `
${DECORATIONS.top}
║  🎓 𝗔𝗦𝗦𝗜𝗦𝗧𝗔𝗡𝗧 𝗗𝗬𝗡𝗔𝗠𝗜𝗤𝗨𝗘  🎓
║  ✨ Science • Maths • Physique ✨
${DECORATIONS.bot}

${getRandom(EMOJIS.brain)} 𝗖𝗮𝗽𝗮𝗯𝗶𝗹𝗶𝘁𝗲́𝘀 :
${DECORATIONS.divider}
📐 Résolution d'exercices de maths
⚛️ Explication de physique & chimie
📊 Analyse de graphiques & figures
🖼️ Analyse d'images de sujets (envoie une image !)
🔢 Arithmétique & algèbre avancée
📈 Statistiques & probabilités

${DECORATIONS.dotted}
🎯 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝗲𝘀 𝗱𝗶𝘀𝗽𝗼𝗻𝗶𝗯𝗹𝗲𝘀 :
${DECORATIONS.divider}
💬 dynamique <question>  → Poser une question
🖼️ [Image + texte]       → Analyser une image
📜 dynamique historique  → Voir l'historique
🗑️ dynamique reset       → Effacer l'historique
⛔ dynamique stop        → Terminer la session

${DECORATIONS.stars}
💡 ${getRandom(WELCOME_MESSAGES)}`.trim();

    await sendMessage(senderId, welcome);
}

async function showHistory(senderId, uid) {
    try {
        await sendMessage(senderId, `
📜 𝗥𝗲́𝗰𝘂𝗽𝗲́𝗿𝗮𝘁𝗶𝗼𝗻 𝗱𝗲 𝗹'𝗵𝗶𝘀𝘁𝗼𝗿𝗶𝗾𝘂𝗲...
${DECORATIONS.divider}
⏳ Connexion au serveur en cours...`.trim());

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
║ 👤 Utilisateur : ${uid.substring(0, 10)}...
║ 💬 Tours de conversation : ${turnCount}
║ 📅 Créé le : ${data.created_at ? new Date(data.created_at).toLocaleString('fr-FR') : 'N/A'}
${DECORATIONS.bot}`.trim();

        await sendMessage(senderId, header);
        await delay(300);

        const recentMessages = messages.slice(-6);
        for (let i = 0; i < recentMessages.length; i++) {
            const msg = recentMessages[i];
            const role = msg.role === 'user' ? '👤 Toi' : '🤖 Assistant';
            const content = msg.content || msg.text || '(vide)';
            const preview = content.length > 300 ? content.substring(0, 300) + '...' : content;

            const card = `
${DECORATIONS.dotted}
${role} :
${preview}`.trim();

            await sendSplit(senderId, card);
            await delay(250);
        }

        if (messages.length > 6) {
            await sendMessage(senderId, `
${DECORATIONS.divider}
📊 ${messages.length - 6} message(s) plus anciens non affichés.
💡 Tape "dynamique reset" pour effacer l'historique.`.trim());
        } else {
            await sendMessage(senderId, `
${DECORATIONS.divider}
✅ Fin de l'historique (${messages.length} message(s))
🔄 Continue ou tape "dynamique reset" pour effacer.`.trim());
        }

    } catch (error) {
        console.error('Erreur getHistory dynamique:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗿𝗿𝗲𝘂𝗿 𝗵𝗶𝘀𝘁𝗼𝗿𝗶𝗾𝘂𝗲
${DECORATIONS.divider}
Impossible de récupérer l'historique.
🔄 Réessaie dans quelques instants.`.trim());
    }
}

async function handleReset(senderId, uid) {
    try {
        await sendMessage(senderId, `
🗑️ 𝗦𝘂𝗽𝗽𝗿𝗲𝘀𝘀𝗶𝗼𝗻 𝗲𝗻 𝗰𝗼𝘂𝗿𝘀...
${DECORATIONS.divider}
⏳ Effacement de l'historique...`.trim());

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
            await sendMessage(senderId, `
⚠️ Aucun historique à supprimer.
💡 Commence une nouvelle conversation !`.trim());
        }
    } catch (error) {
        console.error('Erreur reset dynamique:', error.message);
        await sendMessage(senderId, `
❌ Erreur lors de la suppression.
🔄 Réessaie dans quelques instants.`.trim());
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

async function handleQuestion(senderId, question, imageUrl = null) {
    const loadingMsg = getRandom(LOADING_MESSAGES);

    const loadingBubble = imageUrl
        ? `🖼️ 𝗔𝗻𝗮𝗹𝘆𝘀𝗲 𝗱'𝗶𝗺𝗮𝗴𝗲 𝗲𝗻 𝗰𝗼𝘂𝗿𝘀...
${DECORATIONS.divider}
🔬 Examen visuel de l'image...
📝 "${question.substring(0, 80)}${question.length > 80 ? '...' : ''}"`.trim()
        : `${loadingMsg}
${DECORATIONS.divider}
📝 "${question.substring(0, 80)}${question.length > 80 ? '...' : ''}"`.trim();

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
            try {
                const svgContent = Buffer.from(figureSvgB64, 'base64').toString('utf8');
                const fileName = `figure_${senderId}_${Date.now()}.svg`;
                const tmpPath = path.join('/tmp', fileName);
                fs.writeFileSync(tmpPath, svgContent);

                const baseUrl = process.env.REPLIT_DEV_DOMAIN
                    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
                    : process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 5000}`;
                const figureUrl = `${baseUrl}/temp/${fileName}`;

                await sendMessage(senderId, `
${DECORATIONS.dotted}
${getRandom(FIGURE_MESSAGES)}
${DECORATIONS.divider}
🔗 Figure disponible ici :
${figureUrl}

💡 Ouvre ce lien dans ton navigateur
   pour voir la figure interactive.`.trim());

                setTimeout(() => {
                    try {
                        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
                    } catch (e) {
                        console.error('Erreur suppression figure:', e.message);
                    }
                }, 300000);

            } catch (figErr) {
                console.error('Erreur figure SVG:', figErr.message);
                await sendMessage(senderId, `
${DECORATIONS.dotted}
📊 Une figure illustrative accompagne cette réponse.
(Non disponible pour affichage direct)`.trim());
            }
        }

        await delay(300);
        const footer = `
${DECORATIONS.stars}
💬 Tour ${turnCount} terminé
${DECORATIONS.dotted}
📝 Pose une autre question ou tape :
⛔ "stop" → Terminer | 📜 "historique" → Voir l'historique
🗑️ "reset" → Effacer | ❓ "aide" → Guide`.trim();

        await sendMessage(senderId, footer);

    } catch (error) {
        console.error('Erreur API dynamique:', error.message);

        let errMsg = `
❌ 𝗘𝗿𝗿𝗲𝘂𝗿 𝗱𝗲 𝗰𝗼𝗻𝗻𝗲𝘅𝗶𝗼𝗻
${DECORATIONS.divider}
Impossible de contacter l'assistant.

💡 Causes possibles :
◆ Connexion instable
◆ Serveur temporairement indisponible
◆ Question trop longue

🔄 Réessaie dans quelques secondes.`.trim();

        if (error.code === 'ECONNABORTED') {
            errMsg = `
⏱️ 𝗧𝗲𝗺𝗽𝘀 𝗱𝗲 𝗿𝗲́𝗽𝗼𝗻𝘀𝗲 𝗱𝗲́𝗽𝗮𝘀𝘀𝗲́
${DECORATIONS.divider}
L'assistant prend plus de temps que prévu.

💡 Essaie avec une question plus courte
   ou réessaie dans un instant.`.trim();
        }

        await sendMessage(senderId, errMsg);
    }
}

module.exports = async (senderId, prompt, api, event) => {
    try {
        const input = (typeof prompt === 'string' ? prompt : '').trim();
        const lowerInput = input.toLowerCase();

        const imageAttachment = event && event.message && event.message.attachments
            ? event.message.attachments.find(a => a.type === 'image')
            : null;
        const imageUrl = imageAttachment ? imageAttachment.payload.url : null;

        if (!input && !imageUrl) {
            await showWelcome(senderId);
            return;
        }

        if (lowerInput === 'stop' || lowerInput === 'quitter' || lowerInput === 'exit') {
            await handleStop(senderId);
            return;
        }

        if (lowerInput === 'historique' || lowerInput === 'history') {
            await showHistory(senderId, senderId);
            return;
        }

        if (lowerInput === 'reset' || lowerInput === 'effacer' || lowerInput === 'reinitialiser') {
            await handleReset(senderId, senderId);
            return;
        }

        if (lowerInput === 'aide' || lowerInput === 'help' || lowerInput === 'menu') {
            await showWelcome(senderId);
            return;
        }

        const questionText = imageUrl && !input
            ? 'Analyse cette image et explique son contenu de façon détaillée.'
            : input;

        await handleQuestion(senderId, questionText, imageUrl);

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
