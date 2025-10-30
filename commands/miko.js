
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

module.exports = async (senderId, prompt) => {
    try {
        // Vérifier si le prompt est vide
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, '❌ Veuillez fournir une question pour Miko.\n\nExemple: miko Firy ny daty androany?');
            return;
        }

        // Envoyer un message d'attente
        await sendMessage(senderId, '⏳ Miko est en train de réfléchir...');

        // Construire l'URL de l'API
        const apiUrl = `https://miko-utilis.vercel.app/api/miko?query=${encodeURIComponent(prompt)}&userId=${senderId}`;
        
        // Appeler l'API
        const response = await axios.get(apiUrl);
        
        // Vérifier si la réponse est valide
        if (!response.data || !response.data.status || !response.data.data || !response.data.data.response) {
            await sendMessage(senderId, '❌ Désolé, Miko n\'a pas pu générer de réponse.');
            return;
        }

        // Récupérer la réponse
        const reply = response.data.data.response;

        // Formater la réponse de manière magnifique
        const formattedReply = `
📝👩‍🚀 𝗠𝗜𝗞𝗢 𝗕𝗢𝗧 👷🌻
━━━━━━━━━━━━━━━━━━━━━━━━━━

${reply}

━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Powered by Miko AI | 🇲🇬 Madagascar
        `.trim();

        // Envoyer la réponse formatée
        await sendMessage(senderId, formattedReply);

    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API Miko:', error.message);
        await sendMessage(senderId, '❌ Une erreur s\'est produite lors de la communication avec Miko. Veuillez réessayer plus tard.');
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "miko",
    description: "Posez des questions à Miko, votre assistant intelligent malgache.",
    usage: "Envoyez 'miko <question>' pour obtenir une réponse de Miko."
};
