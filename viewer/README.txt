SuperSplat Viewer 1.41.0 (MIT), PlayCanvas engine 2.23.3 (MIT).
Source: https://github.com/playcanvas/supersplat-viewer
Package: @playcanvas/supersplat-viewer@1.41.0
Archive: playcanvas-supersplat-viewer-1.41.0.tgz
npm shasum: 56936184b2d343899d6a8b84b7ef0dbdffcca022

viewer.css is the unmodified public/index.css from that npm archive, and
THIRD_PARTY_NOTICES.md its notices for the gsaf decoder glue bundled in
index.js. Its public/gsaf-decoder.wasm is left out: the viewer fetches it only
to play a .gsaf sequence, which no export writes. viewer.js
is its public/index.js plus local changes, each marked "Spirula patch": the
state.walkHeight setting (eye above the floor in walk mode, metres, kept under
the ceiling) and its state.walkHeightRange, applied by WalkController.viewHeight;
state.measuring, which leaves clicks and taps to the template's measure tool
(no focus, fly-to or walk-to, a crosshair cursor) and keeps the controls,
where its bar is, from fading; the annotation navigator also stays visible
while the pointer is over its arrows; Picker.invalidate, which the height clip
calls since the picker's cached render cannot see the cut;
NavInteraction._pickFocusTarget, which focuses the orbit on the splats before
collision, since collision cannot see the cut either; an align event, the
editor's camera.align for the template's view cube; state.panorama, which keeps
a click, tap or double click from moving the camera out of a 360 photo; and a
look event, which turns the camera in place at once and sets the active
controller's fov, for the 360 photos' zoom. The annotation:nearby event updates
the unselected navigator's name and click target without moving the camera;
the navigator also supports a single annotation. state.keepAnnotationNavigator
leaves that navigator available when showAnnotations hides the hotspots.
The panorama:exit event consumes a double click or tap inside a photo before
the gesture can pick or navigate in the model.
StochasticSplatRenderer.setHeightClip and setPointMode let the template's
height clip and point cloud reach the Performance mode renderer, whose
projector reads the files directly and so never runs the work buffer
modifier. All engine code,
UI icons and collision navigation are bundled upstream; no CDN or npm
installation is required by an exported site.

The same changes are kept as one diff in tools/supersplat-viewer.patch, outside
this folder because the export copies all of it. After editing viewer.js, run
bash tools/supersplat_viewer_patch.sh write <upstream index.js> <version>, and
bash tools/supersplat_viewer_patch.sh checks that the two still agree.

To update, npm pack an explicitly reviewed version into a temporary directory
and extract it. Copy public/index.css to viewer.css, both upstream MIT licenses,
THIRD_PARTY_NOTICES.md, and public/index.js to viewer.js; then
git -c core.autocrlf=false apply --reject tools/supersplat-viewer.patch. Not -3:
a three-way merge misaligns in a bundle this size. Apply what viewer.js.rej
holds by hand and delete it, then rewrite the patch with the write command
above and update this file's version lines. The supersplat-360 template's height slider and measure tool use the patches;
it also relies on the viewer's .sse-* classes it looks up, and its height clip
on the engine's gsplat work buffer modifier and, in Performance mode, on
setHeightClip. Retest loading, walking, floor
markers, overlays, annotations, playback, measuring, the height clip (with
Performance mode off and on) and the view cube.
Do not process these vendor files as placeholder templates.
