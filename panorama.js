// The capture's 360 photos where they were taken (docs/notes/web-panoramas.md). Each is one of the
// viewer's annotations, numbered after the hand-written views, so its point, occlusion and the
// previous/next navigator are the viewer's. The photo is drawn by a WebGL2 canvas of its own between
// the scene and the interface, from the viewer camera's live pose and fov: the viewer's controls
// look around it, and the other photos' points stay where they belong over it. It is a cube of WebP
// tiles at several sizes: the coarsest whole, the finer ones where the view needs and looks.

import { addTooltip } from './controls.js';

const text = {
    mode: {
        es: 'Modo pano', en: 'Pano mode', de: 'Panoramamodus', fr: 'Mode panorama',
        ja: 'パノラマモード', ko: '파노라마 모드', 'pt-BR': 'Modo pano', ru: 'Режим панорамы', 'zh-CN': '全景模式'
    },
    resume: {
        es: 'Volver a la panorámica', en: 'Back to the panorama', de: 'Zurück zum Panorama',
        fr: 'Revenir au panorama', ja: 'パノラマに戻る', ko: '파노라마로 돌아가기',
        'pt-BR': 'Voltar ao panorama', ru: 'Вернуться к панораме', 'zh-CN': '返回全景'
    },
    back: {
        es: 'Volver al modelo 3D', en: 'Back to the 3D model', de: 'Zurück zum 3D-Modell',
        fr: 'Retour au modèle 3D', ja: '3D モデルに戻る', ko: '3D 모델로 돌아가기',
        'pt-BR': 'Voltar ao modelo 3D', ru: 'Назад к 3D-модели', 'zh-CN': '返回 3D 模型'
    }
};

const panoramaButtonIcon = '<path fill-rule="evenodd" d="M2.8 6.2Q12 8.5 21.2 6.2Q23.5 12 21.2 17.8Q12 15.5 2.8 17.8Q.5 12 2.8 6.2Zm1.2 1.6Q12 9.7 20 7.8Q21.3 12 20 16.2Q12 14.3 4 16.2Q2.7 12 4 7.8Z"/>' +
    '<path d="m9.4 3.4 2-2a.85.85 0 0 1 1.2 0l2 2a.85.85 0 0 1-1.2 1.2L12 3.2l-1.4 1.4a.85.85 0 0 1-1.2-1.2Z"/>' +
    '<path transform="rotate(180 12 12)" d="m9.4 3.4 2-2a.85.85 0 0 1 1.2 0l2 2a.85.85 0 0 1-1.2 1.2L12 3.2l-1.4 1.4a.85.85 0 0 1-1.2-1.2Z"/>' +
    '<path d="M7.6 9.7a.85.85 0 0 1 0 1.2L6.5 12l1.1 1.1a.85.85 0 0 1-1.2 1.2l-1.7-1.7a.85.85 0 0 1 0-1.2l1.7-1.7a.85.85 0 0 1 1.2 0Z"/>' +
    '<path transform="rotate(180 12 12)" d="M7.6 9.7a.85.85 0 0 1 0 1.2L6.5 12l1.1 1.1a.85.85 0 0 1-1.2 1.2l-1.7-1.7a.85.85 0 0 1 0-1.2l1.7-1.7a.85.85 0 0 1 1.2 0Z"/>';

// Share of the way to the nearest other photo over which the photo fades in at the end of the
// flight: farther out it does not line up with the splats (parallax).
const ARRIVE_FADE = 0.1;
// Share of the way to the nearest other photo the camera can drift and stay in the photo (fly mode's
// collision can push it off one taken near a wall). Past it the photo fades out over EXIT_MS: a
// fade by distance would leave it half mixed with the splats, doubled by parallax.
const PLATEAU = 0.1;
// Arrived: this share of the way to the nearest other photo. Not waiting for stillness: the
// flight's damping keeps the camera creeping for seconds.
const ARRIVED = 0.02;
const FOV_MIN = 15, FOV_MAX = 120;
const EXIT_MS = 300;
// Tiles kept on the GPU (about 1.4 MB each at 512 pixels): twice those the view shows, so it turns
// without fetching again, but never fewer than the first or more than the second.
const MIN_TILES = 96, MAX_TILES = 300;
const MAX_LOADS = 6;
// A tile that fails is asked for again this many times, waiting 1, 2, 4... up to 16 s between.
const RETRIES = 8;
// Forward, right and up of each face in the photo's frame, in the files' order
// (src/app/gui/webexport/PanoramaTiles.cpp).
const FACES = [
    ['f', [0, 0, -1], [1, 0, 0], [0, 1, 0]],
    ['r', [1, 0, 0], [0, 0, 1], [0, 1, 0]],
    ['b', [0, 0, 1], [-1, 0, 0], [0, 1, 0]],
    ['l', [-1, 0, 0], [0, 0, -1], [0, 1, 0]],
    ['u', [0, 1, 0], [1, 0, 0], [0, 0, 1]],
    ['d', [0, -1, 0], [1, 0, 0], [0, 0, -1]]
];
// A flight still this long without arriving was interrupted: the photo is let go.
const STALL_MS = 500;

const flip = ([x, y, z]) => [-x, -y, z];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const length = a => Math.hypot(a[0], a[1], a[2]);
const normalize = a => {
    const l = length(a) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
};
const smooth = x => {
    const t = Math.min(1, Math.max(0, x));
    return t * t * (3 - 2 * t);
};

// scene.json's camera-to-world (x, y, z, w) as rows, turned into the engine's frame (half a turn
// about Z, as the camera is in experience.js)
const engineRotation = ([x, y, z, w]) => {
    const r = [
        1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
        2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
        2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)
    ];
    for (let i = 0; i < 6; i++) r[i] = -r[i];
    return r;
};

// Half the way to the nearest other photo; with one photo, `fallback`.
const reaches = (centres, fallback) => centres.map((c, i) => {
    let best = Infinity;
    centres.forEach((o, j) => { if (j !== i) best = Math.min(best, length(sub(o, c))); });
    return Number.isFinite(best) && best > 0 ? best / 2 : fallback();
});

// The photos as annotations, to go into the viewer's settings before it is created.
export const panoramaAnnotations = (scene, fov) => {
    const list = scene.panoramas || [];
    const centres = list.map(p => flip(p.position));
    const start = scene.camera ? flip(scene.camera.position) : null;
    const reach = reaches(centres, () => 1);
    return list.map((p, i) => {
        const r = engineRotation(p.initial_rotation ?? p.rotation);
        const ahead = [-r[2], -r[5], -r[8]];
        const c = centres[i];
        const d = 0.05 * (list.length > 1 || !start ? reach[i] : Math.max(length(sub(start, c)) / 2, 1e-3));
        return {
            position: c,
            title: p.name,
            text: '',
            camera: { initial: { position: c, target: [c[0] + ahead[0] * d, c[1] + ahead[1] * d, c[2] + ahead[2] * d], fov } },
            spirulaPanorama: i
        };
    });
};

// One tile: a square of a cube face, `rect` from (a0, b0) to (a1, b1) in -1..1 with b growing down
// the image, turned into the camera's frame and projected. Planar, so its texture needs no more.
const VERTEX = `#version 300 es
uniform mat3 toCamera;
uniform mat3 face;
uniform vec4 rect;
uniform vec2 tanHalf;
out vec2 uv;
void main() {
    int i = gl_VertexID;
    uv = vec2(i == 1 || i == 2 || i == 4 ? 1.0 : 0.0, i == 2 || i == 4 || i == 5 ? 1.0 : 0.0);
    vec2 ab = mix(rect.xy, rect.zw, uv);
    vec3 v = toCamera * (face * vec3(1.0, ab.x, -ab.y));
    gl_Position = vec4(v.x / tanHalf.x, v.y / tanHalf.y, 0.0, -v.z);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D tile;
out vec4 color;
void main() {
    color = vec4(texture(tile, uv).rgb, 1.0);
}`;

export const addPanoramas = (viewer, root, scene, first, fov, lang) => {
    const list = scene.panoramas || [];
    if (!list.length) return;
    const t = key => text[key][lang] ?? text[key].en;
    const { app, state, events } = viewer;
    const cameraEntity = app.root.findByName('camera');
    const sceneCanvas = root.querySelector('canvas');
    const photos = list.map(p => ({ ...p, centre: flip(p.position), rotation: engineRotation(p.rotation),
        initialRotation: engineRotation(p.initial_rotation ?? p.rotation) }));
    const sceneHalf = () => {
        const box = app.root.findByName('gsplat')?.gsplat?.customAabb;
        const h = box ? box.halfExtents.length() : 0;
        return h > 0 ? h : 1;
    };
    // with one photo, read when used: the model's bounds come after createViewer returns
    const near = reaches(photos.map(p => p.centre), () => 0);
    const reach = i => near[i] || sceneHalf();

    let target = -1;           // the photo being flown to
    let inside = -1;           // the photo the camera stands in
    let compare = -1;
    let comparePosition = null;
    let preserveView = false;
    let leaving = -1, leftAt = 0, leftAlpha = 1;
    let zoom = fov;
    let flyFovChanged = false;
    let lastPose = null, lastMove = 0;
    let last = null;         // what was drawn, so a still frame is not drawn twice
    let nearest = -1, nearestAt = -Infinity, nearestPosition = null;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'spirulaPano sse-controlButton sse-toggle sse-left';
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">' +
        `<g class="sse-stroke">${panoramaButtonIcon}</g><g class="sse-fill">${panoramaButtonIcon}</g></svg>`;
    button.setAttribute('aria-label', t('mode'));
    button.setAttribute('aria-pressed', 'false');
    let label = t('mode');
    addTooltip(root, button, () => label);
    button.disabled = !state.loaded;
    const orbitButton = root.querySelector('.sse-orbitCamera');
    const cameraButtons = [orbitButton, root.querySelector('.sse-flyCamera'), root.querySelector('.sse-fpsCamera')];
    const cameraModes = ['orbit', 'fly', 'walk'];
    orbitButton.classList.remove('sse-left');
    orbitButton.classList.add('sse-middle');
    const cameraGroup = orbitButton.parentElement;
    cameraGroup.prepend(button);

    // ---- the overlay

    const overlay = document.createElement('canvas');
    overlay.className = 'spirulaPanorama';
    sceneCanvas.after(overlay);
    const gl = overlay.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) {
        button.remove();
        orbitButton.classList.remove('sse-middle');
        orbitButton.classList.add('sse-left');
        return;
    }
    const shader = (type, source) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, source);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
    };
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    const uniform = name => gl.getUniformLocation(program, name);
    const u = { toCamera: uniform('toCamera'), face: uniform('face'), rect: uniform('rect'), tanHalf: uniform('tanHalf') };
    gl.bindVertexArray(gl.createVertexArray());

    // ---- the tiles

    // Level `l` of a photo: its face side, tiles a side, and each tile's rectangle on the face.
    const grid = (photo, l) => {
        const size = photo.tiles.levels[l], tile = photo.tiles.tile, n = Math.ceil(size / tile);
        const edge = k => Math.min(1, 2 * k * tile / size - 1);
        return { n, rect: (row, col) => [edge(col), edge(row), edge(col + 1), edge(row + 1)] };
    };
    const tileKey = (index, l, f, row, col) => `${index}/${l}/${FACES[f][0]}_${row}_${col}`;
    const tiles = new Map();    // key -> { tex, used }
    const loading = new Set();
    const failed = new Set();   // waiting to be asked for again, or given up on
    const tries = new Map();    // key -> times it failed
    let version = 0;           // tiles loaded, so a still frame redraws when one arrives
    let drawn = 0;              // frames drawn, for the least recently used
    const keep = new Set();     // photos whose coarsest level is not evicted
    let budget = MIN_TILES;     // tiles kept, from what the last frame showed

    const evict = () => {
        if (tiles.size <= budget) return;
        const old = [...tiles].filter(([k, t]) => t.used < drawn && !(k.split('/')[1] === '0' && keep.has(+k.split('/')[0])))
            .sort((a, b) => a[1].used - b[1].used);
        for (const [k, t] of old.slice(0, tiles.size - budget)) {
            gl.deleteTexture(t.tex);
            tiles.delete(k);
        }
    };
    const request = (index, l, f, row, col, urgent) => {
        const key = tileKey(index, l, f, row, col);
        if (tiles.has(key) || loading.has(key) || failed.has(key) || (!urgent && loading.size >= MAX_LOADS)) return;
        loading.add(key);
        const image = new Image();
        image.src = `${photos[index].tiles.path}/${l}/${FACES[f][0]}_${row}_${col}.webp`;
        image.decode().then(() => {
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            tiles.set(key, { tex, used: drawn });
            tries.delete(key);
            evict();
        }).catch(error => {
            // GitHub Pages and the like answer a burst of requests with the odd 503
            const n = (tries.get(key) ?? 0) + 1;
            tries.set(key, n);
            failed.add(key);
            if (n > RETRIES) console.error(`${image.src}: ${error.message}`);
            else setTimeout(() => {
                failed.delete(key);
                request(index, l, f, row, col, urgent);
                version++;
            }, Math.min(2 ** (n - 1), 16) * 1000);
        }).finally(() => {
            loading.delete(key);
            version++;
        });
    };
    // The coarsest level, fetched as soon as the photo is chosen: it is what is shown first.
    const each = (index, l, fn) => {
        const { n } = grid(photos[index], l);
        for (let f = 0; f < 6; f++)
            for (let row = 0; row < n; row++)
                for (let col = 0; col < n; col++) fn(f, row, col);
    };
    const load = index => {
        keep.clear();
        keep.add(index);
        each(index, 0, (f, row, col) => {
            // chosen again: what was given up on gets another round
            const key = tileKey(index, 0, f, row, col);
            if (tries.get(key) > RETRIES) {
                failed.delete(key);
                tries.delete(key);
            }
            request(index, 0, f, row, col, true);
        });
    };
    const ready = index => {
        let all = true;
        each(index, 0, (f, row, col) => { all = all && tiles.has(tileKey(index, 0, f, row, col)); });
        return all;
    };

    // ---- what is shown

    const hotspots = () => root.querySelectorAll('.sse-annotation-hotspot');
    const markHere = () => hotspots().forEach((h, i) => h.classList.toggle('spirulaPanoramaHere', inside >= 0 && i === first + inside));
    const canCompare = c => compare >= 0 && comparePosition !== null &&
        length(sub(c.pos, comparePosition)) <= PLATEAU * reach(compare) &&
        length(sub(c.pos, photos[compare].centre)) <= PLATEAU * reach(compare);
    const updateButton = c => {
        if (compare >= 0 && !canCompare(c)) {
            compare = -1;
            comparePosition = null;
        }
        label = inside >= 0 ? `${t('mode')} · ${t('back')}` :
            canCompare(c) ? `${t('mode')} · ${t('resume')}` : t('mode');
        button.disabled = !state.loaded;
        button.setAttribute('aria-pressed', String(inside >= 0));
        button.classList.toggle('sse-active', inside >= 0);
        cameraButtons.forEach((b, i) => b.classList.toggle('sse-active', inside < 0 && state.cameraMode === cameraModes[i]));
    };

    const leave = (index, alpha) => {
        leaving = index;
        leftAt = performance.now();
        leftAlpha = alpha;
    };
    const targetAlpha = c => smooth(1 - length(sub(c.pos, photos[target].centre)) / (ARRIVE_FADE * reach(target)));
    const resumeNearest = () => {
        if (inside < 0 && target < 0 && state.selectedAnnotation != null) viewer.selectAnnotation(null);
    };
    const abandon = c => {
        leave(target, targetAlpha(c));
        target = -1;
        resumeNearest();
    };
    const exit = forComparison => {
        if (inside < 0) return;
        compare = forComparison ? inside : -1;
        comparePosition = forComparison ? camera().pos : null;
        leave(inside, 1);
        inside = -1;
        state.panorama = false;
        if (forComparison) {
            zoom = cameraEntity.camera.fov;
            flyFovChanged = zoom !== fov;
            state.cameraMode = 'fly';
            events.fire('look', null, null, zoom);
        } else if (state.cameraMode === 'fly') {
            events.fire('look', null, null, fov);
            flyFovChanged = false;
        } else {
            flyFovChanged = flyFovChanged || zoom !== fov;
        }
        if (!forComparison) zoom = fov;
        markHere();
        updateButton(camera());
    };
    const enter = index => {
        inside = index;
        target = -1;
        leaving = -1;
        state.panorama = true;
        zoom = preserveView ? cameraEntity.camera.fov : fov;
        state.cameraMode = 'fly';
        const r = photos[index].initialRotation;
        const yaw = (r[2] * r[2] + r[8] * r[8] > 1e-8 ? Math.atan2(r[2], r[8]) :
            Math.atan2(-r[6], r[0])) * 180 / Math.PI;
        const pitch = Math.asin(Math.max(-1, Math.min(1, -r[5]))) * 180 / Math.PI;
        events.fire('look', preserveView ? null : yaw, preserveView ? null : pitch, zoom);
        preserveView = false;
        // the viewer keeps the navigator's place; selected, its label sticks to the screen's edge
        viewer.selectAnnotation(null);
        markHere();
        updateButton(camera());
    };

    events.on('selectedAnnotation:changed', value => {
        if (value === null || value === undefined) return;
        nearestPosition = null;
        nearest = -1;
        const index = value - first;
        preserveView = index === compare && canCompare(camera());
        compare = -1;
        comparePosition = null;
        updateButton(camera());
        // Selection starts a flight before this event; comparison must cancel it before its first frame.
        if (preserveView) events.fire('look', null, null, cameraEntity.camera.fov);
        if (inside >= 0 && index !== inside) {
            // selecting moved the viewer to orbit already; a look now would cancel its flight
            leave(inside, 1);
            flyFovChanged = flyFovChanged || zoom !== fov;
            inside = -1;
            state.panorama = false;
            markHere();
        }
        if (index < 0 || index >= photos.length) {
            target = -1;
            return;
        }
        target = index;
        lastMove = performance.now();
        load(index);
    });
    // Another mode leaves the photo: walk moves the camera to eye height, off the photo's centre.
    // One other than orbit ends a flight to it. A fly mode entered later must not keep a photo's zoom.
    events.on('cameraMode:changed', mode => {
        if (mode !== 'fly' && inside >= 0) exit(false);
        if (mode !== 'orbit' && target >= 0) abandon(camera());
        if (mode === 'fly' && inside < 0 && flyFovChanged) {
            flyFovChanged = false;
            events.fire('look', null, null, fov);
        }
        resumeNearest();
    });
    events.on('inputEvent', name => {
        if (['interrupt', 'frame', 'reset', 'requestFirstPerson'].includes(name)) resumeNearest();
    });
    for (const name of ['navigateCancel', 'navigateTo', 'pick', 'align']) events.on(name, resumeNearest);

    const camera = () => {
        const w = cameraEntity.getWorldTransform().data;
        return {
            pos: [w[12], w[13], w[14]],
            axes: [normalize([w[0], w[1], w[2]]), normalize([w[4], w[5], w[6]]), normalize([w[8], w[9], w[10]])],
            p: cameraEntity.camera.projectionMatrix.data
        };
    };

    const updateNearest = (c, now) => {
        if (!state.loaded || inside >= 0 || target >= 0 || state.selectedAnnotation != null || now - nearestAt < 200) return;
        if (nearestPosition && c.pos.every((v, i) => Math.abs(v - nearestPosition[i]) < 1e-7)) return;
        nearestAt = now;
        nearestPosition = c.pos;
        const distance = i => photos[i].centre.reduce((sum, v, k) => sum + (v - c.pos[k]) ** 2, 0);
        let best = nearest >= 0 ? nearest : 0;
        let bestDistance = distance(best);
        for (let i = 0; i < photos.length; i++) {
            const d = distance(i);
            if (d < bestDistance) { best = i; bestDistance = d; }
        }
        if (nearest >= 0 && best !== nearest && bestDistance >= distance(nearest) * 0.81) best = nearest;
        nearest = best;
        events.fire('annotation:nearby', first + nearest);
    };

    // [photo, opacity] to draw, or null
    const shown = c => {
        let best = null;
        const consider = (index, a) => {
            if (index >= 0 && a > 0 && (!best || a > best[1])) best = [index, a];
        };
        if (inside >= 0) {
            if (length(sub(c.pos, photos[inside].centre)) > PLATEAU * reach(inside)) exit(false);
            else consider(inside, 1);
        }
        if (target >= 0) consider(target, targetAlpha(c));
        if (leaving >= 0) {
            const a = leftAlpha * (1 - (performance.now() - leftAt) / EXIT_MS);
            if (a <= 0) leaving = -1;
            else consider(leaving, a);
        }
        return best;
    };

    const draw = (c, index, a) => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(1, Math.round(overlay.clientWidth * dpr));
        const h = Math.max(1, Math.round(overlay.clientHeight * dpr));
        if (overlay.width !== w || overlay.height !== h) {
            overlay.width = w;
            overlay.height = h;
        }
        gl.viewport(0, 0, w, h);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        if (index < 0 || !ready(index)) return;
        drawn++;
        // the tiles are opaque and overlap, so the fade is the canvas'
        overlay.style.opacity = String(a);
        // toCamera = (right, up, back)^T R^T, column-major: the photo's axes in the camera's frame
        const r = photos[index].rotation;
        const m = [];
        for (let k = 0; k < 3; k++)
            for (const axis of c.axes) m.push(r[k] * axis[0] + r[3 + k] * axis[1] + r[6 + k] * axis[2]);
        const tanX = 1 / c.p[0], tanY = 1 / c.p[5];
        const toCamera = v => [0, 1, 2].map(j => m[j] * v[0] + m[3 + j] * v[1] + m[6 + j] * v[2]);
        const corner = (f, a0, b0) => {
            const [, fw, rt, up] = FACES[f];
            const v = toCamera([0, 1, 2].map(k => fw[k] + a0 * rt[k] - b0 * up[k]));
            return [v[0] / tanX, v[1] / tanY, -v[2]];
        };
        // off screen when its four corners are all past one side of the view
        const visible = (f, [a0, b0, a1, b1]) => {
            const q = [corner(f, a0, b0), corner(f, a1, b0), corner(f, a1, b1), corner(f, a0, b1)];
            return !(q.every(p => p[0] > p[2]) || q.every(p => p[0] < -p[2]) || q.every(p => p[1] > p[2]) ||
                q.every(p => p[1] < -p[2]) || q.every(p => p[2] <= 0));
        };
        // the level whose face has at least the screen's pixels across its centre, or a coarser one
        // when the tiles shown down to it would not fit twice in the most kept
        const levels = photos[index].tiles.levels;
        let fine = levels.findIndex(size => size >= 0.9 * w / tanX);
        if (fine < 0) fine = levels.length - 1;
        const shown = [];
        for (let l = 0; l <= fine; l++) {
            const g = grid(photos[index], l), list = [];
            for (let f = 0; f < 6; f++)
                for (let row = 0; row < g.n; row++)
                    for (let col = 0; col < g.n; col++) {
                        const rect = g.rect(row, col);
                        if (visible(f, rect)) list.push([f, row, col, rect]);
                    }
            shown.push(list);
        }
        let count = shown.reduce((sum, list) => sum + list.length, 0);
        while (fine > 0 && 2 * count > MAX_TILES) count -= shown[fine--].length;
        budget = Math.max(MIN_TILES, 2 * count);
        gl.useProgram(program);
        gl.uniformMatrix3fv(u.toCamera, false, m);
        gl.uniform2f(u.tanHalf, tanX, tanY);
        const wanted = [];
        for (let l = 0; l <= fine; l++)
            for (const [f, row, col, rect] of shown[l]) {
                const t = tiles.get(tileKey(index, l, f, row, col));
                if (!t) {
                    if (l === fine) {
                        const mid = corner(f, (rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2);
                        wanted.push([Math.hypot(mid[0], mid[1]) / Math.max(mid[2], 1e-6), f, row, col]);
                    }
                    continue;
                }
                t.used = drawn;
                gl.uniformMatrix3fv(u.face, false, [...FACES[f][1], ...FACES[f][2], ...FACES[f][3]]);
                gl.uniform4fv(u.rect, rect);
                gl.bindTexture(gl.TEXTURE_2D, t.tex);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
            }
        // the centre of the view first; a smaller budget lets go of what is over it now
        wanted.sort((x, y) => x[0] - y[0]).forEach(([, f, row, col]) => request(index, fine, f, row, col, false));
        evict();
    };

    const frame = () => {
        const c = camera();
        const pose = [...c.pos, ...c.axes.flat(), c.p[0], c.p[5]];
        const now = performance.now();
        if (!lastPose || pose.some((v, i) => Math.abs(v - lastPose[i]) > 1e-7)) lastMove = now;
        lastPose = pose;
        if (target >= 0) {
            if (!preserveView && length(sub(c.pos, photos[target].centre)) > ARRIVED * reach(target)) {
                if (now - lastMove > STALL_MS) abandon(c);
            } else if (ready(target)) {
                enter(target);
            }
        }
        const s = shown(c);
        updateButton(c);
        updateNearest(c, now);
        const key = s ? `${s[0]} ${s[1]} ${version} ${overlay.clientWidth}x${overlay.clientHeight} ${pose.join(' ')}` : '';
        if (key === last) return;
        last = key;
        overlay.style.visibility = s ? 'visible' : 'hidden';
        draw(c, s ? s[0] : -1, s ? s[1] : 0);
    };
    app.on('prerender', frame);
    // the viewer draws only while something moves, so stillness and fades need a clock of their own
    const tick = () => {
        frame();
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    // ---- the way out, and the zoom

    cameraGroup.addEventListener('click', e => {
        const mode = e.target.closest('.sse-orbitCamera, .sse-flyCamera, .sse-fpsCamera');
        if (mode && !mode.disabled && inside >= 0) exit(true);
    }, true);
    button.addEventListener('click', e => {
        e.stopPropagation();
        if (inside >= 0) exit(true);
        else if (target < 0) {
            const c = camera();
            const index = canCompare(c) ? compare : nearest >= 0 ? nearest : photos.reduce((best, photo, i) =>
                length(sub(c.pos, photo.centre)) < length(sub(c.pos, photos[best].centre)) ? i : best, 0);
            viewer.selectAnnotation(first + index);
        }
    });
    // the viewer reads keys from window, so a focused button would also take Space
    button.addEventListener('pointerup', () => button.blur());
    button.addEventListener('keydown', e => {
        if (e.key === ' ' || e.key === 'Enter') e.stopPropagation();
    });
    events.on('panorama:exit', () => {
        if (inside >= 0 && !state.measuring) exit(true);
    });
    sceneCanvas.addEventListener('dblclick', e => {
        if (inside < 0 || state.measuring || e.button !== 0) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        exit(true);
    }, true);

    // Capturing, so neither reaches the viewer: Escape would leave walk or fly, the wheel would fly.
    window.addEventListener('keydown', e => {
        if (inside < 0 || state.measuring) return;
        const key = /^[\x20-\x7e]$/.test(e.key) ? e.key : /^Digit([123])$/.exec(e.code)?.[1];
        if (!e.ctrlKey && !e.altKey && !e.metaKey && state.inputEnabled !== false &&
            (key === '1' || key === '2' || (key === '3' && state.walkAllowed))) {
            exit(true);
            return;
        }
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        exit(true);
    }, true);
    root.addEventListener('wheel', e => {
        if (inside < 0) return;
        e.preventDefault();
        e.stopPropagation();
        zoom = Math.min(FOV_MAX, Math.max(FOV_MIN, zoom * Math.exp(e.deltaY * 0.001)));
        events.fire('look', null, null, zoom);
    }, { capture: true, passive: false });

    // Two fingers on a photo zoom it, as the wheel does: the viewer would move the camera off it.
    // The viewer is told the first finger lifted, so neither turns the view until both do.
    const fingers = new Map();  // touches the viewer has, id -> last event
    const pinch = new Map();    // touches zooming, id -> last event
    const extra = new Set();    // touches that came during a pinch, which the viewer never sees
    let pinchFrom = 0, pinchZoom = 0, faking = false;
    const spread = () => {
        const [a, b] = pinch.values();
        return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    };
    const swallow = e => {
        e.preventDefault();
        e.stopImmediatePropagation();
    };
    root.addEventListener('pointerdown', e => {
        if (e.pointerType !== 'touch' || faking) return;
        if (pinch.size) {
            extra.add(e.pointerId);
            swallow(e);
        } else if (e.target !== sceneCanvas) return;
        else if (inside >= 0 && !state.measuring && fingers.size === 1) {
            const [[id, first]] = fingers;
            fingers.clear();
            faking = true;
            sceneCanvas.dispatchEvent(new PointerEvent('pointerup', {
                pointerId: id, pointerType: 'touch', isPrimary: first.isPrimary, bubbles: true,
                clientX: first.clientX, clientY: first.clientY, screenX: first.screenX, screenY: first.screenY
            }));
            faking = false;
            pinch.set(id, first).set(e.pointerId, e);
            pinchFrom = Math.max(spread(), 1);
            pinchZoom = zoom;
            swallow(e);
        } else {
            fingers.set(e.pointerId, e);
        }
    }, true);
    root.addEventListener('pointermove', e => {
        if (fingers.has(e.pointerId)) fingers.set(e.pointerId, e);
        if (extra.has(e.pointerId)) swallow(e);
        if (!pinch.has(e.pointerId)) return;
        swallow(e);
        pinch.set(e.pointerId, e);
        if (pinch.size < 2 || inside < 0) return;
        zoom = Math.min(FOV_MAX, Math.max(FOV_MIN, pinchZoom * pinchFrom / Math.max(spread(), 1)));
        events.fire('look', null, null, zoom);
    }, true);
    const lift = e => {
        if (faking) return;
        fingers.delete(e.pointerId);
        if (pinch.delete(e.pointerId) || extra.delete(e.pointerId)) swallow(e);
    };
    root.addEventListener('pointerup', lift, true);
    root.addEventListener('pointercancel', lift, true);
};
