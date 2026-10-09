/**
 * What the Inspector's handler chips, "add handler" and "reveal handler" mean in BenneScript
 * (docs/bennescript-ergonomics-refactor.md §4, §9): a {@link HandlerSpec} names a handler, and this
 * module finds its registrations in a {@link ScriptModel} or writes a stub for it.
 *
 * Pure (no `vscode`).
 */
import type * as TS from 'typescript';
import type { ContentRef, IdsIndex } from './idsIndex';
import { registrationsOn, type Registration, type ScriptModel } from './scriptModel';
import { insertTopLevelStatement, singleQuoted, type ImportNeed, type InsertResult } from './scriptEdits';

export type RoomHook = 'onLoaded' | 'onEnter' | 'onEnterAfterFade' | 'onLeave';
export type GuiHook = 'onBuilt' | 'onShow' | 'onHide';
export type ControlHook = 'onClick' | 'onChange' | 'onSelect' | 'onMouseEnter' | 'onMouseLeave';

/** A clickable or item that verb handlers attach to. */
export type VerbTarget =
    | { kind: 'prop' | 'hotspot'; roomId: string; id: string }
    | { kind: 'character'; roomId: string | null; id: string }
    | { kind: 'item'; id: string };

export type HandlerSpec =
    | { kind: 'verb'; target: VerbTarget; verbId: string }
    /** Any item used on the target (`onAnyItem`, `onUseItem(items.x, …)`, `onItem`, `onCombine`, …). */
    | { kind: 'anyItem'; target: VerbTarget }
    | { kind: 'room'; roomId: string; hook: RoomHook }
    /** `onUpdate` in a room script (it runs in every room, so the stub checks the room). */
    | { kind: 'update'; roomId: string }
    | { kind: 'region'; roomId: string; regionId: string; hook: 'onEnter' | 'onExit' }
    | { kind: 'gui'; guiId: string; hook: GuiHook }
    | { kind: 'control'; guiId: string; controlId: string; hook: ControlHook; valueProperty?: string }
    | { kind: 'choice'; dialogId: string; optionId: string; optionText?: string }
    | { kind: 'playFrom'; name: string };

/** How a spec reads in messages: `battery.onLook`, `room.onEnter`, `playFrom('start')`. */
export function describeHandlerSpec(spec: HandlerSpec, index?: IdsIndex): string {
    switch (spec.kind) {
        case 'verb':
            return `${spec.target.id}.${index ? index.verb(spec.verbId).method : `on…(${spec.verbId})`}`;
        case 'anyItem':
            return `${spec.target.id}.onAnyItem`;
        case 'room':
            return `room.${spec.hook}`;
        case 'update':
            return 'onUpdate';
        case 'region':
            return `regions.${spec.regionId}.${spec.hook}`;
        case 'gui':
            return `gui.${spec.hook}`;
        case 'control':
            return `${spec.controlId}.${spec.hook}`;
        case 'choice':
            return `options.${spec.optionId}.onChoose`;
        case 'playFrom':
            return `playFrom(${singleQuoted(spec.name)})`;
    }
}

function contentOf(spec: HandlerSpec): ContentRef | undefined {
    switch (spec.kind) {
        case 'verb':
        case 'anyItem':
            return spec.target;
        case 'room':
            return { kind: 'room', id: spec.roomId };
        case 'region':
            return { kind: 'region', roomId: spec.roomId, id: spec.regionId };
        case 'gui':
            return { kind: 'gui', id: spec.guiId };
        case 'control':
            return { kind: 'guiControl', guiId: spec.guiId, id: spec.controlId };
        case 'choice':
            return { kind: 'dialogOption', dialogId: spec.dialogId, id: spec.optionId };
        default:
            return undefined;
    }
}

/** Registrations in `model` that implement `spec`, in source order. */
export function findHandlers(model: ScriptModel, index: IdsIndex, spec: HandlerSpec): Registration[] {
    if (spec.kind === 'playFrom') {
        return model.registrations.filter(
            (r) => r.method === 'playFrom' && r.receiver === null && r.args[0]?.kind === 'string' && r.args[0].value.trim() === spec.name,
        );
    }
    if (spec.kind === 'update') {
        return model.registrations.filter((r) => r.method === 'onUpdate' && r.receiver === null);
    }
    const content = contentOf(spec)!;
    const on = registrationsOn(model, index, content, { anyCharacterRoom: true });
    switch (spec.kind) {
        case 'verb': {
            const verb = index.verb(spec.verbId);
            return on.filter((r) => {
                if (r.method === verb.method) {
                    return true;
                }
                if (r.method !== 'on') {
                    return false;
                }
                const first = r.args[0];
                return (
                    (first?.kind === 'string' && first.value === spec.verbId) ||
                    (first?.kind === 'strings' && first.values.includes(spec.verbId))
                );
            });
        }
        case 'anyItem': {
            const itemMethods = new Set(['onAnyItem', 'onItem', 'onCombine', 'onVerbItem']);
            for (const v of index.verbs()) {
                if (v.itemMethod) {
                    itemMethods.add(v.itemMethod);
                }
            }
            return on.filter((r) => itemMethods.has(r.method));
        }
        case 'room':
        case 'region':
        case 'gui':
            return on.filter((r) => r.method === spec.hook);
        case 'control':
            return on.filter((r) => r.method === spec.hook);
        case 'choice':
            return on.filter((r) => r.method === 'onChoose' || r.method === 'onChooseOnce');
    }
}

export type StubPlan = { imports: ImportNeed[]; statement: string } | { error: string };

function bindingOrError(
    index: IdsIndex,
    scriptFile: string,
    ref: ContentRef,
    what: string,
): { imports: ImportNeed[]; expr: string } | { error: string } {
    const binding = index.findBinding(scriptFile, ref);
    if (!binding) {
        return {
            error:
                `No generated handle for ${what}. Run "npm run generate:game-ids" (the dev server and the ` +
                'editor do it on save), then try again.',
        };
    }
    return { imports: [{ module: binding.module, name: binding.name }], expr: binding.expr };
}

function block(head: string, body: readonly string[]): string {
    return `${head} => {\n${body.map((l) => (l ? `  ${l}` : '')).join('\n')}\n})`;
}

/** The imports and statement for a new handler (not yet in the file). */
export function planHandlerStub(index: IdsIndex, scriptFile: string, spec: HandlerSpec): StubPlan {
    switch (spec.kind) {
        case 'playFrom':
            return {
                imports: [{ module: '@benne/script', name: 'playFrom' }],
                statement: block(`playFrom(${singleQuoted(spec.name)}, ()`, [
                    '// Set flags, inventory and props for this starting point. Runs before the room starts.',
                ]),
            };
        case 'update': {
            const room = bindingOrError(index, scriptFile, { kind: 'room', id: spec.roomId }, `room "${spec.roomId}"`);
            if ('error' in room) {
                return room;
            }
            return {
                imports: [
                    { module: '@benne/script', name: 'game' },
                    { module: '@benne/script', name: 'onUpdate' },
                    ...room.imports,
                ],
                statement: block('onUpdate(()', [
                    `if (game.currentRoom !== ${room.expr}) return`,
                    '// Runs every frame. Nothing that takes time (wait, walks, speech) can go here.',
                ]),
            };
        }
        default:
            break;
    }
    const content = contentOf(spec)!;
    const target = bindingOrError(index, scriptFile, content, describeContent(content));
    if ('error' in target) {
        return target;
    }
    const { imports, expr } = target;
    switch (spec.kind) {
        case 'verb': {
            const verb = index.verb(spec.verbId);
            return { imports, statement: block(`${expr}.${verb.method}(()`, [`// TODO: ${verb.label}`]) };
        }
        case 'anyItem':
            return {
                imports,
                statement: block(`${expr}.onAnyItem(()`, [
                    '// Any item used on this. For one item: `.onUseItem(items.x, () => { … })`.',
                    'Player: `That doesn\'t work.`',
                ]),
            };
        case 'room':
        case 'region':
        case 'gui':
            return { imports, statement: block(`${expr}.${spec.hook}(()`, ['// TODO']) };
        case 'control': {
            const body =
                spec.hook === 'onChange' && spec.valueProperty
                    ? [`// The new value is \`${expr}.${spec.valueProperty}\`.`]
                    : spec.hook === 'onSelect'
                      ? [`// The selected row is \`${expr}.selectedIndex\`.`]
                      : ['// TODO'];
            return { imports, statement: block(`${expr}.${spec.hook}(()`, body) };
        }
        case 'choice': {
            const body = spec.optionText ? [`// "${spec.optionText.replace(/\r?\n/g, ' ')}"`] : ['// TODO'];
            return { imports, statement: block(`${expr}.onChoose(()`, body) };
        }
    }
}

export function describeContent(ref: ContentRef): string {
    switch (ref.kind) {
        case 'fallbacks':
            return 'fallbacks';
        case 'prop':
        case 'hotspot':
        case 'point':
        case 'region':
        case 'walkable':
            return `${ref.kind} "${ref.id}" in room "${ref.roomId}"`;
        case 'dialogOption':
            return `option "${ref.id}" of dialog "${ref.dialogId}"`;
        case 'guiControl':
            return `control "${ref.id}" of GUI "${ref.guiId}"`;
        default:
            return `${ref.kind} "${ref.id}"`;
    }
}

/** Inserts the stub for `spec` into `text` (imports + a statement at the end). */
export function insertHandlerStub(
    ts: typeof TS,
    index: IdsIndex,
    scriptFile: string,
    text: string,
    spec: HandlerSpec,
): InsertResult | { error: string } {
    const plan = planHandlerStub(index, scriptFile, spec);
    if ('error' in plan) {
        return plan;
    }
    return insertTopLevelStatement(ts, scriptFile, text, plan.imports, plan.statement);
}
