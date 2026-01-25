
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

module.exports = async (senderId, prompt) => {
    try {
        // Par défaut, générer 3 cartes
        let count = 3;
        let type = 'Visa';

        // Si l'utilisateur a spécifié un nombre
        if (prompt && !isNaN(prompt.trim())) {
            count = parseInt(prompt.trim());
            // Limiter entre 1 et 10 cartes
            if (count < 1) count = 1;
            if (count > 10) count = 10;
        }

        // Message d'attente
        await sendMessage(senderId, `💳 Génération de ${count} carte(s) virtuelle(s) en cours...`);

        // Construire l'URL de l'API
        const apiUrl = `https://api.siputzx.my.id/api/tools/vcc-generator?type=${type}&count=${count}`;
        
        // Appel à l'API
        const response = await axios.get(apiUrl);

        // Vérifier si la réponse est valide
        if (response.data && response.data.status && response.data.data) {
            const cards = response.data.data;
            
            // Construire le message de réponse
            let messageText = `💳 𝗖𝗔𝗥𝗧𝗘𝗦 𝗩𝗜𝗥𝗧𝗨𝗘𝗟𝗟𝗘𝗦 𝗚É𝗡É𝗥É𝗘𝗦 💳\n`;
            messageText += `━━━━━━━━━━━━━━━━━━━━\n\n`;
            messageText += `📊 Nombre de cartes : ${response.data.count}\n`;
            messageText += `🕐 Horodatage : ${new Date(response.data.timestamp).toLocaleString('fr-FR')}\n\n`;

            // Ajouter chaque carte
            cards.forEach((card, index) => {
                messageText += `━━━━ 𝗖𝗔𝗥𝗧𝗘 #${index + 1} ━━━━\n`;
                messageText += `💳 Numéro : ${card.cardNumber}\n`;
                messageText += `📅 Expiration : ${card.expirationDate}\n`;
                messageText += `👤 Titulaire : ${card.cardholderName}\n`;
                messageText += `🔐 CVV : ${card.cvv}\n\n`;
            });

            messageText += `━━━━━━━━━━━━━━━━━━━━\n`;
            messageText += `⚠️ Ces cartes sont à usage de test uniquement\n`;
            messageText += `❌ Ne pas utiliser pour des transactions réelles`;

            // Envoyer le message
            await sendMessage(senderId, messageText);
        } else {
            await sendMessage(senderId, "❌ Impossible de générer les cartes virtuelles. Veuillez réessayer.");
        }
    } catch (error) {
        console.error("Erreur lors de la génération des cartes:", error);
        await sendMessage(senderId, "❌ Désolé, une erreur s'est produite lors de la génération des cartes virtuelles.");
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "visa",
    description: "Génère des cartes de crédit virtuelles (VCC) pour les tests.",
    usage: "Envoyez 'visa' pour générer 3 cartes ou 'visa <nombre>' pour spécifier le nombre (1-10)."
};
