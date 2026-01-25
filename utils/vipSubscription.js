const fs = require('fs-extra');
const path = require('path');

// Chemin vers le fichier des UIDs VIP
const vipUidFilePath = path.join(__dirname, '../FacebookVip/uidvip.txt');

// S'assurer que le dossier existe
if (!fs.existsSync(path.dirname(vipUidFilePath))) {
    fs.mkdirSync(path.dirname(vipUidFilePath), { recursive: true });
}

// S'assurer que le fichier existe
if (!fs.existsSync(vipUidFilePath)) {
    fs.writeFileSync(vipUidFilePath, '# Liste des UIDs des utilisateurs VIP\n# Format: UID|Date d\'expiration (YYYY-MM-DD)\n# Les administrateurs ont automatiquement accès aux commandes VIP\n');
}

// Importer les IDs administrateurs (même liste que dans subscription.js)
const ADMIN_IDS = ['5986125634817413'];

/**
 * Vérifie si un utilisateur est VIP
 * @param {string} uid - L'UID de l'utilisateur
 * @returns {Object} - Statut VIP (isVIP, expirationDate, isAdmin)
 */
function checkVIPStatus(uid) {
    try {
        // Les administrateurs ont toujours accès VIP
        if (ADMIN_IDS.includes(uid)) {
            return {
                isVIP: true,
                isAdmin: true,
                expirationDate: "9999-12-31",
                daysLeft: 9999
            };
        }
        
        const content = fs.readFileSync(vipUidFilePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        
        for (const line of lines) {
            const [vipUid, expirationDate] = line.split('|');
            if (vipUid.trim() === uid) {
                const isValid = new Date(expirationDate) > new Date();
                return {
                    isVIP: isValid,
                    expirationDate: expirationDate,
                    daysLeft: isValid ? Math.ceil((new Date(expirationDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0
                };
            }
        }
        return { isVIP: false };
    } catch (error) {
        console.error('Erreur lors de la vérification du statut VIP:', error);
        return { isVIP: false, error: true };
    }
}

/**
 * Ajoute ou met à jour un abonnement VIP
 * @param {string} uid - L'UID de l'utilisateur
 * @param {number|string} monthsOrDate - Nombre de mois d'abonnement VIP ou date directe
 * @returns {boolean} - Succès de l'opération
 */
function addVIPSubscription(uid, monthsOrDate = 1) {
    try {
        const content = fs.readFileSync(vipUidFilePath, 'utf8');
        const lines = content.split('\n');
        const newLines = [];
        
        let formattedDate;
        
        // Vérifier si c'est une date directe ou un nombre de mois
        if (typeof monthsOrDate === 'string' && monthsOrDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            formattedDate = monthsOrDate;
        } else {
            const months = parseInt(monthsOrDate) || 1;
            
            const currentVIP = checkVIPStatus(uid);
            let expirationDate;
            
            if (currentVIP.isVIP && !currentVIP.isAdmin) {
                expirationDate = new Date(currentVIP.expirationDate);
                expirationDate.setMonth(expirationDate.getMonth() + months);
            } else {
                expirationDate = new Date();
                expirationDate.setMonth(expirationDate.getMonth() + months);
            }
            
            formattedDate = expirationDate.toISOString().split('T')[0];
        }
        
        let found = false;
        for (const line of lines) {
            if (line.trim() && !line.startsWith('#')) {
                const [vipUid] = line.split('|');
                if (vipUid.trim() === uid) {
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
        
        fs.writeFileSync(vipUidFilePath, newLines.join('\n'));
        return true;
    } catch (error) {
        console.error('Erreur lors de l\'ajout de l\'abonnement VIP:', error);
        return false;
    }
}

/**
 * Supprime un abonnement VIP
 * @param {string} uid - L'UID de l'utilisateur
 * @returns {boolean} - Succès de l'opération
 */
function removeVIPSubscription(uid) {
    try {
        const content = fs.readFileSync(vipUidFilePath, 'utf8');
        const lines = content.split('\n');
        const newLines = lines.filter(line => {
            if (line.trim() && !line.startsWith('#')) {
                const [vipUid] = line.split('|');
                return vipUid.trim() !== uid;
            }
            return true;
        });
        
        fs.writeFileSync(vipUidFilePath, newLines.join('\n'));
        return true;
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'abonnement VIP:', error);
        return false;
    }
}

/**
 * Liste tous les utilisateurs VIP
 * @returns {Array} - Liste des utilisateurs VIP avec leurs dates d'expiration
 */
function listVIPUsers() {
    try {
        const content = fs.readFileSync(vipUidFilePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        
        return lines.map(line => {
            const [uid, expirationDate] = line.split('|');
            const isValid = new Date(expirationDate) > new Date();
            return {
                uid: uid.trim(),
                expirationDate: expirationDate,
                isActive: isValid,
                daysLeft: isValid ? Math.ceil((new Date(expirationDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0
            };
        });
    } catch (error) {
        console.error('Erreur lors de la liste des utilisateurs VIP:', error);
        return [];
    }
}

module.exports = {
    checkVIPStatus,
    addVIPSubscription,
    removeVIPSubscription,
    listVIPUsers,
    ADMIN_IDS
};
