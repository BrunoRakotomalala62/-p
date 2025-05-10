
const axios = require('axios');
const sendMessage = require('../handles/sendMessage'); // Importer la fonction sendMessage

// Stocker l'historique des conversations pour chaque utilisateur
const conversationHistory = {};

module.exports = async (senderId, prompt, uid) => { 
    try {
        // Initialiser l'historique de conversation si nécessaire
        if (!conversationHistory[uid]) {
            conversationHistory[uid] = [];
        }

        // Ajouter le prompt de l'utilisateur à l'historique
        conversationHistory[uid].push({ role: 'user', content: prompt });

        // Envoyer un message de confirmation que le message a été reçu
        await sendMessage(senderId, "🕒 Un instant, je suis en train de chercher ce que tu demandes… 🌟");

        // Construire l'URL de l'API avec l'historique des conversations
        const apiUrl = `https://ronald-api-v1.vercel.app/api/ronald?message=${encodeURIComponent(prompt)}&uid=${uid}`;
        const response = await axios.get(apiUrl);

        // Récupérer la réponse de l'API
        const reply = response.data.response;

        // Ajouter la réponse à l'historique des conversations
        conversationHistory[uid].push({ role: 'assistant', content: reply });

        // Attendre 2 secondes avant d'envoyer la réponse
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Formater la réponse selon le template demandé
        const formattedReply = `🌞 ASTA BOT 🚀
---------------------------

${reply}

---------------------------
auteur : 🏡 Bruno 🏡`;

        // Envoyer la réponse formatée à l'utilisateur
        await sendMessage(senderId, formattedReply);
    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API ASTA:', error);

        // Envoyer un message d'erreur à l'utilisateur en cas de problème
        await sendMessage(senderId, "Désolé, une erreur s'est produite lors du traitement de votre message. Veuillez réessayer plus tard.");
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "asta",  // Le nom de la commande
    description: "Pose ta question à ASTA BOT pour obtenir une réponse détaillée.",  // Description de la commande
    usage: "Envoyez 'asta <question>' pour poser une question à ASTA BOT."  // Comment utiliser la commande
};
