const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const API_BASE = 'https://daylimotion-film.onrender.com';

const userSessions = new Map();

const QUALITY_OPTIONS = ['360p', '720p'];

async function axiosWithRetry(url, options = {}, retries = 5) {
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
            
            const status = error.response?.status;
            if (status === 404 || status === 502 || status === 503 || status === 504 || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
                const waitTime = attempt * 5000;
                console.log(`Attente ${waitTime}ms avant nouvelle tentative (serveur en réveil)...`);
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
                    await sendMessage(senderId, `
❌ 𝗤𝘂𝗮𝗹𝗶𝘁𝗲́ 𝗶𝗻𝘃𝗮𝗹𝗶𝗱𝗲 ❌
━━━━━━━━━━━━━━━━━━━
Veuillez choisir une qualité valide :

📊 360p - Qualité standard (recommandé)
📊 720p - Haute qualité (HD)

💡 Tapez : 360p ou 720p
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
                    
                    await sendMessage(senderId, `
🎬 𝗙𝗜𝗟𝗠 𝗦𝗘́𝗟𝗘𝗖𝗧𝗜𝗢𝗡𝗡𝗘́ 🎬
━━━━━━━━━━━━━━━━━━━
📽️ ${selectedFilm.titre}
⏱️ Durée : ${formatDuration(selectedFilm.duree)}

📊 𝗤𝘂𝗲𝗹𝗹𝗲 𝗾𝘂𝗮𝗹𝗶𝘁𝗲́ 𝘀𝗼𝘂𝗵𝗮𝗶𝘁𝗲𝘇-𝘃𝗼𝘂𝘀 ?
━━━━━━━━━━━━━━━━━━━
1. 360p - Qualité standard (fichier plus léger)
2. 720p - Haute qualité HD (meilleure image)

💡 Envoyez : 360p ou 720p
                    `.trim());
                } else {
                    await sendMessage(senderId, `
❌ 𝗡𝘂𝗺𝗲́𝗿𝗼 𝗶𝗻𝘃𝗮𝗹𝗶𝗱𝗲 ❌
━━━━━━━━━━━━━━━━━━━
Veuillez choisir un numéro entre 1 et ${userSession.films.length}.
                    `.trim());
                }
            } else if (input.toLowerCase().startsWith('page ')) {
                const pageNum = parseInt(input.replace(/^page\s+/i, ''));
                if (!isNaN(pageNum) && pageNum > 0 && userSession.query) {
                    await handleFilmSearch(senderId, userSession.query, pageNum);
                } else if (!userSession.query) {
                    await sendMessage(senderId, `
❌ 𝗔𝘂𝗰𝘂𝗻𝗲 𝗿𝗲𝗰𝗵𝗲𝗿𝗰𝗵𝗲 𝗮𝗰𝘁𝗶𝘃𝗲 ❌
━━━━━━━━━━━━━━━━━━━
Veuillez d'abord effectuer une recherche.
Exemple : film Jackie Chan
                    `.trim());
                } else {
                    await sendMessage(senderId, `
❌ 𝗡𝘂𝗺𝗲́𝗿𝗼 𝗱𝗲 𝗽𝗮𝗴𝗲 𝗶𝗻𝘃𝗮𝗹𝗶𝗱𝗲 ❌
━━━━━━━━━━━━━━━━━━━
Utilisez : film page <numéro>
Exemple : film page 2
                    `.trim());
                }
            } else {
                await handleFilmSearch(senderId, input, 1);
            }
        } else {
            await sendMessage(senderId, `
🎬 𝗙𝗜𝗟𝗠 𝗦𝗘𝗔𝗥𝗖𝗛 🎬
━━━━━━━━━━━━━━━━━━━
❌ Veuillez fournir un titre de film !

📝 𝗨𝘁𝗶𝗹𝗶𝘀𝗮𝘁𝗶𝗼𝗻 :
film <titre du film>

💡 𝗘𝘅𝗲𝗺𝗽𝗹𝗲𝘀 :
film Jackie Chan
film Donnie Yen
film Fast and Furious

🔢 Après la recherche :
1. Envoyez le numéro du film (1, 2, 3...)
2. Choisissez la qualité (360p ou 720p)
3. Cliquez sur le lien pour télécharger

📄 𝗣𝗮𝗴𝗶𝗻𝗮𝘁𝗶𝗼𝗻 :
film page 2
            `.trim());
        }

    } catch (error) {
        console.error('Erreur commande film:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 ❌
━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite.
Veuillez réessayer plus tard.
        `.trim());
    }
};

async function handleFilmSearch(senderId, query, page = 1) {
    try {
        await sendMessage(senderId, `🔍 Recherche de films "${query}" (page ${page}) en cours... ⏳`);
        
        const searchUrl = `${API_BASE}/recherche?video=${encodeURIComponent(query)}&page=${page}`;
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
            
            let headerText = `
🎬 𝗥𝗘́𝗦𝗨𝗟𝗧𝗔𝗧𝗦 𝗙𝗜𝗟𝗠𝗦 🎬
━━━━━━━━━━━━━━━━━━━
🔎 Recherche : ${query}
📄 Page : ${currentPage}
📊 Résultats : ${totalResults} films trouvés
🎞️ Filtre : Films de 1h30 minimum
━━━━━━━━━━━━━━━━━━━
            `.trim();
            
            await sendMessage(senderId, headerText);
            
            const maxFilms = Math.min(films.length, 10);
            
            for (let i = 0; i < maxFilms; i++) {
                const film = films[i];
                const title = film.titre.length > 60 ? film.titre.substring(0, 57) + '...' : film.titre;
                const duration = formatDuration(film.duree);
                
                const filmInfo = `
${i + 1}️⃣ 𝗧𝗶𝘁𝗿𝗲 : ${title}
⏱️ 𝗗𝘂𝗿𝗲́𝗲 : ${duration}
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
                
                await new Promise(resolve => setTimeout(resolve, 400));
            }
            
            let paginationInfo = '';
            if (hasNextPage || currentPage > 1) {
                paginationInfo = `\n📄 𝗣𝗮𝗴𝗶𝗻𝗮𝘁𝗶𝗼𝗻 :`;
                if (currentPage > 1) {
                    paginationInfo += `\n• film page ${currentPage - 1} - Page précédente`;
                }
                if (hasNextPage) {
                    paginationInfo += `\n• film page ${currentPage + 1} - Page suivante`;
                }
            }
            
            let footerText = `
━━━━━━━━━━━━━━━━━━━
📥 𝗘𝗻𝘃𝗼𝘆𝗲𝘇 𝗹𝗲 𝗻𝘂𝗺𝗲́𝗿𝗼 (1-${maxFilms}) 𝗽𝗼𝘂𝗿 𝘀𝗲́𝗹𝗲𝗰𝘁𝗶𝗼𝗻𝗻𝗲𝗿
📊 Qualités disponibles : 360p, 720p
${paginationInfo}

💡 Exemple : Tapez 1 pour le premier film
            `.trim();
            
            await sendMessage(senderId, footerText);

        } else {
            await sendMessage(senderId, `
❌ 𝗔𝘂𝗰𝘂𝗻 𝗿𝗲́𝘀𝘂𝗹𝘁𝗮𝘁 ❌
━━━━━━━━━━━━━━━━━━━
Aucun film trouvé pour "${query}" (page ${page}).
Veuillez essayer avec d'autres mots-clés.

💡 Conseils :
• Utilisez des mots simples
• Essayez le nom d'un acteur
• Essayez le titre en anglais
            `.trim());
        }

    } catch (error) {
        console.error('Erreur recherche film:', error.message);
        await sendMessage(senderId, `
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 𝗗𝗘 𝗥𝗘𝗖𝗛𝗘𝗥𝗖𝗛𝗘 ❌
━━━━━━━━━━━━━━━━━━━
Impossible de contacter le serveur.
Erreur: ${error.message}
Veuillez réessayer plus tard.
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
        
        await sendMessage(senderId, `
⏳ 𝗣𝗥𝗘́𝗣𝗔𝗥𝗔𝗧𝗜𝗢𝗡 𝗗𝗨 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 ⏳
━━━━━━━━━━━━━━━━━━━
🎬 ${film.titre.substring(0, 50)}${film.titre.length > 50 ? '...' : ''}
📊 Qualité : ${quality}
⏱️ Durée : ${formatDuration(film.duree)}

Génération du lien en cours...
        `.trim());

        const qualityNum = quality.replace('p', '');
        const downloadUrl = `${API_BASE}/telecharger/${film.video_id}?quality=${qualityNum}`;
        
        console.log('URL de téléchargement:', downloadUrl);
        
        await sendMessage(senderId, `
✅ 𝗟𝗜𝗘𝗡 𝗗𝗘 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 𝗣𝗥𝗘̂𝗧 ✅
━━━━━━━━━━━━━━━━━━━
🎬 ${film.titre}
📊 Qualité : ${quality}
⏱️ Durée : ${formatDuration(film.duree)}

📥 𝗖𝗹𝗶𝗾𝘂𝗲𝘇 𝘀𝘂𝗿 𝗹𝗲 𝗹𝗶𝗲𝗻 𝗰𝗶-𝗱𝗲𝘀𝘀𝗼𝘂𝘀 :
        `.trim());
        
        await sendMessage(senderId, downloadUrl);
        
        await sendMessage(senderId, `
💡 Le téléchargement démarrera automatiquement
📱 Le fichier sera enregistré sur votre téléphone

🔄 Tapez "film" pour une nouvelle recherche
        `.trim());

    } catch (error) {
        console.error('Erreur téléchargement film:', error.message);
        
        await sendMessage(senderId, `
⚠️ 𝗘𝗥𝗥𝗘𝗨𝗥 𝗗𝗘 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 ⚠️
━━━━━━━━━━━━━━━━━━━
❌ Erreur: ${error.message}
📥 Veuillez réessayer plus tard.
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
            
            await sendMessage(senderId, `
🎬 𝗙𝗜𝗟𝗠 𝗦𝗘́𝗟𝗘𝗖𝗧𝗜𝗢𝗡𝗡𝗘́ 🎬
━━━━━━━━━━━━━━━━━━━
📽️ ${selectedFilm.titre}
⏱️ Durée : ${formatDuration(selectedFilm.duree)}

📊 𝗤𝘂𝗲𝗹𝗹𝗲 𝗾𝘂𝗮𝗹𝗶𝘁𝗲́ 𝘀𝗼𝘂𝗵𝗮𝗶𝘁𝗲𝘇-𝘃𝗼𝘂𝘀 ?
━━━━━━━━━━━━━━━━━━━
1. 360p - Qualité standard (fichier plus léger)
2. 720p - Haute qualité HD (meilleure image)

💡 Envoyez : 360p ou 720p
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
