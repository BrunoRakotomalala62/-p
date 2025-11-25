
const sendMessage = require('../handles/sendMessage');
const axios = require('axios');

// API de base
const API_BASE_URL = 'https://creation-api.vercel.app';

// Stockage des recherches et sélections des utilisateurs
const userSearches = {};

module.exports = async (senderId, prompt) => {
    try {
        // Initialiser le contexte utilisateur si nécessaire
        if (!userSearches[senderId]) {
            userSearches[senderId] = {
                query: '',
                videos: [],
                selectedVideo: null,
                step: 'search' // search -> select_video -> select_format
            };
        }

        const userContext = userSearches[senderId];

        // Étape 3: Sélection du format (MP3 ou MP4)
        if (userContext.step === 'select_format' && userContext.selectedVideo) {
            const choice = prompt.trim().toUpperCase();
            
            if (choice === 'MP3' || choice === 'MP4') {
                // Message d'attente
                await sendMessage(senderId, "⏳ Préparation du téléchargement en cours...");
                
                try {
                    const videoUrl = userContext.selectedVideo.url;
                    let quality = 'highest'; // Par défaut
                    
                    // Pour MP4, demander la qualité si on veut être plus précis
                    // Pour l'instant, on utilise "highest" par défaut
                    
                    // Construire l'URL de streaming direct
                    const streamUrl = `${API_BASE_URL}/stream?urlytb=${encodeURIComponent(videoUrl)}&type=${choice}&quality=${quality}`;
                    
                    // Obtenir les informations avec /download d'abord
                    const downloadUrl = `${API_BASE_URL}/download?urlytb=${encodeURIComponent(videoUrl)}&type=${choice}&quality=${quality}`;
                    
                    try {
                        const response = await axios.get(downloadUrl, { timeout: 30000 });
                        
                        if (response.data && response.data.success) {
                            const videoInfo = response.data;
                            
                            // Construire le message de réponse
                            const messageText = `
🎵 ${choice === 'MP3' ? '𝗠𝗨𝗦𝗜𝗖' : '𝗩𝗜𝗗𝗘𝗢'} 𝗥𝗘𝗦𝗨𝗟𝗧 🎵
━━━━━━━━━━━━━━━━━━━

🎤 𝗧𝗶𝘁𝗿𝗲 : ${videoInfo.title || userContext.selectedVideo.title}

⏱️ 𝗗𝘂𝗿𝗲́𝗲 : ${videoInfo.duration || userContext.selectedVideo.duration}

📱 𝗙𝗼𝗿𝗺𝗮𝘁 : ${choice}

🎯 𝗤𝘂𝗮𝗹𝗶𝘁𝗲́ : ${videoInfo.quality || quality}

📥 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 𝗗𝗜𝗥𝗘𝗖𝗧 :
${streamUrl}

━━━━━━━━━━━━━━━━━━━
✨ 𝗖𝗹𝗶𝗾𝘂𝗲𝘇 𝘀𝘂𝗿 𝗹𝗲 𝗹𝗶𝗲𝗻 𝗽𝗼𝘂𝗿 𝘁𝗲́𝗹𝗲́𝗰𝗵𝗮𝗿𝗴𝗲𝗿 𝗱𝗶𝗿𝗲𝗰𝘁𝗲𝗺𝗲𝗻𝘁 𝘃𝗲𝗿𝘀 𝘃𝗼𝘁𝗿𝗲 𝘁𝗲́𝗹𝗲́𝗽𝗵𝗼𝗻𝗲 ! 📲
                            `.trim();

                            // Envoyer l'image de la miniature si disponible
                            if (userContext.selectedVideo.thumb) {
                                await sendMessage(senderId, {
                                    attachment: {
                                        type: 'image',
                                        payload: {
                                            url: userContext.selectedVideo.thumb,
                                            is_reusable: true
                                        }
                                    }
                                });
                            }

                            // Envoyer le message texte avec le lien
                            await sendMessage(senderId, messageText);
                            
                        } else {
                            // Vérifier si c'est une erreur de protection YouTube
                            const errorMsg = response.data.error || '';
                            if (errorMsg.includes('Sign in to confirm') || errorMsg.includes('bot')) {
                                const blockedMessage = `
⚠️ 𝗩𝗜𝗗𝗘́𝗢 𝗣𝗥𝗢𝗧𝗘́𝗚𝗘́𝗘 ⚠️
━━━━━━━━━━━━━━━━━━━

❌ Cette vidéo est protégée par YouTube et ne peut pas être téléchargée automatiquement.

🎤 𝗧𝗶𝘁𝗿𝗲 : ${userContext.selectedVideo.title}

━━━━━━━━━━━━━━━━━━━
💡 𝗦𝗼𝗹𝘂𝘁𝗶𝗼𝗻𝘀 :

1️⃣ Essayez une autre vidéo de votre recherche
2️⃣ Cherchez une version différente de cette chanson
3️⃣ Téléchargez directement depuis YouTube

━━━━━━━━━━━━━━━━━━━
ℹ️ Certaines vidéos ont des protections YouTube qui bloquent le téléchargement automatique.
                                `.trim();
                                
                                await sendMessage(senderId, blockedMessage);
                            } else {
                                // Autre erreur, envoyer le lien quand même
                                const messageText = `
🎵 ${choice === 'MP3' ? '𝗠𝗨𝗦𝗜𝗖' : '𝗩𝗜𝗗𝗘𝗢'} 𝗥𝗘𝗦𝗨𝗟𝗧 🎵
━━━━━━━━━━━━━━━━━━━

🎤 𝗧𝗶𝘁𝗿𝗲 : ${userContext.selectedVideo.title}

⏱️ 𝗗𝘂𝗿𝗲́𝗲 : ${userContext.selectedVideo.duration}

📱 𝗙𝗼𝗿𝗺𝗮𝘁 : ${choice}

📥 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 𝗗𝗜𝗥𝗘𝗖𝗧 :
${streamUrl}

━━━━━━━━━━━━━━━━━━━
✨ 𝗖𝗹𝗶𝗾𝘂𝗲𝘇 𝘀𝘂𝗿 𝗹𝗲 𝗹𝗶𝗲𝗻 𝗽𝗼𝘂𝗿 𝘁𝗲́𝗹𝗲́𝗰𝗵𝗮𝗿𝗴𝗲𝗿 ! 📲
⚠️ Si le lien ne fonctionne pas, essayez une autre vidéo.
                                `.trim();

                                // Envoyer l'image de la miniature si disponible
                                if (userContext.selectedVideo.thumb) {
                                    await sendMessage(senderId, {
                                        attachment: {
                                            type: 'image',
                                            payload: {
                                                url: userContext.selectedVideo.thumb,
                                                is_reusable: true
                                            }
                                        }
                                    });
                                }

                                await sendMessage(senderId, messageText);
                            }
                        }
                    } catch (error) {
                        // En cas d'erreur, envoyer quand même le lien de streaming direct
                        console.error("Erreur lors de la récupération des infos:", error.message);
                        
                        const messageText = `
🎵 ${choice === 'MP3' ? '𝗠𝗨𝗦𝗜𝗖' : '𝗩𝗜𝗗𝗘𝗢'} 𝗥𝗘𝗦𝗨𝗟𝗧 🎵
━━━━━━━━━━━━━━━━━━━

🎤 𝗧𝗶𝘁𝗿𝗲 : ${userContext.selectedVideo.title}

⏱️ 𝗗𝘂𝗿𝗲́𝗲 : ${userContext.selectedVideo.duration}

📱 𝗙𝗼𝗿𝗺𝗮𝘁 : ${choice}

📥 𝗧𝗘́𝗟𝗘́𝗖𝗛𝗔𝗥𝗚𝗘𝗠𝗘𝗡𝗧 𝗗𝗜𝗥𝗘𝗖𝗧 :
${streamUrl}

━━━━━━━━━━━━━━━━━━━
✨ 𝗖𝗹𝗶𝗾𝘂𝗲𝘇 𝘀𝘂𝗿 𝗹𝗲 𝗹𝗶𝗲𝗻 𝗽𝗼𝘂𝗿 𝘁𝗲́𝗹𝗲́𝗰𝗵𝗮𝗿𝗴𝗲𝗿 ! 📲
                        `.trim();

                        // Envoyer l'image de la miniature si disponible
                        if (userContext.selectedVideo.thumb) {
                            await sendMessage(senderId, {
                                attachment: {
                                    type: 'image',
                                    payload: {
                                        url: userContext.selectedVideo.thumb,
                                        is_reusable: true
                                    }
                                }
                            });
                        }

                        await sendMessage(senderId, messageText);
                    }
                    
                    // Réinitialiser le contexte pour une nouvelle recherche
                    userContext.step = 'search';
                    userContext.selectedVideo = null;
                    
                } catch (error) {
                    console.error("Erreur lors du téléchargement:", error);
                    await sendMessage(senderId, "❌ Désolé, une erreur s'est produite lors de la préparation du téléchargement. Veuillez réessayer.");
                }
            } else {
                await sendMessage(senderId, "❌ Format invalide. Veuillez répondre avec 'MP3' ou 'MP4'.");
            }
        }
        // Étape 2: Sélection de la vidéo (numéro)
        else if (userContext.step === 'select_video' && !isNaN(prompt) && prompt > 0) {
            const videoIndex = parseInt(prompt) - 1;
            
            // Vérifier si l'index est valide
            if (videoIndex >= 0 && videoIndex < userContext.videos.length) {
                userContext.selectedVideo = userContext.videos[videoIndex];
                userContext.step = 'select_format';
                
                // Demander le format
                const formatMessage = `
✅ 𝗩𝗶𝗱𝗲́𝗼 𝘀𝗲́𝗹𝗲𝗰𝘁𝗶𝗼𝗻𝗻𝗲́𝗲 :
📌 ${userContext.selectedVideo.title}

━━━━━━━━━━━━━━━━━━━

𝗖𝗵𝗼𝗶𝘀𝗶𝘀𝘀𝗲𝘇 𝗹𝗲 𝗳𝗼𝗿𝗺𝗮𝘁 :

🎵 MP3 - Audio seulement (128kbps)
🎬 MP4 - Vidéo (qualité: highest par défaut)

━━━━━━━━━━━━━━━━━━━
💬 𝗥𝗲́𝗽𝗼𝗻𝗱𝗲𝘇 𝗮𝘃𝗲𝗰 : MP3 ou MP4
                `.trim();
                
                await sendMessage(senderId, formatMessage);
            } else {
                await sendMessage(senderId, "❌ Numéro de vidéo invalide. Veuillez choisir un numéro valide.");
            }
        }
        // Étape 1: Nouvelle recherche
        else {
            // Réinitialiser le contexte pour une nouvelle recherche
            userContext.step = 'select_video';
            userContext.selectedVideo = null;
            
            // Message d'attente
            await sendMessage(senderId, "🔍 Recherche en cours...");
            
            // Appel à l'API de recherche YouTube
            const searchUrl = `${API_BASE_URL}/recherche?titre=${encodeURIComponent(prompt)}`;
            const searchResponse = await axios.get(searchUrl, { timeout: 30000 });
            
            // Vérifier si des vidéos ont été trouvées
            if (searchResponse.data && searchResponse.data.success && searchResponse.data.videos && searchResponse.data.videos.length > 0) {
                // Stocker les vidéos pour cet utilisateur
                userContext.query = prompt;
                
                // Limiter à 80 résultats maximum
                const allVideos = searchResponse.data.videos.slice(0, 80);
                userContext.videos = allVideos;
                
                // Envoyer les résultats par groupes de 20
                const BATCH_SIZE = 20;
                const totalBatches = Math.ceil(allVideos.length / BATCH_SIZE);
                
                for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
                    const startIndex = batchIndex * BATCH_SIZE;
                    const endIndex = Math.min(startIndex + BATCH_SIZE, allVideos.length);
                    const batchVideos = allVideos.slice(startIndex, endIndex);
                    
                    // Construire le message pour ce lot
                    let message = '';
                    
                    // Ajouter le titre seulement pour le premier lot
                    if (batchIndex === 0) {
                        message = `🌟 *${prompt.toUpperCase()}* 🌟\n\n`;
                    }
                    
                    // Ajouter les vidéos de ce lot
                    batchVideos.forEach((video, index) => {
                        const globalIndex = startIndex + index + 1;
                        message += `${globalIndex}. ${video.title}\n⏱️ ${video.duration}\n\n`;
                    });
                    
                    // Ajouter les instructions seulement au dernier lot
                    if (batchIndex === totalBatches - 1) {
                        message += `━━━━━━━━━━━━━━━━━━━\n`;
                        message += `✅ *Envoyez le numéro* de la vidéo que vous souhaitez télécharger.\n\n`;
                        message += `📊 Total: ${allVideos.length} résultats trouvés`;
                    }
                    
                    // Envoyer le message pour ce lot
                    await sendMessage(senderId, message);
                    
                    // Attendre 2 secondes entre chaque lot pour éviter la surcharge
                    if (batchIndex < totalBatches - 1) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
            } else {
                await sendMessage(senderId, "❌ Aucune vidéo trouvée pour votre recherche.");
                userContext.step = 'search';
            }
        }
    } catch (error) {
        console.error("Erreur lors de l'exécution de la commande ytb:", error);
        await sendMessage(senderId, "❌ Désolé, une erreur s'est produite lors du traitement de votre demande. Veuillez réessayer.");
        
        // Réinitialiser le contexte en cas d'erreur
        if (userSearches[senderId]) {
            userSearches[senderId].step = 'search';
            userSearches[senderId].selectedVideo = null;
        }
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "ytb",
    description: "Recherche et télécharge des vidéos YouTube en format MP3 ou MP4 avec téléchargement direct.",
    usage: "Envoyez 'ytb <nom de la chanson ou artiste>' pour rechercher, puis répondez avec le numéro de la vidéo, ensuite choisissez MP3 ou MP4 pour télécharger directement."
};
