const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sendMessage = require('../handles/sendMessage');

const API_BASE = 'https://mutual-terese-tekenespa-31ac883e.koyeb.app';
const MP3_API_BASE = 'https://norch-project.gleeze.com/api/ytmp3';
const MP4_API_BASE = 'https://norch-project.gleeze.com/api/ytdl';
const DEFAULT_VIDEO_QUALITY = '360';
const MAX_DIRECT_SEND_SIZE = 25 * 1024 * 1024;
const PART_SIZE = 25 * 1024 * 1024;
const MAX_RETRIES = 3;
const RETRY_DELAY = 3000;
const VIDEOS_PER_PAGE = 10;
const TEMP_DIR = '/tmp/youtube_downloads';

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const userSessions = new Map();

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

function sanitizeFilename(filename) {
    return filename.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
}

async function axiosWithRetry(url, options = {}, retries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios.get(url, {
                timeout: 120000,
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

async function downloadFile(url, outputPath) {
    const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: 300000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

function splitFile(inputPath, partSize) {
    const parts = [];
    const fileSize = fs.statSync(inputPath).size;
    const numParts = Math.ceil(fileSize / partSize);
    const buffer = fs.readFileSync(inputPath);
    
    for (let i = 0; i < numParts; i++) {
        const start = i * partSize;
        const end = Math.min(start + partSize, fileSize);
        const partBuffer = buffer.slice(start, end);
        const partPath = `${inputPath}.partie${i + 1}`;
        
        fs.writeFileSync(partPath, partBuffer);
        parts.push({
            path: partPath,
            size: end - start,
            partNumber: i + 1,
            totalParts: numParts
        });
    }
    
    return parts;
}

function cleanupFiles(files) {
    for (const file of files) {
        try {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        } catch (e) {
            console.log('Erreur nettoyage fichier:', e.message);
        }
    }
}

module.exports = async (senderId, prompt, api) => {
    try {
        const userSession = userSessions.get(senderId) || {};
        const input = (typeof prompt === 'string') ? prompt.trim() : '';
        
        if (input && input.length > 0) {
            if (userSession.pendingFormat && userSession.selectedVideo) {
                if (isFormatInput(input)) {
                    const format = normalizeFormat(input);
                    await handleVideoDownload(senderId, userSession.selectedVideo, format);
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
                        pendingFormat: true
                    });
                    
                    const formatQuestion = getRandomMessage(FORMAT_QUESTIONS);
                    
                    await sendMessage(senderId, `
🎯 𝗩𝗜𝗗𝗘́𝗢 𝗦𝗘́𝗟𝗘𝗖𝗧𝗜𝗢𝗡𝗡𝗘́𝗘 🎯
━━━━━━━━━━━━━━━━━━━
📹 ${selectedVideo.titre}

🎵 ${formatQuestion}

🎵 𝗠𝗣𝟯 ➜ Audio uniquement (${selectedVideo.taille_mp3})
🎬 𝗠𝗣𝟰 ➜ Vidéo complète (${selectedVideo.taille_mp4})

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
4️⃣ Reçois ton fichier !

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
        
        const searchUrl = `${API_BASE}/recherche?audio=${encodeURIComponent(query)}&limit=20`;
        console.log('Appel API YouTube:', searchUrl);
        
        const response = await axiosWithRetry(searchUrl);
        
        console.log('Réponse API reçue:', response.data ? 'OK' : 'Vide');
        
        if (response.data && response.data.resultats && response.data.resultats.length > 0) {
            const allVideos = response.data.resultats;
            
            userSessions.set(senderId, {
                allVideos: allVideos,
                query: query,
                currentPage: 1,
                totalPages: getTotalPages(allVideos.length),
                pendingFormat: false,
                selectedVideo: null
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
Impossible de contacter l'API.
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
        const title = (video.titre || 'Sans titre').length > 55 
            ? (video.titre || 'Sans titre').substring(0, 52) + '...' 
            : (video.titre || 'Sans titre');
        const duration = video.duree || 'N/A';
        const sizeMp3 = video.taille_mp3 || 'N/A';
        const sizeMp4 = video.taille_mp4 || 'N/A';
        
        const videoInfo = `
┏━━━━━━━━━━━━━━━━━━━
┃ ${displayNum}️⃣ ${title}
┣━━━━━━━━━━━━━━━━━━━
┃ ⏱️ Durée : ${duration}
┃ 🎵 MP3 : ${sizeMp3}
┃ 🎬 MP4 : ${sizeMp4}
┗━━━━━━━━━━━━━━━━━━━
        `.trim();
        
        await sendMessage(senderId, videoInfo);
        
        const imageUrl = video.image_url;
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

async function handleVideoDownload(senderId, video, format) {
    const filesToCleanup = [];
    
    try {
        const userSession = userSessions.get(senderId) || {};
        
        userSessions.set(senderId, {
            ...userSession,
            pendingFormat: false,
            selectedVideo: null
        });
        
        const downloadMessage = getRandomMessage(DOWNLOAD_MESSAGES);
        const formatEmoji = format === 'MP3' ? '🎵' : '🎬';
        const formatLabel = format === 'MP3' ? 'Audio MP3' : 'Vidéo MP4';
        const sizeInfo = format === 'MP3' ? video.taille_mp3 : video.taille_mp4;
        
        await sendMessage(senderId, `
⏳ 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 𝗘𝗡 𝗖𝗢𝗨𝗥𝗦 ⏳
━━━━━━━━━━━━━━━━━━━
📹 ${(video.titre || 'Vidéo').substring(0, 40)}...
${formatEmoji} Format : ${formatLabel}
📦 Taille estimée : ${sizeInfo}

✨ ${downloadMessage}
⏳ Récupération du fichier...
        `.trim());

        const videoId = video.video_id;
        const extension = format === 'MP3' ? 'mp3' : 'mp4';
        const safeTitle = sanitizeFilename(video.titre || videoId);
        
        let directDownloadUrl = '';
        let mp3Title = '';
        let mp3Duration = '';
        let mp3Cover = '';
        
        if (format === 'MP3') {
            const youtubeUrl = `https://youtu.be/${videoId}`;
            const mp3ApiUrl = `${MP3_API_BASE}?url=${encodeURIComponent(youtubeUrl)}`;
            
            console.log('Appel API MP3:', mp3ApiUrl);
            
            await sendMessage(senderId, `
🔄 Connexion à l'API de téléchargement...
⏳ Veuillez patienter...
            `.trim());
            
            const mp3Response = await axiosWithRetry(mp3ApiUrl);
            
            if (mp3Response.data && mp3Response.data.success && mp3Response.data.result) {
                const result = mp3Response.data.result;
                directDownloadUrl = result.downloadUrl;
                mp3Title = result.title || video.titre;
                mp3Duration = result.duration || video.duree;
                mp3Cover = result.cover || '';
                
                console.log('API MP3 réponse:', {
                    title: mp3Title,
                    duration: mp3Duration,
                    downloadUrl: directDownloadUrl
                });
                
                await sendMessage(senderId, `
✅ Lien de téléchargement récupéré !
🎵 ${mp3Title}
⏱️ Durée : ${mp3Duration}
📤 Envoi du fichier audio...
                `.trim());
                
                if (mp3Cover) {
                    try {
                        await sendMessage(senderId, {
                            attachment: {
                                type: 'image',
                                payload: {
                                    url: mp3Cover,
                                    is_reusable: true
                                }
                            }
                        });
                    } catch (coverError) {
                        console.log('Erreur envoi cover:', coverError.message);
                    }
                }
                
                let fileSentSuccessfully = false;
                try {
                    await sendMessage(senderId, {
                        attachment: {
                            type: 'audio',
                            payload: {
                                url: directDownloadUrl,
                                is_reusable: true
                            }
                        }
                    });
                    fileSentSuccessfully = true;
                    console.log('MP3 envoyé avec succès en pièce jointe');
                } catch (sendError) {
                    console.log('Erreur envoi audio:', sendError.message);
                }
                
                await sendMessage(senderId, `
${fileSentSuccessfully ? '✅' : '⚠️'} 𝗙𝗜𝗖𝗛𝗜𝗘𝗥 𝗠𝗣𝟯 ${fileSentSuccessfully ? '𝗘𝗡𝗩𝗢𝗬𝗘́' : ''}
━━━━━━━━━━━━━━━━━━━
🎵 ${mp3Title}
⏱️ Durée : ${mp3Duration}
📊 Format : MP3 (128 kbps)

${fileSentSuccessfully ? '✅ Fichier audio envoyé ci-dessus !' : '⚠️ Envoi direct impossible'}

📲 𝗟𝗶𝗲𝗻 𝗱𝗲 𝘁𝗲́𝗹𝗲́𝗰𝗵𝗮𝗿𝗴𝗲𝗺𝗲𝗻𝘁 𝗱𝗶𝗿𝗲𝗰𝘁 :
${directDownloadUrl}

💡 Clique sur le lien pour télécharger directement sur ton téléphone !

🔄 Tape "youtube" pour une nouvelle recherche
                `.trim());
                
            } else {
                throw new Error('Réponse API MP3 invalide ou téléchargement échoué');
            }
            
        } else {
            const youtubeUrl = `https://youtu.be/${videoId}`;
            const mp4ApiUrl = `${MP4_API_BASE}?url=${encodeURIComponent(youtubeUrl)}&format=${DEFAULT_VIDEO_QUALITY}`;
            
            console.log('Appel API MP4:', mp4ApiUrl);
            
            await sendMessage(senderId, `
🔄 Connexion à l'API de téléchargement vidéo...
📺 Qualité : ${DEFAULT_VIDEO_QUALITY}p
⏳ Veuillez patienter...
            `.trim());
            
            const mp4Response = await axiosWithRetry(mp4ApiUrl);
            
            if (mp4Response.data && mp4Response.data.success && mp4Response.data.result) {
                const result = mp4Response.data.result;
                const mp4DownloadUrl = result.downloadUrl;
                const mp4Title = result.title || video.titre;
                const mp4Duration = result.duration || video.duree;
                const mp4Cover = result.cover || '';
                const mp4Quality = result.quality || DEFAULT_VIDEO_QUALITY;
                
                console.log('API MP4 réponse:', {
                    title: mp4Title,
                    duration: mp4Duration,
                    quality: mp4Quality,
                    downloadUrl: mp4DownloadUrl
                });
                
                await sendMessage(senderId, `
✅ Lien de téléchargement récupéré !
🎬 ${mp4Title}
⏱️ Durée : ${mp4Duration}
📺 Qualité : ${mp4Quality}p
📤 Envoi de la vidéo...
                `.trim());
                
                if (mp4Cover) {
                    try {
                        await sendMessage(senderId, {
                            attachment: {
                                type: 'image',
                                payload: {
                                    url: mp4Cover,
                                    is_reusable: true
                                }
                            }
                        });
                    } catch (coverError) {
                        console.log('Erreur envoi cover vidéo:', coverError.message);
                    }
                }
                
                let fileSentSuccessfully = false;
                try {
                    await sendMessage(senderId, {
                        attachment: {
                            type: 'video',
                            payload: {
                                url: mp4DownloadUrl,
                                is_reusable: true
                            }
                        }
                    });
                    fileSentSuccessfully = true;
                    console.log('MP4 envoyé avec succès en pièce jointe');
                } catch (sendError) {
                    console.log('Erreur envoi vidéo:', sendError.message);
                }
                
                await sendMessage(senderId, `
${fileSentSuccessfully ? '✅' : '⚠️'} 𝗙𝗜𝗖𝗛𝗜𝗘𝗥 𝗠𝗣𝟰 ${fileSentSuccessfully ? '𝗘𝗡𝗩𝗢𝗬𝗘́' : ''}
━━━━━━━━━━━━━━━━━━━
🎬 ${mp4Title}
⏱️ Durée : ${mp4Duration}
📺 Qualité : ${mp4Quality}p

${fileSentSuccessfully ? '✅ Fichier vidéo envoyé ci-dessus !' : '⚠️ Envoi direct impossible'}

📲 𝗟𝗶𝗲𝗻 𝗱𝗲 𝘁𝗲́𝗹𝗲́𝗰𝗵𝗮𝗿𝗴𝗲𝗺𝗲𝗻𝘁 𝗱𝗶𝗿𝗲𝗰𝘁 :
${mp4DownloadUrl}

💡 Clique sur le lien pour télécharger directement sur ton téléphone !

🔄 Tape "youtube" pour une nouvelle recherche
                `.trim());
                
            } else {
                throw new Error('Réponse API MP4 invalide ou téléchargement échoué');
            }
        }

    } catch (error) {
        console.error('Erreur téléchargement:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗿𝗿𝗲𝘂𝗿 𝗱𝗲 𝘁𝗲́𝗹𝗲́𝗰𝗵𝗮𝗿𝗴𝗲𝗺𝗲𝗻𝘁 ❌
━━━━━━━━━━━━━━━━━━━
Impossible de télécharger cette vidéo.
Erreur: ${error.message}

🔄 Réessaie ou choisis une autre vidéo !
        `.trim());
    } finally {
        cleanupFiles(filesToCleanup);
    }
}
