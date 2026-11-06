// A height range for the splats, as XGRIDS' LCC viewer clips along Z: a splat whose centre is out
// of it is hidden (splats.js), in every renderer and from the picker, points included. The track
// spans the model's heights; a handle at its end leaves that side open.

import { addTooltip } from './controls.js';
import { OPEN, splatLook } from './splats.js';

const text = {
    clip: {
        es: 'Corte por altura', en: 'Height clip', de: 'Höhenschnitt', fr: 'Coupe en hauteur',
        ja: '高さで切り取り', ko: '높이 자르기', 'pt-BR': 'Corte por altura', ru: 'Срез по высоте',
        'zh-CN': '按高度裁切'
    },
    top: {
        es: 'Altura máxima', en: 'Top height', de: 'Obere Höhe', fr: 'Hauteur maximale',
        ja: '上端の高さ', ko: '위쪽 높이', 'pt-BR': 'Altura máxima', ru: 'Верхняя граница',
        'zh-CN': '最高高度'
    },
    bottom: {
        es: 'Altura mínima', en: 'Bottom height', de: 'Untere Höhe', fr: 'Hauteur minimale',
        ja: '下端の高さ', ko: '아래쪽 높이', 'pt-BR': 'Altura mínima', ru: 'Нижняя граница',
        'zh-CN': '最低高度'
    }
};

const SVG = 'http://www.w3.org/2000/svg';

export const addHeightClip = (viewer, root, lang) => {
    const t = key => text[key][lang] ?? text[key].en;
    const look = splatLook(viewer);

    // bottom and top handles, 0 at the bottom of the track and 1 at its top
    const value = [0, 1];
    let open = false;
    const apply = () => {
        const range = look.range();
        if (!range) return;
        const [low, high] = range;
        look.setClip(value[0] > 0 ? low + value[0] * (high - low) : -OPEN,
            value[1] < 1 ? low + value[1] * (high - low) : OPEN);
    };

    // ---- panel: a vertical track on the right, as the viewer's timeline stands on its side; it makes
    // way for the viewer's settings and controls panels, which open in the same corner

    const panel = document.createElement('div');
    panel.className = 'spirulaClip sse-hidden';
    const track = document.createElement('div');
    track.className = 'spirulaClipTrack';
    const span = document.createElement('div');
    span.className = 'spirulaClipSpan';
    const handles = ['bottom', 'top'].map(name => {
        const handle = document.createElement('div');
        handle.className = 'spirulaClipHandle';
        handle.tabIndex = 0;
        handle.setAttribute('role', 'slider');
        handle.setAttribute('aria-orientation', 'vertical');
        handle.setAttribute('aria-label', t(name));
        handle.setAttribute('aria-valuemin', '0');
        handle.setAttribute('aria-valuemax', '100');
        return handle;
    });
    track.append(span, ...handles);
    panel.append(track);
    // before the controls, so the info and settings panels cover it as they do them
    root.querySelector('.sse-controlsWrap').before(panel);

    const draw = () => {
        handles.forEach((handle, i) => {
            handle.style.top = `${(1 - value[i]) * 100}%`;
            handle.setAttribute('aria-valuenow', String(Math.round(value[i] * 100)));
        });
        span.style.top = `${(1 - value[1]) * 100}%`;
        span.style.bottom = `${value[0] * 100}%`;
    };
    // a handle stops at the other one
    const set = (i, v) => {
        v = Math.min(1, Math.max(0, v));
        value[i] = i ? Math.max(v, value[0]) : Math.min(v, value[1]);
        draw();
        apply();
    };

    // the nearest handle follows the pointer; when both sit together, the first move picks one
    let dragging = -1;
    const at = e => {
        const r = track.getBoundingClientRect();
        return (r.bottom - e.clientY) / r.height;
    };
    const pick = v => {
        if (value[0] === value[1]) return v > value[1] ? 1 : v < value[0] ? 0 : null;
        return v - value[0] < value[1] - v ? 0 : 1;
    };
    panel.addEventListener('pointerdown', e => e.stopPropagation());
    track.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        e.preventDefault();
        track.setPointerCapture(e.pointerId);
        const v = at(e);
        dragging = e.target.classList.contains('spirulaClipHandle') && value[0] === value[1] ? null : pick(v);
        if (dragging !== null) set(dragging, v);
    });
    track.addEventListener('pointermove', e => {
        if (dragging === -1) return;
        const v = at(e);
        dragging ??= pick(Math.min(1, Math.max(0, v)));
        if (dragging !== null) set(dragging, v);
    });
    for (const type of ['pointerup', 'pointercancel']) track.addEventListener(type, () => { dragging = -1; });

    // the viewer reads keys from window, so the keys a handle takes stop here
    const steps = { ArrowUp: 0.01, ArrowRight: 0.01, ArrowDown: -0.01, ArrowLeft: -0.01, PageUp: 0.1, PageDown: -0.1 };
    handles.forEach((handle, i) => handle.addEventListener('keydown', e => {
        if (e.key in steps) set(i, value[i] + steps[e.key]);
        else if (e.key === 'Home') set(i, 0);
        else if (e.key === 'End') set(i, 1);
        else return;
        e.preventDefault();
        e.stopPropagation();
    }));

    // ---- toolbar button, beside the ruler measure.js adds

    const button = document.createElement('button');
    button.className = 'spirulaClipButton sse-controlButton';
    button.setAttribute('aria-label', t('clip'));
    const icon = 'M3 3.5h18V5H3ZM3 19h18v1.5H3ZM12 7l3.25 3.25h-2.5v3.5h2.5L12 17l-3.25-3.25h2.5v-3.5h-2.5Z';
    button.innerHTML = `<svg xmlns="${SVG}" width="24" height="24" viewBox="0 0 24 24">` +
        `<g class="sse-stroke"><path d="${icon}"/></g><g class="sse-fill"><path d="${icon}"/></g></svg>`;
    root.querySelector('.spirulaMeasure').after(button);
    addTooltip(root, button, t('clip'));

    // closing the panel keeps the cut, as in XGRIDS' viewer
    button.addEventListener('click', () => {
        open = !open;
        button.classList.toggle('sse-active', open);
        panel.classList.toggle('sse-hidden', !open);
    });
    // the viewer reads keys from window, so a focused button would also take Space
    button.addEventListener('pointerup', () => button.blur());
    draw();
};
