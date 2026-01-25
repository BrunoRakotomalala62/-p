
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

module.exports = async (senderId, userText) => {
    // Vérifier si c'est une demande de réinitialisation
    if (userText === "RESET_CONVERSATION") {
        return { skipCommandCheck: true };
    }

    // Vérifier si le texte est vide
    if (!userText || userText.trim() === '') {
        await sendMessage(senderId, '❌ Veuillez fournir un texte à partager sur Pastebin.\n\nUtilisation : pastebin <votre texte>');
        return;
    }

    try {
        // Envoyer un message de confirmation
        await sendMessage(senderId, '📝 Création de votre paste en cours...');

        // Construire l'URL de l'API avec le texte encodé
        const apiUrl = `https://rapido.zetsu.xyz/api/pastebin?c=${encodeURIComponent(userText)}`;
        
        // Appeler l'API
        const response = await axios.get(apiUrl);

        // Vérifier si la réponse contient une URL
        if (response.data && response.data.url) {
            const pasteUrl = response.data.url;

            // Attendre 2 secondes avant d'envoyer la réponse
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Formater et envoyer la réponse
            const formattedResponse = `
✅ 𝗣𝗔𝗦𝗧𝗘𝗕𝗜𝗡 𝗖𝗥𝗘́𝗘́ 𝗔𝗩𝗘𝗖 𝗦𝗨𝗖𝗖𝗘̀𝗦
━━━━━━━━━━━━━━━━━━━

📝 𝗧𝗲𝘅𝘁𝗲 : ${userText.substring(0, 100)}${userText.length > 100 ? '...' : ''}

🔗 𝗟𝗶𝗲𝗻 : ${pasteUrl}

━━━━━━━━━━━━━━━━━━━
⚡ Votre texte a été partagé avec succès !
            `.trim();

            await sendMessage(senderId, formattedResponse);
        } else {
            await sendMessage(senderId, '❌ Erreur : Impossible de créer le paste. Veuillez réessayer.');
        }

    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API Pastebin:', error);
        await sendMessage(senderId, '❌ Une erreur s\'est produite lors de la création du paste. Veuillez réessayer plus tard.');
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "pastebin",
    description: "Partage du texte sur Pastebin et génère un lien de partage.",
    usage: "Envoyez 'pastebin <votre texte>' pour créer un paste."
};
