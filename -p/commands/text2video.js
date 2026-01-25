const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

module.exports = async (senderId, prompt) => {
    try {
        // Vérifier si un prompt a été fourni
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, `🎬 GÉNÉRATEUR DE VIDÉO TEXT2VIDEO 🎬
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ Veuillez fournir une description pour générer la vidéo !

📝 Utilisation :
text2video <description>

💡 Exemples :
• text2video A beautiful sunset over the ocean with waves
• text2video A cat playing with a ball in a garden
• text2video Fireworks exploding in the night sky

⚠️ Note : La génération peut prendre quelques secondes.`);
            return;
        }

        // Envoyer un message de confirmation
        await sendMessage(senderId, `🎬 Génération de la vidéo en cours...
📝 Description : "${prompt}"
⏳ Veuillez patienter, cela peut prendre quelques instants...`);

        // Appeler l'API pour générer la vidéo
        const apiUrl = `https://norch-project.gleeze.com/api/txt2video?prompt=${encodeURIComponent(prompt)}`;
        
        const response = await axios.get(apiUrl, {
            timeout: 120000 // Timeout de 2 minutes pour la génération
        });

        // Vérifier si la réponse est valide
        if (response.data && response.data.success && response.data.videoUrl) {
            const videoUrl = response.data.videoUrl;
            const author = response.data.author || 'API';
            
            // Envoyer un message de succès avec les détails
            await sendMessage(senderId, `✅ Vidéo générée avec succès !

📹 Prompt : ${response.data.prompt}
👤 Author : ${author}
🕒 Timestamp : ${new Date(response.data.timestamp).toLocaleString('fr-FR')}

📤 Envoi de la vidéo en cours...`);

            // Attendre un peu avant d'envoyer la vidéo
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Envoyer la vidéo
            await sendMessage(senderId, {
                files: [videoUrl],
                type: 'video'
            });

            // Confirmation finale
            await sendMessage(senderId, `🎉 Vidéo envoyée avec succès !
🔗 URL directe : ${videoUrl}`);

        } else {
            // Si la réponse n'est pas valide
            await sendMessage(senderId, `❌ Erreur lors de la génération de la vidéo.
⚠️ L'API n'a pas retourné de résultat valide.
🔄 Veuillez réessayer avec une autre description.`);
        }

    } catch (error) {
        console.error('Erreur lors de la génération de la vidéo:', error);

        // Message d'erreur détaillé
        let errorMessage = "❌ Une erreur s'est produite lors de la génération de la vidéo.\n\n";
        
        if (error.code === 'ECONNABORTED') {
            errorMessage += "⏱️ La requête a expiré. La génération prend trop de temps.\n";
            errorMessage += "💡 Essayez avec une description plus simple.";
        } else if (error.response) {
            errorMessage += `🔴 Erreur API : ${error.response.status}\n`;
            errorMessage += `📝 ${error.response.data?.message || 'Erreur inconnue'}`;
        } else if (error.request) {
            errorMessage += "🌐 Impossible de contacter l'API.\n";
            errorMessage += "💡 Vérifiez votre connexion internet.";
        } else {
            errorMessage += `⚠️ ${error.message}`;
        }

        await sendMessage(senderId, errorMessage);
    }
};

// Informations de la commande
module.exports.info = {
    name: "text2video",
    description: "Génère une vidéo MP4 à partir d'une description textuelle en utilisant l'IA.",
    usage: "Utilisez 'text2video <description>' pour générer une vidéo.\n\nExemples :\n• text2video A beautiful sunset over the ocean with waves\n• text2video A cat playing with a ball in a garden\n• text2video Fireworks exploding in the night sky"
};
