/**
 * CONTRÔLE DU BOT
 * ===============
 * 
 * Ce fichier permet de contrôler le mode d'accès du bot.
 * 
 * MODE "activé" (true):
 *   - Seuls les utilisateurs abonnés (Facebook/uid.txt) et VIP (FacebookVip/uidvip.txt) 
 *     peuvent utiliser le bot.
 *   - C'est le mode par défaut actuel du bot.
 * 
 * MODE "désactivé" (false):
 *   - Tout le monde peut utiliser toutes les fonctionnalités du bot.
 *   - Aucune vérification d'abonnement n'est effectuée.
 * 
 * COMMENT CHANGER LE MODE:
 *   - Modifier la valeur de `modeRestreint` ci-dessous
 *   - true = activé (accès restreint aux abonnés)
 *   - false = désactivé (accès libre pour tous)
 */

const modeRestreint = false;  // Changer ici: true = activé, false = désactivé

module.exports = {
    modeRestreint,
    
    isAccessRestricted: function() {
        return modeRestreint;
    },
    
    getStatus: function() {
        return modeRestreint ? "activé" : "désactivé";
    },
    
    getDescription: function() {
        if (modeRestreint) {
            return "Mode ACTIVÉ: Seuls les abonnés Facebook/ et FacebookVip/ peuvent utiliser le bot.";
        } else {
            return "Mode DÉSACTIVÉ: Tout le monde peut utiliser toutes les fonctionnalités du bot.";
        }
    }
};
