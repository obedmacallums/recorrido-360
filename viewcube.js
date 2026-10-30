// Spirula's axes gizmo (ViewportPanel's) on the web: the SuperSplat editor's view cube
// (src/ui/view-cube.ts) in the look of XGRIDS' LCC viewer, a round glass disc with grey negative
// ends, drawn in SVG each frame. It shows Spirula's X, Y and Z, which scene.json gives in the
// engine's frame, so Z stays the elevation. A click on an axis orbits to look along it from its side,
// a second click from the far side, as Spirula's does (without its switch to orthographic).

const SVG = 'http://www.w3.org/2000/svg';
const SIZE = 88;
const RADIUS = 28;
// Spirula's axis colours (ViewportPanel kAxisCol)
const COLORS = ['rgb(250,51,79)', 'rgb(140,219,0)', 'rgb(41,140,250)'];
const NAMES = ['X', 'Y', 'Z'];

const element = (name, attrs, parent) => {
    const e = document.createElementNS(SVG, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    parent.append(e);
    return e;
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const deg = r => r * 180 / Math.PI;

export const addViewCube = (viewer, root, axes) => {
    const { app, events } = viewer;
    const cameraEntity = app.root.findByName('camera');
    const view = () => {
        const w = cameraEntity.getWorldTransform().data;
        return { right: [w[0], w[1], w[2]], up: [w[4], w[5], w[6]], back: [w[8], w[9], w[10]] };
    };

    // The camera on the axis' side looking back along it. The orbit cannot roll, so up is the
    // world's; looking straight up or down, Spirula's +Y goes at the top, as a plan view puts it.
    const align = dir => {
        const f = dir.map(v => -v);
        if (Math.abs(f[1]) < 0.999) {
            events.fire('align', deg(Math.atan2(-f[0], -f[2])), deg(Math.asin(f[1])));
            return;
        }
        const y = axes[1];
        const yaw = f[1] < 0 ? Math.atan2(-y[0], -y[2]) : Math.atan2(y[0], y[2]);
        events.fire('align', deg(yaw), f[1] < 0 ? -90 : 90);
    };

    const container = document.createElement('div');
    container.className = 'spirulaViewCube';
    const svg = element('svg', { width: SIZE, height: SIZE }, container);
    const group = element('g', { transform: `translate(${SIZE / 2}, ${SIZE / 2})` }, svg);

    // 0..5: +X +Y +Z -X -Y -Z, as Spirula numbers them
    const ends = [0, 1, 2, 3, 4, 5].map(a => {
        const k = a % 3;
        const g = element('g', {}, group);
        const c = element('circle', { fill: a < 3 ? COLORS[k] : '#888', r: 8, class: a < 3 ? '' : 'negative' }, g);
        if (a < 3) {
            const t = element('text', {
                'font-size': 8, 'font-family': 'Arial', 'font-weight': 'bold',
                'text-anchor': 'middle', 'alignment-baseline': 'central'
            }, g);
            t.textContent = NAMES[k];
        }
        c.addEventListener('pointerdown', e => {
            e.stopPropagation();
            const dir = axes[k].map(v => (a < 3 ? v : -v));
            // already looking along it: the far side
            const facing = dot(dir, view().back) > 0.999;
            align(facing ? dir.map(v => -v) : dir);
        });
        return g;
    });
    const lines = [0, 1, 2].map(() => element('line', {}, group));
    // before the controls, so the info and settings panels cover it as they do them
    root.querySelector('.sse-controlsWrap').before(container);

    app.on('prerender', () => {
        const { right, up, back } = view();
        // each axis in view space: x right, y up, z toward the viewer
        const at = axes.map(a => [dot(a, right), dot(a, up), dot(a, back)]);
        const place = (shape, v, s) => shape.setAttribute('transform', `translate(${s * v[0] * RADIUS}, ${-s * v[1] * RADIUS})`);
        at.forEach((v, k) => {
            place(ends[k], v, 1);
            place(ends[k + 3], v, -1);
            lines[k].setAttribute('x2', v[0] * RADIUS);
            lines[k].setAttribute('y2', -v[1] * RADIUS);
        });

        // the painter's algorithm: nearest last
        const order = [
            ...at.map((v, k) => ({ n: [lines[k], ends[k]], value: v[2] })),
            ...at.map((v, k) => ({ n: [ends[k + 3]], value: -v[2] }))
        ].sort((a, b) => a.value - b.value);
        group.append(...order.flatMap(o => o.n));
    });
};
