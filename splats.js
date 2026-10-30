// What the template changes in the splats' look: clip.js's height cut, points.js's point cloud and
// intro.js's opening wave. All go into one engine gsplatModifyVS chunk, run as the engine copies the
// splats to its work buffer, which its renderers and the picker read; the Performance mode renderer
// reads no work buffer and takes the cut and the points through setHeightClip and setPointMode
// (viewer patch), and shows no wave. World +Y is up.

export const OPEN = 1e30;

// A point is opaque and all but sizeless (a 0 scale is the work buffer's mark for no splat): the
// 0.3 px² low-pass every renderer adds draws it about 1.5 px wide. Colour: blue, green, red upwards,
// muted toward grey so the heights do not jump out.
// The wave (spirulaWaveAt: centre, radius; 0 when off) shows the points up to its first front
// (spirulaWave.x), which glows over .z, and the splats behind its second (.y), those beyond its
// radius with its last ring. Stage: 0 a splat, 1 a point, 2 not reached yet.
const modifier = {
    glsl: `
uniform vec2 spirulaClipY;
uniform vec4 spirulaPoints;
uniform vec3 spirulaWave;
uniform vec4 spirulaWaveAt;
float spirulaStage(vec3 center) {
    float d = min(distance(center, spirulaWaveAt.xyz), spirulaWaveAt.w);
    if (spirulaWaveAt.w <= 0.0) return spirulaPoints.x;
    if (d > spirulaWave.x) return 2.0;
    return d > spirulaWave.y ? 1.0 : spirulaPoints.x;
}
void modifySplatCenter(inout vec3 center) {
}
void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
    scale = mix(scale, vec3(1e-5), min(spirulaStage(originalCenter), 1.0));
}
void modifySplatColor(vec3 center, inout vec4 color) {
    float stage = spirulaStage(center);
    if (stage > 1.5) color.a = 0.0;
    else if (stage > 0.0) {
        float t = clamp((center.y - spirulaPoints.y) / max(spirulaPoints.z - spirulaPoints.y, 1e-6), 0.0, 1.0);
        vec3 ramp = mix(vec3(0.5), clamp(vec3(1.5) - abs(4.0 * t - vec3(3.0, 2.0, 1.0)), 0.0, 1.0), 0.6);
        float d = min(distance(center, spirulaWaveAt.xyz), spirulaWaveAt.w);
        if (spirulaWaveAt.w > 0.0) ramp = mix(ramp, vec3(1.0), 0.7 * (1.0 - smoothstep(0.0, spirulaWave.z, spirulaWave.x - d)));
        color = vec4(ramp, 1.0);
    }
    if (center.y < spirulaClipY.x || center.y > spirulaClipY.y) color.a = 0.0;
}
`,
    wgsl: `
uniform spirulaClipY: vec2f;
uniform spirulaPoints: vec4f;
uniform spirulaWave: vec3f;
uniform spirulaWaveAt: vec4f;
fn spirulaStage(center: vec3f) -> f32 {
    let wave = uniform.spirulaWave;
    let at = uniform.spirulaWaveAt;
    let d = min(distance(center, at.xyz), at.w);
    if (at.w <= 0.0) {
        return uniform.spirulaPoints.x;
    }
    if (d > wave.x) {
        return 2.0;
    }
    return select(uniform.spirulaPoints.x, 1.0, d > wave.y);
}
fn modifySplatCenter(center: ptr<function, vec3f>) {
}
fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
    *scale = mix(*scale, vec3f(1e-5), min(spirulaStage(originalCenter), 1.0));
}
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
    let points = uniform.spirulaPoints;
    let wave = uniform.spirulaWave;
    let at = uniform.spirulaWaveAt;
    let stage = spirulaStage(center);
    if (stage > 1.5) {
        (*color).a = 0.0;
    } else if (stage > 0.0) {
        let t = clamp((center.y - points.y) / max(points.z - points.y, 1e-6), 0.0, 1.0);
        var ramp = mix(vec3f(0.5), clamp(vec3f(1.5) - abs(4.0 * t - vec3f(3.0, 2.0, 1.0)), vec3f(0.0), vec3f(1.0)), 0.6);
        let d = min(distance(center, at.xyz), at.w);
        if (at.w > 0.0) {
            ramp = mix(ramp, vec3f(1.0), 0.7 * (1.0 - smoothstep(0.0, wave.z, wave.x - d)));
        }
        *color = vec4f(ramp, 1.0);
    }
    if (center.y < uniform.spirulaClipY.x || center.y > uniform.spirulaClipY.y) {
        (*color).a = 0.0;
    }
}
`
};

// The heights of 0.5 % to 99.5 % of the splat centres, so a few floaters do not squeeze the range;
// the model's bounds when the format keeps no centres in memory (SOG, streamed LOD).
const heightRange = entity => {
    const m = entity.getWorldTransform().data;
    const data = entity.gsplat.resource?.gsplatData;
    const [x, y, z] = ['x', 'y', 'z'].map(name => data?.getProp?.(name));
    if (x && y && z) {
        const heights = new Float32Array(data.numSplats);
        let n = 0;
        for (let i = 0; i < data.numSplats; i++) {
            const h = m[1] * x[i] + m[5] * y[i] + m[9] * z[i] + m[13];
            if (Number.isFinite(h)) heights[n++] = h;
        }
        const sorted = heights.subarray(0, n).sort();
        const low = sorted[Math.floor(n * 0.005)];
        const high = sorted[Math.ceil(n * 0.995) - 1];
        if (high > low) return [low, high];
    }
    const box = entity.gsplat.customAabb;
    if (!box) return null;
    const c = box.center;
    const e = box.halfExtents;
    const mid = m[1] * c.x + m[5] * c.y + m[9] * c.z + m[13];
    const half = Math.abs(m[1]) * e.x + Math.abs(m[5]) * e.y + Math.abs(m[9]) * e.z;
    return half > 0 ? [mid - half, mid + half] : null;
};

const looks = new WeakMap();

// The one look per viewer: { range(), setClip(bottom, top), setPoints(on), setWave(at, fronts) }.
// range() is the model's height range, null until the splats load. setWave(null) ends the wave.
export const splatLook = viewer => {
    if (looks.has(viewer)) return looks.get(viewer);
    const { app, events } = viewer;
    const { gsplat: params } = app.scene;

    let target = null;
    let modified = false;
    let clip = [-OPEN, OPEN];
    let points = false;
    let wave = null;
    // the engine skips splats under 2 px and points draw about 1.5; the viewer's own value comes back
    let minPixelSize = null;
    let picker = null;
    events.on('picker:ready', p => { picker = p; });
    let renderer = null;
    const toRenderer = () => {
        renderer?.setHeightClip?.(...clip);
        renderer?.setPointMode?.(points, ...(target?.range ?? [0, 1]));
    };
    for (const name of ['splatRenderer:ready', 'splatRenderer:changed']) {
        events.on(name, r => {
            if (!r || r === renderer) return;
            renderer = r;
            toRenderer();
        });
    }

    const find = () => {
        if (target) return target;
        const entity = app.root.findByName('gsplat');
        const range = entity?.gsplat && heightRange(entity);
        if (range) target = { gsplat: entity.gsplat, range };
        return target;
    };
    const apply = (notify = true) => {
        if (!modified && !points && !wave && clip[0] === -OPEN && clip[1] === OPEN) return false;
        if (!find()) return false;
        const { gsplat, range: [low, high] } = target;
        if (!modified) {
            gsplat.setWorkBufferModifier(modifier);
            modified = true;
        }
        gsplat.setParameter('spirulaClipY', new Float32Array(clip));
        gsplat.setParameter('spirulaPoints', new Float32Array([points ? 1 : 0, low, high, 0]));
        gsplat.setParameter('spirulaWave', new Float32Array(wave?.fronts ?? [0, 0, 1]));
        gsplat.setParameter('spirulaWaveAt', new Float32Array(wave?.at ?? [0, 0, 0, 0]));
        const dots = points || !!wave;
        if (dots && minPixelSize === null) {
            minPixelSize = params.minPixelSize;
            params.minPixelSize = 1;
        }
        else if (!dots && minPixelSize !== null) {
            params.minPixelSize = minPixelSize;
            minPixelSize = null;
        }
        toRenderer();
        app.renderNextFrame = true;
        // the picker caches its render while the camera stays; the change reaches the work buffer
        // next frame. The measurements then test what covers them again.
        if (notify) app.once('frameend', () => {
            picker?.invalidate?.();
            events.fire('spirulaLook:changed');
        });
        return true;
    };
    if (!viewer.state.loaded) events.once('loaded:changed', () => apply());

    const look = {
        range: () => find()?.range ?? null,
        setClip: (bottom, top) => {
            clip = [bottom, top];
            apply();
        },
        setPoints: on => {
            points = on;
            apply();
        },
        // whether the splats took it: false until they load. The measurements hear of its end only.
        setWave: (at, fronts) => {
            wave = at ? { at, fronts } : null;
            return apply(!at);
        }
    };
    looks.set(viewer, look);
    return look;
};
