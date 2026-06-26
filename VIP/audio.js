const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const API_BASE = 'https://mp3-juice.onrender.com/api';
const userSessions = new Map();

const LOADING_MSGS = [
    '🎵 Recherche en cours dans les archives musicales...',
    '🔍 Exploration des bases de données musicales...',
    '🌐 Connexion aux serveurs audio premium...',
    '🎶 Analyse des pistes disponibles...',
];

const DOWNLOAD_MSGS = [
    '⚡ Préparation de votre piste audio...',
    '🎧 Encodage MP3 haute qualité en cours...',
    '📦 Compression et livraison en cours...',
    '🚀 Finalisation de votre téléchargement...',
];

function rand(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function buildResultsList(data) {
    const { artiste, total, resultats } = data;
    const MAX_DISPLAY = 10;
    const slice = resultats.slice(0, MAX_DISPLAY);

    let header =
        `╔══════════════════════════╗\n` +
        `║   🎵  AMPINGA D'OR AUDIO  🎵   ║\n` +
        `╚══════════════════════════╝\n\n` +
        `🎤 Artiste  : ${artiste.toUpperCase()}\n` +
        `📀 Résultats: ${total} piste(s) trouvée(s)\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    let list = '';
    slice.forEach((track, i) => {
        const num = i + 1;
        list +=
            `${num < 10 ? ' ' : ''}${num}. 🎵 ${track.titre}\n` +
            `    ⏱️  ${track.duree}   |   🔊 ${track.qualite}\n` +
            `    ▶️  ${track.source}\n` +
            `    ─────────────────────\n`;
    });

    let footer =
        `\n💡 Envoyez le numéro (1–${slice.length}) pour télécharger.\n` +
        `🛑 Tapez "stop" pour quitter.\n\n` +
        `╔══════════════════════════╗\n` +
        `║  ✨ AMPINGA D'OR PREMIUM ✨  ║\n` +
        `╚══════════════════════════╝`;

    return { message: header + list + footer, tracks: slice };
}

function buildDownloadCard(track, artiste) {
    return (
        `╔══════════════════════════╗\n` +
        `║   📥  TÉLÉCHARGEMENT  📥   ║\n` +
        `╚══════════════════════════╝\n\n` +
        `🎤 Artiste  : ${artiste}\n` +
        `🎵 Titre    : ${track.titre}\n` +
        `⏱️  Durée    : ${track.duree}\n` +
        `🔊 Qualité  : ${track.qualite}\n` +
        `📀 Source   : ${track.source}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⬇️  Cliquez sur le fichier audio\n` +
        `   ci-dessous pour le télécharger\n` +
        `   directement sur votre appareil.\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `╔══════════════════════════╗\n` +
        `║  🎧 BONNE ÉCOUTE ! 🎧      ║\n` +
        `╚══════════════════════════╝`
    );
}

module.exports = async (senderId, prompt, api) => {
    try {
        const input = typeof prompt === 'string' ? prompt.trim() : '';
        const session = userSessions.get(senderId);

        if (input.toLowerCase() === 'stop' || input === 'RESET_CONVERSATION') {
            userSessions.delete(senderId);
            await sendMessage(senderId,
                `╔══════════════════════════╗\n` +
                `║  🛑  SESSION TERMINÉE  🛑  ║\n` +
                `╚══════════════════════════╝\n\n` +
                `✅ Commande audio fermée.\n` +
                `🎵 À bientôt sur AMPINGA D'OR !`
            );
            return;
        }

        if (session && session.tracks) {
            if (/^\d+$/.test(input)) {
                const num = parseInt(input);
                if (num < 1 || num > session.tracks.length) {
                    await sendMessage(senderId,
                        `❌ Numéro invalide.\n` +
                        `📌 Choisissez entre 1 et ${session.tracks.length}.`
                    );
                    return;
                }

                const track = session.tracks[num - 1];
                const artiste = session.artiste;

                await sendMessage(senderId, rand(DOWNLOAD_MSGS));

                // URL PDF-MP3 : envoyé comme fichier PDF cliquable dans Messenger
                const pdfUrl  = `https://mp3-juice.onrender.com/api/mp3?pdf=1&artiste=${encodeURIComponent(artiste)}&index=${track.index}`;
                // URL audio brut : pour le lecteur intégré Messenger
                const audioUrl = `${API_BASE}/download?index=${track.index}&artiste=${encodeURIComponent(artiste)}`;

                await sendMessage(senderId, buildDownloadCard(track, artiste));

                // 1️⃣ Fichier PDF-MP3 cliquable (carte comme PDF dans Messenger)
                //    → clic = téléchargement direct, renommer en .mp3 après
                try {
                    await sendMessage(senderId, {
                        attachment: {
                            type: 'file',
                            payload: {
                                url: pdfUrl,
                                is_reusable: true
                            }
                        }
                    });
                } catch (fileErr) {
                    console.error('Erreur envoi fichier PDF-MP3:', fileErr.message);
                    await sendMessage(senderId, `📥 Lien de téléchargement :\n${pdfUrl}`);
                }

                // 2️⃣ Lecteur audio intégré (écoute directe sans télécharger)
                try {
                    await sendMessage(senderId, {
                        attachment: {
                            type: 'audio',
                            payload: {
                                url: audioUrl,
                                is_reusable: true
                            }
                        }
                    });
                } catch (audioErr) {
                    console.error('Erreur envoi lecteur audio:', audioErr.message);
                }

                await sendMessage(senderId,
                    `╔══════════════════════════╗\n` +
                    `║  🔄  SUITE ?  🔄            ║\n` +
                    `╚══════════════════════════╝\n\n` +
                    `🎵 Envoyez un nom d'artiste pour\n` +
                    `   une nouvelle recherche.\n` +
                    `🛑 Tapez "stop" pour quitter.`
                );

                userSessions.delete(senderId);
                return;
            } else {
                await sendMessage(senderId,
                    `❌ Réponse invalide.\n` +
                    `📌 Envoyez un numéro entre 1 et ${session.tracks.length}\n` +
                    `   ou "stop" pour quitter.`
                );
                return;
            }
        }

        if (!input) {
            await sendMessage(senderId,
                `╔══════════════════════════╗\n` +
                `║   🎵  AMPINGA D'OR AUDIO  🎵   ║\n` +
                `╚══════════════════════════╝\n\n` +
                `🎤 Bienvenue sur le lecteur audio\n` +
                `   premium AMPINGA D'OR !\n\n` +
                `📌 Envoyez le nom d'un artiste\n` +
                `   pour rechercher ses musiques.\n\n` +
                `💡 Exemple : Mopcaan\n\n` +
                `╔══════════════════════════╗\n` +
                `║  ✨ AMPINGA D'OR PREMIUM ✨  ║\n` +
                `╚══════════════════════════╝`
            );
            return;
        }

        await sendMessage(senderId, rand(LOADING_MSGS));

        const res = await axios.get(`${API_BASE}/recherche`, {
            params: { artiste: input },
            timeout: 30000
        });

        const data = res.data;

        if (!data || !data.resultats || data.resultats.length === 0) {
            await sendMessage(senderId,
                `╔══════════════════════════╗\n` +
                `║   😔  AUCUN RÉSULTAT   😔   ║\n` +
                `╚══════════════════════════╝\n\n` +
                `🔍 Aucune piste trouvée pour :\n` +
                `   "${input}"\n\n` +
                `💡 Essayez avec un autre nom.`
            );
            return;
        }

        const { message, tracks } = buildResultsList(data);
        userSessions.set(senderId, { artiste: data.artiste, tracks });
        await sendMessage(senderId, message);

    } catch (error) {
        console.error('Erreur audio.js:', error.message);
        userSessions.delete(senderId);
        await sendMessage(senderId,
            `╔══════════════════════════╗\n` +
            `║   ⚠️  ERREUR SERVEUR  ⚠️   ║\n` +
            `╚══════════════════════════╝\n\n` +
            `😔 Une erreur est survenue.\n` +
            `🔄 Veuillez réessayer dans\n` +
            `   quelques instants.`
        );
    }
};
