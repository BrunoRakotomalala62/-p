const axios = require('axios');
const FormData = require('form-data');
const { Readable } = require('stream');
const sendMessage = require('../handles/sendMessage');

const API_BASE = 'https://educmad-pdf-image.onrender.com';
const RESULTS_PER_PAGE = 8;
const MAX_MSG_LENGTH = 1900;

const userSessions = new Map();

const DECORATIONS = {
    top:     '╔══════════════════════════╗',
    bottom:  '╚══════════════════════════╝',
    line:    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    dotline: '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈',
};

const LOADING_MSGS = [
    '📡 Connexion à la base EDUCMAD...',
    '🔎 Fouille des archives pédagogiques...',
    '📂 Consultation des ressources BACC...',
    '⚡ Récupération des documents en cours...',
];

const TYPE_INFO = {
    'Énoncé':  { emoji: '📄', label: 'Énoncé' },
    'Corrigé': { emoji: '✅', label: 'Corrigé / Correction' },
    'default': { emoji: '📘', label: 'Document' },
};

function rand(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getTypeInfo(type) {
    if (!type) return TYPE_INFO.default;
    if (type.toLowerCase().includes('énoncé') || type.toLowerCase().includes('enonce') || type.toLowerCase().includes('sujet')) return TYPE_INFO['Énoncé'];
    if (type.toLowerCase().includes('corrigé') || type.toLowerCase().includes('correction') || type.toLowerCase().includes('correc')) return TYPE_INFO['Corrigé'];
    return TYPE_INFO.default;
}

function splitText(text, max = MAX_MSG_LENGTH) {
    if (text.length <= max) return [text];
    const parts = [];
    const lines = text.split('\n');
    let current = '';
    for (const line of lines) {
        if ((current + '\n' + line).length > max) {
            if (current) parts.push(current.trim());
            current = line;
        } else {
            current += (current ? '\n' : '') + line;
        }
    }
    if (current) parts.push(current.trim());
    return parts;
}

async function send(senderId, text) {
    const parts = splitText(text);
    for (let i = 0; i < parts.length; i++) {
        await sendMessage(senderId, parts[i]);
        if (i < parts.length - 1) await sleep(300);
    }
}

async function sendImage(senderId, imageUrl) {
    await sendMessage(senderId, {
        attachment: {
            type: 'image',
            payload: { url: imageUrl, is_reusable: true }
        }
    });
}

async function sendPdfByUrl(senderId, pdfUrl, filename) {
    const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
    if (!PAGE_ACCESS_TOKEN) throw new Error('PAGE_ACCESS_TOKEN manquant');

    const dlRes = await axios.get(pdfUrl, {
        responseType: 'arraybuffer',
        timeout: 120000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
    });

    const stream = Readable.from(Buffer.from(dlRes.data));
    const form = new FormData();
    form.append('recipient', JSON.stringify({ id: senderId }));
    form.append('message', JSON.stringify({
        attachment: { type: 'file', payload: { is_reusable: false } }
    }));
    form.append('filedata', stream, {
        filename: filename,
        contentType: 'application/pdf'
    });

    const res = await axios.post(
        `https://graph.facebook.com/v16.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
        form,
        {
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 180000
        }
    );
    return res.data;
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function formatResultCard(doc, position) {
    const t = getTypeInfo(doc.type);
    const annee = doc.annee ? `📅 ${doc.annee}` : '📅 Année: N/A';
    const titre = doc.titre || 'Document sans titre';
    const num = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'][position - 1] || `${position}.`;

    return [
        `┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `┃ ${num} ${t.emoji}  ${t.label}`,
        `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `┃ 📝 ${titre}`,
        `┃ ${annee}`,
        `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ].join('\n');
}

async function showHelp(senderId) {
    await send(senderId, [
        `🎓 𝗘𝗗𝗨𝗖𝗠𝗔𝗗 — 𝗕𝗔𝗦𝗘 𝗗𝗢𝗖𝗨𝗠𝗘𝗡𝗧𝗔𝗜𝗥𝗘 𝗕𝗔𝗖𝗖`,
        DECORATIONS.top,
        `   Accède aux sujets & corrigés officiels`,
        `   du Baccalauréat Madagascar`,
        DECORATIONS.bottom,
    ].join('\n'));

    await sleep(300);

    await send(senderId, [
        `📚 𝗠𝗔𝗧𝗜𝗘̀𝗥𝗘𝗦 𝗗𝗜𝗦𝗣𝗢𝗡𝗜𝗕𝗟𝗘𝗦`,
        DECORATIONS.line,
        `⚛️  PC / Physique / SPC`,
        `🔢  Maths`,
        `🧬  SVT`,
        `🌍  HG / Histoire-Géo`,
        `📖  Français`,
        `🧠  Philosophie / Philo`,
        `🇲🇬  Malagasy`,
        `🇬🇧  Anglais`,
        ``,
        `🎓 𝗦𝗘́𝗥𝗜𝗘𝗦 : A · C · D · L · OSE`,
    ].join('\n'));

    await sleep(300);

    await send(senderId, [
        `✨ 𝗘𝗫𝗘𝗠𝗣𝗟𝗘𝗦 𝗗'𝗨𝗧𝗜𝗟𝗜𝗦𝗔𝗧𝗜𝗢𝗡`,
        DECORATIONS.line,
        `📌 educmad physique A`,
        `   ➜ Tous les docs de Physique série A`,
        ``,
        `📌 educmad maths C 2019`,
        `   ➜ Maths série C, année 2019`,
        ``,
        `📌 educmad SVT D`,
        `   ➜ SVT série D`,
        ``,
        `📌 educmad HG`,
        `   ➜ Tous les docs Histoire-Géo`,
        ``,
        `📌 educmad français A 2021`,
        `   ➜ Français série A 2021`,
        ``,
        DECORATIONS.dotline,
        `📥 Envoie le numéro du document pour`,
        `   recevoir le PDF + aperçu page par page`,
        `🔄 "suivant" / "precedent" pour naviguer`,
    ].join('\n'));
}

async function handleSearch(senderId, query) {
    await send(senderId, [
        `⏳ 𝗥𝗘𝗖𝗛𝗘𝗥𝗖𝗛𝗘 𝗘𝗡 𝗖𝗢𝗨𝗥𝗦`,
        DECORATIONS.line,
        rand(LOADING_MSGS),
        `🔍 Requête : « ${query} »`,
    ].join('\n'));

    try {
        const res = await axios.get(`${API_BASE}/api/recherche`, {
            params: { pdf: query },
            timeout: 30000
        });

        const data = res.data;
        if (!data.success || !data.cours || data.cours.length === 0) {
            return await send(senderId, [
                `😔 𝗔𝗨𝗖𝗨𝗡 𝗥𝗘́𝗦𝗨𝗟𝗧𝗔𝗧 𝗧𝗥𝗢𝗨𝗩𝗘́`,
                DECORATIONS.line,
                `Aucun document pour : « ${query} »`,
                ``,
                `💡 Conseils :`,
                `◆ Vérifie l'orthographe`,
                `◆ Essaie avec moins de mots`,
                `◆ Ex: "physique A" ou "maths 2020"`,
                ``,
                `📖 Tape "educmad aide" pour le guide.`,
            ].join('\n'));
        }

        const allDocs = [];
        for (const cours of data.cours) {
            for (const doc of cours.documents) {
                allDocs.push(doc);
            }
        }

        userSessions.set(senderId, {
            results: allDocs,
            page: 1,
            query: query
        });

        await displayResults(senderId, allDocs, 1, query);

    } catch (err) {
        console.error('[educmad] Erreur recherche:', err.message);
        await send(senderId, [
            `❌ 𝗘𝗿𝗿𝗲𝘂𝗿 𝗱𝗲 𝗰𝗼𝗻𝗻𝗲𝘅𝗶𝗼𝗻`,
            DECORATIONS.line,
            `Impossible de joindre la base EDUCMAD.`,
            `Réessaie dans quelques instants. ⏱️`,
        ].join('\n'));
    }
}

async function displayResults(senderId, docs, page, query) {
    const totalPages = Math.ceil(docs.length / RESULTS_PER_PAGE);
    const start = (page - 1) * RESULTS_PER_PAGE;
    const pageDocs = docs.slice(start, start + RESULTS_PER_PAGE);

    userSessions.set(senderId, {
        ...userSessions.get(senderId),
        page,
        pageDocs
    });

    const header = [
        `📚 𝗥𝗘́𝗦𝗨𝗟𝗧𝗔𝗧𝗦 𝗘𝗗𝗨𝗖𝗠𝗔𝗗`,
        DECORATIONS.top,
        `🔍 Recherche : « ${query} »`,
        `📊 ${docs.length} document(s) trouvé(s)`,
        `📄 Page ${page} / ${totalPages}`,
        `🎯 Résultats ${start + 1}–${start + pageDocs.length}`,
        DECORATIONS.bottom,
    ].join('\n');

    await send(senderId, header);
    await sleep(300);

    for (let i = 0; i < pageDocs.length; i++) {
        await send(senderId, formatResultCard(pageDocs[i], i + 1));
        await sleep(200);
    }

    const navLines = [
        DECORATIONS.line,
        `📥 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗥 𝗨𝗡 𝗗𝗢𝗖𝗨𝗠𝗘𝗡𝗧`,
        `➤ Envoie le numéro (1–${pageDocs.length})`,
        `  pour recevoir le PDF + les pages en images`,
    ];

    if (totalPages > 1) {
        navLines.push('');
        navLines.push(`🧭 𝗡𝗔𝗩𝗜𝗚𝗔𝗧𝗜𝗢𝗡`);
        if (page > 1) navLines.push(`◀️ "precedent" → Page ${page - 1}`);
        if (page < totalPages) navLines.push(`▶️ "suivant" → Page ${page + 1}`);
        navLines.push(`📍 "page X" → Aller à la page X`);
    }

    navLines.push(DECORATIONS.dotline);
    navLines.push(`🔄 Nouvelle recherche : educmad <matière>`);

    await send(senderId, navLines.join('\n'));
}

async function handleDownload(senderId, doc) {
    const t = getTypeInfo(doc.type);
    const annee = doc.annee ? `${doc.annee}` : 'N/A';

    await send(senderId, [
        `⚡ 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 𝗘𝗡 𝗖𝗢𝗨𝗥𝗦`,
        DECORATIONS.line,
        `${t.emoji} ${t.label}`,
        `📝 ${doc.titre}`,
        `📅 Année : ${annee}`,
        ``,
        `⏳ Préparation du fichier PDF...`,
    ].join('\n'));

    try {
        const dlRes = await axios.get(`${API_BASE}/api/download`, {
            params: { pdf: doc.index },
            timeout: 60000
        });

        const dlData = dlRes.data;
        if (!dlData.success) {
            throw new Error('Réponse API invalide');
        }

        const pdfUrl = dlData.telechargement?.url_directe;
        const apercu = dlData.apercu;
        const titre = dlData.document?.titre || doc.titre || 'document';
        const taille = dlData.document?.taille || '';
        const filename = titre.replace(/[^a-zA-Z0-9À-ÿ _-]/g, '').trim().replace(/\s+/g, '_') + '.pdf';

        let pdfSent = false;

        if (pdfUrl) {
            try {
                await sendPdfByUrl(senderId, pdfUrl, filename);
                pdfSent = true;
            } catch (pdfErr) {
                console.error('[educmad] Erreur envoi PDF upload:', pdfErr.message);
                try {
                    await sendMessage(senderId, {
                        attachment: {
                            type: 'file',
                            payload: { url: pdfUrl, is_reusable: true }
                        }
                    });
                    pdfSent = true;
                } catch (fallbackErr) {
                    console.error('[educmad] Fallback URL échoué:', fallbackErr.message);
                }
            }
        }

        if (pdfSent) {
            await send(senderId, [
                `✅ 𝗣𝗗𝗙 𝗘𝗡𝗩𝗢𝗬𝗘́ 𝗔𝗩𝗘𝗖 𝗦𝗨𝗖𝗖𝗘̀𝗦`,
                DECORATIONS.top,
                `${t.emoji} ${t.label}`,
                `📝 ${titre}`,
                `📅 Année : ${annee}`,
                taille ? `📦 Taille : ${taille}` : '',
                DECORATIONS.bottom,
                ``,
                `📱 Sauvegarde le PDF sur ton appareil !`,
            ].filter(l => l !== '').join('\n'));
        } else {
            await send(senderId, [
                `⚠️ Envoi PDF impossible`,
                `Lien direct : ${pdfUrl || 'non disponible'}`,
            ].join('\n'));
        }

        if (apercu && apercu.pages && apercu.pages.length > 0) {
            await sleep(500);

            const totalPages = apercu.total_pages || apercu.pages.length;

            await send(senderId, [
                `🖼️ 𝗔𝗣𝗘𝗥𝗖̧𝗨 𝗗𝗘𝗦 𝗣𝗔𝗚𝗘𝗦`,
                DECORATIONS.line,
                `📄 Ce document contient ${totalPages} page(s)`,
                `📸 Envoi de chaque page en image...`,
            ].join('\n'));

            await sleep(400);

            for (let i = 0; i < apercu.pages.length; i++) {
                const relPath = apercu.pages[i];
                const imgUrl = relPath.startsWith('http') ? relPath : `${API_BASE}${relPath}`;

                try {
                    await sendImage(senderId, imgUrl);
                    await sleep(300);

                    if ((i + 1) % 5 === 0 && (i + 1) < apercu.pages.length) {
                        await send(senderId, `📄 Pages ${i + 1}/${totalPages} envoyées...`);
                        await sleep(300);
                    }
                } catch (imgErr) {
                    console.error(`[educmad] Erreur image page ${i + 1}:`, imgErr.message);
                    await send(senderId, `⚠️ Page ${i + 1} non disponible.`);
                }
            }

            await sleep(300);
            await send(senderId, [
                `✅ 𝗧𝗘𝗥𝗠𝗜𝗡𝗘́`,
                DECORATIONS.dotline,
                `Toutes les ${totalPages} page(s) ont été envoyées.`,
                ``,
                `🔄 Nouvelle recherche : educmad <matière>`,
                `📖 Guide : educmad aide`,
            ].join('\n'));
        } else {
            await send(senderId, [
                DECORATIONS.dotline,
                `ℹ️ Aucun aperçu image disponible pour ce document.`,
                `🔄 Nouvelle recherche : educmad <matière>`,
            ].join('\n'));
        }

    } catch (err) {
        console.error('[educmad] Erreur téléchargement:', err.message);
        await send(senderId, [
            `❌ 𝗘𝗿𝗿𝗲𝘂𝗿 𝗱𝗲 𝘁𝗲́𝗹𝗲́𝗰𝗵𝗮𝗿𝗴𝗲𝗺𝗲𝗻𝘁`,
            DECORATIONS.line,
            `Impossible de récupérer ce document.`,
            `Réessaie dans quelques instants. ⏱️`,
            ``,
            `🔄 educmad aide — pour relancer`,
        ].join('\n'));
    }
}

module.exports = async (senderId, prompt, api) => {
    try {
        const input = (typeof prompt === 'string' ? prompt : '').trim();
        const lower = input.toLowerCase();
        const session = userSessions.get(senderId) || {};

        if (!input || lower === 'aide' || lower === 'help') {
            return await showHelp(senderId);
        }

        if (/^\d+$/.test(input)) {
            const idx = parseInt(input) - 1;
            const pageDocs = session.pageDocs || [];

            if (!session.results || session.results.length === 0) {
                return await send(senderId, [
                    `⚠️ Aucune recherche active.`,
                    `Commence par taper : educmad <matière>`,
                    `Ex: educmad physique A`,
                ].join('\n'));
            }

            if (idx < 0 || idx >= pageDocs.length) {
                return await send(senderId, [
                    `❌ Numéro invalide.`,
                    `Choisis entre 1 et ${pageDocs.length}.`,
                ].join('\n'));
            }

            return await handleDownload(senderId, pageDocs[idx]);
        }

        if (lower === 'suivant' || lower === 'next') {
            if (session.results && session.results.length > 0) {
                const totalPages = Math.ceil(session.results.length / RESULTS_PER_PAGE);
                const newPage = Math.min((session.page || 1) + 1, totalPages);
                return await displayResults(senderId, session.results, newPage, session.query);
            }
            return await send(senderId, `⚠️ Aucune recherche active. Tape "educmad <matière>"`);
        }

        if (lower === 'precedent' || lower === 'prev') {
            if (session.results && session.results.length > 0) {
                const newPage = Math.max((session.page || 1) - 1, 1);
                return await displayResults(senderId, session.results, newPage, session.query);
            }
            return await send(senderId, `⚠️ Aucune recherche active. Tape "educmad <matière>"`);
        }

        const pageMatch = lower.match(/^page\s+(\d+)$/);
        if (pageMatch) {
            const p = parseInt(pageMatch[1]);
            if (session.results && session.results.length > 0) {
                const totalPages = Math.ceil(session.results.length / RESULTS_PER_PAGE);
                if (p >= 1 && p <= totalPages) {
                    return await displayResults(senderId, session.results, p, session.query);
                }
            }
            return;
        }

        await handleSearch(senderId, input);

    } catch (err) {
        console.error('[educmad] Erreur générale:', err.message);
        await sendMessage(senderId, [
            `❌ Une erreur inattendue s'est produite.`,
            `Réessaie ou tape : educmad aide`,
        ].join('\n'));
    }
};
