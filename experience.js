import { createViewer } from './viewer/viewer.js';
import { addMeasureTool } from './measure.js';
import { addHeightClip } from './clip.js';
import { addPointCloud } from './points.js';
import { addIntro, introPlays } from './intro.js';
import { addEyeHeight } from './height.js';
import { addViewCube } from './viewcube.js';
import { addPanoramas, panoramaAnnotations } from './panorama.js';
import { addHotspotToggle } from './hotspots.js';

const flip = ([x, y, z]) => [-x, -y, z];
// a black pixel: as the poster, the viewer keeps the canvas hidden behind it until the scene loads
const BLACK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==';
const array = (value, name) => {
    const parsed = JSON.parse(value || '[]');
    if (!Array.isArray(parsed)) throw new Error(`${name}: expected a JSON array`);
    return parsed;
};

try {
    const response = await fetch('./scene.json');
    if (!response.ok) throw new Error(`scene.json: HTTP ${response.status}`);
    const scene = await response.json();
    const p = scene.params;
    const color = (p.background || '#000000').match(/[a-f\d]{2}/gi).map(v => parseInt(v, 16) / 255);
    const camera = scene.camera;
    const fov = camera ? (camera.aspect > 1 ? camera.fov_x_deg : camera.fov_y_deg) : 90;
    const views = array(p.annotations, 'annotations');
    const settings = {
        version: 2,
        tonemapping: 'none',
        highPrecisionRendering: true,
        background: { color },
        postEffectSettings: {
            sharpness: { enabled: false, amount: 0 },
            bloom: { enabled: false, intensity: 0.1, blurLevel: 2 },
            grading: { enabled: false, brightness: 1, contrast: 1, saturation: 1, tint: [1, 1, 1] },
            vignette: { enabled: false, intensity: 0, inner: 0.3, outer: 0.75, curvature: 1 },
            fringing: { enabled: false, intensity: 0.5 }
        },
        cameras: camera ? [{ initial: {
            position: flip(camera.position), target: flip(camera.target),
            fov
        } }] : [],
        // the 360 photos are numbered after the hand-written views
        annotations: [...views, ...panoramaAnnotations(scene, fov)],
        animTracks: array(p.anim_tracks, 'animTracks'),
        startMode: 'default'
    };
    if (settings.animTracks.length) settings.startMode = 'animTrack';
    document.documentElement.lang = p.language || 'es';
    // the controls panel starts closed; its button or H opens it (the viewer's own stored choice)
    try { localStorage.setItem('controlsPanelOpen', 'false'); } catch { /* blocked storage */ }
    // an export from before the option has it on
    const intro = p.intro !== false && introPlays();
    const viewer = await createViewer({
        container: document.getElementById('experience'),
        contentUrl: scene.model.path,
        collisionUrl: scene.collision || undefined,
        // with the opening the wait is black: the poster would show the model before its points
        posterUrl: intro ? BLACK : scene.poster || undefined,
        skyboxUrl: p.skybox || undefined,
        settings,
        lang: p.language || 'es',
        renderer: new URLSearchParams(location.search).has('webgl') ? 'webgl' : 'webgpu'
    });
    window.SpirulaExperience = viewer;
    if (Number.isFinite(p.walk_height) && p.walk_height > 0) viewer.state.walkHeight = p.walk_height;
    const root = document.querySelector('#experience .sse-viewer');
    addMeasureTool(viewer, root, p.language || 'es');
    // nothing to show or hide without photos or views
    if (settings.annotations.length) addHotspotToggle(viewer, root, p.language || 'es');
    addHeightClip(viewer, root, p.language || 'es');
    addPointCloud(viewer, root, p.language || 'es');
    if (intro) addIntro(viewer);
    addEyeHeight(viewer, root, p.language || 'es');
    // Spirula's axes, as its own gizmo draws them; an export without them has the exporter's usual turn
    const axes = scene.axes ? ['x', 'y', 'z'].map(k => flip(scene.axes[k])) : [[-1, 0, 0], [0, 0, 1], [0, 1, 0]];
    addViewCube(viewer, root, axes);
    addPanoramas(viewer, root, scene, views.length, fov, p.language || 'es');
    const start = () => {
        if (p.start_mode === 'orbit') viewer.state.cameraMode = 'orbit';
        if (p.start_mode === 'walk' && viewer.state.walkAllowed) viewer.toggleWalk();
        else if (p.start_mode === 'fly' || p.start_mode === 'walk') viewer.state.cameraMode = 'fly';
        if (p.start_mode !== 'walk' || viewer.state.walkAllowed) return;
        // Collision loads apart from the splats, so walking can be allowed after the first frame.
        viewer.events.once('walkAllowed:changed', allowed => {
            if (allowed && viewer.state.cameraMode === 'fly') viewer.toggleWalk();
        });
    };
    if (viewer.state.loaded) start();
    else viewer.events.once('loaded:changed', start);
} catch (error) {
    const notice = document.getElementById('error');
    notice.textContent = `No se pudo abrir la escena / Could not open scene: ${error.message}`;
    notice.hidden = false;
    console.error(error);
}
