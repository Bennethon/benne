import * as assert from 'assert';
import {
    exportSpeakingTextRowsForFiles,
    planVoiceIdsForFiles,
    serializeSpeakingTextRowsAsCsv,
} from '../voiceIdProcessor';

suite('Voice ID Processor', () => {
    test('preserve mode assigns missing direct say markers after sidecar high water mark', () => {
        const plan = planVoiceIdsForFiles(
            [
                {
                    path: 'src/game/rooms/apartment/apartment.room.ts',
                    text: [
                        "B.player.say('Hello there.');",
                        'B.character("penny").say("Hi Hank.");',
                    ].join('\n'),
                },
            ],
            { hank: 3 },
            { mode: 'preserve', startingPlayerCharacterId: 'hank', knownCharacterIds: ['hank', 'penny'] },
        );

        assert.strictEqual(plan.assignedCount, 2);
        assert.deepStrictEqual(plan.sidecar, { hank: 4, penny: 1 });
        assert.strictEqual(
            plan.changes[0].proposedText,
            [
                "B.player.say('|4| Hello there.');",
                'B.character("penny").say("|1| Hi Hank.");',
            ].join('\n'),
        );
    });

    test('preserve mode leaves existing markers and records their highest ids', () => {
        const plan = planVoiceIdsForFiles(
            [
                {
                    path: 'src/game/globalScript.ts',
                    text: 'B.player.say("|7| That doesn\\\'t work.");',
                },
            ],
            {},
            { mode: 'preserve', startingPlayerCharacterId: 'hank', knownCharacterIds: ['hank'] },
        );

        assert.strictEqual(plan.assignedCount, 0);
        assert.strictEqual(plan.preservedCount, 1);
        assert.deepStrictEqual(plan.sidecar, { hank: 7 });
        assert.deepStrictEqual(plan.changes, []);
    });

    test('overwrite mode strips existing markers and restarts sequential numbers', () => {
        const plan = planVoiceIdsForFiles(
            [
                {
                    path: 'src/game/rooms/outside/outside.room.ts',
                    text: [
                        "B.player.say('|9| First.');",
                        "B.player.say('Second.');",
                    ].join('\n'),
                },
            ],
            { hank: 99 },
            { mode: 'overwrite', startingPlayerCharacterId: 'hank', knownCharacterIds: ['hank'] },
        );

        assert.strictEqual(plan.assignedCount, 2);
        assert.strictEqual(plan.strippedCount, 1);
        assert.deepStrictEqual(plan.sidecar, { hank: 2 });
        assert.strictEqual(
            plan.changes[0].proposedText,
            ["B.player.say('|1| First.');", "B.player.say('|2| Second.');"].join('\n'),
        );
    });

    test('processes free and fixed tagged templates', () => {
        const plan = planVoiceIdsForFiles(
            [
                {
                    path: 'src/game/dialogs/chat/chat.dialog.ts',
                    text: [
                        'B.say`',
                        '  Player: Hello.',
                        '  Penny: Hi!',
                        '`;',
                        "B.character('penny').say`",
                        '  Thanks.',
                        '`;',
                    ].join('\n'),
                },
            ],
            {},
            { mode: 'preserve', startingPlayerCharacterId: 'hank', knownCharacterIds: ['hank', 'penny'] },
        );

        assert.deepStrictEqual(plan.sidecar, { hank: 1, penny: 2 });
        assert.strictEqual(
            plan.changes[0].proposedText,
            [
                'B.say`',
                '  Player: |1| Hello.',
                '  Penny: |1| Hi!',
                '`;',
                "B.character('penny').say`",
                '  |2| Thanks.',
                '`;',
            ].join('\n'),
        );
    });

    test('ignores comments and unrelated string contents', () => {
        const plan = planVoiceIdsForFiles(
            [
                {
                    path: 'src/game/rooms/apartment/apartment.room.ts',
                    text: [
                        "// B.player.say('Nope.');",
                        "const sample = \"B.player.say('Nope.')\";",
                        "B.player.say('Yes.');",
                    ].join('\n'),
                },
            ],
            {},
            { mode: 'preserve', startingPlayerCharacterId: 'hank', knownCharacterIds: ['hank'] },
        );

        assert.strictEqual(plan.assignedCount, 1);
        assert.strictEqual(
            plan.changes[0].proposedText,
            [
                "// B.player.say('Nope.');",
                "const sample = \"B.player.say('Nope.')\";",
                "B.player.say('|1| Yes.');",
            ].join('\n'),
        );
    });

    test('exports direct say rows with optional voice ids', () => {
        const result = exportSpeakingTextRowsForFiles(
            [
                {
                    path: 'src/game/rooms/apartment/apartment.room.ts',
                    text: [
                        "B.player.say('|4| Hello there.');",
                        'B.character("penny").say("Hi Hank.");',
                    ].join('\n'),
                },
            ],
            { startingPlayerCharacterId: 'hank', knownCharacterIds: ['hank', 'penny'] },
        );

        assert.deepStrictEqual(result.rows, [
            {
                character: 'hank',
                id: '4',
                script: 'apartment.room.ts',
                line: 'Hello there.',
            },
            {
                character: 'penny',
                id: '',
                script: 'apartment.room.ts',
                line: 'Hi Hank.',
            },
        ]);
        assert.strictEqual(result.skippedCount, 0);
    });

    test('exports free and fixed tagged template rows', () => {
        const result = exportSpeakingTextRowsForFiles(
            [
                {
                    path: 'src/game/dialogs/chat/chat.dialog.ts',
                    text: [
                        'B.say`',
                        '  Player: |1| Hello.',
                        '  Penny: |2| Hi!',
                        '`;',
                        "B.character('penny').say`",
                        '  |3| Thanks.',
                        '`;',
                    ].join('\n'),
                },
            ],
            { startingPlayerCharacterId: 'hank', knownCharacterIds: ['hank', 'penny'] },
        );

        assert.deepStrictEqual(result.rows, [
            { character: 'hank', id: '1', script: 'chat.dialog.ts', line: 'Hello.' },
            { character: 'penny', id: '2', script: 'chat.dialog.ts', line: 'Hi!' },
            { character: 'penny', id: '3', script: 'chat.dialog.ts', line: 'Thanks.' },
        ]);
        assert.strictEqual(result.skippedCount, 0);
    });

    test('serializes speaking text CSV for Excel', () => {
        const csv = serializeSpeakingTextRowsAsCsv([
            {
                character: 'hank',
                id: '7',
                script: 'room.ts',
                line: 'Hello, "pal"\nNext',
            },
        ]);

        assert.strictEqual(csv, '\uFEFFCharacter,ID,Script,Line\r\nhank,7,room.ts,"Hello, ""pal""\nNext"\r\n');
    });
});
