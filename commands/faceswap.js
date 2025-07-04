
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sendMessage = require('../handles/sendMessage');

module.exports = async (senderId, userText, event) => {
    try {
        // Vérifier si c'est une réponse à un message
        if (!event.message.reply_to && !event.message.attachments) {
            await sendMessage(senderId, "❗ Veuillez répondre à un message contenant exactement 2 images pour effectuer le face swap, ou envoyer 2 images avec la commande 'faceswap'.");
            return;
        }

        let attachments = [];

        // Vérifier les pièces jointes dans le message actuel
        if (event.message.attachments && event.message.attachments.length > 0) {
            attachments = event.message.attachments;
        }
        // Sinon vérifier dans le message de réponse
        else if (event.message.reply_to && event.message.reply_to.attachments) {
            attachments = event.message.reply_to.attachments;
        }

        // Vérifier qu'il y a exactement 2 images
        if (!attachments || attachments.length !== 2) {
            await sendMessage(senderId, "❗ Vous devez fournir exactement 2 images. Actuellement vous avez envoyé " + (attachments ? attachments.length : 0) + " image(s).");
            return;
        }

        // Vérifier que les deux pièces jointes sont des images
        const imageAttachments = attachments.filter(att => 
            att.type === "image" || 
            (att.payload && att.payload.url && 
             (att.payload.url.includes('.jpg') || att.payload.url.includes('.jpeg') || 
              att.payload.url.includes('.png') || att.payload.url.includes('.gif')))
        );

        if (imageAttachments.length !== 2) {
            await sendMessage(senderId, "❗ Les deux pièces jointes doivent être des images valides.");
            return;
        }

        const [baseImage, swapImage] = imageAttachments;

        // Envoyer un message de confirmation que le traitement commence
        await sendMessage(senderId, "🔄 Face swap en cours... Veuillez patienter.");

        // Préparer les URLs pour l'API
        const baseUrl = encodeURIComponent(baseImage.payload.url);
        const swapUrl = encodeURIComponent(swapImage.payload.url);

        // Construire l'URL de l'API (ajoutez votre clé API ici)
        const apiUrl = `https://kaiz-apis.gleeze.com/api/faceswap?baseUrl=${baseUrl}&swapUrl=${swapUrl}&apikey=kaiz`;

        console.log("Appel API faceswap:", apiUrl);

        // Faire l'appel à l'API
        const response = await axios.get(apiUrl, { 
            responseType: 'arraybuffer',
            timeout: 30000 // 30 secondes de timeout
        });

        // Créer le répertoire temp s'il n'existe pas
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Sauvegarder l'image résultante
        const fileName = `faceswap_${Date.now()}.png`;
        const filePath = path.join(tempDir, fileName);
        fs.writeFileSync(filePath, Buffer.from(response.data));

        // Envoyer l'image résultante en utilisant le format compatible avec votre bot
        await sendMessage(senderId, {
            files: [filePath],
            type: 'image'
        });

        // Envoyer un message de confirmation
        await sendMessage(senderId, "✅ Face swap terminé avec succès!");

        // Nettoyer le fichier temporaire après un délai
        setTimeout(() => {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`Fichier temporaire supprimé: ${filePath}`);
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
        } else if (error.response) {
            errorMessage = `❌ Erreur API: ${error.response.status} - ${error.response.statusText}`;
        }
        
        await sendMessage(senderId, errorMessage);
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "faceswap",
    description: "Effectue un échange de visages entre deux images. Envoyez 2 images avec 'faceswap' ou répondez à un message contenant 2 images.",
    usage: "Envoyez 2 images avec 'faceswap' ou répondez à un message avec 2 images"
};
