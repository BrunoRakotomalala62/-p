const axios = require('axios');

const reactionPatterns = [
    { patterns: ['bonjour', 'salut', 'hello', 'hi', 'coucou', 'bonsoir', 'hey'], emoji: '👋' },
    { patterns: ['merci', 'thanks', 'misaotra', 'thank you'], emoji: '❤️' },
    { patterns: ['aide', 'help', 'aidez', 'aider'], emoji: '🤝' },
    { patterns: ['bravo', 'bien joué', 'excellent', 'super', 'génial', 'parfait', 'cool', 'nice', 'awesome'], emoji: '👍' },
    { patterns: ['triste', 'sad', 'dommage', 'désolé', 'sorry', 'malheureux'], emoji: '😢' },
    { patterns: ['drôle', 'funny', 'lol', 'mdr', 'haha', 'hihi', 'blague', 'joke'], emoji: '😂' },
    { patterns: ['amour', 'love', 'aimer', 'coeur', 'heart', 'tiako', 'adore'], emoji: '❤️' },
    { patterns: ['colère', 'angry', 'énervé', 'fâché', 'rage'], emoji: '😠' },
    { patterns: ['wow', 'incroyable', 'amazing', 'impressionnant', 'whoa'], emoji: '😮' },
    { patterns: ['question', 'pourquoi', 'comment', 'quoi', 'where', 'what', 'how', 'why', '?'], emoji: '🤔' },
    { patterns: ['musique', 'music', 'chanson', 'song', 'audio'], emoji: '🎵' },
    { patterns: ['video', 'vidéo', 'film', 'movie', 'youtube', 'tiktok'], emoji: '🎬' },
    { patterns: ['photo', 'image', 'picture', 'img'], emoji: '📷' },
    { patterns: ['bonne nuit', 'good night', 'dors bien', 'sleep'], emoji: '🌙' },
    { patterns: ['bonjour', 'good morning', 'matin'], emoji: '☀️' },
    { patterns: ['fête', 'party', 'anniversaire', 'birthday', 'celebration'], emoji: '🎉' },
    { patterns: ['argent', 'money', 'prix', 'payer', 'payment', 'vola'], emoji: '💰' },
    { patterns: ['stop', 'arrêt', 'fin', 'terminé'], emoji: '✋' },
    { patterns: ['ok', 'okay', 'd\'accord', 'oui', 'yes', 'eny'], emoji: '✅' },
    { patterns: ['non', 'no', 'nope', 'tsia'], emoji: '❌' },
    { patterns: ['attends', 'wait', 'patience', 'moment'], emoji: '⏳' },
    { patterns: ['gemini', 'ai', 'intelligence', 'bot', 'robot'], emoji: '🤖' },
    { patterns: ['code', 'programmation', 'coding', 'dev', 'developer'], emoji: '💻' },
    { patterns: ['jeu', 'game', 'jouer', 'play'], emoji: '🎮' },
    { patterns: ['livre', 'book', 'lire', 'read', 'education'], emoji: '📚' },
    { patterns: ['météo', 'weather', 'pluie', 'rain', 'soleil', 'sun'], emoji: '🌤️' },
    { patterns: ['nourriture', 'food', 'manger', 'eat', 'restaurant', 'cuisine'], emoji: '🍽️' },
    { patterns: ['sport', 'foot', 'football', 'basketball', 'exercise'], emoji: '⚽' },
    { patterns: ['voiture', 'car', 'auto', 'véhicule', 'vehicle'], emoji: '🚗' },
    { patterns: ['avion', 'plane', 'voyage', 'travel', 'vacances', 'vacation'], emoji: '✈️' }
];

const defaultEmojis = ['👍', '👋', '😊', '🙂', '✨'];

function getReactionForMessage(messageText) {
    if (!messageText || typeof messageText !== 'string') {
        return defaultEmojis[Math.floor(Math.random() * defaultEmojis.length)];
    }

    const lowerText = messageText.toLowerCase();

    for (const { patterns, emoji } of reactionPatterns) {
        for (const pattern of patterns) {
            if (lowerText.includes(pattern)) {
                return emoji;
            }
        }
    }

    return defaultEmojis[Math.floor(Math.random() * defaultEmojis.length)];
}

async function sendReaction(messageId, emoji) {
    try {
        const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
        
        if (!PAGE_ACCESS_TOKEN) {
            console.log('PAGE_ACCESS_TOKEN non défini, réaction ignorée');
            return { success: false, error: 'No access token' };
        }

        const response = await axios.post(
            `https://graph.facebook.com/v16.0/${messageId}/reactions`,
            {
                reaction: emoji
            },
            {
                params: { access_token: PAGE_ACCESS_TOKEN }
            }
        );

        console.log(`Réaction ${emoji} ajoutée au message ${messageId}`);
        return { success: true, data: response.data };
    } catch (error) {
        const errorData = error.response ? error.response.data : error.message;
        console.log('Réaction non supportée ou erreur:', errorData);
        return { success: false, error: errorData };
    }
}

async function autoReact(messageId, messageText) {
    const emoji = getReactionForMessage(messageText);
    return await sendReaction(messageId, emoji);
}

module.exports = {
    getReactionForMessage,
    sendReaction,
    autoReact
};
