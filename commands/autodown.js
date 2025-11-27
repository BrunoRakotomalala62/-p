const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const FACEBOOK_REGEX = /(?:https?:\/\/)?(?:www\.|m\.|web\.)?(?:facebook\.com|fb\.watch|fb\.com)(?:\/[^\s]*)?/gi;
const TIKTOK_REGEX = /(?:https?:\/\/)?(?:www\.|m\.|vt\.|vm\.)?tiktok\.com(?:\/[^\s]*)?/gi;
const INSTAGRAM_REGEX = /(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com(?:\/[^\s]*)?/gi;
const TWITTER_REGEX = /(?:https?:\/\/)?(?:www\.|m\.)?(?:x\.com|twitter\.com)(?:\/[^\s]*)?/gi;

const FACEBOOK_BROKEN_REGEX = /(?:https?\s*:\s*\/\s*\/\s*)?(?:www\s*\.\s*|m\s*\.\s*|web\s*\.\s*)?(?:facebook\s*\.\s*com|fb\s*\.\s*watch|fb\s*\.\s*com)(?:\s*\/\s*[^\s]*)?/gi;
const FACEBOOK_SHARE_REGEX = /(?:share\s*\/\s*r\s*\/\s*)([a-zA-Z0-9]+)/gi;

const userStates = {};

const QUALITY_OPTIONS = ['360p', '480p', '720p', '1080p'];

function reconstructFacebookUrl(brokenUrl) {
    let url = brokenUrl.replace(/\s+/g, '');
    
    if (!url.match(/^https?:\/\//i)) {
        url = 'https://' + url;
    }
    
    url = url.replace(/https?:\/\//i, 'https://');
    
    return url;
}

function extractShareId(text) {
    const cleanText = text.replace(/\s+/g, '');
    const shareMatch = cleanText.match(/share\/r\/([a-zA-Z0-9]+)/i);
    if (shareMatch) {
        return `https://www.facebook.com/share/r/${shareMatch[1]}/`;
    }
    return null;
}

module.exports = async (senderId, userText, api) => {
    try {
        const text = userText.trim();
        
        if (userStates[senderId] && userStates[senderId].awaitingQuality) {
            const selectedQuality = text.toLowerCase();
            
            if (QUALITY_OPTIONS.includes(selectedQuality)) {
                const fbUrl = userStates[senderId].fbUrl;
                delete userStates[senderId];
                
                await processVideoDownload(senderId, fbUrl, selectedQuality);
                return;
            } else {
                await sendMessage(senderId, 
                    "❌ Qualité invalide.\n\n" +
                    "📺 Veuillez choisir une qualité parmi:\n" +
                    "• 360p (basse qualité, petit fichier)\n" +
                    "• 480p (qualité moyenne)\n" +
                    "• 720p (HD)\n" +
                    "• 1080p (Full HD, gros fichier)\n\n" +
                    "💡 Tapez simplement: 360p, 480p, 720p ou 1080p"
                );
                return;
            }
        }
        
        if (!text || text === '') {
            await sendMessage(senderId, 
                "📥 *AUTODOWN - Téléchargeur automatique*\n\n" +
                "Envoyez simplement un lien TikTok, Facebook, Instagram ou X (Twitter), et je téléchargerai le contenu pour vous!\n\n" +
                "✅ *Plateformes supportées:*\n" +
                "• TikTok (vt.tiktok.com, vm.tiktok.com, www.tiktok.com)\n" +
                "• Facebook (www.facebook.com, fb.watch)\n" +
                "• Instagram (www.instagram.com)\n" +
                "• X/Twitter (x.com, twitter.com)\n\n" +
                "⚠️ *Si Messenger bloque votre lien Facebook:*\n" +
                "Ajoutez des espaces dans le lien, exemple:\n" +
                "facebook .com/share/r/ABC123\n" +
                "Ou envoyez juste: share/r/ABC123\n\n" +
                "💡 *Astuce:* Copiez simplement le lien et envoyez-le!"
            );
            return;
        }

        let fbUrl = null;
        
        const facebookMatches = text.match(FACEBOOK_REGEX);
        if (facebookMatches && facebookMatches.length > 0) {
            fbUrl = facebookMatches[0];
            if (!fbUrl.match(/^https?:\/\//i)) {
                fbUrl = 'https://' + fbUrl;
            }
        }
        
        if (!fbUrl) {
            const shareUrl = extractShareId(text);
            if (shareUrl) {
                fbUrl = shareUrl;
            }
        }
        
        if (!fbUrl) {
            const brokenMatches = text.match(FACEBOOK_BROKEN_REGEX);
            if (brokenMatches && brokenMatches.length > 0) {
                fbUrl = reconstructFacebookUrl(brokenMatches[0]);
            }
        }
        
        if (!fbUrl && (text.toLowerCase().includes('facebook') || text.toLowerCase().includes('fb.') || text.includes('share/r/'))) {
            fbUrl = reconstructFacebookUrl(text);
            if (!fbUrl.includes('facebook.com') && !fbUrl.includes('fb.')) {
                fbUrl = null;
            }
        }
        
        if (fbUrl) {
            userStates[senderId] = {
                awaitingQuality: true,
                fbUrl: fbUrl,
                timestamp: Date.now()
            };
            
            await sendMessage(senderId, 
                "🎬 *Lien Facebook détecté!*\n\n" +
                "📺 Choisissez la qualité de la vidéo:\n\n" +
                "• *360p* - Basse qualité (petit fichier)\n" +
                "• *480p* - Qualité moyenne\n" +
                "• *720p* - HD (recommandé)\n" +
                "• *1080p* - Full HD (gros fichier)\n\n" +
                "💡 Tapez simplement: 360p, 480p, 720p ou 1080p"
            );
            return;
        }
        
        const tiktokMatches = text.match(TIKTOK_REGEX);
        const instagramMatches = text.match(INSTAGRAM_REGEX);
        const twitterMatches = text.match(TWITTER_REGEX);
        
        const socialMediaUrl = tiktokMatches?.[0] || instagramMatches?.[0] || twitterMatches?.[0];
        
        if (socialMediaUrl) {
            let normalizedUrl = socialMediaUrl;
            if (!normalizedUrl.match(/^https?:\/\//i)) {
                normalizedUrl = 'https://' + normalizedUrl;
            }
            
            await processOtherPlatforms(senderId, normalizedUrl);
            return;
        }
        
        await sendMessage(senderId, 
            "❌ Aucun lien de réseau social détecté.\n\n" +
            "Veuillez envoyer un lien valide de TikTok, Facebook, Instagram ou X (Twitter).\n\n" +
            "✅ *Formats acceptés:*\n" +
            "• http:// ou https://\n" +
            "• Avec ou sans www/m/vt/vm\n" +
            "• Majuscules ou minuscules"
        );

    } catch (error) {
        console.error('Erreur dans autodown:', error.message || error);
        await sendMessage(senderId, "⚠️ Une erreur s'est produite. Veuillez réessayer.");
    }
};

async function processVideoDownload(senderId, fbUrl, quality) {
    try {
        await sendMessage(senderId, `⏳ Téléchargement en cours en qualité ${quality}... Veuillez patienter.`);

        const apiUrl = `https://download-facebook-video.vercel.app/download?fb_url=${encodeURIComponent(fbUrl)}&qualite=${quality}`;
        
        const response = await axios.get(apiUrl, { 
            timeout: 180000,
            validateStatus: function (status) {
                return status >= 200 && status < 500;
            }
        });
        
        const apiData = response.data;

        if (!apiData || apiData.error) {
            await sendMessage(senderId, 
                "❌ Impossible de télécharger la vidéo.\n\n" +
                "Raisons possibles:\n" +
                "• Le lien est invalide ou privé\n" +
                "• La qualité demandée n'est pas disponible\n" +
                "• Le serveur est temporairement indisponible\n\n" +
                "Veuillez vérifier le lien et réessayer."
            );
            return;
        }

        const videoUrl = apiData.url || apiData.download_url || apiData.video_url || apiData.link;
        const videoSize = apiData.size || apiData.file_size || null;
        
        if (!videoUrl) {
            await sendMessage(senderId, "❌ Aucune URL de téléchargement trouvée. Essayez une autre qualité.");
            return;
        }

        let fileSizeInMB = null;
        
        if (videoSize) {
            if (typeof videoSize === 'string') {
                const sizeMatch = videoSize.match(/(\d+(?:\.\d+)?)\s*(MB|Mo|KB|Ko|GB|Go)/i);
                if (sizeMatch) {
                    const value = parseFloat(sizeMatch[1]);
                    const unit = sizeMatch[2].toUpperCase();
                    if (unit === 'MB' || unit === 'MO') {
                        fileSizeInMB = value;
                    } else if (unit === 'KB' || unit === 'KO') {
                        fileSizeInMB = value / 1024;
                    } else if (unit === 'GB' || unit === 'GO') {
                        fileSizeInMB = value * 1024;
                    }
                }
            } else if (typeof videoSize === 'number') {
                fileSizeInMB = videoSize / (1024 * 1024);
            }
        }
        
        if (fileSizeInMB === null) {
            try {
                const headResponse = await axios.head(videoUrl, { timeout: 10000 });
                const contentLength = headResponse.headers['content-length'];
                if (contentLength) {
                    fileSizeInMB = parseInt(contentLength) / (1024 * 1024);
                }
            } catch (headError) {
                console.log('Impossible de récupérer la taille du fichier via HEAD:', headError.message);
            }
        }

        const MAX_SIZE_MB = 25;
        
        if (fileSizeInMB !== null && fileSizeInMB > MAX_SIZE_MB) {
            const sizeDisplay = fileSizeInMB.toFixed(2);
            await sendMessage(senderId, 
                `📹 *Vidéo Facebook - ${quality}*\n\n` +
                `📦 Taille: ${sizeDisplay} Mo (supérieur à 25Mo)\n\n` +
                `📥 La vidéo est trop volumineuse pour être envoyée directement.\n` +
                `Cliquez sur le lien ci-dessous pour télécharger:\n\n` +
                `🔗 ${videoUrl}`
            );
        } else {
            const sizeInfo = fileSizeInMB !== null ? ` (${fileSizeInMB.toFixed(2)} Mo)` : '';
            await sendMessage(senderId, `📹 *Vidéo Facebook - ${quality}*${sizeInfo}\n\n⬇️ Envoi de la vidéo...`);
            
            await sendMessage(senderId, {
                attachment: {
                    type: "video",
                    payload: {
                        url: videoUrl,
                        is_reusable: true
                    }
                }
            });
            
            await sendMessage(senderId, "✅ Vidéo envoyée avec succès!");
        }

    } catch (error) {
        console.error('Erreur lors du téléchargement Facebook:', error.message || error);
        
        let errorMessage = "⚠️ Une erreur s'est produite lors du téléchargement.\n\n";
        
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            errorMessage += "⏱️ Le serveur met trop de temps à répondre.\n\n" +
                "💡 Suggestions:\n" +
                "• Réessayez dans quelques instants\n" +
                "• Essayez une qualité inférieure (360p ou 480p)";
        } else {
            errorMessage += "Veuillez vérifier le lien et réessayer.";
        }
        
        await sendMessage(senderId, errorMessage);
    }
}

async function processOtherPlatforms(senderId, url) {
    try {
        await sendMessage(senderId, "⏳ Téléchargement en cours... Veuillez patienter.\n💡 Les vidéos longues peuvent prendre 1-3 minutes.");

        const reminderTimeout = setTimeout(async () => {
            await sendMessage(senderId, "⏳ Téléchargement toujours en cours... La vidéo sera bientôt prête!");
        }, 60000);

        const apiUrl = `https://buda-juoe.onrender.com/downr?url=${encodeURIComponent(url)}`;
        const response = await axios.get(apiUrl, { 
            timeout: 180000,
            maxContentLength: 200 * 1024 * 1024,
            validateStatus: function (status) {
                return status >= 200 && status < 500;
            }
        });
        
        clearTimeout(reminderTimeout);
        
        const apiData = response.data;

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

        const images = medias.filter(m => m.type === "image" || m.type === "photo");
        const video = 
            medias.find(m => m.type === "video" && m.quality === "hd_no_watermark") ||
            medias.find(m => m.type === "video" && m.quality === "hd") ||
            medias.find(m => m.type === "video");

        const caption = `📜 *${title}*\n👤 Auteur: ${author}`;

        const validateMediaUrl = (url) => {
            try {
                const parsedUrl = new URL(url);
                return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
            } catch {
                return false;
            }
        };

        if (images.length > 0) {
            await sendMessage(senderId, caption);
            
            const imagesToSend = images.slice(0, 10);
            
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
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            
            if (images.length > 10) {
                await sendMessage(senderId, `ℹ️ ${images.length - 10} image(s) supplémentaire(s) non affichée(s) (limite: 10).`);
            }
        } else if (video) {
            if (!validateMediaUrl(video.url)) {
                await sendMessage(senderId, "❌ URL de vidéo invalide. Impossible de télécharger.");
                return;
            }
            
            await sendMessage(senderId, caption);
            
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
        console.error('Erreur dans processOtherPlatforms:', error.message || error);
        
        let errorMessage = "⚠️ Une erreur s'est produite lors du téléchargement.\n\n";
        
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            errorMessage += "⏱️ La vidéo est trop volumineuse ou le serveur est lent.\n\n" +
                "💡 Suggestions:\n" +
                "• Réessayez dans quelques instants\n" +
                "• Essayez avec une vidéo plus courte\n" +
                "• Vérifiez votre connexion internet";
        } else {
            errorMessage += "Veuillez vérifier le lien et réessayer.";
        }
        
        await sendMessage(senderId, errorMessage);
    }
}

setInterval(() => {
    const now = Date.now();
    const TIMEOUT = 5 * 60 * 1000;
    
    for (const senderId in userStates) {
        if (now - userStates[senderId].timestamp > TIMEOUT) {
            delete userStates[senderId];
        }
    }
}, 60000);

module.exports.info = {
    name: "autodown",
    description: "Télécharge automatiquement des vidéos et images depuis TikTok, Facebook, Instagram et X (Twitter). Pour Facebook, demande la qualité avant téléchargement.",
    usage: "Envoyez 'autodown <lien>' ou simplement le lien directement. Pour Facebook, choisissez ensuite la qualité (360p, 480p, 720p, 1080p)."
};
