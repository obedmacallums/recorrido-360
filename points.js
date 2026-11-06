// Shows the splats as a point cloud, as XGRIDS' LCC viewer does: each splat a small dot at its
// centre, coloured by height (splats.js). Nothing more is loaded, and the height clip still cuts.

import { addTooltip } from './controls.js';
import { splatLook } from './splats.js';

const text = {
    on: {
        es: 'Ver nube de puntos', en: 'Show point cloud', de: 'Punktwolke anzeigen',
        fr: 'Afficher le nuage de points', ja: '点群を表示', ko: '포인트 클라우드 보기',
        'pt-BR': 'Ver nuvem de pontos', ru: 'Показать облако точек', 'zh-CN': '显示点云'
    },
    off: {
        es: 'Ver splats', en: 'Show splats', de: 'Splats anzeigen', fr: 'Afficher les splats',
        ja: 'スプラットを表示', ko: '스플랫 보기', 'pt-BR': 'Ver splats', ru: 'Показать сплаты',
        'zh-CN': '显示高斯点'
    }
};

const SVG = 'http://www.w3.org/2000/svg';
const dot = ([x, y, r]) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const DOTS = [[5, 16, 1.6], [9, 11, 1.6], [12, 17, 1.6], [14, 6.5, 1.6], [16.5, 12.5, 1.6], [19.5, 7, 1.6],
    [8, 20.5, 1.2], [4.5, 9.5, 1.2], [19, 18, 1.2]];

export const addPointCloud = (viewer, root, lang) => {
    const { state, events } = viewer;
    const look = splatLook(viewer);
    let on = false;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'spirulaPointsButton sse-controlButton';
    button.setAttribute('aria-label', text.on[lang] ?? text.on.en);
    const icon = DOTS.map(dot).join('');
    button.innerHTML = `<svg xmlns="${SVG}" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">` +
        `<g class="sse-stroke"><path d="${icon}"/></g><g class="sse-fill"><path d="${icon}"/></g></svg>`;
    root.querySelector('.spirulaClipButton').after(button);
    // a 360 photo shows no splats: the points wait outside it, as the visitor left them
    const shown = () => on && !state.panorama;
    addTooltip(root, button, () => text[shown() ? 'off' : 'on'][lang] ?? text[shown() ? 'off' : 'on'].en);

    const update = () => {
        button.setAttribute('aria-pressed', String(shown()));
        button.disabled = !state.loaded || state.panorama;
        button.classList.toggle('sse-active', shown());
    };
    button.addEventListener('click', () => {
        on = !on;
        look.setPoints(on);
        update();
    });
    // the viewer reads keys from window, so a focused button would also take Space
    button.addEventListener('pointerup', () => button.blur());
    events.on('loaded:changed', update);
    events.on('panorama:changed', () => {
        if (on) look.setPoints(shown());
        update();
    });
    update();
};
