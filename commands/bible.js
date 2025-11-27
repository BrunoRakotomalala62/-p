const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const API_BASE_URL = 'https://bible-vaovao.vercel.app';
const MAX_MESSAGE_LENGTH = 1800;

function splitTextIntoChunks(text, maxLength = MAX_MESSAGE_LENGTH) {
    const chunks = [];
    const lines = text.split('\n');
    let currentChunk = '';

    for (const line of lines) {
        if ((currentChunk + '\n' + line).length > maxLength) {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
            }
            if (line.length > maxLength) {
                const words = line.split(' ');
                let wordChunk = '';
                for (const word of words) {
                    if ((wordChunk + ' ' + word).length > maxLength) {
                        if (wordChunk) chunks.push(wordChunk.trim());
                        wordChunk = word;
                    } else {
                        wordChunk = wordChunk ? wordChunk + ' ' + word : word;
                    }
                }
                currentChunk = wordChunk;
            } else {
                currentChunk = line;
            }
        } else {
            currentChunk = currentChunk ? currentChunk + '\n' + line : line;
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [text];
}

async function sendChunkedMessages(senderId, message, delayMs = 800) {
    const chunks = splitTextIntoChunks(message);
    
    for (let i = 0; i < chunks.length; i++) {
        const chunkMessage = chunks.length > 1 
            ? `${chunks[i]}\n\n📄 (${i + 1}/${chunks.length})`
            : chunks[i];
        
        await sendMessage(senderId, chunkMessage);
        
        if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}

function formatBibleList(data) {
    let message = "📖 ═══════════════════════\n";
    message += "      𝗟𝗜𝗦𝗧𝗘 𝗗𝗘𝗦 𝗟𝗜𝗩𝗥𝗘𝗦\n";
    message += "         𝗗𝗘 𝗟𝗔 𝗕𝗜𝗕𝗟𝗘\n";
    message += "═══════════════════════\n\n";

    for (const testament in data) {
        const icon = testament.includes("Ancien") ? "📜" : "✝️";
        message += `${icon} 𝗧𝗘𝗦𝗧𝗔𝗠𝗘𝗡𝗧: ${testament.toUpperCase()}\n`;
        message += "─────────────────────\n";

        for (const category in data[testament]) {
            message += `\n📚 ${category}:\n`;
            const books = data[testament][category];
            books.forEach((book, index) => {
                const bookName = typeof book === 'string' ? book : book.nom;
                message += `   ${index + 1}. ${bookName}\n`;
            });
        }
        message += "\n";
    }

    message += "═══════════════════════\n";
    message += "💡 𝗨𝘁𝗶𝗹𝗶𝘀𝗮𝘁𝗶𝗼𝗻:\n";
    message += "• bible [livre] [chapitre]\n";
    message += "• bible [livre] [chap] [verset]\n";
    message += "• bible [livre] [chap] [v1:v2]\n";
    message += "═══════════════════════";

    return message;
}

function formatVerses(data, showBoth = true) {
    let message = "📖 ═══════════════════════\n";
    message += `      ${data.livre.toUpperCase()}\n`;
    message += `      𝗖𝗵𝗮𝗽𝗶𝘁𝗿𝗲 ${data.chapitre}\n`;
    message += "═══════════════════════\n\n";

    message += `📍 ${data.testament}\n`;
    message += `📂 ${data.categorie}\n`;
    
    if (data.verset_debut && data.verset_fin) {
        if (data.verset_debut === data.verset_fin) {
            message += `📝 Verset ${data.verset_debut}\n`;
        } else {
            message += `📝 Versets ${data.verset_debut} - ${data.verset_fin}\n`;
        }
    }
    message += `📊 Total: ${data.total_versets} verset(s)\n`;
    message += "─────────────────────\n\n";

    if (showBoth && data.versets_francais && data.versets_malagasy) {
        message += "🇫🇷 𝗩𝗘𝗥𝗦𝗜𝗢𝗡 𝗙𝗥𝗔𝗡𝗖̧𝗔𝗜𝗦𝗘:\n";
        message += "─────────────────────\n";
        data.versets_francais.forEach(v => {
            message += `\n${v.chapitre}:${v.verset} │ ${v.texte}\n`;
        });

        message += "\n─────────────────────\n";
        message += "🇲🇬 𝗩𝗘𝗥𝗦𝗜𝗢𝗡 𝗠𝗔𝗟𝗔𝗚𝗔𝗦𝗬:\n";
        message += "─────────────────────\n";
        data.versets_malagasy.forEach(v => {
            message += `\n${v.chapitre}:${v.verset} │ ${v.texte}\n`;
        });
    } else if (data.versets_francais) {
        data.versets_francais.forEach(v => {
            message += `${v.chapitre}:${v.verset} │ ${v.texte}\n\n`;
        });
    }

    message += "\n═══════════════════════\n";
    message += "📖 𝗕𝗶𝗯𝗹𝗲 𝗩𝗮𝗼𝘃𝗮𝗼 𝗔𝗣𝗜\n";
    message += "═══════════════════════";

    return message;
}

function formatSingleVerse(data) {
    const fr = data.versets_francais[0];
    const mg = data.versets_malagasy ? data.versets_malagasy[0] : null;

    let message = "✨ ═══════════════════════\n";
    message += `   📖 ${data.livre} ${fr.chapitre}:${fr.verset}\n`;
    message += "═══════════════════════\n\n";

    message += "🇫🇷 𝗙𝗿𝗮𝗻𝗰̧𝗮𝗶𝘀:\n";
    message += `« ${fr.texte} »\n\n`;

    if (mg) {
        message += "🇲🇬 𝗠𝗮𝗹𝗮𝗴𝗮𝘀𝘆:\n";
        message += `« ${mg.texte} »\n\n`;
    }

    message += "─────────────────────\n";
    message += `📍 ${data.testament}\n`;
    message += `📂 ${data.categorie}\n`;
    message += "═══════════════════════";

    return message;
}

function formatHelp() {
    let message = "📖 ═══════════════════════\n";
    message += "    𝗔𝗜𝗗𝗘 - 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗘 𝗕𝗜𝗕𝗟𝗘\n";
    message += "═══════════════════════\n\n";

    message += "📚 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝗲𝘀 𝗱𝗶𝘀𝗽𝗼𝗻𝗶𝗯𝗹𝗲𝘀:\n";
    message += "─────────────────────\n\n";

    message += "📋 𝗟𝗶𝘀𝘁𝗲 𝗱𝗲𝘀 𝗹𝗶𝘃𝗿𝗲𝘀:\n";
    message += "   bible liste\n\n";

    message += "📖 𝗟𝗶𝗿𝗲 𝘂𝗻 𝗰𝗵𝗮𝗽𝗶𝘁𝗿𝗲:\n";
    message += "   bible [livre] [chapitre]\n";
    message += "   Ex: bible Jean 3\n";
    message += "   Ex: bible Genèse 1\n\n";

    message += "📝 𝗟𝗶𝗿𝗲 𝘂𝗻 𝘃𝗲𝗿𝘀𝗲𝘁:\n";
    message += "   bible [livre] [chap] [verset]\n";
    message += "   Ex: bible Jean 3 16\n\n";

    message += "📑 𝗟𝗶𝗿𝗲 𝗽𝗹𝘂𝘀𝗶𝗲𝘂𝗿𝘀 𝘃𝗲𝗿𝘀𝗲𝘁𝘀:\n";
    message += "   bible [livre] [chap] [v1:v2]\n";
    message += "   Ex: bible Psaumes 23 1:6\n";
    message += "   Ex: bible Matthieu 5 3:12\n\n";

    message += "🔀 𝗩𝗲𝗿𝘀𝗲𝘁 𝗮𝗹𝗲́𝗮𝘁𝗼𝗶𝗿𝗲:\n";
    message += "   bible random\n\n";

    message += "═══════════════════════\n";
    message += "💡 Les réponses incluent:\n";
    message += "   • Version Française 🇫🇷\n";
    message += "   • Version Malagasy 🇲🇬\n";
    message += "═══════════════════════";

    return message;
}

function formatError(error) {
    let message = "❌ ═══════════════════════\n";
    message += "         𝗘𝗥𝗥𝗘𝗨𝗥\n";
    message += "═══════════════════════\n\n";
    
    message += `⚠️ ${error.erreur || 'Une erreur est survenue'}\n\n`;
    message += `📝 ${error.message || 'Veuillez vérifier votre requête.'}\n`;
    
    if (error.versets_disponibles) {
        message += `\n📊 Versets disponibles: ${error.versets_disponibles.join(', ')}\n`;
    }

    message += "\n═══════════════════════\n";
    message += "💡 Tapez 'bible help' pour l'aide\n";
    message += "═══════════════════════";

    return message;
}

async function getRandomVerse() {
    const books = [
        { nom: "Jean", chapitres: 21 },
        { nom: "Psaumes", chapitres: 150 },
        { nom: "Proverbes", chapitres: 31 },
        { nom: "Matthieu", chapitres: 28 },
        { nom: "Romains", chapitres: 16 },
        { nom: "Genèse", chapitres: 50 },
        { nom: "Esaïe", chapitres: 66 }
    ];

    const randomBook = books[Math.floor(Math.random() * books.length)];
    const randomChapter = Math.floor(Math.random() * randomBook.chapitres) + 1;
    const randomVerse = Math.floor(Math.random() * 20) + 1;

    return {
        livre: randomBook.nom,
        chapitre: randomChapter,
        verset: randomVerse
    };
}

module.exports = async (senderId, userText) => {
    try {
        const args = userText ? userText.trim().toLowerCase().split(/\s+/) : [];
        
        if (args.length === 0 || args[0] === 'help' || args[0] === 'aide') {
            await sendChunkedMessages(senderId, formatHelp());
            return;
        }

        await sendMessage(senderId, "📖 Recherche en cours...");

        if (args[0] === 'liste' || args[0] === 'list') {
            const response = await axios.get(`${API_BASE_URL}/recherche?bible=liste`, {
                timeout: 30000
            });
            await sendChunkedMessages(senderId, formatBibleList(response.data));
            return;
        }

        if (args[0] === 'random' || args[0] === 'aleatoire') {
            const random = await getRandomVerse();
            const url = `${API_BASE_URL}/recherche?texte=${encodeURIComponent(random.livre)}&chapitre=${random.chapitre}&verset=${random.verset}`;
            
            try {
                const response = await axios.get(url, { timeout: 30000 });
                
                if (response.data && response.data.versets_francais && response.data.versets_francais.length > 0) {
                    await sendChunkedMessages(senderId, formatSingleVerse(response.data));
                } else {
                    const fallbackUrl = `${API_BASE_URL}/recherche?titre=${encodeURIComponent(random.livre)}&page=${random.chapitre}`;
                    const fallbackResponse = await axios.get(fallbackUrl, { timeout: 30000 });
                    
                    if (fallbackResponse.data && fallbackResponse.data.versets_francais) {
                        const verses = fallbackResponse.data.versets_francais;
                        const randomIndex = Math.floor(Math.random() * verses.length);
                        
                        fallbackResponse.data.versets_francais = [verses[randomIndex]];
                        if (fallbackResponse.data.versets_malagasy) {
                            fallbackResponse.data.versets_malagasy = [fallbackResponse.data.versets_malagasy[randomIndex]];
                        }
                        fallbackResponse.data.total_versets = 1;
                        
                        await sendChunkedMessages(senderId, formatSingleVerse(fallbackResponse.data));
                    }
                }
            } catch (err) {
                const newRandom = await getRandomVerse();
                const retryUrl = `${API_BASE_URL}/recherche?titre=${encodeURIComponent(newRandom.livre)}&page=1`;
                const retryResponse = await axios.get(retryUrl, { timeout: 30000 });
                
                if (retryResponse.data && retryResponse.data.versets_francais) {
                    const verses = retryResponse.data.versets_francais;
                    const randomIndex = Math.floor(Math.random() * Math.min(verses.length, 10));
                    
                    retryResponse.data.versets_francais = [verses[randomIndex]];
                    if (retryResponse.data.versets_malagasy) {
                        retryResponse.data.versets_malagasy = [retryResponse.data.versets_malagasy[randomIndex]];
                    }
                    retryResponse.data.total_versets = 1;
                    
                    await sendChunkedMessages(senderId, formatSingleVerse(retryResponse.data));
                }
            }
            return;
        }

        let livre = '';
        let chapitre = null;
        let versetStart = null;
        let versetEnd = null;

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            
            if (/^\d+$/.test(arg)) {
                if (chapitre === null) {
                    chapitre = parseInt(arg);
                } else if (versetStart === null) {
                    versetStart = parseInt(arg);
                    versetEnd = versetStart;
                }
            } else if (/^\d+[:\-]\d+$/.test(arg)) {
                const parts = arg.split(/[:\-]/);
                versetStart = parseInt(parts[0]);
                versetEnd = parseInt(parts[1]);
            } else if (/^\d+$/.test(arg) === false) {
                livre = livre ? livre + ' ' + arg : arg;
            }
        }

        if (!livre) {
            await sendChunkedMessages(senderId, formatHelp());
            return;
        }

        let url;
        
        if (versetStart !== null) {
            if (versetStart === versetEnd) {
                url = `${API_BASE_URL}/recherche?texte=${encodeURIComponent(livre)}&chapitre=${chapitre || 1}&verset=${versetStart}`;
            } else {
                url = `${API_BASE_URL}/recherche?texte=${encodeURIComponent(livre)}&chapitre=${chapitre || 1}&verset=${versetStart}:${versetEnd}`;
            }
        } else if (chapitre !== null) {
            url = `${API_BASE_URL}/recherche?titre=${encodeURIComponent(livre)}&page=${chapitre}`;
        } else {
            url = `${API_BASE_URL}/recherche?titre=${encodeURIComponent(livre)}&page=1`;
        }

        const response = await axios.get(url, { timeout: 30000 });

        if (response.data.erreur) {
            await sendChunkedMessages(senderId, formatError(response.data));
            return;
        }

        if (response.data.total_versets === 1) {
            await sendChunkedMessages(senderId, formatSingleVerse(response.data));
        } else {
            await sendChunkedMessages(senderId, formatVerses(response.data));
        }

    } catch (error) {
        console.error('Erreur commande Bible:', error.message);

        if (error.response && error.response.data) {
            await sendChunkedMessages(senderId, formatError(error.response.data));
        } else {
            const errorMessage = formatError({
                erreur: "Erreur de connexion",
                message: "Impossible de joindre le serveur Bible. Veuillez réessayer dans quelques instants."
            });
            await sendChunkedMessages(senderId, errorMessage);
        }
    }
};

module.exports.info = {
    name: "bible",
    description: "Consulter la Bible avec traduction Français/Malagasy. Affiche les versets, chapitres et livres de la Bible.",
    usage: `📖 𝗨𝘁𝗶𝗹𝗶𝘀𝗮𝘁𝗶𝗼𝗻 𝗕𝗶𝗯𝗹𝗲:

• bible help - Afficher l'aide
• bible liste - Liste des livres
• bible random - Verset aléatoire
• bible [livre] [chapitre] - Lire un chapitre
• bible [livre] [chap] [verset] - Lire un verset
• bible [livre] [chap] [v1:v2] - Lire plusieurs versets

𝗘𝘅𝗲𝗺𝗽𝗹𝗲𝘀:
• bible Jean 3 16
• bible Psaumes 23 1:6
• bible Genèse 1`
};
