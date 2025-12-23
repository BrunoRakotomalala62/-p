const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const API_URL = 'https://rapido.zetsu.xyz/api/github/repo';
const API_KEY = 'rapi_4806a41790cd4a83921d56b667ab3f16';

const userSessions = new Map();

const SEARCH_MESSAGES = [
    "🔍 Voici les dépôts que j'ai trouvés pour toi",
    "⭐ Découvre ces repos GitHub incroyables",
    "📚 J'ai dénichné ces merveilles pour toi",
    "🚀 Voilà mes meilleures trouvailles",
    "💎 Regarde ces pépites GitHub"
];

const DETAIL_MESSAGES = [
    "📌 Voici les détails du repo",
    "🔗 Tu veux la démo ? La voilà",
    "✨ Accès direct au repo",
    "🎯 C'est par là"
];

const EMOJI_DECORATIONS = [
    "✨", "🌟", "⭐", "💫", "🔥", "🎯", "🚀", "💎", "🏆", "👑"
];

function getRandomMessage(messages) {
    return messages[Math.floor(Math.random() * messages.length)];
}

function getRandomEmoji() {
    return EMOJI_DECORATIONS[Math.floor(Math.random() * EMOJI_DECORATIONS.length)];
}

async function searchGithub(query) {
    try {
        const response = await axios.get(API_URL, {
            params: {
                query: query,
                apikey: API_KEY
            },
            timeout: 15000
        });
        return response.data.results || [];
    } catch (error) {
        console.error('Erreur API GitHub:', error.message);
        throw new Error('Impossible de récupérer les résultats GitHub');
    }
}

function formatSearchResults(results) {
    if (results.length === 0) {
        return "❌ Aucun résultat trouvé pour cette recherche";
    }

    let message = `${getRandomMessage(SEARCH_MESSAGES)}\n\n`;
    
    results.forEach((repo, index) => {
        const emoji = getRandomEmoji();
        const number = index + 1;
        message += `${emoji} *${number}. ${repo.name}*\n`;
        message += `📝 ${repo.description}\n`;
        message += `⭐ Stars: ${repo.stars.toLocaleString()} | 🔀 Forks: ${repo.forks.toLocaleString()}\n\n`;
    });

    message += `\n💡 *Réponds avec le numéro* (1, 2, 3...) pour voir le lien GitHub complet !`;
    
    return message;
}

function formatRepoDetails(repo, number) {
    const emoji = getRandomEmoji();
    let message = `${getRandomMessage(DETAIL_MESSAGES)}\n\n`;
    message += `${emoji} *${repo.name}*\n`;
    message += `📝 *Description:*\n${repo.description}\n\n`;
    message += `⭐ *Stars:* ${repo.stars.toLocaleString()}\n`;
    message += `🔀 *Forks:* ${repo.forks.toLocaleString()}\n\n`;
    message += `🔗 *Lien GitHub:*\n${repo.url}\n\n`;
    message += `💬 Tapez une nouvelle recherche ou un autre numéro pour continuer !`;
    
    return message;
}

module.exports = {
    name: 'github',
    author: 'Developer',
    description: 'Recherche des dépôts GitHub',
    usage: 'github <query>',
    category: 'VIP',

    async execute(message, args, api, event) {
        try {
            const senderId = event.senderID;
            const input = args.join(' ').trim();

            if (!input) {
                return sendMessage(
                    senderId,
                    '❌ Utilise la commande ainsi:\n*!github <terme de recherche>*\n\nExemple: *!github api rest*',
                    api,
                    event
                );
            }

            // Vérifier si c'est une sélection de numéro
            const numberInput = parseInt(input);
            if (!isNaN(numberInput) && userSessions.has(senderId)) {
                const session = userSessions.get(senderId);
                const selectedIndex = numberInput - 1;

                if (selectedIndex >= 0 && selectedIndex < session.results.length) {
                    const selectedRepo = session.results[selectedIndex];
                    const detailMessage = formatRepoDetails(selectedRepo, numberInput);
                    
                    return sendMessage(senderId, detailMessage, api, event);
                } else {
                    return sendMessage(
                        senderId,
                        `❌ Numéro invalide ! Choisissez entre 1 et ${session.results.length}`,
                        api,
                        event
                    );
                }
            }

            // Nouvelle recherche
            const typingIndicator = sendMessage(senderId, '🔄 Recherche en cours...', api, event);
            
            const results = await searchGithub(input);
            
            // Sauvegarder les résultats dans la session
            userSessions.set(senderId, {
                results: results,
                query: input,
                timestamp: Date.now()
            });

            const formattedMessage = formatSearchResults(results);
            return sendMessage(senderId, formattedMessage, api, event);

        } catch (error) {
            console.error('Erreur commande github:', error);
            return sendMessage(
                event.senderID,
                `❌ Erreur : ${error.message}`,
                api,
                event
            );
        }
    }
};

// Nettoyer les vieilles sessions (plus de 1 heure)
setInterval(() => {
    const now = Date.now();
    for (const [userId, session] of userSessions.entries()) {
        if (now - session.timestamp > 3600000) {
            userSessions.delete(userId);
        }
    }
}, 600000); // Vérifier toutes les 10 minutes
