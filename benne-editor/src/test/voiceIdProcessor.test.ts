import * as assert from 'assert';
import * as path from 'node:path';
import * as ts from 'typescript';
import { IdsIndex } from '../bennescript/idsIndex';
import { buildSpeakerTable } from '../bennescript/speakers';
import {
    exportSpeakingTextRowsForFiles,
    planVoiceIdsForFiles,
    serializeSpeakingTextRowsAsCsv,
    type VoiceIdTextFileInput,
} from '../voiceIdProcessor';

/** A tiny game: Hank (player), Penny ("Penny Lane"), BOTT-i3 in the apartment. */
const gameRoot = path.resolve('/tmp/voice-game/src/game');
const generated = new Map<string, string>([
    [
        path.join(gameRoot, 'game.ids.ts'),
        [
            "import { CharacterHandle, RoomHandle } from '@benne/script';",
            'export const rooms = { apartment: new RoomHandle("apartment") };',
            'export const characters = {',
            '  hank: new CharacterHandle(null, "hank"),',
            '  penny: new CharacterHandle(null, "penny"),',
            '  botti3: new CharacterHandle(null, "botti3"),',
            '};',
        ].join('\n'),
    ],
    [
        path.join(gameRoot, 'rooms/apartment/apartment.ids.ts'),
        [
            "import { CharacterHandle } from '@benne/script';",
            "import { rooms } from '@game';",
            'export const room = rooms.apartment;',
            'export const penny = new CharacterHandle("apartment", "penny");',
        ].join('\n'),
    ],
]);
const scan = {
    startingPlayerCharacterId: 'hank',
    speakers: buildSpeakerTable([
        { id: 'hank', name: 'Hank' },
        { id: 'penny', name: 'Penny Lane' },
        { id: 'botti3', name: 'BOTT-i3' },
    ]),
    index: new IdsIndex(ts, gameRoot, (file) => generated.get(path.resolve(file))),
};

const roomFile = (lines: string[]): VoiceIdTextFileInput => ({
    path: 'src/game/rooms/apartment/apartment.room.ts',
    fileName: path.join(gameRoot, 'rooms/apartment/apartment.room.ts'),
    text: lines.join('\n'),
});

const HEADER = [
    "import { player, say } from '@benne/script';",
    "import { characters } from '@game';",
    "import { room, penny } from './apartment.ids';",
];

suite('Voice ID Processor', () => {
    test('preserve mode assigns missing markers after the sidecar high water mark', () => {
        const file = roomFile([
            ...HEADER,
            'room.onEnter(() => {',
            '  Hank: "Hello there."',
            "  penny.say('Hi Hank.')",
            '  PennyLane: `Nice ${1 + 1} see you.`',
            '})',
        ]);
        const plan = planVoiceIdsForFiles([file], { hank: 3 }, { mode: 'preserve', ...scan });

        assert.strictEqual(plan.assignedCount, 3);
        assert.deepStrictEqual(plan.sidecar, { hank: 4, penny: 2 });
        assert.strictEqual(
            plan.changes[0].proposedText,
            roomFile([
                ...HEADER,
                'room.onEnter(() => {',
                '  Hank: "|4| Hello there."',
                "  penny.say('|1| Hi Hank.')",
                '  PennyLane: `|2| Nice ${1 + 1} see you.`',
                '})',
            ]).text,
        );
    });

    test('preserve mode leaves existing markers and records their highest ids', () => {
        const plan = planVoiceIdsForFiles(
            [
                {
                    path: 'src/game/globalScript.ts',
                    fileName: path.join(gameRoot, 'globalScript.ts'),
                    text: "import { fallbacks } from '@game';\nfallbacks.onUse(() => { Player: \"|7| That doesn't work.\" })\n",
                },
            ],
            {},
            { mode: 'preserve', ...scan },
        );

        assert.strictEqual(plan.assignedCount, 0);
        assert.strictEqual(plan.preservedCount, 1);
        assert.deepStrictEqual(plan.sidecar, { hank: 7 });
        assert.deepStrictEqual(plan.changes, []);
    });

    test('overwrite mode strips existing markers and restarts sequential numbers', () => {
        const file = roomFile([
            ...HEADER,
            'room.onEnter(() => {',
            "  player.say('|9| First.')",
            '  Player: "Second."',
            '})',
        ]);
        const plan = planVoiceIdsForFiles([file], { hank: 20 }, { mode: 'overwrite', ...scan });

        assert.strictEqual(plan.assignedCount, 2);
        assert.strictEqual(plan.strippedCount, 1);
        assert.deepStrictEqual(plan.sidecar, { hank: 2 });
        assert.ok(plan.changes[0].proposedText.includes("player.say('|1| First.')"));
        assert.ok(plan.changes[0].proposedText.includes('Player: "|2| Second."'));
    });

    test('processes say blocks with speakers written as in JSON', () => {
        const file = roomFile([
            ...HEADER,
            'room.onEnter(() => {',
            '  say`',
            '    Hank: Hello.',
            '    BOTT-i3: |5| Greetings.',
            '    Penny Lane: Hi!',
            '  `',
            '})',
        ]);
        const plan = planVoiceIdsForFiles([file], {}, { mode: 'preserve', ...scan });

        assert.strictEqual(plan.assignedCount, 2);
        assert.strictEqual(plan.preservedCount, 1);
        assert.ok(plan.changes[0].proposedText.includes('    Hank: |1| Hello.\n'));
        assert.ok(plan.changes[0].proposedText.includes('    Penny Lane: |1| Hi!\n'));
    });

    test('ignores comments, plain strings and ordinary labels; skips lines it cannot attribute', () => {
        const file = roomFile([
            ...HEADER,
            '// Hank: "commented"',
            'const s = "Hank: not speech"',
            'const who = characters.penny',
            'room.onEnter(() => {',
            '  outer: for (;;) break outer',
            "  who.say('Through a variable.')",
            '  Hank: s',
            '})',
        ]);
        const result = exportSpeakingTextRowsForFiles([file], scan);

        assert.deepStrictEqual(result.rows, [
            { character: 'penny', id: '', script: 'apartment.room.ts', line: 'Through a variable.' },
        ]);
        assert.strictEqual(result.skippedCount, 1);
    });

    test('exports rows with optional voice ids', () => {
        const file = roomFile([
            ...HEADER,
            'room.onEnter(() => {',
            '  Hank: "|1| Hello."',
            '  characters.botti3.say("Hi.")',
            '})',
        ]);
        const result = exportSpeakingTextRowsForFiles([file], scan);

        assert.deepStrictEqual(result.rows, [
            { character: 'hank', id: '1', script: 'apartment.room.ts', line: 'Hello.' },
            { character: 'botti3', id: '', script: 'apartment.room.ts', line: 'Hi.' },
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

        assert.strictEqual(csv, '﻿Character,ID,Script,Line\r\nhank,7,room.ts,"Hello, ""pal""\nNext"\r\n');
    });
});
