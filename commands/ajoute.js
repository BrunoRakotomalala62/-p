const fs = require('fs-extra');
const path = require('path');
const sendMessage = require('../handles/sendMessage');
const { syncFileToGitHub } = require('../utils/githubSync');

// Liste des administrateurs autorisés (même liste que admin.js)
const ADMIN_IDS = ['28877400275216924'];

// Fichiers cibles
const FACEBOOK_FILE = path.join(__dirname, '../Facebook/uid.txt');
const FACEBOOK_VIP_FILE = path.join(__dirname, '../FacebookVip/uidvip.txt');

// État d'attente par admin
// Structure : { uid, step: 'fichier' | 'date', fichier: 'facebook' | 'vip' }
const pendingAjouts = new Map();

/**
 * Écrit un UID dans le fichier cible avec la date donnée (sans doublon)
 * @param {string} filePath - Chemin vers le fichier
 * @param {string} uid - UID à ajouter
 * @param {string} date - Date d'expiration (YYYY-MM-DD)
 * @returns {Object} { success, alreadyExists }
 */
function writeUidToFile(filePath, uid, date) {
    try {
        fs.ensureFileSync(filePath);
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        let found = false;

        const updatedLines = lines.map(line => {
            if (line.trim() && !line.startsWith('#')) {
                const [existingUid] = line.split('|');
                if (existingUid.trim() === uid) {
                    found = true;
                    return `${uid}| ${date}`;
                }
            }
            return line;
        });

        if (found) {
            fs.writeFileSync(filePath, updatedLines.join('\n'));
            return { success: true, alreadyExists: true };
        }

        // Ajouter à la fin
        const newLine = `${uid}| ${date}`;
        const updatedContent = content.endsWith('\n')
            ? content + newLine + '\n'
            : content + '\n' + newLine + '\n';

        fs.writeFileSync(filePath, updatedContent);
        return { success: true, alreadyExists: false };
    } catch (error) {
        console.error('Erreur écriture fichier:', error);
        return { success: false };
    }
}

module.exports = async (senderId, message) => {
    try {
        // Vérifier les droits admin
        if (!ADMIN_IDS.includes(senderId)) {
            await sendMessage(senderId, "⛔ Vous n'êtes pas autorisé à utiliser cette commande.");
            return;
        }

        const text = message.trim();

        // ── ÉTAPE 2 : Choix du fichier ──
        if (pendingAjouts.has(senderId) && pendingAjouts.get(senderId).step === 'fichier') {
            const state = pendingAjouts.get(senderId);
            const choix = text.toLowerCase();

            if (choix === 'stop' || choix === 'annuler' || choix === 'cancel') {
                pendingAjouts.delete(senderId);
                await sendMessage(senderId, `🚫 Ajout de l'UID ${state.uid} annulé.`);
                return;
            }

            if (choix === 'facebook' || choix === '1') {
                pendingAjouts.set(senderId, { ...state, step: 'date', fichier: 'facebook' });
            } else if (choix === 'facebookvip' || choix === 'vip' || choix === '2') {
                pendingAjouts.set(senderId, { ...state, step: 'date', fichier: 'vip' });
            } else {
                await sendMessage(senderId,
                    `❓ Choix non reconnu. Veuillez répondre :\n\n` +
                    `• Facebook  — abonné normal\n` +
                    `• FacebookVip  — abonné VIP\n` +
                    `• stop  — annuler`
                );
                return;
            }

            await sendMessage(senderId,
                `📅 Quelle est la date d'expiration ?\n\n` +
                `• Format : YYYY-MM-DD  (ex: 2026-12-31)\n` +
                `• permanent  — accès illimité (2099-12-31)\n` +
                `• stop  — annuler`
            );
            return;
        }

        // ── ÉTAPE 3 : Date d'expiration ──
        if (pendingAjouts.has(senderId) && pendingAjouts.get(senderId).step === 'date') {
            const state = pendingAjouts.get(senderId);
            const choix = text.toLowerCase();

            if (choix === 'stop' || choix === 'annuler' || choix === 'cancel') {
                pendingAjouts.delete(senderId);
                await sendMessage(senderId, `🚫 Ajout de l'UID ${state.uid} annulé.`);
                return;
            }

            let date;
            if (choix === 'permanent' || choix === 'toujours' || choix === 'illimité') {
                date = '2099-12-31';
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
                // Vérifier que la date est valide et dans le futur
                const parsed = new Date(text);
                if (isNaN(parsed.getTime())) {
                    await sendMessage(senderId,
                        `❌ Date invalide : "${text}"\n\n` +
                        `Utilisez le format YYYY-MM-DD (ex: 2026-12-31) ou "permanent".`
                    );
                    return;
                }
                if (parsed <= new Date()) {
                    await sendMessage(senderId,
                        `❌ La date "${text}" est déjà passée.\n\n` +
                        `Entrez une date future ou "permanent".`
                    );
                    return;
                }
                date = text;
            } else {
                await sendMessage(senderId,
                    `❓ Format non reconnu : "${text}"\n\n` +
                    `• Format attendu : YYYY-MM-DD  (ex: 2026-12-31)\n` +
                    `• Ou répondez : permanent\n` +
                    `• Ou répondez : stop pour annuler`
                );
                return;
            }

            // Écrire dans le bon fichier
            const filePath = state.fichier === 'facebook' ? FACEBOOK_FILE : FACEBOOK_VIP_FILE;
            const nomFichier = state.fichier === 'facebook' ? 'Facebook/uid.txt' : 'FacebookVip/uidvip.txt';
            const typeAbonne = state.fichier === 'facebook' ? 'abonné' : 'abonné VIP';

            pendingAjouts.delete(senderId);
            const result = writeUidToFile(filePath, state.uid, date);

            if (!result.success) {
                await sendMessage(senderId, `❌ Erreur lors de l'écriture dans ${nomFichier}.`);
                return;
            }

            // Synchroniser avec GitHub en arrière-plan
            syncFileToGitHub(
                filePath,
                nomFichier,
                `[bot] ajoute UID ${state.uid} dans ${nomFichier}`
            ).catch(err => console.error('[ajoute] Sync GitHub échoué:', err.message));

            const dateLabel = date === '2099-12-31' ? `${date} (permanent)` : date;

            if (result.alreadyExists) {
                await sendMessage(senderId,
                    `🔄 L'UID ${state.uid} était déjà dans ${nomFichier}.\n` +
                    `✅ Date de fin mise à jour : ${dateLabel}.`
                );
            } else {
                await sendMessage(senderId,
                    `✅ UID ajouté dans ${nomFichier} !\n\n` +
                    `👤 UID : ${state.uid}\n` +
                    `📅 Expiration : ${dateLabel}\n\n` +
                    `L'utilisateur est maintenant ${typeAbonne}.`
                );
            }

            // Notifier l'utilisateur ajouté
            const msgUtilisateur = state.fichier === 'facebook'
                ? `🎉 Félicitations ! Vous avez été ajouté en tant qu'abonné.\n\n📅 Expiration : ${dateLabel}\n\nEnvoyez 'help' pour découvrir toutes les fonctionnalités.`
                : `🌟 Félicitations ! Vous avez été ajouté en tant qu'abonné VIP.\n\n📅 Expiration : ${dateLabel}\n\nEnvoyez 'help' pour découvrir toutes les fonctionnalités.`;

            try {
                await sendMessage(state.uid, msgUtilisateur);
            } catch (e) {
                await sendMessage(senderId,
                    `⚠️ UID ajouté mais impossible de notifier l'utilisateur ${state.uid} ` +
                    `(il n'a peut-être pas encore interagi avec le bot).`
                );
            }
            return;
        }

        // ── ÉTAPE 1 : L'admin tape "ajoute <uid>" ──
        if (!text) {
            await sendMessage(senderId,
                "📋 Utilisation de la commande ajoute :\n\n" +
                "ajoute <uid>\n\n" +
                "Exemple : ajoute 27482903718068344\n\n" +
                "Le bot vous demandera ensuite :\n" +
                "1. Le fichier cible (Facebook ou FacebookVip)\n" +
                "2. La date d'expiration"
            );
            return;
        }

        // Extraire l'UID (premier mot)
        const uid = text.split(/\s+/)[0];

        // Valider que c'est un UID numérique
        if (!/^\d+$/.test(uid)) {
            await sendMessage(senderId,
                `❌ UID invalide : "${uid}"\n\n` +
                `Un UID doit être un nombre entier.\nExemple : ajoute 27482903718068344`
            );
            return;
        }

        // Stocker l'état et poser la première question
        pendingAjouts.set(senderId, { uid, step: 'fichier' });

        await sendMessage(senderId,
            `📂 Dans quel fichier voulez-vous ajouter cet UID ?\n\n` +
            `👤 UID : ${uid}\n\n` +
            `Répondez :\n` +
            `• Facebook  — abonné normal (Facebook/uid.txt)\n` +
            `• FacebookVip  — abonné VIP (FacebookVip/uidvip.txt)\n` +
            `• stop  — annuler`
        );

    } catch (error) {
        console.error('Erreur dans la commande ajoute:', error);
        await sendMessage(senderId, "🚨 Une erreur s'est produite lors de l'exécution de la commande ajoute.");
    }
};

module.exports.info = {
    name: "ajoute",
    description: "Ajoute un UID dans Facebook/uid.txt ou FacebookVip/uidvip.txt (admin uniquement)",
    usage: "ajoute <uid>  →  le bot demande le fichier cible puis la date d'expiration"
};
