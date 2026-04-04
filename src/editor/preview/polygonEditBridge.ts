export type EditToolbarMode = 'navigate' | 'walkable' | 'propCollider';

class PolygonEditBridgeImpl {
    mode: EditToolbarMode = 'navigate';
    walkablePolygonId = '';
    propId = '';
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

    setMode(m: EditToolbarMode): void {
        this.mode = m;
        this.notify();
    }

    setWalkablePolygonId(id: string): void {
        this.walkablePolygonId = id;
        this.notify();
    }

    setPropId(id: string): void {
        this.propId = id;
        this.notify();
    }

    isEditing(): boolean {
        return this.mode !== 'navigate';
    }
}

export const polygonEditBridge = new PolygonEditBridgeImpl();
