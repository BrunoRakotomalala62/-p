const axios = require('axios');
const FormData = require('form-data');
const { Readable } = require('stream');
const sendMessage = require('../handles/sendMessage');

const API_BASE = 'https://meo-book.vercel.app';
const RESULTS_PER_PAGE = 5;
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

const BOOK_TYPES = {
    'roman': 'roman',
    'educatif': 'educatif',
    'technique': 'technique',
    'science': 'science',
    'all': 'all'
};

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
        const response = await axios.head(url, {
            timeout: 10000,
            maxRedirects: 5
        });
        return parseInt(response.headers['content-length'] || '0');
    } catch (error) {
        return 0;
    }
}

async function downloadToBuffer(url) {
    try {
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'arraybuffer',
            timeout: 180000,
            maxRedirects: 5,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const buffer = Buffer.from(response.data);
        return { buffer, size: buffer.length };
    } catch (error) {
        throw error;
    }
}

async function sendPdfToMessenger(recipientId, buffer, filename) {
    try {
        const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
        if (!PAGE_ACCESS_TOKEN) {
            throw new Error('PAGE_ACCESS_TOKEN non défini');
        }

        const stream = Readable.from(buffer);
        
        const form = new FormData();
        form.append('recipient', JSON.stringify({ id: recipientId }));
        form.append('message', JSON.stringify({
            attachment: {
                type: 'file',
                payload: {
                    is_reusable: false
                }
            }
        }));
        form.append('filedata', stream, {
            filename: filename,
            contentType: 'application/pdf'
        });

        const response = await axios.post(
            `https://graph.facebook.com/v16.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
            form,
            {
                headers: form.getHeaders(),
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: 180000
            }
        );

        return { success: true, data: response.data };
    } catch (error) {
        const errorData = error.response ? error.response.data : error.message;
        return { success: false, error: errorData };
    }
}

function getMatiereKey(input) {
    const normalized = input.toLowerCase().trim();
    for (const [key, value] of Object.entries(MATIERES)) {
        if (key === normalized || value.aliases.includes(normalized)) {
            return key;
        }
    }
    return null;
}

function parseSearchQuery(query) {
    const parts = query.toLowerCase().split(/\s+/);
    const result = {
        isBacc: false,
        matiere: null,
        serie: null,
        type: null,
        annee: null,
        bookQuery: null,
        bookType: 'all'
    };

    const baccKeywords = ['bacc', 'bac', 'sujet', 'correction', 'corrige', 'enonce', 'examen'];
    for (const part of parts) {
        if (baccKeywords.includes(part)) {
            result.isBacc = true;
            break;
        }
        const matiereKey = getMatiereKey(part);
        if (matiereKey) {
            result.isBacc = true;
            break;
        }
    }

    if (result.isBacc) {
        for (const part of parts) {
            const matiereKey = getMatiereKey(part);
            if (matiereKey) {
                result.matiere = matiereKey;
                continue;
            }

            const upperPart = part.toUpperCase();
            if (SERIES.includes(upperPart)) {
                result.serie = upperPart;
                continue;
            }

            if (DOC_TYPES.includes(part)) {
                if (part === 'sujet' || part === 'enonce') {
                    result.type = 'sujet';
                } else {
                    result.type = 'correction';
                }
                continue;
            }

            const yearMatch = part.match(/^(19\d{2}|20\d{2})$/);
            if (yearMatch) {
                result.annee = parseInt(yearMatch[1]);
            }
        }
    } else {
        const filteredParts = parts.filter(p => !['pdf', 'livre', 'book', 'ebook'].includes(p));
        result.bookQuery = filteredParts.join(' ');
        
        for (const [key, value] of Object.entries(BOOK_TYPES)) {
            if (parts.includes(key)) {
                result.bookType = value;
                result.bookQuery = filteredParts.filter(p => p !== key).join(' ');
                break;
            }
        }
    }

    return result;
}

async function searchBooks(query, bookType = 'all', page = 1) {
    try {
        const url = `${API_BASE}/recherche?livre=${encodeURIComponent(query)}&type=${bookType}&page=${page}&par_page=50`;
        console.log('API PDF URL:', url);
        
        const response = await axios.get(url, { timeout: 30000 });
        
        if (response.data && response.data.livres) {
            return {
                results: response.data.livres,
                pagination: response.data.pagination,
                total: response.data.nombre_resultats
            };
        }
        return { results: [], pagination: null, total: 0 };
    } catch (error) {
        console.error('Erreur recherche livres:', error.message);
        throw error;
    }
}

async function searchBacc(matiere, serie, annee, type, page = 1) {
    try {
        let url = `${API_BASE}/sujets?page=${page}&par_page=50`;
        
        if (matiere) url += `&matiere=${encodeURIComponent(matiere)}`;
        if (serie) url += `&serie=${encodeURIComponent(serie)}`;
        if (annee) url += `&annee=${annee}`;
        if (type) url += `&type=${encodeURIComponent(type)}`;
        
        console.log('API Sujets URL:', url);
        
        const response = await axios.get(url, { timeout: 30000 });
        
        if (response.data && response.data.sujets) {
            return {
                results: response.data.sujets,
                pagination: response.data.pagination,
                total: response.data.nombre_resultats,
                searchInfo: response.data.recherche
            };
        }
        return { results: [], pagination: null, total: 0 };
    } catch (error) {
        console.error('Erreur recherche sujets:', error.message);
        throw error;
    }
}

async function displayBookResults(senderId, results, page, totalResults, query) {
    const totalPages = Math.ceil(results.length / RESULTS_PER_PAGE);
    const startIdx = (page - 1) * RESULTS_PER_PAGE;
    const pageResults = results.slice(startIdx, startIdx + RESULTS_PER_PAGE);

    userSessions.set(senderId, {
        mode: 'book',
        results: results,
        currentPage: page,
        pageResults: pageResults,
        searchQuery: query
    });

    const searchMsg = getRandomMessage(SEARCH_MESSAGES);

    const header = `
📚 𝗥𝗘́𝗦𝗨𝗟𝗧𝗔𝗧𝗦 𝗣𝗗𝗙
${DECORATIONS.header}
🔍 Recherche: "${query}"
✨ ${searchMsg}

📄 Page ${page}/${totalPages}
📊 Total: ${totalResults} document(s)
🎯 Affichage: ${startIdx + 1}-${startIdx + pageResults.length}
${DECORATIONS.footer}`.trim();

    await sendMessage(senderId, header);
    await new Promise(resolve => setTimeout(resolve, 300));

    for (let i = 0; i < pageResults.length; i++) {
        const doc = pageResults[i];
        const bookNumber = i + 1;

        const bookCard = `
┏━━━━━━━━━━━━━━━━━━━━━
┃ ${bookNumber}️⃣ 📖 𝗟𝗜𝗩𝗥𝗘
┣━━━━━━━━━━━━━━━━━━━━━
┃ 📝 ${doc.titre || 'Sans titre'}
┃ 📂 Source: ${doc.source || 'N/A'}
┗━━━━━━━━━━━━━━━━━━━━━`.trim();

        await sendMessage(senderId, bookCard);
        await new Promise(resolve => setTimeout(resolve, 200));

        if (doc.url_image) {
            try {
                await sendMessage(senderId, {
                    attachment: {
                        type: 'image',
                        payload: {
                            url: doc.url_image,
                            is_reusable: true
                        }
                    }
                });
            } catch (imgError) {
                console.log('Erreur envoi image:', imgError.message);
            }
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }

    let footerParts = [];
    footerParts.push(`📥 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗥:`);
    footerParts.push(`Envoie le numéro (1-${pageResults.length}) pour télécharger`);
    
    if (totalPages > 1) {
        footerParts.push('');
        footerParts.push(`🧭 𝗡𝗔𝗩𝗜𝗚𝗔𝗧𝗜𝗢𝗡:`);
        if (page > 1) footerParts.push(`◀️ "precedent" - Page ${page - 1}`);
        if (page < totalPages) footerParts.push(`▶️ "suivant" - Page ${page + 1}`);
        footerParts.push(`📍 "page X" - Aller à la page X`);
    }

    const footer = `
${DECORATIONS.divider}
${footerParts.join('\n')}
${DECORATIONS.subDivider}
🔄 Nouvelle recherche: pdf <terme>`.trim();

    await sendMessage(senderId, footer);
}

async function displayBaccResults(senderId, results, page, totalResults, searchInfo) {
    const totalPages = Math.ceil(results.length / RESULTS_PER_PAGE);
    const startIdx = (page - 1) * RESULTS_PER_PAGE;
    const pageResults = results.slice(startIdx, startIdx + RESULTS_PER_PAGE);

    userSessions.set(senderId, {
        mode: 'bacc',
        results: results,
        currentPage: page,
        pageResults: pageResults,
        searchInfo: searchInfo
    });

    const searchMsg = getRandomMessage(SEARCH_MESSAGES);

    const header = `
📚 𝗦𝗨𝗝𝗘𝗧𝗦 𝗕𝗔𝗖𝗖 𝗠𝗔𝗗𝗔𝗚𝗔𝗦𝗖𝗔𝗥
${DECORATIONS.header}
🔍 Matière: ${searchInfo?.matiere || 'Toutes'}
🎓 Série: ${searchInfo?.serie || 'Toutes'}
📅 Année: ${searchInfo?.annee || '1999-2025'}
✨ ${searchMsg}

📄 Page ${page}/${totalPages}
📊 Total: ${totalResults} document(s)
${DECORATIONS.footer}`.trim();

    await sendMessage(senderId, header);
    await new Promise(resolve => setTimeout(resolve, 300));

    for (let i = 0; i < pageResults.length; i++) {
        const doc = pageResults[i];
        const docNumber = i + 1;
        const typeEmoji = doc.type === 'corrige' ? '✅' : '📄';
        const typeLabel = doc.type === 'corrige' ? 'Correction' : 'Sujet';
        const matiereInfo = MATIERES[doc.matiere?.toLowerCase()] || { emoji: '📘', name: doc.matiere || 'N/A' };

        const docCard = `
┏━━━━━━━━━━━━━━━━━━━━━
┃ ${docNumber}️⃣ ${typeEmoji} ${typeLabel}
┣━━━━━━━━━━━━━━━━━━━━━
┃ 📝 ${doc.titre || 'Document'}
┃ ${matiereInfo.emoji} Matière: ${matiereInfo.name}
┃ 📅 Année: ${doc.annee || 'N/A'}
┃ 🎓 Série: ${doc.serie || 'N/A'}
┗━━━━━━━━━━━━━━━━━━━━━`.trim();

        await sendMessage(senderId, docCard);
        await new Promise(resolve => setTimeout(resolve, 200));

        if (doc.url_image) {
            try {
                await sendMessage(senderId, {
                    attachment: {
                        type: 'image',
                        payload: {
                            url: doc.url_image,
                            is_reusable: true
                        }
                    }
                });
            } catch (imgError) {
                console.log('Erreur envoi image:', imgError.message);
            }
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }

    let footerParts = [];
    footerParts.push(`📥 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗥:`);
    footerParts.push(`Envoie le numéro (1-${pageResults.length}) pour télécharger`);
    
    if (totalPages > 1) {
        footerParts.push('');
        footerParts.push(`🧭 𝗡𝗔𝗩𝗜𝗚𝗔𝗧𝗜𝗢𝗡:`);
        if (page > 1) footerParts.push(`◀️ "precedent" - Page ${page - 1}`);
        if (page < totalPages) footerParts.push(`▶️ "suivant" - Page ${page + 1}`);
        footerParts.push(`📍 "page X" - Aller à la page X`);
    }

    const footer = `
${DECORATIONS.divider}
${footerParts.join('\n')}
${DECORATIONS.subDivider}
🔄 Nouvelle recherche: pdf <terme>`.trim();

    await sendMessage(senderId, footer);
}

async function handleDownload(senderId, doc, mode) {
    const titre = doc.titre || 'document';
    const pdfUrl = doc.lien_pdf || doc.url_pdf;
    
    if (mode === 'bacc') {
        const typeEmoji = doc.type === 'corrige' ? '✅' : '📄';
        const typeLabel = doc.type === 'corrige' ? 'Correction' : 'Sujet';
        const matiereInfo = MATIERES[doc.matiere?.toLowerCase()] || { emoji: '📘', name: doc.matiere || 'Document' };

        await sendMessage(senderId, `
⏳ 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 𝗘𝗡 𝗖𝗢𝗨𝗥𝗦
${DECORATIONS.divider}
${typeEmoji} ${typeLabel}
${matiereInfo.emoji} ${matiereInfo.name}
📅 Année: ${doc.annee || 'N/A'}
🎓 Série: ${doc.serie || 'N/A'}

⏳ Préparation du fichier PDF...
        `.trim());
    } else {
        await sendMessage(senderId, `
⏳ 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 𝗘𝗡 𝗖𝗢𝗨𝗥𝗦
${DECORATIONS.divider}
📖 ${titre}
📂 Source: ${doc.source || 'N/A'}

⏳ Préparation du fichier PDF...
        `.trim());
    }

    try {
        if (!pdfUrl) {
            await sendMessage(senderId, `
❌ 𝗟𝗜𝗘𝗡 𝗡𝗢𝗡 𝗗𝗜𝗦𝗣𝗢𝗡𝗜𝗕𝗟𝗘
${DECORATIONS.divider}
Le lien de téléchargement n'est pas
disponible pour ce document.

🔄 Essaie avec un autre document.
            `.trim());
            return;
        }

        if (doc.url_image) {
            try {
                await sendMessage(senderId, {
                    attachment: {
                        type: 'image',
                        payload: {
                            url: doc.url_image,
                            is_reusable: true
                        }
                    }
                });
                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (imgError) {
                console.log('Erreur envoi image:', imgError.message);
            }
        }

        const fileSize = await getFileSize(pdfUrl);
        console.log(`Taille du PDF: ${formatFileSize(fileSize)}`);

        if (fileSize > 0 && fileSize < MAX_FILE_SIZE) {
            await sendMessage(senderId, `
📊 Taille: ${formatFileSize(fileSize)}
📥 Envoi du PDF en pièce jointe...
            `.trim());

            try {
                const { buffer } = await downloadToBuffer(pdfUrl);
                const filename = doc.nom_fichier || `${titre.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}.pdf`;
                
                const result = await sendPdfToMessenger(senderId, buffer, filename);
                
                if (result.success) {
                    await sendMessage(senderId, `
✅ 𝗣𝗗𝗙 𝗘𝗡𝗩𝗢𝗬𝗘́ 𝗔𝗩𝗘𝗖 𝗦𝗨𝗖𝗖𝗘̀𝗦
${DECORATIONS.header}
📖 ${titre}
📊 Taille: ${formatFileSize(fileSize)}
${DECORATIONS.footer}

💡 Le PDF a été envoyé en pièce jointe
📱 Tu peux le sauvegarder sur ton téléphone

🔄 Tape "pdf" pour voir le guide
                    `.trim());
                    return;
                }
            } catch (downloadError) {
                console.log('Erreur envoi direct, envoi du lien:', downloadError.message);
            }
        }

        let pdfSentSuccessfully = false;
        try {
            await sendMessage(senderId, {
                attachment: {
                    type: 'file',
                    payload: {
                        url: pdfUrl,
                        is_reusable: true
                    }
                }
            });
            pdfSentSuccessfully = true;
        } catch (sendError) {
            console.log('Erreur envoi PDF direct:', sendError.message);
        }

        const sizeInfo = fileSize > 0 ? `📊 Taille: ${formatFileSize(fileSize)}` : '';
        const sizeWarning = fileSize >= MAX_FILE_SIZE ? '\n⚠️ Fichier volumineux' : '';

        await sendMessage(senderId, `
${pdfSentSuccessfully ? '✅ 𝗣𝗗𝗙 𝗘𝗡𝗩𝗢𝗬𝗘́' : '📥 𝗟𝗜𝗘𝗡 𝗗𝗘 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧'}
${DECORATIONS.header}
📖 ${titre}
${sizeInfo}${sizeWarning}
${DECORATIONS.footer}
        `.trim());

        await new Promise(resolve => setTimeout(resolve, 200));

        await sendMessage(senderId, `
🔗 𝗟𝗶𝗲𝗻 𝗱𝗲 𝘁𝗲́𝗹𝗲́𝗰𝗵𝗮𝗿𝗴𝗲𝗺𝗲𝗻𝘁:
${pdfUrl}
        `.trim());

        await sendMessage(senderId, `
💡 ${pdfSentSuccessfully ? 'PDF envoyé + lien ci-dessus' : 'Clique sur le lien pour télécharger'}
📱 Le fichier sera enregistré sur ton téléphone

🔄 Tape "pdf" pour continuer
        `.trim());

    } catch (error) {
        console.error('Erreur téléchargement:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗿𝗿𝗲𝘂𝗿 𝗱𝗲 𝘁𝗲́𝗹𝗲́𝗰𝗵𝗮𝗿𝗴𝗲𝗺𝗲𝗻𝘁
${DECORATIONS.divider}
Impossible de récupérer le fichier.
Réessaie dans quelques instants.

🔗 Lien direct: ${pdfUrl || 'Non disponible'}
        `.trim());
    }
}

async function showHelp(senderId) {
    const helpHeader = `
📚 𝗣𝗗𝗙 - 𝗚𝗨𝗜𝗗𝗘 𝗗'𝗨𝗧𝗜𝗟𝗜𝗦𝗔𝗧𝗜𝗢𝗡
${DECORATIONS.header}
Recherche de livres PDF et sujets
Bacc Madagascar (1999-2025)
${DECORATIONS.footer}`.trim();

    await sendMessage(senderId, helpHeader);
    await new Promise(resolve => setTimeout(resolve, 300));

    const booksSection = `
📖 𝗥𝗘𝗖𝗛𝗘𝗥𝗖𝗛𝗘 𝗗𝗘 𝗟𝗜𝗩𝗥𝗘𝗦
${DECORATIONS.divider}
📌 pdf python
   ➜ Recherche livres sur Python

📌 pdf roman victor hugo
   ➜ Recherche romans de Victor Hugo

📌 pdf mathematiques terminale
   ➜ Livres de maths terminale

📌 pdf science biologie
   ➜ Livres scientifiques`.trim();

    await sendMessage(senderId, booksSection);
    await new Promise(resolve => setTimeout(resolve, 300));

    const baccSection = `
🎓 𝗦𝗨𝗝𝗘𝗧𝗦 𝗕𝗔𝗖𝗖 𝗠𝗔𝗗𝗔𝗚𝗔𝗦𝗖𝗔𝗥
${DECORATIONS.divider}
📌 pdf bacc math
   ➜ Tous les sujets de maths

📌 pdf bacc physique C 2022
   ➜ Physique série C, année 2022

📌 pdf math D correction
   ➜ Corrections maths série D

📌 pdf philo A sujet 2020
   ➜ Sujet philo série A 2020`.trim();

    await sendMessage(senderId, baccSection);
    await new Promise(resolve => setTimeout(resolve, 300));

    const matieres = `
📖 𝗠𝗔𝗧𝗜𝗘̀𝗥𝗘𝗦 𝗕𝗔𝗖𝗖
${DECORATIONS.divider}
🔢 mathematiques (math)
⚛️ physique (phy, pc)
🧬 svt (bio)
🌍 histoire-geo (hg)
🇲🇬 malagasy (mlg)
🧠 philosophie (philo)
📚 francais (fr)
🇬🇧 anglais (ang)
💰 economie (eco)

🎓 𝗦𝗲́𝗿𝗶𝗲𝘀: A, C, D, L, S, OSE`.trim();

    await sendMessage(senderId, matieres);
    await new Promise(resolve => setTimeout(resolve, 300));

    const navigation = `
🧭 𝗡𝗔𝗩𝗜𝗚𝗔𝗧𝗜𝗢𝗡
${DECORATIONS.divider}
◆ Envoie le numéro pour télécharger
◆ "suivant" → Page suivante
◆ "precedent" → Page précédente
◆ "page 3" → Aller à la page 3

📥 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧
${DECORATIONS.divider}
◆ PDF < 25 Mo: envoyé en pièce jointe
◆ PDF > 25 Mo: lien de téléchargement
◆ Image de couverture incluse`.trim();

    await sendMessage(senderId, navigation);
}

module.exports = async (senderId, prompt) => {
    try {
        const userSession = userSessions.get(senderId) || {};
        const input = (typeof prompt === 'string') ? prompt.trim().toLowerCase() : '';

        if (/^\d+$/.test(input) && userSession.pageResults && userSession.pageResults.length > 0) {
            const index = parseInt(input) - 1;
            
            if (index >= 0 && index < userSession.pageResults.length) {
                await handleDownload(senderId, userSession.pageResults[index], userSession.mode);
            } else {
                await sendMessage(senderId, `
❌ 𝗡𝘂𝗺𝗲́𝗿𝗼 𝗶𝗻𝘃𝗮𝗹𝗶𝗱𝗲
${DECORATIONS.divider}
Choisis un numéro entre 1 et ${userSession.pageResults.length}
                `.trim());
            }
            return;
        }

        if (input === 'suivant' || input === 'next') {
            if (userSession.results && userSession.results.length > 0) {
                const totalPages = Math.ceil(userSession.results.length / RESULTS_PER_PAGE);
                const newPage = Math.min((userSession.currentPage || 1) + 1, totalPages);
                
                if (userSession.mode === 'bacc') {
                    await displayBaccResults(senderId, userSession.results, newPage, userSession.results.length, userSession.searchInfo);
                } else {
                    await displayBookResults(senderId, userSession.results, newPage, userSession.results.length, userSession.searchQuery);
                }
            }
            return;
        }

        if (input === 'precedent' || input === 'prev') {
            if (userSession.results && userSession.results.length > 0) {
                const newPage = Math.max((userSession.currentPage || 1) - 1, 1);
                
                if (userSession.mode === 'bacc') {
                    await displayBaccResults(senderId, userSession.results, newPage, userSession.results.length, userSession.searchInfo);
                } else {
                    await displayBookResults(senderId, userSession.results, newPage, userSession.results.length, userSession.searchQuery);
                }
            }
            return;
        }

        if (input.startsWith('page ')) {
            const pageNum = parseInt(input.replace('page ', ''));
            if (userSession.results && !isNaN(pageNum)) {
                const totalPages = Math.ceil(userSession.results.length / RESULTS_PER_PAGE);
                if (pageNum >= 1 && pageNum <= totalPages) {
                    if (userSession.mode === 'bacc') {
                        await displayBaccResults(senderId, userSession.results, pageNum, userSession.results.length, userSession.searchInfo);
                    } else {
                        await displayBookResults(senderId, userSession.results, pageNum, userSession.results.length, userSession.searchQuery);
                    }
                }
            }
            return;
        }

        if (!input || input === 'help' || input === 'aide') {
            await showHelp(senderId);
            return;
        }

        const loadingMsg = getRandomMessage(LOADING_MESSAGES);
        await sendMessage(senderId, `
⏳ 𝗥𝗘𝗖𝗛𝗘𝗥𝗖𝗛𝗘 𝗘𝗡 𝗖𝗢𝗨𝗥𝗦
${DECORATIONS.divider}
${loadingMsg}
🔍 "${input}"
        `.trim());

        const searchParams = parseSearchQuery(input);

        if (searchParams.isBacc) {
            const { results, pagination, total, searchInfo } = await searchBacc(
                searchParams.matiere,
                searchParams.serie,
                searchParams.annee,
                searchParams.type
            );

            if (results.length === 0) {
                await sendMessage(senderId, `
😔 𝗔𝗨𝗖𝗨𝗡 𝗥𝗘́𝗦𝗨𝗟𝗧𝗔𝗧
${DECORATIONS.divider}
Aucun sujet Bacc trouvé pour:
"${input}"

💡 𝗖𝗼𝗻𝘀𝗲𝗶𝗹𝘀 :
◆ Vérifie l'orthographe
◆ Essaie: pdf bacc math
◆ Ou: pdf bacc physique C 2022
◆ Tape "pdf aide" pour le guide
                `.trim());
                return;
            }

            await displayBaccResults(senderId, results, 1, total, searchInfo);
        } else {
            const query = searchParams.bookQuery || input;
            const { results, pagination, total } = await searchBooks(query, searchParams.bookType);

            if (results.length === 0) {
                await sendMessage(senderId, `
😔 𝗔𝗨𝗖𝗨𝗡 𝗥𝗘́𝗦𝗨𝗟𝗧𝗔𝗧
${DECORATIONS.divider}
Aucun livre PDF trouvé pour:
"${input}"

💡 𝗖𝗼𝗻𝘀𝗲𝗶𝗹𝘀 :
◆ Vérifie l'orthographe
◆ Essaie avec moins de mots
◆ Exemple: pdf python
◆ Tape "pdf aide" pour le guide
                `.trim());
                return;
            }

            await displayBookResults(senderId, results, 1, total, query);
        }

    } catch (error) {
        console.error('Erreur commande pdf:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗿𝗿𝗲𝘂𝗿 𝗶𝗻𝗮𝘁𝘁𝗲𝗻𝗱𝘂𝗲
${DECORATIONS.divider}
Une erreur est survenue lors du traitement.
Réessaie dans quelques instants.

💡 Tape "pdf aide" pour voir le guide.
        `.trim());
    }
};
