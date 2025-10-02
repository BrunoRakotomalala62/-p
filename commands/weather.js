
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');
const moment = require('moment-timezone');

// API Key pour OpenWeatherMap (à remplacer par la vôtre)
const OPEN_WEATHER_API_KEY = "081c82065cfee62cb7988ddf90914bdd";

module.exports = async (senderId, prompt, api) => {
    try {
        // Si le prompt est vide (commande 'weather' sans texte)
        if (!prompt || prompt.trim() === '') {
            await sendMessage(senderId, "🌦️ *MÉTÉO* 🌦️\n\nVeuillez entrer une ville ou un lieu.\n\nExemple: weather Paris\nou: weather Antananarivo");
            return;
        }

        // Envoyer un message d'attente stylisé
        await sendMessage(senderId, "🌦️ Recherche des informations météorologiques... ⏳");

        // Déterminer la ville à partir du prompt
        const city = prompt.trim();

        // Appel à l'API OpenWeatherMap
        const response = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${OPEN_WEATHER_API_KEY}&units=metric&lang=fr`
        );

        const weatherData = response.data;

        // Calculer le lever et le coucher du soleil
        const sunrise = moment.unix(weatherData.sys.sunrise).tz("Indian/Antananarivo");
        const sunset = moment.unix(weatherData.sys.sunset).tz("Indian/Antananarivo");

        // Description du temps en français
        const weatherDescription = weatherData.weather[0].description.charAt(0).toUpperCase() + weatherData.weather[0].description.slice(1);

        // Créer une réponse formatée et stylisée
        const formattedReply = `
✅ EDUCATION AMPINGA D'OR 🇲🇬
━━━━━━━━━━━━━━━━━━━━━━━━━━
🌦️ *MÉTÉO À ${city.toUpperCase()}* 🌦️

🌡️ Température: ${Math.round(weatherData.main.temp)}°C
🌡️ Ressenti: ${Math.round(weatherData.main.feels_like)}°C
☁️ Conditions: ${weatherDescription}
💧 Humidité: ${weatherData.main.humidity}%
💨 Vent: ${Math.round(weatherData.wind.speed * 3.6)} km/h
🌅 Lever du soleil: ${sunrise.format('HH:mm')}
🌇 Coucher du soleil: ${sunset.format('HH:mm')}
🌍 Pays: ${weatherData.sys.country}
━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 Powered by 👉@Bruno | ❤️AMPING D'OR❤️
`;

        // Envoyer la réponse formatée
        await sendMessage(senderId, formattedReply);

    } catch (error) {
        console.error("Erreur lors de la récupération des données météo:", error);
        
        // Vérifier si l'erreur est due à une ville non trouvée
        if (error.response && error.response.status === 404) {
            await sendMessage(senderId, `
⚠️ *ERREUR* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
Impossible de trouver "${prompt}".
Veuillez vérifier l'orthographe ou essayer une autre ville.
━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
        } else {
            // Message d'erreur général stylisé
            await sendMessage(senderId, `
⚠️ *ERREUR* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━
Une erreur s'est produite lors de la récupération des données météorologiques.
Veuillez réessayer plus tard.
━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
        }
    }
    
    return { skipCommandCheck: true };
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "weather",
    description: "Affiche les informations météorologiques pour une ville ou un lieu spécifique.",
    usage: "Envoyez 'weather <nom de la ville>' pour obtenir les informations météorologiques actuelles."
};
