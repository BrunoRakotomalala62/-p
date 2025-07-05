
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

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

module.exports = async (senderId, prompt, api) => {
    try {
        // Vérifier si un prompt a été fourni
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, "🌐 Webia Search\n\n❌ Veuillez fournir une question ou un sujet de recherche.\n\nExemple: webia actualités Madagascar");
            return;
        }

        // Message d'attente
        await sendMessage(senderId, "🌐 Webia recherche des informations actualisées...");

        // Construire l'URL de l'API
        const baseUrl = "https://haji-mix-api.gleeze.com/api/liner";
        const apiKey = "669397c862ff2e8c9b606584f50ccfa7684efe4eccc435c0bf51a3eba23dc225";
        
        const params = new URLSearchParams({
            ask: prompt,
            mode: 'general',
            deepsearch: 'false',
            stream: 'false',
            api_key: apiKey
        });

        const apiUrl = `${baseUrl}?${params.toString()}`;

        // Effectuer la requête API
        const response = await axios.get(apiUrl);
        const data = response.data;

        if (!data || !data.answer || !data.answer.llm_response) {
            await sendMessage(senderId, "❌ Aucune réponse reçue de l'API Webia.");
            return;
        }

        // Formater la réponse principale
        let formattedResponse = `🌐 WEBIA SEARCH RESULTS\n\n`;
        formattedResponse += `📝 Question: ${data.user_ask}\n\n`;
        formattedResponse += `📊 Réponse:\n${data.answer.llm_response}\n\n`;

        // Ajouter les références si disponibles
        if (data.answer.references && data.answer.references.length > 0) {
            formattedResponse += `📚 Sources:\n`;
            data.answer.references.forEach((ref, index) => {
                formattedResponse += `${index + 1}. ${ref.title}\n`;
                formattedResponse += `   🔗 ${ref.url}\n`;
                if (ref.description) {
                    formattedResponse += `   📄 ${ref.description}\n`;
                }
                if (ref.date) {
                    formattedResponse += `   📅 ${ref.date}\n`;
                }
                formattedResponse += `\n`;
            });
        }

        // Ajouter les questions de suivi si disponibles
        if (data.answer.followUpQuestion && data.answer.followUpQuestion.queries) {
            formattedResponse += `🔍 Questions de suivi suggérées:\n`;
            data.answer.followUpQuestion.queries.forEach((query, index) => {
                formattedResponse += `${index + 1}. ${query}\n`;
            });
            formattedResponse += `\n`;
        }

        formattedResponse += `✨ Propulsé par Webia Search API`;

        // Envoyer la réponse en utilisant le découpage dynamique
        await sendLongMessage(senderId, formattedResponse);

    } catch (error) {
        console.error("❌ Erreur Webia Search:", error?.response?.data || error.message || error);
        
        let errorMessage = "❌ Une erreur s'est produite lors de la recherche.";
        
        if (error.response) {
            if (error.response.status === 401) {
                errorMessage = "❌ Erreur d'authentification API. Vérifiez la clé API.";
            } else if (error.response.status === 429) {
                errorMessage = "❌ Limite de requêtes atteinte. Veuillez réessayer plus tard.";
            } else if (error.response.status >= 500) {
                errorMessage = "❌ Erreur du serveur API. Veuillez réessayer plus tard.";
            }
        }
        
        await sendMessage(senderId, errorMessage);
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "webia",
    description: "Recherche d'informations actualisées en ligne avec références et sources.",
    usage: "webia <votre question ou sujet de recherche>",
    example: "webia actualités Madagascar"
};
