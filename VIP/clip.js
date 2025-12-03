const axios = require('axios');
const FormData = require('form-data');
const { Readable } = require('stream');
const sendMessage = require('../handles/sendMessage');

const API_BASE = 'https://clip-dai.onrender.com';
const MAX_RETRIES = 3;
const RETRY_DELAY = 3000;

async function downloadToBuffer(url) {
    try {
        console.log('Téléchargement en mémoire:', url);
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
        console.log(`Fichier téléchargé en mémoire: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB`);
        return { buffer, size: buffer.length };
    } catch (error) {
        console.error('Erreur téléchargement en mémoire:', error.message);
        throw error;
    }
}

async function sendBufferToMessenger(recipientId, buffer, fileType, filename) {
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
                type: fileType,
                payload: {
                    is_reusable: false
                }
            }
        }));
        form.append('filedata', stream, {
            filename: filename,
            contentType: fileType === 'audio' ? 'audio/mpeg' : 'video/mp4'
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

        console.log('Fichier envoyé via FormData:', response.data);
        return { success: true, data: response.data };
    } catch (error) {
        const errorData = error.response ? error.response.data : error.message;
        console.error('Erreur envoi FormData:', errorData);
        return { success: false, error: errorData };
    }
}

const userSessions = new Map();

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

function formatDuration(duration) {
    if (!duration) return 'Durée inconnue';
    if (typeof duration === 'string') {
        if (duration.includes(':')) return duration;
        const seconds = parseInt(duration);
        if (isNaN(seconds)) return duration;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    if (typeof duration === 'number') {
        const mins = Math.floor(duration / 60);
        const secs = Math.floor(duration % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return 'Durée inconnue';
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
        if (prompt === 'RESET_CONVERSATION') {
            userSessions.delete(senderId);
            return;
        }
        
        const userSession = userSessions.get(senderId) || {};
        const input = (typeof prompt === 'string') ? prompt.trim() : '';
        
        if (input && input.length > 0) {
            if (userSession.pendingFormat && userSession.selectedClip) {
                if (isFormatInput(input)) {
                    const format = normalizeFormat(input);
                    await handleClipDownload(senderId, userSession.selectedClip, format);
                } else {
                    await sendMessage(senderId, `
❌ 𝗙𝗼𝗿𝗺𝗮𝘁 𝗶𝗻𝘃𝗮𝗹𝗶𝗱𝗲 ❌
━━━━━━━━━━━━━━━━━━━
Veuillez choisir un format valide :

🎵 MP3 - Audio uniquement
🎬 MP4 - Vidéo complète

💡 Tapez simplement : MP3 ou MP4
                    `.trim());
                }
            } else if (/^\d+$/.test(input) && userSession.clips && userSession.clips.length > 0) {
                const clipIndex = parseInt(input) - 1;
                
                if (clipIndex >= 0 && clipIndex < userSession.clips.length) {
                    const selectedClip = userSession.clips[clipIndex];
                    
                    userSessions.set(senderId, {
                        ...userSession,
                        selectedClip: selectedClip,
                        pendingFormat: true
                    });
                    
                    await sendMessage(senderId, `
🎬 𝗖𝗟𝗜𝗣 𝗦𝗘́𝗟𝗘𝗖𝗧𝗜𝗢𝗡𝗡𝗘́ 🎬
━━━━━━━━━━━━━━━━━━━
📹 ${selectedClip.Titre || selectedClip.titre || selectedClip.title || 'Clip sélectionné'}
⏱️ Durée : ${formatDuration(selectedClip.Duree || selectedClip.duree || selectedClip.duration)}

🎵 𝗤𝘂𝗲𝗹 𝘁𝘆𝗽𝗲 𝘀𝗼𝘂𝗵𝗮𝗶𝘁𝗲𝘇-𝘃𝗼𝘂𝘀 ?
━━━━━━━━━━━━━━━━━━━

🎵 MP3 - Télécharger l'audio uniquement
🎬 MP4 - Télécharger la vidéo complète

💡 Envoyez : MP3 ou MP4
                    `.trim());
                } else {
                    await sendMessage(senderId, `
❌ 𝗡𝘂𝗺𝗲́𝗿𝗼 𝗶𝗻𝘃𝗮𝗹𝗶𝗱𝗲 ❌
━━━━━━━━━━━━━━━━━━━
Veuillez choisir un numéro entre 1 et ${userSession.clips.length}.
                    `.trim());
                }
            } else {
                await handleClipSearch(senderId, input);
            }
        } else {
            await sendMessage(senderId, `
🎬 𝗖𝗟𝗜𝗣 𝗗𝗔𝗜𝗟𝗬𝗠𝗢𝗧𝗜𝗢𝗡 🎬
━━━━━━━━━━━━━━━━━━━
Recherchez et téléchargez des clips Dailymotion !

📝 𝗨𝘁𝗶𝗹𝗶𝘀𝗮𝘁𝗶𝗼𝗻 :
clip <terme de recherche>

💡 𝗘𝘅𝗲𝗺𝗽𝗹𝗲 :
clip Naël clip
clip Odyai

🔢 𝗘́𝘁𝗮𝗽𝗲𝘀 :
1️⃣ Recherchez un clip
2️⃣ Envoyez le numéro du clip
3️⃣ Choisissez MP3 ou MP4
4️⃣ Recevez votre fichier !
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

async function handleClipSearch(senderId, query) {
    try {
        await sendMessage(senderId, `🔍 Recherche de "${query}" en cours... ⏳`);
        
        const searchUrl = `${API_BASE}/recherche?clip=${encodeURIComponent(query)}`;
        console.log('Appel API Clip:', searchUrl);
        
        const response = await axiosWithRetry(searchUrl);
        
        console.log('Réponse API reçue:', response.data ? 'OK' : 'Vide');
        
        const clips = response.data?.clips || response.data?.videos || response.data?.results || response.data?.resultats || [];
        
        if (clips && clips.length > 0) {
            userSessions.set(senderId, {
                clips: clips,
                query: query,
                pendingFormat: false,
                selectedClip: null
            });
            
            let headerText = `
🎬 𝗥𝗘́𝗦𝗨𝗟𝗧𝗔𝗧𝗦 𝗖𝗟𝗜𝗣𝗦 🎬
━━━━━━━━━━━━━━━━━━━
🔎 Recherche : ${query}
📊 ${clips.length} clip(s) trouvé(s)
━━━━━━━━━━━━━━━━━━━
            `.trim();
            
            await sendMessage(senderId, headerText);
            
            const maxClips = Math.min(clips.length, 10);
            
            for (let i = 0; i < maxClips; i++) {
                const clip = clips[i];
                const title = (clip.Titre || clip.titre || clip.title || 'Sans titre');
                const displayTitle = title.length > 80 ? title.substring(0, 77) + '...' : title;
                const duration = formatDuration(clip.Duree || clip.duree || clip.duration);
                
                await sendMessage(senderId, `
${i + 1}️⃣ ${displayTitle}
⏱️ Durée : ${duration}
                `.trim());
                
                const imageUrl = clip.Image_url || clip.image_url || clip.thumbnail || clip.image || clip.poster;
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
                
                await new Promise(resolve => setTimeout(resolve, 400));
            }
            
            await sendMessage(senderId, `
━━━━━━━━━━━━━━━━━━━
📥 𝗦𝗲́𝗹𝗲𝗰𝘁𝗶𝗼𝗻𝗻𝗲𝘇 𝘂𝗻 𝗰𝗹𝗶𝗽
━━━━━━━━━━━━━━━━━━━
Envoyez le numéro (1-${maxClips}) pour choisir un clip.

💡 Exemple : Tapez "2" pour le clip n°2
            `.trim());

        } else {
            await sendMessage(senderId, `
❌ 𝗔𝘂𝗰𝘂𝗻 𝗿𝗲́𝘀𝘂𝗹𝘁𝗮𝘁 ❌
━━━━━━━━━━━━━━━━━━━
Aucun clip trouvé pour "${query}".
Essayez avec d'autres mots-clés. 🔍

💡 Exemple : clip Naël clip
            `.trim());
        }

    } catch (error) {
        console.error('Erreur recherche clip:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 𝗗𝗘 𝗥𝗘𝗖𝗛𝗘𝗥𝗖𝗛𝗘 ❌
━━━━━━━━━━━━━━━━━━━
Impossible de contacter le serveur.
Erreur: ${error.message}
Veuillez réessayer plus tard. 🔧
        `.trim());
    }
}

async function handleClipDownload(senderId, clip, format) {
    try {
        const clipTitle = clip.Titre || clip.titre || clip.title || 'Clip';
        const clipUrl = clip.Video_url || clip.url_video || clip.url || clip.video_url || clip.link || clip.video || clip.source;
        
        if (!clipUrl) {
            await sendMessage(senderId, `
⚠️ 𝗦𝗢𝗨𝗥𝗖𝗘 𝗜𝗡𝗧𝗥𝗢𝗨𝗩𝗔𝗕𝗟𝗘 ⚠️
━━━━━━━━━━━━━━━━━━━
❌ Impossible de récupérer le lien de ce clip.
Veuillez réessayer avec un autre clip.

🔄 Tapez "clip" pour une nouvelle recherche
            `.trim());
            
            userSessions.set(senderId, {
                ...userSessions.get(senderId),
                pendingFormat: false,
                selectedClip: null
            });
            return;
        }
        
        userSessions.set(senderId, {
            ...userSessions.get(senderId),
            pendingFormat: false,
            selectedClip: null
        });
        
        const formatLabel = format === 'MP3' ? '🎵 Audio MP3' : '🎬 Vidéo MP4';
        
        await sendMessage(senderId, `
⏳ 𝗣𝗥𝗘́𝗣𝗔𝗥𝗔𝗧𝗜𝗢𝗡 𝗘𝗡 𝗖𝗢𝗨𝗥𝗦 ⏳
━━━━━━━━━━━━━━━━━━━
🎬 ${clipTitle.substring(0, 50)}${clipTitle.length > 50 ? '...' : ''}
📁 Format : ${formatLabel}

Je vais vous envoyer le fichier en pièce jointe ${format}...
Veuillez patienter... 🕐
        `.trim());

        const downloadUrl = `${API_BASE}/download?video=${encodeURIComponent(clipUrl)}&type=${format}`;
        
        console.log('URL de téléchargement:', downloadUrl);
        
        const MAX_FB_SIZE = 25 * 1024 * 1024;
        const fileExt = format === 'MP3' ? 'mp3' : 'mp4';
        const safeTitle = clipTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
        const filename = `${safeTitle}_${Date.now()}.${fileExt}`;
        
        let fileData = null;
        let fileSentSuccessfully = false;
        
        try {
            console.log('Téléchargement en mémoire...');
            fileData = await downloadToBuffer(downloadUrl);
            console.log(`Fichier téléchargé: ${(fileData.size / (1024 * 1024)).toFixed(2)} MB`);
            
            if (fileData.size > MAX_FB_SIZE) {
                console.log(`Fichier trop volumineux (${(fileData.size / (1024 * 1024)).toFixed(2)} MB > 25 MB)`);
                
                await sendMessage(senderId, `
📥 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 ${format}
━━━━━━━━━━━━━━━━━━━
🎬 ${clipTitle}
📁 Format : ${format === 'MP3' ? 'MP3 (Audio)' : 'MP4 (Vidéo)'}

⚠️ Fichier trop volumineux (${(fileData.size / (1024 * 1024)).toFixed(1)} MB).
📱 Facebook limite à 25 MB maximum.
🔗 Utilisez le lien ci-dessous :
                `.trim());
                
                await sendMessage(senderId, downloadUrl);
                
                await sendMessage(senderId, `
💡 Cliquez sur le lien pour télécharger.

🔄 Tapez "clip" pour une nouvelle recherche
                `.trim());
                return;
            }
            
            const attachmentType = format === 'MP3' ? 'audio' : 'video';
            
            console.log(`Envoi du fichier ${format} directement à Facebook...`);
            const sendResult = await sendBufferToMessenger(senderId, fileData.buffer, attachmentType, filename);
            
            if (sendResult && sendResult.success) {
                fileSentSuccessfully = true;
                console.log(`${format} envoyé avec succès à Facebook`);
            } else {
                console.log(`Échec envoi ${format}:`, sendResult?.error || 'Erreur inconnue');
            }
            
        } catch (downloadError) {
            console.error('Erreur lors du téléchargement:', downloadError.message);
        }
        
        if (fileSentSuccessfully) {
            await sendMessage(senderId, `
✅ ${format === 'MP3' ? '𝗔𝗨𝗗𝗜𝗢 𝗠𝗣𝟯' : '𝗩𝗜𝗗𝗘́𝗢 𝗠𝗣𝟰'} 𝗘𝗡𝗩𝗢𝗬𝗘́${format === 'MP4' ? 'E' : ''} !
━━━━━━━━━━━━━━━━━━━
🎬 ${clipTitle}
📁 Format : ${format === 'MP3' ? 'MP3 (Audio)' : 'MP4 (Vidéo)'}

${format === 'MP3' ? '🎵' : '🎬'} Votre fichier a été envoyé ci-dessus !

🔄 Tapez "clip" pour une nouvelle recherche
            `.trim());
        } else {
            await sendMessage(senderId, `
📥 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 ${format}
━━━━━━━━━━━━━━━━━━━
🎬 ${clipTitle}
📁 Format : ${format === 'MP3' ? 'MP3 (Audio)' : 'MP4 (Vidéo)'}

⚠️ L'envoi direct a échoué.
🔗 Utilisez le lien ci-dessous :
            `.trim());
            
            await sendMessage(senderId, downloadUrl);
            
            await sendMessage(senderId, `
💡 Cliquez sur le lien pour télécharger.

🔄 Tapez "clip" pour une nouvelle recherche
            `.trim());
        }

    } catch (error) {
        console.error('Erreur téléchargement clip:', error.message);
        
        await sendMessage(senderId, `
⚠️ 𝗘𝗥𝗥𝗘𝗨𝗥 𝗗𝗘 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 ⚠️
━━━━━━━━━━━━━━━━━━━
❌ Erreur: ${error.message}
📥 Veuillez réessayer plus tard.

🔄 Tapez "clip" pour une nouvelle recherche
        `.trim());
    }
}

module.exports.handleNumber = async (senderId, number) => {
    const userSession = userSessions.get(senderId);
    
    if (userSession && userSession.clips && userSession.clips.length > 0) {
        const clipIndex = number - 1;
        
        if (clipIndex >= 0 && clipIndex < userSession.clips.length) {
            const selectedClip = userSession.clips[clipIndex];
            
            userSessions.set(senderId, {
                ...userSession,
                selectedClip: selectedClip,
                pendingFormat: true
            });
            
            await sendMessage(senderId, `
🎬 𝗖𝗟𝗜𝗣 𝗦𝗘́𝗟𝗘𝗖𝗧𝗜𝗢𝗡𝗡𝗘́ 🎬
━━━━━━━━━━━━━━━━━━━
📹 ${selectedClip.Titre || selectedClip.titre || selectedClip.title || 'Clip sélectionné'}
⏱️ Durée : ${formatDuration(selectedClip.Duree || selectedClip.duree || selectedClip.duration)}

🎵 𝗤𝘂𝗲𝗹 𝘁𝘆𝗽𝗲 𝘀𝗼𝘂𝗵𝗮𝗶𝘁𝗲𝘇-𝘃𝗼𝘂𝘀 ?
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
    
    if (userSession && userSession.pendingFormat && userSession.selectedClip) {
        if (isFormatInput(formatInput)) {
            const format = normalizeFormat(formatInput);
            await handleClipDownload(senderId, userSession.selectedClip, format);
            return true;
        }
    }
    return false;
};

module.exports.hasActiveSession = (senderId) => {
    const session = userSessions.get(senderId);
    return session && (session.clips || session.pendingFormat);
};

module.exports.clearSession = (senderId) => {
    userSessions.delete(senderId);
};
