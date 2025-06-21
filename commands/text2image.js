
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const sendImageFromPrompt = async (senderId, prompt) => {
    try {
        // Informer l'utilisateur que la requête est en cours de traitement
        await sendMessage(senderId, "🖼️ Génération de votre image en cours...");
        
        // Construire l'URL de l'API avec le prompt
        const apiUrl = `https://kaiz-apis.gleeze.com/api/text2image?prompt=${encodeURIComponent(prompt)}`;
        
        // Appeler l'API pour obtenir l'image
        const response = await axios.get(apiUrl, { 
            responseType: 'arraybuffer' // Pour gérer la réponse comme une image binaire
        });
        
        // Vérifier si la réponse est valide
        if (response.status === 200) {
            // Envoyer l'image à l'utilisateur directement en tant que pièce jointe
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
            await sendMessage(senderId, "Désolé, je n'ai pas pu générer l'image demandée. Veuillez réessayer.");
        }
    } catch (error) {
        console.error('Erreur lors de la génération de l\'image:', error);
        await sendMessage(senderId, "Une erreur s'est produite lors de la génération de l'image. Veuillez réessayer plus tard.");
    }
};

module.exports = async (senderId, userText) => {
    // Vérifier si l'utilisateur a fourni un texte pour générer l'image
    const prompt = userText.trim();
    
    if (prompt) {
        // Générer et envoyer l'image basée sur le prompt
        await sendImageFromPrompt(senderId, prompt);
    } else {
        // Si aucun prompt n'est fourni, demander à l'utilisateur d'en fournir un
        await sendMessage(senderId, "Veuillez me décrire l'image que vous souhaitez générer.");
    }
};

// Ajouter les informations de la commande pour l'aide
module.exports.info = {
    name: "text2image",
    description: "Génère une image à partir de votre description textuelle.",
    usage: "text2image [description de l'image souhaitée]"
};
