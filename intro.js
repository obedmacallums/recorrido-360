// The opening, as XGRIDS' LCC viewer does it: once the scene has loaded, a sphere of points coloured
// by height grows from the camera (from the model's centre when the camera starts outside it), and a
// second front behind it turns them into the splats, while the viewer's camera animation plays. The
// scene stays hidden until then (splats.js). Nothing beyond the radius is left out: it comes in with
// the last ring.

import { OPEN, splatLook } from './splats.js';

// about half the viewer's 20 s camera animation: the splats' front ends near 10 s
const POINTS = 5;   // seconds for the points to cover the model
const DELAY = 4.5;  // the splats' front behind the points'

// The world box corners of the splats, from the bounds the engine keeps in the model's frame.
const corners = entity => {
    const { center: c, halfExtents: e } = entity.gsplat.customAabb;
    const m = entity.getWorldTransform();
    return [0, 1, 2, 3, 4, 5, 6, 7].map(i => m.transformPoint(c.clone().add(
        e.clone().set(i & 1 ? e.x : -e.x, i & 2 ? e.y : -e.y, i & 4 ? e.z : -e.z))));
};

// From the centre: the distance within which 98 % of the splats lie, so a few floaters far out do
// not slow the wave, and the 2nd percentile of those the camera sees, where it starts so the first
// points show at once. The box's farthest corner and 0 when the format keeps no centres (SOG, LOD).
const reach = (entity, centre, box, camera) => {
    const data = entity.gsplat.resource?.gsplatData;
    const [x, y, z] = ['x', 'y', 'z'].map(name => data?.getProp?.(name));
    if (x && y && z) {
        const m = entity.getWorldTransform().data;
        const c = camera.camera.projectionMatrix.clone().mul(camera.getWorldTransform().clone().invert()).data;
        const step = Math.max(1, Math.floor(data.numSplats / 200000));
        const far = new Float32Array(Math.ceil(data.numSplats / step));
        const seen = new Float32Array(far.length);
        let n = 0, k = 0;
        for (let i = 0; i < data.numSplats; i += step) {
            const px = m[0] * x[i] + m[4] * y[i] + m[8] * z[i] + m[12];
            const py = m[1] * x[i] + m[5] * y[i] + m[9] * z[i] + m[13];
            const pz = m[2] * x[i] + m[6] * y[i] + m[10] * z[i] + m[14];
            const d = Math.hypot(px - centre.x, py - centre.y, pz - centre.z);
            if (!Number.isFinite(d)) continue;
            far[n++] = d;
            const w = c[3] * px + c[7] * py + c[11] * pz + c[15];
            if (w > 0 && Math.abs(c[0] * px + c[4] * py + c[8] * pz + c[12]) <= w &&
                Math.abs(c[1] * px + c[5] * py + c[9] * pz + c[13]) <= w) seen[k++] = d;
        }
        const r = far.subarray(0, n).sort()[Math.floor(n * 0.98)];
        const near = k ? seen.subarray(0, k).sort()[Math.floor(k * 0.02)] : 0;
        if (r > 0) return [Math.min(near, r), r];
    }
    return [0, Math.max(...box.map(p => p.distance(centre)))];
};

// Whether the opening will play, known before the viewer exists: not with reduced motion, nor in the
// Performance mode the viewer kept from an earlier visit (its renderer reads no work buffer).
export const introPlays = () => {
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
    try {
        const stored = localStorage.getItem('performanceMode');
        return stored === null ? localStorage.getItem('retinaDisplay') !== 'false' : stored !== 'true';
    } catch {
        return true;
    }
};

export const addIntro = viewer => {
    const { app, state, events } = viewer;
    const look = splatLook(viewer);

    const start = () => {
        const entity = app.root.findByName('gsplat');
        const camera = app.root.findByName('camera');
        if (!entity?.gsplat?.customAabb || !camera) return null;
        const box = corners(entity);
        const low = box[0].clone(), high = box[0].clone();
        box.forEach(p => { low.min(p); high.max(p); });
        const eye = camera.getPosition();
        const inside = ['x', 'y', 'z'].every(k => eye[k] >= low[k] && eye[k] <= high[k]);
        const centre = inside ? eye.clone() : low.clone().add(high).mulScalar(0.5);
        const [near, radius] = reach(entity, centre, box, camera);
        if (!(radius > 0)) return null;
        const speed = Math.max(radius - near, 0.1 * radius) / POINTS;
        return { at: [centre.x, centre.y, centre.z, radius], near, speed, glow: 0.12 * radius, time: 0 };
    };

    let hidden = false;
    let wave = null;
    const stop = () => {
        look.setWave(null);
        app.off('update', tick);
    };
    const tick = dt => {
        if (!state.loaded) {
            // hidden from the first streamed splats, so the coarse loading pass never shows
            if (!hidden) hidden = look.setWave([0, 0, 0, OPEN], [-1, -1, 1]);
            return;
        }
        // turned on while loading, Performance mode would not show the wave
        wave ??= state.performanceMode ? null : start();
        if (!wave) return stop();
        wave.time += dt;
        const t = wave.time;
        const splats = wave.near + wave.speed * (t - DELAY);
        if (splats > wave.at[3]) return stop();
        look.setWave(wave.at, [wave.near + wave.speed * t, splats, wave.glow]);
    };
    app.on('update', tick);
    events.on('xrMode:changed', mode => {
        if (mode) stop();
    });
};
