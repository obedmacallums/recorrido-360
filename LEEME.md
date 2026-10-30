# Recorrido estático con fotos 360°

Sube toda esta carpeta a un servidor HTTP. No necesita Node, Vite, una cuenta,
un backend ni acceso a superspl.at. Abrir index.html con file:// no funciona.
Conserva en la carpeta viewer los archivos LICENSE.txt, PLAYCANVAS-LICENSE.txt
y THIRD_PARTY_NOTICES.md.

La interfaz es SuperSplat Viewer 1.41.0: órbita (1), vuelo (2), caminar (3),
ajustes, controles, información, pantalla completa, joystick táctil y mandos.
Caminar, las huellas y la visualización de colisiones requieren colisiones.
Al caminar, la vista va a params.walk_height metros del suelo (0 usa la del
visor). El botón Caminar activa el modo y abre encima un panel con el
regulador de altura de los ojos y su valor en metros. Otro clic en Caminar
abre o cierra el panel; un clic fuera o Escape lo cierra sin perder el ajuste.
La altura inicial es la configurada en el template. El valor elegido se
conserva al cambiar de modo durante la sesión.
El rango sale de la escena: nunca pasa del techo que
tenga encima ni baja al suelo, y al aire libre llega hasta el tamaño de la
escena. Sólo se mueve la cámara: el cuerpo que choca no cambia de tamaño.
La regla (tecla M), junto a los modos de cámara, mide distancias como el editor
de SuperSplat: cada 2 puntos colocados sobre el modelo con clic o toque forman
una medición, con su longitud en metros sobre la línea. Las mediciones quedan a
la vista al apagar la regla. Un clic en un punto lo selecciona, y enciende la
regla si estaba apagada; sus flechas y
cuadrados lo mueven por un eje o un plano. Esc lo deselecciona y, sin punto
seleccionado, apaga la regla. Supr borra la medición seleccionada, igual que
la papelera que aparece bajo su longitud al pasar el cursor por ella o al
seleccionar uno de sus puntos; «Borrar» quita todas y «Ocultar mediciones» las
esconde. Lo que queda detrás del modelo se ve
tenue, como los puntos de las vistas, y se atenúan y ocultan con la barra de
controles cuando el visitante no la usa. Arrastrar sobre la escena sigue
moviendo la cámara. Cada visitante conserva sus mediciones en su navegador al
recargar, no las ven los demás.
El botón de ubicación, abajo a la izquierda y junto a reproducir, oculta o
muestra solo los hotspots. El fondo naranja indica que están visibles. Las mediciones
y el navegador superior de panorámicas siguen disponibles.
El botón se sincroniza con el ajuste de anotaciones y recuerda su estado.
Sin fotos 360 ni vistas no hay hotspots, y no aparecen ni este botón ni el
modo pano.
El corte por altura, junto a la regla, abre a la derecha una barra con dos
tiradores: lo que queda por encima del superior o por debajo del inferior se
oculta, como el corte en Z del visor de XGRIDS (en este visor +Y es arriba).
Un tirador en su extremo deja ese lado abierto. Cerrar la barra mantiene el
corte; se quita llevando los tiradores a los extremos.
El botón de puntos, junto al corte, muestra el modelo como nube de puntos,
como el visor de XGRIDS: cada splat es un punto en su centro, coloreado por
altura en tonos suaves (azul abajo, verde al medio, rojo arriba). No descarga
nada más, y el corte por altura sigue funcionando. Otro clic vuelve a los
splats. Dentro de una foto 360 el botón se apaga; al salir a órbita, vuelo o
caminar vuelven los puntos si estaban activos.
Al abrir, una onda de puntos coloreados por altura crece desde la cámara (desde
el centro del modelo si la cámara empieza fuera) y otra detrás la convierte en
el modelo, mientras la cámara hace su recorrido inicial. Dura unos 10 segundos,
y mientras carga la pantalla queda negra en lugar de mostrar la imagen previa.
Se desactiva con la opción «Animación de entrada» al exportar; no aparece en el
modo rendimiento, en realidad virtual ni con movimiento reducido en el sistema,
y entonces la carga muestra la imagen previa.
Arriba a la izquierda, los ejes de Spirula (Z es la altura) como los ve la
cámara, como el gizmo de la app: un clic en un eje gira la órbita para mirar a
lo largo de él, y un segundo clic lo mira desde el lado opuesto.
Las fotos 360° de la captura están donde se tomaron: cada una es un punto
numerado después de las vistas, y entra en el navegador anterior/siguiente. Al
elegirla, la cámara vuela al centro de la foto, que aparece al final del vuelo;
arrastrar gira en el sitio, la rueda acerca o aleja, y los puntos de las otras
fotos siguen en su lugar sobre ella. «Modo pano» (marco panorámico con flechas) es el primer
botón del grupo de cámaras abajo a la derecha y se ilumina al entrar en una
panorámica. Otro clic vuelve al modelo; también se puede elegir órbita, vuelo
o caminar, usar Esc o alejarse con el teclado. Desde el modelo, Modo pano abre
la panorámica más cercana. Si se acaba de salir de una y aún se está junto a
ella, permite regresar conservando el encuadre actual del modelo.
Un doble clic o doble toque sobre la imagen panorámica también vuelve al modelo con el
mismo encuadre. Con la regla activa, el doble clic sigue disponible para medir.
El visor decide la disponibilidad de AR/VR según el navegador y dispositivo.
Usa ?webgl para forzar WebGL; por defecto intenta WebGPU con fallback.

Genera o importa las colisiones en Spirula antes de exportar. Se incluyen las
colisiones cargadas del mismo modelo, incluso cambios aún sin guardar; si no
están cargadas se busca el archivo .voxel.json al lado del modelo. Una
colisión generada con el modelo tal como se ve en Spirula se exporta tal cual,
vóxel por vóxel; una con otro suelo se exporta como caras GLB, sin volver a
voxelizar. Después de borrar splats, regenera las colisiones si esos cambios
deben abrir paso: la exportación conserva la colisión existente.

El modelo se exporta derecho tal como se ve en Spirula, sea cual sea el eje
vertical del archivo: en el archivo de splats queda -Y hacia arriba, +Y en el
motor, como en SuperSplat. Las coordenadas de este archivo están en metros.

scene.json contiene el modelo, la cámara inicial y params. Para añadir vistas,
edita params.annotations (cadena JSON con una lista de anotaciones):

```json
[{"position":[0,1,0],"title":"Entrada","text":"Vista de la entrada","camera":{"initial":{"position":[0,1.6,3],"target":[0,1,0],"fov":75}}}]
```

Son coordenadas del motor PlayCanvas (+Y arriba). La cámara de scene.json está
en las coordenadas del archivo: para usar una posición como anotación invierte
sus componentes X e Y. Las vistas generan los puntos numerados y el navegador
anterior/siguiente del visor publicado. No se inventan vistas del modelo.

scene.json.panoramas lista las fotos 360° en el orden de la página, en el mismo
marco y ejes que la cámara (la foto mira por -Z):

```json
[{"name":"Pasillo","tiles":{"path":"panos/1","tile":512,"levels":[474,948,1895,3789]},
  "position":[x,y,z],"rotation":[x,y,z,w]}]
```

Cada foto es un cubo de mosaicos WebP: `panos/1/<nivel>/<cara>_<fila>_<columna>.webp`,
con el nivel 0 el más chico y las caras f, r, b, l, u, d (frente -Z, derecha +X,
atrás, izquierda, arriba +Y, abajo). La página carga el nivel 0 entero y de los
demás solo lo que se ve.

params.anim_tracks admite la lista animTracks de SuperSplat. Sin una pista
propia, el visor genera una órbita si la cámara está fuera del modelo, o un
movimiento suave en ocho si está dentro. Ejemplo de pista:

```json
[{"name":"Recorrido","duration":8,"frameRate":30,"loopMode":"repeat","interpolation":"spline","smoothness":0.5,"keyframes":{"times":[0,4,8],"values":{"position":[0,1.6,3,3,1.6,0,0,1.6,3],"target":[0,1,0,0,1,0,0,1,0],"fov":[75,75,75]}}}]
```

El cielo opcional es una imagen equirectangular: cópiala en la carpeta y usa su
ruta en params.skybox. Para mantener el sitio independiente usa rutas locales.

API, formato de vistas y recorridos:
https://github.com/playcanvas/supersplat-viewer/blob/v1.41.0/docs/api.md
