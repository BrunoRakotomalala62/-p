
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');
const ytdl = require('@distube/ytdl-core');
const fs = require('fs');
const path = require('path');

// Stockage des sessions utilisateurs
const userSessions = {};

// Fonction pour obtenir le stream et la taille
async function getStreamAndSize(url, filePath = "") {
    const response = await axios({
        method: "GET",
        url,
        responseType: "stream",
        headers: {
            'Range': 'bytes=0-'
        }
    });
    if (filePath)
        response.data.path = filePath;
    const totalLength = response.headers["content-length"];
    return {
        stream: response.data,
        size: totalLength
    };
}

// Fonction de recherche YouTube
async function search(keyWord) {
    try {
        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(keyWord)}`;
        const res = await axios.get(url);
        const getJson = JSON.parse(res.data.split("ytInitialData = ")[1].split(";</script>")[0]);
        const videos = getJson.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents[0].itemSectionRenderer.contents;
        const results = [];
        for (const video of videos) {
            if (video.videoRenderer?.lengthText?.simpleText) {
                results.push({
                    id: video.videoRenderer.videoId,
                    title: video.videoRenderer.title.runs[0].text,
                    thumbnail: video.videoRenderer.thumbnail.thumbnails.pop().url,
                    time: video.videoRenderer.lengthText.simpleText,
                    channel: {
                        id: video.videoRenderer.ownerText.runs[0].navigationEndpoint.browseEndpoint.browseId,
                        name: video.videoRenderer.ownerText.runs[0].text,
                        thumbnail: video.videoRenderer.channelThumbnailSupportedRenderers.channelThumbnailWithLinkRenderer.thumbnail.thumbnails.pop().url.replace(/s[0-9]+\-c/g, '-c')
                    }
                });
            }
        }
        return results;
    }
    catch (e) {
        throw new Error("Impossible de rechercher la vidéo");
    }
}

// Fonction pour obtenir les infos de la vidéo
async function getVideoInfo(id) {
    id = id.replace(/(>|<)/gi, '').split(/(vi\/|v=|\/v\/|youtu\.be\/|\/embed\/|\/shorts\/)/);
    id = id[2] !== undefined ? id[2].split(/[^0-9a-z_\-]/i)[0] : id[0];

    const { data: html } = await axios.get(`https://youtu.be/${id}?hl=en`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.101 Safari/537.36'
        }
    });
    const json = JSON.parse(html.match(/var ytInitialPlayerResponse = (.*?});/)[1]);
    const { title, lengthSeconds, viewCount, videoId, thumbnail } = json.videoDetails;
    
    return {
        videoId,
        title,
        lengthSeconds: lengthSeconds.match(/\d+/)[0],
        viewCount: viewCount.match(/\d+/)[0],
        thumbnails: thumbnail.thumbnails
    };
}

module.exports = async (senderId, prompt) => {
    try {
        const args = prompt.trim().split(/\s+/);
        
        // Vérifier le type de commande
        let type;
        if (['-v', 'video'].includes(args[0])) {
            type = 'video';
        } else if (['-a', 'audio', '-s', 'sing'].includes(args[0])) {
            type = 'audio';
        } else if (['-i', 'info'].includes(args[0])) {
            type = 'info';
        } else {
            return await sendMessage(senderId, `
🎥 𝗧𝗨𝗕𝗘 - 𝗬𝗢𝗨𝗧𝗨𝗕𝗘 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥 🎥
━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 𝗨𝘁𝗶𝗹𝗶𝘀𝗮𝘁𝗶𝗼𝗻:

🎬 tube -v <nom ou lien> : Télécharger une vidéo
🎵 tube -a <nom ou lien> : Télécharger l'audio
ℹ️ tube -i <nom ou lien> : Voir les informations

💡 𝗘𝘅𝗲𝗺𝗽𝗹𝗲𝘀:
• tube -v Fallen Kingdom
• tube -a https://youtu.be/abc123
• tube -i Bruno Mars
            `.trim());
        }

        // Vérifier si c'est une réponse à une recherche précédente
        if (userSessions[senderId] && !isNaN(args[0]) && args[0] >= 1 && args[0] <= 6) {
            const choice = parseInt(args[0]) - 1;
            const { result, sessionType } = userSessions[senderId];
            
            if (choice < result.length) {
                const infoChoice = result[choice];
                const infoVideo = await getVideoInfo(infoChoice.id);
                await handleDownload(senderId, sessionType, infoVideo);
                delete userSessions[senderId];
                return;
            }
        }

        // Vérifier si c'est un lien YouTube
        const checkurl = /^(?:https?:\/\/)?(?:m\.|www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))((\w|-){11})(?:\S+)?$/;
        const urlYtb = checkurl.test(args[1]);

        if (urlYtb) {
            const infoVideo = await getVideoInfo(args[1]);
            await handleDownload(senderId, type, infoVideo);
            return;
        }

        // Recherche par mots-clés
        const keyWord = args.slice(1).join(" ").replace("?feature=share", "");
        
        if (!keyWord) {
            return await sendMessage(senderId, "❌ Veuillez fournir un nom de vidéo ou un lien YouTube.");
        }

        await sendMessage(senderId, `🔍 Recherche de "${keyWord}" en cours... ⏳`);

        const result = await search(keyWord);
        
        if (result.length === 0) {
            return await sendMessage(senderId, `⭕ Aucun résultat trouvé pour "${keyWord}"`);
        }

        // Limiter à 6 résultats
        const maxResults = result.slice(0, 6);
        let msg = "🎥 𝗥𝗘́𝗦𝗨𝗟𝗧𝗔𝗧𝗦 𝗗𝗘 𝗥𝗘𝗖𝗛𝗘𝗥𝗖𝗛𝗘 🎥\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
        
        maxResults.forEach((info, i) => {
            msg += `${i + 1}. ${info.title}\n⏱️ ${info.time} | 📺 ${info.channel.name}\n\n`;
        });
        
        msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ Envoyez le numéro (1-6) pour sélectionner";

        await sendMessage(senderId, msg);

        // Stocker la session
        userSessions[senderId] = {
            result: maxResults,
            sessionType: type
        };

    } catch (error) {
        console.error("Erreur dans tube.js:", error);
        await sendMessage(senderId, "❌ Une erreur s'est produite. Veuillez réessayer.");
    }
};

async function handleDownload(senderId, type, infoVideo) {
    const { title, videoId } = infoVideo;
    
    if (type === 'info') {
        // Afficher les informations
        const msg = `
💠 𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗢𝗡𝗦 𝗩𝗜𝗗𝗘́𝗢 💠
━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 Titre: ${title}
👁️ Vues: ${infoVideo.viewCount.toLocaleString()}
⏱️ Durée: ${infoVideo.lengthSeconds}s
🆔 ID: ${videoId}
🔗 Lien: https://youtu.be/${videoId}

━━━━━━━━━━━━━━━━━━━━━━━━━━
        `.trim();
        
        await sendMessage(senderId, {
            attachment: {
                type: 'image',
                payload: {
                    url: infoVideo.thumbnails[infoVideo.thumbnails.length - 1].url,
                    is_reusable: true
                }
            }
        });
        await sendMessage(senderId, msg);
        return;
    }

    const MAX_SIZE = type === 'video' ? 83 * 1024 * 1024 : 27 * 1024 * 1024;
    const typeText = type === 'video' ? '🎬 vidéo' : '🎵 audio';
    
    await sendMessage(senderId, `⬇️ Téléchargement ${typeText} "${title}" en cours...`);

    try {
        const { formats } = await ytdl.getInfo(videoId);
        let getFormat;

        if (type === 'video') {
            getFormat = formats
                .filter(f => f.hasVideo && f.hasAudio && f.quality === 'tiny' && f.audioBitrate === 128)
                .sort((a, b) => (b.contentLength || 0) - (a.contentLength || 0))
                .find(f => (f.contentLength || 0) < MAX_SIZE);
        } else {
            getFormat = formats
                .filter(f => f.hasAudio && !f.hasVideo)
                .sort((a, b) => (b.contentLength || 0) - (a.contentLength || 0))
                .find(f => (f.contentLength || 0) < MAX_SIZE);
        }

        if (!getFormat) {
            return await sendMessage(senderId, `⭕ Désolé, aucun ${type} trouvé avec une taille acceptable.`);
        }

        const getStream = await getStreamAndSize(getFormat.url);
        
        if (getStream.size > MAX_SIZE) {
            return await sendMessage(senderId, `⭕ La taille du fichier est trop grande (> ${Math.floor(MAX_SIZE / 1024 / 1024)}MB)`);
        }

        const ext = type === 'video' ? 'mp4' : 'mp3';
        const savePath = path.join(__dirname, '..', 'temp', `${videoId}_${Date.now()}.${ext}`);
        
        // Créer le dossier temp s'il n'existe pas
        if (!fs.existsSync(path.join(__dirname, '..', 'temp'))) {
            fs.mkdirSync(path.join(__dirname, '..', 'temp'));
        }

        const writeStream = fs.createWriteStream(savePath);
        getStream.stream.pipe(writeStream);

        writeStream.on('finish', async () => {
            await sendMessage(senderId, {
                attachment: {
                    type: type === 'video' ? 'video' : 'audio',
                    payload: {
                        url: fs.createReadStream(savePath),
                        is_reusable: true
                    }
                }
            });
            
            // Supprimer le fichier après envoi
            setTimeout(() => {
                if (fs.existsSync(savePath)) {
                    fs.unlinkSync(savePath);
                }
            }, 5000);
        });

        writeStream.on('error', async (err) => {
            console.error("Erreur d'écriture:", err);
            await sendMessage(senderId, "❌ Erreur lors du téléchargement.");
            if (fs.existsSync(savePath)) {
                fs.unlinkSync(savePath);
            }
        });

    } catch (error) {
        console.error("Erreur de téléchargement:", error);
        await sendMessage(senderId, "❌ Impossible de télécharger. Veuillez réessayer.");
    }
}

// Informations de la commande
module.exports.info = {
    name: "tube",
    description: "Télécharge des vidéos ou audios YouTube et affiche les informations.",
    usage: "tube -v <nom/lien> : vidéo\ntube -a <nom/lien> : audio\ntube -i <nom/lien> : infos"
};
