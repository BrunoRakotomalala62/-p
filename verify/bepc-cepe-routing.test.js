/**
 * Verification script for the "Set up the imported project" task.
 *
 * Confirms that:
 *  1. Sending the bare word "bepc" through handleMessage routes to the
 *     Everyone/bepc.js command (the "enter matricule/nom" prompt) instead
 *     of falling back to the Gemini AI handler.
 *  2. Sending "bepc <matricule>" resolves against the live BEPC API
 *     (https://valina-cepe-2026-jt24.onrender.com/api/bepc) and returns a
 *     formatted result.
 *
 * Run with: node verify/bepc-cepe-routing.test.js
 * (No Facebook secrets required — sendMessage is stubbed out.)
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
    // Test 1: bare "bepc" must NOT fall through to Gemini.
    await handleMessage({ sender: { id: 'verify-user-1' }, message: { mid: 'v1', text: 'bepc' } }, {});
    const firstReply = captured.find(c => c.recipientId === 'verify-user-1');
    assert(firstReply, 'Expected a reply to bare "bepc"');
    assert(
        /RÉSULTATS BEPC|matricule/i.test(firstReply.body),
        `Expected the BEPC prompt, got: ${firstReply.body}`
    );

    // Test 2: "bepc <matricule>" must call the live API and return a result.
    await handleMessage({ sender: { id: 'verify-user-2' }, message: { mid: 'v2', text: 'bepc 035AM00532-T06/03' } }, {});
    const replies = captured.filter(c => c.recipientId === 'verify-user-2');
    assert(replies.length >= 2, 'Expected a "searching" message plus a result message');
    const resultReply = replies[replies.length - 1];
    assert(
        /RÉSULTAT|Introuvable|Aucun résultat/i.test(resultReply.body),
        `Expected a BEPC API result/error, got: ${resultReply.body}`
    );

    console.log('OK: bepc/cepe Everyone-command routing works and reaches the live API.');
    process.exit(0);
})().catch(err => {
    console.error('FAILED:', err);
    process.exit(1);
});
