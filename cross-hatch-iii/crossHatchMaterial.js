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
      const texture = loader.load("../assets/Craft_Light.jpg");
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
        
        vec2 noise(vec2 x){
            return fract(cos(dot(x,vec2(134.,1.61034)))*vec2(416418.0,1265.7486));
        }

        // adapted from https://www.shadertoy.com/view/wsdyRf
        
        float calc(in vec2 uv, float f) {
          vec2 uv00 = vec2(0,0)+floor(uv);
          vec2 uv01 = vec2(0,1)+floor(uv);
          vec2 uv10 = vec2(1,0)+floor(uv);
          vec2 uv11 = vec2(1,1)+floor(uv);

          vec3 col = vec3(0);
          vec2 n00 = noise(uv00);
          vec2 n01 = noise(uv01);
          vec2 n10 = noise(uv10);
          vec2 n11 = noise(uv11);
          uv00 = ceil(uv00) + n00-.5;
          uv01 = ceil(uv01) + n01-.5;
          uv10 = ceil(uv10) + n10-.5;
          uv11 = ceil(uv11) + n11-.5;

          vec2 uv0 = mix(uv00,uv01, float(distance(uv00,uv)>distance(uv01,uv)));
          vec2 uv1 = mix(uv10,uv11, float(distance(uv10,uv)>distance(uv11,uv)));
          vec2 uvC = mix(uv0,uv1,   float(distance(uv0,uv) >distance(uv1,uv)));
          vec2 uvL = uv-uvC;
          vec2 vn = noise(uvC)-.5;
          float g = dot(uvL,normalize(vn));
          //float size = 1.;//1.+.5*sin(iTime);
          //float so = .1;//.4+1./(16.+size);
          return .5 - (sin(15.*g));//smoothstep(-so+.25,so+.25,sin((6.+size*12.)*g));
        }

        float texcube(in vec3 p, in vec3 n, in float f) {
          vec3 v = vec3(calc(p.yz, f), calc(p.zx, f), calc(p.xy, f));
          return dot(v, n*n);
        }

        float luma(vec3 color) {
          return dot(color, vec3(0.299, 0.587, 0.114));
        }
        float luma(vec4 color) {
          return dot(color.rgb, vec3(0.299, 0.587, 0.114));
        }

        float blendColorBurn(float base, float blend) {
          return (blend==0.0)?blend:max((1.0-((1.0-base)/blend)),0.0);
        }

        vec3 blendColorBurn(vec3 base, vec3 blend) {
          return vec3(blendColorBurn(base.r,blend.r),blendColorBurn(base.g,blend.g),blendColorBurn(base.b,blend.b));
        }
        
        vec3 blendColorBurn(vec3 base, vec3 blend, float opacity) {
          return (blendColorBurn(base, blend) * opacity + base * (1.0 - opacity));
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
        float l =  luma(gl_FragColor.rgb);
        ivec2 size = textureSize(paperTexture, 0);
        vec4 paper = texture(paperTexture, gl_FragCoord.xy / vec2(float(size.x), float(size.y)));
        vec3 coords = 20. * vWorldPosition.xyz / vWorldPosition.w;
        float line = texcube(coords, vNormal, 1.);
        vec3 inkColor = vec3(18., 106., 135.)/255.;
        //inkColor *= l;
        float r = aastep( l, line);
        gl_FragColor.rgb = blendColorBurn(paper.rgb, inkColor, r);
        `
      );
    };
  }
}

export { CrossHatchMaterial };
