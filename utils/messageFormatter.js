const sendMessage = require('../handles/sendMessage');

const MAX_MESSAGE_LENGTH = 1900;

async function sendLongMessage(senderId, text, delay = 1000) {
    if (text.length <= MAX_MESSAGE_LENGTH) {
        await sendMessage(senderId, text);
        return;
    }

    const chunks = smartSplit(text, MAX_MESSAGE_LENGTH);
    
    for (let i = 0; i < chunks.length; i++) {
        await sendMessage(senderId, chunks[i]);
        
        if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

function smartSplit(text, maxLength) {
    if (text.length <= maxLength) {
        return [text];
    }

    const chunks = [];
    const lines = text.split('\n');
    let currentChunk = '';

    for (const line of lines) {
        if ((currentChunk + '\n' + line).length > maxLength) {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = line;
            } else {
                const words = line.split(' ');
                let tempLine = '';
                
                for (const word of words) {
                    if ((tempLine + ' ' + word).length > maxLength) {
                        if (tempLine) {
                            chunks.push(tempLine.trim());
                            tempLine = word;
                        } else {
                            chunks.push(word.substring(0, maxLength));
                            tempLine = word.substring(maxLength);
                        }
                    } else {
                        tempLine += (tempLine ? ' ' : '') + word;
                    }
                }
                
                if (tempLine) {
                    currentChunk = tempLine;
                }
            }
        } else {
            currentChunk += (currentChunk ? '\n' : '') + line;
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

function addContextualEmojis(text, context = 'tononkalo') {
    const emojiMap = {
        'tononkalo': {
            'header': '🎭✨',
            'author': '✍️',
            'audio': '🎵🎧',
            'text': '📜',
            'search': '🔍💫',
            'result': '📖',
            'navigation': '📄➡️',
            'number': '🔢',
            'love': '💕💖',
            'sad': '😢💔',
            'happy': '😊🌟',
            'nature': '🌺🌸',
            'life': '🌱✨'
        },
        'poesie': {
            'header': '📚✨',
            'author': '🖋️',
            'audio': '🎵🎶',
            'text': '📝',
            'search': '🔍📖',
            'result': '📃',
            'navigation': '📄👉',
            'number': '🔢',
            'love': '❤️💕',
            'sad': '💙😔',
            'happy': '😄🌈',
            'nature': '🌻🌿',
            'life': '🌟💫'
        }
    };

    const emojis = emojiMap[context] || emojiMap['tononkalo'];
    
    const keywords = {
        'fitiavana': emojis.love,
        'love': emojis.love,
        'alahelo': emojis.sad,
        'sad': emojis.sad,
        'triste': emojis.sad,
        'hafaliana': emojis.happy,
        'happy': emojis.happy,
        'joy': emojis.happy,
        'voninkazo': emojis.nature,
        'nature': emojis.nature,
        'fiainana': emojis.life,
        'vie': emojis.life,
        'life': emojis.life
    };

    let decoratedText = text;
    const lowerText = text.toLowerCase();
    
    for (const [keyword, emoji] of Object.entries(keywords)) {
        if (lowerText.includes(keyword)) {
            return emoji + ' ' + decoratedText;
        }
    }
    
    return decoratedText;
}

function formatTononkaloHeader(keyword, page = 1, context = 'tononkalo') {
    const emojis = context === 'tononkalo' ? '🎭✨' : '📚✨';
    const decoratedKeyword = addContextualEmojis(keyword, context);
    
    return `${emojis} Résultats pour "${decoratedKeyword}"\n` +
           `━━━━━━━━━━━━━━━━━━━━\n` +
           `📄 Page ${page}\n\n`;
}

function formatTononkaloDetails(auteur, mp3, tonony, context = 'tononkalo') {
    const authorEmoji = context === 'tononkalo' ? '✍️' : '🖋️';
    const audioEmoji = context === 'tononkalo' ? '🎵🎧' : '🎵🎶';
    const textEmoji = context === 'tononkalo' ? '📜' : '📝';
    
    let formatted = `━━━━━━━━━━━━━━━━━━━━\n`;
    formatted += `${authorEmoji} Mpanoratra: ${auteur}\n`;
    
    if (mp3) {
        formatted += `${audioEmoji} Audio: ${mp3}\n`;
    }
    
    formatted += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    formatted += `${textEmoji} TONONKALO:\n\n`;
    formatted += addStanzaBreaks(tonony);
    formatted += `\n\n✨━━━━━━━━━━━━━━━━━━✨`;
    
    return formatted;
}

function addStanzaBreaks(text) {
    return text
        .split('\n\n')
        .map(stanza => stanza.trim())
        .filter(stanza => stanza.length > 0)
        .join('\n\n🌟\n\n');
}

function formatInstruction() {
    return `\n💡 Tapez un numéro (1-20) pour lire le tononkalo\n` +
           `📄 Tapez "page 2" pour la page suivante\n` +
           `🛑 Tapez "stop" pour arrêter`;
}

module.exports = {
    sendLongMessage,
    smartSplit,
    addContextualEmojis,
    formatTononkaloHeader,
    formatTononkaloDetails,
    formatInstruction,
    addStanzaBreaks
};
