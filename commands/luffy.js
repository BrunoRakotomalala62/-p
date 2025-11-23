const axios = require('axios');
const sendMessage = require('../handles/sendMessage'); // Importer la fonction sendMessage

module.exports = async (senderId, prompt, uid) => { 
    try {
        // Envoyer un message de confirmation que le message a été reçu
        await sendMessage(senderId, "✨ Merci pour ta question ! Je prépare une réponse épique pour toi... ⏳🔍");

        // Construire l'URL de l'API pour résoudre la question avec UID
        const apiUrl = `https://norch-project.gleeze.com/api/Compound?prompt=${encodeURIComponent(prompt)}&uid=${uid}&name=Developer`;
        const response = await axios.get(apiUrl);

        // Récupérer la bonne clé dans la réponse de l'API
        const reply = response.data.reply;

        // Attendre 2 secondes avant d'envoyer la réponse
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Envoyer la réponse de l'API à l'utilisateur
        await sendMessage(senderId, reply);
    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API Luffy AI:', error);

        // Envoyer un message d'erreur à l'utilisateur en cas de problème
        await sendMessage(senderId, "Désolé, une erreur s'est produite lors du traitement de votre message.");
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "luffy",  // Le nom de la commande
    description: "Pose ta question à Luffy AI pour obtenir une réponse détaillée.",  // Description de la commande
    usage: "Envoyez 'luffy <question>' pour poser une question à Luffy AI."  // Comment utiliser la commande
};
