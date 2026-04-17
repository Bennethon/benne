/**
 * Small state holder for the BENNE room preview "Show GUIs" toolbar toggle.
 *
 * Mirrors the pattern of {@link polygonEditBridge}: a single mutable flag plus a subscribe/notify
 * API so the DOM toolbar and the live `RoomScene` (via `RoomScene.setGenericGuisVisible`) stay
 * in sync without passing references around.
 */
class GuiVisibilityBridgeImpl {
    /**
     * Whether non-`dialog-text` GUI overlays should be visible in the room preview. The webview
     * persists this across reloads via `vscode.getState()`; default on first ever open is `false`.
     */
    visible = false;

    private readonly listeners = new Set<(visible: boolean) => void>();

    subscribe(fn: (visible: boolean) => void): () => void {
        this.listeners.add(fn);
        return () => {
            this.listeners.delete(fn);
        };
    }

    setVisible(visible: boolean): void {
        if (this.visible === visible) {
            return;
        }
        this.visible = visible;
        for (const f of this.listeners) {
            f(visible);
        }
    }
}

export const guiVisibilityBridge = new GuiVisibilityBridgeImpl();
