// --- engine_3d.js ---
// ¡MODIFICADO!
// - Implementa THREE.InstancedMesh para entidades dinámicas (Optimización #1).
// - Cambia entidades a MeshBasicMaterial (Optimización #3).
// - El "pool" antiguo (activeEntities) ha sido eliminado.
// - updateLighting ahora tiñe los materiales de las entidades.
// --- ¡FIX v4! Reescribe el bucle de render para resetear InstancedMeshes,
// --- eliminando el "Bucle C" y previniendo el "stuck count" bug.
// --- ¡MODIFICADO (Plan de Construcción)! ---
// - Añadida importación de ENTITY_DATA
// - Modificado getOrCreateInstancedMesh para crear BoxGeometry
// - Modificado render3DFrame para posicionar BoxGeometry
// --- ¡MODIFICADO (Modos de Render)! ---
// - Eliminado 'PlaceableComponent'
// - Añadido 'renderMode' ("billboard", "cross", "cube", "flat")
// - 'getOrCreateInstancedMesh' ahora crea 4 tipos de geometría
// - 'render3DFrame' ahora escala/posiciona 4 tipos de geometría
// --- ¡FIX v5! ---
// - 'getOrCreateInstancedMesh' ahora crea un material OPACO para 'cube'
// --- ¡FIX v6! ---
// - 'render3DFrame' ahora agrupa por 'entityKey' (¡el bug real!)
// --- ¡FIX v7! (Tu corrección) ---
// - 'getOrCreateInstancedMesh' para 'cube' usa 'box_1x1'
// - 'render3DFrame' para 'cube' escala usando 'img.naturalHeight'
// --- ¡MODIFICADO (Iluminación del Jugador)! ---
// - Se eliminó el tinte manual del jugador en render3DFrame.

import * as THREE from 'three';
import { TILE_PX_WIDTH, TILE_PX_HEIGHT, IMAGES, CHUNK_GRID_WIDTH, CHUNK_GRID_HEIGHT, ENTITY_DATA } from './logic.js';
// (BufferGeometryUtils no se usará, la fusión manual ya está implementada)
import { createPlayerMesh } from './player_model.js';
import { updatePlayerAnimation } from './player_animation.js';
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let $canvas;
let renderer, scene, camera, ambientLight, directionalLight;
let raycastPlane; 
let selectorMesh;
// --- OBJETOS 3D ---
const textureCache = new Map();
const materialCache = new Map();
const geometryCache = new Map();

// --- ¡OPTIMIZACIÓN! ---
// Almacén para los Meshes Instanciados (key -> InstancedMesh)
const instancedMeshPool = new Map();
// Helpers para reutilizar en el bucle de renderizado
const tempMatrix = new THREE.Matrix4();
const tempColor = new THREE.Color();

const tempPosition = new THREE.Vector3();
const tempRotation = new THREE.Euler();
const tempQuaternion = new THREE.Quaternion();
const tempScale = new THREE.Vector3();
// ¡NUEVO! Almacén para los meshes estáticos del terreno (chunkKey -> THREE.Group)
const chunkTerrainMeshes = new Map();
export let playerMesh = null;

// --- ESTADO DE CÁMARA ---
const CAMERA_ANGLE_X = -Math.PI / 4; // -45 grados de inclinación
const BASE_CAMERA_DISTANCE = 1000; // Distancia base
let currentCameraDistance = BASE_CAMERA_DISTANCE;
let currentCameraRotationY = 0; // Ángulo de órbita (AHORA SERÁ EL VALOR SUAVE)
let targetCameraRotationY = 0;  // <-- ¡NUEVA LÍNEA! (El objetivo al que rotamos)
const CAMERA_ROTATION_SPEED = 5.0; // <-- ¡NUEVA LÍNEA! (Ajusta esto para más/menos velocidad)

// Constantes de Zoom
const ZOOM_STEP = 150;
const MIN_ZOOM_DISTANCE = 210;
const MAX_ZOOM_DISTANCE = 1500;


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
renderer.clear(true, true, true); // <--- CAMBIA ESTA LÍNEA    // 2. Escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    // 3. Cámara (Perspectiva)
    const fov = 50;
    const aspect = $canvas.clientWidth / $canvas.clientHeight;
    const near = 1;
    const far = BASE_CAMERA_DISTANCE * 4; // Rango de visión más grande
    camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

    // 4. Luces (SOLO PARA EL TERRENO)
    ambientLight = new THREE.AmbientLight(0xffffff, 0.7); 
    scene.add(ambientLight);
    directionalLight = new THREE.DirectionalLight(0xfff8e1, 0.5); 
    directionalLight.position.set(0, 10, 5); //
    scene.add(directionalLight);
playerMesh = createPlayerMesh();    scene.add(playerMesh);
    // 5. Crear el Suelo (Plano de Raycasting)
    const raycastGeometry = new THREE.PlaneGeometry(100000, 100000); // Gigante
    const raycastMaterial = new THREE.MeshBasicMaterial({ 
        visible: false, 
        side: THREE.DoubleSide 
    });
    raycastPlane = new THREE.Mesh(raycastGeometry, raycastMaterial);
    raycastPlane.rotation.x = -Math.PI / 2;
    raycastPlane.position.y = 0; // Se moverá en render3DFrame
    scene.add(raycastPlane);
const selectorGeo = new THREE.RingGeometry(
        TILE_PX_WIDTH * 0.45, // Radio interior
        TILE_PX_WIDTH * 0.55, // Radio exterior
        24 // Segmentos
    );
    const selectorMat = new THREE.MeshBasicMaterial({ 
        color: 0x00FFFF, // Color Cian
        transparent: true, 
        opacity: 0.8,
        side: THREE.DoubleSide 
    });
    selectorMesh = new THREE.Mesh(selectorGeo, selectorMat);
    selectorMesh.rotation.x = -Math.PI / 2; // Tumbarlo
    selectorMesh.visible = false; // Oculto por defecto
    scene.add(selectorMesh);
    // 6. Listener de redimensionado
    window.addEventListener('resize', resize3DEngine);
    resize3DEngine();
}

/**
 * Controla el zoom 3D
 */
export function handle3DZoom(zoomIn) {
    if (zoomIn) {
        currentCameraDistance = Math.max(MIN_ZOOM_DISTANCE, currentCameraDistance - ZOOM_STEP);
    } else {
        currentCameraDistance = Math.min(MAX_ZOOM_DISTANCE, currentCameraDistance + ZOOM_STEP);
    }
}
/**
 * Traduce coordenadas de pantalla a coordenadas del mundo 3D (en el suelo).
 */
export function getWorldCoordsFromScreen(screenX, screenY) {
    if (!$canvas || !camera || !raycastPlane) return null;

    mouse.x = (screenX / $canvas.clientWidth) * 2 - 1;
    mouse.y = -(screenY / $canvas.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObject(raycastPlane); 

    if (intersects.length > 0) {
        const point = intersects[0].point;
        return { x: point.x, y: point.z };
    }

    return null;
}

/**
 * Controla la rotación 3D (8 direcciones)
 */
export function handle3DCameraRotate(rotateRight) {
    const rotationStep = Math.PI / 4; // 45 grados
    if (rotateRight) {
        // --- LÍNEA MODIFICADA ---
        targetCameraRotationY += rotationStep;
    } else {
        // --- LÍNEA MODIFICADA ---
        targetCameraRotationY -= rotationStep;
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

/**
 * Actualiza la intensidad de las luces 3D (terreno) y calcula el tinte (entidades).
 * @returns {THREE.Color} El color de tinte para las entidades.
 */
function updateLighting(timeOfDay) {
    if (!ambientLight || !directionalLight) return tempColor.setRGB(1, 1, 1);

    const brightness = (Math.cos((timeOfDay - 0.5) * 2 * Math.PI) + 1) / 2;

    // 1. Actualizar luces del TERRENO (y ahora también del JUGADOR)
    const minAmbient = 0.3;
    const maxAmbient = 1.0; 
    ambientLight.intensity = minAmbient + (maxAmbient - minAmbient) * brightness;

    const minDirectional = 0.1;
    const maxDirectional = 1.5; 
    directionalLight.intensity = minDirectional + (maxDirectional - minDirectional) * brightness;

    directionalLight.position.x = Math.cos((timeOfDay - 0.5) * Math.PI) * 10; 
    directionalLight.position.y = brightness * 10 + 2; 
    
    // 2. Calcular tinte para ENTIDADES (MeshBasicMaterial)
    // Mapeamos el brillo [0, 1] a un tinte [0.4, 1.0] para que la noche no sea negra pura
    const tintValue = 0.4 + brightness * 0.6;
    tempColor.setRGB(tintValue, tintValue, tintValue);
    
    return tempColor;
}

// --- ¡NUEVAS FUNCIONES DE GESTIÓN DE TERRENO ESTÁTICO! ---

/**
 * ¡FUNCIÓN CRÍTICA REESCRITA!
 * Crea y añade el mesh estático para un chunk completo usando Fusión de Geometría.
 * Se llama desde world.js cuando un chunk se carga.
 */
export function addChunkTerrain(chunkKey, chunkData) {
    if (chunkTerrainMeshes.has(chunkKey)) return; // Ya existe

    const [chunkX, chunkY, chunkZ] = chunkKey.split(',').map(Number);
    const worldYLevel = chunkZ * TILE_PX_HEIGHT;

    // 1. Contenedores para geometrías por material
    const geometriesData = new Map();
    
    // 2. Geometría base del plano (¡reescrita para fusión manual!)
    const basePositions = [
        -0.5, -0.5, 0.0,  // v0
         0.5, -0.5, 0.0,  // v1
         0.5,  0.5, 0.0,  // v2
        -0.5,  0.5, 0.0   // v3
    ];
    const baseUvs = [
        0.0, 0.0,  // uv0
        1.0, 0.0,  // uv1
        1.0, 1.0,  // uv2
        0.0, 1.0   // uv3
    ];
    const baseNormals = [
        0.0, 0.0, 1.0,
        0.0, 0.0, 1.0,
        0.0, 0.0, 1.0,
        0.0, 0.0, 1.0
    ];
    const baseIndices = [
        0, 1, 2,  // Triángulo 1
        0, 2, 3   // Triángulo 2
    ];
    
    const tileWidth = TILE_PX_WIDTH;
    const tileHeight = TILE_PX_HEIGHT;

    // 3. Iterar todos los tiles y agrupar sus datos de geometría
    for (let y = 0; y < CHUNK_GRID_HEIGHT; y++) {
        for (let x = 0; x < CHUNK_GRID_WIDTH; x++) {
            
            const tileKey = (chunkData.terrain[y] && chunkData.terrain[y][x]) ? chunkData.terrain[y][x] : "DIRT";
            
            if (!geometriesData.has(tileKey)) {
                geometriesData.set(tileKey, {
                    positions: [], uvs: [], normals: [], indices: [], vertexCount: 0
                });
            }
            const data = geometriesData.get(tileKey);

            const globalTileX = (chunkX * CHUNK_GRID_WIDTH) + x;
            const globalTileY = (chunkY * CHUNK_GRID_HEIGHT) + y;
            const worldX_3D = (globalTileX * TILE_PX_WIDTH) + (TILE_PX_WIDTH / 2);
            const worldZ_3D = (globalTileY * TILE_PX_HEIGHT) + (TILE_PX_HEIGHT / 2);

            const indexOffset = data.vertexCount;
            for (const index of baseIndices) {
                data.indices.push(index + indexOffset);
            }
            data.vertexCount += 4; 

            for (let i = 0; i < 4; i++) {
                data.positions.push(
                    (basePositions[i*3 + 0] * tileWidth) + worldX_3D,  // X
                    (basePositions[i*3 + 2] * 1.0) + worldYLevel,       // Y (era Z)
                    (basePositions[i*3 + 1] * tileHeight) + worldZ_3D  // Z (era Y)
                );
                data.normals.push(
                    baseNormals[i*3 + 0], // 0.0
                    baseNormals[i*3 + 2], // 1.0
                    baseNormals[i*3 + 1]  // 0.0
                );
                data.uvs.push(baseUvs[i*2 + 0], baseUvs[i*2 + 1]);
            }
        }
    }

    // 4. Crear las mallas fusionadas (una por material)
    const chunkGroup = new THREE.Group(); // Usamos un grupo para almacenar las mallas
    
    for (const [tileKey, data] of geometriesData.entries()) {
        let material = materialCache.get(tileKey);
        if (!material) {
            const img = IMAGES[tileKey];
            if (img) {
                let texture = textureCache.get(tileKey);
                if (!texture) {
                    texture = new THREE.Texture(img);
                    texture.colorSpace = THREE.SRGBColorSpace;
                    texture.needsUpdate = true;
                    textureCache.set(tileKey, texture);
                }
                // ¡EL TERRENO SIGUE USANDO MeshLambertMaterial!
                material = new THREE.MeshLambertMaterial({
                    map: texture,
                    transparent: false,
                    side: THREE.DoubleSide // Arreglo para texturas negras
                });
                materialCache.set(tileKey, material);
            } else {
                continue; 
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
        geometry.setIndex(data.indices);
        
        const mesh = new THREE.Mesh(geometry, material);
        chunkGroup.add(mesh);
    }

    // 5. Añadir el grupo completo a la escena y al map
    scene.add(chunkGroup);
    chunkTerrainMeshes.set(chunkKey, chunkGroup);
}

/**
 * ¡FUNCIÓN CRÍTICA REESCRITA!
 * Elimina el mesh estático de un chunk y LIBERA LA MEMORIA.
 * Se llama desde world.js cuando un chunk se descarga.
 */
export function removeChunkTerrain(chunkKey) {
    const chunkGroup = chunkTerrainMeshes.get(chunkKey);
    if (chunkGroup) {
        scene.remove(chunkGroup);
        chunkGroup.children.forEach(mesh => {
            if (mesh.geometry) {
                mesh.geometry.dispose();
            }
        });
        chunkTerrainMeshes.delete(chunkKey);
    }
}

/**
 * ¡MODIFICADO! Obtiene o crea un InstancedMesh.
 * Ahora crea BoxGeometry, PlaneGeometry, o una Geometría en Cruz
 * basado en 'renderMode' de la definición de la entidad.
 */
function getOrCreateInstancedMesh(key, img) {
    
    const template = ENTITY_DATA[key];
    // --- ¡NUEVO! Leer renderMode ---
    const renderMode = template?.renderMode || 'billboard';
    
    // La clave de caché debe ser única para geometría/material
    const cacheKey = `${renderMode}_${key}`;
    let geometryKey;

    // Determinar la clave de geometría
    switch(renderMode) {
        case 'cube':
            geometryKey = 'box_1x1'; // Geometría base de cubo (1x1x1)
            break;
        case 'cross':
            geometryKey = 'cross_1x1'; // Geometría base en cruz (1x1x1)
            break;
        // --- AÑADIDO ---
        case 'flat':
        // --- FIN AÑADIDO ---
        case 'billboard':
        default:
            geometryKey = 'plane_1x1'; // Geometría base de plano (1x1)
            break;
    }


    if (instancedMeshPool.has(cacheKey)) {
        return instancedMeshPool.get(cacheKey);
    }

    // 1. Textura (Cacheada)
    let texture = textureCache.get(key);
    if (!texture) {
        texture = new THREE.Texture(img);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        textureCache.set(key, texture);
    }
    
    // 2. Geometría (¡MODIFICADA!)
    let geometry = geometryCache.get(geometryKey);
    if (!geometry) {
        // --- MODIFICADO ---
        // La switch ahora usa geometryKey para agrupar 'flat' y 'billboard'
        switch (geometryKey) {
            case 'box_1x1':
                geometry = new THREE.BoxGeometry(1, 1, 1);
                break;
            
            case 'cross_1x1':
                // ¡NUEVA Lógica de Cruz!
                const positions = [
                    -0.5, -0.5, 0.0,  // plano 1 (frontal)
                     0.5, -0.5, 0.0,
                     0.5,  0.5, 0.0,
                    -0.5,  0.5, 0.0,
                     
                     0.0, -0.5, -0.5, // plano 2 (lateral)
                     0.0, -0.5,  0.5,
                     0.0,  0.5,  0.5,
                     0.0,  0.5, -0.5,
                ];
                const uvs = [
                    0.0, 0.0,  // plano 1
                    1.0, 0.0,
                    1.0, 1.0,
                    0.0, 1.0,
                    
                    0.0, 0.0,  // plano 2
                    1.0, 0.0,
                    1.0, 1.0,
                    0.0, 1.0,
                ];
                const indices = [
                    0, 1, 2,  0, 2, 3, // cara 1
                    4, 5, 6,  4, 6, 7  // cara 2
                ];
                
                geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
                geometry.setIndex(indices);
                geometry.computeVertexNormals(); // Necesario
                break;

            case 'plane_1x1': // Usado por 'billboard' y 'flat'
            default:
                geometry = new THREE.PlaneGeometry(1, 1);
                break;
        }
        // --- FIN MODIFICADO ---
        geometryCache.set(geometryKey, geometry);
    }
    
    // 3. Material (Cacheado)
    let material = materialCache.get(cacheKey); // Usar cacheKey
    if (!material) {
        
        if (renderMode === 'cube') {
            material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: false
            });
        } else {
            // Material para Sprites (billboard, cross, flat)
            material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                alphaTest: 0.1,
                side: THREE.DoubleSide // Esencial para 'cross', 'billboard' y 'flat'
            });
        }
        
        materialCache.set(cacheKey, material);
    }

    // 4. Crear InstancedMesh
    const MAX_INSTANCES_PER_TYPE = 33000;
    const instancedMesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES_PER_TYPE);
    instancedMesh.count = 0;
    instancedMesh.frustumCulled = false;
    scene.add(instancedMesh);
    instancedMeshPool.set(cacheKey, instancedMesh); // Usar cacheKey
    
    console.log(`InstancedMesh creado para: ${key} (Modo: ${renderMode})`);
    return instancedMesh;
}


/**
 * Dibuja el frame 3D.
 * ¡MODIFICADO! Para posicionar y escalar los 4 modos de render.
 */
export function render3DFrame(playerX, playerY, playerZ, objectsToRender, timeOfDay, deltaTime) { // <-- ¡deltaTime AÑADIDO!
    if (!renderer) return; 
renderer.clear(true, true, true); // <--- CAMBIA ESTA LÍNEA    // --- Actualizar plano de raycasting ---
    const worldYLevel = playerZ * TILE_PX_HEIGHT;
    if (raycastPlane) {
        raycastPlane.position.y = worldYLevel;
    }
const hoveredObject = objectsToRender.find(obj => obj.isHovered);

    if (hoveredObject) {
        selectorMesh.position.set(
            hoveredObject.x,
            worldYLevel + 1,    // Altura (justo sobre el suelo)
            hoveredObject.y     // Coordenada Z (usamos 'y' 2D)
        );
        selectorMesh.visible = true;
    } else {
        selectorMesh.visible = false; // Ocultar si no hay nada
    }
    // --- ¡NUEVO! 1. Interpolar Rotación de Cámara ---
    const rotationDifference = targetCameraRotationY - currentCameraRotationY;
    
    if (Math.abs(rotationDifference) > 0.0001) { 
         currentCameraRotationY += rotationDifference * CAMERA_ROTATION_SPEED * deltaTime;
    } else {
         currentCameraRotationY = targetCameraRotationY; 
    }

    // --- 1. Mover la Cámara --- (Ahora es paso 2)
    const playerWorldZ_3D = playerY;
    const target = new THREE.Vector3(playerX, worldYLevel, playerWorldZ_3D);

    const horizontalOffset = currentCameraDistance * Math.cos(CAMERA_ANGLE_X);
    const verticalOffset = currentCameraDistance * Math.sin(-CAMERA_ANGLE_X);

    const camX = target.x + (horizontalOffset * Math.sin(currentCameraRotationY));
    const camZ = target.z + (horizontalOffset * Math.cos(currentCameraRotationY));
    const camY = target.y + verticalOffset;

    camera.position.set(camX, camY, camZ);
    camera.lookAt(target);
// --- 3. Actualizar Luces y Tinte ---
    const entityTint = updateLighting(timeOfDay); 

    // --- 4. Reseteo de InstancedMesh ---
    for (const mesh of instancedMeshPool.values()) {
        mesh.count = 0;
    }

    // --- 5. ¡LÓGICA DE RENDER MODIFICADA! ---
    
    // --- 5a. Encontrar al jugador y a las "otras" entidades ---
    const playerObject = objectsToRender.find(obj => obj.uid === 'PLAYER');
    // Filtramos al jugador Y a los otros jugadores (que también usan 'PLAYER' key)
    const otherObjects = objectsToRender.filter(obj => obj.entityKey !== 'PLAYER');

    // --- 5b. Actualizar el playerMesh (Nuestro jugador) ---
if (playerObject && playerMesh) {        // 1. Actualizar Posición y Rotación
        playerMesh.position.x = playerObject.x;
        playerMesh.position.z = playerObject.y; // Y 2D es Z 3D
        playerMesh.rotation.y = playerObject.rotationY; // Sincronizar rotación
        
        // 2. Actualizar Animación (Altura Y y Rebote)
        // (playerObject tiene x, y, z, vx, vy, rotationY)
updatePlayerAnimation(playerMesh, playerObject, deltaTime);        
        
        // 3. Aplicar tinte de luz
        // --- ¡BLOQUE ELIMINADO! ---
        // El playerMesh ahora usa MeshLambertMaterial y es iluminado
        // automáticamente por las luces de la escena (ambient y directional).
        /*
        playerMesh.traverse((child) => {
            if (child.isMesh && child.material.userData && child.material.userData.baseColor) {
                child.material.color.copy(child.material.userData.baseColor).multiply(entityTint);
            }
        });
        */
    }

    // --- 5c. Agrupar OTRAS entidades (NPCs, árboles, rocas, otros jugadores) ---
    const dynamicObjectsByKey = new Map();
    for (const obj of otherObjects) {
        if (!obj.entityKey) continue; 
        if (!dynamicObjectsByKey.has(obj.entityKey)) {
            dynamicObjectsByKey.set(obj.entityKey, []); 
        }
        dynamicObjectsByKey.get(obj.entityKey).push(obj); 
    }

    // --- 5d. Actualizar las matrices de cada InstancedMesh (sin cambios) ---
    for (const [key, objects] of dynamicObjectsByKey.entries()) {
        
        const img = IMAGES[objects[0].imageKey]; 
        if (!img || !img.naturalWidth) continue; 

        const instancedMesh = getOrCreateInstancedMesh(key, img);
        instancedMesh.material.color.set(entityTint);
        instancedMesh.visible = true;

        const template = ENTITY_DATA[key]; 
        const renderMode = template?.renderMode || 'billboard';

        let instanceIndex = 0;
        for (instanceIndex = 0; instanceIndex < objects.length; instanceIndex++) {
            if (instanceIndex >= instancedMesh.instanceCount) break; 
            const obj = objects[instanceIndex];

            const worldX_3D = obj.x;
            const worldZ_3D = obj.y;
            
            // ... (El switch(renderMode) para 'cube', 'cross', 'flat', 'billboard' no cambia) ...
            switch (renderMode) {
                
                case 'cube':
                    const collisionComp = template?.components.find(c => c.type === 'Collision');
                    const boxWidth = collisionComp?.args[1]?.width || TILE_PX_WIDTH;
                    const boxHeight = img.naturalHeight; 
                    
                    const worldY_3D_Entity = (boxHeight / 2) + worldYLevel; 
                    
                    tempMatrix.makeScale(boxWidth, boxHeight, boxWidth); 
                    tempMatrix.setPosition(worldX_3D, worldY_3D_Entity, worldZ_3D);
                    break;

                case 'cross':
                    const worldY_3D_Cross = (img.naturalHeight / 2) + worldYLevel;
                    tempMatrix.makeScale(img.naturalWidth, img.naturalHeight, img.naturalWidth);
                    tempMatrix.setPosition(worldX_3D, worldY_3D_Cross, worldZ_3D);
                    break;
                
                case 'flat':
                    const worldY_3D_Flat = worldYLevel + 1;
                    tempPosition.set(worldX_3D, worldY_3D_Flat, worldZ_3D);
                    tempRotation.set(-Math.PI / 2, 0, 0, 'YXZ');
                    tempQuaternion.setFromEuler(tempRotation);
                    tempScale.set(img.naturalWidth, img.naturalHeight, 1);
                    tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
                    break;

                case 'billboard':
                default:
                    const isDynamic = template?.components.some(c => c.type === 'MovementAI') || key === 'PLAYER';
                    const worldY_3D_Plane = (img.naturalHeight / 2) + worldYLevel; 
                    tempPosition.set(worldX_3D, worldY_3D_Plane, worldZ_3D);

                    let yRotation = 0;
                    if (isDynamic) {
                        yRotation = obj.rotationY || 0;
                    } else {
                        yRotation = currentCameraRotationY;
                    }
                    tempRotation.set(0, yRotation, 0, 'YXZ'); 
                    tempQuaternion.setFromEuler(tempRotation);

                    let scaleX_Plane = img.naturalWidth;
                    tempScale.set(scaleX_Plane, img.naturalHeight, 1);
                    tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
                    break;
            }
            
            instancedMesh.setMatrixAt(instanceIndex, tempMatrix);
        }
        
        instancedMesh.count = instanceIndex;
        instancedMesh.instanceMatrix.needsUpdate = true;
    }

    // --- 7. Renderizar la Escena ---
    renderer.render(scene, camera); 
}