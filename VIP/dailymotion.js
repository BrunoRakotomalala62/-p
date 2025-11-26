const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const API_BASE = 'http://applemusic-beta.vercel.app';
const MAX_DIRECT_SEND_SIZE = 25 * 1024 * 1024;
const MAX_RETRIES = 3;
const RETRY_DELAY = 3000;

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
                    const totalPages = userSession.totalPages || 1;
                    if (pageNum <= totalPages) {
                        await handleVideoSearch(senderId, userSession.query, pageNum);
                    } else {
                        await sendMessage(senderId, `
❌ 𝗣𝗮𝗴𝗲 𝗶𝗻𝘃𝗮𝗹𝗶𝗱𝗲 ❌
━━━━━━━━━━━━━━━━━━━
La page ${pageNum} n'existe pas.
Pages disponibles : 1 à ${totalPages}
                        `.trim());
                    }
                } else if (!userSession.query) {
                    await sendMessage(senderId, `
❌ 𝗔𝘂𝗰𝘂𝗻𝗲 𝗿𝗲𝗰𝗵𝗲𝗿𝗰𝗵𝗲 𝗮𝗰𝘁𝗶𝘃𝗲 ❌
━━━━━━━━━━━━━━━━━━━
Veuillez d'abord effectuer une recherche.
Exemple : dailymotion Ambondrona saino
                    `.trim());
                } else {
                    await sendMessage(senderId, `
❌ 𝗡𝘂𝗺𝗲́𝗿𝗼 𝗱𝗲 𝗽𝗮𝗴𝗲 𝗶𝗻𝘃𝗮𝗹𝗶𝗱𝗲 ❌
━━━━━━━━━━━━━━━━━━━
Utilisez : dailymotion page <numéro>
Exemple : dailymotion page 2
                    `.trim());
                }
            } else {
                await handleVideoSearch(senderId, input, 1);
            }
        } else {
            await sendMessage(senderId, `
🎬 𝗗𝗔𝗜𝗟𝗬𝗠𝗢𝗧𝗜𝗢𝗡 𝗦𝗘𝗔𝗥𝗖𝗛 🎬
━━━━━━━━━━━━━━━━━━━
❌ Veuillez fournir un terme de recherche !

📝 𝗨𝘁𝗶𝗹𝗶𝘀𝗮𝘁𝗶𝗼𝗻 :
dailymotion <terme de recherche>

💡 𝗘𝘅𝗲𝗺𝗽𝗹𝗲 :
dailymotion Ambondrona saino

🔢 Après la recherche, envoyez le numéro de la vidéo pour la télécharger.

📄 𝗣𝗮𝗴𝗶𝗻𝗮𝘁𝗶𝗼𝗻 :
dailymotion page 2
            `.trim());
        }

    } catch (error) {
        console.error('Erreur commande dailymotion:', error.message);
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
        await sendMessage(senderId, `🔍 Recherche Dailymotion "${query}" (page ${page}) en cours... ⏳`);
        
        const searchUrl = `${API_BASE}/recherche?video=${encodeURIComponent(query)}&page=${page}`;
        console.log('Appel API Dailymotion:', searchUrl);
        
        const response = await axiosWithRetry(searchUrl);
        
        console.log('Réponse API reçue:', response.data ? 'OK' : 'Vide');
        
        if (response.data && response.data.videos && response.data.videos.length > 0) {
            const videos = response.data.videos;
            const pagination = response.data.pagination || {};
            const currentPage = pagination.page_actuelle || page;
            const totalPages = pagination.total_pages || 1;
            const totalResults = pagination.total_resultats || videos.length;
            const hasMore = pagination.a_plus_de_resultats || false;
            const qualites = response.data.qualites_disponibles || ['360p'];
            
            userSessions.set(senderId, {
                videos: videos,
                query: query,
                currentPage: currentPage,
                totalPages: totalPages,
                totalResults: totalResults,
                hasMore: hasMore,
                baseUrl: response.data.base_url || API_BASE,
                qualites: qualites
            });
            
            let headerText = `
🎬 𝗥𝗘́𝗦𝗨𝗟𝗧𝗔𝗧𝗦 𝗗𝗔𝗜𝗟𝗬𝗠𝗢𝗧𝗜𝗢𝗡 🎬
━━━━━━━━━━━━━━━━━━━
🔎 Recherche : ${query}
📄 Page : ${currentPage}/${totalPages}
📊 Total : ${totalResults} vidéos
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
            
            let paginationInfo = '';
            if (totalPages > 1) {
                paginationInfo = `\n📄 𝗣𝗮𝗴𝗶𝗻𝗮𝘁𝗶𝗼𝗻 :`;
                if (currentPage > 1) {
                    paginationInfo += `\n• dailymotion page ${currentPage - 1} - Page précédente`;
                }
                if (hasMore || currentPage < totalPages) {
                    paginationInfo += `\n• dailymotion page ${currentPage + 1} - Page suivante`;
                }
                paginationInfo += `\n• Pages disponibles : 1 à ${totalPages}`;
            }
            
            let footerText = `
━━━━━━━━━━━━━━━━━━━
📥 Envoyez le numéro (1-${maxVideos}) pour télécharger

🔄 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝗲𝘀 :
• dailymotion <numéro> - Télécharger
• dailymotion <nouvelle recherche> - Nouvelle recherche${paginationInfo}
            `.trim();
            
            await sendMessage(senderId, footerText);

        } else {
            await sendMessage(senderId, `
❌ 𝗔𝘂𝗰𝘂𝗻 𝗿𝗲́𝘀𝘂𝗹𝘁𝗮𝘁 ❌
━━━━━━━━━━━━━━━━━━━
Aucune vidéo trouvée pour "${query}" (page ${page}).
Veuillez essayer avec d'autres mots-clés ou une autre page. 🔍
            `.trim());
        }

    } catch (error) {
        console.error('Erreur recherche Dailymotion:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 𝗗𝗘 𝗥𝗘𝗖𝗛𝗘𝗥𝗖𝗛𝗘 ❌
━━━━━━━━━━━━━━━━━━━
Impossible de contacter le serveur.
Erreur: ${error.message}
Veuillez réessayer plus tard. 🔧
        `.trim());
    }
}

async function handleVideoDownload(senderId, video) {
    try {
        const userSession = userSessions.get(senderId) || {};
        const baseUrl = userSession.baseUrl || API_BASE;
        
        await sendMessage(senderId, `
⏳ 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 𝗘𝗡 𝗖𝗢𝗨𝗥𝗦 ⏳
━━━━━━━━━━━━━━━━━━━
🎬 ${video.titre.substring(0, 50)}...
Vérification de la taille...
        `.trim());

        const downloadUrl = video.download_url;
        
        console.log('URL de téléchargement:', downloadUrl);
        
        const videoSize = await getVideoSize(downloadUrl);
        const sizeMB = (videoSize / (1024 * 1024)).toFixed(2);
        
        console.log(`Taille vidéo: ${sizeMB} MB`);
        
        if (videoSize > 0 && videoSize < MAX_DIRECT_SEND_SIZE) {
            await sendMessage(senderId, `
📦 Taille: ${sizeMB} MB (< 25 MB)
📤 Envoi direct de la vidéo...
            `.trim());
            
            try {
                await sendMessage(senderId, {
                    attachment: {
                        type: 'video',
                        payload: {
                            url: downloadUrl,
                            is_reusable: true
                        }
                    }
                });
                
                await sendMessage(senderId, `
✅ 𝗩𝗜𝗗𝗘́𝗢 𝗘𝗡𝗩𝗢𝗬𝗘́𝗘 ✅
━━━━━━━━━━━━━━━━━━━
🎬 ${video.titre}
📦 Taille: ${sizeMB} MB

🔄 Tapez "dailymotion" pour une nouvelle recherche
                `.trim());
                return;
            } catch (sendError) {
                console.log('Erreur envoi direct, utilisation du lien:', sendError.message);
            }
        }
        
        const sizeInfo = videoSize > 0 ? `${sizeMB} MB (> 25 MB)` : 'inconnue';
        
        await sendMessage(senderId, `
📦 Taille: ${sizeInfo}
📤 Envoi du lien de téléchargement...
        `.trim());
        
        await sendMessage(senderId, `
✅ 𝗩𝗜𝗗𝗘́𝗢 𝗣𝗥𝗘̂𝗧𝗘 ✅
━━━━━━━━━━━━━━━━━━━
🎬 ${video.titre}

📥 Cliquez sur le lien ci-dessous pour télécharger :
        `.trim());
        
        await sendMessage(senderId, downloadUrl);
        
        await sendMessage(senderId, `
💡 𝗜𝗡𝗦𝗧𝗥𝗨𝗖𝗧𝗜𝗢𝗡𝗦 :
1. Cliquez sur le lien
2. Attendez le chargement
3. La vidéo sera téléchargée automatiquement sur votre téléphone

🔄 Tapez "dailymotion" pour une nouvelle recherche
        `.trim());

    } catch (error) {
        console.error('Erreur téléchargement vidéo:', error.message);
        
        await sendMessage(senderId, `
⚠️ 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 ⚠️
━━━━━━━━━━━━━━━━━━━
❌ Erreur: ${error.message}
📥 Essayez ce lien direct :
${video.download_url}
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
    name: "dailymotion",
    description: "Recherche et télécharge des vidéos Dailymotion (VIP uniquement). Envoyez 'dailymotion <recherche>' pour chercher, puis répondez avec le numéro pour télécharger. Supporte la pagination avec 'dailymotion page <numéro>'.",
    usage: "dailymotion <terme de recherche> | dailymotion page <numéro> | Puis envoyez un numéro (1-10) pour télécharger",
    author: "Bruno",
    isVIP: true
};
