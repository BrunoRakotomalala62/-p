
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

module.exports = async (senderId, prompt) => { 
    try {
        // Vérifier si le prompt est vide ou ne contient que des espaces
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, `
✨ 𝗛𝗨𝗠𝗔𝗡𝗜𝗭𝗘𝗥 𝗣𝗥𝗢 ✨
━━━━━━━━━━━━━━━━━━━━━━━━━━

👋 Bienvenue ! Je transforme vos textes en messages plus humains et naturels.

📝 𝗨𝘁𝗶𝗹𝗶𝘀𝗮𝘁𝗶𝗼𝗻 :
humain <votre texte>

💡 𝗘𝘅𝗲𝗺𝗽𝗹𝗲 :
humain je suis avec toi pour le moment

━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 Powered by Hutchingd API
            `.trim());
            return;
        }

        // Envoyer un message de confirmation que le traitement est en cours
        await sendMessage(senderId, "🔄 ✨ Humanisation de votre texte en cours... Un instant magique ! ✨");

        // Construire l'URL de l'API pour humaniser le texte
        const apiUrl = `http://api.hutchingd.x10.mx/api/ai/aihumanizer.php?text=${encodeURIComponent(prompt)}`;
        const response = await axios.get(apiUrl);

        // Vérifier s'il y a une erreur dans la réponse
        if (response.data.error && response.data.error !== "No") {
            await sendMessage(senderId, "❌ Une erreur s'est produite lors de l'humanisation. Veuillez réessayer.");
            return;
        }

        // Récupérer les réponses de l'API
        const humanizedText = response.data.message || "Texte non disponible";
        const englishTranslation = response.data.message2 || "";

        // Construire un message formaté magnifique et attractif
        const formattedResponse = `
✨ 𝗛𝗨𝗠𝗔𝗡𝗜𝗭𝗘𝗥 𝗣𝗥𝗢 ✨
━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 𝗧𝗲𝘅𝘁𝗲 𝗼𝗿𝗶𝗴𝗶𝗻𝗮𝗹 :
${prompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 𝗧𝗲𝘅𝘁𝗲 𝗵𝘂𝗺𝗮𝗻𝗶𝘀é :
${humanizedText}

${englishTranslation ? `━━━━━━━━━━━━━━━━━━━━━━━━━━

🌍 𝗧𝗿𝗮𝗱𝘂𝗰𝘁𝗶𝗼𝗻 𝗮𝗻𝗴𝗹𝗮𝗶𝘀𝗲 :
${englishTranslation}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━
💫 Votre texte a été transformé avec succès !
🤖 Powered by 👉 @Bruno | Hutchingd API
        `.trim();

        // Envoyer la réponse formatée à l'utilisateur
        await sendMessage(senderId, formattedResponse);
    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API Humanizer:', error);

        // Envoyer un message d'erreur à l'utilisateur en cas de problème
        await sendMessage(senderId, `
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 ❌
━━━━━━━━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors de l'humanisation de votre texte.

🔄 Veuillez vérifier votre connexion et réessayer.

Si le problème persiste, contactez l'administrateur.
━━━━━━━━━━━━━━━━━━━━━━━━━━
        `.trim());
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "humain",
    description: "Transforme votre texte en version plus humaine et naturelle avec traduction anglaise.",
    usage: "Envoyez 'humain <votre texte>' pour obtenir une version humanisée."
};
