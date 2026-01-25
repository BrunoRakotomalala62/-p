const axios = require('axios');
const sendMessage = require('../handles/sendMessage'); // Importer la fonction sendMessage

// Stockage des IDs de session par utilisateur pour maintenir les conversations continues
const userSessionIds = {};

// Stockage des images en attente
const pendingImages = {};

// Fonction pour convertir du texte en unicode gras
function toBoldUnicode(text) {
    const boldMap = {
        'A': '𝐀', 'B': '𝐁', 'C': '𝐂', 'D': '𝐃', 'E': '𝐄', 'F': '𝐅', 'G': '𝐆', 'H': '𝐇', 'I': '𝐈', 'J': '𝐉',
        'K': '𝐊', 'L': '𝐋', 'M': '𝐌', 'N': '𝐍', 'O': '𝐎', 'P': '𝐏', 'Q': '𝐐', 'R': '𝐑', 'S': '𝐒', 'T': '𝐓',
        'U': '𝐔', 'V': '𝐕', 'W': '𝐖', 'X': '𝐗', 'Y': '𝐘', 'Z': '𝐙',
        'a': '𝐚', 'b': '𝐛', 'c': '𝐜', 'd': '𝐝', 'e': '𝐞', 'f': '𝐟', 'g': '𝐠', 'h': '𝐡', 'i': '𝐢', 'j': '𝐣',
        'k': '𝐤', 'l': '𝐥', 'm': '𝐦', 'n': '𝐧', 'o': '𝐨', 'p': '𝐩', 'q': '𝐪', 'r': '𝐫', 's': '𝐬', 't': '𝐭',
        'u': '𝐮', 'v': '𝐯', 'w': '𝐰', 'x': '𝐱', 'y': '𝐲', 'z': '𝐳',
        '0': '𝟎', '1': '𝟏', '2': '𝟐', '3': '𝟑', '4': '𝟒', '5': '𝟓', '6': '𝟔', '7': '𝟕', '8': '𝟖', '9': '𝟗'
    };
    return text.split('').map(char => boldMap[char] || char).join('');
}

// Fonction pour nettoyer les symboles LaTeX
function cleanLatex(text) {
    let cleaned = text;
    
    // Supprimer \( et \) pour les formules inline
    cleaned = cleaned.replace(/\\\(/g, '');
    cleaned = cleaned.replace(/\\\)/g, '');
    
    // Supprimer \[ et \] pour les formules display
    cleaned = cleaned.replace(/\\\[/g, '');
    cleaned = cleaned.replace(/\\\]/g, '');
    
    // Convertir \frac{a}{b} en a/b
    cleaned = cleaned.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2');
    
    // Supprimer les commandes LaTeX courantes
    cleaned = cleaned.replace(/\\cdot/g, '×');
    cleaned = cleaned.replace(/\\times/g, '×');
    cleaned = cleaned.replace(/\\div/g, '÷');
    cleaned = cleaned.replace(/\\pm/g, '±');
    cleaned = cleaned.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');
    cleaned = cleaned.replace(/\\sqrt/g, '√');
    cleaned = cleaned.replace(/\\pi/g, 'π');
    cleaned = cleaned.replace(/\\infty/g, '∞');
    cleaned = cleaned.replace(/\\alpha/g, 'α');
    cleaned = cleaned.replace(/\\beta/g, 'β');
    cleaned = cleaned.replace(/\\gamma/g, 'γ');
    cleaned = cleaned.replace(/\\delta/g, 'δ');
    cleaned = cleaned.replace(/\\theta/g, 'θ');
    cleaned = cleaned.replace(/\\lambda/g, 'λ');
    cleaned = cleaned.replace(/\\mu/g, 'μ');
    cleaned = cleaned.replace(/\\sigma/g, 'σ');
    cleaned = cleaned.replace(/\\omega/g, 'ω');
    cleaned = cleaned.replace(/\\sum/g, '∑');
    cleaned = cleaned.replace(/\\int/g, '∫');
    cleaned = cleaned.replace(/\\leq/g, '≤');
    cleaned = cleaned.replace(/\\geq/g, '≥');
    cleaned = cleaned.replace(/\\neq/g, '≠');
    cleaned = cleaned.replace(/\\approx/g, '≈');
    cleaned = cleaned.replace(/\\rightarrow/g, '→');
    cleaned = cleaned.replace(/\\leftarrow/g, '←');
    cleaned = cleaned.replace(/\\Rightarrow/g, '⇒');
    cleaned = cleaned.replace(/\\Leftarrow/g, '⇐');
    
    // Supprimer les exposants LaTeX ^{...} et les convertir
    cleaned = cleaned.replace(/\^{([^}]+)}/g, '^$1');
    cleaned = cleaned.replace(/\^(\d)/g, '^$1');
    
    // Supprimer les indices LaTeX _{...}
    cleaned = cleaned.replace(/_{([^}]+)}/g, '_$1');
    
    // Nettoyer les commandes LaTeX restantes comme \text{...}
    cleaned = cleaned.replace(/\\text\{([^}]+)\}/g, '$1');
    cleaned = cleaned.replace(/\\textbf\{([^}]+)\}/g, '$1');
    cleaned = cleaned.replace(/\\textit\{([^}]+)\}/g, '$1');
    cleaned = cleaned.replace(/\\mathrm\{([^}]+)\}/g, '$1');
    cleaned = cleaned.replace(/\\mathbf\{([^}]+)\}/g, '$1');
    
    // Supprimer les backslash restants devant les caractères
    cleaned = cleaned.replace(/\\([a-zA-Z]+)/g, '$1');
    
    return cleaned;
}

// Fonction pour formater la réponse avec des caractères unicode et emojis
function formatResponse(text) {
    // D'abord nettoyer les symboles LaTeX
    let formattedText = cleanLatex(text);
    
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

    // Remplacer les titres commençant par # par des titres en gras unicode
    // Remplacer ### par sous-sous-titre en gras
    formattedText = formattedText.replace(/^### (.+)$/gm, (match, title) => `▸▸▸ ${toBoldUnicode(title)}`);
    
    // Remplacer ## par sous-titre en gras
    formattedText = formattedText.replace(/^## (.+)$/gm, (match, title) => `▸▸ ${toBoldUnicode(title)}`);
    
    // Remplacer # par titre principal en gras
    formattedText = formattedText.replace(/^# (.+)$/gm, (match, title) => `▸ ${toBoldUnicode(title)}`);
    
    // Convertir **texte** en gras unicode
    formattedText = formattedText.replace(/\*\*([^*]+)\*\*/g, (match, content) => toBoldUnicode(content));
    
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
    
    // Embellir les sections avec des séparateurs (les titres sont déjà en gras unicode)
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
            apiUrl = `https://cohere-mu.vercel.app/cohere?prompt=${encodeURIComponent(prompt)}&image=${encodeURIComponent(pendingImages[senderId])}&uid=${senderId}`;
            // Supprimer l'image en attente après utilisation
            delete pendingImages[senderId];
        } else {
            // Cas sans image : conversation texte uniquement
            apiUrl = `https://cohere-mu.vercel.app/cohere?prompt=${encodeURIComponent(prompt)}&uid=${senderId}`;
        }

        // Appel à l'API avec un timeout de 60 secondes (l'API peut être lente)
        const response = await axios.get(apiUrl, {
            timeout: 60000, // 60 secondes
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });

        // Récupérer la réponse de l'API Cohere
        let reply = '';
        if (response.data && response.data.status === 'success' && response.data.response) {
            reply = response.data.response;
        } else if (response.data && response.data.response) {
            reply = response.data.response;
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
    description: "Discutez avec Bruno, une IA avancée propulsée par Cohere avec support d'analyse d'images.",
    usage: "Envoyez 'bruno <question>' pour discuter ou envoyez une image puis posez des questions à son sujet."
};