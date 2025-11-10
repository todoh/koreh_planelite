// --- engine_3d.js ---
// ¡MODIFICADO!
// - Añadida lógica de Zoom 3D (distancia de cámara).
// - Añadida lógica de Rotación 3D (órbita).
// - Se usa camera.lookAt() para simplificar la órbita.
// --- ¡NUEVO! Se controla la luz del día/noche. ---

import * as THREE from 'three';
import { TILE_PX_WIDTH, TILE_PX_HEIGHT, IMAGES } from './logic.js';
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let $canvas;
// --- ¡MODIFICADO! Mover luces al scope del módulo ---
let renderer, scene, camera, ambientLight, directionalLight;

// --- OBJETOS 3D ---
let groundPlane;
const textureCache = new Map();
const materialCache = new Map();
const geometryCache = new Map();
const activeEntities = new Map();
let visibleObjectKeys = new Set();


// --- ESTADO DE CÁMARA ---
const CAMERA_ANGLE_X = -Math.PI / 4; // -45 grados de inclinación
const BASE_CAMERA_DISTANCE = 1000; // Distancia base
let currentCameraDistance = BASE_CAMERA_DISTANCE;
let currentCameraRotationY = 0; // Ángulo de órbita

// Constantes de Zoom
const ZOOM_STEP = 150;
const MIN_ZOOM_DISTANCE = 400;
const MAX_ZOOM_DISTANCE = 1000;


/**
 * Inicializa el renderer 3D de Three.js
 */
export function initialize3DEngine($canvasElement) {
    $canvas = $canvasElement;

    // 1. Renderizador
    renderer = new THREE.WebGLRenderer({
        canvas: $canvas,
        antialias: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize($canvas.clientWidth, $canvas.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // 2. Escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    // 3. Cámara (Perspectiva)
    const fov = 50;
    const aspect = $canvas.clientWidth / $canvas.clientHeight;
    const near = 1;
    const far = BASE_CAMERA_DISTANCE * 4; // Rango de visión más grande
    camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

    // ¡La posición y rotación se establecen en render3DFrame!

    // 4. Luces
    // --- ¡MODIFICADO! Quitar 'const' para usar las variables del módulo ---
    ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Luz de relleno, se mantiene blanca
    scene.add(ambientLight);
    // --- ¡MODIFICADO! Color del sol más cálido y menos gris ---
    directionalLight = new THREE.DirectionalLight(0xfff8e1, 0.5); // De 0xffffff (blanco) a un blanco cálido
    directionalLight.position.set(0, 10, 5); //
    scene.add(directionalLight);

    // 5. Crear el Suelo
    const groundTexture = new THREE.TextureLoader().load('./assets/stone_ground.png');
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(100, 100);
    groundTexture.colorSpace = THREE.SRGBColorSpace;

    const groundMaterial = new THREE.MeshLambertMaterial({
        map: groundTexture
    });

    const groundGeometry = new THREE.PlaneGeometry(10000, 10000);
    groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);

    groundPlane.rotation.x = -Math.PI / 2;
    scene.add(groundPlane);

    // 6. Listener de redimensionado
    window.addEventListener('resize', resize3DEngine);
    resize3DEngine();
}

/**
 * ¡NUEVO! Controla el zoom 3D
 * @param {boolean} zoomIn
 */
export function handle3DZoom(zoomIn) {
    if (zoomIn) {
        currentCameraDistance = Math.max(MIN_ZOOM_DISTANCE, currentCameraDistance - ZOOM_STEP);
    } else {
        currentCameraDistance = Math.min(MAX_ZOOM_DISTANCE, currentCameraDistance + ZOOM_STEP);
    }
}
/**
 * ¡NUEVA FUNCIÓN! Traduce coordenadas de pantalla a coordenadas del mundo 3D (en el suelo).
 * @param {number} screenX - Coordenada X del clic (desde e.clientX)
 * @param {number} screenY - Coordenada Y del clic (desde e.clientY)
 * @returns {object|null} - { x, y } (donde y es el Z del mundo 3D) o null si no hay intersección.
 */
export function getWorldCoordsFromScreen(screenX, screenY) {
    if (!$canvas || !camera || !groundPlane) return null;

    // 1. Normalizar coordenadas del clic (de -1 a +1)
    mouse.x = (screenX / $canvas.clientWidth) * 2 - 1;
    mouse.y = -(screenY / $canvas.clientHeight) * 2 + 1;

    // 2. Configurar el raycaster desde la cámara
    raycaster.setFromCamera(mouse, camera);

    // 3. Encontrar intersecciones SÓLO con el plano del suelo
    const intersects = raycaster.intersectObject(groundPlane);

    // 4. Devolver el punto de intersección
    if (intersects.length > 0) {
        const point = intersects[0].point;
        // Devolvemos el X del mundo 3D
        // y el Z del mundo 3D (que nuestro juego trata como 'y')
        return { x: point.x, y: point.z };
    }

    return null;
}

/**
 * ¡NUEVO! Controla la rotación 3D (8 direcciones)
 * @param {boolean} rotateRight
 */
export function handle3DCameraRotate(rotateRight) {
    const rotationStep = Math.PI / 4; // 45 grados
    if (rotateRight) {
        currentCameraRotationY += rotationStep;
    } else {
        currentCameraRotationY -= rotationStep;
    }
}


/**
 * Redimensiona el canvas 3D y la cámara
 */
function resize3DEngine() {
    const width = $canvas.clientWidth;
    const height = $canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height);
    const aspect = width / height;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
}

// --- ¡NUEVA FUNCIÓN! ---
/**
 * ¡NUEVO! Actualiza la intensidad de las luces 3D según la hora del día.
 * @param {number} timeOfDay - 0.0 (medianoche) a 1.0 (medianoche)
 */
function updateLighting(timeOfDay) {
    if (!ambientLight || !directionalLight) return;

    // Usamos la misma curva de coseno que el render 2D (0.0 noche, 1.0 día)
    // (Math.cos((timeOfDay - 0.5) * 2 * Math.PI) + 1) / 2;
    const brightness = (Math.cos((timeOfDay - 0.5) * 2 * Math.PI) + 1) / 2;

    // --- Ajustes de Brillo (Respondiendo a "se apagado") ---

    // Luz Ambiental (Luz base)
    // Sube el máximo para un día más brillante y sombras más claras.
    const minAmbient = 0.3;
    const maxAmbient = 1.0; // Estaba en 0.8
    ambientLight.intensity = minAmbient + (maxAmbient - minAmbient) * brightness;

    // Luz Direccional (Sol)
    // Sube el máximo drásticamente para un sol mucho más fuerte.
    const minDirectional = 0.1;
    const maxDirectional = 1.5; // Estaba en 0.6
    directionalLight.intensity = minDirectional + (maxDirectional - minDirectional) * brightness;

    // Opcional: Mover el sol (simple)
    // Esto hace que la luz venga "de lado" al amanecer/atardecer y "desde arriba" al mediodía
    directionalLight.position.x = Math.cos((timeOfDay - 0.5) * Math.PI) * 10; // Este a Oeste
    directionalLight.position.y = brightness * 10 + 2; // Arriba/Abajo
}


/**
 * Dibuja el frame 3D.
 */
export function render3DFrame(playerX, playerY, playerZ, objectsToRender, timeOfDay) { //
    if (!renderer) return;

    // --- 1. Mover la Cámara (¡LÓGICA DE ÓRBITA MODIFICADA!) ---
    const playerWorldY_3D = playerZ * TILE_PX_HEIGHT;
    const playerWorldZ_3D = playerY;

    // El punto al que miramos (los pies del jugador)
    const target = new THREE.Vector3(playerX, playerWorldY_3D, playerWorldZ_3D);

    // Calcular offsets basados en la inclinación (CAMERA_ANGLE_X)
    // Distancia horizontal (en el plano XZ) desde el jugador
    const horizontalOffset = currentCameraDistance * Math.cos(CAMERA_ANGLE_X);
    // Distancia vertical (en Y) sobre el jugador
    const verticalOffset = currentCameraDistance * Math.sin(-CAMERA_ANGLE_X);

    // Calcular la posición X y Z de la cámara usando la órbita (currentCameraRotationY)
    const camX = target.x + (horizontalOffset * Math.sin(currentCameraRotationY));
    const camZ = target.z + (horizontalOffset * Math.cos(currentCameraRotationY));
    // La altura Y es siempre la misma
    const camY = target.y + verticalOffset;

    // Establecer la posición...
    camera.position.set(camX, camY, camZ);
    // ...y mirar al objetivo.
    camera.lookAt(target);


    // --- 2. Actualizar Entidades (Meshes) ---
    // (Esta lógica no necesita cambios)
    visibleObjectKeys.clear();

    for (const obj of objectsToRender) {
        if (obj.isGround) continue;
        const key = obj.uid;
        if (!key) continue;

        visibleObjectKeys.add(key);
        let entityMesh = activeEntities.get(key);

        const img = IMAGES[obj.key];
        if (!img || !img.naturalWidth) continue;

        if (!entityMesh) {
            // --- A. Crear Mesh (es nuevo) ---
            let texture = textureCache.get(obj.key);
            if (!texture) {
                texture = new THREE.Texture(img);
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.needsUpdate = true;
                textureCache.set(obj.key, texture);
            }
            let material = materialCache.get(obj.key);
            if (!material) {
                material = new THREE.MeshLambertMaterial({
                    map: texture,
                    transparent: true,
                    alphaTest: 0.1,
                    side: THREE.DoubleSide
                });
                materialCache.set(obj.key, material);
            }
            let geometry = geometryCache.get('plane_1x1');
            if (!geometry) {
                geometry = new THREE.PlaneGeometry(1, 1);
                geometryCache.set('plane_1x1', geometry);
            }
            entityMesh = new THREE.Mesh(geometry, material);
            activeEntities.set(key, entityMesh);
            scene.add(entityMesh);
        }

        // --- B. Actualizar Mesh (existente o nuevo) ---
        const worldX_3D = obj.x;
        const worldZ_3D = obj.y;
        const worldY_3D = (img.naturalHeight / 2) + (playerZ * TILE_PX_HEIGHT);

        entityMesh.position.set(worldX_3D, worldY_3D, worldZ_3D);

        const scaleX = (obj.facing === 'left') ? -img.naturalWidth : img.naturalWidth;
        const scaleY = img.naturalHeight;

        if (entityMesh.scale.x !== scaleX || entityMesh.scale.y !== scaleY) {
             entityMesh.scale.set(scaleX, scaleY, 1);
        }
    }

    // --- C. Eliminar Meshes (ya no visibles) ---
    for (const [key, entityMesh] of activeEntities.entries()) {
        if (!visibleObjectKeys.has(key)) {
            scene.remove(entityMesh);
            activeEntities.delete(key);
        }
    }

    // --- 3. Renderizar la Escena ---
    // --- ¡MODIFICADO! ---
    updateLighting(timeOfDay); // <-- ¡LLAMADA A LA NUEVA FUNCIÓN!
    renderer.render(scene, camera); //
}