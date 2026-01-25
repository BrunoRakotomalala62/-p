const fs = require('fs-extra');
const path = require('path');
const sendMessage = require('../handles/sendMessage');
const { sendLongMessage } = require('../utils/messageFormatter');

module.exports = async (senderId, args) => {
    try {
        const userInput = typeof args === 'string' ? args.trim() : (Array.isArray(args) ? args.join(' ').trim() : '');
        
        const commandsDir = path.join(__dirname, '../commands');
        const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js'));
        
        // Si aucune commande spécifique n'est demandée, afficher la liste
        if (!userInput) {
            let message = "📚 GUIDE D'UTILISATION DES COMMANDES\n";
            message += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
            message += "💡 Pour voir l'utilisation d'une commande :\n";
            message += "   Tapez : usage <nom_commande>\n\n";
            message += "📝 Exemples :\n";
            message += "   • usage tononkalo\n";
            message += "   • usage poesie\n";
            message += "   • usage gemini\n";
            message += "   • usage autodown\n\n";
            message += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
            message += `📋 ${commandFiles.length} commandes disponibles :\n\n`;
            
            // Créer une liste organisée par catégories
            const categories = {
                '🎭 Poésie & Culture': [],
                '🤖 IA & Chat': [],
                '📥 Téléchargement': [],
                '🔧 Utilitaires': [],
                '📚 Apprentissage': [],
                '🎨 Multimédia': [],
                '⚙️ Autres': []
            };
            
            commandFiles.forEach(file => {
                const commandName = file.replace('.js', '');
                
                // Catégoriser les commandes
                if (['tononkalo', 'poesie', 'fihirana', 'ohabolana', 'kilody'].includes(commandName)) {
                    categories['🎭 Poésie & Culture'].push(commandName);
                } else if (['gemini', 'gpt', 'claude', 'ai', 'chat', 'mistral', 'llama'].includes(commandName)) {
                    categories['🤖 IA & Chat'].push(commandName);
                } else if (['autodown', 'music', 'mp4', 'audio', 'photo'].includes(commandName)) {
                    categories['📥 Téléchargement'].push(commandName);
                } else if (['learn', 'bible', 'baiboly', 'definition', 'dico'].includes(commandName)) {
                    categories['📚 Apprentissage'].push(commandName);
                } else if (['image', 'dalle', 'photo', 'pinterest', 'midijourney'].includes(commandName)) {
                    categories['🎨 Multimédia'].push(commandName);
                } else if (['help', 'usage', 'admin', 'check'].includes(commandName)) {
                    categories['⚙️ Autres'].push(commandName);
                } else {
                    categories['🔧 Utilitaires'].push(commandName);
                }
            });
            
            // Afficher par catégories
            for (const [category, commands] of Object.entries(categories)) {
                if (commands.length > 0) {
                    message += `\n${category}\n`;
                    commands.forEach(cmd => {
                        message += `  • ${cmd}\n`;
                    });
                }
            }
            
            // Charger dynamiquement les commandes VIP
            const vipDir = path.join(__dirname, '../VIP');
            if (fs.existsSync(vipDir)) {
                const vipFiles = fs.readdirSync(vipDir).filter(file => file.endsWith('.js'));
                if (vipFiles.length > 0) {
                    message += "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
                    message += "✨🌟 ESPACE VIP EXCLUSIF 🌟✨\n";
                    message += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
                    message += "🔐 Ces commandes premium sont\n";
                    message += "   réservées aux membres VIP\n\n";
                    message += `👑 ${vipFiles.length} commande${vipFiles.length > 1 ? 's' : ''} exclusive${vipFiles.length > 1 ? 's' : ''} :\n`;
                    vipFiles.forEach(file => {
                        const vipCommandName = file.replace('.js', '');
                        message += `  💎 ${vipCommandName}\n`;
                    });
                    message += "\n💡 Devenez VIP pour débloquer\n";
                    message += "   ces fonctionnalités premium !\n";
                }
            }
            
            message += "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
            message += "💬 Tapez 'usage <commande>' pour plus de détails";
            
            await sendLongMessage(senderId, message);
            return;
        }
        
        // Rechercher la commande demandée
        const requestedCommand = userInput.toLowerCase();
        let commandFile = commandFiles.find(file => 
            file.toLowerCase().replace('.js', '') === requestedCommand
        );
        
        let isVipCommand = false;
        let commandPath = '';
        
        // Si non trouvée dans commands/, chercher dans VIP/
        if (!commandFile) {
            const vipDir = path.join(__dirname, '../VIP');
            if (fs.existsSync(vipDir)) {
                const vipFiles = fs.readdirSync(vipDir).filter(file => file.endsWith('.js'));
                commandFile = vipFiles.find(file => 
                    file.toLowerCase().replace('.js', '') === requestedCommand
                );
                if (commandFile) {
                    isVipCommand = true;
                    commandPath = path.join(vipDir, commandFile);
                }
            }
        } else {
            commandPath = path.join(__dirname, commandFile);
        }
        
        if (!commandFile) {
            await sendMessage(senderId, 
                `❌ Commande "${requestedCommand}" introuvable.\n\n` +
                `💡 Tapez "usage" sans argument pour voir toutes les commandes disponibles.`
            );
            return;
        }
        
        // Charger la commande
        const commandName = commandFile.replace('.js', '');
        const command = isVipCommand ? require(commandPath) : require(`./${commandFile}`);
        
        // Récupérer les informations de la commande
        let name = commandName;
        let description = "Aucune description disponible.";
        let usage = "Aucune information d'utilisation disponible.";
        
        // Vérifier dans command.info d'abord
        if (command.info) {
            name = command.info.name || name;
            description = command.info.description || description;
            usage = command.info.usage || usage;
        } else {
            // Sinon, vérifier les propriétés directes
            if (command.description) description = command.description;
            if (command.usage) usage = command.usage;
        }
        
        // Formater le message d'utilisation
        let usageMessage = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        if (isVipCommand) {
            usageMessage += `👑 COMMANDE VIP : ${name.toUpperCase()}\n`;
            usageMessage += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
            usageMessage += "💎 Réservée aux membres premium\n";
        } else {
            usageMessage += `📖 COMMANDE : ${name.toUpperCase()}\n`;
        }
        usageMessage += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
        
        usageMessage += `📝 Description :\n${description}\n\n`;
        usageMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        usageMessage += `💡 Utilisation :\n${usage}\n\n`;
        
        // Ajouter des exemples spécifiques pour certaines commandes populaires
        const examples = getCommandExamples(commandName);
        if (examples) {
            usageMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            usageMessage += `📌 Exemples :\n${examples}\n\n`;
        }
        
        usageMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        usageMessage += `💬 Tapez "usage" pour voir toutes les commandes\n`;
        usageMessage += `🛑 Tapez "stop" pour arrêter la commande`;
        
        await sendLongMessage(senderId, usageMessage);
        
    } catch (error) {
        console.error('Erreur dans la commande usage:', error);
        await sendMessage(senderId, 
            `❌ Une erreur s'est produite lors de l'affichage de l'utilisation.\n` +
            `Détails: ${error.message}`
        );
    }
};

// Fonction pour fournir des exemples spécifiques
function getCommandExamples(commandName) {
    const examples = {
        'tononkalo': 
            '1. tononkalo fitiavana\n' +
            '   → Recherche des tononkalo sur l\'amour\n\n' +
            '2. Tapez un numéro (ex: 1, 2, 3...)\n' +
            '   → Affiche le tononkalo complet avec audio\n\n' +
            '3. page 2\n' +
            '   → Affiche la page suivante',
        
        'poesie':
            '1. poesie fitiavana\n' +
            '   → Recherche des poèmes sur l\'amour\n\n' +
            '2. Tapez un numéro (ex: 1, 2, 3...)\n' +
            '   → Affiche le poème complet avec audio\n\n' +
            '3. page 2\n' +
            '   → Affiche la page suivante',
        
        'gemini':
            '1. gemini Comment créer un site web ?\n' +
            '   → Pose une question à Gemini AI\n\n' +
            '2. Envoyez une image + texte\n' +
            '   → Analyse d\'image avec Gemini',
        
        'autodown':
            '1. autodown https://tiktok.com/@user/video/...\n' +
            '   → Télécharge une vidéo TikTok\n\n' +
            '2. Collez simplement le lien\n' +
            '   → Détection automatique (TikTok, FB, Instagram)',
        
        'music':
            '1. music Despacito\n' +
            '   → Recherche et télécharge la musique\n\n' +
            '2. music Ed Sheeran Shape of You\n' +
            '   → Recherche par artiste et titre',
        
        'bible':
            '1. bible Jean 3:16\n' +
            '   → Affiche le verset biblique\n\n' +
            '2. bible Psaume 23\n' +
            '   → Affiche le chapitre complet',
        
        'help':
            '1. help\n' +
            '   → Affiche toutes les commandes\n\n' +
            '2. help next ou >\n' +
            '   → Page suivante\n\n' +
            '3. help 2\n' +
            '   → Va à la page 2'
    };
    
    return examples[commandName] || null;
}

// Informations de la commande usage elle-même
module.exports.info = {
    name: "usage",
    description: "Affiche l'utilisation détaillée de chaque commande disponible.",
    usage: "Tapez 'usage <nom_commande>' pour voir comment utiliser une commande spécifique. Exemple : usage tononkalo"
};
