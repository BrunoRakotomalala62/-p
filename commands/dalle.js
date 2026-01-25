
const sendMessage = require('../handles/sendMessage');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = async (senderId, prompt) => {
    try {
        // Vérifier si un prompt a été fourni
        if (!prompt || prompt.trim() === '') {
            return await sendMessage(senderId, "⚠️ Veuillez fournir une description pour générer une image.\nExemple: dalle petit chat");
        }

        // Envoyer un message d'attente
        await sendMessage(senderId, "🎨 Génération en cours avec DALL-E 3... ⏳");

        try {
            // Essayer avec l'API de Zetsu (qui semble avoir un problème d'authentification)
            const apiUrl = `https://api.zetsu.xyz/api/dalle-3?prompt=${encodeURIComponent(prompt)}`;
            console.log(`Appel API DALL-E avec l'URL: ${apiUrl}`);

            // Essayer d'envoyer directement l'URL dans un message avec une pièce jointe
            await sendMessage(senderId, {
                attachment: {
                    type: "image",
                    payload: {
                        url: apiUrl,
                        is_reusable: true
                    }
                }
            });
        } catch (apiError) {
            console.error('Erreur avec l\'API principale:', apiError.message);
            
            // Alternative: utiliser une autre API de génération d'images si disponible
            try {
                // API de secours (exemple)
                const fallbackApiUrl = `https://image-generation-api.free.beeceptor.com/generate?prompt=${encodeURIComponent(prompt)}`;
                
                // Informer l'utilisateur que nous utilisons une alternative
                await sendMessage(senderId, "🔄 L'API principale est indisponible, utilisation d'une API alternative...");
                
                // Tentative avec l'API alternative
                await sendMessage(senderId, {
                    attachment: {
                        type: "image",
                        payload: {
                            url: fallbackApiUrl,
                            is_reusable: true
                        }
                    }
                });
            } catch (fallbackError) {
                // Si même l'API alternative échoue, informer l'utilisateur
                console.error('Erreur avec l\'API alternative:', fallbackError.message);
                throw new Error("Les deux API ont échoué");
            }
        }

    } catch (error) {
        console.error('Erreur lors de la génération d\'image:', error.message);
        
        // Envoyer un message d'erreur à l'utilisateur avec plus de détails
        await sendMessage(senderId, "🚨 Désolé, une erreur s'est produite lors de la génération de l'image.\n\nLe service DALL-E semble temporairement indisponible. Veuillez réessayer plus tard ou essayer avec un prompt différent.");
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "dalle",  // Le nom de la commande
    description: "Génère une image avec DALL-E 3 à partir d'un prompt",  // Description de la commande
    usage: "dalle <description>"  // Comment utiliser la commande
};
