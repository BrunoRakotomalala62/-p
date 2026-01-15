const axios = require('axios');
const sendMessage = require('../handles/sendMessage'); // Importer la fonction sendMessage

module.exports = async (senderId, prompt) => {
    try {
        // Envoyer un message de confirmation que le message a été reçu
        await sendMessage(senderId, "Message reçu, je prépare une réponse...");

        // Vérifier si l'utilisateur a fourni un prompt
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, "Veuillez fournir un texte pour transformer l'image.");
            return;
        }

        // Pour cette API, nous avons besoin d'une image source. 
        // L'utilisateur a fourni un exemple avec prompt, image, et uid.
        // Ici on suppose que le prompt contient le texte de transformation.
        const query = encodeURIComponent(prompt.trim());
        const imageUrlDefault = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSufnlAbOiwEqlFFnC8ZDoy9kEn_CqiRa9WWCPm2c2sYbmz_4U3Ct_f-bc";
        const apiUrl = `https://nano-banana-api-five.vercel.app/nanobanana?prompt=${query}&image=${imageUrlDefault}&s&uid=${senderId}`;

        // Envoyer un message de confirmation de traitement
        await sendMessage(senderId, "Traitement de l'image en cours... Veuillez patienter.");

        // Appeler l'API nano-banana
        const response = await axios.get(apiUrl);

        // Récupérer l'URL du résultat
        const resultUrl = response.data.resultats_url;

        if (resultUrl) {
            // Envoyer le résultat à l'utilisateur
            await sendMessage(senderId, {
                attachment: {
                    type: 'image',
                    payload: {
                        url: resultUrl,
                        is_reusable: true
                    }
                }
            });
        } else {
            await sendMessage(senderId, "Désolé, je n'ai pas pu générer le résultat.");
        }
    } catch (error) {
        console.error("Erreur lors de l'appel à l'API nano-banana:", error);
        await sendMessage(senderId, "Désolé, une erreur s'est produite lors du traitement de votre demande.");
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "nano",  // Le nom de la commande
    description: "Transforme une image en fonction d'un prompt via l'API Nano Banana.",
    usage: "Envoyez 'nano <votre instruction>' pour transformer l'image."
};
