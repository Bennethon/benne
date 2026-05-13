/**
 * Inlined Phaser 4.0.0-rc.7 quad batch shader strings and addition configs from
 * `node_modules/phaser/src/renderer/webgl/shaders/**` and `.../additionMakers/Make*.js`.
 *
 * The Phaser `src` tree is CommonJS (`require`); importing it into Vite's browser bundle
 * fails at runtime (`require is not defined`). This module is plain ESM + strings only.
 */

export type BenneShaderAddition = {
  name: string;
  additions: Record<string, string>;
  tags?: string[];
  disable?: boolean;
};

/** {@link Phaser.Renderer.WebGL.Shaders.Multi-vert} */
export const BENNE_MULTI_VERT_SOURCE = [
  '#pragma phaserTemplate(shaderName)',
  '#pragma phaserTemplate(extensions)',
  '#pragma phaserTemplate(features)',
  '#ifdef GL_FRAGMENT_PRECISION_HIGH',
  'precision highp float;',
  '#else',
  'precision mediump float;',
  '#endif',
  '#pragma phaserTemplate(vertexDefine)',
  'uniform mat4 uProjectionMatrix;',
  'uniform vec2 uResolution;',
  'attribute vec2 inPosition;',
  'attribute vec2 inTexCoord;',
  'attribute float inTexDatum;',
  'attribute float inTintEffect;',
  'attribute vec4 inTint;',
  'varying vec2 outTexCoord;',
  'varying float outTexDatum;',
  'varying float outTintEffect;',
  'varying vec4 outTint;',
  '#pragma phaserTemplate(outVariables)',
  '#pragma phaserTemplate(vertexHeader)',
  'void main ()',
  '{',
  '    gl_Position = uProjectionMatrix * vec4(inPosition, 1.0, 1.0);',
  '    outTexCoord = inTexCoord;',
  '    outTexDatum = inTexDatum;',
  '    outTint = inTint;',
  '    outTintEffect = inTintEffect;',
  '    #pragma phaserTemplate(vertexProcess)',
  '}',
].join('\n');

/** {@link Phaser.Renderer.WebGL.Shaders.Multi-frag} */
export const BENNE_MULTI_FRAG_SOURCE = [
  '#pragma phaserTemplate(shaderName)',
  '#pragma phaserTemplate(extensions)',
  '#pragma phaserTemplate(features)',
  '#ifdef GL_FRAGMENT_PRECISION_HIGH',
  'precision highp float;',
  '#else',
  'precision mediump float;',
  '#endif',
  '#pragma phaserTemplate(fragmentDefine)',
  'uniform vec2 uResolution;',
  'varying vec2 outTexCoord;',
  'varying float outTexDatum;',
  'varying float outTintEffect;',
  'varying vec4 outTint;',
  '#pragma phaserTemplate(outVariables)',
  '#pragma phaserTemplate(fragmentHeader)',
  'void main ()',
  '{',
  '    #pragma phaserTemplate(fragmentProcess)',
  '    gl_FragColor = fragColor;',
  '}',
].join('\n');

/** {@link Phaser.Renderer.WebGL.Shaders.DefineBlockyTexCoord-glsl} */
export const BENNE_GLSL_DEFINE_BLOCKY_TEX_COORD = [
  'vec2 v2len (vec2 a, vec2 b)',
  '{',
  '    return sqrt(a*a+b*b);',
  '}',
  'vec2 getBlockyTexCoord (vec2 texCoord, vec2 texRes) {',
  '    texCoord *= texRes;',
  '    vec2 seam = floor(texCoord + 0.5);',
  '    texCoord = (texCoord - seam) / v2len(dFdx(texCoord), dFdy(texCoord)) + seam;',
  '    texCoord = clamp(texCoord, seam-.5, seam+.5);',
  '    return texCoord / texRes;',
  '}',
].join('\n');

/** {@link Phaser.Renderer.WebGL.Shaders.GetTexRes-glsl} */
export const BENNE_GLSL_GET_TEX_RES = [
  'uniform vec2 uMainResolution[TEXTURE_COUNT];',
  'vec2 getTexRes ()',
  '{',
  '    #if TEXTURE_COUNT == 1',
  '    float texId = 0.0;',
  '    #else',
  '    float texId = outTexDatum;',
  '    #endif',
  '    #pragma phaserTemplate(texIdProcess)',
  '    vec2 texRes = vec2(0.0);',
  '    for (int i = 0; i < TEXTURE_COUNT; i++)',
  '    {',
  '        if (texId == float(i))',
  '        {',
  '            texRes = uMainResolution[i];',
  '            break;',
  '        }',
  '    }',
  '    return texRes;',
  '}',
].join('\n');

/** {@link Phaser.Renderer.WebGL.Shaders.GetTexture-glsl} with `texIdProcess` empty (single texture). */
export const BENNE_GLSL_GET_TEXTURE_1 = [
  'uniform sampler2D uMainSampler[TEXTURE_COUNT];',
  'vec4 getTexture (vec2 texCoord)',
  '{',
  '    #if TEXTURE_COUNT == 1',
  '    return texture2D(uMainSampler[0], texCoord);',
  '    #else',
  '    if (outTexDatum == 0.0) return texture2D(uMainSampler[0], texCoord);',
  '    #define ELSE_TEX_CASE(INDEX) else if (outTexDatum == float(INDEX)) return texture2D(uMainSampler[INDEX], texCoord);',
  '    #pragma phaserTemplate(texIdProcess)',
  '    else return vec4(0.0, 0.0, 0.0, 0.0);',
  '    #endif',
  '}',
].join('\n');

/** {@link Phaser.Renderer.WebGL.Shaders.ApplyTint-glsl} */
export const BENNE_GLSL_APPLY_TINT = [
  'vec4 applyTint(vec4 texture)',
  '{',
  '    vec3 unpremultTexture = texture.rgb / texture.a;',
  '    float alpha = texture.a * outTint.a;',
  '    vec3 color = vec3(unpremultTexture);',
  '    if (outTintEffect == 0.0) {',
  '        color *= outTint.bgr;',
  '    }',
  '    else if (outTintEffect == 1.0) {',
  '        color = outTint.bgr;',
  '    }',
  '    else if (outTintEffect == 2.0) {',
  '        color += outTint.bgr;',
  '    }',
  '    else if (outTintEffect == 4.0) {',
  '        color = 1.0 - (1.0 - unpremultTexture) * (1.0 - outTint.bgr);',
  '    }',
  '    else if (outTintEffect == 5.0) {',
  '        color = vec3(',
  '            unpremultTexture.r < 0.5 ? 2.0 * outTint.b * unpremultTexture.r : 1.0 - 2.0 * (1.0 - outTint.b) * (1.0 - unpremultTexture.r),',
  '            unpremultTexture.g < 0.5 ? 2.0 * outTint.g * unpremultTexture.g : 1.0 - 2.0 * (1.0 - outTint.g) * (1.0 - unpremultTexture.g),',
  '            unpremultTexture.b < 0.5 ? 2.0 * outTint.r * unpremultTexture.b : 1.0 - 2.0 * (1.0 - outTint.r) * (1.0 - unpremultTexture.b)',
  '        );',
  '    }',
  '    else if (outTintEffect == 6.0) {',
  '        color = vec3(',
  '            outTint.b < 0.5 ? 2.0 * outTint.b * unpremultTexture.r : 1.0 - 2.0 * (1.0 - outTint.b) * (1.0 - unpremultTexture.r),',
  '            outTint.g < 0.5 ? 2.0 * outTint.g * unpremultTexture.g : 1.0 - 2.0 * (1.0 - outTint.g) * (1.0 - unpremultTexture.g),',
  '            outTint.r < 0.5 ? 2.0 * outTint.r * unpremultTexture.b : 1.0 - 2.0 * (1.0 - outTint.r) * (1.0 - unpremultTexture.b)',
  '        );',
  '    }',
  '    return vec4(color * alpha, alpha);',
  '}',
].join('\n');

/** {@link Phaser.Renderer.WebGL.Shaders.DefineLights-glsl} */
export const BENNE_GLSL_DEFINE_LIGHTS = [
  'struct Light',
  '{',
  '    vec3 position;',
  '    vec3 color;',
  '    float intensity;',
  '    float radius;',
  '};',
  'const int kMaxLights = LIGHT_COUNT;',
  'uniform vec4 uCamera; /* x, y, rotation, zoom */',
  'uniform sampler2D uNormSampler;',
  'uniform vec3 uAmbientLightColor;',
  'uniform Light uLights[kMaxLights];',
  'uniform int uLightCount;',
  '#ifdef FEATURE_SELFSHADOW',
  'uniform float uDiffuseFlatThreshold;',
  'uniform float uPenumbra;',
  '#endif',
  'vec4 getLighting (vec4 fragColor, vec3 normal)',
  '{',
  '    vec3 finalColor = vec3(0.0);',
  '    vec2 res = vec2(min(uResolution.x, uResolution.y)) * uCamera.w;',
  '    #ifdef FEATURE_SELFSHADOW',
  '    vec3 unpremultipliedColor = fragColor.rgb / fragColor.a;',
  '    float occlusionThreshold = 1.0 - ((unpremultipliedColor.r + unpremultipliedColor.g + unpremultipliedColor.b) / uDiffuseFlatThreshold);',
  '    #endif',
  '    for (int index = 0; index < kMaxLights; ++index)',
  '    {',
  '        if (index < uLightCount)',
  '        {',
  '            Light light = uLights[index];',
  '            vec3 lightDir = vec3((light.position.xy / res) - (gl_FragCoord.xy / res), light.position.z / res.x);',
  '            vec3 lightNormal = normalize(lightDir);',
  '            float distToSurf = length(lightDir) * uCamera.w;',
  '            float diffuseFactor = max(dot(normal, lightNormal), 0.0);',
  '            float radius = (light.radius / res.x * uCamera.w) * uCamera.w;',
  '            float attenuation = clamp(1.0 - distToSurf * distToSurf / (radius * radius), 0.0, 1.0);',
  '            #ifdef FEATURE_SELFSHADOW',
  '            float occluded = smoothstep(0.0, 1.0, (diffuseFactor - occlusionThreshold) / uPenumbra);',
  '            vec3 diffuse = light.color * diffuseFactor * occluded;',
  '            #else',
  '            vec3 diffuse = light.color * diffuseFactor;',
  '            #endif',
  '            finalColor += (attenuation * diffuse) * light.intensity;',
  '        }',
  '    }',
  '    vec4 colorOutput = vec4(uAmbientLightColor + finalColor, 1.0);',
  '    return colorOutput;',
  '}',
].join('\n');

/** {@link Phaser.Renderer.WebGL.Shaders.ApplyLighting-glsl} */
export const BENNE_GLSL_APPLY_LIGHTING = [
  'vec4 applyLighting (vec4 fragColor, vec3 normal)',
  '{',
  '    vec4 lighting = getLighting(fragColor, normal);',
  '    return fragColor * vec4(lighting.rgb * lighting.a, lighting.a);',
  '}',
].join('\n');

/** {@link Phaser.Renderer.WebGL.Shaders.GetNormalFromMap-glsl} */
export const BENNE_GLSL_GET_NORMAL_FROM_MAP = [
  'vec3 getNormalFromMap (vec2 texCoord)',
  '{',
  '    vec3 normalMap = texture2D(uNormSampler, texCoord).rgb;',
  '    return normalize(outInverseRotationMatrix * vec3(normalMap * 2.0 - 1.0));',
  '}',
].join('\n');

/** {@link Phaser.Renderer.WebGL.Shaders.OutInverseRotation-glsl} */
export const BENNE_GLSL_OUT_INVERSE_ROTATION = [
  'float inverseRotation = -rotation - uCamera.z;',
  'float irSine = sin(inverseRotation);',
  'float irCosine = cos(inverseRotation);',
  'outInverseRotationMatrix = mat3(',
  '    irCosine, irSine, 0.0,',
  '    -irSine, irCosine, 0.0,',
  '    0.0, 0.0, 1.0',
  ');',
].join('\n');

/** Mirrors {@link Phaser.Renderer.WebGL.ShaderAdditionMakers.MakeGetTexCoordOut} */
export function benneMakeGetTexCoordOut(disable?: boolean): BenneShaderAddition {
  return {
    name: 'TexCoordOut',
    additions: {
      fragmentProcess: 'vec2 texCoord = outTexCoord;\n#pragma phaserTemplate(texCoord)',
    },
    tags: ['TEXCOORD'],
    disable: !!disable,
  };
}

/** Mirrors {@link Phaser.Renderer.WebGL.ShaderAdditionMakers.MakeGetTexRes} */
export function benneMakeGetTexRes(disable?: boolean): BenneShaderAddition {
  return {
    name: 'GetTexRes',
    additions: {
      fragmentHeader: BENNE_GLSL_GET_TEX_RES,
    },
    tags: ['TEXRES'],
    disable: !!disable,
  };
}

/** Mirrors {@link Phaser.Renderer.WebGL.ShaderAdditionMakers.MakeSmoothPixelArt} */
export function benneMakeSmoothPixelArt(disable?: boolean): BenneShaderAddition {
  return {
    name: 'SmoothPixelArt',
    additions: {
      extensions: '#extension GL_OES_standard_derivatives : enable',
      fragmentHeader: BENNE_GLSL_DEFINE_BLOCKY_TEX_COORD,
      texCoord: 'texCoord = getBlockyTexCoord(texCoord, getTexRes());',
    },
    disable: !!disable,
  };
}

/** Mirrors {@link Phaser.Renderer.WebGL.ShaderAdditionMakers.MakeDefineTexCount} */
export function benneMakeDefineTexCount(maxTextures: number, disable?: boolean): BenneShaderAddition {
  return {
    name: `${maxTextures}TexCount`,
    additions: {
      fragmentDefine: `#define TEXTURE_COUNT ${maxTextures}`,
    },
    tags: ['TexCount'],
    disable: !!disable,
  };
}

/** Mirrors {@link Phaser.Renderer.WebGL.ShaderAdditionMakers.MakeGetTexture} for a single texture unit. */
export function benneMakeGetTexture1(disable?: boolean): BenneShaderAddition {
  const header = BENNE_GLSL_GET_TEXTURE_1.replace('#pragma phaserTemplate(texIdProcess)\n', '');
  return {
    name: 'GetTexture1',
    additions: {
      fragmentHeader: header,
      fragmentProcess: 'vec4 fragColor = getTexture(texCoord);',
    },
    tags: ['TEXTURE'],
    disable: !!disable,
  };
}

/** Mirrors {@link Phaser.Renderer.WebGL.ShaderAdditionMakers.MakeApplyTint} */
export function benneMakeApplyTint(disable?: boolean): BenneShaderAddition {
  return {
    name: 'Tint',
    additions: {
      fragmentHeader: BENNE_GLSL_APPLY_TINT,
      fragmentProcess: 'fragColor = applyTint(fragColor);',
    },
    tags: ['TINT'],
    disable: !!disable,
  };
}

/** Mirrors {@link Phaser.Renderer.WebGL.ShaderAdditionMakers.MakeDefineLights} */
export function benneMakeDefineLights(disable?: boolean): BenneShaderAddition {
  return {
    name: 'DefineLights',
    additions: {
      fragmentDefine: '#define LIGHT_COUNT 1',
      fragmentHeader: BENNE_GLSL_DEFINE_LIGHTS,
    },
    tags: ['LIGHTING'],
    disable: !!disable,
  };
}

/** Mirrors {@link Phaser.Renderer.WebGL.ShaderAdditionMakers.MakeRotationDatum} */
export function benneMakeRotationDatum(disable?: boolean): BenneShaderAddition {
  return {
    name: 'RotDatum',
    additions: {
      vertexProcess: 'float rotation = inTexDatum;',
    },
    tags: ['LIGHTING'],
    disable: !!disable,
  };
}

/** Mirrors {@link Phaser.Renderer.WebGL.ShaderAdditionMakers.MakeOutInverseRotation} */
export function benneMakeOutInverseRotation(disable?: boolean): BenneShaderAddition {
  return {
    name: 'OutInverseRotation',
    additions: {
      vertexHeader: 'uniform vec4 uCamera;',
      vertexProcess: BENNE_GLSL_OUT_INVERSE_ROTATION,
      outVariables: 'varying mat3 outInverseRotationMatrix;',
    },
    tags: ['LIGHTING'],
    disable: !!disable,
  };
}

/** Mirrors {@link Phaser.Renderer.WebGL.ShaderAdditionMakers.MakeGetNormalFromMap} */
export function benneMakeGetNormalFromMap(disable?: boolean): BenneShaderAddition {
  return {
    name: 'NormalMap',
    additions: {
      fragmentHeader: BENNE_GLSL_GET_NORMAL_FROM_MAP,
      fragmentProcess: 'vec3 normal = getNormalFromMap(texCoord);',
    },
    tags: ['LIGHTING'],
    disable: !!disable,
  };
}

/** Mirrors {@link Phaser.Renderer.WebGL.ShaderAdditionMakers.MakeApplyLighting} */
export function benneMakeApplyLighting(disable?: boolean): BenneShaderAddition {
  return {
    name: 'ApplyLighting',
    additions: {
      fragmentHeader: BENNE_GLSL_APPLY_LIGHTING,
      fragmentProcess: 'fragColor = applyLighting(fragColor, normal);',
    },
    tags: ['LIGHTING'],
    disable: !!disable,
  };
}
