
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
                    // Appel à l'API de téléchargement
                    const downloadUrl = `https://kaiz-apis.gleeze.com/api/ytdown-mp3?url=${encodeURIComponent(selectedVideo.url)}`;
                    const downloadResponse = await axios.get(downloadUrl);
                    
                    // Extraire les informations de la réponse
                    const { title, download_url } = downloadResponse.data;
                    
                    // Formater un message avec le lien de téléchargement
                    const message = `📥 *Téléchargement Prêt* 📥\n\n🎵 *Titre*: ${title}\n\n💾 [Cliquez ici pour télécharger](${download_url})`;
                    
                    // Envoyer le message avec le lien de téléchargement
                    await sendMessage(senderId, message);
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
            
            // Appel à l'API de recherche
            const searchUrl = `https://youtube-api-milay.vercel.app/recherche?titre=${encodeURIComponent(prompt)}`;
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
