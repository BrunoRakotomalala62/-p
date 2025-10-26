
const sendMessage = require('../handles/sendMessage');
const axios = require('axios');

// Stockage des recherches des utilisateurs
const userSearches = {};

module.exports = async (senderId, prompt) => {
    try {
        // Vérifier si l'utilisateur a déjà effectué une recherche
        if (!userSearches[senderId]) {
            userSearches[senderId] = {
                query: '',
                videos: []
            };
        }

        // Si l'entrée est un nombre, c'est une sélection de vidéo pour téléchargement
        if (!isNaN(prompt) && prompt > 0) {
            const videoIndex = parseInt(prompt) - 1;
            
            // Vérifier si l'index est valide
            if (videoIndex >= 0 && videoIndex < userSearches[senderId].videos.length) {
                const selectedVideo = userSearches[senderId].videos[videoIndex];
                
                // Message d'attente
                await sendMessage(senderId, "⏳ Préparation du téléchargement en cours...");
                
                try {
                    // Utiliser l'API ytmusic pour obtenir les informations de téléchargement
                    const searchUrl = `https://api-library-kohi.onrender.com/api/ytmusic?query=${encodeURIComponent(selectedVideo.title)}`;
                    const searchResponse = await axios.get(searchUrl);
                    
                    if (searchResponse.data && searchResponse.data.status && searchResponse.data.data) {
                        const musicData = searchResponse.data.data;
                        
                        // Construire le message de réponse
                        const messageText = `
🎵 𝗠𝗨𝗦𝗜𝗖 𝗥𝗘𝗦𝗨𝗟𝗧 🎵
━━━━━━━━━━━━━━━━━━━

🎤 𝗧𝗶𝘁𝗿𝗲 : ${musicData.title}

⏱️ 𝗗𝘂𝗿𝗲́𝗲 : ${musicData.duration}

👁️ 𝗩𝘂𝗲𝘀 : ${musicData.views.toLocaleString()}

🔗 𝗟𝗶𝗲𝗻 : ${musicData.url}

🎧 𝗔𝘂𝗱𝗶𝗼 : ${musicData.audioUrl}

━━━━━━━━━━━━━━━━━━━
✨ 𝗕𝗼𝗻𝗻𝗲 𝗲́𝗰𝗼𝘂𝘁𝗲 ! 🎶
                        `.trim();

                        // Envoyer l'image de la miniature
                        await sendMessage(senderId, {
                            attachment: {
                                type: 'image',
                                payload: {
                                    url: musicData.thumbnail,
                                    is_reusable: true
                                }
                            }
                        });

                        // Envoyer le message texte
                        await sendMessage(senderId, messageText);
                        
                    } else {
                        await sendMessage(senderId, "❌ Impossible de récupérer le lien de téléchargement.");
                    }
                } catch (error) {
                    console.error("Erreur lors du téléchargement:", error);
                    await sendMessage(senderId, "❌ Désolé, une erreur s'est produite lors de la préparation du téléchargement.");
                }
            } else {
                await sendMessage(senderId, "❌ Numéro de vidéo invalide. Veuillez choisir un numéro valide.");
            }
        } else {
            // C'est une nouvelle recherche
            // Message d'attente
            await sendMessage(senderId, "🔍 Recherche en cours...");
            
            // Appel à l'API de recherche YouTube
            const searchUrl = `https://api-youtube-vraie-vercel.vercel.app/recherche?titre=${encodeURIComponent(prompt)}`;
            const searchResponse = await axios.get(searchUrl);
            
            // Vérifier si des vidéos ont été trouvées
            if (searchResponse.data && searchResponse.data.videos && searchResponse.data.videos.length > 0) {
                // Stocker les vidéos pour cet utilisateur
                userSearches[senderId].query = prompt;
                userSearches[senderId].videos = searchResponse.data.videos;
                
                // Construire la liste des vidéos
                let message = `🌟 *${prompt.toUpperCase()}* 🌟\n\n`;
                
                searchResponse.data.videos.forEach((video, index) => {
                    message += `${index + 1}- ${video.title}\n\n`;
                });
                
                message += "✅ *Envoyez le numéro* de la vidéo que vous souhaitez télécharger.";
                
                // Envoyer la liste des vidéos
                await sendMessage(senderId, message);
            } else {
                await sendMessage(senderId, "❌ Aucune vidéo trouvée pour votre recherche.");
            }
        }
    } catch (error) {
        console.error("Erreur lors de l'exécution de la commande ytb:", error);
        await sendMessage(senderId, "❌ Désolé, une erreur s'est produite lors du traitement de votre demande.");
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "ytb",
    description: "Recherche et télécharge des vidéos YouTube en format MP3.",
    usage: "Envoyez 'ytb <nom de la chanson ou artiste>' pour rechercher, puis répondez avec le numéro de la vidéo pour télécharger."
};
