import {
  MeshStandardMaterial,
  RepeatWrapping,
  TextureLoader,
  Vector2,
  Vector3,
} from "../third_party/three.module.js";
import { lines } from "../shaders/lines.js";

class CrossHatchMaterial extends MeshStandardMaterial {
  constructor(options) {
    super(options);
    const self = this;

    this.onBeforeCompile = (shader, renderer) => {
      const loader = new TextureLoader();
      const texture = loader.load("../assets/Parchment.jpg");
      const noiseTexture = loader.load("../assets/noise1.png");
      noiseTexture.wrapS = noiseTexture.wrapT = RepeatWrapping;
      shader.uniforms.resolution = { value: new Vector2(1, 1) };
      shader.uniforms.paperTexture = { value: texture };
      shader.uniforms.noiseTexture = { value: noiseTexture };
      shader.uniforms.range = { value: new Vector2(0.25, 0.75) };
      shader.uniforms.range2 = { value: new Vector2(0.5, 0.5) };
      shader.uniforms.scale = { value: 1 };
      shader.uniforms.radius = { value: 1 };
      self.uniforms = shader.uniforms;
      shader.vertexShader = shader.vertexShader.replace(
        `#include <common>`,
        `#include <common>
        out vec2 vCoords;
        out vec4 vWorldPosition;`
      );
      shader.vertexShader = shader.vertexShader.replace(
        `#include <uv_vertex>`,
        `#include <uv_vertex>
        vCoords = uv;
        vWorldPosition = modelViewMatrix * vec4(position, 1.);`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        `#include <common>`,
        `#include <common>
        uniform vec2 resolution;
        uniform sampler2D paperTexture;
        uniform sampler2D noiseTexture;
        uniform vec2 range;
        uniform vec2 range2;
        uniform float scale;
        uniform float radius;
        in vec2 vCoords;
        in vec4 vWorldPosition;
        #define TAU 6.28318530718
        
        // adapted from https://www.shadertoy.com/view/4lfXDM
        float noise( in vec2 x ){return texture(noiseTexture, x*.01).x;}
        float texh(in vec2 p, in float str) {
            float rz= 1.;
            for (int i=0;i<10;i++)
            {
                float g = texture(noiseTexture,vec2(0.025,.5)*p).x;
                g = smoothstep(0.-str*0.1,2.3-str*0.1,g);
                rz = min(1.-g,rz);
                p.xy = p.yx;
                p += .7;
                p *= 1.52;
                if (float(i) > str)break;
            }
            return rz * 1.05;
        }

        float texcube(in vec3 p, in vec3 n, in float str, float a) {
          float s = sin(a);
          float c = cos(a);
          mat2 rot = mat2(c, -s, s, c);
          vec3 v = vec3(texh(rot*p.yz,str), texh(rot*p.zx,str), texh(rot*p.xy,str));
          return dot(v, n*n);
        }

        float luma(vec3 color) {
          return dot(color, vec3(0.299, 0.587, 0.114));
        }
        float luma(vec4 color) {
          return dot(color.rgb, vec3(0.299, 0.587, 0.114));
        }

        float blendDarken(float base, float blend) {
          return min(blend,base);
        }
        
        vec3 blendDarken(vec3 base, vec3 blend) {
          return vec3(blendDarken(base.r,blend.r),blendDarken(base.g,blend.g),blendDarken(base.b,blend.b));
        }
        
        vec3 blendDarken(vec3 base, vec3 blend, float opacity) {
          return (blendDarken(base, blend) * opacity + base * (1.0 - opacity));
        }

        float aastep(float threshold, float value) {
          #ifdef GL_OES_standard_derivatives
            float afwidth = length(vec2(dFdx(value), dFdy(value))) * 0.70710678118654757;
            return smoothstep(threshold-afwidth, threshold+afwidth, value);
          #else
            return step(threshold, value);
          #endif  
        }
        `
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
        float l = 1.-luma(gl_FragColor.rgb);
        float darks = 1.-2.*luma(gl_FragColor.rgb);
        ivec2 size = textureSize(paperTexture, 0);
        vec4 paper = texture(paperTexture, gl_FragCoord.xy / vec2(float(size.x), float(size.y)));
        vec3 coords = 1. * vWorldPosition.xyz;
        vec3 eye = normalize(-cameraPosition.xyz);
        vec3 ref = reflect(vNormal, eye);
        float line = texcube(coords+0.*ref, vNormal, l*5., TAU/8.);
        float lineDark = texcube(coords+0.*ref, vNormal, darks*5., TAU/16.);
        vec3 inkColor = vec3(175., 96., 26.)/255.;
        float e = .01;
        float r = 1. - smoothstep(l-e, l+e, line);
        float rDark = 1. - smoothstep(l-e, l+e, lineDark);
        gl_FragColor.rgb = blendDarken(paper.rgb, inkColor, .5 * r);
        gl_FragColor.rgb = blendDarken(gl_FragColor.rgb, inkColor, .5 * rDark);
        `
      );
    };
  }
}

export { CrossHatchMaterial };
