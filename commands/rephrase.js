
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

module.exports = async (senderId, prompt) => {
    try {
        // Envoyer un message de confirmation que le message a été reçu
        await sendMessage(senderId, "Message reçu, je prépare une reformulation...");

        // Construire l'URL de l'API pour la reformulation
        const apiUrl = `https://sapling-api.vercel.app/rephrase?sapling=${encodeURIComponent(prompt)}`;
        const response = await axios.get(apiUrl);

        // Récupérer les données de la réponse
        const originalPhrase = response.data["phrase réel"];
        const rephrasedText = response.data.paraphrase;

        // Traduire la reformulation en français avec MyMemory API
        const translationApiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(rephrasedText)}&langpair=en|fr`;
        const translationResponse = await axios.get(translationApiUrl);
        const frenchTranslation = translationResponse.data.responseData.translatedText;

        // Attendre 2 secondes avant d'envoyer la réponse
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Formatter et envoyer la réponse avec traduction
        const reply = `📝 **Reformulation terminée :**\n\n🔸 **Texte original :** ${originalPhrase}\n🔸 **Reformulation :** ${rephrasedText}\n🔸 **Traduction en français :** ${frenchTranslation}`;
        
        await sendMessage(senderId, reply);
    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API de reformulation:', error);

        // Envoyer un message d'erreur à l'utilisateur en cas de problème
        await sendMessage(senderId, "Désolé, une erreur s'est produite lors de la reformulation de votre texte.");
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "rephrase",
    description: "Permet de reformuler un texte avec l'API Sapling.",
    usage: "Envoyez 'rephrase <texte>' pour obtenir une reformulation du texte."
};
