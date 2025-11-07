
const fs = require('fs-extra');
const path = require('path');

// Chemin vers le fichier des UIDs
const uidFilePath = path.join(__dirname, '../Facebook/uid.txt');

// S'assurer que le dossier existe
if (!fs.existsSync(path.dirname(uidFilePath))) {
    fs.mkdirSync(path.dirname(uidFilePath), { recursive: true });
}

// S'assurer que le fichier existe
if (!fs.existsSync(uidFilePath)) {
    fs.writeFileSync(uidFilePath, '# Liste des UIDs des utilisateurs abonnés\n# Format: UID|Date d\'expiration (YYYY-MM-DD)\n');
}

// Importer les IDs administrateurs
const ADMIN_IDS = ['5986125634817413']; // Même liste que dans admin.js

/**
 * Vérifie si un utilisateur est abonné
 * @param {string} uid - L'UID de l'utilisateur
 * @returns {Object} - Statut de l'abonnement (isSubscribed, expirationDate)
 */
function checkSubscription(uid) {
    try {
        // Vérifier si l'utilisateur est un administrateur
        if (ADMIN_IDS.includes(uid)) {
            return {
                isSubscribed: true,
                isAdmin: true,
                expirationDate: "9999-12-31", // Date d'expiration fictive très lointaine
                daysLeft: 9999 // Nombre élevé de jours
            };
        }
        
        const content = fs.readFileSync(uidFilePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        
        for (const line of lines) {
            const [subscriberUid, expirationDate] = line.split('|');
            if (subscriberUid.trim() === uid) {
                const isValid = new Date(expirationDate) > new Date();
                return {
                    isSubscribed: isValid,
                    expirationDate: expirationDate,
                    daysLeft: isValid ? Math.ceil((new Date(expirationDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0
                };
            }
        }
        return { isSubscribed: false };
    } catch (error) {
        console.error('Erreur lors de la vérification de l\'abonnement:', error);
        return { isSubscribed: false, error: true };
    }
}

/**
 * Ajoute ou met à jour un abonnement
 * @param {string} uid - L'UID de l'utilisateur
 * @param {number|string} monthsOrDate - Nombre de mois d'abonnement à ajouter ou date directe au format YYYY-MM-DD
 * @returns {boolean} - Succès de l'opération
 */
function addSubscription(uid, monthsOrDate = 1) {
    try {
        const content = fs.readFileSync(uidFilePath, 'utf8');
        const lines = content.split('\n');
        const newLines = [];
        
        let formattedDate;
        
        // Vérifier si c'est une date directe ou un nombre de mois
        if (typeof monthsOrDate === 'string' && monthsOrDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // C'est une date au format YYYY-MM-DD
            formattedDate = monthsOrDate;
        } else {
            // C'est un nombre de mois
            const months = parseInt(monthsOrDate) || 1;
            
            // Calculer la nouvelle date d'expiration
            const currentSub = checkSubscription(uid);
            let expirationDate;
            
            if (currentSub.isSubscribed) {
                // Prolonger l'abonnement existant
                expirationDate = new Date(currentSub.expirationDate);
                expirationDate.setMonth(expirationDate.getMonth() + months);
            } else {
                // Nouvel abonnement
                expirationDate = new Date();
                expirationDate.setMonth(expirationDate.getMonth() + months);
            }
            
            // Format YYYY-MM-DD
            formattedDate = expirationDate.toISOString().split('T')[0];
        }
        
        // Rechercher et mettre à jour l'entrée existante ou ajouter une nouvelle
        let found = false;
        for (const line of lines) {
            if (line.trim() && !line.startsWith('#')) {
                const [subscriberUid] = line.split('|');
                if (subscriberUid.trim() === uid) {
                    newLines.push(`${uid}|${formattedDate}`);
                    found = true;
                } else {
                    newLines.push(line);
                }
            } else {
                newLines.push(line);
            }
        }
        
        if (!found) {
            newLines.push(`${uid}|${formattedDate}`);
        }
        
        fs.writeFileSync(uidFilePath, newLines.join('\n'));
        return true;
    } catch (error) {
        console.error('Erreur lors de l\'ajout de l\'abonnement:', error);
        return false;
    }
}

/**
 * Supprime un abonnement
 * @param {string} uid - L'UID de l'utilisateur
 * @returns {boolean} - Succès de l'opération
 */
function removeSubscription(uid) {
    try {
        const content = fs.readFileSync(uidFilePath, 'utf8');
        const lines = content.split('\n');
        const newLines = lines.filter(line => {
            if (line.trim() && !line.startsWith('#')) {
                const [subscriberUid] = line.split('|');
                return subscriberUid.trim() !== uid;
            }
            return true;
        });
        
        fs.writeFileSync(uidFilePath, newLines.join('\n'));
        return true;
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'abonnement:', error);
        return false;
    }
}

module.exports = {
    checkSubscription,
    addSubscription,
    removeSubscription
};
