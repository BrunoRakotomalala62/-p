
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const sendMessage = require('../handles/sendMessage');

// État pour suivre les téléchargements actifs par utilisateur
const activeDownloads = {};

module.exports = async (senderId, prompt, api) => {
    // Cette commande fonctionne automatiquement quand un lien est détecté
    await sendMessage(senderId, "⚠️ Cette commande fonctionne automatiquement lorsque vous envoyez un lien vidéo (YouTube, TikTok, Facebook, Instagram, etc.).\n\n📱 Il suffit d'envoyer le lien et le téléchargement commencera automatiquement!");
    
    return { skipCommandCheck: true };
};

// Fonction pour détecter et traiter les liens automatiquement
const handleAutoDownload = async (senderId, messageText, api) => {
    // Patterns pour détecter les liens vidéo
    const videoLinkPatterns = [
        /https?:\/\/(www\.)?(youtube\.com|youtu\.be)/i,
        /https?:\/\/(www\.)?(tiktok\.com)/i,
        /https?:\/\/(www\.)?(facebook\.com|fb\.watch)/i,
        /https?:\/\/(www\.)?(instagram\.com)/i,
        /https?:\/\/(www\.)?(twitter\.com|x\.com)/i,
        /https?:\/\/(www\.)?(pinterest\.com)/i
    ];

    // Vérifier si le message contient un lien vidéo
    const containsVideoLink = videoLinkPatterns.some(pattern => pattern.test(messageText));
    
    if (!containsVideoLink) {
        return false; // Pas un lien vidéo
    }

    // Extraire l'URL du message
    const urlMatch = messageText.match(/https?:\/\/[^\s]+/i);
    if (!urlMatch) {
        return false;
    }

    const videoUrl = urlMatch[0];

    // Vérifier si un téléchargement est déjà en cours pour cet utilisateur
    if (activeDownloads[senderId]) {
        await sendMessage(senderId, "⚠️ Un téléchargement est déjà en cours. Veuillez patienter...");
        return true;
    }

    try {
        // Marquer comme téléchargement actif
        activeDownloads[senderId] = true;

        // Ajouter une réaction pour indiquer le début du téléchargement
        if (api && api.setMessageReaction) {
            await api.setMessageReaction("⏳", senderId);
        }

        await sendMessage(senderId, "⏳ Téléchargement en cours, veuillez patienter...");

        // Utiliser l'API de téléchargement (remplacez par votre API préférée)
        const downloadApiUrl = `https://api-improve-production.up.railway.app/alldown?url=${encodeURIComponent(videoUrl)}`;
        
        const response = await axios.get(downloadApiUrl, { timeout: 30000 });
        
        if (!response.data || !response.data.url) {
            throw new Error("Aucune URL de téléchargement trouvée");
        }

        const downloadUrl = response.data.url;
        
        // Changer la réaction pour indiquer le téléchargement
        if (api && api.setMessageReaction) {
            await api.setMessageReaction("⬇️", senderId);
        }

        // Télécharger le fichier vidéo
        const videoResponse = await axios.get(downloadUrl, { 
            responseType: 'arraybuffer',
            timeout: 60000,
            maxContentLength: 50 * 1024 * 1024 // Limite à 50MB
        });

        // Créer le dossier temp s'il n'existe pas
        const tempDir = path.join(__dirname, '../temp');
        await fs.ensureDir(tempDir);

        // Sauvegarder le fichier
        const fileName = `autodl_${senderId}_${Date.now()}.mp4`;
        const filePath = path.join(tempDir, fileName);
        
        await fs.writeFile(filePath, videoResponse.data);

        // Envoyer le fichier via Facebook Messenger API
        const accessToken = process.env.FB_ACCESS_TOKEN;
        const formData = new FormData();
        
        // Créer le message avec pièce jointe
        const messageData = {
            recipient: { id: senderId },
            message: {
                text: `🔥🚀 AUTO DOWNLOADER | 🔥💻\n📥⚡𝗔𝘂𝘁𝗼 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗿⚡📂\n🎬 Votre vidéo est prête!`,
                attachment: {
                    type: "video",
                    payload: {
                        url: downloadUrl,
                        is_reusable: false
                    }
                }
            }
        };

        // Envoyer via l'API Messenger
        await axios.post(`https://graph.facebook.com/v11.0/me/messages?access_token=${accessToken}`, messageData);

        // Réaction de succès
        if (api && api.setMessageReaction) {
            await api.setMessageReaction("✅", senderId);
        }

        // Nettoyer le fichier temporaire
        await fs.unlink(filePath);

    } catch (error) {
        console.error("❌ Erreur lors du téléchargement automatique:", error);
        
        await sendMessage(senderId, `❌ Échec du téléchargement automatique.\n\n🔧 Raison possible:\n• Lien non supporté\n• Fichier trop volumineux\n• Erreur de connexion\n\n💡 Essayez avec un autre lien ou utilisez les commandes spécifiques (ytb, tiktok, etc.)`);
        
        // Réaction d'erreur
        if (api && api.setMessageReaction) {
            await api.setMessageReaction("❌", senderId);
        }
    } finally {
        // Libérer le verrou de téléchargement
        delete activeDownloads[senderId];
    }

    return true; // Lien traité
};

// Exporter la fonction de gestion automatique
module.exports.handleAutoDownload = handleAutoDownload;

// Informations de la commande
module.exports.info = {
    name: "autodl",
    description: "Télécharge automatiquement les vidéos quand un lien est envoyé",
    usage: "Envoyez simplement un lien vidéo (YouTube, TikTok, Facebook, Instagram, etc.)"
};
