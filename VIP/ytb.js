const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const sendMessage = require('../handles/sendMessage');

const API_BASE = 'https://youtube-api-milay.vercel.app';
const MP3_API_BASE = 'https://norch-project.gleeze.com/api/ytmp3';
const MP4_API_BASE = 'https://norch-project.gleeze.com/api/ytdl';

const VIDEOS_PER_PAGE = 10;
const userSessions = new Map();

const SEARCH_MESSAGES = [
    "✨ Voici les pépites que j'ai dénichées pour toi",
    "🌟 J'ai trouvé ces merveilles musicales",
    "💎 Découvre ces trésors YouTube",
    "🔥 Voilà ce que YouTube a de meilleur à t'offrir"
];

const DOWNLOAD_MESSAGES = [
    "🚀 C'est parti ! Je t'envoie ça tout de suite",
    "⚡ Préparation en cours... Ça arrive !",
    "📦 Je m'occupe de tout, patience...",
    "📥 Téléchargement lancé ! Reste connecté"
];

function getRandomMessage(messages) {
    return messages[Math.floor(Math.random() * messages.length)];
}

module.exports = async (senderId, prompt, api) => {
    try {
        const input = (typeof prompt === 'string') ? prompt.trim() : '';
        const session = userSessions.get(senderId) || {};

        // Gestion de la réponse Oui/Non pour le lien de téléchargement
        if (session.pendingDownloadLink) {
            const answer = input.toLowerCase();
            if (answer === 'oui' || answer === 'yes') {
                await sendMessage(senderId, `🔗 Voici votre lien de téléchargement direct :\n${session.lastDownloadUrl}`);
                userSessions.delete(senderId);
            } else if (answer === 'non' || answer === 'no') {
                await sendMessage(senderId, "D'accord ! N'hésitez pas si vous avez besoin d'autre chose. 😊");
                userSessions.delete(senderId);
            }
            return;
        }

        // Gestion de la sélection du format (-v, -a, -i) après avoir choisi un numéro
        if (session.pendingFormat && session.selectedVideo) {
            const format = input.toLowerCase();
            if (format === '-v' || format === 'video') {
                await handleVideoDownload(senderId, session.selectedVideo, 'MP4');
            } else if (format === '-a' || format === 'audio') {
                await handleVideoDownload(senderId, session.selectedVideo, 'MP3');
            } else if (format === '-i' || format === 'info') {
                await handleInfoDisplay(senderId, session.selectedVideo);
                userSessions.delete(senderId);
            } else {
                await sendMessage(senderId, "❌ Format invalide. Choisis : -v (vidéo), -a (audio) ou -i (infos)");
            }
            return;
        }

        // Gestion du choix du numéro
        if (/^\d+$/.test(input) && session.allVideos) {
            const index = parseInt(input) - 1;
            const pageVideos = getVideosForPage(session.allVideos, session.currentPage || 1);
            
            if (index >= 0 && index < pageVideos.length) {
                const selectedVideo = pageVideos[index];
                userSessions.set(senderId, { ...session, selectedVideo, pendingFormat: true });
                await sendMessage(senderId, `🎯 Tu as choisi : ${selectedVideo.title}\n\nQue veux-tu faire ?\n▶️ Tape -v pour la vidéo\n🎵 Tape -a pour l'audio\nℹ️ Tape -i pour les infos`);
            } else {
                await sendMessage(senderId, `❌ Numéro invalide. Choisis entre 1 et ${pageVideos.length}`);
            }
            return;
        }

        // Gestion de la pagination
        if (input.toLowerCase().startsWith('page ') && session.allVideos) {
            const page = parseInt(input.replace('page ', ''));
            const totalPages = Math.ceil(session.allVideos.length / VIDEOS_PER_PAGE);
            if (page >= 1 && page <= totalPages) {
                await displayPage(senderId, session.allVideos, page, session.query);
            } else {
                await sendMessage(senderId, `❌ Page invalide (1-${totalPages})`);
            }
            return;
        }

        // Recherche par défaut
        if (input) {
            await handleVideoSearch(senderId, input);
        } else {
            await sendMessage(senderId, "🎬 𝗬𝗢𝗨𝗧𝗨Ｂ𝗘 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥 🎬\n━━━━━━━━━━━━━━━━━━━\nUtilisation : ytb <titre>");
        }

    } catch (error) {
        console.error('Erreur ytb:', error.message);
        await sendMessage(senderId, `❌ Une erreur est survenue.`);
    }
};

async function handleVideoSearch(senderId, query) {
    await sendMessage(senderId, `🔍 Recherche de "${query}"...`);
    
    const searchUrl = `${API_BASE}/recherche?titre=${encodeURIComponent(query)}`;
    const response = await axios.get(searchUrl);
    
    if (response.data && response.data.videos && response.data.videos.length > 0) {
        const allVideos = response.data.videos;
        userSessions.set(senderId, {
            allVideos,
            query,
            currentPage: 1
        });
        await displayPage(senderId, allVideos, 1, query);
    } else {
        await sendMessage(senderId, `😔 Aucun résultat trouvé pour "${query}"`);
    }
}

async function displayPage(senderId, allVideos, page, query) {
    const totalPages = Math.ceil(allVideos.length / VIDEOS_PER_PAGE);
    const pageVideos = getVideosForPage(allVideos, page);
    const startIndex = (page - 1) * VIDEOS_PER_PAGE;
    
    userSessions.set(senderId, { ...userSessions.get(senderId), currentPage: page });
    
    await sendMessage(senderId, `🎬 𝗥𝗘́𝗦𝗨𝗟𝗧𝗔𝗧𝗦 𝗬𝗢𝗨𝗧𝗨𝗕𝗘 🎬\n━━━━━━━━━━━━━━━━━━━\n🔎 "${query}"\n📄 Page ${page}/${totalPages}\n✨ ${getRandomMessage(SEARCH_MESSAGES)}`);

    for (let i = 0; i < pageVideos.length; i++) {
        const video = pageVideos[i];
        const displayNum = i + 1;
        const videoMsg = `┏━━━━━━━━━━━━━━━━━━━\n┃ ${displayNum}️⃣ ${video.title}\n┗━━━━━━━━━━━━━━━━━━━`;
        
        // Envoi titre + image avec délai
        await sendMessage(senderId, videoMsg);
        
        // On essaie de deviner l'URL de l'image si elle n'est pas fournie par l'API
        const imageUrl = `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`;
        await sendMessage(senderId, {
            attachment: {
                type: 'image',
                payload: { url: imageUrl, is_reusable: true }
            }
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    let footer = `━━━━━━━━━━━━━━━━━━━\n📥 Envoie le numéro (1-${pageVideos.length}) pour choisir.\n`;
    if (page < totalPages) footer += `➡️ Tape "page ${page + 1}" pour la suite.`;
    if (page > 1) footer += `\n⬅️ Tape "page ${page - 1}" pour revenir.`;
    
    await sendMessage(senderId, footer);
}

function getVideosForPage(allVideos, page) {
    const start = (page - 1) * VIDEOS_PER_PAGE;
    return allVideos.slice(start, start + VIDEOS_PER_PAGE);
}

async function handleVideoDownload(senderId, video, format) {
    await sendMessage(senderId, `${getRandomMessage(DOWNLOAD_MESSAGES)}\nFormat: ${format}`);
    
    const downloadApi = format === 'MP3' ? MP3_API_BASE : MP4_API_BASE;
    const downloadUrl = `${downloadApi}?url=${encodeURIComponent(video.url)}${format === 'MP4' ? '&format=360' : ''}`;
    
    try {
        const dlRes = await axios.get(downloadUrl);
        if (dlRes.data && dlRes.data.success && dlRes.data.result) {
            const directUrl = dlRes.data.result.downloadUrl;
            await sendMessage(senderId, {
                attachment: {
                    type: format === 'MP3' ? 'audio' : 'video',
                    payload: { url: directUrl, is_reusable: true }
                }
            });

            // Demander si l'utilisateur veut le lien direct
            userSessions.set(senderId, { 
                pendingDownloadLink: true, 
                lastDownloadUrl: directUrl 
            });
            
            setTimeout(async () => {
                await sendMessage(senderId, "✅ Fichier envoyé ! Souhaitez-vous également recevoir le lien de téléchargement direct ? (Répondez par Oui ou Non)");
            }, 2000);

        } else {
            throw new Error();
        }
    } catch (e) {
        await sendMessage(senderId, "❌ Erreur lors du téléchargement. Le fichier est peut-être trop lourd.");
        userSessions.delete(senderId);
    }
}

async function handleInfoDisplay(senderId, video) {
    const info = `💠 𝗜𝗡𝗙𝗢𝗦 𝗩𝗜𝗗𝗘́𝗢 💠\n━━━━━━━━━━━━━━━━━━━\n📝 Titre : ${video.title}\n🆔 ID : ${video.videoId}\n🔗 Lien : ${video.url}`;
    await sendMessage(senderId, info);
}