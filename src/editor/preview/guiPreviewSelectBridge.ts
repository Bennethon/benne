/**
 * Selected GUI control key (`type:id:index`) for the editor preview move gizmo.
 * Mirrors {@link polygonEditBridge}: a single mutable value plus subscribe/notify.
 */
class GuiPreviewSelectBridgeImpl {
    selectedControlKey = '';
    private readonly listeners = new Set<() => void>();

    subscribe(fn: () => void): () => void {
        this.listeners.add(fn);
        return () => {
            this.listeners.delete(fn);
        };
    }

    private notify(): void {
        for (const f of this.listeners) {
            f();
        }
    }

    setSelectedControlKey(key: string): void {
        this.selectedControlKey = key;
        this.notify();
    }
}

export const guiPreviewSelectBridge = new GuiPreviewSelectBridgeImpl();
