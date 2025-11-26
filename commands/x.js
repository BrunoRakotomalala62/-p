const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const API_BASE = 'https://scraping-video.onrender.com';

const userSessions = new Map();

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
        console.error('Erreur commande x:', error);
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
        const response = await axios.get(searchUrl, { timeout: 30000 });
        
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
            
            let videoListText = `
🎬 𝗥𝗘́𝗦𝗨𝗟𝗧𝗔𝗧𝗦 𝗗𝗘 𝗥𝗘𝗖𝗛𝗘𝗥𝗖𝗛𝗘 🎬
━━━━━━━━━━━━━━━━━━━
🔎 Recherche : ${query}
📄 Page : ${currentPage}/${totalPages}
📊 Vidéos trouvées : ${videos.length}
━━━━━━━━━━━━━━━━━━━

`;

            for (let i = 0; i < Math.min(videos.length, 10); i++) {
                const video = videos[i];
                const title = video.titre.length > 50 ? video.titre.substring(0, 47) + '...' : video.titre;
                videoListText += `${i + 1}. ${title}\n`;
            }

            videoListText += `
━━━━━━━━━━━━━━━━━━━
📥 Envoyez le numéro (1-${Math.min(videos.length, 10)}) pour télécharger

🔄 Commandes :
• x page <numéro> - Changer de page
• x <nouvelle recherche> - Nouvelle recherche
            `;

            if (videos[0] && videos[0].image_url) {
                try {
                    await sendMessage(senderId, {
                        attachment: {
                            type: 'image',
                            payload: {
                                url: videos[0].image_url,
                                is_reusable: true
                            }
                        }
                    });
                } catch (imgError) {
                    console.log('Image non disponible:', imgError.message);
                }
            }
            
            await sendMessage(senderId, videoListText.trim());

        } else {
            await sendMessage(senderId, `
❌ 𝗔𝘂𝗰𝘂𝗻 𝗿𝗲́𝘀𝘂𝗹𝘁𝗮𝘁 ❌
━━━━━━━━━━━━━━━━━━━
Aucune vidéo trouvée pour "${query}".
Veuillez essayer avec d'autres mots-clés. 🔍
            `.trim());
        }

    } catch (error) {
        console.error('Erreur recherche vidéo:', error);
        throw error;
    }
}

async function handleVideoDownload(senderId, video) {
    try {
        await sendMessage(senderId, `
⏳ 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 𝗘𝗡 𝗖𝗢𝗨𝗥𝗦 ⏳
━━━━━━━━━━━━━━━━━━━
🎬 ${video.titre.substring(0, 50)}...
Préparation du téléchargement...
        `.trim());

        const videoDetailsUrl = `${API_BASE}/video/${video.id}`;
        let slug = '';
        if (video.url_page) {
            const parts = video.url_page.split('/');
            slug = parts[parts.length - 1] || '';
        }
        
        const detailsResponse = await axios.get(`${videoDetailsUrl}?slug=${encodeURIComponent(slug)}`, { timeout: 30000 });
        
        if (detailsResponse.data) {
            const videoData = detailsResponse.data;
            
            if (videoData.url_mp4) {
                const downloadUrl = `${API_BASE}/stream?url_mp4=${encodeURIComponent(videoData.url_mp4)}&filename=${encodeURIComponent(videoData.titre || 'video')}.mp4`;
                
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
🎬 ${videoData.titre || video.titre}

📥 Si la vidéo ne s'affiche pas, utilisez ce lien direct :
${downloadUrl}
                `.trim());

            } else {
                await sendMessage(senderId, `
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 ❌
━━━━━━━━━━━━━━━━━━━
Impossible de récupérer l'URL de téléchargement.
Veuillez réessayer plus tard. 🔧
                `.trim());
            }
        }

    } catch (error) {
        console.error('Erreur téléchargement vidéo:', error);
        
        try {
            const directDownloadUrl = `${API_BASE}/download/${video.id}`;
            
            await sendMessage(senderId, `
⚠️ 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 𝗔𝗟𝗧𝗘𝗥𝗡𝗔𝗧𝗜𝗙 ⚠️
━━━━━━━━━━━━━━━━━━━
La vidéo est trop volumineuse pour Messenger.

📥 Téléchargez directement via ce lien :
${directDownloadUrl}
            `.trim());
        } catch (altError) {
            await sendMessage(senderId, `
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 ❌
━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors du téléchargement.
Veuillez réessayer plus tard. 🔧
            `.trim());
        }
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
