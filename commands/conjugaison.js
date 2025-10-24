
const axios = require('axios');
const sendMessage = require('../handles/sendMessage'); // Importer la fonction sendMessage

// Fonction pour découper un message en plusieurs morceaux intelligemment
function splitMessageIntoChunks(message, maxLength = 2000) {
    const chunks = [];
    let startIndex = 0;
    
    while (startIndex < message.length) {
        let endIndex = startIndex + maxLength;
        
        // Si on n'est pas à la fin du message
        if (endIndex < message.length) {
            // Chercher le dernier séparateur (point, virgule, espace) avant la limite
            const separators = ['\n\n', '\n', '. ', ', ', ' • ', '• ', ' : ', ' - ', ' ', '/', ')', ']'];
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

// Fonction pour formatter la réponse de conjugaison de manière plus esthétique
function formatConjugaison(verbe, conjugaisonData) {
    // Extraction du texte brut
    const rawText = conjugaisonData.replace(/\n+/g, '\n').trim();
    
    // Ajout d'emojis et de mise en forme
    let formattedText = `🔠 *${verbe.toUpperCase()}* 🔠\n\n`;
    
    // Séparation par sections (modes de conjugaison)
    const sections = rawText.split(/❤️/g);
    
    // Traiter le groupe du verbe s'il existe
    if (sections[0] && sections[0].includes('Verbe du')) {
        const groupInfo = sections[0].replace(/✅[^\n]*\n/g, '').trim();
        formattedText += `📚 *INFORMATION* 📚\n${groupInfo}\n\n`;
    }
    
    // Traiter chaque mode de conjugaison
    for (let i = 1; i < sections.length; i++) {
        if (sections[i]) {
            const [modeName, ...tempsContent] = sections[i].split(/👉/g);
            
            // Ajouter le nom du mode avec des décorations
            formattedText += `🌟 *${modeName.trim()}* 🌟\n`;
            
            // Traiter chaque temps
            tempsContent.forEach(temps => {
                if (temps) {
                    const [tempsName, ...conjugaisons] = temps.split('\n');
                    
                    // Ajouter le nom du temps avec un emoji différent selon le temps
                    let tempsEmoji = '⏰';
                    if (tempsName.includes('Présent')) tempsEmoji = '⏳';
                    else if (tempsName.includes('Passé')) tempsEmoji = '⌛';
                    else if (tempsName.includes('Futur')) tempsEmoji = '🔮';
                    else if (tempsName.includes('Imparfait')) tempsEmoji = '📜';
                    
                    formattedText += `${tempsEmoji} *${tempsName.trim()}*\n`;
                    
                    // Ajouter les conjugaisons avec des puces
                    conjugaisons.forEach(conj => {
                        if (conj.trim()) {
                            formattedText += `   • ${conj.trim()}\n`;
                        }
                    });
                    
                    formattedText += '\n';
                }
            });
        }
    }
    
    // Ajout d'une note de bas de page
    formattedText += `\n✨ *Conjugaison complète du verbe "${verbe}"* ✨`;
    
    return formattedText;
}

module.exports = async (senderId, verbe) => {
    if (!verbe || verbe.trim() === '') {
        await sendMessage(senderId, "⚠️ Veuillez spécifier un verbe. Exemple: conjugaison manger");
        return;
    }
    
    try {
        // Envoyer un message de confirmation que le message a été reçu
        await sendMessage(senderId, "Message reçu, je cherche la conjugaison du verbe...");

        // Appeler l'API de conjugaison avec le verbe donné par l'utilisateur
        const apiUrl = `https://conjugaison-finale.vercel.app/conjugaison?verbe=${encodeURIComponent(verbe.trim())}`;
        const response = await axios.get(apiUrl);

        // Récupérer la clé 'response' dans la réponse de l'API
        const conjugaison = response.data.response;

        // Formatter la réponse avec la nouvelle fonction
        const formattedResponse = formatConjugaison(verbe, conjugaison);

        // Découper la réponse en morceaux de taille appropriée
        const messageChunks = splitMessageIntoChunks(formattedResponse);

        // Envoyer les morceaux successivement avec un délai
        for (const chunk of messageChunks) {
            await sendMessage(senderId, chunk);
            await new Promise(resolve => setTimeout(resolve, 1500));  // Délai de 1.5 seconde entre chaque envoi
        }
    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API de conjugaison:', error);

        // Envoyer un message d'erreur à l'utilisateur en cas de problème
        await sendMessage(senderId, "⚠️ Désolé, une erreur s'est produite lors de la récupération de la conjugaison. Veuillez vérifier l'orthographe du verbe ou réessayer plus tard.");
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "conjugaison",  // Le nom de la commande
    description: "Permet d'obtenir la conjugaison d'un verbe de manière élégante et structurée.",  // Description de la commande
    usage: "Envoyez 'conjugaison <verbe>' pour obtenir la conjugaison complète du verbe."  // Comment utiliser la commande
};
