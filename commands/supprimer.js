const fs = require('fs-extra');
const path = require('path');
const sendMessage = require('../handles/sendMessage');
const { syncFileToGitHub } = require('../utils/githubSync');

// Liste des administrateurs autorisés (même liste que admin.js)
const ADMIN_IDS = ['28877400275216924'];

// Fichiers cibles
const FACEBOOK_FILE = path.join(__dirname, '../Facebook/uid.txt');
const FACEBOOK_VIP_FILE = path.join(__dirname, '../FacebookVip/uidvip.txt');

// État d'attente par admin : { uid, step: 'fichier' }
const pendingSuppression = new Map();

/**
 * Supprime un UID d'un fichier
 * @param {string} filePath - Chemin vers le fichier
 * @param {string} uid - UID à supprimer
 * @returns {Object} { success, found }
 */
function removeUidFromFile(filePath, uid) {
    try {
        if (!fs.existsSync(filePath)) {
            return { success: false, found: false };
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        let found = false;

        const newLines = lines.filter(line => {
            if (line.trim() && !line.startsWith('#')) {
                const [existingUid] = line.split('|');
                if (existingUid.trim() === uid) {
                    found = true;
                    return false; // Supprimer cette ligne
                }
            }
            return true;
        });

        if (!found) {
            return { success: true, found: false };
        }

        fs.writeFileSync(filePath, newLines.join('\n'));
        return { success: true, found: true };
    } catch (error) {
        console.error('Erreur suppression UID:', error);
        return { success: false, found: false };
    }
}

module.exports = async (senderId, message) => {
    try {
        // Vérifier les droits admin — alerte si non autorisé
        if (!ADMIN_IDS.includes(senderId)) {
            await sendMessage(senderId,
                "⛔ *ACCÈS REFUSÉ*\n\n" +
                "Cette commande est réservée exclusivement à l'administrateur du bot.\n\n" +
                "⚠️ Toute tentative d'utilisation non autorisée est enregistrée."
            );
            return;
        }

        const text = message.trim();

        // ── ÉTAPE 2 : Choix du fichier ──
        if (pendingSuppression.has(senderId)) {
            const state = pendingSuppression.get(senderId);
            const choix = text.toLowerCase();

            if (choix === 'stop' || choix === 'annuler' || choix === 'cancel') {
                pendingSuppression.delete(senderId);
                await sendMessage(senderId, `🚫 Suppression de l'UID ${state.uid} annulée.`);
                return;
            }

            let filePath, nomFichier;

            if (choix === 'facebook' || choix === '1') {
                filePath = FACEBOOK_FILE;
                nomFichier = 'Facebook/uid.txt';
            } else if (choix === 'facebookvip' || choix === 'vip' || choix === '2') {
                filePath = FACEBOOK_VIP_FILE;
                nomFichier = 'FacebookVip/uidvip.txt';
            } else {
                await sendMessage(senderId,
                    `❓ Choix non reconnu. Veuillez répondre :\n\n` +
                    `• Facebook  — abonnés normaux\n` +
                    `• FacebookVip  — abonnés VIP\n` +
                    `• stop  — annuler`
                );
                return;
            }

            pendingSuppression.delete(senderId);
            const result = removeUidFromFile(filePath, state.uid);

            if (!result.success) {
                await sendMessage(senderId, `❌ Erreur lors de la suppression dans ${nomFichier}.`);
                return;
            }

            if (!result.found) {
                await sendMessage(senderId,
                    `⚠️ L'UID ${state.uid} n'a pas été trouvé dans ${nomFichier}.\n\n` +
                    `Vérifiez l'UID ou le fichier cible.`
                );
                return;
            }

            // Synchroniser avec GitHub en arrière-plan
            syncFileToGitHub(
                filePath,
                nomFichier,
                `[bot] supprimer UID ${state.uid} de ${nomFichier}`
            ).catch(err => console.error('[supprimer] Sync GitHub échoué:', err.message));

            await sendMessage(senderId,
                `✅ UID supprimé de ${nomFichier} !\n\n` +
                `👤 UID : ${state.uid}\n\n` +
                `L'utilisateur n'est plus abonné.`
            );

            // Notifier l'utilisateur supprimé
            try {
                await sendMessage(state.uid,
                    "⚠️ *ABONNEMENT DÉSACTIVÉ* ⚠️\n\n" +
                    "Votre accès aux services du bot a été suspendu par l'administrateur.\n\n" +
                    "💫 Pour réactiver votre accès, contactez l'administrateur.\n\n" +
                    "👨‍💻 Contact Admin: https://www.facebook.com/bruno.rakotomalala.7549"
                );
            } catch (e) {
                await sendMessage(senderId,
                    `⚠️ UID supprimé mais impossible de notifier l'utilisateur ${state.uid} ` +
                    `(il n'a peut-être pas encore interagi avec le bot).`
                );
            }
            return;
        }

        // ── ÉTAPE 1 : L'admin tape "supprimer <uid>" ──
        if (!text) {
            await sendMessage(senderId,
                "📋 Utilisation de la commande supprimer :\n\n" +
                "supprimer <uid>\n\n" +
                "Exemple : supprimer 27482903718068344\n\n" +
                "Le bot vous demandera dans quel fichier supprimer l'UID\n" +
                "(Facebook ou FacebookVip)."
            );
            return;
        }

        // Extraire l'UID (premier mot)
        const uid = text.split(/\s+/)[0];

        // Valider que c'est un UID numérique
        if (!/^\d+$/.test(uid)) {
            await sendMessage(senderId,
                `❌ UID invalide : "${uid}"\n\n` +
                `Un UID doit être un nombre entier.\nExemple : supprimer 27482903718068344`
            );
            return;
        }

        // Stocker l'état et poser la question
        pendingSuppression.set(senderId, { uid });

        await sendMessage(senderId,
            `🗑️ Dans quel fichier voulez-vous supprimer cet UID ?\n\n` +
            `👤 UID : ${uid}\n\n` +
            `Répondez :\n` +
            `• Facebook  — abonnés normaux (Facebook/uid.txt)\n` +
            `• FacebookVip  — abonnés VIP (FacebookVip/uidvip.txt)\n` +
            `• stop  — annuler`
        );

    } catch (error) {
        console.error('Erreur dans la commande supprimer:', error);
        await sendMessage(senderId, "🚨 Une erreur s'est produite lors de l'exécution de la commande supprimer.");
    }
};

module.exports.info = {
    name: "supprimer",
    description: "Supprime un UID de Facebook/uid.txt ou FacebookVip/uidvip.txt (admin uniquement)",
    usage: "supprimer <uid>  →  le bot demande le fichier cible (Facebook ou FacebookVip)"
};
