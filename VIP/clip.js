const axios = require('axios');
const FormData = require('form-data');
const { Readable } = require('stream');
const sendMessage = require('../handles/sendMessage');

const API_BASE = 'https://clip-dai-a0wp.onrender.com';
const MAX_RETRIES = 3;
const RETRY_DELAY = 3000;

const EMOJIS = {
    music: ['🎵', '🎶', '🎼', '🎧', '🎤', '🎸', '🎹', '🎺', '🎻'],
    video: ['🎬', '🎥', '📽️', '🎞️', '📀', '🎦', '📹', '🎭'],
    success: ['✨', '🌟', '💫', '⭐', '🔥', '💎', '🏆', '👑'],
    loading: ['⏳', '🕐', '🕑', '🕒', '🕓', '🔄', '⚡', '💨'],
    download: ['📥', '💾', '📲', '🔽', '⬇️', '📁', '💿']
};

function getRandomEmoji(category) {
    const emojis = EMOJIS[category] || EMOJIS.success;
    return emojis[Math.floor(Math.random() * emojis.length)];
}

function generateProgressBar(percent) {
    const filled = Math.floor(percent / 10);
    const empty = 10 - filled;
    return '▓'.repeat(filled) + '░'.repeat(empty);
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function generateDynamicBorder() {
    const borders = [
        '━━━━━━━━━━━━━━━━━━━━━━━',
        '═══════════════════════',
        '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
        '◆━━━━━━━━━━━━━━━━━━━━━◆',
        '✦═══════════════════════✦',
        '◈━━━━━━━━━━━━━━━━━━━━━◈'
    ];
    return borders[Math.floor(Math.random() * borders.length)];
}

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

function generateTimestamp() {
    const now = new Date();
    const options = { 
        hour: '2-digit', 
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    };
    return now.toLocaleDateString('fr-FR', options);
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
                    const border = generateDynamicBorder();
                    await sendMessage(senderId, `
❌ 𝗙𝗢𝗥𝗠𝗔𝗧 𝗜𝗡𝗩𝗔𝗟𝗜𝗗𝗘 ❌
${border}

${getRandomEmoji('music')} Veuillez choisir un format valide :

┌─────────────────────┐
│  🎵 𝗠𝗣𝟯 ─ Audio     │
│  🎬 𝗠𝗣𝟰 ─ Vidéo     │
└─────────────────────┘

💡 Tapez simplement : 𝗠𝗣𝟯 ou 𝗠𝗣𝟰
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
                    
                    const border = generateDynamicBorder();
                    const emoji1 = getRandomEmoji('video');
                    const emoji2 = getRandomEmoji('success');
                    
                    await sendMessage(senderId, `
${emoji1} 𝗖𝗟𝗜𝗣 𝗦𝗘́𝗟𝗘𝗖𝗧𝗜𝗢𝗡𝗡𝗘́ ${emoji2}
${border}

📹 𝗧𝗶𝘁𝗿𝗲 : ${selectedClip.Titre || selectedClip.titre || selectedClip.title || 'Clip sélectionné'}

⏱️ 𝗗𝘂𝗿𝗲́𝗲 : ${formatDuration(selectedClip.Duree || selectedClip.duree || selectedClip.duration)}

${border}
${getRandomEmoji('music')} 𝗖𝗵𝗼𝗶𝘀𝗶𝘀𝘀𝗲𝘇 𝘃𝗼𝘁𝗿𝗲 𝗳𝗼𝗿𝗺𝗮𝘁 :
${border}

┌───────────────────────────┐
│                           │
│  🎵 𝗠𝗣𝟯 ─ Audio seul      │
│     └─ Musique légère     │
│                           │
│  🎬 𝗠𝗣𝟰 ─ Vidéo HD        │
│     └─ Qualité optimale   │
│                           │
└───────────────────────────┘

💬 𝗘𝗻𝘃𝗼𝘆𝗲𝘇 : MP3 ou MP4
                    `.trim());
                } else {
                    await sendMessage(senderId, `
❌ 𝗡𝘂𝗺𝗲́𝗿𝗼 𝗶𝗻𝘃𝗮𝗹𝗶𝗱𝗲 ❌
${generateDynamicBorder()}

⚠️ Veuillez choisir un numéro entre 𝟏 et ${userSession.clips.length}.

💡 Réessayez avec un numéro valide
                    `.trim());
                }
            } else {
                await handleClipSearch(senderId, input);
            }
        } else {
            const border = generateDynamicBorder();
            const emoji1 = getRandomEmoji('video');
            const emoji2 = getRandomEmoji('music');
            
            await sendMessage(senderId, `
${emoji1} 𝗖𝗟𝗜𝗣 𝗗𝗔𝗜𝗟𝗬𝗠𝗢𝗧𝗜𝗢𝗡 ${emoji2}
${border}

🔍 𝗥𝗲𝗰𝗵𝗲𝗿𝗰𝗵𝗲𝘇 𝗲𝘁 𝘁𝗲́𝗹𝗲́𝗰𝗵𝗮𝗿𝗴𝗲𝘇 𝘃𝗼𝘀 𝗰𝗹𝗶𝗽𝘀 !

${border}
📝 𝗨𝗧𝗜𝗟𝗜𝗦𝗔𝗧𝗜𝗢𝗡 :
${border}

➤ clip <terme de recherche>

💡 𝗘𝗫𝗘𝗠𝗣𝗟𝗘𝗦 :
   • clip Naël clip
   • clip Odyai
   • clip Arnaah

${border}
🔢 𝗘́𝗧𝗔𝗣𝗘𝗦 :
${border}

   1️⃣ Recherchez un clip
   2️⃣ Sélectionnez le numéro
   3️⃣ Choisissez MP3 ou MP4
   4️⃣ Recevez votre fichier + lien !

${getRandomEmoji('success')} 𝗩𝗜𝗣 𝗘𝗫𝗖𝗟𝗨𝗦𝗜𝗙 ${getRandomEmoji('success')}
            `.trim());
        }

    } catch (error) {
        console.error('Erreur commande clip:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 𝗦𝗬𝗦𝗧𝗘̀𝗠𝗘 ❌
${generateDynamicBorder()}

⚠️ Une erreur inattendue s'est produite.

🔄 Veuillez réessayer dans quelques instants.

💬 Tapez "clip" pour recommencer
        `.trim());
    }
};

async function handleClipSearch(senderId, query) {
    try {
        const border = generateDynamicBorder();
        const loadingEmoji = getRandomEmoji('loading');
        
        await sendMessage(senderId, `
${loadingEmoji} 𝗥𝗘𝗖𝗛𝗘𝗥𝗖𝗛𝗘 𝗘𝗡 𝗖𝗢𝗨𝗥𝗦...
${border}

🔍 Recherche : "${query}"

${generateProgressBar(30)} 30%
⏳ Connexion au serveur...
        `.trim());
        
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
            
            const successEmoji = getRandomEmoji('success');
            const videoEmoji = getRandomEmoji('video');
            
            let headerText = `
${videoEmoji} 𝗥𝗘́𝗦𝗨𝗟𝗧𝗔𝗧𝗦 𝗖𝗟𝗜𝗣𝗦 ${successEmoji}
${border}

🔎 𝗥𝗲𝗰𝗵𝗲𝗿𝗰𝗵𝗲 : ${query}
📊 ${clips.length} clip(s) trouvé(s)
⏰ ${generateTimestamp()}

${border}
            `.trim();
            
            await sendMessage(senderId, headerText);
            
            const maxClips = Math.min(clips.length, 10);
            
            for (let i = 0; i < maxClips; i++) {
                const clip = clips[i];
                const title = (clip.Titre || clip.titre || clip.title || 'Sans titre');
                const displayTitle = title.length > 70 ? title.substring(0, 67) + '...' : title;
                const duration = formatDuration(clip.Duree || clip.duree || clip.duration);
                
                const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
                const numEmoji = numberEmojis[i] || `${i + 1}️⃣`;
                
                await sendMessage(senderId, `
┌─────────────────────────┐
│ ${numEmoji} 𝗖𝗟𝗜𝗣 #${i + 1}
├─────────────────────────┤
│ 📹 ${displayTitle}
│ ⏱️ Durée : ${duration}
└─────────────────────────┘
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
${generateDynamicBorder()}
${getRandomEmoji('download')} 𝗦𝗘́𝗟𝗘𝗖𝗧𝗜𝗢𝗡𝗡𝗘𝗭 𝗨𝗡 𝗖𝗟𝗜𝗣
${generateDynamicBorder()}

📌 Envoyez le numéro (𝟏-${maxClips}) pour choisir

💡 𝗘𝘅𝗲𝗺𝗽𝗹𝗲 : Tapez "𝟐" pour le clip n°2

${getRandomEmoji('success')} Téléchargement MP3/MP4 disponible !
            `.trim());

        } else {
            await sendMessage(senderId, `
❌ 𝗔𝗨𝗖𝗨𝗡 𝗥𝗘́𝗦𝗨𝗟𝗧𝗔𝗧 ❌
${generateDynamicBorder()}

🔍 Recherche : "${query}"
📭 Aucun clip trouvé pour cette recherche.

${generateDynamicBorder()}
💡 𝗦𝗨𝗚𝗚𝗘𝗦𝗧𝗜𝗢𝗡𝗦 :
${generateDynamicBorder()}

   • Essayez d'autres mots-clés
   • Vérifiez l'orthographe
   • Utilisez le nom de l'artiste

📝 𝗘𝘅𝗲𝗺𝗽𝗹𝗲 : clip Naël clip
            `.trim());
        }

    } catch (error) {
        console.error('Erreur recherche clip:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 𝗗𝗘 𝗖𝗢𝗡𝗡𝗘𝗫𝗜𝗢𝗡 ❌
${generateDynamicBorder()}

⚠️ Impossible de contacter le serveur.
📡 Erreur: ${error.message}

${generateDynamicBorder()}
🔄 Veuillez réessayer dans quelques instants.

💬 Tapez "clip" pour recommencer
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
${generateDynamicBorder()}

❌ Impossible de récupérer le lien source.

${generateDynamicBorder()}
💡 Essayez avec un autre clip de la liste.

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
        
        const formatEmoji = format === 'MP3' ? getRandomEmoji('music') : getRandomEmoji('video');
        const formatLabel = format === 'MP3' ? '🎵 Audio MP3' : '🎬 Vidéo MP4';
        const border = generateDynamicBorder();
        
        await sendMessage(senderId, `
${getRandomEmoji('loading')} 𝗣𝗥𝗘́𝗣𝗔𝗥𝗔𝗧𝗜𝗢𝗡 𝗘𝗡 𝗖𝗢𝗨𝗥𝗦...
${border}

${formatEmoji} 𝗧𝗶𝘁𝗿𝗲 : ${clipTitle.substring(0, 45)}${clipTitle.length > 45 ? '...' : ''}
📁 𝗙𝗼𝗿𝗺𝗮𝘁 : ${formatLabel}

${border}
${generateProgressBar(20)} 20%
⏳ Préparation du fichier...

💫 Veuillez patienter...
        `.trim());

        const downloadUrl = `${API_BASE}/download?video=${encodeURIComponent(clipUrl)}&type=${format}`;
        
        console.log('URL de téléchargement:', downloadUrl);
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        await sendMessage(senderId, `
${getRandomEmoji('download')} 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧...
${border}

${generateProgressBar(50)} 50%
📥 Téléchargement en cours...
        `.trim());
        
        const MAX_FB_SIZE = 25 * 1024 * 1024;
        const fileExt = format === 'MP3' ? 'mp3' : 'mp4';
        const safeTitle = clipTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
        const filename = `${safeTitle}_${Date.now()}.${fileExt}`;
        
        let fileData = null;
        let fileSentSuccessfully = false;
        let fileSize = 0;
        
        try {
            console.log('Téléchargement en mémoire...');
            fileData = await downloadToBuffer(downloadUrl);
            fileSize = fileData.size;
            console.log(`Fichier téléchargé: ${(fileData.size / (1024 * 1024)).toFixed(2)} MB`);
            
            await sendMessage(senderId, `
${getRandomEmoji('loading')} 𝗧𝗥𝗔𝗜𝗧𝗘𝗠𝗘𝗡𝗧...
${border}

${generateProgressBar(75)} 75%
📤 Envoi du fichier...
📊 Taille : ${formatFileSize(fileSize)}
            `.trim());
            
            if (fileData.size > MAX_FB_SIZE) {
                console.log(`Fichier trop volumineux (${(fileData.size / (1024 * 1024)).toFixed(2)} MB > 25 MB)`);
                
                const successEmoji = getRandomEmoji('success');
                const downloadEmoji = getRandomEmoji('download');
                
                await sendMessage(senderId, `
${successEmoji} 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 ${format} ${successEmoji}
${border}

${formatEmoji} 𝗧𝗶𝘁𝗿𝗲 : ${clipTitle}
📁 𝗙𝗼𝗿𝗺𝗮𝘁 : ${format === 'MP3' ? 'Audio MP3' : 'Vidéo MP4'}
📊 𝗧𝗮𝗶𝗹𝗹𝗲 : ${formatFileSize(fileSize)}

${border}
⚠️ Fichier volumineux (>${formatFileSize(MAX_FB_SIZE)})
📱 Limite Facebook dépassée

${downloadEmoji} 𝗟𝗜𝗘𝗡 𝗗𝗘 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 :
                `.trim());
                
                await sendMessage(senderId, downloadUrl);
                
                await sendMessage(senderId, `
${border}
💡 𝗜𝗡𝗦𝗧𝗥𝗨𝗖𝗧𝗜𝗢𝗡𝗦 :
${border}

   1️⃣ Cliquez sur le lien ci-dessus
   2️⃣ Le téléchargement démarre auto
   3️⃣ Fichier sauvegardé sur votre appareil

${getRandomEmoji('success')} Profitez de votre ${format === 'MP3' ? 'musique' : 'vidéo'} !

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
            const successEmoji = getRandomEmoji('success');
            const downloadEmoji = getRandomEmoji('download');
            
            await sendMessage(senderId, `
${successEmoji}${successEmoji}${successEmoji} 𝗦𝗨𝗖𝗖𝗘̀𝗦 ! ${successEmoji}${successEmoji}${successEmoji}
${border}

${generateProgressBar(100)} 100%

${formatEmoji} ${format === 'MP3' ? '𝗔𝗨𝗗𝗜𝗢 𝗠𝗣𝟯' : '𝗩𝗜𝗗𝗘́𝗢 𝗠𝗣𝟰'} 𝗘𝗡𝗩𝗢𝗬𝗘́${format === 'MP4' ? 'E' : ''} !

${border}
📋 𝗗𝗘́𝗧𝗔𝗜𝗟𝗦 :
${border}

   📹 𝗧𝗶𝘁𝗿𝗲 : ${clipTitle.substring(0, 40)}${clipTitle.length > 40 ? '...' : ''}
   📁 𝗙𝗼𝗿𝗺𝗮𝘁 : ${format}
   📊 𝗧𝗮𝗶𝗹𝗹𝗲 : ${formatFileSize(fileSize)}
   ⏰ 𝗗𝗮𝘁𝗲 : ${generateTimestamp()}

${border}
${downloadEmoji} 𝗟𝗜𝗘𝗡 𝗗𝗘 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 𝗗𝗜𝗥𝗘𝗖𝗧 :
            `.trim());
            
            await sendMessage(senderId, downloadUrl);
            
            await sendMessage(senderId, `
${border}
💎 𝗔𝗩𝗔𝗡𝗧𝗔𝗚𝗘𝗦 𝗗𝗨 𝗟𝗜𝗘𝗡 :
${border}

   ✅ Téléchargement illimité
   ✅ Partage facile avec vos amis
   ✅ Aucune limite de temps
   ✅ Qualité optimale

${border}
${getRandomEmoji('success')} 𝗠𝗘𝗥𝗖𝗜 𝗗'𝗨𝗧𝗜𝗟𝗜𝗦𝗘𝗥 𝗡𝗢𝗧𝗥𝗘 𝗦𝗘𝗥𝗩𝗜𝗖𝗘 !
${border}

🔄 Tapez "clip" pour une nouvelle recherche
👑 𝗩𝗜𝗣 𝗘𝗫𝗖𝗟𝗨𝗦𝗜𝗙
            `.trim());
        } else {
            const downloadEmoji = getRandomEmoji('download');
            
            await sendMessage(senderId, `
${downloadEmoji} 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 ${format}
${border}

${formatEmoji} 𝗧𝗶𝘁𝗿𝗲 : ${clipTitle}
📁 𝗙𝗼𝗿𝗺𝗮𝘁 : ${format === 'MP3' ? 'Audio MP3' : 'Vidéo MP4'}

${border}
⚠️ L'envoi direct a rencontré un problème.
${downloadEmoji} Utilisez le lien alternatif ci-dessous :
            `.trim());
            
            await sendMessage(senderId, downloadUrl);
            
            await sendMessage(senderId, `
${border}
💡 𝗜𝗡𝗦𝗧𝗥𝗨𝗖𝗧𝗜𝗢𝗡𝗦 :
${border}

   1️⃣ Cliquez sur le lien
   2️⃣ Téléchargement automatique
   3️⃣ Profitez de votre ${format === 'MP3' ? 'audio' : 'vidéo'} !

${getRandomEmoji('success')} Lien valide et fonctionnel !

🔄 Tapez "clip" pour une nouvelle recherche
            `.trim());
        }

    } catch (error) {
        console.error('Erreur téléchargement clip:', error.message);
        
        await sendMessage(senderId, `
⚠️ 𝗘𝗥𝗥𝗘𝗨𝗥 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 ⚠️
${generateDynamicBorder()}

❌ Erreur : ${error.message}

${generateDynamicBorder()}
📥 Le téléchargement a échoué.
🔄 Veuillez réessayer plus tard.

💬 Tapez "clip" pour recommencer
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
            
            const border = generateDynamicBorder();
            const emoji1 = getRandomEmoji('video');
            const emoji2 = getRandomEmoji('success');
            
            await sendMessage(senderId, `
${emoji1} 𝗖𝗟𝗜𝗣 𝗦𝗘́𝗟𝗘𝗖𝗧𝗜𝗢𝗡𝗡𝗘́ ${emoji2}
${border}

📹 ${selectedClip.Titre || selectedClip.titre || selectedClip.title || 'Clip sélectionné'}
⏱️ Durée : ${formatDuration(selectedClip.Duree || selectedClip.duree || selectedClip.duration)}

${border}
${getRandomEmoji('music')} 𝗖𝗵𝗼𝗶𝘀𝗶𝘀𝘀𝗲𝘇 𝘃𝗼𝘁𝗿𝗲 𝗳𝗼𝗿𝗺𝗮𝘁 :
${border}

┌───────────────────────────┐
│                           │
│  🎵 𝗠𝗣𝟯 ─ Audio seul      │
│     └─ Musique légère     │
│                           │
│  🎬 𝗠𝗣𝟰 ─ Vidéo HD        │
│     └─ Qualité optimale   │
│                           │
└───────────────────────────┘

💬 Envoyez : MP3 ou MP4
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
