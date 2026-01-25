const fs = require('fs-extra');
const path = require('path');
const sendMessage = require('./sendMessage');
const axios = require('axios');
const { checkSubscription } = require('../utils/subscription');
const { checkVIPStatus } = require('../utils/vipSubscription');
const geminiModule = require('../auto/gemini');
const controle = require('../ACTIVE&DESACTIVE/controle');
const { autoReact } = require('../utils/autoReaction');

// Charger toutes les commandes du dossier 'commands'
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));
const commands = {};

// Charger toutes les commandes VIP du dossier 'VIP'
const vipDir = path.join(__dirname, '../VIP');
const vipCommands = {};

// S'assurer que le dossier VIP existe
if (!fs.existsSync(vipDir)) {
    fs.mkdirSync(vipDir, { recursive: true });
}

const vipCommandFiles = fs.readdirSync(vipDir).filter(file => file.endsWith('.js'));

// 状态 de pagination global pour être accessible dans ce module
const userPaginationStates = {};

// Charger les commandes dans un objet
for (const file of commandFiles) {
    const commandName = file.replace('.js', '');
    commands[commandName] = require(`../commands/${file}`);

    // Si c'est la commande help, récupérer son état de pagination
    if (commandName === 'help' && commands[commandName].userPaginationStates) {
        Object.assign(userPaginationStates, commands[commandName].userPaginationStates);
    }
}

// Charger les commandes VIP
for (const file of vipCommandFiles) {
    const commandName = file.replace('.js', '');
    vipCommands[commandName] = require(`../VIP/${file}`);
}

console.log('Les commandes suivantes ont été chargées :', Object.keys(commands));
console.log('Les commandes VIP suivantes ont été chargées :', Object.keys(vipCommands));

const activeCommands = {};
const activeVIPCommands = {}; // Suivre les commandes VIP actives
const imageHistory = {};
const MAX_MESSAGE_LENGTH = 2000; // Limite de caractères pour chaque message envoyé

// Commandes non-persistantes qui ne nécessitent pas "stop" après utilisation
// Ces commandes permettent d'utiliser directement d'autres commandes après
const NON_PERSISTENT_COMMANDS = ['usage', 'help', 'uid'];

// Nouveau suivi des questions par image
const userImageQuestionCount = {};

// Stocker les utilisateurs à qui on a déjà envoyé une alerte d'expiration
const expirationAlertSent = {};

// Gestion des messages entrants
const handleMessage = async (event, api) => {
    const senderId = event.sender.id;
    const message = event.message;
    const messageId = message.mid;

    // Ajouter une réaction automatique basée sur le contexte du message
    if (messageId && message.text) {
        autoReact(messageId, message.text).catch(err => {
            console.log('Erreur réaction auto:', err.message || err);
        });
    }

    // Vérifier l'abonnement de l'utilisateur
    const subscription = checkSubscription(senderId);
    
    // Vérifier le statut VIP de l'utilisateur
    const vipStatus = checkVIPStatus(senderId);
    
    // Envoyer un message de bienvenue si c'est le premier message de l'utilisateur
    if (!userPaginationStates[senderId] && !activeCommands[senderId]) {
        // Marquer que nous avons déjà accueilli cet utilisateur
        userPaginationStates[senderId] = { welcomed: true };
    }

    // Autoriser uniquement la commande uid sans abonnement
    const isCommandAllowed = message.text && (
        message.text.toLowerCase().startsWith('uid')
    );

    // NOUVELLE LOGIQUE D'ACCÈS:
    // - Si modeRestreint est désactivé (false) → tout le monde a accès
    // - Si modeRestreint est activé (true) → comportement normal:
    //   - VIP (uidvip.txt) → accès aux deux répertoires commands/ ET VIP/
    //   - Abonné normal (uid.txt seulement) → accès uniquement à commands/
    //   - Non abonné → pas d'accès (sauf commande uid)
    
    const hasFullAccess = !controle.isAccessRestricted() || vipStatus.isVIP || subscription.isSubscribed;

    // Si l'utilisateur n'a aucun accès et que ce n'est pas une commande autorisée
    if (!hasFullAccess && !isCommandAllowed) {
        await sendMessage(senderId, 
            "✨ *ACCÈS EXCLUSIF* ✨\n\n" +
            "🤖 *Félicitations !* Vous êtes sur le point de libérer toute la puissance de notre Intelligence Artificielle.\n\n" +
            "💰 *OFFRE DE LANCEMENT* : Profitez d'un accès illimité pour seulement **2000 AR / mois** !\n\n" +
            "🔍 *COMMENT ACTIVER VOTRE ACCÈS* :\n" +
            "1️⃣ Effectuez votre règlement via **MVola** ou **Airtel Money**.\n" +
            "2️⃣ Envoyez simplement une capture d'écran du transfert à l'administrateur.\n" +
            "3️⃣ Votre compte sera activé **instantanément** !\n\n" +
            "👨‍💻 *ADMINISTRATEUR* : https://www.facebook.com/bruno.rakotomalala.7549\n\n" +
            "🚀 *Tapez 'help' pour explorer l'univers des commandes disponibles !*"
        );
        return;
    }

    // Alerte d'expiration pour les abonnés normaux
    if (subscription.isSubscribed && !subscription.isAdmin && subscription.daysLeft <= 3 && !expirationAlertSent[senderId]) {
        await sendMessage(senderId, 
            `⚠️ Attention! Votre abonnement expire dans ${subscription.daysLeft} jour(s).\n` +
            "Pour renouveler, contactez le 0345788639 (2000 AR/mois)."
        );
        expirationAlertSent[senderId] = true;
    }
    
    // Alerte d'expiration pour les utilisateurs VIP
    if (vipStatus.isVIP && !vipStatus.isAdmin && vipStatus.daysLeft <= 3 && !expirationAlertSent[`vip_${senderId}`]) {
        await sendMessage(senderId, 
            `👑 Attention! Votre abonnement VIP expire dans ${vipStatus.daysLeft} jour(s).\n` +
            "Pour renouveler votre accès VIP, contactez l'administrateur."
        );
        expirationAlertSent[`vip_${senderId}`] = true;
    }

    // Commande "stop" pour désactiver toutes les commandes persistantes
    if (message.text && message.text.toLowerCase() === 'stop') {
        const previousCommand = activeCommands[senderId] || activeVIPCommands[senderId];
        activeCommands[senderId] = null;
        activeVIPCommands[senderId] = null;
        const responseMessage = previousCommand 
            ? `La commande ${previousCommand} a été désactivée. Vous pouvez maintenant utiliser d'autres commandes ou discuter librement.`
            : "Vous n'aviez pas de commande active. Vous pouvez continuer à discuter librement.";
        await sendMessage(senderId, responseMessage);
        return;
    }
    
    // Commande "supprimer" pour réinitialiser la mémoire de la commande active sans la désactiver
    if (message.text && message.text.toLowerCase() === 'supprimer') {
        const activeCommand = activeCommands[senderId] || activeVIPCommands[senderId];
        const isVIPCommand = activeVIPCommands[senderId] !== null && activeVIPCommands[senderId] !== undefined;
        
        if (activeCommand) {
            // Conserver la commande active mais réinitialiser son contexte
            try {
                // On peut notifier l'utilisateur que la conversation est réinitialisée
                await sendMessage(senderId, `🔄 Conversation avec la commande ${activeCommand} réinitialisée. Vous pouvez continuer avec un nouveau sujet.`);
                
                // Envoyer un message spécial à la commande pour indiquer une réinitialisation
                if (isVIPCommand) {
                    await vipCommands[activeCommand](senderId, "RESET_CONVERSATION", api);
                } else {
                    await commands[activeCommand](senderId, "RESET_CONVERSATION", api);
                }
            } catch (error) {
                console.error(`Erreur lors de la réinitialisation de la commande ${activeCommand}:`, error);
                await sendMessage(senderId, `Une erreur s'est produite lors de la réinitialisation de la commande ${activeCommand}.`);
            }
            return;
        } else {
            await sendMessage(senderId, "Vous n'avez pas de commande active à réinitialiser.");
            return;
        }
    }

    // Si des pièces jointes sont envoyées, gérer les images
    if (message.attachments && message.attachments.length > 0) {
        const imageAttachments = message.attachments.filter(attachment => attachment.type === 'image');

        if (imageAttachments.length > 0) {
            // Si une commande est active, elle gère les pièces jointes
            const activeCommand = activeCommands[senderId] || activeVIPCommands[senderId];
            const isVIPCommand = activeVIPCommands[senderId] !== null && activeVIPCommands[senderId] !== undefined;
            
            if (activeCommand) {
                try {
                    const commandHandler = isVIPCommand ? vipCommands[activeCommand] : commands[activeCommand];
                    // On passe explicitement le type 'attachment' et les données de l'image
                    // Note: commands[activeCommand] est appelé ici. 
                    // nano.js attend (senderId, userText, api, imageAttachments)
                    await commandHandler(senderId, "IMAGE_ATTACHMENT", api, imageAttachments);
                    return;
                } catch (error) {
                    console.error(`Erreur lors de l'exécution de la commande ${activeCommand} avec une image:`, error);
                    await sendMessage(senderId, `Une erreur s'est produite lors de l'exécution de la commande ${activeCommand} avec votre image.`);
                }
                return;
            }

            // Si aucune commande active, utiliser auto/gemini.js pour les images
            for (const image of imageAttachments) {
                const imageUrl = image.payload.url;

                // Historique des images envoyées par l'utilisateur
                if (!imageHistory[senderId]) {
                    imageHistory[senderId] = [];
                }
                imageHistory[senderId].push(imageUrl);

                // Réinitialiser le compteur de questions pour cette image
                if (!userImageQuestionCount[senderId]) {
                    userImageQuestionCount[senderId] = {};
                }

                // Si c'est une nouvelle image, réinitialiser le compteur
                if (!userImageQuestionCount[senderId][imageUrl]) {
                    userImageQuestionCount[senderId][imageUrl] = 0;
                }

                // Vérifier si la limite de 30 questions a été atteinte
                if (userImageQuestionCount[senderId][imageUrl] >= 30) {
                    await sendMessage(senderId, "Vous avez atteint la limite de 30 questions pour cette image. Si vous avez une nouvelle image, envoyez-la et posez vos nouvelles questions.");
                    return;
                }

                // Incrémenter le compteur de questions pour cette image
                userImageQuestionCount[senderId][imageUrl]++;

                // Utiliser le module gemini pour traiter l'image
                await geminiModule.handleImageMessage(senderId, imageUrl);
            }
            return;
        }
    }

    // Vérifier si l'utilisateur a envoyé un message texte
    if (!message.text) {
        await sendMessage(senderId, "Je n'ai pas compris votre message. Veuillez envoyer du texte ou une image.");
        return;
    }

    // Texte de l'utilisateur
    const userText = message.text.trim();
    const userTextLower = userText.toLowerCase();

    // Vérifier d'abord si l'utilisateur est en mode pagination pour help
    if (userPaginationStates[senderId] && userPaginationStates[senderId].isActive) {
        // Passer le texte à la commande help pour la navigation
        await commands['help'](senderId, userText);
        return;
    }

    // Détection automatique des liens de réseaux sociaux pour autodown
    // Utiliser une regex pour détecter les URLs de manière plus robuste
    // Supporte aussi les liens de partage Facebook (/share/r/...)
    const SOCIAL_MEDIA_REGEX = /(?:https?:\/\/)?(?:www\.|m\.|vt\.|vm\.)?(?:tiktok\.com|facebook\.com|fb\.watch|instagram\.com|x\.com|twitter\.com)(?:\/[^\s]*)?/gi;
    
    const socialMediaMatches = userText.match(SOCIAL_MEDIA_REGEX);
    
    // Si un lien de réseau social est détecté ET que le message ne commence pas par une autre commande
    // Cela permet d'éviter d'intercepter les commandes qui contiennent des liens
    const startsWithCommand = Object.keys(commands).some(cmd => userTextLower.startsWith(cmd));
    const startsWithVIPCommand = Object.keys(vipCommands).some(cmd => userTextLower.startsWith(cmd));
    
    if (socialMediaMatches && socialMediaMatches.length > 0 && !startsWithCommand && !startsWithVIPCommand && commands['autodown']) {
        try {
            await commands['autodown'](senderId, userText, api);
            return; // Arrêter le traitement après autodown
        } catch (error) {
            console.error('Erreur lors de l\'exécution automatique d\'autodown:', error);
            // Continuer le traitement si autodown échoue
        }
    }

    // Fonction pour vérifier si une commande correspond exactement
    // La commande doit être suivie d'un espace ou être le message entier
    const isExactCommandMatch = (text, commandName) => {
        if (text === commandName) return true;
        if (text.startsWith(commandName + ' ')) return true;
        return false;
    };

    // Détecter si une nouvelle commande VIP est utilisée (correspondance exacte)
    let vipCommandDetected = false;
    let detectedVIPCommandName = null;

    // Trier par longueur décroissante pour éviter les conflits de préfixe
    const sortedVIPCommands = Object.keys(vipCommands).sort((a, b) => b.length - a.length);
    for (const commandName of sortedVIPCommands) {
        if (isExactCommandMatch(userTextLower, commandName)) {
            vipCommandDetected = true;
            detectedVIPCommandName = commandName;
            break;
        }
    }

    // Détecter si une nouvelle commande normale est utilisée (correspondance exacte)
    let newCommandDetected = false;
    let detectedCommandName = null;

    // Trier par longueur décroissante pour éviter les conflits de préfixe
    const sortedCommands = Object.keys(commands).sort((a, b) => b.length - a.length);
    for (const commandName of sortedCommands) {
        if (isExactCommandMatch(userTextLower, commandName)) {
            newCommandDetected = true;
            detectedCommandName = commandName;
            break;
        }
    }

    // Réinitialiser la commande VIP si l'utilisateur n'est plus VIP et notifier
    if (activeVIPCommands[senderId] && !vipStatus.isVIP) {
        console.log(`Utilisateur ${senderId} n'est plus VIP, réinitialisation de la session VIP`);
        await sendMessage(senderId, `
⚠️ Votre accès VIP a expiré.
Contactez l'administrateur pour renouveler votre abonnement VIP.
        `.trim());
        activeVIPCommands[senderId] = null;
    }

    // ===== TRAITEMENT DES COMMANDES PAR PRIORITÉ (EXCLUSIF) =====
    
    // PRIORITÉ 1: Si une commande VIP est détectée, la traiter en premier
    if (vipCommandDetected) {
        const canAccessVIP = !controle.isAccessRestricted() || vipStatus.isVIP;
        if (!canAccessVIP) {
            await sendMessage(senderId, `
👑 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗘 𝗩𝗜𝗣 👑
━━━━━━━━━━━━━━━━━━━
❌ Cette commande est réservée aux membres VIP.

💎 Pour devenir VIP :
• Contactez l'administrateur
• Profitez de fonctionnalités exclusives!

👨‍💻 Admin: https://www.facebook.com/bruno.rakotomalala.7549
            `.trim());
            return;
        }

        // Activer la commande VIP et désactiver toute commande normale
        activeVIPCommands[senderId] = detectedVIPCommandName;
        activeCommands[senderId] = null;
        console.log(`Nouvelle commande VIP active pour ${senderId}: ${detectedVIPCommandName}`);

        const commandPrompt = userText.replace(detectedVIPCommandName, '').trim();

        try {
            await vipCommands[detectedVIPCommandName](senderId, commandPrompt, api);
        } catch (error) {
            console.error(`Erreur lors de l'exécution de la commande VIP ${detectedVIPCommandName}:`, error);
            await sendMessage(senderId, `Une erreur s'est produite lors de l'exécution de la commande VIP ${detectedVIPCommandName}.`);
        }
        return; // FIN - commande VIP traitée
    }
    // PRIORITÉ 2: Si une commande VIP est active et l'utilisateur envoie une suite
    else if (activeVIPCommands[senderId] && vipStatus.isVIP) {
        const activeVIPCommand = activeVIPCommands[senderId];
        console.log(`Commande VIP persistante en cours pour ${senderId}: ${activeVIPCommand}`);

        try {
            await vipCommands[activeVIPCommand](senderId, userText, api);
        } catch (error) {
            console.error(`Erreur lors de l'exécution de la commande VIP ${activeVIPCommand}:`, error);
            await sendMessage(senderId, `Une erreur s'est produite lors de l'exécution de la commande VIP ${activeVIPCommand}.`);
        }
        return; // FIN - commande VIP persistante traitée
    }
    // PRIORITÉ 3: Si une nouvelle commande normale est détectée
    else if (newCommandDetected) {
        // Désactiver la commande VIP
        activeVIPCommands[senderId] = null;
        
        // Activer la commande SEULEMENT si elle n'est pas dans la liste des commandes non-persistantes
        if (!NON_PERSISTENT_COMMANDS.includes(detectedCommandName)) {
            activeCommands[senderId] = detectedCommandName;
            console.log(`Nouvelle commande active pour ${senderId}: ${detectedCommandName}`);
        } else {
            console.log(`Commande non-persistante exécutée pour ${senderId}: ${detectedCommandName}`);
        }
        
        const commandPrompt = userText.replace(detectedCommandName, '').trim();
        const commandFile = commands[detectedCommandName];

        if (commandFile) {
            try {
                await commandFile(senderId, commandPrompt, api);
            } catch (error) {
                console.error(`Erreur lors de l'exécution de la commande ${detectedCommandName}:`, error);
                await sendMessage(senderId, `Une erreur s'est produite lors de l'exécution de la commande ${detectedCommandName}.`);
            }
        }
        return; // FIN - commande normale traitée
    }
    // PRIORITÉ 4: Si une commande normale persistante est active
    else if (activeCommands[senderId] && activeCommands[senderId] !== 'help') {
        const activeCommand = activeCommands[senderId];
        console.log(`Commande persistante en cours pour ${senderId}: ${activeCommand}`);

        try {
            await commands[activeCommand](senderId, userText, api);
        } catch (error) {
            console.error(`Erreur lors de l'exécution de la commande ${activeCommand}:`, error);
            await sendMessage(senderId, `Une erreur s'est produite lors de l'exécution de la commande ${activeCommand}.`);
        }
        return; // FIN - commande normale persistante traitée
    }
    // FALLBACK: Aucune commande, utiliser Gemini
    else {
        await geminiModule.handleTextMessage(senderId, userText);
    }
};

module.exports = handleMessage;
