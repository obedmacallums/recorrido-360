// SuperSplat editor's measure tool (src/tools/measure-tool.ts) for the published viewer, keeping
// several measurements, lengths or areas: points picked on the splats, the selected one moved with
// a copy of PlayCanvas' TranslateGizmo. Drawn as SVG over the scene, since the bundled engine has no
// gizmos. World units are meters. Each visitor's measurements stay in their browser's localStorage.

import { addTooltip, addKeyHint } from './controls.js';

const text = {
    measure: {
        es: 'Medir', en: 'Measure', de: 'Messen', fr: 'Mesurer', ja: '計測',
        ko: '측정', 'pt-BR': 'Medir', ru: 'Измерение', 'zh-CN': '测量'
    },
    hint: {
        es: 'Coloca 2 puntos para medir', en: 'Place 2 points to measure',
        de: 'Setze 2 Punkte zum Messen', fr: 'Placez 2 points pour mesurer',
        ja: '2点を置いて計測', ko: '측정할 두 점을 찍으세요', 'pt-BR': 'Coloque 2 pontos para medir',
        ru: 'Поставьте 2 точки для измерения', 'zh-CN': '放置 2 个点进行测量'
    },
    areaHint: {
        es: 'Coloca 3 puntos o más y pulsa Terminar',
        en: 'Place 3 or more points, then press Finish',
        de: 'Setze mindestens 3 Punkte und drücke Fertig',
        fr: 'Placez au moins 3 points, puis appuyez sur Terminer',
        ja: '3点以上を置き、「完了」を押します',
        ko: '3개 이상의 점을 찍고 완료를 누르세요',
        'pt-BR': 'Coloque 3 pontos ou mais e toque em Concluir',
        ru: 'Поставьте 3 или более точек и нажмите «Готово»',
        'zh-CN': '放置至少 3 个点，然后按“完成”'
    },
    finish: {
        es: 'Terminar', en: 'Finish', de: 'Fertig', fr: 'Terminer', ja: '完了',
        ko: '완료', 'pt-BR': 'Concluir', ru: 'Готово', 'zh-CN': '完成'
    },
    undo: {
        es: 'Deshacer', en: 'Undo', de: 'Rückgängig', fr: 'Annuler', ja: '元に戻す',
        ko: '실행 취소', 'pt-BR': 'Desfazer', ru: 'Отменить', 'zh-CN': '撤销'
    },
    length: {
        es: 'Longitud', en: 'Length', de: 'Länge', fr: 'Longueur', ja: '長さ',
        ko: '길이', 'pt-BR': 'Comprimento', ru: 'Длина', 'zh-CN': '长度'
    },
    distance: {
        es: 'Distancia', en: 'Distance', de: 'Abstand', fr: 'Distance', ja: '距離',
        ko: '거리', 'pt-BR': 'Distância', ru: 'Расстояние', 'zh-CN': '距离'
    },
    area: {
        es: 'Área', en: 'Area', de: 'Fläche', fr: 'Surface', ja: '面積',
        ko: '면적', 'pt-BR': 'Área', ru: 'Площадь', 'zh-CN': '面积'
    },
    clear: {
        es: 'Borrar', en: 'Clear', de: 'Löschen', fr: 'Effacer', ja: 'クリア',
        ko: '지우기', 'pt-BR': 'Limpar', ru: 'Очистить', 'zh-CN': '清除'
    },
    pivot: {
        es: 'Pivote', en: 'Pivot', de: 'Drehpunkt', fr: 'Pivot', ja: 'ピボット',
        ko: '피벗', 'pt-BR': 'Pivô', ru: 'Точка вращения', 'zh-CN': '旋转中心'
    },
    rightClick: {
        es: 'Clic derecho', en: 'Right click', de: 'Rechtsklick', fr: 'Clic droit', ja: '右クリック',
        ko: '우클릭', 'pt-BR': 'Clique direito', ru: 'Правый клик', 'zh-CN': '右键'
    },
    remove: {
        es: 'Borrar medición', en: 'Delete measurement', de: 'Messung löschen', fr: 'Supprimer la mesure',
        ja: '計測を削除', ko: '측정 삭제', 'pt-BR': 'Excluir medição', ru: 'Удалить измерение', 'zh-CN': '删除测量'
    },
    hide: {
        es: 'Ocultar mediciones', en: 'Hide measurements', de: 'Messungen ausblenden',
        fr: 'Masquer les mesures', ja: '計測を隠す', ko: '측정 숨기기', 'pt-BR': 'Ocultar medições',
        ru: 'Скрыть измерения', 'zh-CN': '隐藏测量'
    }
};

const SVG = 'http://www.w3.org/2000/svg';
const TRASH = `<svg xmlns="${SVG}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M9 6V4h6v2M18 6l-1 14H7L6 6M10 11v5M14 11v5"/></svg>';
// a pointer that moves less than this between down and up still clicks: measure-tool.ts for a
// mouse, the viewer's TAP_EPSILON for a finger
const CLICK_TOLERANCE = 4;
const TAP_TOLERANCE = 15;
// half of the 44 px Apple recommends; a tap this close to a point means the point
const TAP_REACH = 22;

// Faded behind the splats as the viewer's hotspots are (Annotations in viewer.js): tested once the
// camera rests, covered when the splats in front are at least half opaque, ignoring what lies
// within a tenth of the depth (a point sits on the surface it was picked on).
const SETTLE_MS = 150;
const OCCLUDING_OPACITY = 0.5;
const OCCLUSION_TOLERANCE = 0.1;
const SAMPLE_RADIUS = 5;
// a line is tested, and faded, in this many pieces
const PIECES = 16;

// TranslateGizmo's defaults, in gizmo units: one unit is gizmo.size * 0.3 * tan(fov / 2) * depth
const LINE_LENGTH = 0.5;
const LINE_THICKNESS = 0.02;
const LINE_TOLERANCE = 0.1;
const ARROW_LENGTH = 0.18;
const ARROW_RADIUS = 0.06;
const PLANE_SIZE = 0.16;
const CENTER_RADIUS = 0.03;
const GLANCE_EPSILON = 0.01;

const AXES = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
// a plane shape is named by its normal, as in TranslateGizmo (yz is 'x')
const PLANES = { x: ['y', 'z'], y: ['x', 'z'], z: ['x', 'y'] };
const BASE = { x: 'rgb(255,77,77)', y: 'rgb(77,255,77)', z: 'rgb(77,77,255)', xyz: 'rgb(204,204,204)' };
const HOVER = { x: 'rgb(255,210,210)', y: 'rgb(210,255,210)', z: 'rgb(210,210,255)', xyz: 'rgb(255,255,255)' };

// the crosshair cursor in the viewer's accent; CSS takes no var() inside url(), so it is read here
const crosshair = root => {
    const accent = getComputedStyle(root).getPropertyValue('--sse-accent').trim() || '#f60';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">' +
        '<path d="M12 3v18M3 12h18" stroke="#000" stroke-opacity=".35" stroke-width="3.5"/>' +
        `<path d="M12 3v18M3 12h18" stroke="${accent}" stroke-width="1.5"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12`;
};

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const lerp = (a, b, t) => add(a, mul(sub(b, a), t));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = a => Math.hypot(a[0], a[1], a[2]);
const normalize = a => mul(a, 1 / (length(a) || 1));

// Newell's vector area, twice over. Its length is the area on the polygon's best-fit plane: the
// same from any first vertex, on a concave polygon too, and picks' depth noise does not inflate it
// as a sum of triangle areas would.
const areaVector = points => points.reduce((sum, q, i) => add(sum, cross(sub(q, points[0]), sub(points[(i + 1) % points.length], points[0]))), [0, 0, 0]);
const areaOf = points => length(areaVector(points)) / 2;
// area-weighted; the vertices' mean when they are collinear
const centroid = points => {
    const normal = areaVector(points);
    let sum = [0, 0, 0];
    let weight = 0;
    for (let i = 1; i + 1 < points.length; i++) {
        const a = points[0], b = points[i], d = points[i + 1];
        const w = dot(cross(sub(b, a), sub(d, a)), normal);
        sum = add(sum, mul(add(add(a, b), d), w / 3));
        weight += w;
    }
    return weight > 0 ? mul(sum, 1 / weight) : mul(points.reduce(add), 1 / points.length);
};

const hull = points => {
    const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const half = list => {
        const out = [];
        for (const q of list) {
            while (out.length >= 2 && turn(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop();
            out.push(q);
        }
        out.pop();
        return out;
    };
    return half(p).concat(half(p.reverse()));
};

// one list per published folder
const storageKey = `spirula.measures:${new URL('.', location.href).pathname}`;
const isPoint = q => Array.isArray(q) && q.length === 3 && q.every(Number.isFinite);
// stored as [a, b] for a length and { area: points } for an area
const load = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(storageKey));
        if (!Array.isArray(saved)) return [];
        return saved.map(m => (Array.isArray(m) ? { points: m, area: false } : { points: m?.area, area: true }))
            .filter(({ points, area }) => Array.isArray(points) && points.every(isPoint) && (area ? points.length >= 3 : points.length === 2));
    } catch {
        return [];
    }
};

const element = (tag, attrs, parent) => {
    const e = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    parent?.append(e);
    return e;
};

export const addMeasureTool = (viewer, root, lang) => {
    const t = key => text[key][lang] ?? text[key].en;
    const { app, state, events } = viewer;
    const canvas = root.querySelector('canvas');
    const cameraEntity = app.root.findByName('camera');
    const cam = cameraEntity.camera;
    let picker = null;
    events.on('picker:ready', p => { picker = p; });

    // { points, area }; only the last one can be unfinished: a length with one point, or `drawing`
    const measures = load();
    let drawing = null;
    let mode = 'distance';
    let selection = null;
    const selected = () => measures[selection.m].points[selection.i];
    let hidden = false;
    let active = false;
    let hovered = null;
    let drag = null;

    // ---- camera: computed from the entity, since the view matrix is refreshed only on frames that render

    const W = () => canvas.clientWidth;
    const H = () => canvas.clientHeight;
    const camera = () => {
        const w = cameraEntity.getWorldTransform().data;
        return {
            pos: [w[12], w[13], w[14]], right: [w[0], w[1], w[2]], up: [w[4], w[5], w[6]],
            back: normalize([w[8], w[9], w[10]]), near: cam.nearClip, far: cam.farClip, p: cam.projectionMatrix.data
        };
    };
    const toView = (c, q) => {
        const d = sub(q, c.pos);
        return [dot(d, normalize(c.right)), dot(d, normalize(c.up)), dot(d, c.back)];
    };
    const project = (c, v) => {
        const p = c.p;
        const x = p[0] * v[0] + p[4] * v[1] + p[8] * v[2] + p[12];
        const y = p[1] * v[0] + p[5] * v[1] + p[9] * v[2] + p[13];
        const w = p[3] * v[0] + p[7] * v[1] + p[11] * v[2] + p[15];
        return [(x / w * 0.5 + 0.5) * W(), (0.5 - y / w * 0.5) * H()];
    };
    // null behind the near plane
    const screen = (c, q) => {
        const v = toView(c, q);
        return v[2] < -c.near ? project(c, v) : null;
    };
    // a world segment on screen, cut at the near plane; null when wholly behind it
    const segment = (c, a, b) => {
        let va = toView(c, a), vb = toView(c, b);
        const z = -c.near * 1.001;
        if (va[2] > z && vb[2] > z) return null;
        const cut = (from, to) => add(from, mul(sub(to, from), (z - from[2]) / (to[2] - from[2])));
        if (va[2] > z) va = cut(va, vb);
        else if (vb[2] > z) vb = cut(vb, va);
        return [project(c, va), project(c, vb)];
    };
    // a world polygon on screen, cut at the near plane
    const polygon = (c, points) => {
        const z = -c.near * 1.001;
        const view = points.map(q => toView(c, q));
        const out = [];
        view.forEach((a, i) => {
            const b = view[(i + 1) % view.length];
            if (a[2] <= z) out.push(a);
            if ((a[2] > z) !== (b[2] > z)) out.push(add(a, mul(sub(b, a), (z - a[2]) / (b[2] - a[2]))));
        });
        return out.map(v => project(c, v));
    };
    // The world point under the label, which sits halfway between the cut segment's ends on screen:
    // a fraction da / (da + db) of the way, by the ends' depths.
    const labelPoint = (c, a, b) => {
        const va = toView(c, a), vb = toView(c, b);
        const z = -c.near * 1.001;
        if (va[2] > z && vb[2] > z) return null;
        const at = (z - va[2]) / (vb[2] - va[2]);
        const pa = va[2] > z ? lerp(a, b, at) : a;
        const pb = vb[2] > z ? lerp(a, b, at) : b;
        const da = -toView(c, pa)[2], db = -toView(c, pb)[2];
        return lerp(pa, pb, da / (da + db));
    };
    const ray = (c, x, y) => {
        const p = c.p;
        const nx = (x / W()) * 2 - 1, ny = 1 - (y / H()) * 2;
        const v = [nx / p[0], ny / p[5], -1];
        const dir = add(add(mul(normalize(c.right), v[0]), mul(normalize(c.up), v[1])), mul(c.back, v[2]));
        return { origin: c.pos, dir: normalize(dir) };
    };
    const intersect = (r, origin, normal) => {
        const d = dot(normal, r.dir);
        if (Math.abs(d) < 1e-9) return null;
        const s = dot(normal, sub(origin, r.origin)) / d;
        return s > 0 ? add(r.origin, mul(r.dir, s)) : null;
    };
    const clientToCanvas = e => {
        const rect = canvas.getBoundingClientRect();
        return [e.clientX - rect.left, e.clientY - rect.top];
    };

    // ---- toolbar, as the editor's select-toolbar

    const bar = document.createElement('div');
    bar.className = 'spirulaMeasureBar sse-hidden';
    const modes = document.createElement('div');
    modes.className = 'spirulaMeasureModes';
    const modeButtons = Object.entries({
        distance: '<circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/><path d="M6.5 17.5l11-11"/>',
        area: '<path d="M5 7l11-3 4 11-12 5Z"/>'
    }).map(([value, icon]) => {
        const b = modes.appendChild(document.createElement('button'));
        b.dataset.mode = value;
        b.setAttribute('aria-label', t(value));
        b.innerHTML = `<svg xmlns="${SVG}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
            `stroke-width="2" stroke-linejoin="round">${icon}</svg>`;
        addTooltip(root, b, t(value));
        b.addEventListener('click', () => setMode(value));
        // the viewer reads keys from window, so a focused button would also take Space
        b.addEventListener('pointerup', () => b.blur());
        return b;
    });
    const hint = document.createElement('span');
    const lengthLabel = document.createElement('span');
    const lengthBox = document.createElement('div');
    lengthBox.className = 'spirulaMeasureLength';
    const lengthValue = document.createElement('span');
    const unit = document.createElement('span');
    lengthBox.append(lengthValue, unit);
    // touch has no right click: this makes the next tap the pivot instead of a point
    const pivotButton = document.createElement('button');
    pivotButton.textContent = t('pivot');
    pivotButton.addEventListener('click', () => {
        pivotNext = !pivotNext;
        update();
    });
    const undoButton = document.createElement('button');
    undoButton.textContent = t('undo');
    undoButton.addEventListener('click', () => undo());
    const finishButton = document.createElement('button');
    finishButton.textContent = t('finish');
    finishButton.addEventListener('click', () => close());
    // the viewer reads keys from window, so a focused button would also take Space
    for (const b of [undoButton, finishButton]) b.addEventListener('pointerup', () => b.blur());
    const clear = document.createElement('button');
    clear.textContent = t('clear');
    // the viewer's settings toggle (sse-toggleSwitch), with its label beside it
    const hide = document.createElement('div');
    hide.className = 'spirulaMeasureHide';
    hide.setAttribute('role', 'switch');
    hide.innerHTML = '<div class="sse-toggleSwitch"><div class="sse-toggleTrack"><div class="sse-toggleThumb"></div></div></div>';
    hide.append(t('hide'));
    bar.append(modes, hint, lengthLabel, lengthBox, pivotButton, undoButton, finishButton, clear, hide);
    bar.addEventListener('pointerdown', e => e.stopPropagation());
    root.querySelector('.sse-controlsWrap').prepend(bar);
    const format = new Intl.NumberFormat(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // ---- toolbar button, beside the camera modes

    const group = document.createElement('div');
    group.className = 'sse-buttonGroup';
    const button = document.createElement('button');
    button.className = 'spirulaMeasure sse-controlButton';
    button.setAttribute('aria-label', t('measure'));
    button.setAttribute('aria-keyshortcuts', 'M');
    const ruler = 'M3.5 8h17A1.5 1.5 0 0 1 22 9.5v5a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 14.5v-5A1.5 1.5 0 0 1 3.5 8ZM3.75 9.75v4.5h16.5v-4.5ZM6.25 9.75h1.5v2.75h-1.5ZM9.25 9.75h1.5v1.75h-1.5ZM12.25 9.75h1.5v2.75h-1.5ZM15.25 9.75h1.5v1.75h-1.5Z';
    button.innerHTML = `<svg xmlns="${SVG}" width="24" height="24" viewBox="0 0 24 24">` +
        `<g class="sse-stroke" transform="rotate(-45 12 12)"><path d="${ruler}" fill-rule="evenodd"/></g>` +
        `<g class="sse-fill" transform="rotate(-45 12 12)"><path d="${ruler}" fill-rule="evenodd"/></g></svg>`;
    group.append(button);
    root.querySelector('.sse-orbitCamera').parentElement.after(group);

    addTooltip(root, button, t('measure'));

    // ---- overlay

    // the length labels are HTML between two SVG layers, so they cover the lines but not the points
    // or the gizmo, which stay clickable under a short measurement's label
    const svg = element('svg', { class: 'spirulaMeasureOverlay' });
    const guides = element('g', {}, svg);
    const lineLayer = element('g', {}, svg);
    const labelLayer = document.createElement('div');
    labelLayer.className = 'spirulaMeasureLabels';
    const gizmoSvg = element('svg', { class: 'spirulaMeasureOverlay' });
    const dotLayer = element('g', {}, gizmoSvg);
    root.querySelector('.sse-sceneLayer').append(svg, labelLayer, gizmoSvg);

    // the sides as pairs of point indices; an area closes when finished
    const sidesOf = measure => {
        const n = measure.points.length;
        const sides = Array.from({ length: Math.max(n - 1, 0) }, (_, i) => [i, i + 1]);
        if (measure.area && measure !== drawing && n >= 3) sides.push([n - 1, 0]);
        return sides;
    };
    // a finished area shows only its total
    const showsSides = measure => !measure.area || measure === drawing;
    const uncovered = view => ({
        dots: view.dots.map(() => false),
        sides: view.sides.map(() => ({ pieces: Array(PIECES).fill(false), label: false })),
        total: false
    });

    let views = [];
    const rebuild = () => {
        lineLayer.replaceChildren();
        dotLayer.replaceChildren();
        labelLayer.replaceChildren();
        views = measures.map((measure, m) => {
            const view = {
                fill: measure.area ? element('polygon', { class: 'spirulaMeasureFill' }, lineLayer) : null,
                sides: sidesOf(measure).map(([a, b]) => ({
                    a, b,
                    pieces: Array.from({ length: PIECES }, () => {
                        const g = element('g', { class: 'spirulaMeasurePiece' }, lineLayer);
                        return [g, element('line', { class: 'outline' }, g), element('line', { class: 'line' }, g)];
                    }),
                    ...addLabel(m, !measure.area)
                })),
                dots: measure.points.map((_, i) => {
                    const g = element('g', { class: 'spirulaMeasurePoint' }, dotLayer);
                    element('circle', { r: 9, class: 'hit' }, g);
                    element('circle', { r: 5, class: 'dot' }, g);
                    // with the ruler off too, so the viewer does not take the click as an orbit focus
                    g.addEventListener('pointerdown', e => {
                        if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
                        e.stopPropagation();
                        pressPoint(m, i);
                    });
                    return g;
                }),
                total: measure.area ? addLabel(m, true) : null
            };
            view.covered = uncovered(view);
            return view;
        });
    };
    // no selection while drawing, whose gizmo would stand in the way of the next point
    const pressPoint = (m, i) => {
        if (measures[m] === drawing) {
            if (i === 0) close();
            return;
        }
        if (!active) setActive(true);
        selection = { m, i };
        update();
    };
    // the value, and under it while hovered or selected a button that deletes the measurement, as
    // XGRIDS' LCC viewer has; an area's sides leave that to its total, and let clicks through
    const addLabel = (m, removable) => {
        const label = labelLayer.appendChild(document.createElement('div'));
        const value = label.appendChild(document.createElement('span'));
        if (removable) {
            const trash = label.appendChild(document.createElement('button'));
            trash.setAttribute('aria-label', t('remove'));
            trash.innerHTML = TRASH;
            trash.addEventListener('pointerdown', e => e.stopPropagation());
            trash.addEventListener('click', () => remove(m));
        } else {
            label.className = 'spirulaMeasureSide';
        }
        return { label, value };
    };
    // leaves the point where the drag got to; what clears the selection needs this first
    const endDrag = () => {
        if (!drag) return;
        shapes[drag.key].g.releasePointerCapture(drag.pointerId);
        drag = null;
        hovered = null;
        save();
    };
    const remove = m => {
        pickSession++;
        endDrag();
        if (measures[m] === drawing) drawing = null;
        measures.splice(m, 1);
        selection = null;
        rebuild();
        save();
        update();
    };
    const save = () => {
        try {
            const finished = measures.filter(m => (m.area ? m !== drawing : m.points.length === 2));
            localStorage.setItem(storageKey, JSON.stringify(finished.map(m => (m.area ? { area: m.points } : m.points))));
        } catch {}
    };
    // an area of fewer than 3 points is dropped
    const finish = () => {
        if (!drawing) return;
        const m = measures.indexOf(drawing);
        const enough = drawing.points.length >= 3;
        drawing = null;
        if (!enough) measures.splice(m, 1);
        selection = enough ? { m, i: measures[m].points.length - 1 } : null;
        rebuild();
        save();
        update();
    };
    // a pick still under way adds its point first
    let closing = false;
    const close = () => {
        if (picking) closing = true;
        else if (drawing?.points.length >= 3) finish();
    };
    const undo = () => {
        if (!drawing) return;
        pickSession++;
        closing = false;
        drawing.points.pop();
        if (drawing.points.length) {
            rebuild();
            update();
        } else {
            remove(measures.indexOf(drawing));
        }
    };
    const setMode = value => {
        if (value === mode) return;
        pickSession++;
        endDrag();
        finish();
        const last = measures[measures.length - 1];
        if (last && !last.area && last.points.length === 1) measures.pop();
        mode = value;
        selection = null;
        rebuild();
        update();
    };

    const gizmo = element('g', { class: 'spirulaGizmo' }, gizmoSvg);
    const shapes = {};
    for (const axis of ['x', 'y', 'z']) {
        const g = element('g', {}, gizmo);
        shapes[axis] = {
            g, isPlane: false, axis,
            hit: element('line', { class: 'hit' }, g),
            shaft: element('line', {}, g),
            head: element('polygon', {}, g)
        };
        const pg = element('g', {}, gizmo);
        shapes[`p${axis}`] = { g: pg, isPlane: true, axis, quad: element('polygon', {}, pg) };
    }
    const cg = element('g', {}, gizmo);
    shapes.xyz = { g: cg, isPlane: false, axis: 'xyz', hit: element('circle', { class: 'hit' }, cg), ball: element('circle', {}, cg) };

    // TranslateGizmo's hover lights a plane together with the two arrows it moves along
    const lit = (key, shape) => {
        if (!hovered) return false;
        if (hovered === key) return true;
        const h = shapes[hovered];
        if (h.axis === 'xyz') return !shape.isPlane;
        return h.isPlane && !shape.isPlane && shape.axis !== h.axis;
    };
    // dragMode 'selected': only what still moves the point stays on screen while dragging
    const shown = (key, shape) => {
        if (!drag) return true;
        const d = shapes[drag.key];
        if (d.axis === 'xyz') return !shape.isPlane && shape.axis !== 'xyz';
        if (d.isPlane) return !shape.isPlane && shape.axis !== 'xyz' && shape.axis !== d.axis;
        return key === drag.key;
    };

    const drawGizmo = (c, at) => {
        const s0 = screen(c, at);
        if (!s0) {
            gizmo.style.display = 'none';
            return;
        }
        gizmo.style.display = '';
        const depth = -toView(c, at)[2];
        const tanHalf = cam.horizontalFov ? 1 / c.p[0] : 1 / c.p[5];
        // SuperSplat's measure tool: gizmo.size = 1200 / max(width, height) for a perspective camera
        const unitWorld = depth * tanHalf * 0.3 * (1200 / Math.max(W(), H()));
        const unitPx = unitWorld * (H() / 2) * c.p[5] / depth;
        const toCamera = normalize(sub(c.pos, at));
        const order = [];
        for (const [key, shape] of Object.entries(shapes)) {
            const color = lit(key, shape) ? HOVER[shape.axis] : BASE[shape.axis];
            let visible = shown(key, shape);
            let center = at;
            if (shape.axis === 'xyz') {
                shape.ball.setAttribute('cx', s0[0]);
                shape.ball.setAttribute('cy', s0[1]);
                shape.ball.setAttribute('r', Math.max(3, CENTER_RADIUS * unitPx));
                shape.ball.setAttribute('fill', color);
                shape.hit.setAttribute('cx', s0[0]);
                shape.hit.setAttribute('cy', s0[1]);
                shape.hit.setAttribute('r', Math.max(7, (CENTER_RADIUS + LINE_TOLERANCE / 2) * unitPx));
            } else if (!shape.isPlane) {
                const dir = AXES[shape.axis];
                visible &&= 1 - Math.abs(dot(toCamera, dir)) > GLANCE_EPSILON;
                const base = add(at, mul(dir, LINE_LENGTH * unitWorld));
                const tip = add(at, mul(dir, (LINE_LENGTH + ARROW_LENGTH) * unitWorld));
                center = add(at, mul(dir, (LINE_LENGTH + ARROW_LENGTH) * unitWorld * 0.5));
                const u = normalize(cross(dir, Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
                const v = cross(dir, u);
                const ring = [screen(c, tip)];
                for (let i = 0; i < 16; i++) {
                    const a = (i / 16) * Math.PI * 2;
                    const r = ARROW_RADIUS * unitWorld;
                    ring.push(screen(c, add(base, add(mul(u, Math.cos(a) * r), mul(v, Math.sin(a) * r)))));
                }
                const sb = screen(c, base);
                if (!sb || ring.some(q => !q)) visible = false;
                if (visible) {
                    for (const el of [shape.hit, shape.shaft]) {
                        el.setAttribute('x1', s0[0]); el.setAttribute('y1', s0[1]);
                        el.setAttribute('x2', sb[0]); el.setAttribute('y2', sb[1]);
                    }
                    shape.shaft.setAttribute('stroke', color);
                    shape.shaft.setAttribute('stroke-width', Math.max(1.5, LINE_THICKNESS * unitPx));
                    shape.hit.setAttribute('stroke-width', Math.max(10, (LINE_THICKNESS + LINE_TOLERANCE) * unitPx));
                    shape.head.setAttribute('points', hull(ring).map(q => q.join(',')).join(' '));
                    shape.head.setAttribute('fill', color);
                }
            } else {
                const n = AXES[shape.axis];
                visible &&= 1 - length(cross(toCamera, n)) > GLANCE_EPSILON;
                // flipPlanes: each square sits on the camera's side of both its axes
                const [ea, eb] = PLANES[shape.axis].map(k => mul(AXES[k], toCamera['xyz'.indexOf(k)] < 0 ? -1 : 1));
                const h = PLANE_SIZE * unitWorld;
                const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([i, j]) => screen(c, add(at, add(mul(ea, i * h), mul(eb, j * h)))));
                center = add(at, add(mul(ea, h / 2), mul(eb, h / 2)));
                if (corners.some(q => !q)) visible = false;
                if (visible) {
                    shape.quad.setAttribute('points', corners.map(q => q.join(',')).join(' '));
                    shape.quad.setAttribute('fill', color);
                }
            }
            shape.g.style.display = visible ? '' : 'none';
            // the centre sphere pokes through the squares' shared corner in the editor
            order.push([shape.axis === 'xyz' ? Infinity : toView(c, center)[2], shape.g]);
        }
        // nearest last, so it draws on top; reordering would drop the dragged shape's pointer capture
        if (!drag) {
            order.sort((a, b) => a[0] - b[0]);
            for (const [, g] of order) gizmo.append(g);
        }
    };

    const drawGuides = c => {
        guides.replaceChildren();
        if (!drag) return;
        const d = shapes[drag.key];
        const along = d.axis === 'xyz' ? ['x', 'y', 'z'] : d.isPlane ? PLANES[d.axis] : [d.axis];
        const at = selected();
        const span = c.far - c.near;
        for (const axis of along) {
            const seg = segment(c, add(at, mul(AXES[axis], -span)), add(at, mul(AXES[axis], span)));
            if (!seg) continue;
            element('line', { x1: seg[0][0], y1: seg[0][1], x2: seg[1][0], y2: seg[1][1], stroke: BASE[axis] }, guides);
        }
    };

    const update = () => {
        const current = drawing ?? (selection ? measures[selection.m] : null);
        const isArea = current ? current.area : mode === 'area';
        const complete = current && current.points.length >= (isArea ? 3 : 2);
        const size = !complete ? 0 : isArea ? areaOf(current.points) : length(sub(current.points[0], current.points[1]));
        clear.disabled = measures.length === 0;
        for (const b of modeButtons) {
            b.classList.toggle('active', b.dataset.mode === mode);
            b.setAttribute('aria-pressed', b.dataset.mode === mode);
        }
        pivotButton.style.display = state.inputMode === 'desktop' ? 'none' : '';
        pivotButton.classList.toggle('active', pivotNext);
        pivotButton.setAttribute('aria-pressed', pivotNext);
        undoButton.style.display = finishButton.style.display = drawing ? '' : 'none';
        finishButton.disabled = !complete;
        clear.style.display = hide.style.display = drawing ? 'none' : '';
        hint.textContent = t(mode === 'area' ? 'areaHint' : 'hint');
        lengthLabel.textContent = t(isArea ? 'area' : 'length');
        unit.textContent = isArea ? 'm²' : 'm';
        lengthBox.classList.toggle('empty', !complete);
        lengthValue.textContent = format.format(size);
        hide.querySelector('.sse-toggleSwitch').classList.toggle('sse-active', hidden);
        hide.setAttribute('aria-checked', hidden);
        for (const layer of [svg, labelLayer, gizmoSvg]) layer.style.display = hidden ? 'none' : '';
        if (hidden) return;
        const c = camera();
        measures.forEach((measure, m) => {
            const { points } = measure;
            const view = views[m];
            // the selected one stays whole, as the viewer's active hotspot, and the one being drawn
            const { covered } = view;
            const whole = selection?.m === m || measure === drawing;
            const faded = on => on && !whole;
            const place = ({ label, value }, at, text, on) => {
                label.style.display = at ? '' : 'none';
                label.classList.toggle('occluded', faded(on));
                label.classList.toggle('selected', selection?.m === m);
                if (!at) return;
                value.textContent = text;
                label.style.transform = `translate(${at[0]}px, ${at[1]}px) translate(-50%, -50%)`;
            };
            view.dots.forEach((g, i) => {
                const q = screen(c, points[i]);
                g.style.display = q ? '' : 'none';
                g.classList.toggle('occluded', faded(covered.dots[i]));
                g.classList.toggle('closes', measure === drawing && i === 0 && points.length >= 3);
                if (q) g.setAttribute('transform', `translate(${q[0]} ${q[1]})`);
            });
            view.sides.forEach((side, s) => {
                const a = points[side.a], b = points[side.b];
                side.pieces.forEach(([g, ...lines], k) => {
                    const seg = segment(c, lerp(a, b, k / PIECES), lerp(a, b, (k + 1) / PIECES));
                    g.style.display = seg ? '' : 'none';
                    g.classList.toggle('occluded', faded(covered.sides[s].pieces[k]));
                    if (!seg) return;
                    for (const el of lines) {
                        el.setAttribute('x1', seg[0][0]); el.setAttribute('y1', seg[0][1]);
                        el.setAttribute('x2', seg[1][0]); el.setAttribute('y2', seg[1][1]);
                    }
                });
                const seg = segment(c, a, b);
                const middle = seg && [(seg[0][0] + seg[1][0]) / 2, (seg[0][1] + seg[1][1]) / 2];
                place(side, showsSides(measure) ? middle : null, `${format.format(length(sub(a, b)))}m`, covered.sides[s].label);
            });
            if (measure.area) {
                const enough = points.length >= 3;
                view.fill.setAttribute('points', enough ? polygon(c, points).map(q => q.join(',')).join(' ') : '');
                view.fill.classList.toggle('occluded', faded(covered.total));
                place(view.total, enough ? screen(c, centroid(points)) : null, `${format.format(enough ? areaOf(points) : 0)}m²`, covered.total);
            }
        });
        if (active && selection) drawGizmo(c, selected());
        else gizmo.style.display = 'none';
        drawGuides(c);
        const key = [...cameraEntity.getWorldTransform().data, ...c.p, W(), H(), hidden, clipped, measures.indexOf(drawing), JSON.stringify(measures)].join();
        if (key !== pose) {
            pose = key;
            scheduleOcclusion();
        }
    };
    app.on('prerender', update);

    // ---- occlusion

    let pose = '';
    let settleTimer = null;
    // the height clip and the point cloud change the splats under a still camera
    let clipped = 0;
    events.on('spirulaLook:changed', () => {
        clipped++;
        update();
    });
    const scheduleOcclusion = () => {
        clearTimeout(settleTimer);
        settleTimer = setTimeout(testOcclusion, SETTLE_MS);
    };
    const testOcclusion = async () => {
        if (hidden || !picker?.pickVisibility) return;
        const c = camera();
        const samples = [];
        const marks = [];
        const sample = (q, mark) => {
            const v = toView(c, q);
            const s = v[2] < -c.near ? project(c, v) : null;
            if (!s || s[0] < 0 || s[0] >= W() || s[1] < 0 || s[1] >= H()) return;
            samples.push({ x: s[0] / W(), y: s[1] / H(), depth: -v[2] * (1 - OCCLUSION_TOLERANCE) });
            marks.push(mark);
        };
        const next = measures.map((measure, m) => {
            const { points, area } = measure;
            const view = views[m];
            const covered = uncovered(view);
            points.forEach((q, i) => sample(q, () => { covered.dots[i] = true; }));
            view.sides.forEach((side, s) => {
                const a = points[side.a], b = points[side.b];
                for (let k = 0; k < PIECES; k++) {
                    sample(lerp(a, b, (k + 0.5) / PIECES), () => { covered.sides[s].pieces[k] = true; });
                }
                const under = showsSides(measure) ? labelPoint(c, a, b) : null;
                if (under) sample(under, () => { covered.sides[s].label = true; });
            });
            if (area && points.length >= 3) sample(centroid(points), () => { covered.total = true; });
            return covered;
        });
        const tested = pose;
        let opacities;
        try {
            opacities = await picker.pickVisibility(samples, SAMPLE_RADIUS / H());
        } catch {
            return;
        }
        if (tested !== pose || next.length !== views.length) return;
        opacities.forEach((o, i) => { if ((o ?? 0) >= OCCLUDING_OPACITY) marks[i](); });
        next.forEach((covered, m) => { views[m].covered = covered; });
        update();
    };
    // finer detail streams in under a still camera, as the viewer's hotspots also allow for
    let contentReady = false;
    app.systems.gsplat.on('frame:ready', (frameCamera, _layer, ready) => {
        if (frameCamera !== cam) return;
        if (ready && !contentReady) scheduleOcclusion();
        contentReady = ready;
    });

    // ---- gizmo dragging: TranslateGizmo's _screenToPoint against the selection's start

    for (const [key, shape] of Object.entries(shapes)) {
        shape.g.addEventListener('pointerenter', () => { if (!drag) { hovered = key; update(); } });
        shape.g.addEventListener('pointerleave', () => { if (!drag && hovered === key) { hovered = null; update(); } });
        shape.g.addEventListener('pointerdown', e => {
            if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0) || !selection) return;
            e.stopPropagation();
            e.preventDefault();
            const c = camera();
            const start = selected().slice();
            let normal;
            if (shape.axis === 'xyz') normal = c.back;
            else if (shape.isPlane) normal = AXES[shape.axis];
            else {
                const a = AXES[shape.axis];
                const side = normalize(cross(a, normalize(sub(c.pos, start))));
                normal = normalize(cross(side, a));
            }
            const [x, y] = clientToCanvas(e);
            const from = intersect(ray(c, x, y), start, normal);
            if (!from) return;
            shape.g.setPointerCapture(e.pointerId);
            hovered = key;
            drag = { key, start, normal, from, pointerId: e.pointerId };
            update();
        });
        shape.g.addEventListener('pointermove', e => {
            if (!drag || drag.key !== key || e.pointerId !== drag.pointerId) return;
            const [x, y] = clientToCanvas(e);
            const hit = intersect(ray(camera(), x, y), drag.start, drag.normal);
            if (!hit) return;
            let delta = sub(hit, drag.from);
            if (!shape.isPlane && shape.axis !== 'xyz') delta = mul(AXES[shape.axis], dot(delta, AXES[shape.axis]));
            measures[selection.m].points[selection.i] = add(drag.start, delta);
            update();
        });
        const end = e => {
            if (!drag || drag.key !== key || e.pointerId !== drag.pointerId) return;
            drag = null;
            if (!shape.g.matches(':hover')) hovered = null;
            save();
            update();
        };
        shape.g.addEventListener('pointerup', end);
        shape.g.addEventListener('pointercancel', end);
        shape.g.addEventListener('lostpointercapture', end);
    }

    // ---- placing points: a click on the canvas, picked where the pointer went down

    let clicked = false;
    let clickX = 0;
    let clickY = 0;
    let tapPath = 0;
    let lastX = 0;
    let lastY = 0;
    let picking = false;
    // a pick waits on a gpu readback: what changes the measurements meanwhile discards its point
    let pickSession = 0;
    // Looked up on the tap rather than with larger hit areas over the canvas, which would keep an
    // orbit or a pinch begun near a point from reaching the camera.
    const pointInReach = (x, y) => {
        const c = camera();
        let nearest = null;
        let reach = TAP_REACH;
        measures.forEach(({ points }, m) => points.forEach((q, i) => {
            const s = screen(c, q);
            const d = s ? Math.hypot(s[0] - x, s[1] - y) : Infinity;
            if (d < reach) {
                reach = d;
                nearest = { m, i };
            }
        }));
        return nearest;
    };
    let pivotNext = false;
    let rightDown = null;
    // as the viewer's own left click on the splats, which belongs to the points while measuring
    const setPivot = async (x, y) => {
        const surface = await picker?.pickSurface(x / W(), y / H());
        if (!surface || state.cameraMode !== 'orbit') return;
        events.fire('orbitTarget:set', surface.position, surface.normal);
        events.fire('pick', surface.position);
    };
    canvas.addEventListener('pointerdown', e => {
        rightDown = e.pointerType !== 'touch' && e.button === 2 ? [e.offsetX, e.offsetY] : null;
    });
    canvas.addEventListener('pointermove', e => {
        if (rightDown && Math.hypot(e.offsetX - rightDown[0], e.offsetY - rightDown[1]) > CLICK_TOLERANCE) rightDown = null;
    });
    canvas.addEventListener('pointerup', e => {
        if (rightDown && e.button === 2 && state.cameraMode === 'orbit') setPivot(...rightDown);
        rightDown = null;
    });
    // a second finger makes this a camera gesture, even one that lifts without moving; on the
    // root, since it may land on a point or the bar
    root.addEventListener('pointerdown', e => {
        if (!e.isPrimary) clicked = false;
    }, true);
    canvas.addEventListener('pointerdown', e => {
        if (!active || clicked || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
        if (document.pointerLockElement) return;
        clicked = true;
        clickX = lastX = e.offsetX;
        clickY = lastY = e.offsetY;
        tapPath = 0;
    });
    // A finger's path adds up as the viewer's _tapDelta, which holds the camera until TAP_EPSILON,
    // so a tap's tremor leaves the scene still; docs/notes/web-export.md has the exception.
    canvas.addEventListener('pointermove', e => {
        if (!clicked) return;
        if (e.pointerType === 'touch') {
            tapPath += Math.abs(e.offsetX - lastX) + Math.abs(e.offsetY - lastY);
            lastX = e.offsetX;
            lastY = e.offsetY;
            if (tapPath >= TAP_TOLERANCE) clicked = false;
        } else if (Math.hypot(e.offsetX - clickX, e.offsetY - clickY) > CLICK_TOLERANCE) {
            clicked = false;
        }
    });
    canvas.addEventListener('pointerup', async e => {
        if (!clicked || !e.isPrimary) return;
        clicked = false;
        if (!active || !picker) return;
        if (pivotNext) {
            pivotNext = false;
            setPivot(clickX, clickY);
            update();
            return;
        }
        if (e.pointerType === 'touch' && !hidden) {
            const near = pointInReach(clickX, clickY);
            const last = measures[measures.length - 1];
            const closes = near && measures[near.m] === drawing && near.i === 0 && drawing?.points.length >= 3;
            // a length's second point and an area's next vertex may lie beside an existing point
            const placing = drawing ? !closes : last && !last.area && last.points.length === 1;
            // a pick under way would take a new selection back
            if (near && !placing && (closes || !picking)) {
                pressPoint(near.m, near.i);
                return;
            }
        }
        if (picking) return;
        picking = true;
        const session = pickSession;
        try {
            const hit = await picker.pick(clickX / W(), clickY / H());
            if (hit && session === pickSession) {
                hidden = false;
                const point = [hit.x, hit.y, hit.z];
                if (mode === 'area') {
                    if (!drawing) {
                        drawing = { points: [], area: true };
                        measures.push(drawing);
                    }
                    drawing.points.push(point);
                    // the gizmo would stand in the way of the next point
                    selection = null;
                } else {
                    // a complete last measurement makes this point start a new one
                    const last = measures[measures.length - 1];
                    if (!last || last.area || last.points.length === 2) measures.push({ points: [], area: false });
                    const { points } = measures[measures.length - 1];
                    points.push(point);
                    selection = { m: measures.length - 1, i: points.length - 1 };
                }
                rebuild();
                save();
            }
        } finally {
            picking = false;
            const pending = closing;
            closing = false;
            if (pending) close();
            update();
        }
    });
    canvas.addEventListener('pointercancel', () => {
        clicked = false;
        rightDown = null;
    });

    // Enter closes the area being drawn. Escape drops it, else the selection, then the ruler.
    // Capturing, so it does not also reach the viewer (leaving walk mode).
    window.addEventListener('keydown', e => {
        if (!active || drag) return;
        if (e.key === 'Enter' && drawing) {
            e.preventDefault();
            e.stopPropagation();
            close();
            return;
        }
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        if (drawing) {
            remove(measures.indexOf(drawing));
        } else if (selection) {
            selection = null;
            update();
        } else {
            setActive(false);
        }
    }, true);
    window.addEventListener('keydown', e => {
        if (!active || hidden || (e.key !== 'Delete' && e.key !== 'Backspace') || !selection) return;
        if (drag || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        remove(selection.m);
    });

    clear.addEventListener('click', () => {
        pickSession++;
        endDrag();
        measures.length = 0;
        drawing = null;
        selection = null;
        rebuild();
        save();
        update();
    });
    hide.addEventListener('click', () => {
        hidden = !hidden;
        update();
    });

    const setActive = value => {
        if (!value) {
            pickSession++;
            endDrag();
            finish();
        }
        active = value;
        if (!value) {
            selection = null;
            pivotNext = false;
        }
        state.measuring = value;
        if (value) state.cameraMode = 'orbit';
        if (value) root.style.setProperty('--spirula-crosshair', crosshair(root));
        canvas.classList.toggle('spirulaMeasuring', value);
        button.classList.toggle('sse-active', value);
        bar.classList.toggle('sse-hidden', !value);
        clicked = false;
        update();
    };
    button.addEventListener('click', () => setActive(!active));
    // measuring is only done in orbit: panorama.js relies on it, as a photo is a fly mode
    events.on('cameraMode:changed', cameraMode => {
        if (active && cameraMode !== 'orbit') setActive(false);
    });
    // the viewer reads keys from window, so a focused button would also take Space
    button.addEventListener('pointerup', () => button.blur());

    // M, free in the viewer; matched as its shortcutKey does, by key unless that is not ASCII
    window.addEventListener('keydown', e => {
        const m = /^[\x20-\x7e]$/.test(e.key) ? e.key.toLowerCase() === 'm' : e.code === 'KeyM';
        if (!m || e.repeat || e.ctrlKey || e.altKey || e.metaKey || document.pointerLockElement) return;
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || drag) return;
        setActive(!active);
    });
    addKeyHint(root, 'spirulaMeasureHint', t('measure'), 'M');
    addKeyHint(root, 'spirulaPivotHint', t('pivot'), t('rightClick'));
    rebuild();
    update();
};
