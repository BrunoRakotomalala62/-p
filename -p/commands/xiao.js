const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// User sessions management for history
const userSessions = {};

module.exports = async (senderId, prompt) => {
    try {
        const input = prompt.trim();
        const inputLower = input.toLowerCase();

        // Reset conversation
        if (inputLower === 'supprimer' || inputLower === 'clear') {
            delete userSessions[senderId];
            await sendMessage(senderId, "🧹 *SÉANCE RÉINITIALISÉE* 🧹\n━━━━━━━━━━━━━━━\nL'historique de notre discussion a été effacé avec succès.");
            return;
        }

        // Initialize session history if not exists
        if (!userSessions[senderId]) {
            userSessions[senderId] = { history: [] };
        }

        // Add user message to history
        userSessions[senderId].history.push(`Utilisateur: ${input}`);
        
        // Keep only last 10 exchanges to avoid too long queries
        if (userSessions[senderId].history.length > 10) {
            userSessions[senderId].history.shift();
        }

        // Build full prompt with history context
        const context = userSessions[senderId].history.join('\n');
        const fullQuery = `Ceci est une conversation continue. Voici l'historique :\n${context}\n\nRéponds à la dernière question de l'utilisateur de manière concise et naturelle.`;

        // Loading message
        await sendMessage(senderId, "✨ 𝗫𝗜𝗔𝗢-𝗔𝗜 ✨\n━━━━━━━━━━━━━━━\nAnalyse de votre demande en cours... 🧠⏳");

        const apiKey = "rapi_4806a41790cd4a83921d56b667ab3f16";
        const apiUrl = `https://rapido.zetsu.xyz/api/perplexity?query=${encodeURIComponent(fullQuery)}&websearch=true&apikey=${apiKey}`;
        
        const response = await axios.get(apiUrl);
        const reply = response.data.answer || "Désolé, je ne parviens pas à formuler une réponse pour le moment.";

        // Add assistant reply to history
        userSessions[senderId].history.push(`Xiao: ${reply}`);

        // Format and send beautiful response
        const decoratedReply = `✨ 𝗫𝗜𝗔𝗢-𝗔𝗜 ✨\n━━━━━━━━━━━━━━━\n${reply}\n━━━━━━━━━━━━━━━\n💬 _Tapez 'supprimer' pour recommencer._`;

        await sendMessage(senderId, decoratedReply);

    } catch (error) {
        console.error('Erreur Xiao API:', error.message);
        await sendMessage(senderId, "⚠️ *ERREUR SYSTÈME* ⚠️\n━━━━━━━━━━━━━━━\nUne erreur s'est produite lors de la communication avec l'IA. Veuillez réessayer plus tard.");
    }
};

module.exports.info = {
    name: "xiao",
    description: "Intelligence Artificielle Perplexity avec mémoire.",
    usage: "xiao <votre message> (ou 'supprimer' pour effacer la mémoire)"
};