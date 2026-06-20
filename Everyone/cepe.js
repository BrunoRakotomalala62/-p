const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const API_URL = 'https://valina-cepe-2026.onrender.com/api/cepe';

module.exports = async (senderId, userText, api) => {
    const matricule = userText.trim();

    if (!matricule) {
        await sendMessage(senderId,
            '📋 *RÉSULTATS CEPE 2026*\n\n' +
            '🔍 Veuillez entrer votre numéro de matricule.\n\n' +
            '📌 Exemple : *03800614-T16/04*\n\n' +
            '✏️ Tapez simplement votre matricule et j\'afficherai votre résultat !'
        );
        return;
    }

    await sendMessage(senderId,
        '⏳ Recherche en cours...\n' +
        `🔍 Matricule : *${matricule}*\n\n` +
        '⌛ Veuillez patienter quelques instants...'
    );

    try {
        const response = await axios.get(API_URL, {
            params: { matricule },
            timeout: 30000
        });

        const data = response.data;

        if (!data || !data.resultats || data.resultats.length === 0) {
            await sendMessage(senderId,
                '❌ *Aucun résultat trouvé*\n\n' +
                `📋 Matricule : *${matricule}*\n\n` +
                '⚠️ Ce matricule n\'existe pas dans notre base de données.\n' +
                'Veuillez vérifier et réessayer.'
            );
            return;
        }

        const eleve = data.resultats[0];
        const isAdmis = eleve.OBSERVATION && eleve.OBSERVATION.toLowerCase().includes('admis');

        const medal = isAdmis ? '🏆' : '😔';
        const statusEmoji = isAdmis ? '✅' : '❌';
        const statusBanner = isAdmis
            ? '🎉🎊 FÉLICITATIONS ! 🎊🎉'
            : '📋 RÉSULTAT CEPE 2026';

        const message =
            `${medal} ━━━━━━━━━━━━━━━━━━━━ ${medal}\n` +
            `        ${statusBanner}\n` +
            `${medal} ━━━━━━━━━━━━━━━━━━━━ ${medal}\n\n` +
            `👤 *NOM & PRÉNOM*\n` +
            `   ${eleve.NOM_PRENOM}\n\n` +
            `🎓 *EXAMEN*\n` +
            `   ${eleve.examen || data.examen || 'CEPE 2026'}\n\n` +
            `🪪 *MATRICULE*\n` +
            `   ${eleve.MATRICULE}\n\n` +
            `🏫 *ÉCOLE D\'ORIGINE*\n` +
            `   ${eleve.ECOLE_ORIGINE}\n\n` +
            `📍 *CISCO*\n` +
            `   ${eleve.CISCO}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `${statusEmoji} *RÉSULTAT : ${eleve.OBSERVATION ? eleve.OBSERVATION.toUpperCase() : 'NON DISPONIBLE'}*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            (isAdmis
                ? `🌟 Bravo ! Tu as réussi ton CEPE !\n` +
                  `💪 Continue sur cette belle lancée !\n` +
                  `🚀 Un bel avenir t'attend !\n\n`
                : `💙 Ne te décourage pas !\n` +
                  `📚 Le travail paie toujours !\n` +
                  `🌈 Tu feras encore mieux la prochaine fois !\n\n`) +
            `🤖 *AMPINGA D\'OR AI* — Résultats CEPE 2026`;

        await sendMessage(senderId, message);

    } catch (error) {
        console.error('Erreur commande cepe:', error.message);

        if (error.response && error.response.status === 404) {
            await sendMessage(senderId,
                '❌ *Matricule introuvable*\n\n' +
                `📋 Matricule : *${matricule}*\n\n` +
                '⚠️ Ce matricule n\'est pas enregistré.\n' +
                'Vérifiez votre numéro et réessayez.'
            );
        } else {
            await sendMessage(senderId,
                '🔌 *Erreur de connexion*\n\n' +
                '⚠️ Le serveur CEPE est momentanément inaccessible.\n\n' +
                '⏰ Veuillez réessayer dans quelques instants.\n\n' +
                `🔍 Matricule recherché : *${matricule}*`
            );
        }
    }
};
