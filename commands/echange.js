

const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Fonction pour envoyer des messages longs en plusieurs parties
async function sendLongMessage(senderId, message) {
    const MAX_MESSAGE_LENGTH = 2000;

    if (message.length <= MAX_MESSAGE_LENGTH) {
        await sendMessage(senderId, message);
        return;
    }

    let startIndex = 0;
    let partNumber = 1;
    const totalParts = Math.ceil(message.length / MAX_MESSAGE_LENGTH);

    while (startIndex < message.length) {
        let endIndex = startIndex + MAX_MESSAGE_LENGTH;

        if (endIndex < message.length) {
            // Chercher le dernier séparateur avant la limite
            const separators = ['\n\n', '\n', ' ', ', ', ':', ';'];
            let bestBreakPoint = -1;

            for (const separator of separators) {
                const lastSeparator = message.lastIndexOf(separator, endIndex);
                if (lastSeparator > startIndex && (bestBreakPoint === -1 || lastSeparator > bestBreakPoint)) {
                    bestBreakPoint = lastSeparator + separator.length;
                }
            }

            if (bestBreakPoint !== -1) {
                endIndex = bestBreakPoint;
            }
        } else {
            endIndex = message.length;
        }

        let messagePart = message.substring(startIndex, endIndex);

        // Ajouter un indicateur de partie si le message est divisé
        if (totalParts > 1) {
            if (partNumber === 1) {
                messagePart = `${messagePart}\n\n📄 Partie ${partNumber}/${totalParts}`;
            } else {
                messagePart = `📄 Partie ${partNumber}/${totalParts}\n\n${messagePart}`;
            }
        }

        await sendMessage(senderId, messagePart);
        
        // Attendre 500ms entre chaque message pour éviter les limitations
        if (partNumber < totalParts) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        startIndex = endIndex;
        partNumber++;
    }
}

module.exports = async (senderId, args) => {
    try {
        // Devise par défaut : EUR
        const devise = args.trim().toUpperCase() || 'EUR';

        // Afficher un message de chargement
        await sendMessage(senderId, "🔄 Récupération des taux d'échange en cours...");

        // Appeler l'API
        const apiUrl = `https://taux-d-change-money.vercel.app/echange?taux=${devise}`;
        const response = await axios.get(apiUrl);
        const data = response.data;

        if (data.result === 'success') {
            const baseCode = data.base_code;
            const rates = data.conversion_rates;
            
            // Formater la date de mise à jour
            const lastUpdate = new Date(data.time_last_update_utc);
            const updateDate = lastUpdate.toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            // Construire le message complet avec TOUTES les devises
            let message = `🎉🌻 TAUX D'ÉCHANGE 👷📝\n\n`;
            message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
            message += `💱 Devise de base : ${baseCode}\n`;
            message += `📅 Mise à jour : ${updateDate}\n`;
            message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            
            message += `✨ TOUTES LES DEVISES DISPONIBLES :\n\n`;
            
            // Afficher TOUTES les devises
            const allCurrencies = Object.keys(rates).sort();
            allCurrencies.forEach(currency => {
                if (currency !== baseCode) {
                    const rate = rates[currency];
                    const formattedRate = rate.toFixed(4);
                    const flag = getCurrencyFlag(currency);
                    message += `${flag} ${currency} : ${formattedRate}\n`;
                }
            });

            message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
            message += `📊 1 ${baseCode} = X unités de devise\n`;
            message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            message += `💡 Pour changer la devise de base,\n`;
            message += `tapez : echange <CODE_DEVISE>\n`;
            message += `Exemple : echange USD\n\n`;
            message += `🌍 Total : ${Object.keys(rates).length} devises`;

            // Envoyer le message avec découpage automatique
            await sendLongMessage(senderId, message);

        } else {
            await sendMessage(senderId, "❌ Erreur lors de la récupération des taux d'échange. Veuillez réessayer plus tard.");
        }

    } catch (error) {
        console.error('Erreur lors de la récupération des taux d\'échange:', error);
        await sendMessage(senderId, "⚠️ Une erreur s'est produite lors de la récupération des taux d'échange. Vérifiez le code de devise et réessayez.");
    }
};

// Fonction pour obtenir les drapeaux emoji par devise
function getCurrencyFlag(currency) {
    const flags = {
        'USD': '🇺🇸', 'EUR': '🇪🇺', 'GBP': '🇬🇧', 'JPY': '🇯🇵', 'CHF': '🇨🇭',
        'CAD': '🇨🇦', 'AUD': '🇦🇺', 'CNY': '🇨🇳', 'INR': '🇮🇳', 'BRL': '🇧🇷',
        'ZAR': '🇿🇦', 'AED': '🇦🇪', 'MAD': '🇲🇦', 'MGA': '🇲🇬', 'RUB': '🇷🇺',
        'KRW': '🇰🇷', 'MXN': '🇲🇽', 'SGD': '🇸🇬', 'HKD': '🇭🇰', 'NOK': '🇳🇴',
        'SEK': '🇸🇪', 'DKK': '🇩🇰', 'PLN': '🇵🇱', 'THB': '🇹🇭', 'IDR': '🇮🇩',
        'HUF': '🇭🇺', 'CZK': '🇨🇿', 'ILS': '🇮🇱', 'CLP': '🇨🇱', 'PHP': '🇵🇭',
        'ARS': '🇦🇷', 'COP': '🇨🇴', 'SAR': '🇸🇦', 'MYR': '🇲🇾', 'RON': '🇷🇴',
        'TRY': '🇹🇷', 'NZD': '🇳🇿', 'VND': '🇻🇳', 'EGP': '🇪🇬', 'NGN': '🇳🇬',
        'PKR': '🇵🇰', 'BDT': '🇧🇩', 'UAH': '🇺🇦', 'AED': '🇦🇪', 'KES': '🇰🇪'
    };
    return flags[currency] || '💰';
}

// Ajouter les informations de la commande
module.exports.info = {
    name: "echange",
    description: "Affiche les taux d'échange de TOUTES les devises en temps réel pour une devise de base donnée.",
    usage: "Envoyez 'echange' pour EUR par défaut, ou 'echange <CODE_DEVISE>' pour une autre devise (ex: echange USD)"
};

