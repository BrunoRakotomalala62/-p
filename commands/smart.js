
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sendMessage = require('../handles/sendMessage');

// Map pour gérer les cooldowns
const smartCooldowns = new Map();

// Fonction principale de la commande smart
module.exports = async (senderId, userText, api) => {
    try {
        // Système de cooldown
        const userId = senderId;
        const cooldownTime = 5000; // 5 secondes
        const now = Date.now();
        
        if (smartCooldowns.has(userId)) {
            const expirationTime = smartCooldowns.get(userId);
            if (now < expirationTime) {
                const timeLeft = Math.ceil((expirationTime - now) / 1000);
                return await sendMessage(senderId, `⏰ Veuillez attendre ${timeLeft} secondes avant d'utiliser à nouveau les commandes intelligentes.`);
            }
        }
        
        smartCooldowns.set(userId, now + cooldownTime);
        setTimeout(() => smartCooldowns.delete(userId), cooldownTime);

        const message = userText.toLowerCase().trim();

        // Détection et traitement des différents types de requêtes
        if (isContactRequest(message)) {
            return handleContact(senderId);
        }

        if (isRulesQuery(message)) {
            return handleRules(senderId);
        }

        if (isVideoRequest(message)) {
            return handleShoti(senderId);
        }

        if (isUIDRequest(message)) {
            return handleUID(senderId);
        }

        if (isUptimeRequest(message)) {
            return handleUptime(senderId);
        }

        if (isHelpRequest(message)) {
            return handleHelp(senderId);
        }

        if (isCommandListRequest(message)) {
            return handleCommandList(senderId);
        }

        if (isPrefixRequest(message)) {
            return handlePrefix(senderId);
        }

        if (isAIQuery(message)) {
            return handleAIQuery(senderId, userText);
        }

        // Si aucune condition n'est remplie, traiter comme une requête IA générale
        return handleAIQuery(senderId, userText);

    } catch (error) {
        console.error('Erreur dans la commande smart:', error);
        await sendMessage(senderId, "Désolé, une erreur s'est produite lors du traitement de votre demande.");
    }
};

// Fonctions de détection des types de requêtes
function isAIQuery(message) {
    const specificAiKeywords = [
        'explain', 'tell me about', 'what is', 'how does', 'why does',
        'define', 'meaning of', 'calculate', 'solve', 'create', 'write',
        'generate', 'gpt', 'ai', 'chatgpt', 'openai', 'assistant',
        'explique', 'dis-moi', 'qu\'est-ce que', 'comment', 'pourquoi',
        'définis', 'signification', 'calcule', 'résoudre', 'créer', 'écrire'
    ];
    
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'quoi', 'comment', 'pourquoi', 'quand', 'où', 'qui'];
    
    if (specificAiKeywords.some(keyword => message.includes(keyword))) {
        return true;
    }
    
    if (message.endsWith('?') || questionWords.some(word => message.startsWith(word + ' '))) {
        const excludePatterns = [
            'what commands', 'what cmd', 'what are the rules', 'what is your prefix',
            'what\'s my uid', 'what\'s my id', 'how long', 'when did',
            'quelles commandes', 'quelles sont les règles', 'quel est ton préfixe'
        ];
        
        if (!excludePatterns.some(pattern => message.includes(pattern))) {
            return true;
        }
    }
    
    return false;
}

function isContactRequest(message) {
    return message.includes('contact') || message.includes('owner info') || 
           message.includes('contacts') || message.includes('info') || 
           message.includes('developer') || message.includes('creator info') ||
           message.includes('développeur') || message.includes('créateur');
}

function isRulesQuery(message) {
    return message.includes('rules') || message.includes('regulation') ||
           message.includes('rule') || message.includes('give the rules') ||
           message.includes('guideline') || message.includes('what are the rules') ||
           message.includes('règles') || message.includes('règlement');
}

function isVideoRequest(message) {
    const videoKeywords = ['video', 'shoti', 'girl', 'tiktok video', 'send video', 'show video', 'random shoti', 'shoti random', 'vidéo'];
    return videoKeywords.some(keyword => message.includes(keyword));
}

function isUIDRequest(message) {
    return message.includes('uid') || message.includes('user id') || 
           message.includes('my id') || message.includes('get id') ||
           message.includes('mon id') || message.includes('obtenir id');
}

function isUptimeRequest(message) {
    return message.includes('uptime') || message.includes('how long') ||
           message.includes('upt') || message.includes('run time') ||
           message.includes('running time') || message.includes('bot uptime') ||
           message.includes('temps de fonctionnement');
}

function isHelpRequest(message) {
    return message.includes('help') || message.includes('what can you do') ||
           message.includes('what are your features') || message.includes('smart') ||
           message.includes('aide') || message.includes('que peux-tu faire');
}

function isCommandListRequest(message) {
    return message.includes('command') || message.includes('cmd') || 
           message.includes('list command') || message.includes('show command') ||
           message.includes('list cmd') || message.includes('show cmd') ||
           message.includes('available command') || message.includes('what commands') ||
           message.includes('commande') || message.includes('liste des commandes');
}

function isPrefixRequest(message) {
    return message.includes('prefix') || message.includes('what is your prefix') ||
           message.includes('préfixe') || message.includes('quel est ton préfixe');
}

// Fonctions de traitement des requêtes
async function handleAIQuery(senderId, prompt) {
    await sendMessage(senderId, "🤖 Je réfléchis...");
    
    try {
        const response = await axios.get(`https://lorex-gpt4.onrender.com/api/gpt4?prompt=${encodeURIComponent(prompt)}&uid=${senderId}`);
        
        if (response.data && response.data.response) {
            const header = "(⁠◍⁠•⁠ᴗ⁠•⁠◍⁠) | 𝙼𝚘𝚌𝚑𝚊 𝙰𝚒\n・──────────────・";
            const footer = "・───── >ᴗ< ──────・";
            await sendMessage(senderId, `${header}\n${response.data.response}\n${footer}`);
        } else {
            await sendMessage(senderId, "❌ Impossible d'obtenir une réponse de l'IA.");
        }
    } catch (error) {
        console.error("Erreur lors de l'appel à l'API GPT-4:", error);
        await sendMessage(senderId, "❌ Une erreur s'est produite lors de la communication avec l'IA.");
    }
}

async function handleContact(senderId) {
    const contactContent = `👨‍💻 Développeur: Bruno Rakotomalala
📧 Email: bruno.rakotomalala@example.com
📱 Facebook: https://www.facebook.com/bruno.rakotomalala.7549
🌐 Localisation: Madagascar 🇲🇬
📞 Téléphone: 0346973333

💬 Pour le support ou des questions, n'hésitez pas à me contacter!`;
    
    await sendMessage(senderId, `📞 **Informations de Contact**\n\n${contactContent}`);
}

async function handleRules(senderId) {
    const rulesContent = `1. Soyez respectueux: Traitez tout le monde dans le groupe avec gentillesse et respect.
2. Pas de spam: Évitez d'envoyer des messages répétitifs ou non pertinents.
3. Restez dans le sujet: Gardez les discussions pertinentes au but du groupe.
4. Pas d'informations personnelles: Ne partagez pas de détails personnels sans permission.
5. Suivez le but du groupe: Assurez-vous que vos messages contribuent aux objectifs éducatifs.
6. Signalez les problèmes: Si vous rencontrez des problèmes, contactez un administrateur.`;
    
    await sendMessage(senderId, `📋 **Règles du Groupe**\n\n${rulesContent}`);
}

async function handleShoti(senderId) {
    await sendMessage(senderId, "📹 Je cherche une vidéo pour vous...");
    
    try {
        const response = await axios.post("https://shoti-rho.vercel.app/api/request/f");
        const data = response.data;

        if (!data || !data.url) {
            throw new Error("Aucune vidéo trouvée.");
        }

        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const videoPath = path.join(tempDir, `shoti_${Date.now()}.mp4`);
        const writer = fs.createWriteStream(videoPath);

        const videoStream = await axios({
            url: data.url,
            method: 'GET',
            responseType: 'stream',
        });

        videoStream.data.pipe(writer);

        writer.on('finish', async () => {
            try {
                await sendMessage(senderId, {
                    text: `🎬 Vidéo TikTok\n👤 Utilisateur: ${data.username || 'Inconnu'}\n💫 Nom: ${data.nickname || 'Inconnu'}`,
                    attachment: fs.createReadStream(videoPath)
                });
                fs.unlinkSync(videoPath);
            } catch (error) {
                console.error('Erreur lors de l\'envoi de la vidéo:', error);
                await sendMessage(senderId, "❌ Erreur lors de l'envoi de la vidéo.");
            }
        });

        writer.on('error', async () => {
            await sendMessage(senderId, "❌ Erreur lors du traitement de la vidéo.");
        });

    } catch (error) {
        console.error('Erreur lors de la récupération de la vidéo:', error);
        await sendMessage(senderId, "❌ Erreur lors de la récupération de la vidéo.");
    }
}

async function handleUID(senderId) {
    await sendMessage(senderId, `🆔 Votre ID utilisateur: ${senderId}`);
}

async function handleUptime(senderId) {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    const message = `⏰ Temps de fonctionnement du bot: ${hours}h ${minutes}m ${seconds}s`;
    await sendMessage(senderId, message);
}

async function handleHelp(senderId) {
    const helpContent = `✨ Parlez-moi naturellement! Je comprends:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🤖 **IA & Questions**
   • Posez n'importe quelle question naturellement
   • Obtenez des réponses intelligentes
   • Aucune commande spéciale nécessaire

📋 **Règles & Infos**
   • "Quelles sont les règles?"
   • "Informations de contact"
   • "Temps de fonctionnement du bot"

📹 **Médias & Divertissement**
   • "Envoie-moi une vidéo" ou "shoti"
   • "Trouve une vidéo TikTok sur..."

🔧 **Utilitaires**
   • "Obtenir ID/UID"
   • "Dis quelque chose" (synthèse vocale)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 **Pas de commandes nécessaires - juste chattez!**`;
    
    await sendMessage(senderId, `🤖 **MOCHA AI - VERSION INTELLIGENTE**\n\n${helpContent}`);
}

async function handleCommandList(senderId) {
    const smartFeatures = [
        "🤖 Questions & Chat IA",
        "📋 Règles & Directives", 
        "📹 Divertissement Vidéo",
        "🆔 Informations ID Utilisateur",
        "📞 Informations de Contact",
        "⏰ Temps de Fonctionnement",
        "🔧 Utilitaires Divers"
    ];
    
    let smartContent = `✨ **FONCTIONNALITÉS INTELLIGENTES** (Aucun Préfixe Nécessaire!)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
    
    smartFeatures.forEach((feature, index) => {
        const number = (index + 1).toString().padStart(2, '0');
        smartContent += `${number}. ${feature}\n`;
    });
    
    smartContent += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    smartContent += `💡 **CONSEIL**: Tapez naturellement!
Exemple: "Quel temps fait-il?" ou "Envoie-moi une vidéo"`;
    
    await sendMessage(senderId, `🤖 **MOCHA AI - COMMANDES DISPONIBLES**\n\n${smartContent}`);
}

async function handlePrefix(senderId) {
    const message = `Mon préfixe est utilisé pour les commandes traditionnelles, mais devinez quoi? Vous n'en avez plus besoin! 🎉\nParlez-moi naturellement et je vous comprendrai! 💬`;
    await sendMessage(senderId, message);
}

// Informations de la commande
module.exports.info = {
    name: "smart",
    description: "Détection intelligente de commandes sans préfixes - permet de discuter naturellement avec le bot",
    usage: "Parlez naturellement: 'Bonjour', 'Quelle heure est-il?', 'Envoie-moi une vidéo', etc."
};
