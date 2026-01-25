
const axios = require('axios');
const sendMessage = require('../handles/sendMessage'); // Importer la fonction sendMessage

module.exports = async (senderId, prompt) => { 
    try {
        // Vérifier si le prompt est vide ou ne contient que des espaces
        if (!prompt || prompt.trim() === '') {
            // Envoyer un message d'invitation plutôt qu'un message d'erreur
            await sendMessage(senderId, "✨ **Humanizer** ✨\n\nVeuillez entrer un texte après la commande 'humanizer' pour que je puisse l'humaniser pour vous.\n\nExemple: `humanizer Bonjour comment vas-tu aujourd'hui`");
            return;
        }

        // Envoyer un message de confirmation que le message a été reçu
        await sendMessage(senderId, "🤖✨ Humanisation de votre texte en cours... Un instant !");

        // Construire l'URL de l'API pour humaniser le texte
        const apiUrl = `https://kaiz-apis.gleeze.com/api/humanizer?q=${encodeURIComponent(prompt)}`;
        const response = await axios.get(apiUrl);

        // Récupérer la réponse de l'API
        const humanizedText = response.data.response;
        const author = response.data.author || "Kaizenji";

        // Construire un message formaté avec emoji et informations de l'auteur
        const formattedResponse = `🥰 HUMANIZER 🇲🇬\n\n${humanizedText}\n\nauteur : 🌞 Bruno ❤️`;

        // Envoyer la réponse formatée à l'utilisateur
        await sendMessage(senderId, formattedResponse);
    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API Humanizer:', error);

        // Envoyer un message d'erreur à l'utilisateur en cas de problème
        await sendMessage(senderId, "Désolé, une erreur s'est produite lors de l'humanisation de votre texte. Veuillez vérifier votre connexion et réessayer.");
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "humanizer",  // Le nom de la commande
    description: "Humanise votre texte pour le rendre plus naturel et fluide.",  // Description de la commande
    usage: "Envoyez 'humanizer <votre texte>' pour obtenir une version humanisée."  // Comment utiliser la commande
};
