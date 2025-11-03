
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

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

            // Sélectionner les devises principales à afficher
            const mainCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY', 'INR', 'BRL', 'ZAR', 'AED', 'MAD', 'MGA'];
            
            let message = `🎉🌻 TAUX D'ÉCHANGE 👷📝\n\n`;
            message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
            message += `💱 Devise de base : ${baseCode}\n`;
            message += `📅 Mise à jour : ${updateDate}\n`;
            message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            
            message += `✨ PRINCIPALES DEVISES :\n\n`;
            
            // Afficher les devises principales
            mainCurrencies.forEach(currency => {
                if (rates[currency] && currency !== baseCode) {
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
            message += `🌍 Devises disponibles : ${Object.keys(rates).length} devises`;

            await sendMessage(senderId, message);

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
        'ARS': '🇦🇷', 'COP': '🇨🇴', 'SAR': '🇸🇦', 'MYR': '🇲🇾', 'RON': '🇷🇴'
    };
    return flags[currency] || '💰';
}

// Ajouter les informations de la commande
module.exports.info = {
    name: "echange",
    description: "Affiche les taux d'échange de devises en temps réel pour une devise de base donnée.",
    usage: "Envoyez 'echange' pour EUR par défaut, ou 'echange <CODE_DEVISE>' pour une autre devise (ex: echange USD)"
};
