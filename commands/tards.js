
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

module.exports = async (senderId, prompt) => {
    try {
        // Vérifier si le message est vide
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, "📊📝 AI UI-TARDS 📺📒\n----------------------------\nVeuillez poser une question ou donner un problème à résoudre.\n----------------------------\n🚀AI BY BRUNO 🚀");
            return { skipCommandCheck: true };
        }

        // Envoyer un message d'attente
        await sendMessage(senderId, "⏳ Traitement de votre demande en cours...");

        // Construire l'URL de l'API avec la question encodée et l'identifiant utilisateur
        const apiUrl = `https://zaikyoov3-up.up.railway.app/api/ui-tars-72b?prompt=${encodeURIComponent(prompt)}&uid=${senderId}`;
        
        // Appel à l'API
        const response = await axios.get(apiUrl);
        
        // Vérifier si la réponse est valide
        if (response.data && response.data.reply) {
            // Formater la réponse selon le modèle demandé
            const formattedReply = `
📊📝 AI UI-TARDS 📺📒
----------------------------
${response.data.reply}
----------------------------
🚀AI BY BRUNO 🚀`;

            // Envoyer la réponse formatée
            await sendMessage(senderId, formattedReply);
        } else {
            // En cas de réponse invalide
            await sendMessage(senderId, "📊📝 AI UI-TARDS 📺📒\n----------------------------\nDésolé, je n'ai pas pu obtenir une réponse valide.\n----------------------------\n🚀AI BY BRUNO 🚀");
        }
    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API UI-TARDS:', error);
        
        // Message d'erreur en cas d'échec
        await sendMessage(senderId, `
📊📝 AI UI-TARDS 📺📒
----------------------------
Désolé, une erreur s'est produite lors du traitement de votre demande. Veuillez réessayer plus tard.
----------------------------
🚀AI BY BRUNO 🚀`);
    }
    
    return { skipCommandCheck: true };
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "tards",
    description: "Utilise l'API UI-TARDS pour répondre à vos questions et résoudre des problèmes.",
    usage: "Envoyez 'tards <votre question>' pour obtenir une réponse."
};
