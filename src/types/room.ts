/** Room metadata and layout references (loaded from JSON). */
export interface RoomDefinition {
  id: string;
  name: string;
  background: {
    /** Texture key after load, or asset path resolved by loader */
    textureKey: string;
  };
  objects: InteractiveObjectDefinition[];
}

export interface InteractiveObjectDefinition {
  id: string;
  /** Hit area in internal resolution pixels */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Event id dispatched on interaction */
  onUse?: string;
  onLook?: string;
}
