const axios = require('axios');
const FormData = require('form-data');
const { Readable } = require('stream');
const sendMessage = require('../handles/sendMessage');

const API_BASE = 'https://pdf-zpbp.onrender.com';
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
    'malagasy': { emoji: '🇲🇬', name: 'Malagasy', aliases: ['mlg', 'gasy'] }
};

const SERIES = ['A', 'C', 'D', 'L', 'S', 'OSE'];
const DOC_TYPES = ['sujet', 'correction', 'enonce', 'corrige'];

const DECORATIONS = {
    header: '╔══════════════════════════════╗',
    footer: '╚══════════════════════════════╝',
    divider: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    subDivider: '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈'
};

function formatFileSize(bytes) {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

async function getFileSize(url) {
    try {
        const response = await axios.head(url, { timeout: 10000, maxRedirects: 5 });
        return parseInt(response.headers['content-length'] || '0');
    } catch { return 0; }
}

async function downloadToBuffer(url) {
    const response = await axios({
        method: 'GET', url, responseType: 'arraybuffer', timeout: 180000, maxRedirects: 5,
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
            filename, contentType: 'application/pdf'
        });
        await axios.post(
            `https://graph.facebook.com/v16.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
            form, { headers: form.getHeaders(), timeout: 180000 }
        );
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
}

function parseInput(input) {
    const parts = input.toLowerCase().split(/\s+/);
    const result = { matiere: null, serie: null, type: null, annee: null };
    
    for (const part of parts) {
        for (const [key, val] of Object.entries(MATIERES)) {
            if (part === key || val.aliases.includes(part)) { result.matiere = key; break; }
        }
        if (SERIES.includes(part.toUpperCase())) result.serie = part.toUpperCase();
        if (DOC_TYPES.includes(part)) result.type = (part === 'correction' || part === 'corrige') ? 'correction' : 'sujet';
        if (/^(19\d{2}|20\d{2})$/.test(part)) result.annee = part;
    }
    return result;
}

async function searchPdfs(params) {
    try {
        let url = `${API_BASE}/pdfs?`;
        if (params.matiere) url += `matiere=${params.matiere}&`;
        if (params.serie) url += `serie=${params.serie}&`;
        if (params.type) url += `type=${params.type}&`;
        if (params.annee) url += `annee=${params.annee}&`;
        
        console.log('API Search URL:', url);
        const response = await axios.get(url, { timeout: 30000 });
        return response.data.pdfs || [];
    } catch (error) {
        console.error('Search error:', error.message);
        return [];
    }
}

async function displayResults(senderId, pdfs, params) {
    const pagePdfs = pdfs.slice(0, RESULTS_PER_PAGE);
    userSessions.set(senderId, { results: pdfs, pageResults: pagePdfs });

    let msg = `📚 𝗕𝗔𝗖𝗖𝗔𝗟𝗔𝗨𝗥𝗘́𝗔𝗧 𝗠𝗔𝗗𝗔𝗚𝗔𝗦𝗖𝗔𝗥\n${DECORATIONS.header}\n`;
    msg += `📖 Matière: ${params.matiere || 'Toutes'}\n`;
    if (params.serie) msg += `🎓 Série: ${params.serie}\n`;
    if (params.annee) msg += `📅 Année: ${params.annee}\n`;
    msg += `${DECORATIONS.footer}\n\n`;

    pagePdfs.forEach((pdf, i) => {
        msg += `${i + 1}️⃣ 📄 ${pdf.titre}\n`;
    });

    msg += `\n${DECORATIONS.divider}\n📥 Envoyez le numéro (1-${pagePdfs.length}) pour télécharger.`;
    await sendMessage(senderId, msg);
}

module.exports = async (senderId, prompt) => {
    try {
        const input = prompt.trim().toLowerCase();
        const session = userSessions.get(senderId);

        if (/^\d+$/.test(input) && session?.pageResults) {
            const index = parseInt(input) - 1;
            if (index >= 0 && index < session.pageResults.length) {
                const doc = session.pageResults[index];
                await sendMessage(senderId, `⏳ Préparation de : ${doc.titre}...`);
                
                // Utilisation de l'endpoint /telecharger de l'API
                const downloadUrl = `${API_BASE}/telecharger?url=${encodeURIComponent(doc.url)}&titre=${encodeURIComponent(doc.titre)}`;
                
                try {
                    const fileSize = await getFileSize(doc.url);
                    if (fileSize > 0 && fileSize < MAX_FILE_SIZE) {
                        const { buffer } = await downloadToBuffer(doc.url);
                        const filename = `${doc.titre.replace(/[^a-z0-9]/gi, '_')}.pdf`;
                        const res = await sendPdfToMessenger(senderId, buffer, filename);
                        if (res.success) return;
                    }
                    await sendMessage(senderId, `🔗 Lien de téléchargement :\n${downloadUrl}`);
                } catch {
                    await sendMessage(senderId, `🔗 Lien de téléchargement :\n${downloadUrl}`);
                }
                return;
            }
        }

        const params = parseInput(input);
        if (!params.matiere && input !== 'bacc') {
            await sendMessage(senderId, "📖 *GUIDE PDF BACC*\nTapez 'pdf <matière> <série> <année>'.\nExemple: 'pdf physique A 2022'");
            return;
        }

        await sendMessage(senderId, "🔍 Recherche des sujets en cours...");
        const pdfs = await searchPdfs(params);

        if (pdfs.length === 0) {
            await sendMessage(senderId, "😔 Aucun document trouvé. Vérifiez l'orthographe ou essayez d'autres critères.");
            return;
        }

        await displayResults(senderId, pdfs, params);
    } catch (error) {
        await sendMessage(senderId, "❌ Une erreur est survenue.");
    }
};

module.exports.info = {
    name: "pdf",
    description: "Recherche de sujets de BACC (API Accesmad).",
    usage: "pdf <matiere> <serie> <annee>"
};