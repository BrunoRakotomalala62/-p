
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Fonction pour envoyer des messages longs en plusieurs parties si nécessaire
async function sendLongMessage(senderId, message) {
    const MAX_MESSAGE_LENGTH = 2000;

    if (message.length <= MAX_MESSAGE_LENGTH) {
        await sendMessage(senderId, message);
        return;
    }

    // Diviser le message en chunks
    const chunks = [];
    let startIndex = 0;
    
    while (startIndex < message.length) {
        let endIndex = startIndex + MAX_MESSAGE_LENGTH;
        
        if (endIndex < message.length) {
            // Chercher le dernier point ou espace pour une coupure propre
            const lastPeriod = message.lastIndexOf('.', endIndex);
            const lastSpace = message.lastIndexOf(' ', endIndex);
            const breakPoint = Math.max(lastPeriod, lastSpace);
            
            if (breakPoint > startIndex) {
                endIndex = breakPoint + 1;
            }
        }
        
        chunks.push(message.substring(startIndex, endIndex));
        startIndex = endIndex;
    }
    
    // Envoyer chaque chunk avec une pause
    for (let i = 0; i < chunks.length; i++) {
        await sendMessage(senderId, chunks[i]);
        if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

module.exports = async (senderId, userText) => {
    // Extraire le prompt en retirant le préfixe 'yi' et en supprimant les espaces superflus
    const prompt = userText.slice(2).trim();

    // Vérifier si le prompt est vide
    if (!prompt) {
        await sendMessage(senderId, '🤖 Yi AI\n\n❌ Veuillez fournir une question ou un sujet pour que je puisse vous aider.');
        return;
    }

    try {
        // Envoyer un message d'attente
        await sendMessage(senderId, "🤖 Yi réfléchit à votre demande...");

        // Appeler l'API Yi avec le prompt fourni
        const apiUrl = `https://rapido.zetsu.xyz/api/yi-l?ask=${encodeURIComponent(prompt)}&uid=${senderId}`;
        const response = await axios.get(apiUrl);

        // Récupérer la réponse de l'API
        const reply = response.data.response;

        if (!reply) {
            await sendMessage(senderId, "⚠️ Aucune réponse reçue de l'API Yi.");
            return;
        }

        // Attendre 2 secondes avant d'envoyer la réponse
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Formater la réponse
        const formattedResponse = `🤖 YI AI BOT\n\n${reply}\n\n✨ Propulsé par Yi Intelligence`;

        // Envoyer la réponse avec découpage dynamique
        await sendLongMessage(senderId, formattedResponse);

    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API Yi:', error?.response?.data || error.message || error);
        await sendMessage(senderId, '❌ Une erreur s\'est produite lors du traitement de votre demande. Veuillez réessayer plus tard.');
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "yi",
    description: "Posez des questions à Yi AI, un assistant virtuel développé par 01.AI.",
    usage: "Envoyez 'yi <votre question>' pour obtenir une réponse via l'API Yi."
};
