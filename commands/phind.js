
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// URL de base pour l'API Phind
const API_BASE_URL = 'https://api.ccprojectsapis-jonell.gleeze.com/api/phindai';

// Fonction pour envoyer des messages longs en plusieurs parties si nécessaire
async function sendLongMessage(senderId, message) {
    const MAX_MESSAGE_LENGTH = 2000;

    if (message.length <= MAX_MESSAGE_LENGTH) {
        await sendMessage(senderId, message);
        return;
    }

    let startIndex = 0;
    
    while (startIndex < message.length) {
        let endIndex = startIndex + MAX_MESSAGE_LENGTH;
        
        if (endIndex < message.length) {
            const separators = ['. ', ', ', ' ', '! ', '? ', '.\n', ',\n', '!\n', '?\n', '\n\n', '\n'];
            let bestBreakPoint = -1;
            
            for (const separator of separators) {
                const lastSeparator = message.lastIndexOf(separator, endIndex);
                if (lastSeparator > startIndex && (bestBreakPoint === -1 || lastSeparator > bestBreakPoint)) {
                    bestBreakPoint = lastSeparator + separator.length;
                }
            }
            
            if (bestBreakPoint !== -1) {
                endIndex = bestBreakPoint;
            }
        } else {
            endIndex = message.length;
        }
        
        const messagePart = message.substring(startIndex, endIndex);
        await sendMessage(senderId, messagePart);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        startIndex = endIndex;
    }
}

module.exports = async (senderId, prompt) => {
    try {
        // Vérifier si le prompt est vide
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, "🧮 Phind AI - Assistant Mathématique\n\n💡 Posez-moi n'importe quelle question mathématique ou de programmation!\n\n📝 Usage: phind <votre question>");
            return;
        }

        // Envoyer un message d'attente
        await sendMessage(senderId, "🔍 Phind analyse votre question... ⏳");

        // Construire l'URL de l'API
        const apiUrl = `${API_BASE_URL}?q=${encodeURIComponent(prompt)}`;
        
        // Appel à l'API
        const response = await axios.get(apiUrl);
        const reply = response.data;

        // Créer une réponse formatée et stylisée
        const formattedReply = `
╔═══════════════════════════╗
║   🧮 PHIND AI MADAGASCAR 🇲🇬   ║
╚═══════════════════════════╝

📌 Votre Question:
${prompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ Réponse Détaillée:

${reply}

━━━━━━━━━━━━━━━━━━━━━━━━━━
🔬 Powered by Phind AI | 👨‍💻 @Bruno
        `.trim();

        // Envoyer la réponse formatée
        await sendLongMessage(senderId, formattedReply);

    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Phind:", error);
        
        await sendMessage(senderId, `
⚠️ ERREUR TECHNIQUE ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors de la communication avec Phind AI.

🔄 Veuillez réessayer dans quelques instants.

Si le problème persiste, contactez l'administrateur.
━━━━━━━━━━━━━━━━━━━━━━━━━━
        `.trim());
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "phind",
    description: "Résolvez des problèmes mathématiques et de programmation avec Phind AI.",
    usage: "Envoyez 'phind <votre question>' pour obtenir une réponse détaillée."
};
