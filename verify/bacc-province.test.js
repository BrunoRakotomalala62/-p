/**
 * Vérifie que la commande Everyone `bacc` transmet correctement la province
 * sélectionnée, agrège les recherches par nom sans province et conserve une
 * recherche unique par matricule.
 *
 * Exécution : node verify/bacc-province.test.js
 * Aucun secret Facebook n’est requis : sendMessage est remplacé par un stub.
 */
const assert = require('assert');
const Module = require('module');

const originalRequire = Module.prototype.require;
const captured = [];

Module.prototype.require = function (id) {
    if (id === '../handles/sendMessage' || id === './sendMessage') {
        return async (recipientId, text) => {
            const body = typeof text === 'string' ? text : JSON.stringify(text);
            captured.push({ recipientId, body });
            return { success: true };
        };
    }
    return originalRequire.apply(this, arguments);
};

const handleMessage = require('../handles/handleMessage');

(async () => {
    await handleMessage({
        sender: { id: 'verify-antsiranana-name' },
        message: { mid: 'bacc-antsiranana-name', text: 'bacc antsiranana RAKOTOMALALA' },
    }, {});

    const nameReplies = captured.filter((reply) => reply.recipientId === 'verify-antsiranana-name');
    assert(nameReplies.length >= 2, 'La commande doit envoyer un message d’attente et une réponse de résultat.');
    const nameResult = nameReplies[nameReplies.length - 1].body;
    assert(/Antsiranana/i.test(nameResult), `La province Antsiranana doit apparaître dans la réponse : ${nameResult}`);
    assert(/RAKOTOMALALA|résultat|RÉSULTAT/i.test(nameResult), `La réponse doit contenir le résultat de recherche : ${nameResult}`);

    await handleMessage({
        sender: { id: 'verify-global-name' },
        message: { mid: 'bacc-global-name', text: 'bacc RAKOTOMALALA' },
    }, {});

    const globalNameReplies = captured.filter((reply) => reply.recipientId === 'verify-global-name');
    assert(globalNameReplies.length >= 2, 'Une recherche par nom sans province doit renvoyer une réponse.');
    const globalNameResult = globalNameReplies[globalNameReplies.length - 1].body;
    assert(/Toutes les provinces/i.test(globalNameResult), `La recherche globale doit être signalée : ${globalNameResult}`);
    assert(/page 1\//i.test(globalNameResult), `Les résultats globaux doivent être paginés lorsqu’ils sont nombreux : ${globalNameResult}`);

    await handleMessage({
        sender: { id: 'verify-global-matricule' },
        message: { mid: 'bacc-global-matricule', text: 'bacc 1186047' },
    }, {});

    const globalMatriculeReplies = captured.filter((reply) => reply.recipientId === 'verify-global-matricule');
    assert(globalMatriculeReplies.length >= 2, 'Une recherche par matricule sans province doit renvoyer une réponse.');
    const globalMatriculeResult = globalMatriculeReplies[globalMatriculeReplies.length - 1].body;
    assert(/Antsiranana/i.test(globalMatriculeResult), `Le matricule global doit identifier sa province : ${globalMatriculeResult}`);
    assert(/1186047/.test(globalMatriculeResult), `Le matricule doit apparaître dans la réponse : ${globalMatriculeResult}`);

    await handleMessage({
        sender: { id: 'verify-antsiaranana-matricule' },
        message: { mid: 'bacc-antsiaranana-matricule', text: 'bacc antsiaranana 1186047' },
    }, {});

    const matriculeReplies = captured.filter((reply) => reply.recipientId === 'verify-antsiaranana-matricule');
    assert(matriculeReplies.length >= 2, 'L’alias antsiaranana doit déclencher une recherche.');
    const matriculeResult = matriculeReplies[matriculeReplies.length - 1].body;
    assert(/Antsiranana/i.test(matriculeResult), `L’alias doit être normalisé vers Antsiranana : ${matriculeResult}`);
    assert(/1186047/.test(matriculeResult), `Le matricule doit apparaître dans la réponse : ${matriculeResult}`);

    console.log('OK: la commande bacc gère les recherches par province, la recherche globale par nom et le matricule unique.');
    process.exit(0);
})().catch((error) => {
    console.error('FAILED:', error);
    process.exit(1);
});
