const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const DECORATIONS = {
    header: "╔═══════════════════════════════╗",
    footer: "╚═══════════════════════════════╝",
    divider: "═══════════════════════════════",
    star: "★",
    music: "🎵",
    mic: "🎤",
    note: "🎶",
    fire: "🔥",
    heart: "❤️",
    sparkle: "✨",
    diamond: "💎",
    crown: "👑",
    artist: "🎨",
    song: "📀",
    lyrics: "📜",
    page: "📄",
    arrow: "➤",
    bullet: "•",
    check: "✓",
    numbers: "🔢"
};

const userSessions = new Map();

const splitMessage = (text, maxLength = 1900) => {
    const messages = [];
    let currentMessage = "";
    const lines = text.split('\n');
    
    for (const line of lines) {
        if ((currentMessage + line + '\n').length > maxLength) {
            if (currentMessage.trim()) {
                messages.push(currentMessage.trim());
            }
            currentMessage = line + '\n';
        } else {
            currentMessage += line + '\n';
        }
    }
    
    if (currentMessage.trim()) {
        messages.push(currentMessage.trim());
    }
    
    return messages;
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const formatSongList = (data, artistName, pageNum) => {
    const { pagination, chansons } = data;
    let message = "";
    
    message += `${DECORATIONS.header}\n`;
    message += `${DECORATIONS.crown} ${DECORATIONS.mic} MPANAKANTO ${DECORATIONS.mic} ${DECORATIONS.crown}\n`;
    message += `${DECORATIONS.divider}\n`;
    message += `${DECORATIONS.sparkle} ${artistName.toUpperCase()} ${DECORATIONS.sparkle}\n`;
    message += `${DECORATIONS.footer}\n\n`;
    
    message += `${DECORATIONS.music} LISITRY NY HIRA ${DECORATIONS.music}\n`;
    message += `${DECORATIONS.divider}\n\n`;
    
    chansons.forEach((chanson, index) => {
        const num = String(chanson.numero || (index + 1)).padStart(2, '0');
        message += `${DECORATIONS.note} ${num}. ${chanson.titre}\n`;
    });
    
    message += `\n${DECORATIONS.divider}\n`;
    message += `${DECORATIONS.page} Pejy: ${pagination.pageCourante}/${pagination.totalPages}\n`;
    message += `${DECORATIONS.song} Hira: ${pagination.chansonsSurCettePage} eto\n`;
    message += `${DECORATIONS.divider}\n\n`;
    
    message += `${DECORATIONS.fire} HAMPIASA ${DECORATIONS.fire}\n`;
    message += `${DECORATIONS.numbers} Soraty ny laharan'ny hira (ohatra: 1)\n`;
    
    if (pagination.totalPages > 1) {
        message += `${DECORATIONS.page} Soraty "page X" hanova pejy\n`;
        message += `   (ohatra: page 2)\n`;
    }
    
    return message;
};

const formatLyrics = (data) => {
    const { titre, artiste, paroles } = data;
    let message = "";
    
    message += `${DECORATIONS.header}\n`;
    message += `${DECORATIONS.diamond} ${DECORATIONS.music} TONONKIRA ${DECORATIONS.music} ${DECORATIONS.diamond}\n`;
    message += `${DECORATIONS.footer}\n\n`;
    
    message += `${DECORATIONS.crown} MPANAKANTO:\n`;
    message += `${DECORATIONS.sparkle} ${artiste} ${DECORATIONS.sparkle}\n\n`;
    
    message += `${DECORATIONS.song} LOHATENY:\n`;
    message += `${DECORATIONS.heart} ${titre} ${DECORATIONS.heart}\n\n`;
    
    message += `${DECORATIONS.divider}\n`;
    message += `${DECORATIONS.lyrics} TONONKIRA ${DECORATIONS.lyrics}\n`;
    message += `${DECORATIONS.divider}\n\n`;
    
    const cleanLyrics = paroles
        .replace(/\\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    
    message += cleanLyrics;
    
    message += `\n\n${DECORATIONS.divider}\n`;
    message += `${DECORATIONS.fire} ${DECORATIONS.mic} Misaotra anao naheno! ${DECORATIONS.mic} ${DECORATIONS.fire}\n`;
    message += `${DECORATIONS.divider}`;
    
    return message;
};

const sendImageAttachment = async (senderId, imageUrl) => {
    try {
        await sendMessage(senderId, {
            attachment: {
                type: "image",
                payload: {
                    url: imageUrl,
                    is_reusable: true
                }
            }
        });
        return true;
    } catch (error) {
        console.error('Erreur envoi image:', error.message);
        return false;
    }
};

const fetchSongList = async (artistName, senderId, page = 1) => {
    const apiUrl = `https://tononkira-malagasy.vercel.app/tononkira?mpanakanto=${encodeURIComponent(artistName)}&uid=${senderId}&page=${page}`;
    console.log(`Appel API liste chansons: ${apiUrl}`);
    const response = await axios.get(apiUrl, { timeout: 60000 });
    return response.data;
};

const fetchLyrics = async (artistName, songTitle) => {
    const apiUrl = `https://tononkira-malagasy.vercel.app/hira?artiste=${encodeURIComponent(artistName)}&titre=${encodeURIComponent(songTitle)}`;
    console.log(`Appel API paroles: ${apiUrl}`);
    const response = await axios.get(apiUrl, { timeout: 60000 });
    return response.data;
};

module.exports = async (senderId, prompt) => {
    try {
        const loadingMessages = [
            `${DECORATIONS.music} Mitady hira... ${DECORATIONS.music}`,
            `${DECORATIONS.sparkle} Manamboatra ny valin-teny... ${DECORATIONS.sparkle}`,
            `${DECORATIONS.note} Mamaky tononkira... ${DECORATIONS.note}`
        ];
        
        const randomLoading = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
        await sendMessage(senderId, randomLoading);

        const trimmedPrompt = prompt.trim().toLowerCase();
        
        const pageMatch = trimmedPrompt.match(/^page\s*(\d+)$/i);
        if (pageMatch) {
            const pageNum = parseInt(pageMatch[1], 10);
            const session = userSessions.get(senderId);
            
            if (!session || !session.lastArtist) {
                await sendMessage(senderId, `${DECORATIONS.fire} Tsy misy mpanakanto voatahiry ${DECORATIONS.fire}\n\n${DECORATIONS.arrow} Tadiavo aloha ny mpanakanto:\n${DECORATIONS.bullet} tononkira <mpanakanto>\n${DECORATIONS.bullet} Ohatra: tononkira ambondrona`);
                return;
            }
            
            const data = await fetchSongList(session.lastArtist, senderId, pageNum);
            
            if (!data.success) {
                await sendMessage(senderId, `${DECORATIONS.fire} Tsy nahita pejy ${pageNum} ${DECORATIONS.fire}`);
                return;
            }
            
            userSessions.set(senderId, {
                lastArtist: data.mpanakanto || session.lastArtist,
                songs: data.chansons,
                currentPage: pageNum,
                totalPages: data.pagination.totalPages
            });
            
            const formattedMessage = formatSongList(data, data.mpanakanto || session.lastArtist, pageNum);
            const messageParts = splitMessage(formattedMessage);
            
            for (let i = 0; i < messageParts.length; i++) {
                await sendMessage(senderId, messageParts[i]);
                if (i < messageParts.length - 1) await delay(500);
            }
            return;
        }
        
        const numberMatch = trimmedPrompt.match(/^(\d+)$/);
        if (numberMatch) {
            const songNumber = parseInt(numberMatch[1], 10);
            const session = userSessions.get(senderId);
            
            if (!session || !session.songs || !session.lastArtist) {
                await sendMessage(senderId, `${DECORATIONS.fire} Tsy misy lisitry ny hira voatahiry ${DECORATIONS.fire}\n\n${DECORATIONS.arrow} Tadiavo aloha ny mpanakanto:\n${DECORATIONS.bullet} tononkira <mpanakanto>\n${DECORATIONS.bullet} Ohatra: tononkira ambondrona`);
                return;
            }
            
            console.log(`Session songs:`, JSON.stringify(session.songs.map(s => ({ numero: s.numero, titre: s.titre }))));
            console.log(`Looking for song numero: ${songNumber}`);
            
            const selectedSong = session.songs.find(s => parseInt(s.numero, 10) === songNumber);
            
            if (!selectedSong) {
                const availableNumbers = session.songs.map(s => parseInt(s.numero, 10));
                const minNum = Math.min(...availableNumbers);
                const maxNum = Math.max(...availableNumbers);
                await sendMessage(senderId, `${DECORATIONS.fire} Tsy misy hira laharana ${songNumber} amin'ity pejy ity ${DECORATIONS.fire}\n\n${DECORATIONS.arrow} Safidio anatin'ny lisitra: ${minNum} - ${maxNum}\n${DECORATIONS.bullet} Pejy ankehitriny: ${session.currentPage}/${session.totalPages}`);
                return;
            }
            
            const lyricsData = await fetchLyrics(session.lastArtist, selectedSong.titre);
            
            if (!lyricsData.success) {
                await sendMessage(senderId, `${DECORATIONS.fire} Tsy nahita tononkira ho an'ny "${selectedSong.titre}" ${DECORATIONS.fire}`);
                return;
            }
            
            if (lyricsData.image) {
                await sendMessage(senderId, `${DECORATIONS.artist} ${lyricsData.artiste} ${DECORATIONS.artist}`);
                await delay(300);
                await sendImageAttachment(senderId, lyricsData.image);
                await delay(500);
            }
            
            const formattedLyrics = formatLyrics(lyricsData);
            const messageParts = splitMessage(formattedLyrics);
            
            for (let i = 0; i < messageParts.length; i++) {
                let partMessage = messageParts[i];
                if (messageParts.length > 1) {
                    partMessage = `${DECORATIONS.page} (${i + 1}/${messageParts.length})\n${DECORATIONS.divider}\n\n${partMessage}`;
                }
                await sendMessage(senderId, partMessage);
                if (i < messageParts.length - 1) await delay(800);
            }
            return;
        }
        
        const parts = trimmedPrompt.split(/\s+/);
        
        if (parts.length === 1) {
            const artistName = parts[0];
            const data = await fetchSongList(artistName, senderId, 1);
            
            if (!data.success) {
                await sendMessage(senderId, `${DECORATIONS.fire} Tsy nahita hira ho an'ny "${artistName}" ${DECORATIONS.fire}\n\nMba jereo tsara ny anaran'ny mpanakanto.`);
                return;
            }
            
            userSessions.set(senderId, {
                lastArtist: data.mpanakanto || artistName,
                songs: data.chansons,
                currentPage: 1,
                totalPages: data.pagination.totalPages
            });
            
            const formattedMessage = formatSongList(data, data.mpanakanto || artistName, 1);
            const messageParts = splitMessage(formattedMessage);
            
            for (let i = 0; i < messageParts.length; i++) {
                await sendMessage(senderId, messageParts[i]);
                if (i < messageParts.length - 1) await delay(500);
            }
            
        } else {
            const artistPageMatch = trimmedPrompt.match(/^(\S+)\s+page\s*(\d+)$/i);
            if (artistPageMatch) {
                const artistName = artistPageMatch[1];
                const pageNum = parseInt(artistPageMatch[2], 10);
                
                const data = await fetchSongList(artistName, senderId, pageNum);
                
                if (!data.success) {
                    await sendMessage(senderId, `${DECORATIONS.fire} Tsy nahita hira ho an'ny "${artistName}" pejy ${pageNum} ${DECORATIONS.fire}`);
                    return;
                }
                
                userSessions.set(senderId, {
                    lastArtist: data.mpanakanto || artistName,
                    songs: data.chansons,
                    currentPage: pageNum,
                    totalPages: data.pagination.totalPages
                });
                
                const formattedMessage = formatSongList(data, data.mpanakanto || artistName, pageNum);
                const messageParts = splitMessage(formattedMessage);
                
                for (let i = 0; i < messageParts.length; i++) {
                    await sendMessage(senderId, messageParts[i]);
                    if (i < messageParts.length - 1) await delay(500);
                }
                return;
            }
            
            const artistName = parts[0];
            const songTitle = parts.slice(1).join(' ');
            
            const lyricsData = await fetchLyrics(artistName, songTitle);
            
            if (!lyricsData.success) {
                await sendMessage(senderId, `${DECORATIONS.fire} Tsy nahita tononkira ho an'ny "${songTitle}" avy amin'i "${artistName}" ${DECORATIONS.fire}\n\n${DECORATIONS.arrow} Mba jereo tsara ny lohateny sy ny anaran'ny mpanakanto.`);
                return;
            }
            
            if (lyricsData.image) {
                await sendMessage(senderId, `${DECORATIONS.artist} ${lyricsData.artiste} ${DECORATIONS.artist}`);
                await delay(300);
                await sendImageAttachment(senderId, lyricsData.image);
                await delay(500);
            }
            
            const formattedLyrics = formatLyrics(lyricsData);
            const messageParts = splitMessage(formattedLyrics);
            
            for (let i = 0; i < messageParts.length; i++) {
                let partMessage = messageParts[i];
                if (messageParts.length > 1) {
                    partMessage = `${DECORATIONS.page} (${i + 1}/${messageParts.length})\n${DECORATIONS.divider}\n\n${partMessage}`;
                }
                await sendMessage(senderId, partMessage);
                if (i < messageParts.length - 1) await delay(800);
            }
        }
        
    } catch (error) {
        console.error('Erreur tononkira:', error.message);
        
        let errorMessage = `${DECORATIONS.fire} Nisy olana ${DECORATIONS.fire}\n\n`;
        
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            errorMessage += "Ela loatra ny server. Mba andraso kely dia avereno indray.";
        } else if (error.response && error.response.status === 404) {
            errorMessage += "Tsy nahita ilay hira na mpanakanto.";
        } else {
            errorMessage += "Mba avereno indray azafady.";
        }
        
        errorMessage += `\n\n${DECORATIONS.arrow} Fampiasana:\n`;
        errorMessage += `${DECORATIONS.bullet} tononkira <mpanakanto> - Hitady lisitry ny hira\n`;
        errorMessage += `${DECORATIONS.bullet} tononkira <mpanakanto> <lohateny> - Hitady tononkira\n`;
        errorMessage += `${DECORATIONS.bullet} page <laharana> - Hanova pejy\n`;
        errorMessage += `${DECORATIONS.bullet} <laharana> - Hisafidy hira`;
        
        await sendMessage(senderId, errorMessage);
    }
};

module.exports.info = {
    name: "tononkira",
    description: "Mitady hira Malagasy sy tononkira avy amin'ny mpanakanto",
    usage: `Fampiasana:
${DECORATIONS.arrow} tononkira <mpanakanto> - Hitady lisitry ny hira
   Ohatra: tononkira mopcaan
   
${DECORATIONS.arrow} tononkira <mpanakanto> <lohateny> - Hitady tononkira
   Ohatra: tononkira ambondrona ajanony
   
${DECORATIONS.arrow} page <laharana> - Hanova pejy
   Ohatra: page 2
   
${DECORATIONS.arrow} <laharana> - Hisafidy hira amin'ny lisitra
   Ohatra: 3`
};
