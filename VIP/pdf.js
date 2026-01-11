const axios = require('axios');
const FormData = require('form-data');
const { Readable } = require('stream');
const fs = require('fs');
const path = require('path');
const sendMessage = require('../handles/sendMessage');

const API_BASE = 'https://pdf-zpbp.onrender.com';
const LOCAL_PDF_DIR = path.join(__dirname, '..', 'pdf_exercice_bacc');
const RESULTS_PER_PAGE = 10;
const MAX_FILE_SIZE = 25 * 1024 * 1024;

const userSessions = new Map();

const MATIERES = {
    'mathematiques': { emoji: '🔢', name: 'Mathématiques', aliases: ['math', 'maths'] },
    'physique': { emoji: '⚛️', name: 'Physique', aliases: ['phy', 'pc', 'spc'] },
    'chimie': { emoji: '🧪', name: 'Chimie', aliases: ['chimie'] },
    'svt': { emoji: '🧬', name: 'SVT', aliases: ['bio', 'biologie'] },
    'philosophie': { emoji: '🧠', name: 'Philosophie', aliases: ['philo'] },
    'francais': { emoji: '📚', name: 'Français', aliases: ['fr', 'french'] },
    'anglais': { emoji: '🇬🇧', name: 'Anglais', aliases: ['ang', 'english', 'eng'] },
    'histoire-geo': { emoji: '🌍', name: 'Histoire-Géo', aliases: ['histoire', 'geo', 'geographie', 'hg'] },
    'malagasy': { emoji: '🇲🇬', name: 'Malagasy', aliases: ['mlg', 'gasy'] },
    'economie': { emoji: '💰', name: 'Économie', aliases: ['eco', 'economique'] }
};

const SERIES = ['A', 'C', 'D', 'L', 'S', 'OSE'];
const DOC_TYPES = ['sujet', 'correction', 'enonce', 'corrige'];

const DECORATIONS = {
    header: '╔══════════════════════════════╗',
    footer: '╚══════════════════════════════╝',
    divider: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    subDivider: '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈',
    bullet: '◆',
    arrow: '➤'
};

const LOADING_MESSAGES = [
    "Recherche en cours dans la base de données...",
    "Je fouille les bibliothèques numériques...",
    "Consultation des archives PDF...",
    "Récupération des documents..."
];

const SEARCH_MESSAGES = [
    "Voici les documents que j'ai trouvés pour toi",
    "Résultats de ta recherche ci-dessous",
    "J'ai déniché ces ressources pour toi",
    "Documents disponibles"
];

function getRandomMessage(messages) {
    return messages[Math.floor(Math.random() * messages.length)];
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

async function getFileSize(url) {
    try {
        const response = await axios.head(url, { timeout: 10000, maxRedirects: 5 });
        return parseInt(response.headers['content-length'] || '0');
    } catch (error) { return 0; }
}

async function downloadToBuffer(url) {
    const response = await axios({
        method: 'GET', url: url, responseType: 'arraybuffer', timeout: 180000, maxRedirects: 5,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const buffer = Buffer.from(response.data);
    return { buffer, size: buffer.length };
}

async function sendPdfToMessenger(recipientId, buffer, filename) {
    try {
        const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
        const form = new FormData();
        form.append('recipient', JSON.stringify({ id: recipientId }));
        form.append('message', JSON.stringify({
            attachment: { type: 'file', payload: { is_reusable: false } }
        }));
        form.append('filedata', Readable.from(buffer), {
            filename: filename, contentType: 'application/pdf'
        });
        const response = await axios.post(
            `https://graph.facebook.com/v16.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
            form, { headers: form.getHeaders(), timeout: 180000 }
        );
        return { success: true, data: response.data };
    } catch (error) { return { success: false, error: error.message }; }
}

function parseSearchQuery(query) {
    const parts = query.toLowerCase().split(/\s+/);
    const filteredParts = parts.filter(p => !['pdf', 'livre', 'book', 'ebook'].includes(p));
    return filteredParts.join(' ');
}

async function searchPdfs(query, page = 1) {
    try {
        const url = `${API_BASE}/recherche?pdf=${encodeURIComponent(query)}&page=${page}`;
        console.log('API PDF URL:', url);
        const response = await axios.get(url, { timeout: 30000 });
        const results = response.data.resultats || response.data.livres || response.data.sujets || [];
        return { results, total: results.length };
    } catch (error) {
        console.error('Erreur recherche PDF:', error.message);
        throw error;
    }
}

async function displayResults(senderId, results, page, query) {
    const totalPages = Math.ceil(results.length / RESULTS_PER_PAGE);
    const startIdx = (page - 1) * RESULTS_PER_PAGE;
    const pageResults = results.slice(startIdx, startIdx + RESULTS_PER_PAGE);

    userSessions.set(senderId, { results, currentPage: page, pageResults, searchQuery: query });

    const header = `📚 𝗥𝗘́𝗦𝗨𝗟𝗧𝗔𝗧𝗦 𝗣𝗗𝗙\n${DECORATIONS.header}\n🔍 Recherche: "${query}"\n📄 Page ${page}/${totalPages}\n${DECORATIONS.footer}`;
    await sendMessage(senderId, header);

    for (let i = 0; i < pageResults.length; i++) {
        const doc = pageResults[i];
        const card = `┏━━━━━━━━━━━━━━━━━━━━━\n┃ ${i + 1}️⃣ 📖 𝗟𝗜𝗩𝗥𝗘\n┣━━━━━━━━━━━━━━━━━━━━━\n┃ 📝 ${doc.titre || 'Sans titre'}\n┗━━━━━━━━━━━━━━━━━━━━━`;
        await sendMessage(senderId, card);
    }

    const footer = `${DECORATIONS.divider}\n📥 Envoyez le numéro (1-${pageResults.length}) pour télécharger.\n🔄 Nouvelle recherche: pdf <terme>`;
    await sendMessage(senderId, footer);
}

async function handleDownload(senderId, doc) {
    const pdfUrl = doc.url_telechargement || doc.lien_pdf || doc.url_pdf;
    if (!pdfUrl) {
        await sendMessage(senderId, "❌ Lien de téléchargement non disponible.");
        return;
    }

    await sendMessage(senderId, `⏳ Préparation du PDF : ${doc.titre}...`);
    try {
        const fileSize = await getFileSize(pdfUrl);
        if (fileSize > 0 && fileSize < MAX_FILE_SIZE) {
            const { buffer } = await downloadToBuffer(pdfUrl);
            const filename = `${(doc.titre || 'document').replace(/[^a-z0-9]/gi, '_')}.pdf`;
            const result = await sendPdfToMessenger(senderId, buffer, filename);
            if (result.success) return;
        }
        await sendMessage(senderId, `🔗 Fichier volumineux ou envoi direct impossible. Téléchargez ici :\n${pdfUrl}`);
    } catch (error) {
        await sendMessage(senderId, `🔗 Erreur d'envoi direct. Téléchargez ici :\n${pdfUrl}`);
    }
}

module.exports = async (senderId, prompt) => {
    try {
        const input = prompt.trim();
        const session = userSessions.get(senderId);

        if (/^\d+$/.test(input) && session && session.pageResults) {
            const index = parseInt(input) - 1;
            if (index >= 0 && index < session.pageResults.length) {
                await handleDownload(senderId, session.pageResults[index]);
                return;
            }
        }

        const query = parseSearchQuery(input);
        if (!query || query === 'aide') {
            await sendMessage(senderId, "📖 *GUIDE PDF*\nTapez 'pdf <recherche>' pour trouver des documents.\nExemple: 'pdf mathématiques'");
            return;
        }

        await sendMessage(senderId, `🔎 ${getRandomMessage(LOADING_MESSAGES)}\n🔍 "${query}"`);
        const { results } = await searchPdfs(query);

        if (results.length === 0) {
            await sendMessage(senderId, `😔 Aucun PDF trouvé pour "${query}". Essayez un mot-clé plus simple (ex: "physique" au lieu de "sujet physique A").`);
            return;
        }

        await displayResults(senderId, results, 1, query);
    } catch (error) {
        await sendMessage(senderId, "❌ Une erreur est survenue lors du traitement.");
    }
};

module.exports.info = {
    name: "pdf",
    description: "Recherche et téléchargement de PDF.",
    usage: "pdf <votre recherche>"
};