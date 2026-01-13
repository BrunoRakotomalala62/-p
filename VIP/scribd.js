const axios = require('axios');
const FormData = require('form-data');
const { Readable } = require('stream');
const sendMessage = require('../handles/sendMessage');

const API_BASE = 'https://download-scribd-2ivt.onrender.com';
const RESULTS_PER_PAGE = 10;

const userSessions = new Map();

async function downloadToBuffer(url) {
    const response = await axios({
        method: 'GET',
        url,
        responseType: 'arraybuffer',
        timeout: 180000,
        maxRedirects: 5,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    return { buffer: Buffer.from(response.data) };
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
            filename,
            contentType: 'application/pdf'
        });
        await axios.post(
            `https://graph.facebook.com/v16.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
            form,
            { headers: form.getHeaders(), timeout: 180000 }
        );
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function searchScribd(query, page = 1) {
    try {
        const url = `${API_BASE}/recherche?scribd=${encodeURIComponent(query)}&page=${page}`;
        const response = await axios.get(url, { timeout: 300000 });
        const results = response.data || {};
        
        // L'API renvoie un objet avec les clés "1", "2", etc.
        const formattedResults = Object.entries(results)
            .filter(([key]) => !isNaN(key))
            .map(([key, value]) => ({
                id: key,
                titre: value
            }))
            .sort((a, b) => parseInt(a.id) - parseInt(b.id));
            
        return formattedResults;
    } catch (e) {
        console.error('Scribd search error:', e.message);
        return [];
    }
}

async function displayResults(senderId, results, query, page = 1) {
    const totalPages = page + 1; // L'API ne donne pas le total, on suppose qu'il y a une suite
    userSessions.set(senderId, { results, query, currentPage: page });

    let msg = `📚 𝗦𝗖𝗥𝗜𝗕𝗗 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥 📥\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🔍 *Recherche:* ${query}\n`;
    msg += `📑 *Page:* ${page}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    results.forEach((item) => {
        msg += `${item.id}️⃣ 📄 *${item.titre}*\n`;
    });

    msg += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📥 Tapez le *numéro* pour télécharger.\n`;
    msg += `⏭️ Tapez "*page ${page + 1}*" pour la suite.\n`;
    if (page > 1) msg += `⏮️ Tapez "*page ${page - 1}*" pour revenir.\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━`;
    
    await sendMessage(senderId, msg);
}

module.exports = async (senderId, prompt, api) => {
    try {
        const input = prompt.trim().toLowerCase();
        const session = userSessions.get(senderId);

        // Gestion de la pagination
        const pageMatch = input.match(/^page\s*(\d+)$/);
        if (pageMatch) {
            const pageNum = parseInt(pageMatch[1]);
            const query = session?.query || "lesona";
            await sendMessage(senderId, `🔍 Recherche page ${pageNum} pour "${query}"...`);
            const results = await searchScribd(query, pageNum);
            if (results.length > 0) {
                await displayResults(senderId, results, query, pageNum);
            } else {
                await sendMessage(senderId, "😔 Aucun résultat sur cette page.");
            }
            return;
        }

        // Gestion du téléchargement par numéro
        if (/^\d+$/.test(input) && session?.results) {
            const doc = session.results.find(r => r.id === input);
            if (doc) {
                await sendMessage(senderId, `⏳ Téléchargement de : ${doc.titre}...`);
                const downloadUrl = `${API_BASE}/download?scribd_url=${doc.id}`;
                
                try {
                    const { buffer } = await downloadToBuffer(downloadUrl);
                    if (buffer && buffer.length > 0) {
                        const filename = `${doc.titre.replace(/[^a-z0-9]/gi, '_')}.pdf`;
                        const result = await sendPdfToMessenger(senderId, buffer, filename);
                        if (result.success) {
                            await sendMessage(senderId, `✅ Document envoyé : ${doc.titre}`);
                            return;
                        }
                    }
                } catch (e) {
                    console.error('Scribd download error:', e.message);
                }
                
                await sendMessage(senderId, `🔗 L'envoi direct a échoué. Lien de secours :\n${downloadUrl}`);
                return;
            }
        }

        // Nouvelle recherche
        if (!input || input === 'scribd') {
            await sendMessage(senderId, "📖 *GUIDE SCRIBD*\nTapez 'scribd <votre recherche>'\nExemple: 'scribd lesona'");
            return;
        }

        await sendMessage(senderId, `🔍 Recherche de "${prompt}" sur Scribd...`);
        const results = await searchScribd(prompt, 1);

        if (results.length === 0) {
            await sendMessage(senderId, "😔 Aucun résultat trouvé sur Scribd.");
            return;
        }

        await displayResults(senderId, results, prompt, 1);
    } catch (e) {
        console.error('Scribd module error:', e);
        await sendMessage(senderId, "❌ Une erreur est survenue lors de la recherche Scribd.");
    }
};

module.exports.info = {
    name: "scribd",
    description: "Recherche et téléchargement de documents Scribd.",
    usage: "scribd <recherche>"
};