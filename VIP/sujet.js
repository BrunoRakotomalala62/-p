const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const { Readable } = require('stream');
const sendMessage = require('../handles/sendMessage');

const PDF_DIR = path.join(__dirname, '..', 'pdf_exercice_bacc');

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
        const input = (typeof prompt === 'string') ? prompt.trim() : '';

        if (/^\d+$/.test(input) && userSession.files && userSession.files.length > 0) {
            const index = parseInt(input) - 1;
            
            if (index >= 0 && index < userSession.files.length) {
                await handleDownload(senderId, userSession.files[index]);
            } else {
                await sendMessage(senderId, `❌ Numéro invalide. Choisis entre 1 et ${userSession.files.length}`);
            }
            return;
        }

        if (!input) {
            await sendMessage(senderId, `📚 𝗦𝗨𝗝𝗘𝗧 - 𝗘𝘅𝗲𝗿𝗰𝗶𝗰𝗲𝘀 𝗕𝗮𝗰𝗰

Tape un mot-clé pour chercher un PDF.
Exemple: sujet math`);
            return;
        }

        const files = getPdfFiles();
        const searchResults = files.filter(file => 
            file.name.toLowerCase().includes(input.toLowerCase()) || 
            file.title.toLowerCase().includes(input.toLowerCase())
        );

        if (searchResults.length > 0) {
            userSessions.set(senderId, { files: searchResults });
            
            let message = `📚 𝗥𝗲́𝘀𝘂𝗹𝘁𝗮𝘁𝘀 𝗽𝗼𝘂𝗿 "${input}":\n\n`;
            
            for (let i = 0; i < searchResults.length; i++) {
                message += `${i + 1} - ${searchResults[i].title}\n`;
            }
            
            message += `\n📥 Envoie le numéro pour recevoir le PDF`;
            
            await sendMessage(senderId, message);
        } else {
            await sendMessage(senderId, `😔 Aucun PDF trouvé pour "${input}"`);
        }

    } catch (error) {
        console.error('Erreur commande sujet:', error.message);
        await sendMessage(senderId, `❌ Une erreur est survenue. Réessaie.`);
    }
};

async function handleDownload(senderId, file) {
    await sendMessage(senderId, `⏳ Envoi du PDF en cours...`);

    try {
        const buffer = fs.readFileSync(file.path);
        
        const result = await sendPdfToMessenger(senderId, buffer, file.name);
        
        if (result.success) {
            await sendMessage(senderId, `✅ PDF envoyé avec succès!\n📄 ${file.title}`);
        } else {
            console.log('Erreur envoi PDF:', result.error);
            await sendMessage(senderId, `❌ Impossible d'envoyer le PDF. Réessaie plus tard.`);
        }
        
    } catch (error) {
        console.error('Erreur téléchargement:', error.message);
        await sendMessage(senderId, `❌ Erreur lors de l'envoi du fichier.`);
    }
}
