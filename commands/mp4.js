const axios = require('axios');
const sendMessage = require('../handles/sendMessage');
const yts = require('yt-search');

// Stocker les résultats de recherche en attente de sélection par utilisateur
const pendingSearches = {};

module.exports = async (senderId, args, api) => {
    try {
        // args est une chaîne de caractères, pas un tableau
        const messageText = typeof args === 'string' ? args.trim() : (Array.isArray(args) ? args.join(' ').trim() : '');
        
        // Vérifier si l'utilisateur répond à une recherche précédente
        if (pendingSearches[senderId] && /^\d+\s*\|\s*(video|audio)$/i.test(messageText)) {
            return await handleSelection(senderId, messageText);
        }

        // Sinon, c'est une nouvelle recherche
        const query = messageText;

        if (!query) {
            return await sendMessage(senderId, `
🎥 𝗬𝗢𝗨𝗧𝗨𝗕𝗘 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥 🎥
━━━━━━━━━━━━━━━━━━━
❌ Veuillez fournir une requête de recherche !

📝 𝗨𝘁𝗶𝗹𝗶𝘀𝗮𝘁𝗶𝗼𝗻 :
ytbdl <recherche>

💡 𝗘𝘅𝗲𝗺𝗽𝗹𝗲 :
ytbdl never gonna give you up

━━━━━━━━━━━━━━━━━━━
ℹ️ Après la recherche, répondez avec :
numero | video OU numero | audio

Exemple : 1 | video
            `.trim());
        }

        await sendMessage(senderId, `🔎 Recherche de "${query}" sur YouTube...\n⏳ Veuillez patienter...`);

        // Rechercher sur YouTube
        const searchResults = await yts(query);
        
        if (!searchResults || !searchResults.videos || searchResults.videos.length === 0) {
            return await sendMessage(senderId, `
❌ 𝗔𝗨𝗖𝗨𝗡 𝗥𝗘́𝗦𝗨𝗟𝗧𝗔𝗧 ❌
━━━━━━━━━━━━━━━━━━━
Aucune vidéo trouvée pour "${query}".
Veuillez vérifier votre recherche et réessayer. 🔍
            `.trim());
        }

        // Prendre les 5 premiers résultats
        const videos = searchResults.videos.slice(0, 5);
        
        // Stocker les résultats pour cet utilisateur
        pendingSearches[senderId] = {
            videos: videos,
            timestamp: Date.now(),
            query: query
        };

        // Nettoyer les anciennes recherches (plus de 5 minutes)
        cleanOldSearches();

        // Formater la liste des vidéos
        let videoList = `🎥 𝗥𝗘́𝗦𝗨𝗟𝗧𝗔𝗧𝗦 𝗬𝗢𝗨𝗧𝗨𝗕𝗘 🎥\n`;
        videoList += `━━━━━━━━━━━━━━━━━━━\n`;
        videoList += `🔍 Recherche : "${query}"\n\n`;
        
        videos.forEach((vid, index) => {
            const duration = vid.timestamp || 'N/A';
            const views = vid.views ? vid.views.toLocaleString() : 'N/A';
            videoList += `${index + 1}. 📺 ${vid.title}\n`;
            videoList += `   👤 ${vid.author.name}\n`;
            videoList += `   ⏱️ ${duration} | 👁️ ${views} vues\n`;
            videoList += `   📅 ${vid.ago}\n\n`;
        });
        
        videoList += `━━━━━━━━━━━━━━━━━━━\n`;
        videoList += `✦ 𝗥𝗲́𝗽𝗼𝗻𝗱𝗲𝘇 𝗮𝘃𝗲𝗰 :\n`;
        videoList += `numero | video OU numero | audio\n\n`;
        videoList += `💡 𝗘𝘅𝗲𝗺𝗽𝗹𝗲𝘀 :\n`;
        videoList += `• 1 | video (pour télécharger la vidéo)\n`;
        videoList += `• 2 | audio (pour télécharger l'audio uniquement)\n`;
        videoList += `━━━━━━━━━━━━━━━━━━━`;

        await sendMessage(senderId, videoList);

    } catch (error) {
        console.error('Erreur ytbdl:', error);
        await sendMessage(senderId, `
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 ❌
━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors de la recherche.
Erreur : ${error.message}
Veuillez réessayer plus tard. 🔧
        `.trim());
    }
};

// Fonction pour gérer la sélection de l'utilisateur
async function handleSelection(senderId, messageText) {
    try {
        const userSearch = pendingSearches[senderId];
        
        if (!userSearch) {
            return await sendMessage(senderId, `
❌ Session expirée ou aucune recherche en cours.
Veuillez relancer une recherche avec : ytbdl <votre recherche>
            `.trim());
        }

        // Parser la sélection (format: "1 | video" ou "1 | audio")
        const parts = messageText.trim().split(/\s*\|\s*/);
        
        if (parts.length !== 2) {
            return await sendMessage(senderId, `
❌ Format invalide !
━━━━━━━━━━━━━━━━━━━
Utilisez le format : numero | video OU numero | audio
Exemple : 1 | video
            `.trim());
        }

        const selection = parseInt(parts[0]);
        const format = parts[1].toLowerCase();

        if (isNaN(selection) || selection < 1 || selection > 5) {
            return await sendMessage(senderId, `
❌ Sélection invalide !
━━━━━━━━━━━━━━━━━━━
Veuillez choisir un numéro entre 1 et 5.
            `.trim());
        }

        if (format !== 'video' && format !== 'audio') {
            return await sendMessage(senderId, `
❌ Format invalide !
━━━━━━━━━━━━━━━━━━━
Utilisez 'video' ou 'audio'
Exemple : 1 | video
            `.trim());
        }

        const selectedVideo = userSearch.videos[selection - 1];
        
        if (!selectedVideo) {
            return await sendMessage(senderId, `
❌ Vidéo non trouvée !
Veuillez choisir un numéro valide entre 1 et ${userSearch.videos.length}.
            `.trim());
        }

        // Supprimer la recherche en attente
        delete pendingSearches[senderId];

        const videoUrl = selectedVideo.url;
        const videoTitle = selectedVideo.title;
        const channelName = selectedVideo.author.name;
        const duration = selectedVideo.timestamp || 'N/A';
        const publishedAt = selectedVideo.ago || 'N/A';

        // Créer l'URL de streaming via haji-mix-api
        const streamUrl = `https://haji-mix-api.gleeze.com/api/autodl?url=${encodeURIComponent(videoUrl)}&stream=true`;

        await sendMessage(senderId, `
⏳ 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 𝗘𝗡 𝗖𝗢𝗨𝗥𝗦 ⏳
━━━━━━━━━━━━━━━━━━━
🎥 Titre : ${videoTitle}
👤 Chaîne : ${channelName}
⏱️ Durée : ${duration}
📅 Publié : ${publishedAt}
🔗 Lien : ${videoUrl}

${format === 'video' ? '📹' : '🎵'} Format : ${format.toUpperCase()}

⏳ Préparation du fichier en cours...
Cela peut prendre quelques instants. ⏳
        `.trim());

        try {
            // Télécharger le média et l'envoyer
            const response = await axios.get(streamUrl, {
                responseType: 'arraybuffer',
                timeout: 120000,
                maxContentLength: 100 * 1024 * 1024,
                maxBodyLength: 100 * 1024 * 1024
            });

            // Envoyer le fichier via l'API Facebook Messenger
            const attachment = {
                type: format === 'video' ? 'video' : 'audio',
                payload: {
                    url: streamUrl,
                    is_reusable: true
                }
            };

            await sendMessage(senderId, {
                attachment: attachment
            });

            await sendMessage(senderId, `
✅ 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 𝗥𝗘́𝗨𝗦𝗦𝗜 ! ✅
━━━━━━━━━━━━━━━━━━━
🎥 ${videoTitle}
${format === 'video' ? '📹' : '🎵'} Format : ${format.toUpperCase()}

✨ Bonne écoute/visionnage ! 🎶
            `.trim());

        } catch (streamError) {
            console.error('Erreur de streaming:', streamError);
            
            // En cas d'erreur, envoyer les liens directs
            await sendMessage(senderId, `
⚠️ 𝗘𝗥𝗥𝗘𝗨𝗥 𝗗𝗘 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 ⚠️
━━━━━━━━━━━━━━━━━━━
Impossible de télécharger le fichier automatiquement.

📺 Vidéo : ${videoTitle}
🔗 Lien direct : ${videoUrl}
🔗 Stream : ${streamUrl}

💡 Vous pouvez copier le lien et l'utiliser dans un téléchargeur YouTube.
            `.trim());
        }

    } catch (error) {
        console.error('Erreur lors de la sélection:', error);
        await sendMessage(senderId, `
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 ❌
━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors du traitement.
Erreur : ${error.message}
        `.trim());
    }
}

// Fonction pour nettoyer les anciennes recherches (plus de 5 minutes)
function cleanOldSearches() {
    const now = Date.now();
    const FIVE_MINUTES = 5 * 60 * 1000;
    
    for (const senderId in pendingSearches) {
        if (now - pendingSearches[senderId].timestamp > FIVE_MINUTES) {
            delete pendingSearches[senderId];
        }
    }
}

// Informations de la commande
module.exports.info = {
    name: "ytbdl",
    description: "Recherchez et téléchargez des vidéos YouTube en format vidéo ou audio.",
    usage: "ytbdl <recherche>\nPuis répondez avec : numero | video OU numero | audio",
    author: "Bruno (adapté de MrKimstersDev)",
    aliases: ["vid", "youtube", "ytb"]
};
