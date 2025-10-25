
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Stockage des IDs de session par utilisateur pour maintenir les conversations continues
const userSessionIds = {};

// URL de base pour l'API Claude
const API_BASE_URL = 'https://rapido.zetsu.xyz/api/anthropic';

// Stockage des images en attente
const pendingImages = {};

// Fonction pour convertir les indices en format subscript Unicode
function convertToSubscript(text) {
    // Map des chiffres et lettres vers leurs équivalents subscript
    const subscriptMap = {
        '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
        '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
        'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ',
        'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
        'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
        'v': 'ᵥ', 'x': 'ₓ'
    };
    
    // Convertir les patterns comme U_0, U_n, U_p, etc.
    return text.replace(/([A-Z][a-z]?)_([a-z0-9]+)/g, (match, base, index) => {
        let subscript = '';
        for (let char of index) {
            subscript += subscriptMap[char] || char;
        }
        return base + subscript;
    });
}

// Fonction pour envoyer des messages longs en plusieurs parties si nécessaire
async function sendLongMessage(senderId, message) {
    const MAX_MESSAGE_LENGTH = 2000; // Limite de caractères par message Facebook

    if (message.length <= MAX_MESSAGE_LENGTH) {
        // Si le message est assez court, l'envoyer directement
        await sendMessage(senderId, message);
        return;
    }

    // Diviser le message en plusieurs parties intelligemment
    let startIndex = 0;
    
    while (startIndex < message.length) {
        let endIndex = startIndex + MAX_MESSAGE_LENGTH;
        
        // Si on n'est pas à la fin du message
        if (endIndex < message.length) {
            // Chercher le dernier séparateur (point, virgule, espace) avant la limite
            const separators = ['. ', ', ', ' ', '! ', '? ', '.\n', ',\n', '!\n', '?\n', '\n\n', '\n'];
            let bestBreakPoint = -1;
            
            // Chercher du point le plus proche de la fin jusqu'au début
            for (const separator of separators) {
                // Chercher le dernier séparateur dans la plage
                const lastSeparator = message.lastIndexOf(separator, endIndex);
                if (lastSeparator > startIndex && (bestBreakPoint === -1 || lastSeparator > bestBreakPoint)) {
                    bestBreakPoint = lastSeparator + separator.length;
                }
            }
            
            // Si un séparateur a été trouvé, utiliser ce point de coupure
            if (bestBreakPoint !== -1) {
                endIndex = bestBreakPoint;
            }
        } else {
            // Si c'est la dernière partie, prendre jusqu'à la fin
            endIndex = message.length;
        }
        
        // Extraire la partie du message
        const messagePart = message.substring(startIndex, endIndex);
        await sendMessage(senderId, messagePart);
        await new Promise(resolve => setTimeout(resolve, 1000));  // Pause de 1s entre chaque message
        
        // Passer à la partie suivante
        startIndex = endIndex;
    }
}

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
            await sendMessage(senderId, "✨📸 J'ai bien reçu votre image! Que voulez-vous savoir à propos de cette photo? Posez-moi votre question! 🔍🖼️");
            return { skipCommandCheck: true };
        }

        // Si le prompt est vide (commande 'claude' sans texte)
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, "🤖✨ Bonjour! Je suis Claude, votre assistant IA. Comment puis-je vous aider aujourd'hui? Posez-moi n'importe quelle question ou partagez une image pour que je puisse l'analyser!");
            return;
        }

        // Envoyer un message d'attente stylisé
        await sendMessage(senderId, "✨🧠 Analyse en cours... Claude réfléchit à votre requête avec intelligence artificielle supérieure! ⏳💫");

        let response;
        
        // Vérifier si nous avons une image en attente pour cet utilisateur
        if (pendingImages[senderId]) {
            const imageUrl = pendingImages[senderId];
            
            // Construire l'URL de l'API avec l'image
            const apiUrl = `${API_BASE_URL}?q=${encodeURIComponent(prompt)}&uid=${userSessionIds[senderId]}&model=claude-3-7-sonnet-20250219&image=${encodeURIComponent(imageUrl)}`;
            
            // Appel à l'API avec l'image
            response = await axios.get(apiUrl);
        } else {
            // Appel à l'API sans image (texte seulement)
            const apiUrl = `${API_BASE_URL}?q=${encodeURIComponent(prompt)}&uid=${userSessionIds[senderId]}&model=claude-3-7-sonnet-20250219`;
            response = await axios.get(apiUrl);
        }
        
        // Débogage : afficher la structure de la réponse
        console.log('Structure complète de la réponse API:', JSON.stringify(response.data, null, 2));
        
        // Récupérer la réponse de l'API avec plusieurs tentatives
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
            // Si aucune propriété connue n'est trouvée, utiliser la première valeur non-vide
            const keys = Object.keys(response.data);
            reply = keys.length > 0 ? response.data[keys[0]] : 'Réponse vide reçue de l\'API';
        }
        
        console.log('Réponse extraite:', reply);
        
        // Convertir les indices en format subscript
        const replyWithSubscript = convertToSubscript(reply);
        
        // Créer une réponse formatée et stylisée
        const formattedReply = `
✅CLAUDE MADAGASCAR🇲🇬
━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 *Votre question:* 
${prompt}

✨ *Réponse:* 
${replyWithSubscript}
━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 Powered by 👉@Bruno | Claude AI
`;

        // Envoyer la réponse formatée en utilisant la fonction de découpage dynamique
        await sendLongMessage(senderId, formattedReply);
        
        // Si c'était une demande liée à une image, on peut maintenant la conserver
        // pour les futures questions mais on ne la mentionne plus dans les messages
        
    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Claude:", error);
        
        // Message d'erreur stylisé
        await sendMessage(senderId, `
⚠️ *OUPS! ERREUR TECHNIQUE* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors de la communication avec Claude.
Veuillez réessayer dans quelques instants.

🔄 Si le problème persiste, essayez une autre commande
ou contactez l'administrateur.
━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    }
    
    return { skipCommandCheck: true };
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "claude",
    description: "Discutez avec Claude, une IA avancée capable d'analyser du texte et des images.",
    usage: "Envoyez 'claude <question>' pour discuter avec Claude, ou envoyez une image suivie de questions à son sujet."
};
