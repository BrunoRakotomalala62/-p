
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Base URL de l'API
const BASE_API_URL = 'https://zaikyoov3-up.up.railway.app/api/liquidlfm';

module.exports = async (senderId, userText) => {
    // Extraire le prompt en retirant le préfixe 'liquid' et en supprimant les espaces superflus
    const prompt = userText.slice(6).trim();

    // Vérifier si le prompt est vide
    if (!prompt) {
        await sendMessage(senderId, '⚠️ Veuillez fournir une équation ou un problème à résoudre.\n\nExemple: `liquid résoudre 4x-8=0`');
        return;
    }

    try {
        // Créer un ID de session unique basé sur l'ID de l'utilisateur
        const sessionId = senderId;

        // Envoyer un message d'attente avec animation
        await sendMessage(senderId, "🔍 Analyse en cours...\n⏳ Veuillez patienter quelques instants...");

        // Appeler l'API avec le prompt fourni
        const apiUrl = `${BASE_API_URL}?prompt=${encodeURIComponent(prompt)}&uid=${sessionId}`;
        const response = await axios.get(apiUrl);

        // Récupérer la réponse de l'API
        const { reply, author } = response.data;

        // Formater la réponse avec une décoration élégante
        const formattedReply = formatReply(reply, prompt);

        // Envoyer la réponse formatée à l'utilisateur
        await sendMessage(senderId, formattedReply);
    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API Liquid:', error);

        // Envoyer un message d'erreur décoré à l'utilisateur
        await sendMessage(senderId, `❌ *ERREUR DE CONNEXION* ❌\n\n⚠️ Désolé, je n'ai pas pu traiter votre demande en raison d'un problème technique.\n\n🔄 Veuillez réessayer dans quelques instants ou contacter l'administrateur si le problème persiste.`);
    }
};

/**
 * Formate la réponse avec une décoration élégante
 * @param {string} reply - La réponse brute de l'API
 * @param {string} prompt - La question de l'utilisateur
 * @returns {string} - La réponse formatée
 */
function formatReply(reply, prompt) {
    // Nettoyer la syntaxe LaTeX
    let cleanedReply = cleanLatexSyntax(reply);

    // Obtenir la date et l'heure actuelles à Madagascar (GMT+3)
    const date = new Date();
    // Ajuster à l'heure de Madagascar (GMT+3)
    date.setHours(date.getHours() + 3);
    
    const formattedDate = date.toLocaleString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Etc/GMT-3'
    });

    // Créer la réponse formatée
    return `🌴 BOT LIQUIDE 🏡
--------------------------------

${cleanedReply}

Auteur: ✅Bruno Rakotomalala 👈
${formattedDate} (Heure de Madagascar)`;
}

/**
 * Nettoie la syntaxe LaTeX pour un affichage plus propre
 * @param {string} text - Le texte à nettoyer
 * @returns {string} - Le texte nettoyé
 */
function cleanLatexSyntax(text) {
    return text
        // Supprimer les commandes LaTeX comme \( et \)
        .replace(/\\\(|\\\\\(|\\\\\\\(/g, "")
        .replace(/\\\)|\\\\\)|\\\\\\\)/g, "")
        // Remplacer les fractions
        .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "$1/$2")
        // Remplacer les commandes LaTeX comme \implies, \boxed, etc.
        .replace(/\\implies/g, "=>")
        .replace(/\\boxed\{([^{}]+)\}/g, "[$1]")
        .replace(/\\[a-zA-Z]+/g, "")
        // Remplacer les doubles backslashes
        .replace(/\\\\/g, "")
        // Nettoyer les accolades
        .replace(/\{|\}/g, "")
        // Remplacer d'autres notations mathématiques
        .replace(/\\quad/g, " ")
        .replace(/\\cdot/g, "×")
        .replace(/\\times/g, "×")
        .replace(/\\div/g, "÷")
        // Remplacer les expressions comme \text{...} par leur contenu
        .replace(/\\text\{([^{}]+)\}/g, "$1")
        // Nettoyer les expressions avec \equiv et \pmod
        .replace(/\\equiv[^\\]*\\pmod\{([^{}]+)\}/g, "≡ (mod $1)")
        // Nettoyer les mathématiques restantes
        .replace(/\\[a-zA-Z]+\{([^{}]+)\}/g, "$1");
}

// Ajouter les informations de la commande
module.exports.info = {
    name: "liquid",
    description: "Résout des problèmes mathématiques et équations via l'API Liquid.",
    usage: "Envoyez 'liquid <votre problème>' pour obtenir une solution détaillée et formatée."
};
