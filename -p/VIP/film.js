const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const API_BASE = 'https://daylimotion-film-tfi3.onrender.com';

const EMOJIS = {
    film: ['🎬', '🎥', '📽️', '🎞️', '🎦', '🎭', '🎪', '🎫'],
    quality: ['📊', '🔮', '💎', '✨', '🌟', '⚡', '🔥', '💫'],
    success: ['✅', '🎉', '🏆', '👑', '💯', '🌈', '🎊', '⭐'],
    loading: ['⏳', '🔄', '⚡', '💫', '🕐', '🕑', '🕒', '🕓'],
    download: ['📥', '💾', '📲', '🔽', '⬇️', '📁', '💿', '🎁'],
    cinema: ['🍿', '🎪', '🎭', '🎟️', '📺', '🖥️', '📀', '💽'],
    star: ['⭐', '🌟', '✨', '💫', '🔥', '💎', '👑', '🏆']
};

function getRandomEmoji(category) {
    const emojis = EMOJIS[category] || EMOJIS.star;
    return emojis[Math.floor(Math.random() * emojis.length)];
}

function generateDynamicBorder() {
    const borders = [
        '━━━━━━━━━━━━━━━━━━━━━━━━━',
        '═══════════════════════════',
        '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
        '◆━━━━━━━━━━━━━━━━━━━━━━◆',
        '✦═════════════════════════✦',
        '◈━━━━━━━━━━━━━━━━━━━━━━◈',
        '★━━━━━━━━━━━━━━━━━━━━━━★',
        '◇═════════════════════════◇'
    ];
    return borders[Math.floor(Math.random() * borders.length)];
}

function generateProgressBar(percent) {
    const filled = Math.floor(percent / 10);
    const empty = 10 - filled;
    return '▓'.repeat(filled) + '░'.repeat(empty);
}

function formatFileSize(quality) {
    if (quality === '720p') return '~800MB - 1.5GB';
    return '~300MB - 600MB';
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

function getQualityStars(quality) {
    if (quality === '720p') return '⭐⭐⭐⭐⭐';
    return '⭐⭐⭐';
}

const userSessions = new Map();

const QUALITY_OPTIONS = ['360p', '720p'];

async function axiosWithRetry(url, options = {}, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios.get(url, {
                timeout: 30000,
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
            
            const status = error.response?.status;
            if (status === 404 || status === 502 || status === 503 || status === 504 || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
                const waitTime = attempt * 2000;
                console.log(`Attente ${waitTime}ms avant nouvelle tentative...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
                throw error;
            }
        }
    }
}

function isQualityInput(input) {
    const normalizedInput = input.toLowerCase().replace(/[^0-9p]/g, '');
    return QUALITY_OPTIONS.some(q => q.toLowerCase() === normalizedInput);
}

function normalizeQuality(input) {
    const normalizedInput = input.toLowerCase().replace(/[^0-9p]/g, '');
    const found = QUALITY_OPTIONS.find(q => q.toLowerCase() === normalizedInput);
    return found || '360p';
}

function formatDuration(duree) {
    if (!duree) return 'Durée inconnue';
    return duree;
}

module.exports = async (senderId, prompt, api) => {
    try {
        const userSession = userSessions.get(senderId) || {};
        const input = (typeof prompt === 'string') ? prompt.trim() : '';
        
        if (input && input.length > 0) {
            if (userSession.pendingQuality && userSession.selectedFilm) {
                if (isQualityInput(input)) {
                    const quality = normalizeQuality(input);
                    await handleFilmDownload(senderId, userSession.selectedFilm, quality);
                } else {
                    const border = generateDynamicBorder();
                    await sendMessage(senderId, `
❌ 𝗤𝗨𝗔𝗟𝗜𝗧𝗘́ 𝗜𝗡𝗩𝗔𝗟𝗜𝗗𝗘 ❌
${border}

${getRandomEmoji('quality')} Veuillez choisir une qualité valide :

┌─────────────────────────────┐
│                             │
│  📊 𝟯𝟲𝟬𝗽 ─ Standard         │
│     └─ Fichier léger        │
│     └─ ${getQualityStars('360p')}              │
│                             │
│  💎 𝟳𝟮𝟬𝗽 ─ Haute Définition │
│     └─ Meilleure qualité    │
│     └─ ${getQualityStars('720p')}        │
│                             │
└─────────────────────────────┘

💡 Tapez : 𝟯𝟲𝟬𝗽 ou 𝟳𝟮𝟬𝗽
                    `.trim());
                }
            } else if (/^\d+$/.test(input) && userSession.films && userSession.films.length > 0) {
                const filmIndex = parseInt(input) - 1;
                
                if (filmIndex >= 0 && filmIndex < userSession.films.length) {
                    const selectedFilm = userSession.films[filmIndex];
                    
                    userSessions.set(senderId, {
                        ...userSession,
                        selectedFilm: selectedFilm,
                        pendingQuality: true
                    });
                    
                    const border = generateDynamicBorder();
                    const emoji1 = getRandomEmoji('film');
                    const emoji2 = getRandomEmoji('success');
                    
                    await sendMessage(senderId, `
${emoji1} 𝗙𝗜𝗟𝗠 𝗦𝗘́𝗟𝗘𝗖𝗧𝗜𝗢𝗡𝗡𝗘́ ${emoji2}
${border}

📽️ 𝗧𝗶𝘁𝗿𝗲 : ${selectedFilm.titre}
⏱️ 𝗗𝘂𝗿𝗲́𝗲 : ${formatDuration(selectedFilm.duree)}

${border}
${getRandomEmoji('quality')} 𝗖𝗛𝗢𝗜𝗦𝗜𝗦𝗦𝗘𝗭 𝗟𝗔 𝗤𝗨𝗔𝗟𝗜𝗧𝗘́ :
${border}

┌─────────────────────────────────┐
│                                 │
│  📊 𝟯𝟲𝟬𝗽 ─ Qualité Standard     │
│     ├─ Taille : ${formatFileSize('360p')}    │
│     └─ ${getQualityStars('360p')} Recommandé      │
│                                 │
│  💎 𝟳𝟮𝟬𝗽 ─ Haute Définition HD  │
│     ├─ Taille : ${formatFileSize('720p')}  │
│     └─ ${getQualityStars('720p')} Premium    │
│                                 │
└─────────────────────────────────┘

💬 𝗘𝗻𝘃𝗼𝘆𝗲𝘇 : 360p ou 720p
                    `.trim());
                } else {
                    await sendMessage(senderId, `
❌ 𝗡𝗨𝗠𝗘́𝗥𝗢 𝗜𝗡𝗩𝗔𝗟𝗜𝗗𝗘 ❌
${generateDynamicBorder()}

⚠️ Veuillez choisir un numéro entre 𝟏 et ${userSession.films.length}.

💡 Réessayez avec un numéro valide de la liste
                    `.trim());
                }
            } else if (input.toLowerCase().startsWith('page ')) {
                const pageNum = parseInt(input.replace(/^page\s+/i, ''));
                if (!isNaN(pageNum) && pageNum > 0 && userSession.query) {
                    await handleFilmSearch(senderId, userSession.query, pageNum);
                } else if (!userSession.query) {
                    await sendMessage(senderId, `
❌ 𝗔𝗨𝗖𝗨𝗡𝗘 𝗥𝗘𝗖𝗛𝗘𝗥𝗖𝗛𝗘 𝗔𝗖𝗧𝗜𝗩𝗘 ❌
${generateDynamicBorder()}

⚠️ Veuillez d'abord effectuer une recherche.

💡 𝗘𝘅𝗲𝗺𝗽𝗹𝗲 : film Jackie Chan
                    `.trim());
                } else {
                    await sendMessage(senderId, `
❌ 𝗡𝗨𝗠𝗘́𝗥𝗢 𝗗𝗘 𝗣𝗔𝗚𝗘 𝗜𝗡𝗩𝗔𝗟𝗜𝗗𝗘 ❌
${generateDynamicBorder()}

⚠️ Utilisez : film page <numéro>

💡 𝗘𝘅𝗲𝗺𝗽𝗹𝗲 : film page 2
                    `.trim());
                }
            } else {
                await handleFilmSearch(senderId, input, 1);
            }
        } else {
            const border = generateDynamicBorder();
            const emoji1 = getRandomEmoji('film');
            const emoji2 = getRandomEmoji('cinema');
            const emoji3 = getRandomEmoji('star');
            
            await sendMessage(senderId, `
${emoji1} 𝗙𝗜𝗟𝗠 𝗦𝗧𝗥𝗘𝗔𝗠𝗜𝗡𝗚 ${emoji2}
${border}

${emoji3} 𝗧𝗲́𝗹𝗲́𝗰𝗵𝗮𝗿𝗴𝗲𝘇 𝘃𝗼𝘀 𝗳𝗶𝗹𝗺𝘀 𝗽𝗿𝗲́𝗳𝗲́𝗿𝗲́𝘀 !

${border}
📝 𝗨𝗧𝗜𝗟𝗜𝗦𝗔𝗧𝗜𝗢𝗡 :
${border}

➤ film <titre du film>

💡 𝗘𝗫𝗘𝗠𝗣𝗟𝗘𝗦 :
   • film Jackie Chan
   • film Donnie Yen
   • film Fast and Furious
   • film John Wick

${border}
🔢 𝗘́𝗧𝗔𝗣𝗘𝗦 :
${border}

   1️⃣ Recherchez un film
   2️⃣ Sélectionnez le numéro
   3️⃣ Choisissez 360p ou 720p
   4️⃣ Téléchargez via le lien !

${border}
📄 𝗣𝗔𝗚𝗜𝗡𝗔𝗧𝗜𝗢𝗡 :
${border}

➤ film page 2 (page suivante)

${getRandomEmoji('success')} 𝗩𝗜𝗣 𝗘𝗫𝗖𝗟𝗨𝗦𝗜𝗙 - 𝗙𝗶𝗹𝗺𝘀 𝗛𝗗 ${getRandomEmoji('success')}
            `.trim());
        }

    } catch (error) {
        console.error('Erreur commande film:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 𝗦𝗬𝗦𝗧𝗘̀𝗠𝗘 ❌
${generateDynamicBorder()}

⚠️ Une erreur inattendue s'est produite.

🔄 Veuillez réessayer dans quelques instants.

💬 Tapez "film" pour recommencer
        `.trim());
    }
};

async function handleFilmSearch(senderId, query, page = 1) {
    try {
        const border = generateDynamicBorder();
        const loadingEmoji = getRandomEmoji('loading');
        
        await sendMessage(senderId, `
${loadingEmoji} 𝗥𝗘𝗖𝗛𝗘𝗥𝗖𝗛𝗘 𝗘𝗡 𝗖𝗢𝗨𝗥𝗦...
${border}

🔍 Recherche : "${query}"
📄 Page : ${page}

${generateProgressBar(30)} 30%
⏳ Connexion au serveur de films...
        `.trim());
        
        const searchUrl = `${API_BASE}/recherche?video=${encodeURIComponent(query)}&page=${page}&duree_min=40&limit=30`;
        console.log('Appel API Film:', searchUrl);
        
        const response = await axiosWithRetry(searchUrl);
        
        console.log('Réponse API reçue:', response.data ? 'OK' : 'Vide');
        
        if (response.data && response.data.resultats && response.data.resultats.length > 0) {
            const films = response.data.resultats;
            const currentPage = response.data.page || page;
            const totalResults = response.data.total_resultats || films.length;
            const totalAvailable = response.data.total_disponible || totalResults;
            const hasNextPage = response.data.page_suivante || false;
            const totalPages = Math.ceil(totalAvailable / 10);
            
            userSessions.set(senderId, {
                films: films,
                query: query,
                currentPage: currentPage,
                totalPages: totalPages,
                totalResults: totalResults,
                hasNextPage: hasNextPage,
                pendingQuality: false,
                selectedFilm: null
            });
            
            const filmEmoji = getRandomEmoji('film');
            const successEmoji = getRandomEmoji('success');
            
            let headerText = `
${filmEmoji} 𝗥𝗘́𝗦𝗨𝗟𝗧𝗔𝗧𝗦 𝗙𝗜𝗟𝗠𝗦 ${successEmoji}
${border}

🔎 𝗥𝗲𝗰𝗵𝗲𝗿𝗰𝗵𝗲 : ${query}
📄 𝗣𝗮𝗴𝗲 : ${currentPage}${totalPages > 1 ? ` / ${totalPages}` : ''}
📊 ${totalResults} film(s) trouvé(s)
🎞️ 𝗙𝗶𝗹𝘁𝗿𝗲 : Films longue durée (40min+)
⏰ ${generateTimestamp()}

${border}
            `.trim();
            
            await sendMessage(senderId, headerText);
            
            const maxFilms = Math.min(films.length, 10);
            const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
            
            for (let i = 0; i < maxFilms; i++) {
                const film = films[i];
                const title = film.titre.length > 55 ? film.titre.substring(0, 52) + '...' : film.titre;
                const duration = formatDuration(film.duree);
                const numEmoji = numberEmojis[i] || `${i + 1}️⃣`;
                
                const filmInfo = `
┌─────────────────────────────┐
│ ${numEmoji} 𝗙𝗜𝗟𝗠 #${i + 1}
├─────────────────────────────┤
│ 📽️ ${title}
│ ⏱️ Durée : ${duration}
│ ${getRandomEmoji('quality')} Qualités : 360p / 720p
└─────────────────────────────┘
                `.trim();
                
                await sendMessage(senderId, filmInfo);
                
                if (film.image_url) {
                    try {
                        await sendMessage(senderId, {
                            attachment: {
                                type: 'image',
                                payload: {
                                    url: film.image_url,
                                    is_reusable: true
                                }
                            }
                        });
                    } catch (imgError) {
                        console.log(`Image ${i + 1} non disponible:`, imgError.message);
                    }
                }
                
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            let paginationInfo = '';
            if (hasNextPage || currentPage > 1) {
                paginationInfo = `
${border}
📄 𝗣𝗔𝗚𝗜𝗡𝗔𝗧𝗜𝗢𝗡 :
${border}`;
                if (currentPage > 1) {
                    paginationInfo += `
   ◀️ film page ${currentPage - 1} ─ Précédente`;
                }
                if (hasNextPage) {
                    paginationInfo += `
   ▶️ film page ${currentPage + 1} ─ Suivante`;
                }
            }
            
            let footerText = `
${border}
${getRandomEmoji('download')} 𝗦𝗘́𝗟𝗘𝗖𝗧𝗜𝗢𝗡𝗡𝗘𝗭 𝗨𝗡 𝗙𝗜𝗟𝗠
${border}

📌 Envoyez le numéro (𝟏-${maxFilms}) pour choisir

┌─────────────────────────────┐
│ 📊 𝗤𝘂𝗮𝗹𝗶𝘁𝗲́𝘀 𝗱𝗶𝘀𝗽𝗼𝗻𝗶𝗯𝗹𝗲𝘀 :   │
│   • 360p ─ Standard         │
│   • 720p ─ HD Premium       │
└─────────────────────────────┘
${paginationInfo}

💡 𝗘𝘅𝗲𝗺𝗽𝗹𝗲 : Tapez "𝟑" pour le film n°3

${getRandomEmoji('star')} 𝗕𝗼𝗻 𝘃𝗶𝘀𝗶𝗼𝗻𝗻𝗮𝗴𝗲 ! ${getRandomEmoji('cinema')}
            `.trim();
            
            await sendMessage(senderId, footerText);

        } else {
            await sendMessage(senderId, `
❌ 𝗔𝗨𝗖𝗨𝗡 𝗥𝗘́𝗦𝗨𝗟𝗧𝗔𝗧 ❌
${generateDynamicBorder()}

🔍 Recherche : "${query}"
📄 Page : ${page}
📭 Aucun film trouvé.

${generateDynamicBorder()}
💡 𝗦𝗨𝗚𝗚𝗘𝗦𝗧𝗜𝗢𝗡𝗦 :
${generateDynamicBorder()}

   • Vérifiez l'orthographe
   • Essayez le nom d'un acteur célèbre
   • Utilisez le titre en anglais
   • Essayez des mots-clés simples

📝 𝗘𝘅𝗲𝗺𝗽𝗹𝗲𝘀 :
   • film action
   • film Jackie Chan
   • film marvel
            `.trim());
        }

    } catch (error) {
        console.error('Erreur recherche film:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 𝗗𝗘 𝗖𝗢𝗡𝗡𝗘𝗫𝗜𝗢𝗡 ❌
${generateDynamicBorder()}

⚠️ Impossible de contacter le serveur.
📡 Erreur : ${error.message}

${generateDynamicBorder()}
🔄 Le serveur peut être en cours de réveil.
⏳ Veuillez réessayer dans 30 secondes.

💬 Tapez "film" pour recommencer
        `.trim());
    }
}

async function handleFilmDownload(senderId, film, quality = '360p') {
    try {
        const userSession = userSessions.get(senderId) || {};
        
        userSessions.set(senderId, {
            ...userSession,
            pendingQuality: false,
            selectedFilm: null
        });
        
        const border = generateDynamicBorder();
        const loadingEmoji = getRandomEmoji('loading');
        const filmEmoji = getRandomEmoji('film');
        
        await sendMessage(senderId, `
${loadingEmoji} 𝗣𝗥𝗘́𝗣𝗔𝗥𝗔𝗧𝗜𝗢𝗡 𝗗𝗨 𝗙𝗜𝗟𝗠...
${border}

${filmEmoji} 𝗧𝗶𝘁𝗿𝗲 : ${film.titre.substring(0, 40)}${film.titre.length > 40 ? '...' : ''}
📊 𝗤𝘂𝗮𝗹𝗶𝘁𝗲́ : ${quality} ${getQualityStars(quality)}
⏱️ 𝗗𝘂𝗿𝗲́𝗲 : ${formatDuration(film.duree)}

${border}
${generateProgressBar(25)} 25%
⏳ Génération du lien en cours...
        `.trim());

        const qualityNum = quality.replace('p', '');
        const downloadUrl = `${API_BASE}/telecharger/${film.video_id}?quality=${qualityNum}`;
        
        console.log('URL de téléchargement:', downloadUrl);
        
        const successEmoji = getRandomEmoji('success');
        const downloadEmoji = getRandomEmoji('download');
        const starEmoji = getRandomEmoji('star');
        
        await sendMessage(senderId, `
${successEmoji}${successEmoji}${successEmoji} 𝗟𝗜𝗘𝗡 𝗣𝗥𝗘̂𝗧 ! ${successEmoji}${successEmoji}${successEmoji}
${border}

${generateProgressBar(100)} 100%

${filmEmoji} 𝗗𝗘́𝗧𝗔𝗜𝗟𝗦 𝗗𝗨 𝗙𝗜𝗟𝗠 :
${border}

   📽️ 𝗧𝗶𝘁𝗿𝗲 : ${film.titre}
   📊 𝗤𝘂𝗮𝗹𝗶𝘁𝗲́ : ${quality} ${getQualityStars(quality)}
   ⏱️ 𝗗𝘂𝗿𝗲́𝗲 : ${formatDuration(film.duree)}
   📁 𝗧𝗮𝗶𝗹𝗹𝗲 : ${formatFileSize(quality)}
   ⏰ 𝗗𝗮𝘁𝗲 : ${generateTimestamp()}

${border}
${downloadEmoji} 𝗟𝗜𝗘𝗡 𝗗𝗘 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 :
        `.trim());
        
        await sendMessage(senderId, downloadUrl);
        
        await sendMessage(senderId, `
${border}
💡 𝗜𝗡𝗦𝗧𝗥𝗨𝗖𝗧𝗜𝗢𝗡𝗦 :
${border}

   1️⃣ Cliquez sur le lien ci-dessus
   2️⃣ Le téléchargement démarre automatiquement
   3️⃣ Fichier enregistré sur votre appareil

${border}
${starEmoji} 𝗔𝗩𝗔𝗡𝗧𝗔𝗚𝗘𝗦 :
${border}

   ✅ Téléchargement rapide
   ✅ Qualité ${quality} garantie
   ✅ Compatible tous appareils
   ✅ Aucune limite de temps

${border}
${getRandomEmoji('cinema')} 𝗕𝗢𝗡 𝗩𝗜𝗦𝗜𝗢𝗡𝗡𝗔𝗚𝗘 ! ${getRandomEmoji('cinema')}
${border}

🔄 Tapez "film" pour une nouvelle recherche
👑 𝗩𝗜𝗣 𝗘𝗫𝗖𝗟𝗨𝗦𝗜𝗙 - 𝗙𝗜𝗟𝗠𝗦 𝗛𝗗
        `.trim());

    } catch (error) {
        console.error('Erreur téléchargement film:', error.message);
        
        await sendMessage(senderId, `
⚠️ 𝗘𝗥𝗥𝗘𝗨𝗥 𝗗𝗘 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 ⚠️
${generateDynamicBorder()}

❌ Erreur : ${error.message}

${generateDynamicBorder()}
📥 Le téléchargement a échoué.
🔄 Veuillez réessayer plus tard.

💬 Tapez "film" pour recommencer
        `.trim());
    }
}

module.exports.handleNumber = async (senderId, number) => {
    const userSession = userSessions.get(senderId);
    
    if (userSession && userSession.films && userSession.films.length > 0) {
        const filmIndex = number - 1;
        
        if (filmIndex >= 0 && filmIndex < userSession.films.length) {
            const selectedFilm = userSession.films[filmIndex];
            
            userSessions.set(senderId, {
                ...userSession,
                selectedFilm: selectedFilm,
                pendingQuality: true
            });
            
            const border = generateDynamicBorder();
            const emoji1 = getRandomEmoji('film');
            const emoji2 = getRandomEmoji('success');
            
            await sendMessage(senderId, `
${emoji1} 𝗙𝗜𝗟𝗠 𝗦𝗘́𝗟𝗘𝗖𝗧𝗜𝗢𝗡𝗡𝗘́ ${emoji2}
${border}

📽️ 𝗧𝗶𝘁𝗿𝗲 : ${selectedFilm.titre}
⏱️ 𝗗𝘂𝗿𝗲́𝗲 : ${formatDuration(selectedFilm.duree)}

${border}
${getRandomEmoji('quality')} 𝗖𝗛𝗢𝗜𝗦𝗜𝗦𝗦𝗘𝗭 𝗟𝗔 𝗤𝗨𝗔𝗟𝗜𝗧𝗘́ :
${border}

┌─────────────────────────────────┐
│                                 │
│  📊 𝟯𝟲𝟬𝗽 ─ Qualité Standard     │
│     ├─ Taille : ${formatFileSize('360p')}    │
│     └─ ${getQualityStars('360p')} Recommandé      │
│                                 │
│  💎 𝟳𝟮𝟬𝗽 ─ Haute Définition HD  │
│     ├─ Taille : ${formatFileSize('720p')}  │
│     └─ ${getQualityStars('720p')} Premium    │
│                                 │
└─────────────────────────────────┘

💬 𝗘𝗻𝘃𝗼𝘆𝗲𝘇 : 360p ou 720p
            `.trim());
            return true;
        }
    }
    return false;
};

module.exports.handleQuality = async (senderId, qualityInput) => {
    const userSession = userSessions.get(senderId);
    
    if (userSession && userSession.pendingQuality && userSession.selectedFilm) {
        if (isQualityInput(qualityInput)) {
            const quality = normalizeQuality(qualityInput);
            await handleFilmDownload(senderId, userSession.selectedFilm, quality);
            return true;
        }
    }
    return false;
};

module.exports.hasActiveSession = (senderId) => {
    const session = userSessions.get(senderId);
    return session && (session.films || session.pendingQuality);
};

module.exports.clearSession = (senderId) => {
    userSessions.delete(senderId);
};
