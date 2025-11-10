// --- engine_3d.js ---
// ¡MODIFICADO!
// - Implementa THREE.InstancedMesh para entidades dinámicas (Optimización #1).
// - Cambia entidades a MeshBasicMaterial (Optimización #3).
// - El "pool" antiguo (activeEntities) ha sido eliminado.
// - updateLighting ahora tiñe los materiales de las entidades.
// --- ¡FIX v4! Reescribe el bucle de render para resetear InstancedMeshes,
// --- eliminando el "Bucle C" y previniendo el "stuck count" bug.

import * as THREE from 'three';
import { TILE_PX_WIDTH, TILE_PX_HEIGHT, IMAGES, CHUNK_GRID_WIDTH, CHUNK_GRID_HEIGHT } from './logic.js';
// (BufferGeometryUtils no se usará, la fusión manual ya está implementada)

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let $canvas;
let renderer, scene, camera, ambientLight, directionalLight;
let raycastPlane; 

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


// ¡NUEVO! Almacén para los meshes estáticos del terreno (chunkKey -> THREE.Group)
const chunkTerrainMeshes = new Map();


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

    // 4. Luces (SOLO PARA EL TERRENO)
    ambientLight = new THREE.AmbientLight(0xffffff, 0.7); 
    scene.add(ambientLight);
    directionalLight = new THREE.DirectionalLight(0xfff8e1, 0.5); 
    directionalLight.position.set(0, 10, 5); //
    scene.add(directionalLight);

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

/**
 * Actualiza la intensidad de las luces 3D (terreno) y calcula el tinte (entidades).
 * @returns {THREE.Color} El color de tinte para las entidades.
 */
function updateLighting(timeOfDay) {
    if (!ambientLight || !directionalLight) return tempColor.setRGB(1, 1, 1);

    const brightness = (Math.cos((timeOfDay - 0.5) * 2 * Math.PI) + 1) / 2;

    // 1. Actualizar luces del TERRENO
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
 * ¡NUEVA FUNCIÓN HELPER!
 * Obtiene o crea un InstancedMesh para un tipo de entidad.
 */
function getOrCreateInstancedMesh(key, img) {
    if (instancedMeshPool.has(key)) {
        return instancedMeshPool.get(key);
    }

    // 1. Textura (Cacheada)
    let texture = textureCache.get(key);
    if (!texture) {
        texture = new THREE.Texture(img);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        textureCache.set(key, texture);
    }
    
    // 2. Geometría (Cacheada)
    let geometry = geometryCache.get('plane_1x1');
    if (!geometry) {
        geometry = new THREE.PlaneGeometry(1, 1);
        geometryCache.set('plane_1x1', geometry);
    }
    
    // 3. Material (Cacheado)
    // --- ¡OPTIMIZACIÓN! Usamos MeshBasicMaterial ---
    let material = materialCache.get(key);
    if (!material) {
        material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.1,
            side: THREE.DoubleSide
        });
        materialCache.set(key, material);
    }

    // 4. Crear InstancedMesh
    const MAX_INSTANCES_PER_TYPE = 1000; // Un número grande
    const instancedMesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES_PER_TYPE);
    instancedMesh.count = 0; // Empezar sin dibujar nada
    instancedMesh.frustumCulled = false;
    scene.add(instancedMesh);
    instancedMeshPool.set(key, instancedMesh);
    
    console.log(`InstancedMesh creado para: ${key}`);
    return instancedMesh;
}


/**
 * Dibuja el frame 3D.
 * ¡FUNCIÓN REESCRITA PARA USAR INSTANCEDMESH!
 */
export function render3DFrame(playerX, playerY, playerZ, objectsToRender, timeOfDay) { 
    if (!renderer) return;
    
    // --- Actualizar plano de raycasting ---
    const worldYLevel = playerZ * TILE_PX_HEIGHT;
    if (raycastPlane) {
        raycastPlane.position.y = worldYLevel;
    }

    // --- 1. Mover la Cámara ---
    const playerWorldZ_3D = playerY;
    const target = new THREE.Vector3(playerX, worldYLevel, playerWorldZ_3D);

    const horizontalOffset = currentCameraDistance * Math.cos(CAMERA_ANGLE_X);
    const verticalOffset = currentCameraDistance * Math.sin(-CAMERA_ANGLE_X);

    const camX = target.x + (horizontalOffset * Math.sin(currentCameraRotationY));
    const camZ = target.z + (horizontalOffset * Math.cos(currentCameraRotationY));
    const camY = target.y + verticalOffset;

    camera.position.set(camX, camY, camZ);
    camera.lookAt(target);

    // --- 2. Actualizar Luces y Tinte ---
    // (Debe llamarse ANTES de actualizar materiales de instancias)
    const entityTint = updateLighting(timeOfDay); 

    // --- 3. ¡NUEVA LÓGICA DE RESETEO! ---
    // Resetea el contador de *todos* los meshes a 0 al inicio del frame.
    // Esto previene el error de "atascarse" (stuck count).
    for (const mesh of instancedMeshPool.values()) {
        mesh.count = 0;
    }
    // --- FIN DE LÓGICA DE RESETEO ---

    // --- 4. Agrupar objetos visibles por 'key' (tipo de entidad) ---
    const dynamicObjectsByKey = new Map();
    for (const obj of objectsToRender) {
        // (objectsToRender ya no contiene suelo, solo entidades)
        if (!obj.key) continue;

        if (!dynamicObjectsByKey.has(obj.key)) {
            dynamicObjectsByKey.set(obj.key, []);
        }
        dynamicObjectsByKey.get(obj.key).push(obj);
    }

    // --- 5. Actualizar las matrices de cada InstancedMesh ---
    for (const [key, objects] of dynamicObjectsByKey.entries()) {
        const img = IMAGES[key];
        
        // Esta comprobación ahora es segura: si falla, el 'count'
        // simplemente se queda en 0 (del reseteo) y no se dibuja.
        if (!img || !img.naturalWidth) continue; 

        // Obtener/Crear el InstancedMesh para este tipo de entidad
        const instancedMesh = getOrCreateInstancedMesh(key, img);

        // Aplicar el tinte de día/noche
        instancedMesh.material.color.set(entityTint);
        instancedMesh.visible = true; // Asegurarse de que sea visible

        let instanceIndex = 0;
        for (instanceIndex = 0; instanceIndex < objects.length; instanceIndex++) {
            // Comprobar contra la capacidad total
            if (instanceIndex >= instancedMesh.instanceCount) break; 
            
            const obj = objects[instanceIndex];

            // Calcular posición y escala
            const worldX_3D = obj.x;
            const worldZ_3D = obj.y;
            const worldY_3D_Entity = (img.naturalHeight / 2) + worldYLevel; 
            
            const scaleX = (obj.facing === 'left') ? -img.naturalWidth : img.naturalWidth;
            const scaleY = img.naturalHeight;
            
            // Reutilizar la matriz temporal
            tempMatrix.makeScale(scaleX, scaleY, 1);
            tempMatrix.setPosition(worldX_3D, worldY_3D_Entity, worldZ_3D);

            // Escribir la matriz en el buffer de instancias
            instancedMesh.setMatrixAt(instanceIndex, tempMatrix);
        }
        
        // Definir cuántas instancias se van a dibujar
        instancedMesh.count = instanceIndex;
        // Marcar el buffer de matrices para que se actualice en la GPU
        instancedMesh.instanceMatrix.needsUpdate = true;
    }

    // --- 6. Ocultar InstancedMeshes (Bucle C) ---
    // ¡ESTE BUCLE YA NO ES NECESARIO!
    // Los meshes que no estaban en 'dynamicObjectsByKey'
    // ya tienen 'count = 0' gracias al reseteo del paso 3.
    /*
    for (const [key, mesh] of instancedMeshPool.entries()) {
        if (!updatedMeshKeys.has(key)) {
            mesh.count = 0;
        }
    }
    */

    // --- 7. Renderizar la Escena ---
    renderer.render(scene, camera); 
}