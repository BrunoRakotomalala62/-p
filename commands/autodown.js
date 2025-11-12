const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Regex pour détecter les URLs de réseaux sociaux de manière robuste
// Supporte http/https, www/m/vt/vm, majuscules/minuscules
const SOCIAL_MEDIA_REGEX = /(?:https?:\/\/)?(?:www\.|m\.|vt\.|vm\.)?(?:tiktok\.com|facebook\.com|fb\.watch|instagram\.com|x\.com|twitter\.com)\/[^\s]*/gi;

module.exports = async (senderId, userText, api) => {
    try {
        const text = userText.trim();
        
        // Si la commande est appelée sans argument, afficher l'aide
        if (!text || text === '') {
            await sendMessage(senderId, 
                "📥 *AUTODOWN - Téléchargeur automatique*\n\n" +
                "Envoyez simplement un lien TikTok, Facebook, Instagram ou X (Twitter), et je téléchargerai le contenu pour vous!\n\n" +
                "✅ *Plateformes supportées:*\n" +
                "• TikTok (vt.tiktok.com, vm.tiktok.com, www.tiktok.com)\n" +
                "• Facebook (www.facebook.com, fb.watch)\n" +
                "• Instagram (www.instagram.com)\n" +
                "• X/Twitter (x.com, twitter.com)\n\n" +
                "💡 *Astuce:* Copiez simplement le lien et envoyez-le!"
            );
            return;
        }

        // Vérifier si le texte contient un lien de réseau social supporté
        const socialMediaMatches = text.match(SOCIAL_MEDIA_REGEX);
        
        if (!socialMediaMatches || socialMediaMatches.length === 0) {
            // Si pas de lien détecté, afficher un message d'aide
            await sendMessage(senderId, 
                "❌ Aucun lien de réseau social détecté.\n\n" +
                "Veuillez envoyer un lien valide de TikTok, Facebook, Instagram ou X (Twitter).\n\n" +
                "✅ *Formats acceptés:*\n" +
                "• http:// ou https://\n" +
                "• Avec ou sans www/m/vt/vm\n" +
                "• Majuscules ou minuscules"
            );
            return;
        }
        
        // Utiliser le premier lien détecté
        const detectedUrl = socialMediaMatches[0];
        
        // Normaliser l'URL (ajouter https:// si manquant)
        let normalizedUrl = detectedUrl;
        if (!normalizedUrl.match(/^https?:\/\//i)) {
            normalizedUrl = 'https://' + normalizedUrl;
        }

        // Envoyer un message de traitement
        await sendMessage(senderId, "⏳ Téléchargement en cours... Veuillez patienter.");

        // Appeler l'API de téléchargement avec l'URL normalisée
        const apiUrl = `https://buda-juoe.onrender.com/downr?url=${encodeURIComponent(normalizedUrl)}`;
        const response = await axios.get(apiUrl, { 
            timeout: 30000,
            maxContentLength: 100 * 1024 * 1024, // Limite de 100MB pour la réponse
            validateStatus: function (status) {
                return status >= 200 && status < 500; // Accepter les erreurs pour les gérer
            }
        });
        const apiData = response.data;

        // Vérifier si l'API a retourné une erreur
        if (!apiData || apiData.error || !apiData.medias) {
            await sendMessage(senderId, 
                "❌ Impossible de télécharger le contenu.\n\n" +
                "Raisons possibles:\n" +
                "• Le lien est invalide ou privé\n" +
                "• Le serveur de téléchargement est temporairement indisponible\n" +
                "• Le contenu n'est plus disponible\n\n" +
                "Veuillez vérifier le lien et réessayer."
            );
            return;
        }

        const { title = 'Sans titre', author = 'Inconnu', medias = [] } = apiData;

        // Filtrer les images et vidéos
        const images = medias.filter(m => m.type === "image" || m.type === "photo");
        const video = 
            medias.find(m => m.type === "video" && m.quality === "hd_no_watermark") ||
            medias.find(m => m.type === "video" && m.quality === "hd") ||
            medias.find(m => m.type === "video");

        // Créer un message de caption
        const caption = `📜 *${title}*\n👤 Auteur: ${author}`;

        // Validation basique des URLs de médias avant envoi
        const validateMediaUrl = (url) => {
            try {
                const parsedUrl = new URL(url);
                // Vérifier que c'est bien http ou https
                return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
            } catch {
                return false;
            }
        };

        // Envoyer le contenu
        if (images.length > 0) {
            // Envoyer d'abord le caption
            await sendMessage(senderId, caption);
            
            // Limiter à 10 images maximum pour éviter le spam
            const imagesToSend = images.slice(0, 10);
            
            // Envoyer chaque image séparément après validation
            for (const img of imagesToSend) {
                if (validateMediaUrl(img.url)) {
                    await sendMessage(senderId, {
                        attachment: {
                            type: "image",
                            payload: {
                                url: img.url,
                                is_reusable: true
                            }
                        }
                    });
                    // Petit délai pour éviter le rate limiting
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            
            if (images.length > 10) {
                await sendMessage(senderId, `ℹ️ ${images.length - 10} image(s) supplémentaire(s) non affichée(s) (limite: 10).`);
            }
        } else if (video) {
            // Valider l'URL de la vidéo
            if (!validateMediaUrl(video.url)) {
                await sendMessage(senderId, "❌ URL de vidéo invalide. Impossible de télécharger.");
                return;
            }
            
            // Envoyer d'abord le caption
            await sendMessage(senderId, caption);
            
            // Envoyer la vidéo
            await sendMessage(senderId, {
                attachment: {
                    type: "video",
                    payload: {
                        url: video.url,
                        is_reusable: true
                    }
                }
            });
        } else {
            await sendMessage(senderId, 
                "❌ Aucun contenu téléchargeable trouvé.\n\n" +
                "Le lien ne contient peut-être pas de vidéo ou d'image, ou le format n'est pas supporté."
            );
        }

    } catch (error) {
        console.error('Erreur dans autodown:', error.message || error);
        
        // Message d'erreur plus détaillé pour le débogage
        let errorMessage = "⚠️ Une erreur s'est produite lors du téléchargement.\n\n";
        
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            errorMessage += "Le serveur met trop de temps à répondre. Veuillez réessayer dans quelques instants.";
        } else if (error.response && error.response.status === 404) {
            errorMessage += "Le contenu demandé n'a pas été trouvé. Vérifiez que le lien est correct.";
        } else if (error.response && error.response.status >= 500) {
            errorMessage += "Le serveur de téléchargement rencontre des problèmes. Veuillez réessayer plus tard.";
        } else {
            errorMessage += "Veuillez vérifier le lien et réessayer.";
        }
        
        await sendMessage(senderId, errorMessage);
    }
};

// Informations de la commande
module.exports.info = {
    name: "autodown",
    description: "Télécharge automatiquement des vidéos et images depuis TikTok, Facebook, Instagram et X (Twitter).",
    usage: "Envoyez 'autodown <lien>' ou simplement le lien directement."
};
