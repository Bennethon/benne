export type EditToolbarMode =
    | 'navigate'
    | 'walkable'
    | 'propCollider'
    | 'propBaseline'
    | 'hotspotPolygon'
    | 'regionPolygon'
    | 'roomPoint'
    | 'roomSize'
    | 'scrollBounds';

class PolygonEditBridgeImpl {
    mode: EditToolbarMode = 'navigate';
    walkablePolygonId = '';
    /** Empty string = edit outer ring of {@link walkablePolygonId}; otherwise hole id under that polygon. */
    walkableHoleId = '';
    propId = '';
    hotspotId = '';
    regionId = '';
    roomPointId = '';
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
        this.walkableHoleId = '';
        this.notify();
    }

    /** Outer ring when `holeId` is empty. */
    setWalkableEditTarget(polygonId: string, holeId: string): void {
        this.walkablePolygonId = polygonId;
        this.walkableHoleId = holeId;
        this.notify();
    }

    setPropId(id: string): void {
        this.propId = id;
        this.notify();
    }

    setHotspotId(id: string): void {
        this.hotspotId = id;
        this.notify();
    }

    setRegionId(id: string): void {
        this.regionId = id;
        this.notify();
    }

    setRoomPointId(id: string): void {
        this.roomPointId = id;
        this.notify();
    }

    isEditing(): boolean {
        return this.mode !== 'navigate';
    }
}

export const polygonEditBridge = new PolygonEditBridgeImpl();
