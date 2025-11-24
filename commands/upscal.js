const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

module.exports = async (senderId, prompt, uid, imageAttachments) => {
    try {
        // Vérifier si une image a été envoyée
        if (!imageAttachments || imageAttachments.length === 0) {
            await sendMessage(senderId, `🖼️ UPSCALE IMAGE - AMÉLIORATION DE QUALITÉ 🖼️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ Aucune image détectée !

📝 Utilisation :
1️⃣ Envoyez une image en pièce jointe
2️⃣ Tapez : upscal
3️⃣ Attendez que votre image soit améliorée

💡 Cette commande améliore la résolution et la qualité de vos images !

⚠️ Note : Le traitement peut prendre quelques secondes selon la taille de l'image.`);
            return;
        }

        // Récupérer l'URL de la première image attachée
        const imageUrl = imageAttachments[0].payload.url;

        // Envoyer un message de confirmation
        await sendMessage(senderId, `🎨 Amélioration de la qualité de votre image en cours...
⏳ Veuillez patienter, cela peut prendre quelques instants...

📊 Processus en cours :
✓ Image reçue
⏳ Upscaling en cours...`);

        // Appeler l'API pour upscaler l'image
        const apiUrl = `https://norch-project.gleeze.com/api/upscale-image?imageUrl=${encodeURIComponent(imageUrl)}`;
        
        const response = await axios.get(apiUrl, {
            timeout: 120000 // Timeout de 2 minutes pour le traitement
        });

        // Vérifier si la réponse est valide
        if (response.data && response.data.success && response.data.resultImageUrl) {
            const resultImageUrl = response.data.resultImageUrl;
            const author = response.data.author || 'API';
            
            // Envoyer un message de succès
            await sendMessage(senderId, `✅ Amélioration terminée avec succès !

👤 Author : ${author}
🎯 Statut : Image upscalée avec succès

📤 Envoi de l'image améliorée...`);

            // Attendre un peu avant d'envoyer l'image
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Envoyer l'image upscalée
            await sendMessage(senderId, {
                files: [resultImageUrl],
                type: 'image'
            });

            // Confirmation finale
            await sendMessage(senderId, `🎉 Image envoyée avec succès !

✨ Votre image a été améliorée et envoyée !
🔗 URL directe : ${resultImageUrl}

💡 Astuce : Vous pouvez envoyer une nouvelle image pour l'améliorer à nouveau.`);

        } else {
            // Si la réponse n'est pas valide
            await sendMessage(senderId, `❌ Erreur lors de l'amélioration de l'image.
⚠️ L'API n'a pas retourné de résultat valide.

💡 Suggestions :
• Vérifiez que l'image est bien lisible
• Réessayez avec une autre image
• L'image peut être trop volumineuse`);
        }

    } catch (error) {
        console.error('Erreur lors de l\'upscale de l\'image:', error);

        // Message d'erreur détaillé
        let errorMessage = "❌ Une erreur s'est produite lors de l'amélioration de l'image.\n\n";
        
        if (error.code === 'ECONNABORTED') {
            errorMessage += "⏱️ La requête a expiré. Le traitement prend trop de temps.\n";
            errorMessage += "💡 L'image est peut-être trop volumineuse. Essayez avec une image plus petite.";
        } else if (error.response) {
            errorMessage += `🔴 Erreur API : ${error.response.status}\n`;
            errorMessage += `📝 ${error.response.data?.message || 'Erreur inconnue'}\n\n`;
            errorMessage += "💡 Vérifiez que l'image est au bon format (JPG, PNG).";
        } else if (error.request) {
            errorMessage += "🌐 Impossible de contacter l'API d'upscaling.\n";
            errorMessage += "💡 Vérifiez votre connexion internet et réessayez.";
        } else {
            errorMessage += `⚠️ ${error.message}\n\n`;
            errorMessage += "💡 Réessayez avec une autre image.";
        }

        await sendMessage(senderId, errorMessage);
    }
};

// Informations de la commande
module.exports.info = {
    name: "upscal",
    description: "Améliore la qualité et la résolution d'une image envoyée en pièce jointe.",
    usage: "Envoyez une image en pièce jointe, puis tapez 'upscal' pour améliorer sa qualité.\n\nÉtapes :\n1. Attachez une image à votre message\n2. Tapez : upscal\n3. Attendez que l'image améliorée soit envoyée\n\nNote : Le traitement peut prendre quelques secondes selon la taille de l'image."
};
