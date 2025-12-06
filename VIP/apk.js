const axios = require('axios');
const FormData = require('form-data');
const { Readable } = require('stream');
const sendMessage = require('../handles/sendMessage');

const API_URL = 'https://tubidy-one.vercel.app/recherche';
const APPS_PER_PAGE = 5;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const userSessions = new Map();

const DECORATIONS = {
    header: '╔══════════════════════════════╗',
    footer: '╚══════════════════════════════╝',
    divider: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    subDivider: '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈',
    bullet: '◆',
    arrow: '➤',
    app: '📱',
    download: '📥',
    android: '🤖'
};

const LOADING_MESSAGES = [
    "Recherche des applications en cours...",
    "Exploration du Play Store...",
    "Récupération des APK...",
    "Fouille dans les applications..."
];

const DOWNLOAD_MESSAGES = [
    "C'est parti ! Téléchargement en cours...",
    "Préparation de l'APK...",
    "Je m'occupe de tout, patience...",
    "L'application arrive bientôt !"
];

function getRandomMessage(messages) {
    return messages[Math.floor(Math.random() * messages.length)];
}

function formatFileSize(sizeStr) {
    if (!sizeStr) return 'Taille inconnue';
    return sizeStr;
}

function parseSizeToBytes(sizeStr) {
    if (!sizeStr) return 0;
    const match = sizeStr.match(/([\d.]+)\s*(MB|KB|GB)/i);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    switch (unit) {
        case 'GB': return value * 1024 * 1024 * 1024;
        case 'MB': return value * 1024 * 1024;
        case 'KB': return value * 1024;
        default: return 0;
    }
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
        console.log('Téléchargement APK en mémoire:', url);
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'arraybuffer',
            timeout: 300000,
            maxRedirects: 5,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const buffer = Buffer.from(response.data);
        console.log(`APK téléchargé en mémoire: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB`);
        return { buffer, size: buffer.length };
    } catch (error) {
        console.error('Erreur téléchargement APK:', error.message);
        throw error;
    }
}

async function sendApkToMessenger(recipientId, buffer, filename) {
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
            contentType: 'application/vnd.android.package-archive'
        });

        const response = await axios.post(
            `https://graph.facebook.com/v16.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
            form,
            {
                headers: form.getHeaders(),
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: 300000
            }
        );

        console.log('APK envoyé via FormData:', response.data);
        return { success: true, data: response.data };
    } catch (error) {
        const errorData = error.response ? error.response.data : error.message;
        console.error('Erreur envoi APK:', errorData);
        return { success: false, error: errorData };
    }
}

async function searchApps(query) {
    try {
        const url = `${API_URL}?apk=${encodeURIComponent(query)}`;
        console.log('Recherche APK:', url);
        const response = await axios.get(url, { timeout: 30000 });
        if (response.data && response.data.resultats) {
            return response.data.resultats;
        }
        return [];
    } catch (error) {
        console.error('Erreur recherche APK:', error.message);
        throw error;
    }
}

async function displayAppsPage(senderId, apps, page, searchQuery) {
    const totalPages = Math.ceil(apps.length / APPS_PER_PAGE);
    const startIdx = (page - 1) * APPS_PER_PAGE;
    const pageApps = apps.slice(startIdx, startIdx + APPS_PER_PAGE);

    userSessions.set(senderId, {
        apps: apps,
        currentPage: page,
        pageApps: pageApps,
        searchQuery: searchQuery
    });

    const header = `
🤖 𝗔𝗣𝗣𝗟𝗜𝗖𝗔𝗧𝗜𝗢𝗡𝗦 𝗔𝗡𝗗𝗥𝗢𝗜𝗗
${DECORATIONS.header}
🔍 Recherche: "${searchQuery}"
📄 Page ${page}/${totalPages}
📊 Total: ${apps.length} application(s)
🎯 Affichage: ${startIdx + 1}-${startIdx + pageApps.length}
${DECORATIONS.footer}`.trim();

    await sendMessage(senderId, header);
    await new Promise(resolve => setTimeout(resolve, 300));

    for (let i = 0; i < pageApps.length; i++) {
        const app = pageApps[i];
        const appNumber = i + 1;

        const appCard = `
┏━━━━━━━━━━━━━━━━━━━━━
┃ ${appNumber}️⃣ 📱 𝗔𝗣𝗣𝗟𝗜𝗖𝗔𝗧𝗜𝗢𝗡
┣━━━━━━━━━━━━━━━━━━━━━
┃ 📝 ${app.nom || 'Sans nom'}
┃ 📦 Taille: ${formatFileSize(app.taille)}
┗━━━━━━━━━━━━━━━━━━━━━`.trim();

        await sendMessage(senderId, appCard);
        await new Promise(resolve => setTimeout(resolve, 200));

        if (app.image_url) {
            try {
                await sendMessage(senderId, {
                    attachment: {
                        type: 'image',
                        payload: {
                            url: app.image_url,
                            is_reusable: true
                        }
                    }
                });
            } catch (imgError) {
                console.log('Erreur envoi image app:', imgError.message);
            }
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }

    let footerParts = [];
    footerParts.push(`📥 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗥:`);
    footerParts.push(`Envoie le numéro (1-${pageApps.length}) pour télécharger`);
    
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
🔄 Nouvelle recherche: apk <nom_app>`.trim();

    await sendMessage(senderId, footer);
}

async function handleDownload(senderId, app) {
    const nom = app.nom || 'application';
    const downloadMsg = getRandomMessage(DOWNLOAD_MESSAGES);
    
    await sendMessage(senderId, `
⏳ 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 𝗘𝗡 𝗖𝗢𝗨𝗥𝗦
${DECORATIONS.divider}
📱 ${nom}
✨ ${downloadMsg}
    `.trim());

    try {
        const apkUrl = app.lien_apk;
        
        if (!apkUrl) {
            await sendMessage(senderId, `
❌ 𝗟𝗜𝗘𝗡 𝗡𝗢𝗡 𝗗𝗜𝗦𝗣𝗢𝗡𝗜𝗕𝗟𝗘
${DECORATIONS.divider}
Le lien de téléchargement n'est pas
disponible pour cette application.

🔄 Essaie avec une autre application.
            `.trim());
            return;
        }

        const sizeFromApi = parseSizeToBytes(app.taille);
        let fileSize = sizeFromApi;
        
        if (fileSize === 0) {
            fileSize = await getFileSize(apkUrl);
        }
        
        const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
        console.log(`Taille de l'APK: ${sizeMB} MB`);

        if (fileSize > 0 && fileSize < MAX_FILE_SIZE) {
            await sendMessage(senderId, `
📊 Taille: ${app.taille || sizeMB + ' MB'}
📥 Envoi de l'APK en pièce jointe...
⏳ Cela peut prendre quelques instants...
            `.trim());

            try {
                const { buffer } = await downloadToBuffer(apkUrl);
                const filename = `${nom.replace(/[^a-zA-Z0-9]/g, '_')}.apk`;
                
                const result = await sendApkToMessenger(senderId, buffer, filename);
                
                if (result.success) {
                    await sendMessage(senderId, `
✅ 𝗔𝗣𝗞 𝗘𝗡𝗩𝗢𝗬𝗘́ 𝗔𝗩𝗘𝗖 𝗦𝗨𝗖𝗖𝗘̀𝗦
${DECORATIONS.header}
📱 ${nom}
📊 Taille: ${app.taille || sizeMB + ' MB'}
${DECORATIONS.footer}

💡 L'APK a été envoyé en pièce jointe !
📲 Clique dessus pour télécharger
⚙️ Puis installe-le sur ton Android

🔄 Tape "apk <nom>" pour chercher d'autres apps
                    `.trim());
                    return;
                }
            } catch (downloadError) {
                console.log('Erreur envoi direct APK, envoi du lien:', downloadError.message);
            }
        }

        const sizeInfo = app.taille || (fileSize > 0 ? `${sizeMB} MB` : 'Taille inconnue');
        const sizeWarning = fileSize >= MAX_FILE_SIZE ? '\n⚠️ Fichier > 50 MB, envoi direct impossible' : '';
        
        await sendMessage(senderId, `
📥 𝗟𝗜𝗘𝗡 𝗗𝗘 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧
${DECORATIONS.header}
📱 ${nom}
📊 Taille: ${sizeInfo}${sizeWarning}
${DECORATIONS.footer}
        `.trim());

        await new Promise(resolve => setTimeout(resolve, 200));

        await sendMessage(senderId, `
🔗 𝗖𝗹𝗶𝗾𝘂𝗲 𝗶𝗰𝗶 𝗽𝗼𝘂𝗿 𝘁𝗲́𝗹𝗲́𝗰𝗵𝗮𝗿𝗴𝗲𝗿:
${apkUrl}
        `.trim());

        await sendMessage(senderId, `
💡 𝗜𝗡𝗦𝗧𝗥𝗨𝗖𝗧𝗜𝗢𝗡𝗦
${DECORATIONS.subDivider}
1️⃣ Clique sur le lien ci-dessus
2️⃣ L'APK sera téléchargé
3️⃣ Ouvre le fichier téléchargé
4️⃣ Autorise l'installation d'apps externes
5️⃣ Installe et profite !

🔄 Tape "apk <nom>" pour d'autres apps
        `.trim());

    } catch (error) {
        console.error('Erreur téléchargement APK:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗿𝗿𝗲𝘂𝗿 𝗱𝗲 𝘁𝗲́𝗹𝗲́𝗰𝗵𝗮𝗿𝗴𝗲𝗺𝗲𝗻𝘁
${DECORATIONS.divider}
Impossible de récupérer le fichier.
Réessaie dans quelques instants.

🔗 Lien direct: ${app.lien_apk || 'Non disponible'}
        `.trim());
    }
}

async function showHelp(senderId) {
    await sendMessage(senderId, `
📱 𝗔𝗣𝗞 - 𝗚𝗨𝗜𝗗𝗘 𝗗'𝗨𝗧𝗜𝗟𝗜𝗦𝗔𝗧𝗜𝗢𝗡
${DECORATIONS.header}
Télécharge des applications Android
gratuitement en format APK !
${DECORATIONS.footer}

📖 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗘𝗦
${DECORATIONS.divider}
📌 apk wifi
   ➜ Cherche les apps liées à "wifi"

📌 apk whatsapp
   ➜ Cherche WhatsApp

📌 page 2 (ou page 3, page 4...)
   ➜ Va à la page spécifiée

📌 1, 2, 3... (numéro)
   ➜ Télécharge l'app correspondante

📥 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧
${DECORATIONS.divider}
◆ APK < 50 Mo: envoyé en pièce jointe
◆ APK > 50 Mo: lien de téléchargement
    `.trim());
}

module.exports = async (senderId, prompt) => {
    try {
        const userSession = userSessions.get(senderId) || {};
        const input = (typeof prompt === 'string') ? prompt.trim() : '';
        const inputLower = input.toLowerCase();

        if (/^\d+$/.test(input) && userSession.pageApps && userSession.pageApps.length > 0) {
            const index = parseInt(input) - 1;
            
            if (index >= 0 && index < userSession.pageApps.length) {
                await handleDownload(senderId, userSession.pageApps[index]);
            } else {
                await sendMessage(senderId, `
❌ 𝗡𝘂𝗺𝗲́𝗿𝗼 𝗶𝗻𝘃𝗮𝗹𝗶𝗱𝗲
${DECORATIONS.divider}
Choisis un numéro entre 1 et ${userSession.pageApps.length}
                `.trim());
            }
            return;
        }

        const pageMatch = inputLower.match(/^page\s*(\d+)$/);
        if (pageMatch && userSession.apps && userSession.apps.length > 0) {
            const pageNum = parseInt(pageMatch[1]);
            const totalPages = Math.ceil(userSession.apps.length / APPS_PER_PAGE);
            
            if (pageNum >= 1 && pageNum <= totalPages) {
                await displayAppsPage(senderId, userSession.apps, pageNum, userSession.searchQuery);
            } else {
                await sendMessage(senderId, `
❌ 𝗣𝗮𝗴𝗲 𝗶𝗻𝘃𝗮𝗹𝗶𝗱𝗲
${DECORATIONS.divider}
Choisis une page entre 1 et ${totalPages}
                `.trim());
            }
            return;
        }

        if (inputLower === 'aide' || inputLower === 'help') {
            await showHelp(senderId);
            return;
        }

        if (!input || input === '') {
            await showHelp(senderId);
            return;
        }

        const loadingMsg = getRandomMessage(LOADING_MESSAGES);
        await sendMessage(senderId, `
⏳ ${loadingMsg}
🔍 Recherche: "${input}"
📱 Veuillez patienter...
        `.trim());

        const apps = await searchApps(input);
        
        if (apps.length === 0) {
            await sendMessage(senderId, `
😔 𝗔𝗨𝗖𝗨𝗡𝗘 𝗔𝗣𝗣𝗟𝗜𝗖𝗔𝗧𝗜𝗢𝗡 𝗧𝗥𝗢𝗨𝗩𝗘́𝗘
${DECORATIONS.divider}
Aucune application pour "${input}".
Réessaie avec un autre terme.

💡 𝗘𝘅𝗲𝗺𝗽𝗹𝗲𝘀:
• apk whatsapp
• apk wifi
• apk facebook
            `.trim());
            return;
        }

        await displayAppsPage(senderId, apps, 1, input);

    } catch (error) {
        console.error('Erreur commande apk:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗿𝗿𝗲𝘂𝗿 𝗶𝗻𝗮𝘁𝘁𝗲𝗻𝗱𝘂𝗲
${DECORATIONS.divider}
Une erreur est survenue lors du traitement.
Réessaie dans quelques instants.

💡 Tape "apk aide" pour voir le guide.
        `.trim());
    }
};
