
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Stockage des IDs de session par utilisateur pour maintenir les conversations continues
const userSessionIds = {};

// URL de base pour l'API Claude
const API_BASE_URL = 'https://rapido.zetsu.xyz/api/anthropic';

// Stockage des images en attente
const pendingImages = {};

module.exports = async (senderId, prompt, api, imageAttachments) => {
    try {
        // Initialiser l'ID de session si ce n'est pas déjà fait
        if (!userSessionIds[senderId]) {
            userSessionIds[senderId] = senderId; // Utiliser senderId comme ID de session
        }

        // Vérifier si nous avons affaire à un attachement image
        if (imageAttachments && imageAttachments.length > 0) {
            // Stocker l'URL de l'image pour cet utilisateur
            pendingImages[senderId] = imageAttachments[0].payload.url;
            
            // Envoyer un message confirmant la réception de l'image
            await sendMessage(senderId, "📸 J'ai bien reçu votre image! Que voulez-vous savoir à propos de cette photo? Posez-moi votre question!");
            return { skipCommandCheck: true };
        }

        // Si le prompt est vide (commande 'bien' sans texte)
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, "🤖 Bonjour! Je suis BOT BIEN, votre analyseur d'images intelligent. Envoyez-moi une image et posez votre question pour que je puisse l'analyser!");
            return;
        }

        // Vérifier si nous avons une image en attente pour cet utilisateur
        if (!pendingImages[senderId]) {
            await sendMessage(senderId, "⚠️ Veuillez d'abord envoyer une image en pièce jointe, puis posez votre question à son sujet.");
            return;
        }

        // Envoyer un message d'attente
        await sendMessage(senderId, "🔍 Analyse de votre image en cours...");

        const imageUrl = pendingImages[senderId];
        
        // Construire l'URL de l'API avec l'image
        const apiUrl = `${API_BASE_URL}?q=${encodeURIComponent(prompt)}&uid=${userSessionIds[senderId]}&model=claude-3-7-sonnet-20250219&image=${encodeURIComponent(imageUrl)}&system=&max_tokens=3000`;
        
        // Appel à l'API avec l'image
        const response = await axios.get(apiUrl);
        
        // Débogage : afficher la structure de la réponse
        console.log('Structure complète de la réponse API:', JSON.stringify(response.data, null, 2));
        
        // Récupérer la réponse de l'API
        let reply;
        if (response.data.response) {
            reply = response.data.response;
        } else if (response.data.content) {
            reply = response.data.content;
        } else if (response.data.message) {
            reply = response.data.message;
        } else if (response.data.text) {
            reply = response.data.text;
        } else if (typeof response.data === 'string') {
            reply = response.data;
        } else {
            reply = 'Réponse vide reçue de l\'API';
        }
        
        console.log('Réponse extraite:', reply);
        
        // Créer une réponse formatée selon le style demandé
        const formattedReply = `😍BOT BIEN😍
${reply}`;

        // Envoyer la réponse formatée
        await sendMessage(senderId, formattedReply);
        
        // Garder l'image pour d'autres questions potentielles
        
    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Claude:", error);
        
        // Message d'erreur
        await sendMessage(senderId, "⚠️ Une erreur s'est produite lors de l'analyse de votre image. Veuillez réessayer.");
    }
    
    return { skipCommandCheck: true };
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "bien",
    description: "Analysez des images avec l'intelligence artificielle Claude. Envoyez une image puis posez vos questions.",
    usage: "Envoyez une image en pièce jointe, puis utilisez 'bien <question>' pour l'analyser."
};
