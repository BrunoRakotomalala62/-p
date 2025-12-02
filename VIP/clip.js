const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const API_BASE = 'https://clip-dai.onrender.com';
const MAX_DIRECT_SEND_SIZE = 25 * 1024 * 1024;
const MAX_RETRIES = 3;
const RETRY_DELAY = 3000;

const userSessions = new Map();

const QUALITY_OPTIONS = ['360p', '720p'];
const FORMAT_OPTIONS = ['MP3', 'MP4'];

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

module.exports = async (senderId, prompt, api) => {
    try {
        const userSession = userSessions.get(senderId) || {};
        const input = (typeof prompt === 'string') ? prompt.trim() : '';
        
        if (input && input.length > 0) {
            if (userSession.pendingFormat && userSession.selectedVideo && userSession.selectedQuality) {
                if (isFormatInput(input)) {
                    const format = normalizeFormat(input);
                    await handleVideoDownload(senderId, userSession.selectedVideo, userSession.selectedQuality, format);
                } else {
                    await sendMessage(senderId, `
❌ 𝗙𝗼𝗿𝗺𝗮𝘁 𝗶𝗻𝘃𝗮𝗹𝗶𝗱𝗲 ❌
━━━━━━━━━━━━━━━━━━━
Veuillez choisir un format valide :

🎵 MP3 - Audio uniquement
🎬 MP4 - Vidéo complète

💡 Tapez : MP3 ou MP4
                    `.trim());
                }
            } else if (userSession.pendingQuality && userSession.selectedVideo) {
                if (isQualityInput(input)) {
                    const quality = normalizeQuality(input);
                    
                    userSessions.set(senderId, {
                        ...userSession,
                        pendingQuality: false,
                        pendingFormat: true,
                        selectedQuality: quality
                    });
                    
                    await sendMessage(senderId, `
📊 𝗤𝘂𝗮𝗹𝗶𝘁𝗲́ 𝘀𝗲́𝗹𝗲𝗰𝘁𝗶𝗼𝗻𝗻𝗲́𝗲 : ${quality}
━━━━━━━━━━━━━━━━━━━

🎵 𝗤𝘂𝗲𝗹 𝘁𝘆𝗽𝗲 𝗠𝗣𝟯 𝗼𝘂 𝗠𝗣𝟰 ?
━━━━━━━━━━━━━━━━━━━

🎵 MP3 - Télécharger l'audio uniquement
🎬 MP4 - Télécharger la vidéo complète

💡 Envoyez : MP3 ou MP4
                    `.trim());
                } else {
                    await sendMessage(senderId, `
❌ 𝗤𝘂𝗮𝗹𝗶𝘁𝗲́ 𝗶𝗻𝘃𝗮𝗹𝗶𝗱𝗲 ❌
━━━━━━━━━━━━━━━━━━━
Veuillez choisir une qualité valide :

1. 360p (Recommandé)
2. 720p (HD)

💡 Exemple : 360p ou 720p
                    `.trim());
                }
            } else if (/^\d+$/.test(input) && userSession.videos && userSession.videos.length > 0) {
                const videoIndex = parseInt(input) - 1;
                
                if (videoIndex >= 0 && videoIndex < userSession.videos.length) {
                    const selectedVideo = userSession.videos[videoIndex];
                    
                    userSessions.set(senderId, {
                        ...userSession,
                        selectedVideo: selectedVideo,
                        pendingQuality: true,
                        pendingFormat: false,
                        selectedQuality: null
                    });
                    
                    await sendMessage(senderId, `
🎬 𝗩𝗜𝗗𝗘́𝗢 𝗦𝗘́𝗟𝗘𝗖𝗧𝗜𝗢𝗡𝗡𝗘́𝗘 🎬
━━━━━━━━━━━━━━━━━━━
📹 ${selectedVideo.Titre}

📊 𝗤𝘂𝗲𝗹𝗹𝗲 𝗾𝘂𝗮𝗹𝗶𝘁𝗲́ ?
━━━━━━━━━━━━━━━━━━━
1. 360p (Recommandé - ${selectedVideo.Taille_estimee?.['360p'] || 'N/A'})
2. 720p (HD - ${selectedVideo.Taille_estimee?.['720p'] || 'N/A'})

💡 Envoyez la qualité souhaitée
Exemple : 360p ou 720p

⚠️ Note : Les vidéos HD peuvent dépasser 25 MB
                    `.trim());
                } else {
                    await sendMessage(senderId, `
❌ 𝗡𝘂𝗺𝗲́𝗿𝗼 𝗶𝗻𝘃𝗮𝗹𝗶𝗱𝗲 ❌
━━━━━━━━━━━━━━━━━━━
Veuillez choisir un numéro entre 1 et ${userSession.videos.length}.
                    `.trim());
                }
            } else {
                await handleVideoSearch(senderId, input);
            }
        } else {
            await sendMessage(senderId, `
🎬 𝗖𝗟𝗜𝗣 𝗗𝗔𝗜𝗟𝗬𝗠𝗢𝗧𝗜𝗢𝗡 🎬
━━━━━━━━━━━━━━━━━━━
❌ Veuillez fournir un terme de recherche !

📝 𝗨𝘁𝗶𝗹𝗶𝘀𝗮𝘁𝗶𝗼𝗻 :
clip <terme de recherche>

💡 𝗘𝘅𝗲𝗺𝗽𝗹𝗲 :
clip Chantal

🔢 Après la recherche :
1. Envoyez le numéro de la vidéo
2. Choisissez la qualité (360p ou 720p)
3. Choisissez le format (MP3 ou MP4)
            `.trim());
        }

    } catch (error) {
        console.error('Erreur commande clip:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 ❌
━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite.
Veuillez réessayer plus tard. 🔧
        `.trim());
    }
};

async function handleVideoSearch(senderId, query) {
    try {
        await sendMessage(senderId, `🔍 Recherche de clips "${query}" en cours... ⏳`);
        
        const searchUrl = `${API_BASE}/recherche?clip=${encodeURIComponent(query)}`;
        console.log('Appel API Clip:', searchUrl);
        
        const response = await axiosWithRetry(searchUrl);
        
        console.log('Réponse API Clip reçue:', response.data ? 'OK' : 'Vide');
        
        if (response.data && response.data.resultats && response.data.resultats.length > 0) {
            const videos = response.data.resultats;
            const totalResults = response.data.total_resultats || videos.length;
            
            userSessions.set(senderId, {
                videos: videos,
                query: query,
                totalResults: totalResults,
                pendingQuality: false,
                pendingFormat: false,
                selectedVideo: null,
                selectedQuality: null
            });
            
            let headerText = `
🎬 𝗥𝗘́𝗦𝗨𝗟𝗧𝗔𝗧𝗦 𝗖𝗟𝗜𝗣 🎬
━━━━━━━━━━━━━━━━━━━
🔎 Recherche : ${query}
📊 Total : ${totalResults} clips trouvés
━━━━━━━━━━━━━━━━━━━
            `.trim();
            
            await sendMessage(senderId, headerText);
            
            const maxVideos = Math.min(videos.length, 10);
            
            for (let i = 0; i < maxVideos; i++) {
                const video = videos[i];
                const title = video.Titre.length > 80 ? video.Titre.substring(0, 77) + '...' : video.Titre;
                const duration = video.Duree || 'N/A';
                const size360 = video.Taille_estimee?.['360p'] || 'N/A';
                const size720 = video.Taille_estimee?.['720p'] || 'N/A';
                
                const videoInfo = `${i + 1}. ${title}
⏱️ Durée: ${duration}
📦 360p: ${size360} | 720p: ${size720}`;
                
                await sendMessage(senderId, videoInfo);
                
                if (video.Image_url) {
                    try {
                        await sendMessage(senderId, {
                            attachment: {
                                type: 'image',
                                payload: {
                                    url: video.Image_url,
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
📥 Envoyez le numéro (1-${maxVideos}) pour sélectionner

🔄 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝗲𝘀 :
• clip <numéro> - Sélectionner une vidéo
• clip <nouvelle recherche> - Nouvelle recherche
            `.trim();
            
            await sendMessage(senderId, footerText);

        } else {
            await sendMessage(senderId, `
❌ 𝗔𝘂𝗰𝘂𝗻 𝗿𝗲́𝘀𝘂𝗹𝘁𝗮𝘁 ❌
━━━━━━━━━━━━━━━━━━━
Aucun clip trouvé pour "${query}".
Veuillez essayer avec d'autres mots-clés. 🔍
            `.trim());
        }

    } catch (error) {
        console.error('Erreur recherche Clip:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 𝗗𝗘 𝗥𝗘𝗖𝗛𝗘𝗥𝗖𝗛𝗘 ❌
━━━━━━━━━━━━━━━━━━━
Impossible de contacter le serveur.
Erreur: ${error.message}
Veuillez réessayer plus tard. 🔧
        `.trim());
    }
}

async function handleVideoDownload(senderId, video, quality = '360p', format = 'MP4') {
    try {
        const userSession = userSessions.get(senderId) || {};
        
        userSessions.set(senderId, {
            ...userSession,
            pendingQuality: false,
            pendingFormat: false,
            selectedVideo: null,
            selectedQuality: null
        });
        
        const formatLabel = format === 'MP3' ? '🎵 Audio MP3' : '🎬 Vidéo MP4';
        
        await sendMessage(senderId, `
⏳ 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 𝗘𝗡 𝗖𝗢𝗨𝗥𝗦 ⏳
━━━━━━━━━━━━━━━━━━━
🎬 ${video.Titre.substring(0, 50)}...
📊 Qualité : ${quality}
📁 Format : ${formatLabel}
Préparation...
        `.trim());

        const videoUrl = video.Video_url;
        const downloadUrl = `${API_BASE}/download?video=${encodeURIComponent(videoUrl)}&type=${format}&qualite=${quality}`;
        
        console.log('URL de téléchargement Clip:', downloadUrl);
        
        if (format === 'MP3') {
            const audioSize = await getVideoSize(downloadUrl);
            const sizeMB = (audioSize / (1024 * 1024)).toFixed(2);
            
            console.log(`Taille audio MP3 (${quality}): ${sizeMB} MB`);
            
            const sizeInfo = audioSize > 0 ? `${sizeMB} MB` : 'En cours...';
            
            await sendMessage(senderId, `
📦 ${sizeInfo}
📤 Envoi de l'audio et du lien...
            `.trim());
            
            let audioSentSuccessfully = false;
            
            if (audioSize === 0 || audioSize < MAX_DIRECT_SEND_SIZE) {
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
                    audioSentSuccessfully = true;
                    console.log('Audio MP3 envoyé avec succès en pièce jointe');
                } catch (sendError) {
                    console.log('Erreur envoi direct de l\'audio:', sendError.message);
                    audioSentSuccessfully = false;
                }
            } else {
                console.log(`Audio trop volumineux (${sizeMB} MB), envoi en pièce jointe non possible`);
            }
            
            await sendMessage(senderId, `
${audioSentSuccessfully ? '✅ 𝗔𝗨𝗗𝗜𝗢 𝗠𝗣𝟯 𝗘𝗡𝗩𝗢𝗬𝗘́' : '📥 𝗟𝗜𝗘𝗡 𝗗𝗘 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧'}
━━━━━━━━━━━━━━━━━━━
🎬 ${video.Titre}
⏱️ Durée : ${video.Duree}
📊 Qualité : ${quality}
📁 Format : MP3 (Audio)
${audioSize > 0 ? `📦 Taille: ${sizeMB} MB` : ''}
${!audioSentSuccessfully && audioSize >= MAX_DIRECT_SEND_SIZE ? `⚠️ Audio > 25 MB, envoi direct impossible` : ''}

🔗 𝗟𝗶𝗲𝗻 𝗱𝗲 𝘁𝗲́𝗹𝗲́𝗰𝗵𝗮𝗿𝗴𝗲𝗺𝗲𝗻𝘁 :
            `.trim());
            
            await sendMessage(senderId, downloadUrl);
            
            await sendMessage(senderId, `
💡 ${audioSentSuccessfully ? 'Audio envoyé + lien de téléchargement ci-dessus' : 'Cliquez sur le lien pour télécharger'}

🔄 Tapez "clip" pour une nouvelle recherche
            `.trim());
            
        } else {
            const videoSize = await getVideoSize(downloadUrl);
            const sizeMB = (videoSize / (1024 * 1024)).toFixed(2);
            
            console.log(`Taille vidéo (${quality}): ${sizeMB} MB`);
            
            const sizeInfo = videoSize > 0 ? `${sizeMB} MB` : 'En cours...';
            
            await sendMessage(senderId, `
📦 ${sizeInfo}
📤 Envoi de la vidéo et du lien...
            `.trim());
            
            let videoSentSuccessfully = false;
            
            if (videoSize === 0 || videoSize < MAX_DIRECT_SEND_SIZE) {
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
                    videoSentSuccessfully = true;
                    console.log('Vidéo envoyée avec succès en pièce jointe');
                } catch (sendError) {
                    console.log('Erreur envoi direct de la vidéo:', sendError.message);
                    videoSentSuccessfully = false;
                }
            } else {
                console.log(`Vidéo trop volumineuse (${sizeMB} MB), envoi en pièce jointe non possible`);
            }
            
            await sendMessage(senderId, `
${videoSentSuccessfully ? '✅ 𝗩𝗜𝗗𝗘́𝗢 𝗘𝗡𝗩𝗢𝗬𝗘́𝗘' : '📥 𝗟𝗜𝗘𝗡 𝗗𝗘 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧'}
━━━━━━━━━━━━━━━━━━━
🎬 ${video.Titre}
⏱️ Durée : ${video.Duree}
📊 Qualité : ${quality}
📁 Format : MP4 (Vidéo)
${videoSize > 0 ? `📦 Taille: ${sizeMB} MB` : ''}
${!videoSentSuccessfully && videoSize >= MAX_DIRECT_SEND_SIZE ? `⚠️ Vidéo > 25 MB, envoi direct impossible` : ''}

🔗 𝗟𝗶𝗲𝗻 𝗱𝗲 𝘁𝗲́𝗹𝗲́𝗰𝗵𝗮𝗿𝗴𝗲𝗺𝗲𝗻𝘁 :
            `.trim());
            
            await sendMessage(senderId, downloadUrl);
            
            await sendMessage(senderId, `
💡 ${videoSentSuccessfully ? 'Vidéo envoyée + lien de téléchargement ci-dessus' : 'Cliquez sur le lien pour télécharger'}

🔄 Tapez "clip" pour une nouvelle recherche
            `.trim());
        }

    } catch (error) {
        console.error('Erreur téléchargement vidéo Clip:', error.message);
        
        await sendMessage(senderId, `
⚠️ 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 ⚠️
━━━━━━━━━━━━━━━━━━━
❌ Erreur: ${error.message}
📥 Veuillez réessayer plus tard.
        `.trim());
    }
}

module.exports.handleNumber = async (senderId, number) => {
    const userSession = userSessions.get(senderId);
    
    if (userSession && userSession.videos && userSession.videos.length > 0) {
        const videoIndex = number - 1;
        
        if (videoIndex >= 0 && videoIndex < userSession.videos.length) {
            const selectedVideo = userSession.videos[videoIndex];
            
            userSessions.set(senderId, {
                ...userSession,
                selectedVideo: selectedVideo,
                pendingQuality: true,
                pendingFormat: false,
                selectedQuality: null
            });
            
            await sendMessage(senderId, `
🎬 𝗩𝗜𝗗𝗘́𝗢 𝗦𝗘́𝗟𝗘𝗖𝗧𝗜𝗢𝗡𝗡𝗘́𝗘 🎬
━━━━━━━━━━━━━━━━━━━
📹 ${selectedVideo.Titre}

📊 𝗤𝘂𝗲𝗹𝗹𝗲 𝗾𝘂𝗮𝗹𝗶𝘁𝗲́ ?
━━━━━━━━━━━━━━━━━━━
1. 360p (Recommandé - ${selectedVideo.Taille_estimee?.['360p'] || 'N/A'})
2. 720p (HD - ${selectedVideo.Taille_estimee?.['720p'] || 'N/A'})

💡 Envoyez la qualité souhaitée
Exemple : 360p ou 720p

⚠️ Note : Les vidéos HD peuvent dépasser 25 MB
            `.trim());
            return true;
        }
    }
    return false;
};

module.exports.handleQuality = async (senderId, qualityInput) => {
    const userSession = userSessions.get(senderId);
    
    if (userSession && userSession.pendingQuality && userSession.selectedVideo) {
        if (isQualityInput(qualityInput)) {
            const quality = normalizeQuality(qualityInput);
            
            userSessions.set(senderId, {
                ...userSession,
                pendingQuality: false,
                pendingFormat: true,
                selectedQuality: quality
            });
            
            await sendMessage(senderId, `
📊 𝗤𝘂𝗮𝗹𝗶𝘁𝗲́ 𝘀𝗲́𝗹𝗲𝗰𝘁𝗶𝗼𝗻𝗻𝗲́𝗲 : ${quality}
━━━━━━━━━━━━━━━━━━━

🎵 𝗤𝘂𝗲𝗹 𝘁𝘆𝗽𝗲 𝗠𝗣𝟯 𝗼𝘂 𝗠𝗣𝟰 ?
━━━━━━━━━━━━━━━━━━━

🎵 MP3 - Télécharger l'audio uniquement
🎬 MP4 - Télécharger la vidéo complète

💡 Envoyez : MP3 ou MP4
            `.trim());
            return true;
        }
    }
    return false;
};

module.exports.handleFormat = async (senderId, formatInput) => {
    const userSession = userSessions.get(senderId);
    
    if (userSession && userSession.pendingFormat && userSession.selectedVideo && userSession.selectedQuality) {
        if (isFormatInput(formatInput)) {
            const format = normalizeFormat(formatInput);
            await handleVideoDownload(senderId, userSession.selectedVideo, userSession.selectedQuality, format);
            return true;
        }
    }
    return false;
};

module.exports.hasActiveSession = (senderId) => {
    const session = userSessions.get(senderId);
    return session && session.videos && session.videos.length > 0;
};

module.exports.hasPendingQuality = (senderId) => {
    const session = userSessions.get(senderId);
    return session && session.pendingQuality;
};

module.exports.hasPendingFormat = (senderId) => {
    const session = userSessions.get(senderId);
    return session && session.pendingFormat;
};

module.exports.clearSession = (senderId) => {
    userSessions.delete(senderId);
};

module.exports.info = {
    name: "clip",
    description: "Recherche et télécharge des clips Dailymotion (VIP uniquement). Envoyez 'clip <recherche>' pour chercher, puis répondez avec le numéro, la qualité et le format.",
    usage: "clip <terme de recherche> | Puis: numéro -> qualité (360p/720p) -> format (MP3/MP4)",
    author: "Bruno",
    isVIP: true
};
