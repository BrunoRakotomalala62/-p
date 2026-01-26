
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// URL de base pour l'API Copilot
const API_BASE_URL = 'https://api-library-kohi.onrender.com/api/copilot';

// Stockage de l'historique des conversations pour chaque utilisateur
const conversationHistory = {};

// Fonction pour envoyer des messages longs en plusieurs parties si nécessaire
async function sendLongMessage(senderId, message) {
    const MAX_MESSAGE_LENGTH = 2000;

    if (message.length <= MAX_MESSAGE_LENGTH) {
        await sendMessage(senderId, message);
        return;
    }

    let startIndex = 0;
    let partNumber = 1;
    const totalParts = Math.ceil(message.length / MAX_MESSAGE_LENGTH);
    
    while (startIndex < message.length) {
        let endIndex = startIndex + MAX_MESSAGE_LENGTH;
        
        if (endIndex < message.length) {
            // Chercher le meilleur point de coupure
            const separators = ['\n\n', '. ', '.\n', '! ', '!\n', '? ', '?\n', ', ', ',\n', '\n', ' '];
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
        
        let messagePart = message.substring(startIndex, endIndex);
        
        // Ajouter un indicateur de partie si le message est divisé
        if (totalParts > 1) {
            if (partNumber === 1) {
                messagePart = `${messagePart}\n\n📄 Partie ${partNumber}/${totalParts}`;
            } else {
                messagePart = `📄 Partie ${partNumber}/${totalParts}\n\n${messagePart}`;
            }
        }
        
        await sendMessage(senderId, messagePart);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        startIndex = endIndex;
        partNumber++;
    }
}

// Fonction pour construire le contexte de conversation avec historique
const buildConversationContext = (senderId, currentPrompt) => {
    if (!conversationHistory[senderId] || conversationHistory[senderId].length === 0) {
        return currentPrompt;
    }

    // Limiter l'historique aux 5 derniers échanges pour éviter les prompts trop longs
    const recentHistory = conversationHistory[senderId].slice(-5);

    let context = "Historique de la conversation:\n";
    recentHistory.forEach((entry, index) => {
        context += `${index + 1}. Utilisateur: ${entry.user}\n   Assistant: ${entry.assistant}\n`;
    });

    context += `\nQuestion actuelle: ${currentPrompt}`;
    return context;
};

module.exports = async (senderId, prompt) => {
    try {
        // Initialiser l'historique de conversation si nécessaire
        if (!conversationHistory[senderId]) {
            conversationHistory[senderId] = [];
        }

        // Vérifier si c'est une demande de réinitialisation
        if (prompt && prompt.toUpperCase() === 'RESET') {
            conversationHistory[senderId] = [];
            await sendMessage(senderId, "🔄 Conversation réinitialisée! Commençons une nouvelle discussion.");
            return;
        }

        // Vérifier si le prompt est vide
        if (!prompt || prompt.trim() === '') {
            const welcomeMessage = `
╔═══════════════════════════╗
║   🧮 TIANA AI MADAGASCAR 🇲🇬   ║
╚═══════════════════════════╝

👋 Bonjour! Je suis Tiana, votre assistante IA.

💡 Je peux vous aider avec:
  • Questions mathématiques
  • Problèmes de programmation
  • Explications détaillées
  • Et bien plus encore!

📝 Usage: tiana <votre question>
🔄 Pour réinitialiser: tiana reset

━━━━━━━━━━━━━━━━━━━━━━━━━━
🔬 Powered by Copilot AI | 👨‍💻 @Bruno
            `.trim();
            await sendMessage(senderId, welcomeMessage);
            return;
        }

        // Envoyer un message d'attente
        await sendMessage(senderId, "🔍 Tiana analyse votre question... ⏳");

        // Construire le contexte avec l'historique
        const contextualPrompt = buildConversationContext(senderId, prompt);

        // Construire l'URL de l'API avec les nouveaux paramètres
        const apiUrl = `${API_BASE_URL}?prompt=${encodeURIComponent(contextualPrompt)}&model=gpt-5&user=${encodeURIComponent(senderId)}`;
        
        // Appel à l'API
        const response = await axios.get(apiUrl);
        
        // Extraire le texte de la réponse JSON
        if (!response.data || !response.data.status || !response.data.data || !response.data.data.text) {
            await sendMessage(senderId, "❌ Désolé, je n'ai pas pu générer une réponse. Veuillez réessayer.");
            return;
        }
        
        const reply = response.data.data.text;

        // Vérifier si la réponse est vide
        if (!reply || reply.trim() === '') {
            await sendMessage(senderId, "❌ Désolé, je n'ai pas pu générer une réponse. Veuillez réessayer.");
            return;
        }

        // Ajouter à l'historique de conversation
        conversationHistory[senderId].push({
            user: prompt,
            assistant: reply
        });

        // Limiter l'historique à 10 échanges maximum
        if (conversationHistory[senderId].length > 10) {
            conversationHistory[senderId] = conversationHistory[senderId].slice(-10);
        }

        // Créer une réponse formatée et stylisée
        const formattedReply = `
╔═══════════════════════════╗
║   🧮 TIANA AI MADAGASCAR 🇲🇬   ║
╚═══════════════════════════╝

📌 Votre Question:
${prompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ Réponse Détaillée:

${reply}

━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 Historique: ${conversationHistory[senderId].length} échanges
🔄 Tapez "tiana reset" pour réinitialiser
━━━━━━━━━━━━━━━━━━━━━━━━━━
🔬 Powered by Copilot AI | 👨‍💻 @Bruno
        `.trim();

        // Envoyer la réponse formatée avec découpage intelligent
        await sendLongMessage(senderId, formattedReply);

    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Tiana:", error);
        
        await sendMessage(senderId, `
⚠️ ERREUR TECHNIQUE ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors de la communication avec Tiana AI.

🔄 Veuillez réessayer dans quelques instants.

Si le problème persiste, contactez l'administrateur.
━━━━━━━━━━━━━━━━━━━━━━━━━━
        `.trim());
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "tiana",
    description: "Résolvez des problèmes mathématiques et de programmation avec Tiana AI. Conversation continue avec historique.",
    usage: "Envoyez 'tiana <votre question>' pour obtenir une réponse détaillée. Utilisez 'tiana reset' pour réinitialiser la conversation."
};
