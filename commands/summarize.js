
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

module.exports = async (senderId, prompt) => {
    try {
        // Définir les langues supportées et leurs codes
        const supportedLanguages = {
            'en': 'en-GB',
            'fr': 'fr-FR',
            'es': 'es-ES',
            'de': 'de-DE',
            'it': 'it-IT',
            'pt': 'pt-PT'
        };
        
        // Extraire la langue et le texte à résumer
        let textToSummarize = prompt.trim();
        let language = 'en-GB'; // Langue par défaut (anglais)
        
        // Vérifier si un code de langue est spécifié à la fin
        const parts = textToSummarize.split(/\s+/);
        if (parts.length > 0) {
            const possibleLangCode = parts[parts.length - 1].toLowerCase();
            if (supportedLanguages[possibleLangCode]) {
                language = supportedLanguages[possibleLangCode];
                // Retirer le code de langue du texte à résumer
                textToSummarize = parts.slice(0, parts.length - 1).join(' ');
            }
        }

        // Vérifier si le texte est vide
        if (!textToSummarize) {
            await sendMessage(senderId, "Veuillez fournir un texte à résumer. Exemple : 'summarize Votre long texte ici fr'");
            return;
        }

        // Envoyer un message d'attente
        await sendMessage(senderId, `📝 Résumé en cours (langue: ${language})...`);

        // Configurer l'API URL avec les paramètres
        const apiKey = process.env.TEXTGEARS_API_KEY || "R3tpUnMT2b5fejZD";
        const apiUrl = `https://api.textgears.com/summarize?text=${encodeURIComponent(textToSummarize)}&language=${language}&key=${apiKey}`;

        // Appeler l'API TextGears
        const response = await axios.get(apiUrl);

        // Vérifier si la réponse contient les informations nécessaires
        if (response.data && response.data.status === true) {
            const keywords = response.data.response.keywords || [];
            const highlights = response.data.response.highlight || [];
            const summaryPoints = response.data.response.summary || [];
            
            // Construire une réponse détaillée
            let reply = "📃 **Résumé du texte** 📃\n\n";
            
            // Ajouter les points forts
            if (highlights.length > 0) {
                reply += "🔍 **Points principaux** :\n";
                highlights.forEach((highlight, index) => {
                    reply += `${index + 1}. ${highlight}\n`;
                });
                reply += "\n";
            }
            
            // Ajouter le résumé
            if (summaryPoints.length > 0) {
                reply += "📋 **Résumé** :\n";
                summaryPoints.forEach((point, index) => {
                    reply += `${index + 1}. ${point}\n`;
                });
                reply += "\n";
            }
            
            // Ajouter les mots-clés
            if (keywords.length > 0) {
                reply += "🔑 **Mots-clés** : " + keywords.join(", ") + "\n\n";
            }
            
            // Attendre 1 seconde avant d'envoyer la réponse (pour un effet plus naturel)
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Envoyer la réponse à l'utilisateur
            await sendMessage(senderId, reply);
        } else {
            // En cas de problème avec la réponse de l'API
            await sendMessage(senderId, "Désolé, je n'ai pas pu résumer le texte. Veuillez réessayer.");
        }
    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API TextGears:', error);
        await sendMessage(senderId, "Une erreur s'est produite lors du résumé du texte. Veuillez réessayer plus tard.");
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "summarize",
    description: "Résume un texte et extrait les points clés dans différentes langues.",
    usage: "Envoyez 'summarize <votre texte> <code langue>' pour obtenir un résumé. Codes de langue disponibles: en (anglais), fr (français), es (espagnol), de (allemand), it (italien), pt (portugais)."
};
