
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sendMessage = require('../handles/sendMessage');

module.exports = async (senderId, userText, event) => {
    try {
        // Vérifier si c'est une réponse à un message
        if (!event.message.reply_to) {
            await sendMessage(senderId, "❗ Veuillez répondre à un message contenant exactement 2 images pour effectuer le face swap.");
            return;
        }

        // Récupérer les pièces jointes du message auquel on répond
        const attachments = event.message.reply_to.attachments;
        
        if (!attachments || attachments.length !== 2) {
            await sendMessage(senderId, "❗ Vous devez répondre à un message contenant exactement 2 images.");
            return;
        }

        // Vérifier que les deux pièces jointes sont des images
        const [baseImage, swapImage] = attachments;
        
        if (baseImage.type !== "image" || swapImage.type !== "image") {
            await sendMessage(senderId, "❗ Les deux pièces jointes doivent être des images.");
            return;
        }

        // Envoyer un message de confirmation que le traitement commence
        await sendMessage(senderId, "🔄 Face swap en cours... Veuillez patienter.");

        // Préparer les URLs pour l'API
        const baseUrl = encodeURIComponent(baseImage.payload.url);
        const swapUrl = encodeURIComponent(swapImage.payload.url);

        // Construire l'URL de l'API
        const apiUrl = `https://kaiz-apis.gleeze.com/api/faceswap?baseUrl=${baseUrl}&swapUrl=${swapUrl}&apikey=`;

        // Faire l'appel à l'API
        const response = await axios.get(apiUrl, { 
            responseType: 'arraybuffer',
            timeout: 30000 // 30 secondes de timeout
        });

        // Créer le répertoire cache s'il n'existe pas
        const cacheDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }

        // Sauvegarder l'image résultante
        const filePath = path.join(cacheDir, `faceswap_${Date.now()}.png`);
        fs.writeFileSync(filePath, Buffer.from(response.data));

        // Envoyer l'image résultante
        await sendMessage(senderId, {
            attachment: {
                type: 'image',
                payload: {
                    url: `file://${filePath}`,
                    is_reusable: true
                }
            }
        });

        // Envoyer un message de confirmation
        await sendMessage(senderId, "✅ Face swap terminé avec succès!");

        // Nettoyer le fichier temporaire après un délai
        setTimeout(() => {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }, 60000); // Supprimer après 1 minute

    } catch (error) {
        console.error('Erreur lors du face swap:', error);
        
        let errorMessage = "❌ Une erreur s'est produite lors du face swap.";
        
        if (error.code === 'ECONNABORTED') {
            errorMessage = "❌ Timeout: Le traitement a pris trop de temps. Veuillez réessayer avec des images plus petites.";
        } else if (error.response && error.response.status === 400) {
            errorMessage = "❌ Erreur: Impossible de détecter des visages dans les images fournies.";
        } else if (error.response && error.response.status === 500) {
            errorMessage = "❌ Erreur serveur: Le service de face swap est temporairement indisponible.";
        }
        
        await sendMessage(senderId, errorMessage);
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "faceswap",
    description: "Effectue un échange de visages entre deux images. Répondez à un message contenant exactement 2 images.",
    usage: "Répondez à un message avec 2 images en tapant 'faceswap'"
};
