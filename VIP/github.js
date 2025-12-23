const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const API_URL = 'https://rapido.zetsu.xyz/api/github/repo';
const API_KEY = 'rapi_4806a41790cd4a83921d56b667ab3f16';

const userSessions = new Map();

const ITEMS_PER_PAGE = 5;

const SEARCH_MESSAGES = [
    "🔍 Voici les dépôts que j'ai trouvés pour toi",
    "⭐ Découvre ces repos GitHub incroyables",
    "📚 J'ai dénichés ces merveilles pour toi",
    "🚀 Voilà mes meilleures trouvailles",
    "💎 Regarde ces pépites GitHub",
    "🎯 J'ai trouvé exactement ce qu'il te faut"
];

const DETAIL_MESSAGES = [
    "📌 Voici les détails complets du repo",
    "🔗 Tu veux la démo ? La voilà",
    "✨ Accès direct au repo",
    "🎯 C'est par là",
    "🌟 Tous les détails du projet"
];

const EMOJI_DECORATIONS = [
    "✨", "🌟", "⭐", "💫", "🔥", "🎯", "🚀", "💎", "🏆", "👑", "🎨", "⚡", "🔮", "🌈"
];

const LINE_DIVIDER = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

function getRandomMessage(messages) {
    return messages[Math.floor(Math.random() * messages.length)];
}

function getRandomEmoji() {
    return EMOJI_DECORATIONS[Math.floor(Math.random() * EMOJI_DECORATIONS.length)];
}

function createHeader(title) {
    const emoji = getRandomEmoji();
    return `\n${emoji}${emoji}${emoji} *${title.toUpperCase()}* ${emoji}${emoji}${emoji}\n${LINE_DIVIDER}`;
}

function createFooter(text) {
    return `${LINE_DIVIDER}\n${text}`;
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

function getPaginatedResults(results, page) {
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return results.slice(startIndex, endIndex);
}

function getTotalPages(totalResults) {
    return Math.ceil(totalResults / ITEMS_PER_PAGE);
}

function formatSearchResults(results, page = 1) {
    if (results.length === 0) {
        return `❌ *Aucun résultat trouvé*\nEssaie avec une autre recherche!`;
    }

    const totalPages = getTotalPages(results.length);
    const paginatedResults = getPaginatedResults(results, page);

    let message = createHeader(`Résultats - Page ${page}/${totalPages}`);
    message += `\n${getRandomMessage(SEARCH_MESSAGES)}\n\n`;
    
    paginatedResults.forEach((repo, index) => {
        const globalIndex = (page - 1) * ITEMS_PER_PAGE + index + 1;
        const emoji = getRandomEmoji();
        
        message += `${emoji} *${globalIndex}. ${repo.name}*\n`;
        message += `   📝 ${repo.description}\n`;
        message += `   ⭐ ${formatNumber(repo.stars)} stars | 🔀 ${formatNumber(repo.forks)} forks\n`;
        message += `   📊 Ratio: ${(repo.stars / Math.max(repo.forks, 1)).toFixed(2)}⭐/fork\n\n`;
    });

    let footer = `💡 *Commandes disponibles:*\n`;
    footer += `  • *github <numéro>* → Voir détails\n`;
    footer += `  • *github next* → Page suivante\n`;
    footer += `  • *github prev* → Page précédente\n`;
    footer += `  • *github top* → Trier par stars\n`;
    footer += `  • *github new* → Nouvelle recherche\n`;
    
    if (totalPages > 1) {
        footer += `\n📍 Page ${page}/${totalPages}`;
    }

    message += createFooter(footer);
    
    return message;
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function formatRepoDetails(repo, index) {
    let message = createHeader(`Détails du Repo #${index}`);
    
    message += `\n${getRandomMessage(DETAIL_MESSAGES)}\n\n`;
    
    message += `*📦 ${repo.name}*\n`;
    message += `${LINE_DIVIDER}\n\n`;
    
    message += `📝 *Description:*\n${repo.description}\n\n`;
    
    message += `📊 *Statistiques:*\n`;
    message += `  ⭐ Stars: ${formatNumber(repo.stars)} (${repo.stars.toLocaleString()})\n`;
    message += `  🔀 Forks: ${formatNumber(repo.forks)} (${repo.forks.toLocaleString()})\n`;
    message += `  📈 Popularité: ${getPopularityLevel(repo.stars)}\n`;
    message += `  💪 Santé du projet: ${getHealthStatus(repo)}\n\n`;
    
    message += `🔗 *Accès Direct:*\n`;
    message += `${repo.url}\n\n`;
    
    message += `${LINE_DIVIDER}\n`;
    message += `💬 Tapez un autre numéro ou *github* pour continuer!`;
    
    return message;
}

function getPopularityLevel(stars) {
    if (stars >= 30000) return '⭐⭐⭐⭐⭐ Très populaire';
    if (stars >= 10000) return '⭐⭐⭐⭐ Populaire';
    if (stars >= 5000) return '⭐⭐⭐ Bien connu';
    if (stars >= 1000) return '⭐⭐ Reconnu';
    return '⭐ Émergent';
}

function getHealthStatus(repo) {
    const forksRatio = repo.forks / Math.max(repo.stars, 1);
    if (forksRatio > 0.3) return '🟢 Excellent';
    if (forksRatio > 0.1) return '🟡 Bon';
    return '🔵 Stable';
}

function sortByStars(results) {
    return [...results].sort((a, b) => b.stars - a.stars);
}

module.exports = async (senderId, prompt) => {
    try {
        const input = prompt.trim().toLowerCase();

        if (!input) {
            await sendMessage(senderId, createHeader('Utilisation') + 
                `\n\n*Commandes disponibles:*\n` +
                `  • *github <terme>* → Chercher un repo\n` +
                `  • *github <numéro>* → Voir détails\n` +
                `  • *github next* → Page suivante\n` +
                `  • *github prev* → Page précédente\n` +
                `  • *github top* → Trier par popularité\n\n` +
                `*Exemple:* github api rest`
            );
            return;
        }

        // Gestion des commandes de navigation
        if (input === 'next') {
            if (!userSessions.has(senderId)) {
                await sendMessage(senderId, '❌ Aucune recherche active. Fais une recherche d\'abord!');
                return;
            }
            const session = userSessions.get(senderId);
            const nextPage = Math.min(session.page + 1, getTotalPages(session.results.length));
            
            if (nextPage === session.page) {
                await sendMessage(senderId, '⚠️ Tu es déjà à la dernière page!');
                return;
            }
            
            session.page = nextPage;
            const resultMessage = formatSearchResults(session.results, nextPage);
            await sendMessage(senderId, resultMessage);
            return;
        }

        if (input === 'prev') {
            if (!userSessions.has(senderId)) {
                await sendMessage(senderId, '❌ Aucune recherche active. Fais une recherche d\'abord!');
                return;
            }
            const session = userSessions.get(senderId);
            const prevPage = Math.max(session.page - 1, 1);
            
            if (prevPage === session.page) {
                await sendMessage(senderId, '⚠️ Tu es déjà à la première page!');
                return;
            }
            
            session.page = prevPage;
            const resultMessage = formatSearchResults(session.results, prevPage);
            await sendMessage(senderId, resultMessage);
            return;
        }

        if (input === 'top') {
            if (!userSessions.has(senderId)) {
                await sendMessage(senderId, '❌ Aucune recherche active. Fais une recherche d\'abord!');
                return;
            }
            const session = userSessions.get(senderId);
            session.results = sortByStars(session.results);
            session.page = 1;
            const resultMessage = formatSearchResults(session.results, 1);
            await sendMessage(senderId, resultMessage);
            return;
        }

        // Vérifier si c'est une sélection de numéro
        const numberInput = parseInt(input);
        if (!isNaN(numberInput) && numberInput > 0) {
            if (!userSessions.has(senderId)) {
                await sendMessage(senderId, '❌ Aucune recherche active. Fais une recherche d\'abord!');
                return;
            }
            
            const session = userSessions.get(senderId);
            const selectedIndex = numberInput - 1;

            if (selectedIndex >= 0 && selectedIndex < session.results.length) {
                const selectedRepo = session.results[selectedIndex];
                const detailMessage = formatRepoDetails(selectedRepo, numberInput);
                
                await sendMessage(senderId, detailMessage);
                return;
            } else {
                await sendMessage(senderId, `❌ *Numéro invalide!*\nChoisissez entre 1 et ${session.results.length}`);
                return;
            }
        }

        // Nouvelle recherche
        await sendMessage(senderId, '⏳ Recherche en cours... Patience! 🔍');
        
        const results = await searchGithub(input);
        
        if (results.length === 0) {
            await sendMessage(senderId, createHeader('Résultat') +
                `\n\n❌ *Aucun résultat* pour "${input}"\n\nEssaie un autre terme!`
            );
            return;
        }

        // Sauvegarder les résultats dans la session
        userSessions.set(senderId, {
            results: results,
            query: input,
            page: 1,
            timestamp: Date.now()
        });

        const formattedMessage = formatSearchResults(results, 1);
        await sendMessage(senderId, formattedMessage);

    } catch (error) {
        console.error('Erreur commande github:', error);
        await sendMessage(senderId, `❌ *Erreur lors de la recherche*\n${error.message}`);
    }
};

// Nettoyer les vieilles sessions (plus de 2 heures)
setInterval(() => {
    const now = Date.now();
    for (const [userId, session] of userSessions.entries()) {
        if (now - session.timestamp > 7200000) {
            userSessions.delete(userId);
        }
    }
}, 600000); // Vérifier toutes les 10 minutes
