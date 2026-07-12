const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

const BASE_URL = 'https://valina-cepe-2026-ztym.onrender.com';
const API_URL = `${BASE_URL}/api/bepc`;
const CISCO_URL = `${BASE_URL}/api/cisco`;

function isMatricule(text) {
    return /\d{5,}/.test(text);
}

async function getCiscoListMessage() {
    try {
        const response = await axios.get(CISCO_URL, {
            params: { examen: 'bepc' },
            timeout: 15000
        });
        const data = response.data;
        if (!data || !Array.isArray(data.ciscos) || data.ciscos.length === 0) {
            return '';
        }
        return (
            `\n📍 *CISCO disponibles pour le BEPC (${data.total || data.ciscos.length})* :\n` +
            data.ciscos.join(', ')
        );
    } catch (err) {
        console.error('Erreur récupération liste CISCO BEPC:', err.message);
        return '';
    }
}

function buildResultMessage(eleve, examen) {
    const obs = eleve.OBSERVATION ? eleve.OBSERVATION.toLowerCase().trim() : '';
    const isAdmis = obs === 'admis' || (obs.includes('admis') && !obs.includes('non admis'));

    const medal = isAdmis ? '🏆' : '😔';
    const statusEmoji = isAdmis ? '✅' : '❌';
    const statusBanner = isAdmis
        ? '🎉🎊 FÉLICITATIONS ! 🎊🎉'
        : '📋 RÉSULTAT BEPC 2026';

    return (
        `${medal} ━━━━━━━━━━━━━━━━━━━━ ${medal}\n` +
        `        ${statusBanner}\n` +
        `${medal} ━━━━━━━━━━━━━━━━━━━━ ${medal}\n\n` +
        `👤 *NOM & PRÉNOM*\n` +
        `   ${eleve.NOM_PRENOM}\n\n` +
        `🎓 *EXAMEN*\n` +
        `   ${eleve.examen || examen || 'BEPC 2026'}\n\n` +
        `🪪 *MATRICULE*\n` +
        `   ${eleve.MATRICULE}\n\n` +
        `🏫 *ÉCOLE D'ORIGINE*\n` +
        `   ${eleve.ECOLE_ORIGINE}\n\n` +
        `📍 *CISCO*\n` +
        `   ${eleve.CISCO}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${statusEmoji} *RÉSULTAT : ${eleve.OBSERVATION ? eleve.OBSERVATION.toUpperCase() : 'NON DISPONIBLE'}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        (isAdmis
            ? `🌟 Bravo ! Tu as réussi ton BEPC !\n` +
              `💪 Continue sur cette belle lancée !\n` +
              `🚀 Un bel avenir t'attend !\n\n`
            : `💙 Ne te décourage pas !\n` +
              `📚 Le travail paie toujours !\n` +
              `🌈 Tu feras encore mieux la prochaine fois !\n\n`) +
        `🤖 *AMPINGA D'OR AI* — Résultats BEPC 2026`
    );
}

module.exports = async (senderId, userText, api) => {
    const query = userText.trim();

    if (!query) {
        await sendMessage(senderId,
            '📋 *RÉSULTATS BEPC 2026*\n\n' +
            '🔍 Entrez votre *matricule* ou votre *nom complet* :\n\n' +
            '📌 Par matricule : *035AM00532-T06/03*\n' +
            '📌 Par nom : *FANAMBINANA MBOLATIANA DINA*\n\n' +
            '✏️ Tapez simplement l\'une ou l\'autre information !'
        );
        return;
    }

    const searchByMatricule = isMatricule(query);
    const searchLabel = searchByMatricule ? `Matricule : *${query}*` : `Nom : *${query}*`;

    await sendMessage(senderId,
        '⏳ Recherche en cours...\n' +
        `🔍 ${searchLabel}\n\n` +
        '⌛ Veuillez patienter quelques instants...'
    );

    try {
        const params = searchByMatricule ? { matricule: query } : { nom: query };

        const response = await axios.get(API_URL, {
            params,
            timeout: 30000
        });

        const data = response.data;

        if (!data || !data.resultats || data.resultats.length === 0) {
            const ciscoList = await getCiscoListMessage();
            await sendMessage(senderId,
                '❌ *Aucun résultat trouvé*\n\n' +
                `🔍 ${searchLabel}\n\n` +
                '⚠️ Aucun candidat trouvé avec cette information.\n' +
                'Vérifiez l\'orthographe ou le numéro et réessayez.' +
                ciscoList
            );
            return;
        }

        if (data.resultats.length === 1) {
            await sendMessage(senderId, buildResultMessage(data.resultats[0], data.examen));
        } else {
            let listMsg =
                `🔍 *${data.resultats.length} résultats trouvés pour :*\n` +
                `   "${query}"\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

            data.resultats.forEach((eleve, index) => {
                const obs = eleve.OBSERVATION ? eleve.OBSERVATION.toLowerCase().trim() : '';
                const isAdmis = obs === 'admis' || (obs.includes('admis') && !obs.includes('non admis'));
                const emoji = isAdmis ? '✅' : '❌';

                listMsg +=
                    `${index + 1}. ${emoji} *${eleve.NOM_PRENOM}*\n` +
                    `   🪪 ${eleve.MATRICULE}\n` +
                    `   🏫 ${eleve.ECOLE_ORIGINE}\n` +
                    `   📍 ${eleve.CISCO}\n` +
                    `   📊 ${eleve.OBSERVATION ? eleve.OBSERVATION.toUpperCase() : 'N/A'}\n\n`;
            });

            listMsg += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            listMsg += `💡 Pour voir le détail complet, entrez le matricule exact.`;

            await sendMessage(senderId, listMsg);
        }

    } catch (error) {
        console.error('Erreur commande bepc:', error.message);

        if (error.response && error.response.status === 404) {
            const ciscoList = await getCiscoListMessage();
            await sendMessage(senderId,
                '❌ *Introuvable*\n\n' +
                `🔍 ${searchLabel}\n\n` +
                '⚠️ Aucun candidat enregistré avec cette information.\n' +
                'Vérifiez et réessayez.' +
                ciscoList
            );
        } else {
            await sendMessage(senderId,
                '🔌 *Erreur de connexion*\n\n' +
                '⚠️ Le serveur BEPC est momentanément inaccessible.\n\n' +
                '⏰ Veuillez réessayer dans quelques instants.\n\n' +
                `🔍 ${searchLabel}`
            );
        }
    }
};
