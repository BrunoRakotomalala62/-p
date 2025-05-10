
const sendMessage = require('../handles/sendMessage');

module.exports = async function(senderId, message, api, extraParams = {}) {
    try {
        // Vérifier si le message est une réponse
        if (!extraParams.messageReply) {
            await sendMessage(senderId, "Vous ne pouvez pas supprimer un message de nulle part. Veuillez d'abord répondre à un message.");
            return;
        }

        // Vérifier si le message appartient au bot
        const botID = api.getCurrentUserID ? api.getCurrentUserID() : null;
        
        if (!botID || extraParams.messageReply.senderID != botID) {
            await sendMessage(senderId, "Impossible de supprimer les messages d'autres personnes.");
            return;
        }
        
        // Supprimer le message
        if (api.unsendMessage) {
            await api.unsendMessage(extraParams.messageReply.messageID);
        } else {
            await sendMessage(senderId, "La fonctionnalité de suppression de message n'est pas disponible.");
        }
    } catch (error) {
        console.error('Erreur lors de la suppression du message:', error);
        await sendMessage(senderId, "Une erreur s'est produite lors de la suppression du message.");
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "unsend",  // Nom de la commande
    description: "Supprime les messages du bot auquel vous répondez",  // Description
    usage: "unsend (en réponse à un message du bot)",  // Utilisation
    example: "unsend (en répondant à un message)" // Exemple
};
