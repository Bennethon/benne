import * as assert from 'node:assert/strict';
import { proposeIdFromName } from '../nameAndIdPrompt';

suite('Create wizard id proposal', () => {
    test('slugifies the display name', () => {
        assert.equal(proposeIdFromName('Rusty Bucket!', 'item'), 'rusty-bucket');
        assert.equal(proposeIdFromName('  Clerk — small talk ', 'dialog'), 'clerk-small-talk');
        assert.equal(proposeIdFromName('Kitchen 2', 'room'), 'kitchen-2');
    });
    test('falls back when the name has no usable characters', () => {
        assert.equal(proposeIdFromName('   ', 'room'), 'room');
        assert.equal(proposeIdFromName('—!?', 'puzzle-chart'), 'puzzle-chart');
    });
});
