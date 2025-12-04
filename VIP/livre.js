const axios = require('axios');
const FormData = require('form-data');
const { Readable } = require('stream');
const sendMessage = require('../handles/sendMessage');

const API_URL = 'https://livre-pdf-gratuit.vercel.app/livres';
const BOOKS_PER_PAGE = 5;
const MAX_FILE_SIZE = 25 * 1024 * 1024;

const userSessions = new Map();

const DECORATIONS = {
    header: '╔══════════════════════════════╗',
    footer: '╚══════════════════════════════╝',
    divider: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    subDivider: '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈',
    bullet: '◆',
    arrow: '➤',
    book: '📚',
    download: '📥',
    page: '📄'
};

const LOADING_MESSAGES = [
    "Chargement des livres en cours...",
    "Consultation de la bibliothèque...",
    "Récupération des ouvrages...",
    "Fouille dans les étagères numériques..."
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
        const contentLength = parseInt(response.headers['content-length'] || '0');
        return contentLength;
    } catch (error) {
        console.log('Impossible de récupérer la taille du fichier:', error.message);
        return 0;
    }
}

async function downloadToBuffer(url) {
    try {
        console.log('Téléchargement PDF en mémoire:', url);
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
        console.log(`PDF téléchargé en mémoire: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB`);
        return { buffer, size: buffer.length };
    } catch (error) {
        console.error('Erreur téléchargement PDF:', error.message);
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

        console.log('PDF envoyé via FormData:', response.data);
        return { success: true, data: response.data };
    } catch (error) {
        const errorData = error.response ? error.response.data : error.message;
        console.error('Erreur envoi PDF:', errorData);
        return { success: false, error: errorData };
    }
}

async function fetchBooks() {
    try {
        const response = await axios.get(API_URL, { timeout: 30000 });
        if (response.data && response.data.livres) {
            return response.data.livres;
        }
        return [];
    } catch (error) {
        console.error('Erreur récupération livres:', error.message);
        throw error;
    }
}

async function displayBooksPage(senderId, books, page) {
    const totalPages = Math.ceil(books.length / BOOKS_PER_PAGE);
    const startIdx = (page - 1) * BOOKS_PER_PAGE;
    const pageBooks = books.slice(startIdx, startIdx + BOOKS_PER_PAGE);

    userSessions.set(senderId, {
        books: books,
        currentPage: page,
        pageBooks: pageBooks
    });

    const header = `
📚 𝗕𝗜𝗕𝗟𝗜𝗢𝗧𝗛𝗘̀𝗤𝗨𝗘 𝗡𝗨𝗠𝗘́𝗥𝗜𝗤𝗨𝗘
${DECORATIONS.header}
📄 Page ${page}/${totalPages}
📊 Total: ${books.length} livre(s)
🎯 Affichage: ${startIdx + 1}-${startIdx + pageBooks.length}
${DECORATIONS.footer}`.trim();

    await sendMessage(senderId, header);
    await new Promise(resolve => setTimeout(resolve, 300));

    for (let i = 0; i < pageBooks.length; i++) {
        const book = pageBooks[i];
        const bookNumber = i + 1;

        const bookCard = `
┏━━━━━━━━━━━━━━━━━━━━━
┃ ${bookNumber}️⃣ 📖 𝗟𝗜𝗩𝗥𝗘
┣━━━━━━━━━━━━━━━━━━━━━
┃ 📝 Titre: ${book.titre || 'Sans titre'}
┗━━━━━━━━━━━━━━━━━━━━━`.trim();

        await sendMessage(senderId, bookCard);
        await new Promise(resolve => setTimeout(resolve, 200));

        if (book.image_url) {
            try {
                await sendMessage(senderId, {
                    attachment: {
                        type: 'image',
                        payload: {
                            url: book.image_url,
                            is_reusable: true
                        }
                    }
                });
            } catch (imgError) {
                console.log('Erreur envoi image livre:', imgError.message);
            }
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }

    let footerParts = [];
    footerParts.push(`📥 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗥:`);
    footerParts.push(`Envoie le numéro (1-${pageBooks.length}) pour télécharger`);
    
    if (totalPages > 1) {
        footerParts.push('');
        footerParts.push(`🧭 𝗡𝗔𝗩𝗜𝗚𝗔𝗧𝗜𝗢𝗡:`);
        if (page > 1) footerParts.push(`◀️ "page ${page - 1}" - Page précédente`);
        if (page < totalPages) footerParts.push(`▶️ "page ${page + 1}" - Page suivante`);
    }

    const footer = `
${DECORATIONS.divider}
${footerParts.join('\n')}
${DECORATIONS.subDivider}
🔄 Nouvelle recherche: livre`.trim();

    await sendMessage(senderId, footer);
}

async function handleDownload(senderId, book) {
    const titre = book.titre || 'livre';
    
    await sendMessage(senderId, `
⏳ 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 𝗘𝗡 𝗖𝗢𝗨𝗥𝗦
${DECORATIONS.divider}
📖 ${titre}
⏳ Préparation du fichier PDF...
    `.trim());

    try {
        const pdfUrl = book.url_pdf;
        
        if (!pdfUrl) {
            await sendMessage(senderId, `
❌ 𝗟𝗜𝗘𝗡 𝗡𝗢𝗡 𝗗𝗜𝗦𝗣𝗢𝗡𝗜𝗕𝗟𝗘
${DECORATIONS.divider}
Le lien de téléchargement n'est pas
disponible pour ce livre.

🔄 Essaie avec un autre livre.
            `.trim());
            return;
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
                const filename = `${titre}.pdf`;
                
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

🔄 Tape "livre" pour voir d'autres livres
                    `.trim());
                    return;
                }
            } catch (downloadError) {
                console.log('Erreur envoi direct, envoi du lien:', downloadError.message);
            }
        }

        const sizeInfo = fileSize > 0 ? `📊 Taille: ${formatFileSize(fileSize)}` : '';
        const sizeWarning = fileSize >= MAX_FILE_SIZE ? '\n⚠️ Fichier trop volumineux pour envoi direct' : '';
        
        await sendMessage(senderId, `
📥 𝗟𝗜𝗘𝗡 𝗗𝗘 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧
${DECORATIONS.header}
📖 ${titre}
${sizeInfo}${sizeWarning}
${DECORATIONS.footer}
        `.trim());

        await new Promise(resolve => setTimeout(resolve, 200));

        await sendMessage(senderId, `
🔗 𝗖𝗹𝗶𝗾𝘂𝗲 𝗶𝗰𝗶 𝗽𝗼𝘂𝗿 𝘁𝗲́𝗹𝗲́𝗰𝗵𝗮𝗿𝗴𝗲𝗿:
${pdfUrl}
        `.trim());

        await sendMessage(senderId, `
💡 Clique sur le lien ci-dessus
📱 Le PDF sera téléchargé sur ton téléphone

🔄 Tape "livre" pour voir d'autres livres
        `.trim());

    } catch (error) {
        console.error('Erreur téléchargement livre:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗿𝗿𝗲𝘂𝗿 𝗱𝗲 𝘁𝗲́𝗹𝗲́𝗰𝗵𝗮𝗿𝗴𝗲𝗺𝗲𝗻𝘁
${DECORATIONS.divider}
Impossible de récupérer le fichier.
Réessaie dans quelques instants.

🔗 Lien direct: ${book.url_pdf || 'Non disponible'}
        `.trim());
    }
}

async function showHelp(senderId) {
    await sendMessage(senderId, `
📚 𝗟𝗜𝗩𝗥𝗘 - 𝗚𝗨𝗜𝗗𝗘 𝗗'𝗨𝗧𝗜𝗟𝗜𝗦𝗔𝗧𝗜𝗢𝗡
${DECORATIONS.header}
Accède à une bibliothèque de livres
PDF gratuits à télécharger
${DECORATIONS.footer}

📖 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗘𝗦
${DECORATIONS.divider}
📌 livre
   ➜ Affiche les 5 premiers livres

📌 page 2 (ou page 3, page 4...)
   ➜ Va à la page spécifiée

📌 1, 2, 3... (numéro)
   ➜ Télécharge le livre correspondant

📥 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧
${DECORATIONS.divider}
◆ PDF < 25 Mo: envoyé en pièce jointe
◆ PDF > 25 Mo: lien de téléchargement
    `.trim());
}

module.exports = async (senderId, prompt) => {
    try {
        const userSession = userSessions.get(senderId) || {};
        const input = (typeof prompt === 'string') ? prompt.trim().toLowerCase() : '';

        if (/^\d+$/.test(input) && userSession.pageBooks && userSession.pageBooks.length > 0) {
            const index = parseInt(input) - 1;
            
            if (index >= 0 && index < userSession.pageBooks.length) {
                await handleDownload(senderId, userSession.pageBooks[index]);
            } else {
                await sendMessage(senderId, `
❌ 𝗡𝘂𝗺𝗲́𝗿𝗼 𝗶𝗻𝘃𝗮𝗹𝗶𝗱𝗲
${DECORATIONS.divider}
Choisis un numéro entre 1 et ${userSession.pageBooks.length}
                `.trim());
            }
            return;
        }

        const pageMatch = input.match(/^page\s*(\d+)$/);
        if (pageMatch && userSession.books && userSession.books.length > 0) {
            const pageNum = parseInt(pageMatch[1]);
            const totalPages = Math.ceil(userSession.books.length / BOOKS_PER_PAGE);
            
            if (pageNum >= 1 && pageNum <= totalPages) {
                await displayBooksPage(senderId, userSession.books, pageNum);
            } else {
                await sendMessage(senderId, `
❌ 𝗣𝗮𝗴𝗲 𝗶𝗻𝘃𝗮𝗹𝗶𝗱𝗲
${DECORATIONS.divider}
Choisis une page entre 1 et ${totalPages}
                `.trim());
            }
            return;
        }

        if (input === 'aide' || input === 'help') {
            await showHelp(senderId);
            return;
        }

        const loadingMsg = getRandomMessage(LOADING_MESSAGES);
        await sendMessage(senderId, `
⏳ ${loadingMsg}
📚 Veuillez patienter...
        `.trim());

        const books = await fetchBooks();
        
        if (books.length === 0) {
            await sendMessage(senderId, `
😔 𝗔𝗨𝗖𝗨𝗡 𝗟𝗜𝗩𝗥𝗘 𝗧𝗥𝗢𝗨𝗩𝗘́
${DECORATIONS.divider}
La bibliothèque est vide pour le moment.
Réessaie plus tard.
            `.trim());
            return;
        }

        await displayBooksPage(senderId, books, 1);

    } catch (error) {
        console.error('Erreur commande livre:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗿𝗿𝗲𝘂𝗿 𝗶𝗻𝗮𝘁𝘁𝗲𝗻𝗱𝘂𝗲
${DECORATIONS.divider}
Une erreur est survenue lors du traitement.
Réessaie dans quelques instants.

💡 Tape "livre aide" pour voir le guide.
        `.trim());
    }
};
