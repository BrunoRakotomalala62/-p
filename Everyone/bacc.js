const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// URL de base de l'API Résultats BACC 2026
const BASE_URL = 'https://resulats-bacc-2026-final-9ajt.vercel.app';
const DEFAULT_PROVINCE = 'fianarantsoa';

const PROVINCES = Object.freeze({
    fianarantsoa: {
        label: 'Fianarantsoa',
        aliases: ['fianarantsoa', 'fiana'],
    },
    antsiranana: {
        label: 'Antsiranana',
        aliases: ['antsiranana', 'antsiaranana', 'antsi', 'diego'],
    },
});

const ALL_PROVINCES = Object.freeze(Object.keys(PROVINCES));
const ALL_PROVINCES_KEY = 'all';

// Nombre de résultats affichés par page (côté bot, pagination locale)
const PER_PAGE = 10;

function normalizeToken(value) {
    return (value || '')
        .toString()
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function getProvinceLabel(province) {
    if (province === ALL_PROVINCES_KEY) return 'Toutes les provinces';
    return PROVINCES[province]?.label || PROVINCES[DEFAULT_PROVINCE].label;
}

function getCommand(province, query, suffix = '') {
    const provincePart = !province || province === DEFAULT_PROVINCE || province === ALL_PROVINCES_KEY
        ? ''
        : `${province} `;
    const suffixPart = suffix ? ` ${suffix}` : '';
    return `bacc ${provincePart}${query}${suffixPart}`;
}

// Détecte une province dans les arguments : "antsiranana RAKOTO" ou
    // "province antsiranana RAKOTO". Sans province, la recherche couvrira toutes les provinces.
function detectProvince(words) {
    const aliases = new Map();
    Object.entries(PROVINCES).forEach(([province, config]) => {
        config.aliases.forEach(alias => aliases.set(normalizeToken(alias), province));
    });

    for (let i = 0; i < words.length; i++) {
        const token = normalizeToken(words[i]);
        const inlineProvince = token.match(/^province[=:](.+)$/);
        if (inlineProvince && aliases.has(inlineProvince[1])) {
            return { province: aliases.get(inlineProvince[1]), index: i, count: 1 };
        }

        if (token === 'province' && words[i + 1]) {
            const nextProvince = aliases.get(normalizeToken(words[i + 1]));
            if (nextProvince) {
                return { province: nextProvince, index: i, count: 2 };
            }
        }

        if (aliases.has(token)) {
            return { province: aliases.get(token), index: i, count: 1 };
        }
    }

    return { province: null, index: -1, count: 0 };
}

// Détecte si le texte est un matricule (au moins 5 chiffres consécutifs)
function isMatricule(text) {
    return /^\d{5,}$/.test(text.replace(/[-\/]/g, ''));
}

// Emoji selon la mention
function getMentionEmoji(mention) {
    if (!mention) return '📊';
    const m = mention.toLowerCase();
    if (m.includes('très bien') || m.includes('tres bien')) return '🌟';
    if (m.includes('assez bien'))                          return '✨';
    if (m.includes('bien'))                                 return '⭐';
    if (m.includes('passable'))                             return '👍';
    if (m.includes('ajourn'))                               return '📋';
    return '📊';
}

// Libellé lisible pour une série
function getSerieLabel(serie) {
    const series = {
        'A1': 'Littéraire (A1)', 'A2': 'Littéraire (A2)',
        'C':  'Scientifique (C)', 'D': 'Sciences nat. (D)',
        'G1': 'Gestion (G1)',    'G2': 'Gestion (G2)',
        'L':  'Langues (L)',     'OSE': 'OSE',
        'S':  'Scientifique (S)', 'O': 'Origami (O)',
        'T':  'Technique',
    };
    return series[serie] || serie;
}

// Détermine si le candidat est admis à partir du champ "resultat"
function isAdmis(resultat) {
    if (!resultat) return false;
    const r = resultat.toLowerCase();
    return r.includes('admis') && !r.includes('non admis') && !r.includes('non-admis');
}

// Message détaillé pour un seul résultat
function buildResultMessage(candidat, province) {
    const admis = isAdmis(candidat.resultat);
    const mention = candidat.mention || '';
    const serie   = candidat.serie   || '';
    const centre  = candidat.centre  || '';
    const provinceName = getProvinceLabel(candidat.province || province);

    const medal       = admis ? '🏆' : '😔';
    const statusEmoji = admis ? '✅' : '❌';
    const banner      = admis ? '🎉🎊 FÉLICITATIONS ! 🎊🎉' : '📋 RÉSULTAT BACCALAURÉAT 2026';
    const mentionEmo  = getMentionEmoji(mention);

    let msg = '';
    msg += `${medal} ━━━━━━━━━━━━━━━━━━━━ ${medal}\n`;
    msg += `        ${banner}\n`;
    msg += `${medal} ━━━━━━━━━━━━━━━━━━━━ ${medal}\n\n`;

    msg += `👤 *NOM & PRÉNOM*\n`;
    msg += `   ${candidat.nom}\n\n`;

    msg += `📍 *PROVINCE*\n`;
    msg += `   ${provinceName}\n\n`;

    msg += `🪪 *MATRICULE*\n`;
    msg += `   ${candidat.matricule}\n\n`;

    msg += `📚 *SÉRIE*\n`;
    msg += `   ${getSerieLabel(serie)}\n\n`;

    msg += `🏫 *CENTRE D'EXAMEN*\n`;
    msg += `   ${centre}\n\n`;

    msg += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `${statusEmoji} *RÉSULTAT : ${(candidat.resultat || '').toUpperCase()}*\n`;
    if (admis && mention) {
        msg += `${mentionEmo} *MENTION : ${mention.toUpperCase()}*\n`;
    }
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (admis) {
        msg += `🌟 Félicitations pour ton Baccalauréat !\n`;
        msg += `💪 Tu as travaillé dur et ça a payé !\n`;
        msg += `🚀 Un bel avenir universitaire t'attend !\n\n`;
    } else {
        msg += `💙 Ne te décourage pas !\n`;
        msg += `📚 Le travail et la persévérance paient toujours !\n`;
        msg += `🌈 Tu feras encore mieux la prochaine fois !\n\n`;
    }

    msg += `🤖 *AMPINGA D'OR AI* — Résultats Baccalauréat 2026`;
    return msg;
}

// Message de liste pour plusieurs résultats (pagination locale)
function buildListMessage(resultats, query, province, page, totalPages, totalResults, failedProvinces = []) {
    const start = (page - 1) * PER_PAGE;
    const slice = resultats.slice(start, start + PER_PAGE);
    const admisCount = slice.filter(r => isAdmis(r.resultat)).length;

    let msg = `🎓 ━━━━━━━━━━━━━━━━━━━━━━━━ 🎓\n`;
    msg += `   *BACCALAURÉAT 2026 — RÉSULTATS*\n`;
    msg += `🎓 ━━━━━━━━━━━━━━━━━━━━━━━━ 🎓\n\n`;

    msg += `🔍 *Recherche :* "${query}"\n`;
    msg += `📍 *Province :* ${getProvinceLabel(province)}\n`;
    msg += `📊 *${totalResults} résultat(s) au total* — page ${page}/${totalPages}\n`;
    msg += `   ✅ ${admisCount} admis · ❌ ${slice.length - admisCount} ajournés (sur cette page)\n`;
    if (failedProvinces.length > 0) {
        msg += `⚠️ Source indisponible : ${failedProvinces.map(getProvinceLabel).join(', ')}\n`;
    }
    msg += `\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    slice.forEach((c, i) => {
        const admis = isAdmis(c.resultat);
        const emoji = admis ? '✅' : '❌';
        const mentionEmo = getMentionEmoji(c.mention);
        const globalIndex = start + i + 1;

        msg += `${globalIndex}. ${emoji} *${c.nom}*\n`;
        msg += `   🪪 ${c.matricule}\n`;
        msg += `   📍 ${getProvinceLabel(c.province || province)}\n`;
        msg += `   📚 Série : ${getSerieLabel(c.serie) || 'N/A'}\n`;
        msg += `   🏫 ${c.centre || 'N/A'}\n`;
        msg += `   ${mentionEmo} ${c.resultat || 'N/A'}${c.mention && admis ? ' · ' + c.mention : ''}\n\n`;
    });

    msg += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📖 *Page ${page}/${totalPages}*\n`;

    if (page > 1) {
        msg += `⬅️ Page précédente : *${getCommand(province, query, `page ${page - 1}`)}*\n`;
    }
    if (page < totalPages) {
        msg += `➡️ Page suivante : *${getCommand(province, query, `page ${page + 1}`)}*\n`;
    }

    msg += `\n💡 Pour le détail complet, entrez le *matricule exact*.\n`;
    msg += `   Exemple : *${getCommand(province, resultats[0]?.matricule || '3695042')}*`;
    return msg;
}

// Message d'aide
function buildHelpMessage() {
    return (
        `🎓 ━━━━━━━━━━━━━━━━━━━━━━━━ 🎓\n` +
        `   *BACCALAURÉAT MADAGASCAR 2026*\n` +
        `🎓 ━━━━━━━━━━━━━━━━━━━━━━━━ 🎓\n\n` +
        `🔍 *Comment rechercher ?*\n\n` +
        `📌 *Par nom ou prénom :*\n` +
        `   bacc RAKOTO\n` +
        `   bacc Miora\n\n` +
        `📌 *Par matricule :*\n` +
        `   bacc 3695042\n\n` +
        `📍 *Choisir une province :*\n` +
        `   bacc antsiranana RAKOTO\n` +
        `   bacc province antsiranana 1186047\n` +
        `   (sans province, la recherche couvre toutes les provinces)\n\n` +
        `📌 *Naviguer entre les pages :*\n` +
        `   bacc antsiranana RAKOTO page 2\n` +
        `   bacc antsiranana RAKOTO p3\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🤖 *AMPINGA D'OR AI* — Résultats Bacc 2026`
    );
}

// Détecte une demande de page dans les arguments : "page 2", "p2", "pg3", ...
function detectPage(words) {
    for (let i = words.length - 1; i >= 0; i--) {
        const w = words[i].toLowerCase();
        const m = w.match(/^(?:page|pg?)\.?\s*[-:]?\s*(\d+)$/);
        if (m) {
            return { page: parseInt(m[1], 10), index: i };
        }
        if (w === 'page' || w === 'p' || w === 'pg') {
            const next = words[i + 1];
            if (next && /^\d+$/.test(next)) {
                return { page: parseInt(next, 10), index: i, index2: i + 1 };
            }
        }
    }
    return null;
}

// Appel à l'API de recherche
async function search(query, isMatric, province) {
    const params = {
        ...(province ? { province } : {}),
        ...(isMatric ? { matricule: query } : { nom: query }),
    };
    const response = await axios.get(`${BASE_URL}/recherche`, { params, timeout: 30000 });
    return response.data;
}

function candidateKey(candidate, province) {
    if (candidate.matricule) return `matricule:${candidate.matricule}`;
    return [
        province,
        normalizeToken(candidate.nom),
        normalizeToken(candidate.centre),
        normalizeToken(candidate.serie),
    ].join('|');
}

async function searchAllProvinces(query, isMatric) {
    const responses = await Promise.all(ALL_PROVINCES.map(async (province) => {
        try {
            const data = await search(query, isMatric, province);
            const resultats = Array.isArray(data?.resultats) ? data.resultats : [];
            return {
                province,
                resultats: resultats.map((candidate) => ({
                    ...candidate,
                    province: candidate.province || province,
                })),
                error: null,
            };
        } catch (error) {
            return { province, resultats: [], error };
        }
    }));

    const resultats = [];
    const seen = new Set();
    for (const response of responses) {
        for (const candidate of response.resultats) {
            const key = candidateKey(candidate, response.province);
            if (!seen.has(key)) {
                seen.add(key);
                resultats.push(candidate);
            }
        }
    }

    const failedProvinces = responses
        .filter((response) => response.error)
        .map((response) => response.province);

    if (resultats.length === 0 && failedProvinces.length === ALL_PROVINCES.length) {
        const error = responses.find((response) => response.error)?.error || new Error('Toutes les sources BACC sont indisponibles.');
        error.failedProvinces = failedProvinces;
        throw error;
    }

    return { resultats, failedProvinces };
}

async function searchResults(query, isMatric, province) {
    if (province) {
        const data = await search(query, isMatric, province);
        return {
            resultats: (Array.isArray(data?.resultats) ? data.resultats : []).map((candidate) => ({
                ...candidate,
                province: candidate.province || province,
            })),
            failedProvinces: [],
        };
    }

    return searchAllProvinces(query, isMatric);
}

module.exports = async (senderId, userText, api) => {
    const query = (userText || '').trim();

    // Message d'aide si pas d'argument
    if (!query) {
        await sendMessage(senderId, buildHelpMessage());
        return;
    }

    const words = query.split(/\s+/);

    // Détecter une demande de page dans les arguments
    const pageDetected = detectPage(words);
    let page = 1;
    let searchWords = [...words];
    if (pageDetected) {
        page = pageDetected.page;
        if (pageDetected.index2 !== undefined) {
            searchWords.splice(pageDetected.index, 2);
        } else {
            searchWords.splice(pageDetected.index, 1);
        }
    }

    const provinceDetected = detectProvince(searchWords);
    const selectedProvince = provinceDetected.province;
    const province = selectedProvince || ALL_PROVINCES_KEY;
    if (provinceDetected.count > 0) {
        searchWords.splice(provinceDetected.index, provinceDetected.count);
    }

    const searchTerm = searchWords.join(' ').trim();
    if (!searchTerm) {
        await sendMessage(senderId, buildHelpMessage());
        return;
    }

    const searchByMatricule = isMatricule(searchTerm);
    const searchLabel = searchByMatricule
        ? `Matricule : *${searchTerm}*`
        : `Nom : *${searchTerm}*`;
    const provinceLine = `📍 Province : *${getProvinceLabel(province)}*`;

    // Message d'attente
    await sendMessage(senderId,
        `⏳ *Recherche en cours...*\n` +
        `🔍 ${searchLabel}\n` +
        `${provinceLine}\n` +
        `\n⌛ Veuillez patienter...`
    );

    try {
        const data = await searchResults(searchTerm, searchByMatricule, selectedProvince);
        const resultats = data.resultats || [];
        const failedProvinces = data.failedProvinces || [];

        if (resultats.length === 0) {
            await sendMessage(senderId,
                `❌ *Aucun résultat trouvé*\n\n` +
                `🔍 ${searchLabel}\n` +
                `${provinceLine}\n\n` +
                `⚠️ Aucun candidat trouvé avec cette information.\n` +
                `✏️ Vérifiez l'orthographe ou le matricule et réessayez.\n\n` +
                `💡 Exemple : *${getCommand(province, searchByMatricule ? '3695042' : 'RAKOTO')}*`
            );
            return;
        }

        // Un seul résultat → affichage détaillé
        if (resultats.length === 1) {
            await sendMessage(senderId, buildResultMessage(resultats[0], province));
            return;
        }

        // Plusieurs résultats → liste paginée localement
        const totalResults = resultats.length;
        const totalPages = Math.ceil(totalResults / PER_PAGE);
        if (page > totalPages) page = totalPages;

        const listMsg = buildListMessage(resultats, searchTerm, province, page, totalPages, totalResults, failedProvinces);
        await sendMessage(senderId, listMsg);

    } catch (error) {
        console.error('Erreur commande bacc:', error.message);

        if (error.response) {
            console.error('Status:', error.response.status);
        }

        if (error.response && error.response.status === 404) {
            await sendMessage(senderId,
                `❌ *Introuvable*\n\n` +
                `🔍 ${searchLabel}\n` +
                `${provinceLine}\n\n` +
                `⚠️ Aucun candidat enregistré avec cette information.\n` +
                `✏️ Vérifiez et réessayez.\n\n` +
                `💡 Exemple : *${getCommand(province, searchByMatricule ? '3695042' : 'RAKOTO')}*`
            );
        } else {
            await sendMessage(senderId,
                `🔌 *Erreur de connexion*\n\n` +
                `⚠️ Le serveur Bacc est momentanément inaccessible.\n\n` +
                `⏰ Veuillez réessayer dans quelques instants.\n\n` +
                `🔍 ${searchLabel}\n` +
                provinceLine
            );
        }
    }
};
