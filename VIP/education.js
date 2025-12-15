const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { Readable } = require('stream');
const sendMessage = require('../handles/sendMessage');

const API_BASE = 'https://pdf-tdnk.onrender.com/';
const LOCAL_PDF_DIR = path.join(__dirname, '..', 'pdf_exercice_bacc');
const MAX_MESSAGE_LENGTH = 1900;
const RESULTS_PER_PAGE = 5;

const userSessions = new Map();

const MATIERES = {
    'mathematiques': { emoji: '🔢', name: 'Mathématiques', aliases: ['math', 'maths'] },
    'physique': { emoji: '⚛️', name: 'Physique', aliases: ['phy', 'pc', 'spc'] },
    'svt': { emoji: '🧬', name: 'SVT', aliases: ['bio', 'biologie'] },
    'hg': { emoji: '🌍', name: 'Histoire-Géo', aliases: ['histoire', 'geo', 'geographie'] },
    'malagasy': { emoji: '🇲🇬', name: 'Malagasy', aliases: ['mlg', 'gasy'] },
    'philosophie': { emoji: '🧠', name: 'Philosophie', aliases: ['philo'] },
    'francais': { emoji: '📚', name: 'Français', aliases: ['fr', 'french'] },
    'anglais': { emoji: '🇬🇧', name: 'Anglais', aliases: ['ang', 'english', 'eng'] }
};

const SERIES = ['A', 'C', 'D', 'L', 'S', 'OSE', 'A-C-D', 'C-D', 'ACD', 'CD'];
const TYPES = ['sujet', 'correction'];

const SEARCH_MESSAGES = [
    "Voici les documents que j'ai trouvés pour toi",
    "Résultats de ta recherche ci-dessous",
    "J'ai déniché ces ressources pour tes révisions",
    "Documents disponibles pour ton apprentissage",
    "Voilà ce que j'ai trouvé dans la base de données"
];

const LOADING_MESSAGES = [
    "Recherche en cours dans la base de données...",
    "Je fouille les archives du baccalauréat...",
    "Consultation des documents pédagogiques...",
    "Récupération des fichiers en cours..."
];

const DECORATIONS = {
    header: '╔══════════════════════════════╗',
    footer: '╚══════════════════════════════╝',
    divider: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    subDivider: '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈',
    bullet: '◆',
    arrow: '➤',
    star: '★',
    check: '✓',
    sparkle: '✨'
};

function getRandomMessage(messages) {
    return messages[Math.floor(Math.random() * messages.length)];
}

function searchLocalPdfs(query) {
    try {
        if (!fs.existsSync(LOCAL_PDF_DIR)) {
            return [];
        }
        
        const files = fs.readdirSync(LOCAL_PDF_DIR)
            .filter(file => file.toLowerCase().endsWith('.pdf'))
            .filter(file => file.toLowerCase().includes(query.toLowerCase()))
            .map(file => {
                const filePath = path.join(LOCAL_PDF_DIR, file);
                const stats = fs.statSync(filePath);
                return {
                    titre: file.replace('.pdf', '').replace(/_/g, ' '),
                    matiere: 'Local',
                    type_doc: 'sujet',
                    annee: 'N/A',
                    serie: 'N/A',
                    isLocal: true,
                    localPath: filePath,
                    fileName: file,
                    size: stats.size
                };
            });
        
        return files;
    } catch (error) {
        console.error('Erreur recherche locale:', error.message);
        return [];
    }
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

async function sendLocalPdfToMessenger(recipientId, filePath, filename) {
    try {
        const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
        if (!PAGE_ACCESS_TOKEN) {
            throw new Error('PAGE_ACCESS_TOKEN non défini');
        }

        const buffer = fs.readFileSync(filePath);
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

function splitMessage(text, maxLength = MAX_MESSAGE_LENGTH) {
    if (text.length <= maxLength) {
        return [text];
    }

    const messages = [];
    const lines = text.split('\n');
    let currentMessage = '';

    for (const line of lines) {
        if ((currentMessage + '\n' + line).length > maxLength) {
            if (currentMessage) {
                messages.push(currentMessage.trim());
            }
            if (line.length > maxLength) {
                const words = line.split(' ');
                currentMessage = '';
                for (const word of words) {
                    if ((currentMessage + ' ' + word).length > maxLength) {
                        if (currentMessage) {
                            messages.push(currentMessage.trim());
                        }
                        currentMessage = word;
                    } else {
                        currentMessage += (currentMessage ? ' ' : '') + word;
                    }
                }
            } else {
                currentMessage = line;
            }
        } else {
            currentMessage += (currentMessage ? '\n' : '') + line;
        }
    }

    if (currentMessage) {
        messages.push(currentMessage.trim());
    }

    return messages;
}

async function sendSplitMessages(senderId, text) {
    const messages = splitMessage(text);
    for (let i = 0; i < messages.length; i++) {
        await sendMessage(senderId, messages[i]);
        if (i < messages.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }
}

function formatDocumentCard(doc, index) {
    const typeEmoji = doc.type_doc === 'correction' ? '✅' : '📄';
    const typeLabel = doc.type_doc === 'correction' ? 'Correction' : 'Sujet';
    const matiereInfo = MATIERES[doc.matiere?.toLowerCase()] || { emoji: '📘', name: doc.matiere || 'Non spécifié' };
    
    return `
┏━━━━━━━━━━━━━━━━━━━━━
┃ ${index}️⃣ ${typeEmoji} ${typeLabel}
┣━━━━━━━━━━━━━━━━━━━━━
┃ 📝 ${doc.titre || 'Document'}
┃ ${matiereInfo.emoji} Matière: ${matiereInfo.name}
┃ 📅 Année: ${doc.annee || 'N/A'}
┃ 🎓 Série: ${doc.serie || 'N/A'}
┗━━━━━━━━━━━━━━━━━━━━━`.trim();
}

module.exports = async (senderId, prompt, api) => {
    try {
        const userSession = userSessions.get(senderId) || {};
        const input = (typeof prompt === 'string') ? prompt.trim().toLowerCase() : '';

        if (/^\d+$/.test(input) && userSession.results && userSession.results.length > 0) {
            const index = parseInt(input) - 1;
            const currentPage = userSession.currentPage || 1;
            const startIdx = (currentPage - 1) * RESULTS_PER_PAGE;
            const pageResults = userSession.results.slice(startIdx, startIdx + RESULTS_PER_PAGE);
            
            if (index >= 0 && index < pageResults.length) {
                await handleDownload(senderId, pageResults[index]);
            } else {
                await sendMessage(senderId, `
❌ 𝗡𝘂𝗺𝗲́𝗿𝗼 𝗶𝗻𝘃𝗮𝗹𝗶𝗱𝗲
${DECORATIONS.divider}
Choisis un numéro entre 1 et ${pageResults.length}
                `.trim());
            }
            return;
        }

        if (input === 'suivant' || input === 'next') {
            if (userSession.results && userSession.results.length > 0) {
                const totalPages = Math.ceil(userSession.results.length / RESULTS_PER_PAGE);
                const newPage = Math.min((userSession.currentPage || 1) + 1, totalPages);
                await displayResults(senderId, userSession.results, newPage, userSession.searchQuery);
            }
            return;
        }

        if (input === 'precedent' || input === 'prev') {
            if (userSession.results && userSession.results.length > 0) {
                const newPage = Math.max((userSession.currentPage || 1) - 1, 1);
                await displayResults(senderId, userSession.results, newPage, userSession.searchQuery);
            }
            return;
        }

        if (input.startsWith('page ')) {
            const pageNum = parseInt(input.replace('page ', ''));
            if (userSession.results && !isNaN(pageNum)) {
                const totalPages = Math.ceil(userSession.results.length / RESULTS_PER_PAGE);
                if (pageNum >= 1 && pageNum <= totalPages) {
                    await displayResults(senderId, userSession.results, pageNum, userSession.searchQuery);
                }
            }
            return;
        }

        if (!input || input === 'help' || input === 'aide') {
            await showHelp(senderId);
            return;
        }

        await handleSearch(senderId, input);

    } catch (error) {
        console.error('Erreur commande education:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗿𝗿𝗲𝘂𝗿 𝗶𝗻𝗮𝘁𝘁𝗲𝗻𝗱𝘂𝗲
${DECORATIONS.divider}
Une erreur est survenue lors du traitement.
Réessaie dans quelques instants.

💡 Tape "education aide" pour voir le guide.
        `.trim());
    }
};

async function showHelp(senderId) {
    const helpHeader = `
📚 𝗘𝗗𝗨𝗖𝗔𝗧𝗜𝗢𝗡 - 𝗚𝗨𝗜𝗗𝗘 𝗗'𝗨𝗧𝗜𝗟𝗜𝗦𝗔𝗧𝗜𝗢𝗡
${DECORATIONS.header}
Accède aux sujets et corrections du
Baccalauréat Madagascar (1999-2023)
${DECORATIONS.footer}`.trim();

    await sendMessage(senderId, helpHeader);
    await new Promise(resolve => setTimeout(resolve, 300));

    const matieres = `
📖 𝗠𝗔𝗧𝗜𝗘̀𝗥𝗘𝗦 𝗗𝗜𝗦𝗣𝗢𝗡𝗜𝗕𝗟𝗘𝗦
${DECORATIONS.divider}
🔢 mathematiques (math)
⚛️ physique (phy, pc)
🧬 svt (bio)
🌍 hg (histoire, geo)
🇲🇬 malagasy (mlg)
🧠 philosophie (philo)
📚 francais (fr)
🇬🇧 anglais (ang, english)`.trim();

    await sendMessage(senderId, matieres);
    await new Promise(resolve => setTimeout(resolve, 300));

    const series = `
🎓 𝗦𝗘́𝗥𝗜𝗘𝗦 𝗗𝗜𝗦𝗣𝗢𝗡𝗜𝗕𝗟𝗘𝗦
${DECORATIONS.divider}
◆ Série A    ◆ Série C
◆ Série D    ◆ Série L
◆ Série S    ◆ Série OSE`.trim();

    await sendMessage(senderId, series);
    await new Promise(resolve => setTimeout(resolve, 300));

    const exemples = `
✨ 𝗘𝗫𝗘𝗠𝗣𝗟𝗘𝗦 𝗗'𝗨𝗧𝗜𝗟𝗜𝗦𝗔𝗧𝗜𝗢𝗡
${DECORATIONS.divider}
📌 education math
   ➜ Tous les sujets de maths

📌 education francais A 2019
   ➜ Français série A, année 2019

📌 education anglais A 2017
   ➜ Anglais série A, année 2017

📌 education anglais C sujet
   ➜ Sujets Anglais série C-D

📌 education anglais OSE
   ➜ Anglais série OSE

📌 education philo correction
   ➜ Corrections de philosophie

📌 education hg C correction 2018
   ➜ Correction HG série C 2018`.trim();

    await sendMessage(senderId, exemples);
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
Le PDF sera envoyé directement +
lien de téléchargement vers ton tel`.trim();

    await sendMessage(senderId, navigation);
}

async function handleSearch(senderId, query) {
    const loadingMsg = getRandomMessage(LOADING_MESSAGES);
    await sendMessage(senderId, `
⏳ 𝗥𝗘𝗖𝗛𝗘𝗥𝗖𝗛𝗘 𝗘𝗡 𝗖𝗢𝗨𝗥𝗦
${DECORATIONS.divider}
${loadingMsg}
🔍 "${query}"
    `.trim());

    const params = parseSearchQuery(query);
    
    const localResults = searchLocalPdfs(query);
    
    try {
        let url = `${API_BASE}/recherche?`;
        const queryParams = [];
        
        if (params.matiere) queryParams.push(`pdf=${encodeURIComponent(params.matiere)}`);
        if (params.serie) queryParams.push(`serie=${encodeURIComponent(params.serie)}`);
        if (params.type) queryParams.push(`type=${encodeURIComponent(params.type)}`);
        if (params.annee) queryParams.push(`annee=${encodeURIComponent(params.annee)}`);
        
        url += queryParams.join('&');
        
        console.log('API Education URL:', url);
        
        let apiResults = [];
        try {
            const response = await axios.get(url, { timeout: 30000 });
            if (response.data && response.data.resultats) {
                apiResults = response.data.resultats;
            }
        } catch (apiError) {
            console.log('Erreur API, utilisation des résultats locaux:', apiError.message);
        }
        
        const combinedResults = [...localResults, ...apiResults];
        
        if (combinedResults.length > 0) {
            userSessions.set(senderId, {
                results: combinedResults,
                currentPage: 1,
                searchQuery: query
            });
            
            await displayResults(senderId, combinedResults, 1, query);
        } else {
            await sendMessage(senderId, `
😔 𝗔𝗨𝗖𝗨𝗡 𝗥𝗘́𝗦𝗨𝗟𝗧𝗔𝗧
${DECORATIONS.divider}
Aucun document trouvé pour:
"${query}"

💡 𝗖𝗼𝗻𝘀𝗲𝗶𝗹𝘀 :
◆ Vérifie l'orthographe
◆ Essaie avec moins de filtres
◆ Utilise: education aide
            `.trim());
        }
    } catch (error) {
        console.error('Erreur recherche education:', error.message);
        
        if (localResults.length > 0) {
            userSessions.set(senderId, {
                results: localResults,
                currentPage: 1,
                searchQuery: query
            });
            await displayResults(senderId, localResults, 1, query);
        } else {
            await sendMessage(senderId, `
❌ 𝗘𝗿𝗿𝗲𝘂𝗿 𝗱𝗲 𝗰𝗼𝗻𝗻𝗲𝘅𝗶𝗼𝗻
${DECORATIONS.divider}
Impossible de contacter le serveur.
Réessaie dans quelques instants.
            `.trim());
        }
    }
}

function parseSearchQuery(query) {
    const parts = query.toLowerCase().split(/\s+/);
    const result = {
        matiere: null,
        serie: null,
        type: null,
        annee: null
    };

    for (const part of parts) {
        const matiereKey = getMatiereKey(part);
        if (matiereKey) {
            result.matiere = matiereKey;
            continue;
        }

        const upperPart = part.toUpperCase();
        if (SERIES.includes(upperPart) || SERIES.includes(upperPart.replace('-', ''))) {
            result.serie = upperPart;
            continue;
        }

        if (TYPES.includes(part)) {
            result.type = part;
            continue;
        }

        const yearMatch = part.match(/^(19\d{2}|20\d{2})$/);
        if (yearMatch) {
            result.annee = yearMatch[1];
        }
    }

    return result;
}

async function displayResults(senderId, results, page, query) {
    const totalPages = Math.ceil(results.length / RESULTS_PER_PAGE);
    const startIdx = (page - 1) * RESULTS_PER_PAGE;
    const pageResults = results.slice(startIdx, startIdx + RESULTS_PER_PAGE);
    
    userSessions.set(senderId, {
        ...userSessions.get(senderId),
        currentPage: page
    });

    const searchMsg = getRandomMessage(SEARCH_MESSAGES);
    
    const header = `
📚 𝗥𝗘́𝗦𝗨𝗟𝗧𝗔𝗧𝗦 𝗗𝗘 𝗥𝗘𝗖𝗛𝗘𝗥𝗖𝗛𝗘
${DECORATIONS.header}
🔍 Recherche: "${query}"
✨ ${searchMsg}

📄 Page ${page}/${totalPages}
📊 Total: ${results.length} document(s)
🎯 Affichage: ${startIdx + 1}-${startIdx + pageResults.length}
${DECORATIONS.footer}`.trim();

    await sendMessage(senderId, header);
    await new Promise(resolve => setTimeout(resolve, 300));

    for (let i = 0; i < pageResults.length; i++) {
        const doc = pageResults[i];
        const card = formatDocumentCard(doc, i + 1);
        await sendMessage(senderId, card);
        await new Promise(resolve => setTimeout(resolve, 250));
    }

    let footerParts = [];
    
    footerParts.push(`📥 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗥:`);
    footerParts.push(`Envoie le numéro (1-${pageResults.length})`);
    
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
🔄 Nouvelle recherche: education <terme>`.trim();

    await sendMessage(senderId, footer);
}

async function handleDownload(senderId, doc) {
    const matiereInfo = MATIERES[doc.matiere?.toLowerCase()] || { emoji: '📘', name: doc.matiere || 'Document' };
    const typeEmoji = doc.type_doc === 'correction' ? '✅' : '📄';
    const typeLabel = doc.type_doc === 'correction' ? 'Correction' : 'Sujet';

    if (doc.isLocal) {
        await sendMessage(senderId, `
⏳ 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 𝗘𝗡 𝗖𝗢𝗨𝗥𝗦
${DECORATIONS.divider}
📄 ${doc.titre}
📂 Source: Local

⏳ Préparation du fichier PDF...
        `.trim());

        try {
            const result = await sendLocalPdfToMessenger(senderId, doc.localPath, doc.fileName);
            
            if (result.success) {
                await sendMessage(senderId, `
✅ 𝗣𝗗𝗙 𝗘𝗡𝗩𝗢𝗬𝗘́ 𝗔𝗩𝗘𝗖 𝗦𝗨𝗖𝗖𝗘̀𝗦
${DECORATIONS.header}
📄 ${doc.titre}
📊 Taille: ${formatFileSize(doc.size)}
${DECORATIONS.footer}

💡 Le PDF a été envoyé en pièce jointe
📱 Tu peux le sauvegarder sur ton téléphone

🔄 Tape "education" pour continuer
                `.trim());
            } else {
                await sendMessage(senderId, `
❌ Erreur lors de l'envoi du PDF local.
🔄 Réessaie plus tard.
                `.trim());
            }
        } catch (error) {
            console.error('Erreur envoi PDF local:', error.message);
            await sendMessage(senderId, `❌ Erreur lors de l'envoi du fichier.`);
        }
        return;
    }

    await sendMessage(senderId, `
⏳ 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 𝗘𝗡 𝗖𝗢𝗨𝗥𝗦
${DECORATIONS.divider}
${typeEmoji} ${typeLabel}
${matiereInfo.emoji} ${matiereInfo.name}
📅 Année: ${doc.annee || 'N/A'}
🎓 Série: ${doc.serie || 'N/A'}

⏳ Préparation du fichier...
    `.trim());

    try {
        let pdfUrl = doc.url_telechargement || doc.pdf_url;
        
        if (doc.id) {
            pdfUrl = `${API_BASE}/pdf/${doc.id}`;
        }
        
        if (!pdfUrl && doc.url) {
            pdfUrl = doc.url;
        }

        if (pdfUrl) {
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
                console.log('PDF envoyé avec succès:', pdfUrl);
            } catch (sendError) {
                console.log('Erreur envoi PDF direct:', sendError.message);
                pdfSentSuccessfully = false;
            }

            const successMessage = `
${pdfSentSuccessfully ? '✅ 𝗣𝗗𝗙 𝗘𝗡𝗩𝗢𝗬𝗘́ 𝗔𝗩𝗘𝗖 𝗦𝗨𝗖𝗖𝗘̀𝗦' : '📥 𝗟𝗜𝗘𝗡 𝗗𝗘 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧'}
${DECORATIONS.header}
📝 ${doc.titre || 'Document'}
${matiereInfo.emoji} ${matiereInfo.name}
${typeEmoji} ${typeLabel}
📅 ${doc.annee || 'N/A'} | 🎓 ${doc.serie || 'N/A'}
${DECORATIONS.footer}`.trim();

            await sendMessage(senderId, successMessage);
            await new Promise(resolve => setTimeout(resolve, 200));

            await sendMessage(senderId, `
🔗 𝗟𝗶𝗲𝗻 𝗱𝗲 𝘁𝗲́𝗹𝗲́𝗰𝗵𝗮𝗿𝗴𝗲𝗺𝗲𝗻𝘁:
${pdfUrl}
            `.trim());

            await sendMessage(senderId, `
💡 ${pdfSentSuccessfully ? 'PDF envoyé + lien ci-dessus' : 'Clique sur le lien pour télécharger'}
📱 Le fichier sera enregistré sur ton téléphone

🔄 Tape "education" pour continuer
            `.trim());

        } else {
            await sendMessage(senderId, `
❌ 𝗟𝗜𝗘𝗡 𝗡𝗢𝗡 𝗗𝗜𝗦𝗣𝗢𝗡𝗜𝗕𝗟𝗘
${DECORATIONS.divider}
Le lien de téléchargement n'est pas
disponible pour ce document.

🔄 Essaie avec un autre document.
            `.trim());
        }

    } catch (error) {
        console.error('Erreur téléchargement:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗿𝗿𝗲𝘂𝗿 𝗱𝗲 𝘁𝗲́𝗹𝗲́𝗰𝗵𝗮𝗿𝗴𝗲𝗺𝗲𝗻𝘁
${DECORATIONS.divider}
Impossible de récupérer le fichier.
Réessaie dans quelques instants.
        `.trim());
    }
}
