// Logarithmic eye-height control anchored to the walk camera button.

const label = {
    es: 'Altura de los ojos', en: 'Eye height', de: 'Augenhöhe', fr: 'Hauteur des yeux',
    ja: '目の高さ', ko: '눈높이', 'pt-BR': 'Altura dos olhos', ru: 'Высота глаз', 'zh-CN': '视线高度'
};

export const addEyeHeight = (viewer, root, lang) => {
    const name = label[lang] ?? label.en;
    const { state, events } = viewer;
    const button = root.querySelector('.sse-fpsCamera');
    let shown = false;

    const panel = document.createElement('div');
    panel.className = 'spirulaHeight sse-hidden';
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', name);
    const value = document.createElement('div');
    value.className = 'spirulaHeightValue';
    const track = document.createElement('div');
    track.className = 'spirulaClipTrack';
    const span = document.createElement('div');
    span.className = 'spirulaClipSpan';
    span.style.bottom = '0';
    const handle = document.createElement('div');
    handle.className = 'spirulaClipHandle';
    handle.tabIndex = 0;
    handle.setAttribute('role', 'slider');
    handle.setAttribute('aria-orientation', 'vertical');
    handle.setAttribute('aria-label', name);
    track.append(span, handle);
    panel.append(value, track);
    panel.addEventListener('pointerdown', e => e.stopPropagation());

    const format = new Intl.NumberFormat(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const toHeight = v => {
        const [low, high] = state.walkHeightRange;
        return low * (high / low) ** v;
    };
    const toSlider = height => {
        const [low, high] = state.walkHeightRange;
        return Math.log(height / low) / Math.log(high / low);
    };
    const draw = () => {
        if (!state.walkHeightRange || state.walkHeight === null) return;
        const v = Math.min(1, Math.max(0, toSlider(state.walkHeight)));
        handle.style.top = span.style.top = `${(1 - v) * 100}%`;
        handle.setAttribute('aria-valuemin', state.walkHeightRange[0]);
        handle.setAttribute('aria-valuemax', state.walkHeightRange[1]);
        handle.setAttribute('aria-valuenow', state.walkHeight);
        handle.setAttribute('aria-valuetext', `${format.format(state.walkHeight)} m`);
        value.textContent = `${format.format(state.walkHeight)} m`;
    };
    const set = v => { state.walkHeight = toHeight(Math.min(1, Math.max(0, v))); };

    let dragging = false;
    const at = e => {
        const r = track.getBoundingClientRect();
        return (r.bottom - e.clientY) / r.height;
    };
    track.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        e.preventDefault();
        track.setPointerCapture(e.pointerId);
        dragging = true;
        set(at(e));
    });
    track.addEventListener('pointermove', e => { if (dragging) set(at(e)); });
    for (const type of ['pointerup', 'pointercancel']) track.addEventListener(type, () => { dragging = false; });

    // the viewer reads keys from window, so the keys the handle takes stop here
    const steps = { ArrowUp: 0.01, ArrowRight: 0.01, ArrowDown: -0.01, ArrowLeft: -0.01, PageUp: 0.1, PageDown: -0.1 };
    handle.addEventListener('keydown', e => {
        const v = toSlider(state.walkHeight);
        if (e.key in steps) set(v + steps[e.key]);
        else if (e.key === 'Home') set(0);
        else if (e.key === 'End') set(1);
        else return;
        e.preventDefault();
        e.stopPropagation();
    });

    button.setAttribute('aria-expanded', 'false');
    const group = button.parentElement;
    group.classList.add('spirulaHeightGroup');
    group.append(panel);

    function update() {
        const walking = state.cameraMode === 'walk' && state.walkHeightRange;
        if (!walking) shown = false;
        button.setAttribute('aria-expanded', String(shown));
        panel.classList.toggle('sse-hidden', !shown);
        panel.style.left = `${button.offsetLeft + button.offsetWidth / 2}px`;
        draw();
    }
    button.addEventListener('click', e => {
        if (!state.walkAllowed || !state.walkHeightRange) return;
        // Replace the runtime's walk toggle so a second click can open the panel.
        e.stopImmediatePropagation();
        // Opening a pointer-operated panel must precede the runtime's capture request.
        if ((state.cameraMode !== 'walk' || !shown) && state.inputMode === 'desktop') {
            state.gamingControls = false;
        }
        if (state.cameraMode !== 'walk') {
            viewer.toggleWalk();
            shown = true;
        } else {
            shown = !shown;
        }
        update();
    }, true);
    root.addEventListener('pointerdown', e => {
        if (!shown || panel.contains(e.target) || button.contains(e.target)) return;
        shown = false;
        update();
    }, true);
    window.addEventListener('keydown', e => {
        if (!shown || e.key !== 'Escape') return;
        e.preventDefault();
        e.stopImmediatePropagation();
        shown = false;
        if (panel.contains(document.activeElement)) button.focus();
        update();
    }, true);
    // Keep keyboard activation and slider keys from reaching camera shortcuts.
    panel.addEventListener('keydown', e => e.stopPropagation());
    button.addEventListener('keydown', e => {
        if (e.key === ' ' || e.key === 'Enter') e.stopPropagation();
    });
    button.addEventListener('pointerup', () => button.blur());
    events.on('cameraMode:changed', update);
    events.on('walkHeightRange:changed', update);
    events.on('walkHeight:changed', draw);
    update();
};
