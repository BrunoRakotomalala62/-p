
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
        
        // Extraire la langue et le texte à corriger
        let textToCorrect = prompt.trim();
        let language = 'en-GB'; // Langue par défaut (anglais)
        
        // Vérifier si un code de langue est spécifié à la fin
        const parts = textToCorrect.split(/\s+/);
        if (parts.length > 0) {
            const possibleLangCode = parts[parts.length - 1].toLowerCase();
            if (supportedLanguages[possibleLangCode]) {
                language = supportedLanguages[possibleLangCode];
                // Retirer le code de langue du texte à corriger
                textToCorrect = parts.slice(0, parts.length - 1).join(' ');
            }
        }

        // Vérifier si le texte est vide
        if (!textToCorrect) {
            await sendMessage(senderId, "Veuillez fournir un texte à corriger. Exemple : 'correction Bonjour je sui heureux fr'");
            return;
        }

        // Envoyer un message d'attente
        await sendMessage(senderId, `✏️ Analyse et correction en cours (langue: ${language})...`);

        // Configurer l'API URL avec les paramètres
        const apiKey = process.env.TEXTGEARS_API_KEY || "R3tpUnMT2b5fejZD";
        const apiUrl = `https://api.textgears.com/correct?text=${encodeURIComponent(textToCorrect)}&language=${language}&key=${apiKey}`;

        // Appeler l'API TextGears
        const response = await axios.get(apiUrl);

        // Vérifier si la réponse contient les informations nécessaires
        if (response.data && response.data.status === true) {
            const correctedText = response.data.response.corrected;
            
            // Construire une réponse détaillée
            let reply = "✅ **Correction terminée** ✅\n\n";
            reply += `📝 **Texte original** :\n"${textToCorrect}"\n\n`;
            reply += `🌐 **Langue détectée** : ${language}\n\n`;
            reply += `📋 **Texte corrigé** :\n"${correctedText}"`;
            
            // Attendre 1 seconde avant d'envoyer la réponse (pour un effet plus naturel)
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Envoyer la réponse à l'utilisateur
            await sendMessage(senderId, reply);
        } else {
            // En cas de problème avec la réponse de l'API
            await sendMessage(senderId, "Désolé, je n'ai pas pu corriger le texte. Veuillez réessayer.");
        }
    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API TextGears:', error);
        await sendMessage(senderId, "Une erreur s'est produite lors de la correction du texte. Veuillez réessayer plus tard.");
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "correction",
    description: "Corrige les erreurs grammaticales et orthographiques d'un texte dans différentes langues.",
    usage: "Envoyez 'correction <votre texte> <code langue>' pour obtenir une correction. Codes de langue disponibles: en (anglais), fr (français), es (espagnol), de (allemand), it (italien), pt (portugais)."
};
