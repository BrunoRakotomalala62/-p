
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Stockage des IDs de session par utilisateur pour maintenir les conversations continues
const userSessionIds = {};

// URL de base pour la nouvelle API
const API_BASE_URL = 'https://norch-project.gleeze.com/api/Compound';

// Stockage des images en attente
const pendingImages = {};

// Fonction pour ajouter des emojis dynamiques selon le contexte
function addContextualEmojis(text) {
    const textLower = text.toLowerCase();
    let emoji = '✨';
    
    // Emojis basés sur le contexte
    if (textLower.includes('science') || textLower.includes('scientifique') || textLower.includes('recherche')) {
        emoji = '🔬';
    } else if (textLower.includes('mathématique') || textLower.includes('calcul') || textLower.includes('équation')) {
        emoji = '🧮';
    } else if (textLower.includes('histoire') || textLower.includes('historique') || textLower.includes('guerre')) {
        emoji = '📜';
    } else if (textLower.includes('géographie') || textLower.includes('pays') || textLower.includes('ville')) {
        emoji = '🌍';
    } else if (textLower.includes('art') || textLower.includes('peinture') || textLower.includes('musique')) {
        emoji = '🎨';
    } else if (textLower.includes('technologie') || textLower.includes('informatique') || textLower.includes('ordinateur')) {
        emoji = '💻';
    } else if (textLower.includes('économie') || textLower.includes('finance') || textLower.includes('argent')) {
        emoji = '💰';
    } else if (textLower.includes('santé') || textLower.includes('médecin') || textLower.includes('maladie')) {
        emoji = '⚕️';
    } else if (textLower.includes('sport') || textLower.includes('football') || textLower.includes('athlète')) {
        emoji = '⚽';
    } else if (textLower.includes('cuisine') || textLower.includes('recette') || textLower.includes('nourriture')) {
        emoji = '🍳';
    } else if (textLower.includes('politique') || textLower.includes('gouvernement') || textLower.includes('élection')) {
        emoji = '🏛️';
    } else if (textLower.includes('relation') || textLower.includes('international') || textLower.includes('diplomatie')) {
        emoji = '🌐';
    } else if (textLower.includes('éducation') || textLower.includes('école') || textLower.includes('étudiant')) {
        emoji = '📚';
    } else if (textLower.includes('nature') || textLower.includes('environnement') || textLower.includes('écologie')) {
        emoji = '🌿';
    } else if (textLower.includes('amour') || textLower.includes('cœur') || textLower.includes('sentiment')) {
        emoji = '❤️';
    } else if (textLower.includes('voyage') || textLower.includes('tourisme') || textLower.includes('vacances')) {
        emoji = '✈️';
    }
    
    return emoji;
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
            userSessionIds[senderId] = `user_${senderId}`; // Utiliser senderId comme ID de session
        }

        // Si le prompt est vide (commande 'kilody' sans texte)
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, "🤖 Kilody Bot 🤖\n\n✨ Bonjour! Je suis Kilody, votre assistant IA intelligent et polyvalent.\n\n💡 Posez-moi n'importe quelle question sur:\n📚 L'éducation & la science\n🌍 La géographie & l'histoire\n💻 La technologie\n🎨 L'art & la culture\n⚽ Le sport\n🍳 La cuisine\n...et bien plus encore!\n\n➡️ Commencez simplement par taper votre question!");
            return;
        }

        // Envoyer un message d'attente avec emoji dynamique
        await sendMessage(senderId, "⏳ Analyse en cours... Kilody réfléchit à votre question! 🧠💭");

        // Construire l'URL de l'API avec les nouveaux paramètres
        const apiUrl = `${API_BASE_URL}?prompt=${encodeURIComponent(prompt)}&uid=${encodeURIComponent(userSessionIds[senderId])}&name=Developer`;
        
        // Appel à l'API
        const response = await axios.get(apiUrl);
        
        // Débogage : afficher la structure de la réponse
        console.log('Structure complète de la réponse API Kilody:', JSON.stringify(response.data, null, 2));
        
        // Vérifier si la requête a réussi
        if (!response.data.success) {
            throw new Error('La requête API a échoué');
        }
        
        // Récupérer la réponse de l'API
        let reply = response.data.reply;
        
        if (!reply) {
            throw new Error('Aucune réponse reçue de l\'API');
        }
        
        console.log('Réponse extraite par Kilody:', reply);
        
        // Détecter l'emoji contextuel basé sur le contenu de la réponse
        const contextEmoji = addContextualEmojis(reply);
        
        // Créer une réponse formatée avec l'emoji dynamique et l'en-tête
        const formattedReply = `${contextEmoji} 𝐊𝐈𝐋𝐎𝐃𝐘 𝐁𝐎𝐓 ${contextEmoji}\n\n${reply}\n\n━━━━━━━━━━━━━━━\n💬 Posez-moi une autre question!`;

        // Envoyer la réponse formatée en utilisant la fonction de découpage dynamique
        await sendLongMessage(senderId, formattedReply);
        
        // Afficher les informations de mémoire si disponibles
        if (response.data.memoryCount) {
            console.log(`💾 Mémoire de conversation: ${response.data.memoryCount} messages`);
        }
        
    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Kilody:", error.message);
        
        // Message d'erreur avec emoji
        await sendMessage(senderId, `❌ 𝐊𝐈𝐋𝐎𝐃𝐘 𝐁𝐎𝐓 ❌\n\n😔 Oups! Une erreur s'est produite lors de la communication avec Kilody.\n\n🔄 Veuillez réessayer dans quelques instants.\n\n💡 Si le problème persiste, contactez l'administrateur.`);
    }
    
    return { skipCommandCheck: true };
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "kilody",
    description: "Discutez avec Kilody, une IA avancée avec des réponses dynamiques et attractives.",
    usage: "Envoyez 'kilody <question>' pour discuter avec Kilody. Les réponses longues sont automatiquement divisées et envoyées avec des emojis contextuels."
};
