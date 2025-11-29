const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const API_BASE = 'https://download-video-youtube-crib.onrender.com';
const MAX_DIRECT_SEND_SIZE = 25 * 1024 * 1024;
const MAX_RETRIES = 3;
const RETRY_DELAY = 3000;
const VIDEOS_PER_PAGE = 10;
const MAX_API_RESULTS = 50;

const userSessions = new Map();

const QUALITY_OPTIONS = ['360p', '720p', '1080p'];
const FORMAT_OPTIONS = ['MP3', 'MP4'];

const SEARCH_MESSAGES = [
    "Voici les pépites que j'ai dénichées pour toi",
    "J'ai trouvé ces merveilles musicales",
    "Découvre ces trésors YouTube",
    "Voilà ce que YouTube a de meilleur à t'offrir",
    "Ces résultats vont te plaire",
    "Mission accomplie ! Voici tes résultats"
];

const FORMAT_QUESTIONS = [
    "Tu préfères le son en MP3 ou la vidéo complète en MP4 ?",
    "Comment tu veux ton contenu ? MP3 (audio) ou MP4 (vidéo) ?",
    "Dis-moi : MP3 pour l'audio seul ou MP4 pour la vidéo ?",
    "MP3 pour écouter ou MP4 pour regarder ? À toi de choisir !",
    "Quel format te ferait plaisir ? MP3 ou MP4 ?"
];

const QUALITY_QUESTIONS = [
    "Quelle qualité tu veux ? Choisis entre 360p, 720p ou 1080p",
    "À quelle résolution ? 360p (légère), 720p (HD) ou 1080p (Full HD) ?",
    "Choisis ta qualité préférée : 360p, 720p ou 1080p",
    "Quelle définition pour ta vidéo ? 360p / 720p / 1080p",
    "Petite, moyenne ou grande qualité ? 360p, 720p, 1080p ?"
];

const DOWNLOAD_MESSAGES = [
    "C'est parti ! Je t'envoie ça tout de suite",
    "Préparation en cours... Ça arrive !",
    "Je m'occupe de tout, patience...",
    "Téléchargement lancé ! Reste connecté",
    "En route vers toi..."
];

function getRandomMessage(messages) {
    return messages[Math.floor(Math.random() * messages.length)];
}

function formatDuration(duration) {
    if (!duration) return 'N/A';
    if (typeof duration === 'string') return duration;
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatViews(views) {
    if (!views) return 'N/A';
    if (typeof views === 'string') return views;
    const numViews = parseInt(views.toString().replace(/[^0-9]/g, ''));
    if (isNaN(numViews)) return views;
    if (numViews >= 1000000) {
        return (numViews / 1000000).toFixed(1) + 'M vues';
    } else if (numViews >= 1000) {
        return (numViews / 1000).toFixed(1) + 'K vues';
    }
    return numViews + ' vues';
}

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

function isQualityInput(input) {
    const normalizedInput = input.toLowerCase().replace(/\s/g, '');
    return QUALITY_OPTIONS.some(q => q.toLowerCase() === normalizedInput);
}

function normalizeQuality(input) {
    const normalizedInput = input.toLowerCase().replace(/\s/g, '');
    const found = QUALITY_OPTIONS.find(q => q.toLowerCase() === normalizedInput);
    return found || '360p';
}

function isFormatInput(input) {
    const normalizedInput = input.toUpperCase().replace(/\s/g, '');
    return FORMAT_OPTIONS.includes(normalizedInput);
}

function normalizeFormat(input) {
    const normalizedInput = input.toUpperCase().replace(/\s/g, '');
    return FORMAT_OPTIONS.includes(normalizedInput) ? normalizedInput : 'MP4';
}

function getVideosForPage(allVideos, page) {
    const startIndex = (page - 1) * VIDEOS_PER_PAGE;
    const endIndex = startIndex + VIDEOS_PER_PAGE;
    return allVideos.slice(startIndex, endIndex);
}

function getTotalPages(totalVideos) {
    return Math.ceil(totalVideos / VIDEOS_PER_PAGE);
}

module.exports = async (senderId, prompt, api) => {
    try {
        const userSession = userSessions.get(senderId) || {};
        const input = (typeof prompt === 'string') ? prompt.trim() : '';
        
        if (input && input.length > 0) {
            if (userSession.pendingQuality && userSession.selectedVideo && userSession.selectedFormat) {
                if (isQualityInput(input)) {
                    const quality = normalizeQuality(input);
                    await handleVideoDownload(senderId, userSession.selectedVideo, quality, userSession.selectedFormat);
                } else {
                    await sendMessage(senderId, `
❌ 𝗤𝘂𝗮𝗹𝗶𝘁𝗲́ 𝗻𝗼𝗻 𝗿𝗲𝗰𝗼𝗻𝗻𝘂𝗲 ❌
━━━━━━━━━━━━━━━━━━━
Les qualités disponibles sont :

📺 360p - Légère et rapide
📺 720p - HD, bon compromis
📺 1080p - Full HD, meilleure qualité

💡 Tape juste : 360p, 720p ou 1080p
                    `.trim());
                }
            } else if (userSession.pendingFormat && userSession.selectedVideo) {
                if (isFormatInput(input)) {
                    const format = normalizeFormat(input);
                    
                    userSessions.set(senderId, {
                        ...userSession,
                        pendingFormat: false,
                        pendingQuality: true,
                        selectedFormat: format
                    });
                    
                    const qualityQuestion = getRandomMessage(QUALITY_QUESTIONS);
                    
                    await sendMessage(senderId, `
✅ 𝗙𝗼𝗿𝗺𝗮𝘁 ${format} 𝘀𝗲́𝗹𝗲𝗰𝘁𝗶𝗼𝗻𝗻𝗲́ !
━━━━━━━━━━━━━━━━━━━

📊 ${qualityQuestion}

📺 360p  ➜ Légère (~5-15 MB)
📺 720p  ➜ HD (~20-50 MB)  
📺 1080p ➜ Full HD (~50-100 MB)

💡 Envoie la qualité souhaitée
                    `.trim());
                } else {
                    await sendMessage(senderId, `
❌ 𝗙𝗼𝗿𝗺𝗮𝘁 𝗻𝗼𝗻 𝗿𝗲𝗰𝗼𝗻𝗻𝘂 ❌
━━━━━━━━━━━━━━━━━━━

🎵 MP3 - Pour écouter l'audio uniquement
🎬 MP4 - Pour regarder la vidéo complète

💡 Tape simplement : MP3 ou MP4
                    `.trim());
                }
            } else if (/^\d+$/.test(input) && userSession.allVideos && userSession.allVideos.length > 0) {
                const globalIndex = parseInt(input) - 1;
                const currentPage = userSession.currentPage || 1;
                const pageVideos = getVideosForPage(userSession.allVideos, currentPage);
                const localIndex = globalIndex;
                
                if (localIndex >= 0 && localIndex < pageVideos.length) {
                    const selectedVideo = pageVideos[localIndex];
                    
                    userSessions.set(senderId, {
                        ...userSession,
                        selectedVideo: selectedVideo,
                        pendingFormat: true,
                        pendingQuality: false,
                        selectedFormat: null
                    });
                    
                    const formatQuestion = getRandomMessage(FORMAT_QUESTIONS);
                    
                    await sendMessage(senderId, `
🎯 𝗩𝗜𝗗𝗘́𝗢 𝗦𝗘́𝗟𝗘𝗖𝗧𝗜𝗢𝗡𝗡𝗘́𝗘 🎯
━━━━━━━━━━━━━━━━━━━
📹 ${selectedVideo.titre || selectedVideo.title}

🎵 ${formatQuestion}

🎵 𝗠𝗣𝟯 ➜ Audio uniquement (musique)
🎬 𝗠𝗣𝟰 ➜ Vidéo complète

💡 Envoie : MP3 ou MP4
                    `.trim());
                } else {
                    const pageVideosCount = pageVideos.length;
                    await sendMessage(senderId, `
❌ 𝗡𝘂𝗺𝗲́𝗿𝗼 𝗵𝗼𝗿𝘀 𝗹𝗶𝗺𝗶𝘁𝗲 ❌
━━━━━━━━━━━━━━━━━━━
📄 Page actuelle : ${currentPage}
📊 Vidéos sur cette page : ${pageVideosCount}

Choisis un numéro entre 1 et ${pageVideosCount} 🔢
                    `.trim());
                }
            } else if (input.toLowerCase().startsWith('page ') || input.toLowerCase() === 'suivant' || input.toLowerCase() === 'precedent') {
                if (userSession.allVideos && userSession.allVideos.length > 0) {
                    let newPage;
                    const totalPages = getTotalPages(userSession.allVideos.length);
                    const currentPage = userSession.currentPage || 1;
                    
                    if (input.toLowerCase() === 'suivant') {
                        newPage = Math.min(currentPage + 1, totalPages);
                    } else if (input.toLowerCase() === 'precedent') {
                        newPage = Math.max(currentPage - 1, 1);
                    } else {
                        newPage = parseInt(input.replace(/^page\s+/i, ''));
                    }
                    
                    if (!isNaN(newPage) && newPage >= 1 && newPage <= totalPages) {
                        await displayPage(senderId, userSession.allVideos, newPage, userSession.query);
                    } else {
                        await sendMessage(senderId, `
❌ 𝗣𝗮𝗴𝗲 𝗶𝗻𝘃𝗮𝗹𝗶𝗱𝗲 ❌
━━━━━━━━━━━━━━━━━━━
📄 Pages disponibles : 1 à ${totalPages}
📍 Page actuelle : ${currentPage}

💡 Utilise : youtube page <numéro>
Exemple : youtube page 2
                        `.trim());
                    }
                } else {
                    await sendMessage(senderId, `
❌ 𝗔𝘂𝗰𝘂𝗻𝗲 𝗿𝗲𝗰𝗵𝗲𝗿𝗰𝗵𝗲 𝗮𝗰𝘁𝗶𝘃𝗲 ❌
━━━━━━━━━━━━━━━━━━━
Fais d'abord une recherche !

💡 Exemple : youtube Melky
                    `.trim());
                }
            } else {
                await handleVideoSearch(senderId, input);
            }
        } else {
            await sendMessage(senderId, `
🎬 𝗬𝗢𝗨𝗧𝗨𝗕𝗘 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥 🎬
━━━━━━━━━━━━━━━━━━━
Télécharge tes vidéos YouTube préférées !

📝 𝗖𝗼𝗺𝗺𝗲𝗻𝘁 𝘂𝘁𝗶𝗹𝗶𝘀𝗲𝗿 :
youtube <artiste ou titre>

💡 𝗘𝘅𝗲𝗺𝗽𝗹𝗲𝘀 :
• youtube Melky
• youtube Ambondrona 
• youtube Mix Gasy 2024

🔄 𝗘́𝘁𝗮𝗽𝗲𝘀 :
1️⃣ Cherche ta vidéo
2️⃣ Choisis le numéro
3️⃣ Sélectionne MP3 ou MP4
4️⃣ Choisis la qualité
5️⃣ Reçois ton fichier !

📄 𝗡𝗮𝘃𝗶𝗴𝗮𝘁𝗶𝗼𝗻 :
• youtube page 2 - Aller à la page 2
• suivant / precedent - Changer de page
            `.trim());
        }

    } catch (error) {
        console.error('Erreur commande youtube:', error.message);
        await sendMessage(senderId, `
❌ 𝗢𝗼𝗽𝘀 ! 𝗨𝗻𝗲 𝗲𝗿𝗿𝗲𝘂𝗿 𝗲𝘀𝘁 𝘀𝘂𝗿𝘃𝗲𝗻𝘂𝗲 ❌
━━━━━━━━━━━━━━━━━━━
Pas de panique ! Réessaie dans quelques instants.
Si le problème persiste, contacte l'admin. 🔧
        `.trim());
    }
};

async function handleVideoSearch(senderId, query) {
    try {
        await sendMessage(senderId, `
🔍 𝗥𝗲𝗰𝗵𝗲𝗿𝗰𝗵𝗲 𝗲𝗻 𝗰𝗼𝘂𝗿𝘀...
━━━━━━━━━━━━━━━━━━━
🎵 "${query}"
⏳ Patiente quelques secondes...
        `.trim());
        
        const searchUrl = `${API_BASE}/recherche?video=${encodeURIComponent(query)}&max_results=${MAX_API_RESULTS}`;
        console.log('Appel API YouTube:', searchUrl);
        
        const response = await axiosWithRetry(searchUrl);
        
        console.log('Réponse API reçue:', response.data ? 'OK' : 'Vide');
        
        if (response.data && response.data.videos && response.data.videos.length > 0) {
            const allVideos = response.data.videos;
            
            userSessions.set(senderId, {
                allVideos: allVideos,
                query: query,
                currentPage: 1,
                totalPages: getTotalPages(allVideos.length),
                pendingFormat: false,
                pendingQuality: false,
                selectedVideo: null,
                selectedFormat: null
            });
            
            await displayPage(senderId, allVideos, 1, query);

        } else {
            await sendMessage(senderId, `
😔 𝗔𝘂𝗰𝘂𝗻 𝗿𝗲́𝘀𝘂𝗹𝘁𝗮𝘁 𝘁𝗿𝗼𝘂𝘃𝗲́
━━━━━━━━━━━━━━━━━━━
Aucune vidéo pour "${query}" 😕

💡 𝗖𝗼𝗻𝘀𝗲𝗶𝗹𝘀 :
• Vérifie l'orthographe
• Essaie avec d'autres mots-clés
• Utilise le nom de l'artiste

🔄 Exemple : youtube Melky
            `.trim());
        }

    } catch (error) {
        console.error('Erreur recherche YouTube:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗿𝗿𝗲𝘂𝗿 𝗱𝗲 𝗿𝗲𝗰𝗵𝗲𝗿𝗰𝗵𝗲 ❌
━━━━━━━━━━━━━━━━━━━
Impossible de contacter YouTube.
Erreur: ${error.message}

🔄 Réessaie dans quelques instants !
        `.trim());
    }
}

async function displayPage(senderId, allVideos, page, query) {
    const totalPages = getTotalPages(allVideos.length);
    const pageVideos = getVideosForPage(allVideos, page);
    const startIndex = (page - 1) * VIDEOS_PER_PAGE;
    
    userSessions.set(senderId, {
        ...userSessions.get(senderId),
        currentPage: page
    });
    
    const searchMessage = getRandomMessage(SEARCH_MESSAGES);
    
    let headerText = `
🎬 𝗥𝗘́𝗦𝗨𝗟𝗧𝗔𝗧𝗦 𝗬𝗢𝗨𝗧𝗨𝗕𝗘 🎬
━━━━━━━━━━━━━━━━━━━
🔎 Recherche : "${query}"
✨ ${searchMessage} !

📄 𝗣𝗮𝗴𝗲 ${page}/${totalPages} 
📊 Total : ${allVideos.length} vidéo(s)
🎯 Affichage : ${startIndex + 1}-${startIndex + pageVideos.length}
━━━━━━━━━━━━━━━━━━━
    `.trim();
    
    await sendMessage(senderId, headerText);
    
    for (let i = 0; i < pageVideos.length; i++) {
        const video = pageVideos[i];
        const displayNum = i + 1;
        const title = (video.titre || video.title || 'Sans titre').length > 55 
            ? (video.titre || video.title || 'Sans titre').substring(0, 52) + '...' 
            : (video.titre || video.title || 'Sans titre');
        const duration = formatDuration(video.duree || video.duration);
        const views = formatViews(video.vues || video.views);
        const author = video.auteur || video.author || 'Inconnu';
        
        const videoInfo = `
┏━━━━━━━━━━━━━━━━━━━
┃ ${displayNum}️⃣ ${title}
┣━━━━━━━━━━━━━━━━━━━
┃ 👤 ${author}
┃ ⏱️ ${duration} │ 👁️ ${views}
┗━━━━━━━━━━━━━━━━━━━
        `.trim();
        
        await sendMessage(senderId, videoInfo);
        
        const imageUrl = video.miniature || video.thumbnail || video.image_url;
        if (imageUrl) {
            try {
                await sendMessage(senderId, {
                    attachment: {
                        type: 'image',
                        payload: {
                            url: imageUrl,
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
    
    let paginationText = '';
    if (totalPages > 1) {
        paginationText = `
━━━━━━━━━━━━━━━━━━━
📄 𝗡𝗮𝘃𝗶𝗴𝗮𝘁𝗶𝗼𝗻 :`;
        
        if (page > 1) {
            paginationText += `\n◀️ youtube page ${page - 1} (précédent)`;
        }
        if (page < totalPages) {
            paginationText += `\n▶️ youtube page ${page + 1} (suivant)`;
        }
        paginationText += `\n📍 Pages : 1 à ${totalPages}`;
    }
    
    let footerText = `
━━━━━━━━━━━━━━━━━━━
📥 𝗧𝗲́𝗹𝗲́𝗰𝗵𝗮𝗿𝗴𝗲𝗿 :
Envoie le numéro (1-${pageVideos.length})

🔄 𝗡𝗼𝘂𝘃𝗲𝗹𝗹𝗲 𝗿𝗲𝗰𝗵𝗲𝗿𝗰𝗵𝗲 :
youtube <nouveau terme>${paginationText}
    `.trim();
    
    await sendMessage(senderId, footerText);
}

async function handleVideoDownload(senderId, video, quality = '360p', format = 'MP4') {
    try {
        const userSession = userSessions.get(senderId) || {};
        
        userSessions.set(senderId, {
            ...userSession,
            pendingFormat: false,
            pendingQuality: false,
            selectedVideo: null,
            selectedFormat: null
        });
        
        const downloadMessage = getRandomMessage(DOWNLOAD_MESSAGES);
        const formatEmoji = format === 'MP3' ? '🎵' : '🎬';
        const formatLabel = format === 'MP3' ? 'Audio MP3' : 'Vidéo MP4';
        
        await sendMessage(senderId, `
⏳ 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 𝗘𝗡 𝗖𝗢𝗨𝗥𝗦 ⏳
━━━━━━━━━━━━━━━━━━━
📹 ${(video.titre || video.title || 'Vidéo').substring(0, 40)}...
${formatEmoji} Format : ${formatLabel}
📊 Qualité : ${quality}

✨ ${downloadMessage}
        `.trim());

        const videoUrl = video.lien || video.url || video.video_url || video.link;
        const downloadUrl = `${API_BASE}/download?video_url=${encodeURIComponent(videoUrl)}&qualite=${quality}&type=${format}`;
        
        console.log('URL de téléchargement YouTube:', downloadUrl);
        
        if (format === 'MP3') {
            await sendMessage(senderId, `
🎵 𝗧𝗢𝗡 𝗔𝗨𝗗𝗜𝗢 𝗘𝗦𝗧 𝗣𝗥𝗘̂𝗧 !
━━━━━━━━━━━━━━━━━━━
🎵 ${video.titre || video.title}
📊 Format : MP3 (Audio)

🔗 𝗟𝗶𝗲𝗻 𝗱𝗲 𝘁𝗲́𝗹𝗲́𝗰𝗵𝗮𝗿𝗴𝗲𝗺𝗲𝗻𝘁 :
            `.trim());
            
            await sendMessage(senderId, downloadUrl);
            
            await sendMessage(senderId, `
📤 𝗘𝗻𝘃𝗼𝗶 𝗱𝘂 𝗳𝗶𝗰𝗵𝗶𝗲𝗿 𝗲𝗻 𝗰𝗼𝘂𝗿𝘀...
⏳ L'audio arrive, patiente quelques instants !
            `.trim());
            
            try {
                await sendMessage(senderId, {
                    attachment: {
                        type: 'audio',
                        payload: {
                            url: downloadUrl,
                            is_reusable: true
                        }
                    }
                });
                console.log('Audio MP3 envoyé avec succès');
                
                await sendMessage(senderId, `
✅ 𝗔𝗨𝗗𝗜𝗢 𝗘𝗡𝗩𝗢𝗬𝗘́ !
━━━━━━━━━━━━━━━━━━━
Tu as reçu l'audio ci-dessus.

🔄 Tape "youtube" pour une nouvelle recherche
                `.trim());
            } catch (sendError) {
                console.log('Erreur envoi audio:', sendError.message);
                await sendMessage(senderId, `
⚠️ L'envoi direct a échoué.
💡 Utilise le lien ci-dessus pour télécharger !

🔄 Tape "youtube" pour une nouvelle recherche
                `.trim());
            }
            
        } else {
            await sendMessage(senderId, `
🎬 𝗧𝗔 𝗩𝗜𝗗𝗘́𝗢 𝗘𝗦𝗧 𝗣𝗥𝗘̂𝗧𝗘 !
━━━━━━━━━━━━━━━━━━━
🎬 ${video.titre || video.title}
📊 Qualité : ${quality}
📁 Format : MP4 (Vidéo)

🔗 𝗟𝗶𝗲𝗻 𝗱𝗲 𝘁𝗲́𝗹𝗲́𝗰𝗵𝗮𝗿𝗴𝗲𝗺𝗲𝗻𝘁 :
            `.trim());
            
            await sendMessage(senderId, downloadUrl);
            
            await sendMessage(senderId, `
📤 𝗘𝗻𝘃𝗼𝗶 𝗱𝘂 𝗳𝗶𝗰𝗵𝗶𝗲𝗿 𝗲𝗻 𝗰𝗼𝘂𝗿𝘀...
⏳ La vidéo arrive, patiente quelques instants !
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
                console.log('Vidéo MP4 envoyée avec succès');
                
                await sendMessage(senderId, `
✅ 𝗩𝗜𝗗𝗘́𝗢 𝗘𝗡𝗩𝗢𝗬𝗘́𝗘 !
━━━━━━━━━━━━━━━━━━━
Tu as reçu la vidéo ci-dessus.

🔄 Tape "youtube" pour une nouvelle recherche
                `.trim());
            } catch (sendError) {
                console.log('Erreur envoi vidéo:', sendError.message);
                await sendMessage(senderId, `
⚠️ L'envoi direct a échoué.
💡 Utilise le lien ci-dessus pour télécharger !

🔄 Tape "youtube" pour une nouvelle recherche
                `.trim());
            }
        }

    } catch (error) {
        console.error('Erreur téléchargement YouTube:', error.message);
        
        await sendMessage(senderId, `
⚠️ 𝗘𝗿𝗿𝗲𝘂𝗿 𝗱𝗲 𝘁𝗲́𝗹𝗲́𝗰𝗵𝗮𝗿𝗴𝗲𝗺𝗲𝗻𝘁 ⚠️
━━━━━━━━━━━━━━━━━━━
❌ ${error.message}

💡 Essaie avec une autre vidéo ou réessaie plus tard.
🔄 Tape "youtube" pour une nouvelle recherche
        `.trim());
    }
}

module.exports.handleNumber = async (senderId, number) => {
    const userSession = userSessions.get(senderId);
    
    if (userSession && userSession.allVideos && userSession.allVideos.length > 0) {
        const currentPage = userSession.currentPage || 1;
        const pageVideos = getVideosForPage(userSession.allVideos, currentPage);
        const localIndex = number - 1;
        
        if (localIndex >= 0 && localIndex < pageVideos.length) {
            const selectedVideo = pageVideos[localIndex];
            
            userSessions.set(senderId, {
                ...userSession,
                selectedVideo: selectedVideo,
                pendingFormat: true,
                pendingQuality: false,
                selectedFormat: null
            });
            
            const formatQuestion = getRandomMessage(FORMAT_QUESTIONS);
            
            await sendMessage(senderId, `
🎯 𝗩𝗜𝗗𝗘́𝗢 𝗦𝗘́𝗟𝗘𝗖𝗧𝗜𝗢𝗡𝗡𝗘́𝗘 🎯
━━━━━━━━━━━━━━━━━━━
📹 ${selectedVideo.titre || selectedVideo.title}

🎵 ${formatQuestion}

🎵 𝗠𝗣𝟯 ➜ Audio uniquement (musique)
🎬 𝗠𝗣𝟰 ➜ Vidéo complète

💡 Envoie : MP3 ou MP4
            `.trim());
            return true;
        }
    }
    return false;
};

module.exports.handleFormat = async (senderId, formatInput) => {
    const userSession = userSessions.get(senderId);
    
    if (userSession && userSession.pendingFormat && userSession.selectedVideo) {
        if (isFormatInput(formatInput)) {
            const format = normalizeFormat(formatInput);
            
            userSessions.set(senderId, {
                ...userSession,
                pendingFormat: false,
                pendingQuality: true,
                selectedFormat: format
            });
            
            const qualityQuestion = getRandomMessage(QUALITY_QUESTIONS);
            
            await sendMessage(senderId, `
✅ 𝗙𝗼𝗿𝗺𝗮𝘁 ${format} 𝘀𝗲́𝗹𝗲𝗰𝘁𝗶𝗼𝗻𝗻𝗲́ !
━━━━━━━━━━━━━━━━━━━

📊 ${qualityQuestion}

📺 360p  ➜ Légère (~5-15 MB)
📺 720p  ➜ HD (~20-50 MB)  
📺 1080p ➜ Full HD (~50-100 MB)

💡 Envoie la qualité souhaitée
            `.trim());
            return true;
        }
    }
    return false;
};

module.exports.handleQuality = async (senderId, qualityInput) => {
    const userSession = userSessions.get(senderId);
    
    if (userSession && userSession.pendingQuality && userSession.selectedVideo && userSession.selectedFormat) {
        if (isQualityInput(qualityInput)) {
            const quality = normalizeQuality(qualityInput);
            await handleVideoDownload(senderId, userSession.selectedVideo, quality, userSession.selectedFormat);
            return true;
        }
    }
    return false;
};

module.exports.hasActiveSession = (senderId) => {
    const session = userSessions.get(senderId);
    return session && (session.allVideos?.length > 0 || session.pendingFormat || session.pendingQuality);
};

module.exports.clearSession = (senderId) => {
    userSessions.delete(senderId);
};

module.exports.info = {
    name: "youtube",
    description: "Recherche et télécharge des vidéos YouTube en MP3 ou MP4 avec pagination. Utilise 'youtube <recherche>' pour chercher, 'youtube page X' pour naviguer.",
    usage: "youtube <artiste ou titre> | youtube page <numéro> | Puis choisis le numéro, le format (MP3/MP4) et la qualité (360p/720p/1080p)",
    author: "Bruno",
    isVIP: true
};
