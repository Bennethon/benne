import * as Phaser from 'phaser';

import {
  BENNE_MULTI_FRAG_SOURCE,
  BENNE_MULTI_VERT_SOURCE,
  benneMakeApplyLighting,
  benneMakeApplyTint,
  benneMakeDefineLights,
  benneMakeDefineTexCount,
  benneMakeGetNormalFromMap,
  benneMakeGetTexture1,
  benneMakeGetTexCoordOut,
  benneMakeGetTexRes,
  benneMakeOutInverseRotation,
  benneMakeRotationDatum,
  benneMakeSmoothPixelArt,
} from './phaserQuadStandardShaderInline.js';

type BenneQuadRenderOptions = { texRes?: boolean; [key: string]: unknown };

/** Same as stock {@link Phaser.Renderer.WebGL.RenderNodes.BatchHandlerQuad} name for `setRenderNodeRole`. */
export const BENNE_CHARACTER_BATCH_HANDLER_NAME = 'BatchHandlerBenneCharacterQuad';

/** Companion submitter that brackets each draw with {@link benneCharacterBatchObjectStack}. */
export const BENNE_CHARACTER_SUBMITTER_NAME = 'SubmitterBenneCharacterQuad';

const PERSP_EPS = 0.00015;

const benneCharacterPerspectiveShaderAddition = {
  name: 'BenneCharacterPerspective',
  additions: {
    vertexDefine: 'attribute float inPerspMag;\n',
    outVariables: 'varying float outPerspMag;\n',
    vertexProcess: 'outPerspMag = inPerspMag;\n',
    fragmentHeader: [
      '// mag = sprite scale (e.g. 0.25). Bucket width ≈ 1/mag source pixels; integer plateau keeps',
      '// snap stable while mag drifts (region scale vs feet Y), so LINEAR does not smear mid-motion.',
      'vec2 bennePerspectiveTexCoord(vec2 uv, float mag, vec2 texWH) {',
      '    float m = clamp(mag, 0.0001, 1.0);',
      '    float rawStep = 1.0 / m;',
      '    float stepPx = max(1.0, floor(rawStep + 0.5));',
      '    vec2 cont = uv * texWH;',
      '    vec2 g = floor(cont / stepPx);',
      '    vec2 maxG = max(floor((texWH - vec2(1.0)) / stepPx), vec2(0.0));',
      '    g = clamp(g, vec2(0.0), maxG);',
      '    vec2 atlasPix = g * stepPx + stepPx * 0.5;',
      '    atlasPix = min(atlasPix, texWH - vec2(0.5));',
      '    vec2 snapped = floor(atlasPix + vec2(1e-3)) + vec2(0.5);',
      '    return snapped / texWH;',
      '}',
    ].join('\n'),
    // Runs after SmoothPixelArt when enabled: near-scale-1 keeps prior texCoord (blocky path);
    // scaled-down sprites replace with perspective UVs from linear outTexCoord.
    texCoord: [
      'if (outPerspMag < (1.0 - ' + String(PERSP_EPS) + ')) {',
      '    texCoord = bennePerspectiveTexCoord(outTexCoord, outPerspMag, uMainResolution[0]);',
      '}',
    ].join('\n'),
  },
  disable: false,
};

const benneCharacterQuadConfig = {
  name: BENNE_CHARACTER_BATCH_HANDLER_NAME,
  verticesPerInstance: 4,
  indicesPerInstance: 6,
  shaderName: 'STANDARD',
  vertexSource: BENNE_MULTI_VERT_SOURCE,
  fragmentSource: BENNE_MULTI_FRAG_SOURCE,
  shaderAdditions: [
    benneMakeGetTexCoordOut(),
    benneMakeGetTexRes(),
    benneMakeSmoothPixelArt(true),
    benneCharacterPerspectiveShaderAddition,
    benneMakeDefineTexCount(1),
    benneMakeGetTexture1(),
    benneMakeApplyTint(),
    benneMakeDefineLights(true),
    benneMakeRotationDatum(true),
    benneMakeOutInverseRotation(true),
    benneMakeGetNormalFromMap(true),
    benneMakeApplyLighting(true),
  ] as Phaser.Types.Renderer.WebGL.ShaderAdditionConfig[],
  vertexBufferLayout: {
    usage: 'DYNAMIC_DRAW',
    layout: [
      { name: 'inPosition', size: 2 },
      { name: 'inTexCoord', size: 2 },
      { name: 'inTexDatum' },
      { name: 'inTintEffect' },
      { name: 'inTint', size: 4, type: 'UNSIGNED_BYTE', normalized: true },
      { name: 'inPerspMag' },
    ],
  },
};

const registeredGames = new WeakSet<Phaser.Game>();

/** Stack of sprites/images currently inside Benne character submitter `run` (re-entrancy safe). */
const benneCharacterBatchObjectStack: Phaser.GameObjects.GameObject[] = [];

type BatchHandlerQuadClass = typeof Phaser.Renderer.WebGL.RenderNodes.BatchHandlerQuad;
type SubmitterQuadClass = typeof Phaser.Renderer.WebGL.RenderNodes.SubmitterQuad;

/**
 * Registers {@link BENNE_CHARACTER_BATCH_HANDLER_NAME} and {@link BENNE_CHARACTER_SUBMITTER_NAME}
 * on the game's WebGL render node manager. Safe to call multiple times per game instance.
 */
export function registerBenneCharacterPerspectiveBatch(game: Phaser.Game): void {
  if (registeredGames.has(game)) {
    return;
  }
  const renderer = game.renderer as Phaser.Renderer.WebGL.WebGLRenderer | null;
  if (!renderer?.renderNodes?.addNodeConstructor) {
    return;
  }
  const BaseBatch = Phaser.Renderer.WebGL.RenderNodes.BatchHandlerQuad as BatchHandlerQuadClass;
  const BaseSubmitter = Phaser.Renderer.WebGL.RenderNodes.SubmitterQuad as SubmitterQuadClass;

  class BatchHandlerBenneCharacterQuad extends BaseBatch {
    constructor(manager: Phaser.Renderer.WebGL.RenderNodes.RenderNodeManager) {
      super(manager, benneCharacterQuadConfig);
      const ro = this.renderOptions as BenneQuadRenderOptions;
      const nr = this.nextRenderOptions as BenneQuadRenderOptions;
      ro.texRes = true;
      nr.texRes = true;
    }

    /**
     * Keep {@link Phaser.Renderer.WebGL.RenderNodes.BatchHandlerQuad#renderOptions}.texRes true so
     * GetTexRes stays enabled and texture dimensions are uploaded, even when smooth pixel art is off.
     */
    updateRenderOptions(
      renderOptions?: Phaser.Types.Renderer.WebGL.RenderNodes.BatchHandlerQuadRenderOptions,
    ): void {
      super.updateRenderOptions(renderOptions ?? ({} as object));
      const next = this.nextRenderOptions as BenneQuadRenderOptions;
      if (next.texRes !== true) {
        next.texRes = true;
        (this as unknown as { _renderOptionsChanged: boolean })._renderOptionsChanged = true;
      }
    }

    batch(
      currentContext: Phaser.Renderer.WebGL.DrawingContext,
      glTexture: Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper,
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      x3: number,
      y3: number,
      texX: number,
      texY: number,
      texWidth: number,
      texHeight: number,
      tintMode: number,
      tintTL: number,
      tintBL: number,
      tintTR: number,
      tintBR: number,
      renderOptions: Phaser.Types.Renderer.WebGL.RenderNodes.BatchHandlerQuadRenderOptions,
    ): void {
      const top = benneCharacterBatchObjectStack[benneCharacterBatchObjectStack.length - 1];
      const mag =
        top && 'scaleX' in top && 'scaleY' in top
          ? Math.max(Math.abs(top.scaleX as number), Math.abs(top.scaleY as number))
          : 1;

      if (this.instanceCount === 0) {
        this.manager.setCurrentBatchNode(this, currentContext);
      }

      this.updateRenderOptions(renderOptions);
      if ((this as unknown as { _renderOptionsChanged: boolean })._renderOptionsChanged) {
        this.run(currentContext);
        this.updateShaderConfig();
      }

      const textureDatum = this.batchTextures(glTexture, renderOptions);

      let vo = this.instanceCount * this.floatsPerInstance;
      const vertexBuffer = this.vertexBufferLayout.buffer;
      const vertexViewF32 = vertexBuffer.viewF32!;
      const vertexViewU32 = vertexBuffer.viewU32!;

      // Bottom-left
      vertexViewF32[vo++] = x1;
      vertexViewF32[vo++] = y1;
      vertexViewF32[vo++] = texX;
      vertexViewF32[vo++] = texY + texHeight;
      vertexViewF32[vo++] = textureDatum;
      vertexViewF32[vo++] = tintMode;
      vertexViewU32[vo++] = tintBL;
      vertexViewF32[vo++] = mag;

      // Top-left
      vertexViewF32[vo++] = x0;
      vertexViewF32[vo++] = y0;
      vertexViewF32[vo++] = texX;
      vertexViewF32[vo++] = texY;
      vertexViewF32[vo++] = textureDatum;
      vertexViewF32[vo++] = tintMode;
      vertexViewU32[vo++] = tintTL;
      vertexViewF32[vo++] = mag;

      // Bottom-right
      vertexViewF32[vo++] = x3;
      vertexViewF32[vo++] = y3;
      vertexViewF32[vo++] = texX + texWidth;
      vertexViewF32[vo++] = texY + texHeight;
      vertexViewF32[vo++] = textureDatum;
      vertexViewF32[vo++] = tintMode;
      vertexViewU32[vo++] = tintBR;
      vertexViewF32[vo++] = mag;

      // Top-right
      vertexViewF32[vo++] = x2;
      vertexViewF32[vo++] = y2;
      vertexViewF32[vo++] = texX + texWidth;
      vertexViewF32[vo++] = texY;
      vertexViewF32[vo++] = textureDatum;
      vertexViewF32[vo++] = tintMode;
      vertexViewU32[vo++] = tintTR;
      vertexViewF32[vo++] = mag;

      this.instanceCount++;
      this.currentBatchEntry.count++;

      if (this.instanceCount === this.instancesPerBatch) {
        this.run(currentContext);
      }
    }
  }

  class SubmitterBenneCharacterQuad extends BaseSubmitter {
    constructor(manager: Phaser.Renderer.WebGL.RenderNodes.RenderNodeManager) {
      super(manager);
    }

    run(
      drawingContext: Phaser.Renderer.WebGL.DrawingContext,
      gameObject: Phaser.GameObjects.GameObject,
      parentMatrix: Phaser.GameObjects.Components.TransformMatrix,
      element: unknown,
      texturerNode: Phaser.Renderer.WebGL.RenderNodes.RenderNode,
      transformerNode: Phaser.Renderer.WebGL.RenderNodes.RenderNode | { quad: Float32Array },
      tinterNode?: Phaser.Renderer.WebGL.RenderNodes.RenderNode,
      normalMap?: Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper,
      normalMapRotation?: number,
    ): void {
      benneCharacterBatchObjectStack.push(gameObject);
      try {
        BaseSubmitter.prototype.run.call(
          this,
          drawingContext,
          gameObject,
          parentMatrix,
          element as object,
          texturerNode,
          transformerNode as object,
          tinterNode,
          normalMap,
          normalMapRotation,
        );
      } finally {
        benneCharacterBatchObjectStack.pop();
      }
    }
  }

  renderer.renderNodes.addNodeConstructor(BENNE_CHARACTER_BATCH_HANDLER_NAME, BatchHandlerBenneCharacterQuad);
  renderer.renderNodes.addNodeConstructor(BENNE_CHARACTER_SUBMITTER_NAME, SubmitterBenneCharacterQuad);
  registeredGames.add(game);
}

/** Applies Benne character WebGL nodes after Phaser `initRenderNodes` (both roles required). */
export function attachBenneCharacterPerspectiveRenderNodes(
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite,
): void {
  sprite.setRenderNodeRole('Submitter', BENNE_CHARACTER_SUBMITTER_NAME);
  sprite.setRenderNodeRole('BatchHandler', BENNE_CHARACTER_BATCH_HANDLER_NAME);
}
