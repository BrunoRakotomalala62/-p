const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const sendMessage = require('../handles/sendMessage');

const API_BASE = 'https://youtube-api-milay.vercel.app';
const MP3_API_BASE = 'https://norch-project.gleeze.com/api/ytmp3';
const MP4_API_BASE = 'https://norch-project.gleeze.com/api/ytdl';

const userSessions = new Map();

module.exports = async (senderId, prompt, api) => {
    try {
        const input = (typeof prompt === 'string') ? prompt.trim() : '';
        const args = input.split(/\s+/);
        const command = args[0].toLowerCase();
        const query = args.slice(1).join(' ');

        if (!input) {
            return await sendMessage(senderId, `🎬 𝗬𝗢𝗨𝗧𝗨𝗕𝗘 𝗕𝗘𝗧𝗔 🎬\n━━━━━━━━━━━━━━━━━━━\nUtilisation :\nytb -v <titre> : Vidéo\nytb -a <titre> : Audio\nytb -i <titre> : Infos`);
        }

        if (command === '-v' || command === 'video') {
            await handleDownload(senderId, query, 'MP4');
        } else if (command === '-a' || command === 'audio') {
            await handleDownload(senderId, query, 'MP3');
        } else if (command === '-i' || command === 'info') {
            await handleInfo(senderId, query);
        } else {
            await handleDownload(senderId, input, 'MP4'); // Par défaut
        }

    } catch (error) {
        console.error('Erreur ytb:', error.message);
        await sendMessage(senderId, `❌ Erreur : ${error.message}`);
    }
};

async function handleDownload(senderId, query, format) {
    await sendMessage(senderId, `🔍 Recherche et préparation de "${query}" en ${format}...`);
    
    // Recherche
    const searchUrl = `${API_BASE}/recherche?titre=${encodeURIComponent(query)}`;
    const searchRes = await axios.get(searchUrl);
    
    if (!searchRes.data || !searchRes.data.videos || searchRes.data.videos.length === 0) {
        return await sendMessage(senderId, `❌ Aucun résultat pour "${query}"`);
    }

    const video = searchRes.data.videos[0];
    const videoUrl = video.url;
    
    // Téléchargement
    const downloadApi = format === 'MP3' ? MP3_API_BASE : MP4_API_BASE;
    const downloadUrl = `${downloadApi}?url=${encodeURIComponent(videoUrl)}${format === 'MP4' ? '&format=360' : ''}`;
    
    const dlRes = await axios.get(downloadUrl);
    
    if (dlRes.data && dlRes.data.success && dlRes.data.result) {
        const result = dlRes.data.result;
        await sendMessage(senderId, {
            attachment: {
                type: format === 'MP3' ? 'audio' : 'video',
                payload: {
                    url: result.downloadUrl,
                    is_reusable: true
                }
            }
        });
    } else {
        throw new Error("Impossible de récupérer le lien de téléchargement");
    }
}

async function handleInfo(senderId, query) {
    const searchUrl = `${API_BASE}/recherche?titre=${encodeURIComponent(query)}`;
    const searchRes = await axios.get(searchUrl);
    
    if (searchRes.data && searchRes.data.videos && searchRes.data.videos.length > 0) {
        const video = searchRes.data.videos[0];
        const info = `💠 Titre : ${video.title}\n🔗 Link : ${video.url}\n🆔 ID : ${video.videoId}`;
        await sendMessage(senderId, info);
    } else {
        await sendMessage(senderId, `❌ Aucune info trouvée.`);
    }
}