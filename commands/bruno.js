const axios = require('axios');
const sendMessage = require('../handles/sendMessage'); // Importer la fonction sendMessage

// Stockage des IDs de session par utilisateur pour maintenir les conversations continues
const userSessionIds = {};

// Stockage des images en attente
const pendingImages = {};

// Fonction pour formater la réponse avec des caractères unicode et emojis
function formatResponse(text) {
    // Emojis contextuels selon les mots-clés
    const emojiMap = {
        'bonjour': '👋',
        'merci': '🙏',
        'question': '❓',
        'réponse': '💡',
        'aide': '🆘',
        'important': '⚠️',
        'attention': '⚡',
        'exemple': '📋',
        'conseil': '💡',
        'astuce': '✨',
        'information': 'ℹ️',
        'note': '📝',
        'image': '🖼️',
        'photo': '📸',
        'analyse': '🔍',
        'résultat': '✅',
        'erreur': '❌',
        'succès': '🎉',
        'problème': '⚠️',
        'solution': '💡',
        'créer': '🎨',
        'art': '🎨',
        'design': '✨',
        'couleur': '🎨',
        'composition': '🖼️',
        'chat': '🐱',
        'chien': '🐕',
        'animal': '🐾',
        'nature': '🌿',
        'fleur': '🌸',
        'arbre': '🌳',
        'ciel': '☁️',
        'soleil': '☀️',
        'lune': '🌙',
        'étoile': '⭐',
        'eau': '💧',
        'feu': '🔥',
        'terre': '🌍',
        'musique': '🎵',
        'livre': '📚',
        'étude': '📖',
        'science': '🔬',
        'technologie': '💻',
        'code': '💻',
        'programmation': '⌨️',
        'temps': '⏰',
        'calendrier': '📅',
        'histoire': '📜',
        'futur': '🔮',
        'idée': '💭',
        'pensée': '🧠',
        'cœur': '❤️',
        'amour': '💕',
        'joie': '😊',
        'tristesse': '😢',
        'bonheur': '😄',
        'force': '💪',
        'santé': '🏥',
        'nourriture': '🍽️',
        'voyage': '✈️',
        'maison': '🏠',
        'ville': '🏙️',
        'pays': '🗺️'
    };

    // Remplacer les titres commençant par # par des caractères unicode stylés
    let formattedText = text;
    
    // Remplacer ### par ▸▸▸ (sous-sous-titre)
    formattedText = formattedText.replace(/^### (.+)$/gm, '▸▸▸ $1');
    
    // Remplacer ## par ▸▸ (sous-titre)
    formattedText = formattedText.replace(/^## (.+)$/gm, '▸▸ $1');
    
    // Remplacer # par ▸ (titre principal)
    formattedText = formattedText.replace(/^# (.+)$/gm, '▸ $1');
    
    // Remplacer les listes à puces - par •
    formattedText = formattedText.replace(/^- /gm, '• ');
    
    // Ajouter des emojis contextuels basés sur les mots-clés
    for (const [keyword, emoji] of Object.entries(emojiMap)) {
        const regex = new RegExp(`\\b${keyword}s?\\b`, 'gi');
        if (regex.test(formattedText) && !formattedText.includes(emoji)) {
            // Ajouter l'emoji au début si le mot-clé est présent
            const match = formattedText.match(regex);
            if (match) {
                formattedText = formattedText.replace(regex, (matched) => `${matched} ${emoji}`);
                break; // Ajouter un seul emoji pour éviter la surcharge
            }
        }
    }
    
    // Embellir les sections avec des séparateurs
    formattedText = formattedText.replace(/^▸ (.+)$/gm, '\n╔═══════════════════════\n║ ✨ $1\n╚═══════════════════════');
    formattedText = formattedText.replace(/^▸▸ (.+)$/gm, '\n┌───────────────\n│ 💫 $1\n└───────────────');
    formattedText = formattedText.replace(/^▸▸▸ (.+)$/gm, '\n├─ ⭐ $1');
    
    // Ajouter un en-tête stylisé
    const header = `
╔═══════════════════════════════════╗
║   🤖 ✨ RÉPONSE DE BRUNO ✨ 🤖   ║
╚═══════════════════════════════════╝
`;
    
    // Ajouter un pied de page
    const footer = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Propulsé par GPT-5 | ⚡ Rapide & Précis
`;
    
    return header + formattedText + footer;
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
    let partNumber = 1;
    const totalParts = Math.ceil(message.length / MAX_MESSAGE_LENGTH);

    while (startIndex < message.length) {
        let endIndex = startIndex + MAX_MESSAGE_LENGTH;

        // Si on n'est pas à la fin du message
        if (endIndex < message.length) {
            // Chercher le dernier séparateur (point, virgule, espace) avant la limite
            const separators = ['\n\n', '\n', '. ', ', ', ' • ', '• ', ' : ', ' - ', ' ', '! ', '? ', '.\n', ',\n', '!\n', '?\n'];
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
        let messagePart = message.substring(startIndex, endIndex);
        
        // Ajouter un indicateur de partie si le message est divisé
        if (totalParts > 1) {
            if (partNumber === 1) {
                messagePart = `${messagePart}\n\n📄 Partie ${partNumber}/${totalParts}`;
            } else {
                messagePart = `📄 Partie ${partNumber}/${totalParts}\n\n${messagePart}`;
            }
        }
        
        await sendMessage(senderId, messagePart);
        await new Promise(resolve => setTimeout(resolve, 1000));  // Pause de 1s entre chaque message

        // Passer à la partie suivante
        startIndex = endIndex;
        partNumber++;
    }
}

module.exports = async (senderId, prompt, api, imageAttachments) => { 
    try {
        // Vérifier si c'est une demande de réinitialisation
        if (prompt === "RESET_CONVERSATION") {
            // Supprimer l'ID de session pour forcer une nouvelle conversation
            delete userSessionIds[senderId];
            // Supprimer toute image en attente
            delete pendingImages[senderId];
            return { skipCommandCheck: true };
        }

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

        // Si le prompt est vide (commande 'bruno' sans texte)
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, "🤖✨ Bonjour! Je suis Bruno, votre assistant IA. Comment puis-je vous aider aujourd'hui? Posez-moi n'importe quelle question!");
            return;
        }

        // Envoyer un message d'attente stylisé
        await sendMessage(senderId, "✨🧠 Analyse en cours... ⏳💫");

        // Construire l'URL de l'API selon si on a une image ou non
        let apiUrl;
        if (pendingImages[senderId]) {
            // Cas avec image : utiliser l'URL de l'image stockée
            apiUrl = `https://norch-project.gleeze.com/api/Gpt4.1nano?text=${encodeURIComponent(prompt)}&imageUrl=${encodeURIComponent(pendingImages[senderId])}&uid=${senderId}`;
            // Supprimer l'image en attente après utilisation
            delete pendingImages[senderId];
        } else {
            // Cas sans image : conversation texte uniquement
            apiUrl = `https://norch-project.gleeze.com/api/Gpt4.1nano?text=${encodeURIComponent(prompt)}&uid=${senderId}`;
        }

        // Appel à l'API avec un timeout de 60 secondes (l'API peut être lente)
        const response = await axios.get(apiUrl, {
            timeout: 60000, // 60 secondes
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });

        // Récupérer la réponse de l'API
        let reply = '';
        if (response.data && response.data.success && response.data.result) {
            reply = response.data.result;
        } else if (response.data && response.data.result) {
            reply = response.data.result;
        } else {
            console.error('Structure de réponse inattendue:', JSON.stringify(response.data));
            reply = "Désolé, j'ai reçu une réponse inattendue de l'API.";
        }

        // Formater la réponse avec des caractères unicode et emojis
        const formattedReply = formatResponse(reply);

        // Envoyer la réponse formatée en utilisant la nouvelle fonction
        await sendLongMessage(senderId, formattedReply);

    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Bruno:", error.message);
        console.error("Détails de l'erreur:", error.response?.data || error);

        // Déterminer le type d'erreur
        let errorMessage = '';
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            errorMessage = `⏱️ L'API met trop de temps à répondre. L'analyse peut prendre jusqu'à 30 secondes pour les images complexes. Veuillez réessayer.`;
        } else if (error.response) {
            errorMessage = `❌ L'API a retourné une erreur (Code: ${error.response.status}).\nDétails: ${JSON.stringify(error.response.data)}`;
        } else if (error.request) {
            errorMessage = `🌐 Impossible de contacter l'API. Vérifiez votre connexion internet.`;
        } else {
            errorMessage = `⚠️ Erreur: ${error.message}`;
        }

        // Message d'erreur stylisé
        await sendMessage(senderId, `
⚠️ *OUPS! ERREUR TECHNIQUE* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
${errorMessage}

🔄 Suggestions:
• Vérifiez votre connexion internet
• Réessayez dans quelques instants
• Pour les images, assurez-vous qu'elles sont accessibles publiquement

💡 Si le problème persiste, contactez l'administrateur.
━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    }

    return { skipCommandCheck: true };
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "Bruno",
    description: "Discutez avec Bruno, une IA avancée propulsée par Claude Haiku 4.5 via Anthropic.",
    usage: "Envoyez 'bruno <question>' pour discuter avec Bruno."
};