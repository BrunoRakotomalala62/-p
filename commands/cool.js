
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Stockage des images en attente par utilisateur
const pendingImages = {};

// Fonction pour envoyer des messages longs en plusieurs parties si nécessaire
async function sendLongMessage(senderId, message) {
    const MAX_MESSAGE_LENGTH = 2000;

    if (message.length <= MAX_MESSAGE_LENGTH) {
        await sendMessage(senderId, message);
        return;
    }

    let startIndex = 0;

    while (startIndex < message.length) {
        let endIndex = startIndex + MAX_MESSAGE_LENGTH;

        if (endIndex < message.length) {
            const separators = ['. ', ', ', ' ', '! ', '? ', '.\n', ',\n', '!\n', '?\n', '\n\n', '\n'];
            let bestBreakPoint = -1;

            for (const separator of separators) {
                const lastSeparator = message.lastIndexOf(separator, endIndex);
                if (lastSeparator > startIndex && (bestBreakPoint === -1 || lastSeparator > bestBreakPoint)) {
                    bestBreakPoint = lastSeparator + separator.length;
                }
            }

            if (bestBreakPoint !== -1) {
                endIndex = bestBreakPoint;
            }
        } else {
            endIndex = message.length;
        }

        const messagePart = message.substring(startIndex, endIndex);
        await sendMessage(senderId, messagePart);
        await new Promise(resolve => setTimeout(resolve, 1000));

        startIndex = endIndex;
    }
}

// Fonction pour nettoyer la syntaxe LaTeX
function cleanLatexSyntax(text) {
    return text
        // Supprimer les commandes LaTeX comme \( et \)
        .replace(/\\\(|\\\\\(|\\\\\\\(/g, "")
        .replace(/\\\)|\\\\\)|\\\\\\\)/g, "")
        // Supprimer les commandes LaTeX comme \[ et \]
        .replace(/\\\[|\\\\\[|\\\\\\\[/g, "")
        .replace(/\\\]|\\\\\]|\\\\\\\]/g, "")
        // Remplacer les fractions
        .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "$1/$2")
        // Remplacer les commandes LaTeX comme \implies, \boxed, etc.
        .replace(/\\implies/g, "=>")
        .replace(/\\boxed\{([^{}]+)\}/g, "[$1]")
        .replace(/\\[a-zA-Z]+/g, "")
        // Remplacer les doubles backslashes
        .replace(/\\\\/g, "")
        // Nettoyer les accolades
        .replace(/\{|\}/g, "")
        // Remplacer d'autres notations mathématiques
        .replace(/\\quad/g, " ")
        .replace(/\\cdot/g, "×")
        .replace(/\\times/g, "×")
        .replace(/\\div/g, "÷")
        // Remplacer les expressions comme \text{...} par leur contenu
        .replace(/\\text\{([^{}]+)\}/g, "$1")
        // Nettoyer les expressions avec \equiv et \pmod
        .replace(/\\equiv[^\\]*\\pmod\{([^{}]+)\}/g, "≡ (mod $1)")
        // Nettoyer les mathématiques restantes
        .replace(/\\[a-zA-Z]+\{([^{}]+)\}/g, "$1");
}

module.exports = async (senderId, prompt, api, imageAttachments) => {
    try {
        const API_ENDPOINT = "https://kaiz-apis.gleeze.com/api/gpt-4.1";
        const API_KEY = "115e2076-943c-4deb-a25d-9168e3d7b336";

        // Vérifier si nous avons affaire à un attachement image
        if (imageAttachments && imageAttachments.length > 0) {
            // Stocker l'URL de l'image pour cet utilisateur
            pendingImages[senderId] = imageAttachments[0].payload.url;
            
            // Envoyer un message confirmant la réception de l'image
            await sendMessage(senderId, "✨📸 J'ai bien reçu votre image! Que voulez-vous savoir à propos de cette photo? Posez-moi votre question! 🔍🖼️");
            return { skipCommandCheck: true };
        }

        // Récupérer l'image en attente si elle existe
        let imageUrl = pendingImages[senderId] || null;

        // Si le prompt est vide et qu'il n'y a pas d'image
        if ((!prompt || prompt.trim() === '') && !imageUrl) {
            await sendMessage(senderId, "🤖✨ Bonjour! Je suis GPT-4.1, votre assistant IA. Comment puis-je vous aider aujourd'hui? Posez-moi n'importe quelle question ou partagez une image pour que je puisse l'analyser!");
            return;
        }

        // Envoyer un message d'attente
        await sendMessage(senderId, "✨🧠 Analyse en cours... GPT-4.1 réfléchit à votre requête! ⏳💫");

        let response;

        // Construire les paramètres de la requête
        const queryParams = new URLSearchParams({
            ask: prompt || "Décrivez bien cette photo",
            uid: senderId,
            apikey: API_KEY
        });

        // Ajouter l'image si disponible
        if (imageUrl) {
            queryParams.append('imageUrl', imageUrl);
        }

        const fullUrl = `${API_ENDPOINT}?${queryParams.toString()}`;
        
        console.log('=== GPT-4.1 DEBUG ===');
        console.log('Image URL:', imageUrl);
        console.log('Question:', prompt);
        console.log('API URL:', fullUrl);

        const apiResponse = await axios.get(fullUrl);
        response = apiResponse.data.response;

        if (!response) {
            await sendMessage(senderId, "⚠️ Aucune réponse reçue de l'API.");
            return;
        }

        // Nettoyer la syntaxe LaTeX de la réponse
        const cleanedResponse = cleanLatexSyntax(response);

        // Formater la réponse
        const formattedResponse = `
✅GPT-4.1 MADAGASCAR🇲🇬
━━━━━━━━━━━━━━━━━━━━━━━━━━

✍️Réponse 👇

${cleanedResponse}
━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 Powered by 👉@Bruno | GPT-4.1 AI
`;

        // Envoyer la réponse formatée
        await sendLongMessage(senderId, formattedResponse);

        // Supprimer l'image en attente après utilisation
        if (pendingImages[senderId]) {
            delete pendingImages[senderId];
        }

    } catch (error) {
        console.error("❌ Erreur GPT-4.1:", error?.response?.data || error.message || error);
        await sendMessage(senderId, `
⚠️ *OUPS! ERREUR TECHNIQUE* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors de la communication avec GPT-4.1.
Veuillez réessayer dans quelques instants.

🔄 Si le problème persiste, essayez une autre commande
ou contactez l'administrateur.
━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "cool",
    description: "Discutez avec GPT-4.1, une IA avancée capable d'analyser du texte et des images.",
    usage: "Envoyez 'cool <question>' pour discuter avec GPT-4.1, ou envoyez une image suivie de questions à son sujet."
};
