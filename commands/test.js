
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Stockage des IDs de session par utilisateur pour maintenir les conversations continues
const userSessionIds = {};

// URL de base pour l'API Sonnet 3.5
const API_BASE_URL = 'https://zaikyoov3-up.up.railway.app/api/sonnet-3-5';

// Fonction pour obtenir la date et l'heure actuelles à Madagascar
function getDateTimeMadagascar() {
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

// Fonction pour corriger le texte avec TextGears
async function correctText(text, language = 'fr-FR') {
    try {
        const apiKey = process.env.TEXTGEARS_API_KEY || "R3tpUnMT2b5fejZD";
        const apiUrl = `https://api.textgears.com/correct?text=${encodeURIComponent(text)}&language=${language}&key=${apiKey}`;
        
        const response = await axios.get(apiUrl);
        
        // Vérifier si la correction a réussi
        if (response.data && response.data.status === true) {
            return {
                original: text,
                corrected: response.data.response.corrected,
                success: true
            };
        } else {
            return {
                original: text,
                corrected: text, // En cas d'échec, on renvoie le texte original
                success: false
            };
        }
    } catch (error) {
        console.error("Erreur lors de la correction du texte:", error);
        return {
            original: text,
            corrected: text, // En cas d'erreur, on renvoie le texte original
            success: false
        };
    }
}

// Fonction pour obtenir une réponse de Claude
async function getClaudeResponse(prompt, userId) {
    try {
        // S'assurer que l'utilisateur a un ID de session
        if (!userSessionIds[userId]) {
            userSessionIds[userId] = userId;
        }
        
        // Appel à l'API Claude
        const apiUrl = `${API_BASE_URL}?prompt=${encodeURIComponent(prompt)}&uid=${userSessionIds[userId]}`;
        const response = await axios.get(apiUrl);
        
        // Mettre à jour l'ID de session si nécessaire
        if (response.data.session_id) {
            userSessionIds[userId] = response.data.session_id;
        }
        
        return {
            reply: response.data.reply,
            success: true
        };
    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Claude:", error);
        return {
            reply: "Désolé, une erreur est survenue lors de la communication avec l'assistant IA.",
            success: false
        };
    }
}

module.exports = async (senderId, prompt) => {
    try {
        // Si le prompt est vide (commande 'test' sans texte)
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, "🤖✨ Bonjour! Je suis le correcteur orthographique. Envoyez-moi un texte et je le corrigerai avant de le soumettre à Claude pour analyse!");
            return;
        }

        // Envoyer un message d'attente stylisé
        await sendMessage(senderId, "✨🧠 Correction orthographique en cours... ⏳");

        // Étape 1: Corriger le texte avec TextGears
        const correction = await correctText(prompt);
        
        // Étape 2: Envoyer le texte corrigé à Claude
        const claudeResponse = await getClaudeResponse(correction.corrected, senderId);
        
        // Formater la réponse finale
        const formattedReply = `
🌞 CORRECTEUR 🔑
-----------------------
question : ${correction.original}

Correction : ${correction.corrected}

🤖 Réponse de Claude 🔋
------------------------------
${claudeResponse.reply}


Auteur : 🚀 Bruno 🚀
${getDateTimeMadagascar()}
`;

        // Envoyer la réponse formatée
        await sendLongMessage(senderId, formattedReply);
        
    } catch (error) {
        console.error("Erreur lors du traitement:", error);
        
        // Message d'erreur stylisé
        await sendMessage(senderId, `
⚠️ *OUPS! ERREUR TECHNIQUE* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors du traitement de votre demande.
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
    name: "test",
    description: "Corrige l'orthographe de votre texte avec TextGears puis le soumet à Claude pour analyse.",
    usage: "Envoyez 'test <texte>' pour corriger et analyser votre message."
};
