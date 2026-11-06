// The template's buttons on the viewer's control bar, with its tooltip and its controls panel.

// the viewer's Tooltip is not exported; its 'top' placement. `label` may be a function, read when shown.
export const addTooltip = (root, button, label) => {
    const tooltip = root.querySelector('.sse-tooltip');
    let timer = 0;
    button.addEventListener('pointerenter', () => {
        timer = setTimeout(() => {
            const origin = tooltip.parentElement.getBoundingClientRect();
            const rect = button.getBoundingClientRect();
            tooltip.textContent = typeof label === 'function' ? label() : label;
            Object.assign(tooltip.style, {
                left: `${Math.floor((rect.left + rect.right) / 2 - origin.left)}px`,
                top: `${rect.top - origin.top}px`,
                transform: 'translate(-50%, calc(-100% - 10px))',
                display: 'inline'
            });
        }, 250);
    });
    const hide = () => {
        clearTimeout(timer);
        tooltip.style.display = 'none';
    };
    button.addEventListener('pointerleave', hide);
    button.addEventListener('click', hide);
};

// The viewer re-renders the controls panel on every mode change; the key goes above its H rows,
// which it lists only for a desktop without mouse capture.
export const addKeyHint = (root, className, label, keyName) => {
    const hintRows = root.querySelector('.sse-controlsHintRows');
    const add = () => {
        const divider = hintRows.querySelector('.sse-divider');
        if (!divider || hintRows.querySelector(`.${className}`)) return;
        const item = document.createElement('div');
        item.className = `sse-controlsHintItem ${className}`;
        const name = document.createElement('span');
        name.className = 'sse-controlsHintAction';
        name.textContent = label;
        const inputs = document.createElement('span');
        inputs.className = 'sse-controlsHintInputs';
        const key = document.createElement('kbd');
        key.className = 'sse-key';
        key.textContent = keyName;
        inputs.append(key);
        item.append(name, inputs);
        divider.after(item);
    };
    if (hintRows) {
        new MutationObserver(add).observe(hintRows, { childList: true });
        add();
    }
};
