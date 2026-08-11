import { Mesh, Program, Renderer, Triangle } from 'ogl'
import { useEffect, useRef, useState } from 'react'

/**
 * Decorative WebGL light rays fanning out from one corner, ported from React
 * Bits' `SideRays`. Purely ambient: it is `aria-hidden`, takes no pointer
 * events, and renders nothing if WebGL is unavailable.
 *
 * The canvas fills its nearest positioned ancestor, so the caller owns
 * placement and stacking. Rendering pauses while the container is off screen,
 * and drops to a single static frame under `prefers-reduced-motion: reduce`.
 */

export type SideRaysOrigin =
  | 'top-right'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-left'

export type SideRaysProps = {
  /** Animation speed of the rays. */
  speed?: number
  /** First ray layer, hex. Defaults to the theme accent. */
  rayColor1?: string
  /** Second ray layer, hex. Defaults to the theme accent. */
  rayColor2?: string
  /** Overall brightness. */
  intensity?: number
  /** Angular width of the fan between the two layers. */
  spread?: number
  /** Corner the rays emerge from. */
  origin?: SideRaysOrigin
  /** Rotation of the fan in degrees; positive tilts clockwise. */
  tilt?: number
  /** 0 renders grayscale, above 1 boosts color. */
  saturation?: number
  /** Balance between the layers: 0 is all of ray 1, 1 is all of ray 2. */
  blend?: number
  /** How steeply brightness falls off with distance; higher is a tighter glow. */
  falloff?: number
  /** Overall opacity. */
  opacity?: number
  className?: string
}

const vertexShader = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`

const fragmentShader = `precision highp float;

uniform float iTime;
uniform vec2 iResolution;
uniform float iSpeed;
uniform vec3 iRayColor1;
uniform vec3 iRayColor2;
uniform float iIntensity;
uniform float iSpread;
uniform float iFlipX;
uniform float iFlipY;
uniform float iTilt;
uniform float iSaturation;
uniform float iBlend;
uniform float iFalloff;
uniform float iOpacity;

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord, float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  float cosAngle = dot(normalize(sourceToCoord), rayRefDirection);
  return clamp(
    (0.45 + 0.15 * sin(cosAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-cosAngle * seedB + iTime * speed)),
    0.0, 1.0) *
    clamp((iResolution.x - length(sourceToCoord)) / iResolution.x, 0.5, 1.0);
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  if (iFlipX > 0.5) fragCoord.x = iResolution.x - fragCoord.x;
  if (iFlipY > 0.5) fragCoord.y = iResolution.y - fragCoord.y;

  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
  vec2 rayPos = vec2(iResolution.x * 1.1, -0.5 * iResolution.y);

  float tiltRad = iTilt * 3.14159265 / 180.0;
  float cs = cos(tiltRad);
  float sn = sin(tiltRad);
  vec2 rel = coord - rayPos;
  vec2 tiltedCoord = vec2(rel.x * cs - rel.y * sn, rel.x * sn + rel.y * cs) + rayPos;

  float halfSpread = iSpread * 0.275;
  vec2 rayRefDir1 = normalize(vec2(cos(0.785398 + halfSpread), sin(0.785398 + halfSpread)));
  vec2 rayRefDir2 = normalize(vec2(cos(0.785398 - halfSpread), sin(0.785398 - halfSpread)));

  vec4 rays1 = vec4(iRayColor1, 1.0) * rayStrength(rayPos, rayRefDir1, tiltedCoord, 36.2214, 21.11349, iSpeed);
  vec4 rays2 = vec4(iRayColor2, 1.0) * rayStrength(rayPos, rayRefDir2, tiltedCoord, 22.3991, 18.0234, iSpeed * 0.2);

  vec4 color = rays1 * (1.0 - iBlend) * 0.9 + rays2 * iBlend * 0.9;

  float distanceToLight = length(fragCoord.xy - vec2(rayPos.x, iResolution.y - rayPos.y)) / iResolution.y;
  float brightness = iIntensity * 0.4 / pow(max(distanceToLight, 0.001), iFalloff);
  color.rgb *= brightness;

  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  color.rgb = mix(vec3(gray), color.rgb, iSaturation);

  color.a = max(color.r, max(color.g, color.b)) * iOpacity;
  gl_FragColor = color;
}`

type Rgb = [number, number, number]

export function hexToRgb(hex: string): Rgb {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  if (!match) return [1, 1, 1]
  return [
    parseInt(match[1], 16) / 255,
    parseInt(match[2], 16) / 255,
    parseInt(match[3], 16) / 255,
  ]
}

/** Which axes the shader mirrors to move the source to the requested corner. */
export function originToFlip(origin: SideRaysOrigin): [number, number] {
  switch (origin) {
    case 'top-left':
      return [1, 0]
    case 'bottom-right':
      return [0, 1]
    case 'bottom-left':
      return [1, 1]
    case 'top-right':
      return [0, 0]
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function SideRays({
  speed = 2.5,
  rayColor1 = '#63fe13',
  rayColor2 = '#63fe13',
  intensity = 2,
  spread = 2,
  origin = 'top-right',
  tilt = 0,
  saturation = 1.5,
  blend = 0.75,
  falloff = 1.6,
  opacity = 1,
  className = '',
}: SideRaysProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const uniformsRef = useRef<Record<string, { value: unknown }> | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  // Inactive panes keep their DOM mounted, so without this the shader would
  // keep running behind a thread the user has navigated away from.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    // Matches the guard in `message-sticker.tsx`. Without an observer the
    // honest fallback is to stay dark rather than to render unconditionally.
    if (typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 },
    )
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Deliberately depends on `isVisible` alone. Prop changes are pushed onto
  // the live uniforms by the effect below; rebuilding the GL context for an
  // opacity tweak would drop and re-acquire a context on every render.
  useEffect(() => {
    const container = containerRef.current
    if (!isVisible || !container) return

    let renderer: Renderer | null = null
    let frame: number | null = null
    let disposed = false

    try {
      renderer = new Renderer({
        dpr: Math.min(window.devicePixelRatio, 2),
        alpha: true,
      })
    } catch {
      // No WebGL (older browser, blocklisted driver, jsdom). The effect is
      // decorative, so an absent canvas is the correct fallback.
      return
    }

    // ogl does not throw when context creation fails — it logs and leaves `gl`
    // unset (Renderer.js: `if (!this.gl) console.error(...)`), which its own
    // types do not admit. Reading `gl.canvas` in that state throws out of the
    // effect and takes the whole thread down, so this check is load-bearing,
    // not defensive, and the test below pins it.
    const gl = renderer.gl as typeof renderer.gl | undefined
    if (!gl) return

    gl.canvas.style.width = '100%'
    gl.canvas.style.height = '100%'
    container.replaceChildren(gl.canvas)

    const [flipX, flipY] = originToFlip(origin)
    const uniforms = {
      iTime: { value: 0 },
      iResolution: { value: [1, 1] },
      iSpeed: { value: speed },
      iRayColor1: { value: hexToRgb(rayColor1) },
      iRayColor2: { value: hexToRgb(rayColor2) },
      iIntensity: { value: intensity },
      iSpread: { value: spread },
      iFlipX: { value: flipX },
      iFlipY: { value: flipY },
      iTilt: { value: tilt },
      iSaturation: { value: saturation },
      iBlend: { value: blend },
      iFalloff: { value: falloff },
      iOpacity: { value: opacity },
    }
    uniformsRef.current = uniforms

    const mesh = new Mesh(gl, {
      geometry: new Triangle(gl),
      program: new Program(gl, {
        vertex: vertexShader,
        fragment: fragmentShader,
        uniforms,
      }),
    })

    const updateSize = () => {
      if (disposed || !renderer || !containerRef.current) return
      renderer.dpr = Math.min(window.devicePixelRatio, 2)
      const { clientWidth, clientHeight } = containerRef.current
      renderer.setSize(clientWidth, clientHeight)
      uniforms.iResolution.value = [
        clientWidth * renderer.dpr,
        clientHeight * renderer.dpr,
      ]
    }

    /** Renders one frame. Returns false once the context is unusable. */
    const renderFrame = (time: number): boolean => {
      if (disposed || !renderer) return false
      uniforms.iTime.value = time * 0.001
      try {
        renderer.render({ scene: mesh })
      } catch {
        // Context lost mid-frame; stop rather than retry it every frame.
        return false
      }
      return true
    }

    const loop = (time: number) => {
      if (!renderFrame(time)) return
      frame = requestAnimationFrame(loop)
    }

    window.addEventListener('resize', updateSize)
    updateSize()

    // Reduced motion still gets the glow, just not the movement: one frame,
    // no rAF loop, no ongoing GPU cost.
    if (prefersReducedMotion()) {
      renderFrame(0)
    } else {
      frame = requestAnimationFrame(loop)
    }

    return () => {
      disposed = true
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('resize', updateSize)
      uniformsRef.current = null
      try {
        gl.getExtension('WEBGL_lose_context')?.loseContext()
        gl.canvas.remove()
      } catch {
        // Teardown of an already-lost context; nothing left to release.
      }
      renderer = null
    }
  }, [isVisible])

  // Push prop changes onto the live uniforms instead of rebuilding the context.
  useEffect(() => {
    const uniforms = uniformsRef.current
    if (!uniforms) return
    const [flipX, flipY] = originToFlip(origin)
    uniforms.iSpeed.value = speed
    uniforms.iRayColor1.value = hexToRgb(rayColor1)
    uniforms.iRayColor2.value = hexToRgb(rayColor2)
    uniforms.iIntensity.value = intensity
    uniforms.iSpread.value = spread
    uniforms.iFlipX.value = flipX
    uniforms.iFlipY.value = flipY
    uniforms.iTilt.value = tilt
    uniforms.iSaturation.value = saturation
    uniforms.iBlend.value = blend
    uniforms.iFalloff.value = falloff
    uniforms.iOpacity.value = opacity
  }, [
    speed,
    rayColor1,
    rayColor2,
    intensity,
    spread,
    origin,
    tilt,
    saturation,
    blend,
    falloff,
    opacity,
  ])

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`.trim()}
    />
  )
}
