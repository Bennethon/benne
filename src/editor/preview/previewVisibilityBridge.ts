/**
 * Small state holder for the BENNE room preview visibility toggles (**GUIs**, **Characters**,
 * **Outlines**).
 *
 * Mirrors the pattern of {@link polygonEditBridge}: mutable flags plus a subscribe/notify API so the
 * DOM toolbar and the live `RoomScene` stay in sync without passing references around. The flags are
 * preview-only view state: the webview persists them via `vscode.getState()`, never in room JSON.
 */
export type PreviewVisibilityKey = 'guis' | 'characters' | 'outlines';

export type PreviewVisibility = Record<PreviewVisibilityKey, boolean>;

class PreviewVisibilityBridgeImpl {
    /**
     * Defaults on first ever open: GUIs and outlines off (polygon / walkable authoring usually wants a
     * clean view), characters on.
     */
    readonly state: PreviewVisibility = { guis: false, characters: true, outlines: false };

    private readonly listeners = new Set<(key: PreviewVisibilityKey, visible: boolean) => void>();

    subscribe(fn: (key: PreviewVisibilityKey, visible: boolean) => void): () => void {
        this.listeners.add(fn);
        return () => {
            this.listeners.delete(fn);
        };
    }

    setVisible(key: PreviewVisibilityKey, visible: boolean): void {
        if (this.state[key] === visible) {
            return;
        }
        this.state[key] = visible;
        for (const f of this.listeners) {
            f(key, visible);
        }
    }
}

export const previewVisibilityBridge = new PreviewVisibilityBridgeImpl();
