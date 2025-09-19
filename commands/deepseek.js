
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Fonction pour découper un message long en morceaux
function splitMessageIntoChunks(message, maxLength = 2000) {
    const chunks = [];
    let startIndex = 0;
    
    while (startIndex < message.length) {
        let endIndex = startIndex + maxLength;
        
        // Si on n'est pas à la fin du message
        if (endIndex < message.length) {
            // Chercher le dernier séparateur (point, virgule, espace) avant la limite
            const separators = ['. ', '! ', '? ', ', ', '\n\n', '\n', ' • ', '• ', ' : ', ' - ', ' ', '/', ')', ']'];
            let bestBreakPoint = -1;
            
            // Chercher du point le plus proche de la fin jusqu'au début
            for (const separator of separators) {
                // Chercher le dernier séparateur dans la plage
                const lastSeparator = message.lastIndexOf(separator, endIndex);
                if (lastSeparator > startIndex && (bestBreakPoint === -1 || lastSeparator > bestBreakPoint)) {
                    bestBreakPoint = lastSeparator + (separator === '\n' || separator === '\n\n' ? 1 : separator.length);
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
        chunks.push(messagePart);
        startIndex = endIndex;
    }
    
    return chunks;
}

// Fonction pour obtenir la date et l'heure actuelles à Madagascar
function getCurrentDateTimeMadagascar() {
    const options = { 
        timeZone: 'Indian/Antananarivo',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };
    
    return new Date().toLocaleString('fr-FR', options);
}

// Fonction pour nettoyer la syntaxe LaTeX et autres caractères spéciaux
function cleanLatexSyntax(text) {
    // Remplacer les formules LaTeX
    return text
        // Remplacer les commandes LaTeX comme \( et \)
        .replace(/\\[\(\[]|\\[\)\]]/g, '')
        // Remplacer les commandes LaTeX comme \implies, \boxed, etc.
        .replace(/\\[a-zA-Z]+/g, '')
        // Remplacer les balises mathématiques
        .replace(/\\\$/g, '$')
        // Remplacer les doubles backslashes
        .replace(/\\\\/g, '')
        // Nettoyer les caractères supplémentaires
        .replace(/\{|\}/g, '')
        // Remplacer les expressions comme \frac{a}{b} par a/b
        .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2')
        // Remplacer les expressions comme \text{...} par leur contenu
        .replace(/\\text\{([^{}]+)\}/g, '$1')
        // Remplacer les autres notations mathématiques superflues
        .replace(/\\quad/g, '  ')
        .replace(/\\cdot/g, '×')
        .replace(/\\times/g, '×')
        .replace(/\\div/g, '÷');
}

// Dictionnaire pour stocker l'historique des conversations
const conversationHistory = {};

module.exports = async (senderId, prompt, uid) => {
    try {
        // Vérifier si l'utilisateur a déjà une conversation en cours
        if (!conversationHistory[senderId]) {
            conversationHistory[senderId] = [];
        }

        // Ajouter le prompt de l'utilisateur à l'historique
        conversationHistory[senderId].push({ role: 'user', message: prompt });

        // Nouveau message d'attente avec des emojis
        await sendMessage(senderId, "🪄✨ Je réfléchis à une réponse magique... Patiente un instant ! 🧠🌟");

        // Construire l'URL de l'API avec la nouvelle adresse
        const apiUrl = `https://zaikyoov3-up.up.railway.app/api/deepseek?prompt=${encodeURIComponent(prompt)}&uid=${encodeURIComponent(uid)}`;
        const response = await axios.get(apiUrl);

        // Récupérer la réponse de l'API 
        let reply = response.data.reply;
        const author = response.data.author || "@renz";
        
        // Nettoyer la syntaxe LaTeX des caractères "\" 
        reply = cleanLatexSyntax(reply);

        // Formater la réponse avec le header et footer demandés
        const currentDateTime = getCurrentDateTimeMadagascar();
        const formattedReply = `🎈 DEEPSEEK AI 🌛
------------------------------

${reply}

---------------------------------
Auteur : 🧍 Bruno 🏅
${currentDateTime} à Madagascar`;

        // Ajouter la réponse du bot à l'historique
        conversationHistory[senderId].push({ role: 'bot', message: formattedReply });

        // Découper le message formaté en morceaux pour respecter la limite de 2000 caractères
        const chunks = splitMessageIntoChunks(formattedReply);

        // Attendre 2 secondes avant d'envoyer la réponse
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Envoyer chaque morceau successivement
        for (const chunk of chunks) {
            await sendMessage(senderId, chunk);
            // Petite pause entre les messages pour éviter de surcharger l'utilisateur
            if (chunks.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    } catch (error) {
        console.error("Erreur lors de l'appel à l'API :", error);

        // Envoyer un message d'erreur à l'utilisateur en cas de problème
        await sendMessage(senderId, "🚨 Oups ! Une erreur est survenue lors du traitement de ta demande. Réessaie plus tard ! 🤖");
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "deepseek",  // Le nom de la commande
    description: "Pose ta question et obtiens une réponse magique avec DeepSeek AI.",  // Description de la commande
    usage: "Envoyez 'deepseek <question>' pour poser une question à DeepSeek."  // Comment utiliser la commande
};
