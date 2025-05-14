
const axios = require('axios');
const sendMessage = require('../handles/sendMessage'); // Importer la fonction sendMessage
const wiki = require('wikijs').default;

// Stocker les dernières recherches par utilisateur
const userLastSearches = {};

module.exports = async (senderId, prompt, api) => {
    try {
        // Si le prompt est vide (commande 'wikipedia' sans texte)
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, "🔍 *RECHERCHE WIKIPEDIA* 🔍\n\nVeuillez entrer un terme à rechercher.\n\nExemple: wikipedia Madagascar\nOu pour l'anglais: wikipedia en Einstein");
            return;
        }

        // Envoyer un message d'attente stylisé
        await sendMessage(senderId, "🔍 Recherche en cours sur Wikipedia... ⏳");

        // Déterminer la langue et le contenu de la recherche
        let content = prompt.trim();
        let url = 'https://fr.wikipedia.org/w/api.php'; // Par défaut en français
        
        // Vérifier si la recherche est en anglais
        const args = content.split(' ');
        if (args[0].toLowerCase() === 'en') {
            url = 'https://en.wikipedia.org/w/api.php';
            content = args.slice(1).join(' ');
        }

        if (!content) {
            await sendMessage(senderId, "Veuillez entrer un terme à rechercher.");
            return;
        }

        // Stocker la dernière recherche de l'utilisateur
        userLastSearches[senderId] = content;

        // Effectuer la recherche sur Wikipedia
        const page = await wiki({ apiUrl: url }).page(content).catch(async () => {
            await sendMessage(senderId, `❌ Impossible de trouver des informations sur "${content}" sur Wikipedia.`);
            return null;
        });

        if (page) {
            // Obtenir le résumé de la page
            const summary = await page.summary();
            
            // Obtenir l'URL de la page pour le lien
            const pageUrl = await page.url();
            
            // Créer une réponse formatée et stylisée
            const formattedReply = `
✅EDUCATION AMPINGA D'OR🇲🇬
━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 *WIKIPEDIA* - ${content.toUpperCase()} 📚

${summary}

🔗 *Source* : ${pageUrl}
━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 Powered by 👉@Bruno | ❤️AMPING D'OR❤️
`;

            // Diviser le message en plusieurs parties si nécessaire
            const MAX_LENGTH = 2000;
            if (formattedReply.length <= MAX_LENGTH) {
                await sendMessage(senderId, formattedReply);
            } else {
                // Diviser intelligemment le message
                let startIndex = 0;
                while (startIndex < formattedReply.length) {
                    let endIndex = Math.min(startIndex + MAX_LENGTH, formattedReply.length);
                    
                    // Chercher le dernier séparateur pour une coupure propre
                    if (endIndex < formattedReply.length) {
                        const lastPeriod = formattedReply.lastIndexOf('. ', endIndex);
                        const lastNewline = formattedReply.lastIndexOf('\n', endIndex);
                        const lastSpace = formattedReply.lastIndexOf(' ', endIndex);
                        
                        // Utiliser le meilleur séparateur trouvé
                        const bestBreak = Math.max(lastPeriod, lastNewline, lastSpace);
                        if (bestBreak > startIndex) {
                            endIndex = bestBreak + 1;
                        }
                    }
                    
                    await sendMessage(senderId, formattedReply.substring(startIndex, endIndex));
                    startIndex = endIndex;
                    
                    // Ajouter une petite pause entre les messages
                    if (startIndex < formattedReply.length) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }
        }
    } catch (error) {
        console.error("Erreur lors de la recherche Wikipedia:", error);
        
        // Message d'erreur stylisé
        await sendMessage(senderId, `
⚠️ *ERREUR* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors de la recherche sur Wikipedia.
Veuillez réessayer avec des termes différents ou plus tard.
━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    }
    
    return { skipCommandCheck: true };
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "wikipedia",
    description: "Recherche des informations sur Wikipedia en français ou en anglais.",
    usage: "Envoyez 'wikipedia <terme>' pour rechercher en français ou 'wikipedia en <terme>' pour rechercher en anglais."
};
