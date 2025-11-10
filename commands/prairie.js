const gemModule = require('../auto/gemini');

module.exports = async (senderId, prompt, api, imageAttachments) => {
    try {
        // Si une image est envoyée
        if (imageAttachments && imageAttachments.length > 0) {
            const imageUrl = imageAttachments[0].payload.url;
            await gemModule.handleImageMessage(senderId, imageUrl);
            return { skipCommandCheck: true };
        }

        // Si c'est un message texte
        await gemModule.handleTextMessage(senderId, prompt);

    } catch (error) {
        console.error("❌ Erreur Prairie AI:", error?.response?.data || error.message || error);
        const sendMessage = require('../handles/sendMessage');
        await sendMessage(senderId, "❌ Une erreur s'est produite lors du traitement de votre demande. Veuillez réessayer plus tard.");
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "prairie",
    description: "Analysez des images avec l'intelligence artificielle Claude. Envoyez une image puis posez vos questions.",
    usage: "Envoyez une image en pièce jointe, puis posez votre question.",
    author: "Bruno"
};
