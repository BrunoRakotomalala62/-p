
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

module.exports = async (senderId, prompt) => {
    try {
        // Vérifier si le prompt est vide ou ne contient que des espaces
        if (!prompt || prompt.trim() === '') {
            // Envoyer un message d'invitation si l'utilisateur envoie juste 'haiku'
            await sendMessage(senderId, "🌟 Claude 3 Haiku 🌟\n\nVeuillez poser votre question après la commande 'haiku'.\n\nExemple: `haiku qui es-tu?`");
            return;
        }

        // Envoyer un message de confirmation que la demande est en cours de traitement
        await sendMessage(senderId, "🔍 Traitement de votre demande en cours... Un instant !");

        // Construire l'URL de l'API avec le prompt de l'utilisateur
        const apiUrl = `https://kaiz-apis.gleeze.com/api/claude3-haiku?ask=${encodeURIComponent(prompt)}`;
        
        // Appel à l'API
        const response = await axios.get(apiUrl);
        
        // Récupérer les données de la réponse
        const { response: haikusResponse, author } = response.data;
        
        // Améliorer la présentation des équations mathématiques
        let enhancedResponse = haikusResponse
            // Mettre en évidence les équations
            .replace(/(\d+[x]\s*[-+]\s*\d+\s*=\s*\d+)/g, '「$1」')
            // Mettre en évidence les résultats importants
            .replace(/(x\s*=\s*\d+)/g, '『$1』')
            // Remplacer les étapes numérotées par quelque chose de plus visuel
            .replace(/Étape (\d+)/gi, '📝 Étape $1 📝')
            // Remplacer les \n par de vrais sauts de ligne
            .replace(/\\n/g, '\n');
        
        // Formater la réponse avec un meilleur espacement et structure
        // Diviser la réponse en paragraphes et appliquer un formatage amélioré
        const paragraphs = haikusResponse.split(/\n{2,}|\n\\n|\n\n/g);
        const formattedParagraphs = paragraphs.map(p => {
            // Ajouter des émojis pertinents aux étapes numérotées
            return p.replace(/^\d+\.\s*/g, match => `🔹 ${match}`);
        }).join('\n\n');
        
        // Ajouter des séparateurs visuels pour une meilleure lisibilité
        const formattedResponse = `✨🌟 𝐂𝐥𝐚𝐮𝐝𝐞 𝟑 𝐇𝐚𝐢𝐤𝐮 🌟✨\n\n${formattedParagraphs}\n\n━━━━━━━━━━━━━━━━━\n\n𝐀𝐮𝐭𝐞𝐮𝐫 : ✅ 𝐁𝐫𝐮𝐧𝐨 ✅`;
        
        // Si la réponse est trop longue, la diviser en plusieurs messages
        if (formattedResponse.length > 1000) {
            // Diviser la réponse en sections logiques
            const sections = formattedResponse.split('\n\n');
            
            // Envoyer le titre en premier
            await sendMessage(senderId, sections[0]);
            
            // Envoyer le contenu principal
            let currentMessage = "";
            for (let i = 1; i < sections.length - 1; i++) {
                // Si l'ajout de la section ferait dépasser la limite
                if (currentMessage.length + sections[i].length + 2 > 600) {
                    // Envoyer ce qui a été accumulé
                    if (currentMessage.length > 0) {
                        await sendMessage(senderId, currentMessage);
                        // Attendre un court instant entre les messages
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    currentMessage = sections[i];
                } else {
                    // Sinon ajouter la section au message en cours
                    currentMessage += (currentMessage ? '\n\n' : '') + sections[i];
                }
            }
            
            // Envoyer ce qui reste
            if (currentMessage.length > 0) {
                await sendMessage(senderId, currentMessage);
            }
            
            // Envoyer la signature de l'auteur à la fin
            await sendMessage(senderId, sections[sections.length - 1]);
        } else {
            // Envoyer la réponse complète si elle n'est pas trop longue
            await sendMessage(senderId, formattedResponse);
        }
        
    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Claude 3 Haiku:", error);
        
        // Envoyer un message d'erreur à l'utilisateur en cas de problème
        await sendMessage(senderId, "Désolé, une erreur s'est produite lors du traitement de votre demande avec Claude 3 Haiku. Veuillez réessayer plus tard.");
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "haiku",
    description: "Discutez avec Claude 3 Haiku, un modèle d'IA créé par Anthropic.",
    usage: "Envoyez 'haiku <question>' pour poser une question à Claude 3 Haiku."
};
