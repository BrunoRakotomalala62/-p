const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const { Readable } = require('stream');
const sendMessage = require('../handles/sendMessage');

const PDF_DIR = path.join(__dirname, '..', 'pdf_exercice_bacc');

const DECORATIONS = {
    header: '╔══════════════════════════════╗',
    footer: '╚══════════════════════════════╝',
    divider: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    subDivider: '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈'
};

const userSessions = new Map();

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function getPdfFiles() {
    try {
        if (!fs.existsSync(PDF_DIR)) {
            fs.mkdirSync(PDF_DIR, { recursive: true });
            return [];
        }
        
        const files = fs.readdirSync(PDF_DIR)
            .filter(file => file.toLowerCase().endsWith('.pdf'))
            .map(file => {
                const filePath = path.join(PDF_DIR, file);
                const stats = fs.statSync(filePath);
                return {
                    name: file,
                    path: filePath,
                    size: stats.size,
                    title: file.replace('.pdf', '').replace(/_/g, ' ')
                };
            });
        
        return files;
    } catch (error) {
        console.error('Erreur lecture dossier PDF:', error.message);
        return [];
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

module.exports = async (senderId, prompt, api) => {
    try {
        const userSession = userSessions.get(senderId) || {};
        const input = (typeof prompt === 'string') ? prompt.trim().toLowerCase() : '';

        if (/^\d+$/.test(input) && userSession.files && userSession.files.length > 0) {
            const index = parseInt(input) - 1;
            
            if (index >= 0 && index < userSession.files.length) {
                await handleDownload(senderId, userSession.files[index]);
            } else {
                await sendMessage(senderId, `
❌ 𝗡𝘂𝗺𝗲́𝗿𝗼 𝗶𝗻𝘃𝗮𝗹𝗶𝗱𝗲
${DECORATIONS.divider}
Choisis un numéro entre 1 et ${userSession.files.length}
                `.trim());
            }
            return;
        }

        if (!input || input === 'help' || input === 'aide' || input === 'list' || input === 'liste') {
            await showPdfList(senderId);
            return;
        }

        const files = getPdfFiles();
        const searchResults = files.filter(file => 
            file.name.toLowerCase().includes(input) || 
            file.title.toLowerCase().includes(input)
        );

        if (searchResults.length > 0) {
            userSessions.set(senderId, { files: searchResults });
            await displayFiles(senderId, searchResults, input);
        } else {
            await sendMessage(senderId, `
😔 𝗔𝗨𝗖𝗨𝗡 𝗥𝗘́𝗦𝗨𝗟𝗧𝗔𝗧
${DECORATIONS.divider}
Aucun PDF trouvé pour: "${input}"

💡 Tape "sujet" pour voir tous les PDFs disponibles
            `.trim());
        }

    } catch (error) {
        console.error('Erreur commande sujet:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗿𝗿𝗲𝘂𝗿 𝗶𝗻𝗮𝘁𝘁𝗲𝗻𝗱𝘂𝗲
${DECORATIONS.divider}
Une erreur est survenue.
Réessaie dans quelques instants.
        `.trim());
    }
};

async function showPdfList(senderId) {
    const files = getPdfFiles();

    if (files.length === 0) {
        await sendMessage(senderId, `
📂 𝗦𝗨𝗝𝗘𝗧𝗦 𝗗'𝗘𝗫𝗘𝗥𝗖𝗜𝗖𝗘𝗦 𝗕𝗔𝗖𝗖
${DECORATIONS.header}
Aucun PDF disponible pour le moment.
${DECORATIONS.footer}
        `.trim());
        return;
    }

    userSessions.set(senderId, { files: files });
    await displayFiles(senderId, files, null);
}

async function displayFiles(senderId, files, searchQuery) {
    const header = `
📂 𝗦𝗨𝗝𝗘𝗧𝗦 𝗗'𝗘𝗫𝗘𝗥𝗖𝗜𝗖𝗘𝗦 𝗕𝗔𝗖𝗖
${DECORATIONS.header}
${searchQuery ? `🔍 Recherche: "${searchQuery}"` : '📚 Tous les PDFs disponibles'}
📊 Total: ${files.length} document(s)
${DECORATIONS.footer}`.trim();

    await sendMessage(senderId, header);
    await new Promise(resolve => setTimeout(resolve, 300));

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        const card = `
┏━━━━━━━━━━━━━━━━━━━━━
┃ ${i + 1}️⃣ 📄 PDF
┣━━━━━━━━━━━━━━━━━━━━━
┃ 📝 ${file.title}
┃ 📊 Taille: ${formatFileSize(file.size)}
┗━━━━━━━━━━━━━━━━━━━━━`.trim();

        await sendMessage(senderId, card);
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    const footer = `
${DECORATIONS.divider}
📥 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗥:
Envoie le numéro (1-${files.length}) pour télécharger
${DECORATIONS.subDivider}
🔍 Recherche: sujet <terme>`.trim();

    await sendMessage(senderId, footer);
}

async function handleDownload(senderId, file) {
    await sendMessage(senderId, `
⏳ 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 𝗘𝗡 𝗖𝗢𝗨𝗥𝗦
${DECORATIONS.divider}
📄 ${file.title}
📊 Taille: ${formatFileSize(file.size)}

⏳ Préparation du fichier PDF...
    `.trim());

    try {
        const buffer = fs.readFileSync(file.path);
        
        const result = await sendPdfToMessenger(senderId, buffer, file.name);
        
        if (result.success) {
            await sendMessage(senderId, `
✅ 𝗣𝗗𝗙 𝗘𝗡𝗩𝗢𝗬𝗘́ 𝗔𝗩𝗘𝗖 𝗦𝗨𝗖𝗖𝗘̀𝗦
${DECORATIONS.header}
📄 ${file.title}
📊 Taille: ${formatFileSize(file.size)}
${DECORATIONS.footer}

💡 Le PDF a été envoyé en pièce jointe
📱 Tu peux le sauvegarder sur ton téléphone

🔄 Tape "sujet" pour voir d'autres PDFs
            `.trim());
        } else {
            console.log('Erreur envoi PDF:', result.error);
            await sendMessage(senderId, `
❌ 𝗘𝗿𝗿𝗲𝘂𝗿 𝗱'𝗲𝗻𝘃𝗼𝗶
${DECORATIONS.divider}
Impossible d'envoyer le PDF.
Le fichier est peut-être trop volumineux.

🔄 Tape "sujet" pour réessayer
            `.trim());
        }
        
    } catch (error) {
        console.error('Erreur téléchargement:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗿𝗿𝗲𝘂𝗿 𝗱𝗲 𝘁𝗲́𝗹𝗲́𝗰𝗵𝗮𝗿𝗴𝗲𝗺𝗲𝗻𝘁
${DECORATIONS.divider}
Impossible de lire le fichier.
Réessaie dans quelques instants.
        `.trim());
    }
}
