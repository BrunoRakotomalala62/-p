
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Nouvelle URL de base de l'API
const BASE_API_URL = 'https://apis-keith.vercel.app/keithai';
const DATE_API_URL = 'https://date-heure.vercel.app/date?heure=Madagascar';

// Objet pour stocker le contexte des conversations par utilisateur
const userConversations = {};

// Fonction pour simplifier les expressions LaTeX
function simplifyLatex(text) {
    // Remplacer les expressions LaTeX \[ \] par des espaces
    text = text.replace(/\\\[(.*?)\\\]/g, '$1');
    // Remplacer les expressions LaTeX \( \) par des parenthèses simples
    text = text.replace(/\\\((.*?)\\\)/g, '($1)');
    // Autres remplacements potentiels pour formater les fractions, etc.
    text = text.replace(/\\frac{(.*?)}{(.*?)}/g, '$1/$2');
    
    return text;
}

module.exports = async (senderId, userText) => {
    // Vérifier si le message est vide ou ne contient que des espaces
    if (!userText.trim()) {
        await sendMessage(senderId, 'Veuillez fournir une question ou un sujet pour que je puisse vous aider.');
        return;
    }

    try {
        // Initialiser ou mettre à jour le contexte de conversation pour cet utilisateur
        if (!userConversations[senderId]) {
            userConversations[senderId] = [];
        }
        
        // Ajouter le message de l'utilisateur à l'historique
        userConversations[senderId].push({
            role: 'user',
            content: userText
        });

        // Envoyer un message de confirmation que la requête est en cours de traitement
        await sendMessage(senderId, "Message reçu, je prépare une réponse...");

        // Construire l'URL de l'API avec la question et l'uid
        const apiUrl = `${BASE_API_URL}?q=${encodeURIComponent(userText)}&uid=${senderId}`;
        const response = await axios.get(apiUrl);
        const reply = response.data.result;

        // Ajouter la réponse de l'assistant à l'historique
        userConversations[senderId].push({
            role: 'assistant',
            content: reply
        });

        // Limiter l'historique à 10 messages maximum (5 échanges)
        if (userConversations[senderId].length > 10) {
            userConversations[senderId] = userConversations[senderId].slice(-10);
        }

        // Appeler l'API de date pour obtenir la date et l'heure actuelles
        const dateResponse = await axios.get(DATE_API_URL);
        const { date_actuelle, heure_actuelle } = dateResponse.data;

        // Attendre 2 secondes avant d'envoyer la réponse pour un délai naturel
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Simplifier les expressions LaTeX dans la réponse
        const simplifiedReply = simplifyLatex(reply);
        
        const formattedReply = `
🤖 • 𝗕𝗿𝘂𝗻𝗼𝗖𝗵𝗮𝘁
━━━━━━━━━━━━━━
❓𝗬𝗼𝘂𝗿 𝗤𝘂𝗲𝘀𝘁𝗶𝗼𝗻: ${userText}
━━━━━━━━━━━━━━
✅ 𝗔𝗻𝘀𝘄𝗲𝗿: ${simplifiedReply}
━━━━━━━━━━━━━━
⏰ 𝗥𝗲𝘀𝗽𝗼𝗻𝘀𝗲: ${date_actuelle}, ${heure_actuelle} à Madagascar

🇲🇬Lien Facebook de l'admin: ✅https://www.facebook.com/bruno.rakotomalala.7549
        `.trim();

        await sendMessage(senderId, formattedReply);
    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API :', error);

        // Envoyer un message d'erreur à l'utilisateur en cas de problème
        await sendMessage(senderId, `
🤖 • 𝗕𝗿𝘂𝗻𝗼𝗖𝗵𝗮𝘁
━━━━━━━━━━━━━━
❓𝗬𝗼𝘂𝗿 𝗤𝘂𝗲𝘀𝘁𝗶𝗼𝗻: ${userText}
━━━━━━━━━━━━━━
✅ 𝗔𝗻𝘀𝘄𝗲𝗿: Désolé, une erreur s'est produite lors du traitement de votre question.
━━━━━━━━━━━━━━
⏰ 𝗥𝗲𝘀𝗽𝗼𝗻𝘀𝗲: Impossible de récupérer l'heure.

🇲🇬Lien Facebook de l'admin: ✅https://www.facebook.com/bruno.rakotomalala.7549
        `.trim());
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "ai",
    description: "Posez directement votre question ou donnez un sujet pour obtenir une réponse générée par l'IA avec conversation continue.",
    usage: "Envoyez simplement votre question ou sujet."
};
