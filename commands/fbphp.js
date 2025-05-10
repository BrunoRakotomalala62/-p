
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const sendImageFromPrompt = async (senderId, prompt) => {
    try {
        // Informer l'utilisateur que la requÃªte est en cours de traitement
        await sendMessage(senderId, "🖼️ Génération du photo de profil en cours...");

        // Construire l'URL de l'API avec le prompt
        const apiUrl = `https://kaiz-apis.gleeze.com/api/facebookpfp?uid=${encodeURIComponent(prompt)}`;

        // Appeler l'API pour obtenir l'image
        const response = await axios.get(apiUrl, { 
            responseType: 'arraybuffer' // Pour gÃ©rer la rÃ©ponse comme une image binaire
        });

        // VÃ©rifier si la rÃ©ponse est valide
        if (response.status === 200) {
            // Envoyer l'image Ã  l'utilisateur directement en tant que piÃ¨ce jointe
            await sendMessage(senderId, {
                attachment: {
                    type: "image",
                    payload: {
                        url: apiUrl,
                        is_reusable: true
                    }
                }
            });
        } else {
            await sendMessage(senderId, "Désolé, je n'ai pas pu générer l'image demandÃ©e. Veuillez rÃ©essayer.");
        }
    } catch (error) {
        console.error('Erreur lors de la génération de l\'image:', error);
        await sendMessage(senderId, "Une erreur s'est produite lors de la génération de l'image. Veuillez réessayer plus tard.");
    }
};

module.exports = async (senderId, userText) => {
    // VÃ©rifier si l'utilisateur a fourni un texte pour gÃ©nÃ©rer l'image
    const prompt = userText.trim();

    if (prompt) {
        // GÃ©nÃ©rer et envoyer l'image basÃ©e sur le prompt
        await sendImageFromPrompt(senderId, prompt);
    } else {
        // Si aucun prompt n'est fourni, demander Ã  l'utilisateur d'en fournir un
        await sendMessage(senderId, "Veuillez m'envoyer l'uid de profil que vous souhaitez générer.");
    }
};

// Ajouter les informations de la commande pour l'aide
module.exports.info = {
    name: "fbphp",
    description: "Génère une image à  partir de l'uid de profil.",
    usage: "fbphp [uid de profil souhaitée]"
};