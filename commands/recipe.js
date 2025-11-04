
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

module.exports = async (senderId, prompt) => {
    try {
        // Envoyer un message d'attente
        await sendMessage(senderId, "🍳 Recherche d'une délicieuse recette en cours... 👨‍🍳");

        // Appeler l'API de recettes
        const apiUrl = 'https://rapido.zetsu.xyz/api/recipe';
        const response = await axios.get(apiUrl);

        // Récupérer les données de la réponse
        const { name, category, instructions, ingredients } = response.data;

        // Formater la liste des ingrédients
        let ingredientsList = '';
        ingredients.forEach((ingredient, index) => {
            ingredientsList += `  ${index + 1}. ${ingredient}\n`;
        });

        // Formater le message de réponse avec des emojis attrayants
        const formattedMessage = `
🍜🥙🌭 𝗥𝗘𝗖𝗜𝗣𝗘 𝗠𝗔𝗚𝗡𝗜𝗙𝗜𝗤𝗨𝗘 🍟🥪🍲
━━━━━━━━━━━━━━━━━━━━━━━━━━

👨‍🍳 𝗡𝗼𝗺 𝗱𝘂 𝗽𝗹𝗮𝘁: ${name}

🏷️ 𝗖𝗮𝘁é𝗴𝗼𝗿𝗶𝗲: ${category}

━━━━━━━━━━━━━━━━━━━━━━━━━━

🛒 𝗜𝗡𝗚𝗥É𝗗𝗜𝗘𝗡𝗧𝗦:
${ingredientsList}
━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 𝗜𝗡𝗦𝗧𝗥𝗨𝗖𝗧𝗜𝗢𝗡𝗦:
${instructions}

━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ Bon appétit! 🍽️👌
        `.trim();

        // Envoyer la réponse formatée
        await sendMessage(senderId, formattedMessage);

    } catch (error) {
        console.error('Erreur lors de la récupération de la recette:', error);
        await sendMessage(senderId, "❌ Désolé, une erreur s'est produite lors de la récupération de la recette. Veuillez réessayer plus tard.");
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "recipe",
    description: "Obtenir une recette de cuisine aléatoire avec les ingrédients et les instructions.",
    usage: "Envoyez 'recipe' pour obtenir une recette aléatoire."
};
