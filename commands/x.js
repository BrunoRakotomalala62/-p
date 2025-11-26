const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const API_BASE = 'https://scraping-video.vercel.app';
const MAX_MESSAGE_LENGTH = 2000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 3000;
const MAX_DIRECT_SEND_SIZE = 24 * 1024 * 1024; // 24 Mo en bytes

const userSessions = new Map();

async function axiosWithRetry(url, options = {}, retries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios.get(url, {
                timeout: 60000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                ...options
            });
            return response;
        } catch (error) {
            console.log(`Tentative ${attempt}/${retries} échouée:`, error.message);
            
            if (attempt === retries) {
                throw error;
            }
            
            if (error.response && (error.response.status === 502 || error.response.status === 503 || error.response.status === 504)) {
                console.log(`Attente ${RETRY_DELAY}ms avant nouvelle tentative...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            } else {
                throw error;
            }
        }
    }
}

async function sendLongMessage(senderId, text, delay = 1000) {
    const chunks = splitMessage(text, MAX_MESSAGE_LENGTH);
    
    for (let i = 0; i < chunks.length; i++) {
        await sendMessage(senderId, chunks[i]);
        if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

function splitMessage(text, maxLength) {
    if (text.length <= maxLength) {
        return [text];
    }

    const chunks = [];
    let currentText = text;

    while (currentText.length > 0) {
        if (currentText.length <= maxLength) {
            chunks.push(currentText);
            break;
        }

        let splitIndex = maxLength;

        const lastNewline = currentText.lastIndexOf('\n', maxLength);
        if (lastNewline > maxLength * 0.5) {
            splitIndex = lastNewline;
        } else {
            const lastSpace = currentText.lastIndexOf(' ', maxLength);
            if (lastSpace > maxLength * 0.5) {
                splitIndex = lastSpace;
            } else {
                const lastPunctuation = Math.max(
                    currentText.lastIndexOf('.', maxLength),
                    currentText.lastIndexOf('!', maxLength),
                    currentText.lastIndexOf('?', maxLength),
                    currentText.lastIndexOf(',', maxLength)
                );
                if (lastPunctuation > maxLength * 0.5) {
                    splitIndex = lastPunctuation + 1;
                }
            }
        }

        chunks.push(currentText.substring(0, splitIndex).trim());
        currentText = currentText.substring(splitIndex).trim();
    }

    return chunks;
}

module.exports = async (senderId, prompt, api) => {
    try {
        const userSession = userSessions.get(senderId) || {};
        
        const input = (typeof prompt === 'string') ? prompt.trim() : '';
        
        if (input && input.length > 0) {
            if (/^\d+$/.test(input) && userSession.videos && userSession.videos.length > 0) {
                const videoIndex = parseInt(input) - 1;
                
                if (videoIndex >= 0 && videoIndex < userSession.videos.length) {
                    const selectedVideo = userSession.videos[videoIndex];
                    await handleVideoDownload(senderId, selectedVideo);
                } else {
                    await sendMessage(senderId, `
❌ 𝗡𝘂𝗺𝗲́𝗿𝗼 𝗶𝗻𝘃𝗮𝗹𝗶𝗱𝗲 ❌
━━━━━━━━━━━━━━━━━━━
Veuillez choisir un numéro entre 1 et ${userSession.videos.length}.
                    `.trim());
                }
            } else if (input.toLowerCase().startsWith('page ')) {
                const pageNum = parseInt(input.replace(/^page\s+/i, ''));
                if (!isNaN(pageNum) && pageNum > 0 && userSession.query) {
                    await handleVideoSearch(senderId, userSession.query, pageNum);
                } else {
                    await sendMessage(senderId, `
❌ 𝗡𝘂𝗺𝗲́𝗿𝗼 𝗱𝗲 𝗽𝗮𝗴𝗲 𝗶𝗻𝘃𝗮𝗹𝗶𝗱𝗲 ❌
━━━━━━━━━━━━━━━━━━━
Utilisez : x page <numéro>
Exemple : x page 2
                    `.trim());
                }
            } else {
                await handleVideoSearch(senderId, input);
            }
        } else {
            await sendMessage(senderId, `
🎬 𝗫 𝗩𝗜𝗗𝗘𝗢 𝗦𝗘𝗔𝗥𝗖𝗛 🎬
━━━━━━━━━━━━━━━━━━━
❌ Veuillez fournir un terme de recherche !

📝 𝗨𝘁𝗶𝗹𝗶𝘀𝗮𝘁𝗶𝗼𝗻 :
x <terme de recherche>

💡 𝗘𝘅𝗲𝗺𝗽𝗹𝗲 :
x action movie

🔢 Après la recherche, envoyez le numéro de la vidéo pour la télécharger.
            `.trim());
        }

    } catch (error) {
        console.error('Erreur commande x:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 ❌
━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite.
Veuillez réessayer plus tard. 🔧
        `.trim());
    }
};

async function handleVideoSearch(senderId, query, page = 1) {
    try {
        await sendMessage(senderId, `🔍 Recherche de "${query}" en cours... ⏳`);
        
        const searchUrl = `${API_BASE}/recherche?video=${encodeURIComponent(query)}&uid=${senderId}&page=${page}`;
        console.log('Appel API:', searchUrl);
        
        const response = await axiosWithRetry(searchUrl);
        
        console.log('Réponse API reçue:', response.data ? 'OK' : 'Vide');
        
        if (response.data && response.data.videos && response.data.videos.length > 0) {
            const videos = response.data.videos;
            const totalPages = response.data.total_pages || 1;
            const currentPage = response.data.page || 1;
            
            userSessions.set(senderId, {
                videos: videos,
                query: query,
                currentPage: currentPage,
                totalPages: totalPages
            });
            
            let headerText = `
🎬 𝗥𝗘́𝗦𝗨𝗟𝗧𝗔𝗧𝗦 𝗗𝗘 𝗥𝗘𝗖𝗛𝗘𝗥𝗖𝗛𝗘 🎬
━━━━━━━━━━━━━━━━━━━
🔎 Recherche : ${query}
📄 Page : ${currentPage}/${totalPages}
📊 Vidéos trouvées : ${videos.length}
━━━━━━━━━━━━━━━━━━━
            `.trim();
            
            await sendMessage(senderId, headerText);
            
            const maxVideos = Math.min(videos.length, 10);
            
            for (let i = 0; i < maxVideos; i++) {
                const video = videos[i];
                const title = video.titre.length > 80 ? video.titre.substring(0, 77) + '...' : video.titre;
                
                await sendMessage(senderId, `${i + 1}. ${title}`);
                
                if (video.image_url) {
                    try {
                        await sendMessage(senderId, {
                            attachment: {
                                type: 'image',
                                payload: {
                                    url: video.image_url,
                                    is_reusable: true
                                }
                            }
                        });
                    } catch (imgError) {
                        console.log(`Image ${i + 1} non disponible:`, imgError.message);
                    }
                }
                
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            let footerText = `
━━━━━━━━━━━━━━━━━━━
📥 Envoyez le numéro (1-${maxVideos}) pour télécharger

🔄 Commandes :
• x page <numéro> - Changer de page
• x <nouvelle recherche> - Nouvelle recherche
            `.trim();
            
            await sendMessage(senderId, footerText);

        } else {
            await sendMessage(senderId, `
❌ 𝗔𝘂𝗰𝘂𝗻 𝗿𝗲́𝘀𝘂𝗹𝘁𝗮𝘁 ❌
━━━━━━━━━━━━━━━━━━━
Aucune vidéo trouvée pour "${query}".
Veuillez essayer avec d'autres mots-clés. 🔍
            `.trim());
        }

    } catch (error) {
        console.error('Erreur recherche vidéo:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 𝗗𝗘 𝗥𝗘𝗖𝗛𝗘𝗥𝗖𝗛𝗘 ❌
━━━━━━━━━━━━━━━━━━━
Impossible de contacter le serveur.
Erreur: ${error.message}
Veuillez réessayer plus tard. 🔧
        `.trim());
    }
}

async function getVideoSize(url) {
    try {
        const response = await axios.head(url, {
            timeout: 30000,
            maxRedirects: 5
        });
        return parseInt(response.headers['content-length'] || '0');
    } catch (error) {
        console.log('Impossible de récupérer la taille:', error.message);
        return 0;
    }
}

function getBaseUrl() {
    if (process.env.REPLIT_DEV_DOMAIN) {
        return `https://${process.env.REPLIT_DEV_DOMAIN}`;
    }
    return `http://localhost:${process.env.PORT || 5000}`;
}

async function handleVideoDownload(senderId, video, quality = '360') {
    try {
        await sendMessage(senderId, `
⏳ 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 𝗘𝗡 𝗖𝗢𝗨𝗥𝗦 ⏳
━━━━━━━━━━━━━━━━━━━
🎬 ${video.titre.substring(0, 50)}...
📊 Qualité: ${quality}p
Vérification de la taille...
        `.trim());

        let slug = '';
        if (video.url_page) {
            const parts = video.url_page.split('/');
            slug = parts[parts.length - 1] || '';
        }
        
        const directApiUrl = `${API_BASE}/download/${video.id}?slug=${encodeURIComponent(slug)}&quality=${quality}`;
        const dynamicDownloadUrl = `${getBaseUrl()}/download/${video.id}?slug=${encodeURIComponent(slug)}&quality=${quality}`;
        
        console.log('URL API:', directApiUrl);
        console.log('URL dynamique:', dynamicDownloadUrl);
        
        if (quality === '360') {
            const videoSize = await getVideoSize(directApiUrl);
            const sizeMB = (videoSize / (1024 * 1024)).toFixed(2);
            
            console.log(`Taille vidéo 360p: ${sizeMB} MB`);
            
            if (videoSize > 0 && videoSize < MAX_DIRECT_SEND_SIZE) {
                await sendMessage(senderId, `
📦 Taille: ${sizeMB} MB (< 24 MB)
📤 Envoi direct de la vidéo...
                `.trim());
                
                try {
                    await sendMessage(senderId, {
                        attachment: {
                            type: 'video',
                            payload: {
                                url: directApiUrl,
                                is_reusable: true
                            }
                        }
                    });
                    
                    await sendMessage(senderId, `
✅ 𝗩𝗜𝗗𝗘́𝗢 𝗘𝗡𝗩𝗢𝗬𝗘́𝗘 ✅
━━━━━━━━━━━━━━━━━━━
🎬 ${video.titre}
📊 Qualité: ${quality}p
📦 Taille: ${sizeMB} MB

🔄 Tapez "x" pour une nouvelle recherche
                    `.trim());
                    return;
                } catch (sendError) {
                    console.log('Erreur envoi direct, utilisation du lien:', sendError.message);
                }
            } else {
                const sizeInfo = videoSize > 0 ? `${sizeMB} MB (> 24 MB)` : 'inconnue';
                await sendMessage(senderId, `
📦 Taille: ${sizeInfo}
📤 Envoi du lien de téléchargement...
                `.trim());
            }
        }
        
        await sendMessage(senderId, `
✅ 𝗩𝗜𝗗𝗘́𝗢 𝗣𝗥𝗘̂𝗧𝗘 ✅
━━━━━━━━━━━━━━━━━━━
🎬 ${video.titre}
📊 Qualité: ${quality}p

📥 Cliquez sur le lien ci-dessous pour télécharger :
        `.trim());
        
        await sendMessage(senderId, dynamicDownloadUrl);
        
        await sendMessage(senderId, `
💡 𝗜𝗡𝗦𝗧𝗥𝗨𝗖𝗧𝗜𝗢𝗡𝗦 :
1. Cliquez sur le lien
2. Attendez le chargement
3. La vidéo sera téléchargée automatiquement

🔄 Tapez "x" pour une nouvelle recherche
        `.trim());

    } catch (error) {
        console.error('Erreur téléchargement vidéo:', error.message);
        
        let slug = '';
        if (video.url_page) {
            const parts = video.url_page.split('/');
            slug = parts[parts.length - 1] || '';
        }
        
        const dynamicDownloadUrl = `${getBaseUrl()}/download/${video.id}?slug=${encodeURIComponent(slug)}&quality=360`;
        
        await sendMessage(senderId, `
⚠️ 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 ⚠️
━━━━━━━━━━━━━━━━━━━
📥 Téléchargez via ce lien :
${dynamicDownloadUrl}
        `.trim());
    }
}

module.exports.handleNumber = async (senderId, number) => {
    const userSession = userSessions.get(senderId);
    
    if (userSession && userSession.videos && userSession.videos.length > 0) {
        const videoIndex = number - 1;
        
        if (videoIndex >= 0 && videoIndex < userSession.videos.length) {
            const selectedVideo = userSession.videos[videoIndex];
            await handleVideoDownload(senderId, selectedVideo);
            return true;
        }
    }
    return false;
};

module.exports.hasActiveSession = (senderId) => {
    const session = userSessions.get(senderId);
    return session && session.videos && session.videos.length > 0;
};

module.exports.clearSession = (senderId) => {
    userSessions.delete(senderId);
};

module.exports.info = {
    name: "x",
    description: "Recherche et télécharge des vidéos. Envoyez 'x <recherche>' pour chercher, puis répondez avec le numéro pour télécharger.",
    usage: "x <terme de recherche> | Puis envoyez un numéro (1-10) pour télécharger",
    author: "Bruno"
};
