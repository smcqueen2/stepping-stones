import { Program, Renderer, Texture, Triangle } from 'ogl';

const vertex = /* glsl */ `
  attribute vec2 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform sampler2D uPainting;
  uniform sampler2D uMask;
  uniform sampler2D uSky;
  uniform sampler2D uLandscape;
  uniform sampler2D uCastle;
  uniform sampler2D uTrees;
  uniform float uTime;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    vec2 blend = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), blend.x),
               mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0)), blend.x), blend.y);
  }

  void main() {
    float trees = texture2D(uTrees, vUv).r;
    if (trees > 0.001) {
      vec4 castle = texture2D(uCastle, vUv);
      float foliageCoverage = trees * (1.0 - smoothstep(0.005, 0.06, castle.a));
      if (foliageCoverage < 0.001) {
        gl_FragColor = vec4(0.0);
        return;
      }
      // Anchor the lower branches; higher crowns flex more in the breeze.
      float imageY = (1.0 - vUv.y) * 941.0;
      float crownY = mix(260.0, 177.0, smoothstep(0.51, 0.63, vUv.x));
      float height = pow(clamp((430.0 - imageY) / (430.0 - crownY), 0.0, 1.0), 1.8);
      float gust = noise(vec2(vUv.x * 2.7 - uTime * 0.12, uTime * 0.045));
      float branch = sin(uTime * 0.78 - vUv.x * 5.5)
                   + 0.37 * sin(uTime * 1.17 + vUv.x * 10.2);
      float leaves = noise(vec2(vUv.x * 55.0 - uTime * 0.24, vUv.y * 31.0 + uTime * 0.19)) - 0.5;

      // Avoid sampling the transparent castle cutout into a neighbouring tree.
      vec2 castleMargin = vec2(12.0 / 1672.0, 0.0);
      float nearCastle = max(castle.a, max(texture2D(uCastle, vUv - castleMargin).a,
                                           texture2D(uCastle, vUv + castleMargin).a));
      float flex = height * (1.0 - smoothstep(0.02, 0.3, nearCastle));
      vec2 wind = vec2(branch * (3.5 + 4.5 * gust) + leaves * 1.3,
                       sin(uTime * 0.93 + vUv.x * 9.1) * 0.7 + leaves * 0.5);
      vec4 landscape = texture2D(uLandscape, clamp(vUv + wind * flex / vec2(1672.0, 941.0), 0.0, 1.0));

      // Fill newly uncovered crown edges with nearby painted sky, not ghost leaves.
      vec4 sky = texture2D(uSky, vUv);
      vec3 skyBehindCrown = texture2D(uSky, clamp(vUv + vec2(0.0, 32.0 / 941.0), 0.0, 1.0)).rgb;
      vec3 backdrop = mix(skyBehindCrown, sky.rgb, sky.a);
      vec3 scene = mix(backdrop, landscape.rgb, landscape.a);
      gl_FragColor = vec4(scene, foliageCoverage);
      return;
    }

    float mask = texture2D(uMask, vUv).r;
    if (mask < 0.001) {
      gl_FragColor = vec4(0.0);
      return;
    }

    // Advect several scales of evolving noise rightward. There is no tile reset
    // or repeated stripe: neighbouring patches bend at different rates.
    vec2 p = vUv * vec2(13.0, 43.0) - vec2(uTime * 0.48, 0.0);
    vec2 eddy = vec2(noise(p * 0.37 + vec2(0.0, uTime * 0.065)),
                     noise(p * 0.41 + vec2(17.4, -uTime * 0.051)));
    p += (eddy - 0.5) * 1.8;
    float current = noise(p + vec2(0.0, uTime * 0.11));
    float ripple = noise(p * 2.11 + vec2(uTime * 0.071, 8.3));
    float detail = noise(p * 4.37 - vec2(12.7, uTime * 0.093));

    vec2 displacement = vec2((current - 0.5) * 22.0 + (ripple - 0.5) * 8.0,
                             (ripple - 0.5) * 5.0 + (detail - 0.5) * 2.0)
                        / vec2(1672.0, 941.0);
    vec2 displacedUv = clamp(vUv + displacement * mask, 0.0, 1.0);
    // Never pull a stone or the bank into the moving water when sampling.
    float sourceWater = smoothstep(0.05, 0.95, texture2D(uMask, displacedUv).r);
    vec2 sampleUv = mix(vUv, displacedUv, sourceWater);
    vec3 paint = texture2D(uPainting, sampleUv).rgb;
    float light = (ripple - 0.5) * 0.055 + (detail - 0.5) * 0.025;
    paint += vec3(0.85, 0.91, 0.87) * light * sourceWater;
    gl_FragColor = vec4(paint, mask);
  }
`;

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

/** One draw pass, capped at 30fps and 1080px wide; the painting is the fallback. */
export async function mountRiverFlow(canvas: HTMLCanvasElement): Promise<() => void> {
  const base = `${import.meta.env.BASE_URL}images/hero/`;
  const images = await Promise.all([
    loadImage(`${base}04_river_and_stepping_stones.webp`),
    loadImage(`${base}river-mask.svg`),
    loadImage(`${base}01_sky.webp`),
    loadImage(`${base}02_landscape_background.webp`),
    loadImage(`${base}03_castle.webp`),
    loadImage(`${base}tree-mask.svg`),
  ]);
  const renderer = new Renderer({
    canvas, dpr: 1, alpha: true, depth: false, stencil: false,
    antialias: false, premultipliedAlpha: false, powerPreference: 'low-power', webgl: 1,
  });
  const gl = renderer.gl;
  if (!gl) throw new Error('WebGL is unavailable');
  gl.clearColor(0, 0, 0, 0);
  const textures = images.map(image => new Texture(gl, {
    image, generateMipmaps: false, minFilter: gl.LINEAR, magFilter: gl.LINEAR,
    wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE,
  }));
  const geometry = new Triangle(gl);
  const program = new Program(gl, {
    vertex, fragment, depthTest: false, depthWrite: false, cullFace: false,
    uniforms: {
      uPainting: { value: textures[0] }, uMask: { value: textures[1] },
      uSky: { value: textures[2] }, uLandscape: { value: textures[3] },
      uCastle: { value: textures[4] }, uTrees: { value: textures[5] },
      uTime: { value: 0 },
    },
  });
  const releaseGpu = () => {
    geometry.remove();
    program.remove();
    textures.forEach(texture => gl.deleteTexture(texture.texture));
  };
  if (!gl.getProgramParameter(program.program, gl.LINK_STATUS)) {
    releaseGpu();
    throw new Error('Hero shader could not be compiled');
  }
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  let contextLost = false;
  let disposed = false;
  let frame = 0;
  let lastDraw = 0;
  let elapsed = 0;

  function draw(now: number): void {
    frame = requestAnimationFrame(draw);
    if (lastDraw && now - lastDraw < 1000 / 30) return;
    elapsed += lastDraw ? Math.min(0.1, (now - lastDraw) / 1000) : 0;
    lastDraw = now;
    program.uniforms.uTime.value = elapsed;
    // Draw the full-screen triangle directly; no 3D scene, camera or mesh code.
    program.use();
    geometry.draw({ program });
  }

  function sync(): void {
    const active = !disposed && !contextLost && visible && !document.hidden && !motion.matches;
    canvas.style.visibility = motion.matches || contextLost ? 'hidden' : '';
    canvas.dataset.waterState = active ? 'running' : 'paused';
    if (active && !frame) {
      lastDraw = 0;
      frame = requestAnimationFrame(draw);
    } else if (!active && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  }

  function resize(): void {
    const width = Math.max(1, Math.round(Math.min(canvas.parentElement!.clientWidth, 1080)));
    renderer.setSize(width, Math.round(width * 941 / 1672));
    renderer.setViewport(canvas.width, canvas.height);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  }

  function loseContext(): void {
    contextLost = true;
    sync();
  }

  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  });
  const size = new ResizeObserver(resize);
  intersection.observe(canvas);
  size.observe(canvas.parentElement!);
  motion.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  canvas.addEventListener('webglcontextlost', loseContext);
  resize();

  return () => {
    disposed = true;
    sync();
    intersection.disconnect();
    size.disconnect();
    motion.removeEventListener('change', sync);
    document.removeEventListener('visibilitychange', sync);
    canvas.removeEventListener('webglcontextlost', loseContext);
    releaseGpu();
  };
}
