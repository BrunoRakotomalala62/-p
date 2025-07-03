
const fs = require("fs-extra");
const axios = require("axios");
const cheerio = require("cheerio");
const qs = require("qs");
const sendMessage = require('../handles/sendMessage');

function loadAutoLinkStates() {
  try {
    const data = fs.readFileSync("autolink.json", "utf8");
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

function saveAutoLinkStates(states) {
  fs.writeFileSync("autolink.json", JSON.stringify(states, null, 2));
}

let autoLinkStates = loadAutoLinkStates();

async function shortenURL(url) {
  try {
    const response = await axios.get(`https://shortner-sepia.vercel.app/kshitiz?url=${encodeURIComponent(url)}`);
    return response.data.shortened;
  } catch (error) {
    console.error(error);
    throw new Error("Failed to shorten URL");
  }
}

// État pour suivre les téléchargements actifs par utilisateur
const activeDownloads = {};

module.exports = async (senderId, prompt, api) => {
    // Cette commande fonctionne automatiquement quand un lien est détecté
    if (prompt && prompt.toLowerCase().includes('autodl off')) {
        autoLinkStates[senderId] = 'off';
        saveAutoLinkStates(autoLinkStates);
        await sendMessage(senderId, "🔴 AutoLink est maintenant désactivé pour vous.");
        return { skipCommandCheck: true };
    } else if (prompt && prompt.toLowerCase().includes('autodl on')) {
        autoLinkStates[senderId] = 'on';
        saveAutoLinkStates(autoLinkStates);
        await sendMessage(senderId, "🟢 AutoLink est maintenant activé pour vous.");
        return { skipCommandCheck: true };
    } else {
        await sendMessage(senderId, "⚠️ Cette commande fonctionne automatiquement lorsque vous envoyez un lien vidéo (YouTube, TikTok, Facebook, Instagram, Twitter, Pinterest).\n\n📱 Il suffit d'envoyer le lien et le téléchargement commencera automatiquement!\n\n🔧 Commandes:\n• autodl on - Activer\n• autodl off - Désactiver");
    }
    
    return { skipCommandCheck: true };
};

// Fonction pour détecter et traiter les liens automatiquement
const handleAutoDownload = async (senderId, messageText, api) => {
    if (!checkLink(messageText)) {
        return false; // Pas un lien vidéo supporté
    }

    const { url } = checkLink(messageText);
    
    // Vérifier si autolink est activé pour cet utilisateur
    if (autoLinkStates[senderId] === 'off') {
        return false;
    }

    // Vérifier si un téléchargement est déjà en cours pour cet utilisateur
    if (activeDownloads[senderId]) {
        await sendMessage(senderId, "⚠️ Un téléchargement est déjà en cours. Veuillez patienter...");
        return true;
    }

    try {
        // Marquer comme téléchargement actif
        activeDownloads[senderId] = true;

        console.log(`Attempting to download from URL: ${url}`);
        
        await sendMessage(senderId, "⏳ Téléchargement en cours, veuillez patienter...");

        await downloadVideo(url, senderId, api);

    } catch (error) {
        console.error("❌ Erreur lors du téléchargement automatique:", error);
        
        await sendMessage(senderId, `❌ Échec du téléchargement automatique.\n\n🔧 Raison possible:\n• Lien non supporté\n• Fichier trop volumineux\n• Erreur de connexion\n\n💡 Essayez avec un autre lien ou vérifiez que le lien est valide.`);
    } finally {
        // Libérer le verrou de téléchargement
        delete activeDownloads[senderId];
    }

    return true; // Lien traité
};

async function downloadVideo(url, senderId, api) {
    const time = Date.now();
    const tempDir = __dirname + '/../temp';
    await fs.ensureDir(tempDir);
    const path = `${tempDir}/${time}.mp4`;

    if (url.includes("instagram")) {
        await downloadInstagram(url, senderId, api, path);
    } else if (url.includes("facebook") || url.includes("fb.watch")) {
        await downloadFacebook(url, senderId, api, path);
    } else if (url.includes("tiktok")) {
        await downloadTikTok(url, senderId, api, path);
    } else if (url.includes("x.com") || url.includes("twitter.com")) {
        await downloadTwitter(url, senderId, api, path);
    } else if (url.includes("pin.it") || url.includes("pinterest.com")) {
        await downloadPinterest(url, senderId, api, path);
    } else if (url.includes("youtu")) {
        await downloadYouTube(url, senderId, api, path);
    }
}

async function downloadInstagram(url, senderId, api, path) {
    try {
        const res = await getLink(url);
        const response = await axios({
            method: "GET",
            url: res,
            responseType: "arraybuffer"
        });
        
        await fs.writeFile(path, Buffer.from(response.data));
        
        if (fs.statSync(path).size / 1024 / 1024 > 25) {
            await fs.unlink(path);
            return await sendMessage(senderId, "❌ Le fichier est trop volumineux (>25MB), impossible de l'envoyer.");
        }

        const shortUrl = await shortenURL(res);
        const messageBody = `✅ 🔗 Instagram téléchargé!\nLien: ${shortUrl}`;
        
        // Envoyer le fichier via votre système de messagerie
        await sendVideoMessage(senderId, messageBody, path, api);
        
    } catch (err) {
        console.error("Erreur Instagram:", err);
        await sendMessage(senderId, "❌ Erreur lors du téléchargement Instagram.");
    }
}

async function downloadFacebook(url, senderId, api, path) {
    try {
        const res = await fbDownloader(url);
        if (res.success && res.download && res.download.length > 0) {
            const videoUrl = res.download[0].url;
            const response = await axios({
                method: "GET",
                url: videoUrl,
                responseType: "stream"
            });
            
            if (response.headers['content-length'] > 87031808) {
                return await sendMessage(senderId, "❌ Le fichier est trop volumineux, impossible de l'envoyer.");
            }
            
            response.data.pipe(fs.createWriteStream(path));
            response.data.on('end', async () => {
                const shortUrl = await shortenURL(videoUrl);
                const messageBody = `✅ 🔗 Facebook téléchargé!\nLien: ${shortUrl}`;
                await sendVideoMessage(senderId, messageBody, path, api);
            });
        } else {
            await sendMessage(senderId, "❌ Impossible de télécharger cette vidéo Facebook.");
        }
    } catch (err) {
        console.error("Erreur Facebook:", err);
        await sendMessage(senderId, "❌ Erreur lors du téléchargement Facebook.");
    }
}

async function downloadTikTok(url, senderId, api, path) {
    try {
        const res = await axios.get(`https://tikdl-video.vercel.app/tiktok?url=${encodeURIComponent(url)}`);
        if (res.data.videoUrl) {
            const videoUrl = res.data.videoUrl;
            const response = await axios({
                method: "GET",
                url: videoUrl,
                responseType: "stream"
            });
            
            if (response.headers['content-length'] > 87031808) {
                return await sendMessage(senderId, "❌ Le fichier est trop volumineux, impossible de l'envoyer.");
            }
            
            response.data.pipe(fs.createWriteStream(path));
            response.data.on('end', async () => {
                const shortUrl = await shortenURL(videoUrl);
                const messageBody = `✅ 🔗 TikTok téléchargé!\nLien: ${shortUrl}`;
                await sendVideoMessage(senderId, messageBody, path, api);
            });
        } else {
            await sendMessage(senderId, "❌ Impossible de télécharger cette vidéo TikTok.");
        }
    } catch (err) {
        console.error("Erreur TikTok:", err);
        await sendMessage(senderId, "❌ Erreur lors du téléchargement TikTok.");
    }
}

async function downloadTwitter(url, senderId, api, path) {
    try {
        const res = await axios.get(`https://xdl-twitter.vercel.app/kshitiz?url=${encodeURIComponent(url)}`);
        const videoUrl = res.data.videoUrl;

        const response = await axios({
            method: "GET",
            url: videoUrl,
            responseType: "stream"
        });

        if (response.headers['content-length'] > 87031808) {
            return await sendMessage(senderId, "❌ Le fichier est trop volumineux, impossible de l'envoyer.");
        }

        response.data.pipe(fs.createWriteStream(path));
        response.data.on('end', async () => {
            const shortUrl = await shortenURL(videoUrl);
            const messageBody = `✅ 🔗 Twitter/X téléchargé!\nLien: ${shortUrl}`;
            await sendVideoMessage(senderId, messageBody, path, api);
        });
    } catch (err) {
        console.error("Erreur Twitter:", err);
        await sendMessage(senderId, "❌ Erreur lors du téléchargement Twitter/X.");
    }
}

async function downloadPinterest(url, senderId, api, path) {
    try {
        const res = await axios.get(`https://pindl-pinterest.vercel.app/kshitiz?url=${encodeURIComponent(url)}`);
        const videoUrl = res.data.url;

        const response = await axios({
            method: "GET",
            url: videoUrl,
            responseType: "stream"
        });

        if (response.headers['content-length'] > 87031808) {
            return await sendMessage(senderId, "❌ Le fichier est trop volumineux, impossible de l'envoyer.");
        }

        response.data.pipe(fs.createWriteStream(path));
        response.data.on('end', async () => {
            const shortUrl = await shortenURL(videoUrl);
            const messageBody = `✅ 🔗 Pinterest téléchargé!\nLien: ${shortUrl}`;
            await sendVideoMessage(senderId, messageBody, path, api);
        });
    } catch (err) {
        console.error("Erreur Pinterest:", err);
        await sendMessage(senderId, "❌ Erreur lors du téléchargement Pinterest.");
    }
}

async function downloadYouTube(url, senderId, api, path) {
    try {
        const res = await axios.get(`https://yt-downloader-eta.vercel.app/kshitiz?url=${encodeURIComponent(url)}`);
        const videoUrl = res.data.url;

        const response = await axios({
            method: "GET",
            url: videoUrl,
            responseType: "stream"
        });

        if (response.headers['content-length'] > 87031808) {
            return await sendMessage(senderId, "❌ Le fichier est trop volumineux, impossible de l'envoyer.");
        }

        response.data.pipe(fs.createWriteStream(path));
        response.data.on('end', async () => {
            const shortUrl = await shortenURL(videoUrl);
            const messageBody = `✅ 🔗 YouTube téléchargé!\nLien: ${shortUrl}`;
            await sendVideoMessage(senderId, messageBody, path, api);
        });
    } catch (err) {
        console.error("Erreur YouTube:", err);
        await sendMessage(senderId, "❌ Erreur lors du téléchargement YouTube.");
    }
}

async function sendVideoMessage(senderId, messageBody, filePath, api) {
    try {
        // Utiliser l'API Facebook Messenger pour envoyer la vidéo
        const accessToken = process.env.FB_ACCESS_TOKEN;
        if (!accessToken) {
            throw new Error("FB_ACCESS_TOKEN non défini");
        }

        // Lire le fichier et l'envoyer
        const fileStream = fs.createReadStream(filePath);
        const FormData = require('form-data');
        const formData = new FormData();
        
        formData.append('recipient', JSON.stringify({ id: senderId }));
        formData.append('message', JSON.stringify({
            text: messageBody
        }));
        formData.append('filedata', fileStream);

        await axios.post(`https://graph.facebook.com/v11.0/me/messages?access_token=${accessToken}`, formData, {
            headers: formData.getHeaders()
        });

        // Nettoyer le fichier temporaire
        await fs.unlink(filePath);
        
    } catch (error) {
        console.error("Erreur envoi vidéo:", error);
        await sendMessage(senderId, messageBody);
        await fs.unlink(filePath);
    }
}

function getLink(url) {
    return new Promise((resolve, reject) => {
        if (url.includes("instagram")) {
            axios({
                method: "GET",
                url: `https://insta-kshitiz.vercel.app/insta?url=${encodeURIComponent(url)}`
            })
            .then(res => {
                console.log(`API Response: ${JSON.stringify(res.data)}`);
                if (res.data.url) {
                    resolve(res.data.url);
                } else {
                    reject(new Error("Invalid response from the API"));
                }
            })
            .catch(err => reject(err));
        } else {
            reject(new Error("Unsupported platform for getLink"));
        }
    });
}

async function fbDownloader(url) {
    try {
        const response1 = await axios({
            method: 'POST',
            url: 'https://snapsave.app/action.php?lang=vn',
            headers: {
                "accept": "*/*",
                "accept-language": "vi,en-US;q=0.9,en;q=0.8",
                "content-type": "multipart/form-data",
                "sec-ch-ua": "\"Chromium\";v=\"110\", \"Not A(Brand\";v=\"24\", \"Microsoft Edge\";v=\"110\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"Windows\"",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "Referer": "https://snapsave.app/vn",
                "Referrer-Policy": "strict-origin-when-cross-origin"
            },
            data: {
                url
            }
        });

        let html;
        const evalCode = response1.data.replace('return decodeURIComponent', 'html = decodeURIComponent');
        eval(evalCode);
        html = html.split('innerHTML = "')[1].split('";\n')[0].replace(/\\"/g, '"');

        const $ = cheerio.load(html);
        const download = [];

        const tbody = $('table').find('tbody');
        const trs = tbody.find('tr');

        trs.each(function (i, elem) {
            const trElement = $(elem);
            const tds = trElement.children();
            const quality = $(tds[0]).text().trim();
            const url = $(tds[2]).children('a').attr('href');
            if (url != undefined) {
                download.push({
                    quality,
                    url
                });
            }
        });

        return {
            success: true,
            video_length: $("div.clearfix > p").text().trim(),
            download
        };
    } catch (err) {
        console.error('Error in Facebook Downloader:', err);
        return {
            success: false
        };
    }
}

function checkLink(url) {
    if (
        url.includes("instagram") ||
        url.includes("facebook") ||
        url.includes("fb.watch") ||
        url.includes("tiktok") ||
        url.includes("x.com") ||
        url.includes("twitter.com") ||
        url.includes("pin.it") ||
        url.includes("pinterest.com") ||
        url.includes("youtu")
    ) {
        return {
            url: url
        };
    }

    const fbWatchRegex = /fb\.watch\/[a-zA-Z0-9_-]+/i;
    if (fbWatchRegex.test(url)) {
        return {
            url: url
        };
    }

    return null;
}

// Exporter la fonction de gestion automatique
module.exports.handleAutoDownload = handleAutoDownload;

// Informations de la commande
module.exports.info = {
    name: "autodl",
    description: "Télécharge automatiquement les vidéos de Instagram, Facebook, TikTok, Twitter, Pinterest et YouTube",
    usage: "Envoyez simplement un lien vidéo ou utilisez 'autodl on/off' pour activer/désactiver"
};
