
const sendMessage = require('../handles/sendMessage');

module.exports = async (senderId, message, args = []) => { 
    try {
        // Afficher l'UID de l'expéditeur dans tous les cas
        await sendMessage(senderId, `🆔 Ton UID Facebook : ${senderId}`);
        
        // Afficher également l'ID de la conversation si elle est différente
        if (message && message.thread_id && message.thread_id !== senderId) {
            await sendMessage(senderId, `👥 ID de la conversation : ${message.thread_id}`);
        }

        // Si aucun argument n'est fourni, on s'arrête ici
        if (!args.length) {
            return;
        }

        // Si le message est une réponse à un autre message
        if (message && message.reply_to) {
            const replyToId = message.reply_to.sender_id;
            await sendMessage(senderId, `👤 L'UID de cette personne : ${replyToId}`);
            return;
        }

        // Vérifier si c'est un URL
        const regExCheckURL = /^(http|https):\/\/[^ "]+$/;
        if (args[0].match(regExCheckURL)) {
            await sendMessage(senderId, "🔍 Analyse du lien de profil...");
            
            // Ici, nous pourrions implémenter une fonction pour extraire l'UID d'un lien
            // Mais pour le moment, nous envoyons un message explicatif
            await sendMessage(senderId, "⚠️ L'extraction d'UID à partir d'un lien n'est pas encore implémentée.");
            return;
        }

        // Si des mentions sont présentes
        if (message && message.mentions) {
            let msg = "🆔 UIDs des personnes mentionnées :\n";
            for (const id in message.mentions) {
                const name = message.mentions[id].replace("@", "");
                msg += `${name}: ${id}\n`;
            }
            await sendMessage(senderId, msg);
            return;
        }

        // Si aucune des conditions précédentes n'est satisfaite
        await sendMessage(senderId, "❓ Pour obtenir un UID, utilisez la commande seule, mentionnez quelqu'un, ou répondez à un message.");
        
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'UID:', error);
        await sendMessage(senderId, "🚨 Une erreur s'est produite. Ton UID est : " + senderId);
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "uid",  // Nom de la commande
    description: "Récupère l'UID Facebook de ton compte, de la conversation ou d'autres utilisateurs.",  // Description
    usage: "uid [mention/@tag] ou réponds à un message avec uid pour obtenir l'UID de cette personne."  // Comment utiliser la commande
};
