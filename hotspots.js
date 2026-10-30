// Shows or hides the scene's hotspots while the annotation navigator stays.

import { addTooltip } from './controls.js';

const text = {
    hide: {
        es: 'Ocultar hotspots', en: 'Hide hotspots',
        de: 'Hotspots ausblenden', fr: 'Masquer les points',
        ja: 'ホットスポットを非表示', ko: '핫스팟 숨기기',
        'pt-BR': 'Ocultar hotspots', ru: 'Скрыть точки', 'zh-CN': '隐藏热点'
    },
    show: {
        es: 'Mostrar hotspots', en: 'Show hotspots',
        de: 'Hotspots anzeigen', fr: 'Afficher les points',
        ja: 'ホットスポットを表示', ko: '핫스팟 표시',
        'pt-BR': 'Mostrar hotspots', ru: 'Показать точки', 'zh-CN': '显示热点'
    }
};

export const addHotspotToggle = (viewer, root, lang) => {
    const { state, events } = viewer;
    state.keepAnnotationNavigator = true;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'spirulaHotspotToggle sse-controlButton sse-toggle sse-left';
    const icon = '<path fill-rule="evenodd" d="M12 1.5A6.5 6.5 0 0 0 5.5 8c0 4.1 5.5 10.3 6 10.8a.7.7 0 0 0 1 0c.5-.5 6-6.7 6-10.8A6.5 6.5 0 0 0 12 1.5Zm0 3.6a2.9 2.9 0 1 1 0 5.8 2.9 2.9 0 0 1 0-5.8Z"/>' +
        '<path d="M5.2 14.7a.9.9 0 0 1 .6 1.7C3.8 17.1 3 17.9 3 18.5c0 1.2 4 2.3 9 2.3s9-1.1 9-2.3c0-.6-.8-1.4-2.8-2.1a.9.9 0 1 1 .6-1.7C21.7 15.7 23 17 23 18.5c0 2.7-5.5 4.1-11 4.1S1 21.2 1 18.5c0-1.5 1.3-2.8 4.2-3.8Z"/>';
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">' +
        `<g class="sse-stroke">${icon}</g><g class="sse-fill">${icon}</g></svg>`;
    button.setAttribute('aria-label', 'Hotspots');
    const label = () => {
        const l = text[state.showAnnotations ? 'hide' : 'show'];
        return l[lang] ?? l.en;
    };
    addTooltip(root, button, label);
    const update = () => {
        const visible = state.showAnnotations;
        button.setAttribute('aria-pressed', String(visible));
        button.disabled = !state.loaded;
        button.classList.toggle('sse-active', visible);
    };
    button.addEventListener('click', e => {
        e.stopPropagation();
        events.fire('inputEvent', 'interact');
        state.showAnnotations = !state.showAnnotations;
    });
    button.addEventListener('keydown', e => {
        if (e.key === ' ' || e.key === 'Enter') e.stopPropagation();
    });
    button.addEventListener('pointerup', () => button.blur());
    events.on('loaded:changed', update);
    events.on('showAnnotations:changed', update);
    const group = document.createElement('div');
    group.className = 'sse-buttonGroup';
    group.append(button);
    root.querySelector('.sse-buttonsContainer > .sse-spacer').before(group);
    update();
};
