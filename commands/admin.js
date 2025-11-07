const fs = require('fs-extra');
const path = require('path');
const sendMessage = require('../handles/sendMessage');
const { addSubscription, removeSubscription, checkSubscription } = require('../utils/subscription');

// Liste des administrateurs autorisés (ajouter vos UIDs)
const ADMIN_IDS = ['8019039378224629']; // Seul l'administrateur principal

module.exports = async (senderId, message, args = []) => {
    try {
        // Vérifier si l'utilisateur est un administrateur
        if (!ADMIN_IDS.includes(senderId)) {
            await sendMessage(senderId, "⛔ Vous n'êtes pas autorisé à utiliser cette commande.");
            return;
        }

        // Traiter le message comme une chaîne de caractères complète
        const messageText = message.trim();

        // Si aucun argument n'est fourni, afficher l'aide
        if (!messageText) {
            const helpMessage = 
                "🔧 Commandes administrateur disponibles:\n\n" +
                "admin add [uid] [date d'expiration] - Ajouter un abonnement (ex: admin add 7792802360757187 2025-12-23)\n" +
                "admin check [uid] - Vérifier un abonnement\n" +
                "admin supprimer [uid] - Supprimer un abonnement\n" +
                "admin list - Lister tous les abonnements\n\n" +
                "⚠️ IMPORTANT: La date d'expiration est OBLIGATOIRE pour ajouter un utilisateur.";

            await sendMessage(senderId, helpMessage);
            return;
        }

        // Vérifier si c'est une commande d'ajout avec date d'expiration
        if (messageText.startsWith('add ')) {
            const parts = messageText.split(' ');
            if (parts.length < 3) {
                await sendMessage(senderId, "❌ Format incorrect. La commande add nécessite un UID et une date d'expiration.\n\nUtilisez ce format:\nadmin add [uid] [date d'expiration]\n\nExemple: admin add 7792802360757187 2025-12-23");
                return;
            }

            const uid = parts[1];
            const expirationDate = parts[2];

            // Vérifier le format de la date
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(expirationDate)) {
                await sendMessage(senderId, "❌ Format de date incorrect. Utilisez le format YYYY-MM-DD (ex: 2025-12-23)");
                return;
            }

            try {
                // Ajouter directement au fichier uid.txt avec la date d'expiration spécifiée
                const uidFilePath = path.join(__dirname, '../Facebook/uid.txt');
                let content = fs.readFileSync(uidFilePath, 'utf8');
                const lines = content.split('\n');
                const newLines = [];
                let found = false;

                for (const line of lines) {
                    if (line.trim() && !line.startsWith('#')) {
                        const [subscriberUid] = line.split('|');
                        if (subscriberUid.trim() === uid) {
                            newLines.push(`${uid}|${expirationDate}`);
                            found = true;
                        } else {
                            newLines.push(line);
                        }
                    } else {
                        newLines.push(line);
                    }
                }

                if (!found) {
                    newLines.push(`${uid}|${expirationDate}`);
                }

                fs.writeFileSync(uidFilePath, newLines.join('\n'));

                // Informer l'administrateur
                await sendMessage(senderId, `✅ Abonnement ajouté pour ${uid} jusqu'au ${expirationDate}`);

                // Informer l'utilisateur de son abonnement
                try {
                    await sendMessage(uid, 
                        "🎉 Félicitations! Votre abonnement a été activé.\n\n" +
                        `📅 Date d'expiration: ${expirationDate}\n\n` +
                        "Vous pouvez maintenant utiliser toutes les fonctionnalités du bot.\n\n" +
                        "Pour toute question, contactez l'administrateur."
                    );
                } catch (error) {
                    await sendMessage(senderId, `⚠️ Abonnement ajouté mais impossible de notifier l'utilisateur ${uid}. Il est possible que l'utilisateur n'ait pas encore interagi avec le bot.`);
                }

                // Signal pour sauter la vérification d'autres commandes dans handleMessage.js
                return { commandExecuted: true, skipCommandCheck: true };
            } catch (error) {
                console.error('Erreur lors de l\'ajout de l\'abonnement:', error);
                await sendMessage(senderId, `❌ Une erreur s'est produite lors de l'ajout de l'abonnement pour ${uid}.`);
            }

            return { commandExecuted: true };
        }

        // Vérifier si c'est une commande de vérification d'abonnement
        if (messageText.startsWith('check ')) {
            const uid = messageText.split(' ')[1];
            const subscription = checkSubscription(uid);

            if (subscription.isSubscribed) {
                await sendMessage(senderId, `📊 L'utilisateur ${uid} est abonné jusqu'au ${subscription.expirationDate} (${subscription.daysLeft} jours restants)`);
            } else {
                await sendMessage(senderId, `❌ L'utilisateur ${uid} n'est pas abonné`);
            }
            return;
        }

        // Vérifier si c'est une commande de suppression simplifiée
        if (messageText.startsWith('supprimer ')) {
            const uid = messageText.split(' ')[1];

            if (removeSubscription(uid)) {
                await sendMessage(senderId, `✅ Abonnement supprimé pour ${uid}`);

                // Informer l'utilisateur que son abonnement a été supprimé
                try {
                    await sendMessage(uid, 
                        "⚠️ *ABONNEMENT DÉSACTIVÉ* ⚠️\n\n" +
                        "Votre accès aux services du bot a été temporairement interrompu.\n\n" +
                        "💫 *RÉACTIVEZ FACILEMENT* :\n" +
                        "• Tarif : 2000 AR/mois seulement\n" +
                        "• MVola : 0346973333\n" +
                        "• Airtel Money : 0338764195\n" +
                        "• Contact direct : 0346973333\n\n" +
                        "🔄 Après paiement, envoyez une capture d'écran à l'administrateur pour une réactivation immédiate!\n\n" +
                        "👨‍💻 Facebook administrateur: https://www.facebook.com/bruno.rakotomalala.7549"
                    );
                } catch (error) {
                    await sendMessage(senderId, `⚠️ Abonnement supprimé mais impossible de notifier l'utilisateur ${uid}.`);
                }
            } else {
                await sendMessage(senderId, `❌ Erreur lors de la suppression de l'abonnement pour ${uid}`);
            }
            return;
        }

        // Lister tous les abonnements
        if (messageText.trim() === 'list') {
            const uidFilePath = path.join(__dirname, '../Facebook/uid.txt');

            if (!fs.existsSync(uidFilePath)) {
                await sendMessage(senderId, "❌ Aucun abonnement trouvé");
                return;
            }

            const content = fs.readFileSync(uidFilePath, 'utf8');
            const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));

            if (lines.length === 0) {
                await sendMessage(senderId, "❌ Aucun abonnement trouvé");
                return;
            }

            let message = "📋 Liste des abonnements:\n\n";
            const now = new Date();

            for (const line of lines) {
                const [uid, expirationDate] = line.split('|');
                const expDate = new Date(expirationDate);
                const daysLeft = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
                const status = daysLeft > 0 ? `✅ Actif (${daysLeft} jours)` : "⛔ Expiré";

                message += `${uid} | ${expirationDate} | ${status}\n`;
            }

            await sendMessage(senderId, message);
            return;
        }

        // Commande non reconnue
        await sendMessage(senderId, "❓ Commande non reconnue. Utilisez 'admin' sans arguments pour voir la liste des commandes.\n\nFormat correct pour ajouter un utilisateur:\nadmin add [uid] [date d'expiration]\n\nExemple: admin add 6039658516099189 2025-12-31");

    } catch (error) {
        console.error('Erreur dans la commande admin:', error);
        await sendMessage(senderId, "🚨 Une erreur s'est produite lors de l'exécution de la commande.");
    }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "admin",
    description: "Gestion des abonnements (administrateurs uniquement)",
    usage: "admin [add/supprimer/check/list] [uid] [date]"
};