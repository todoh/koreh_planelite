// --- engine_3d.js ---
// ¡MODIFICADO! Integración de renderizado de modelos 3D desde JSON.
// ¡OPTIMIZADO! Añadido Frustum Culling para instancias.

import * as THREE from 'three';
import { TILE_PX_WIDTH, TILE_PX_HEIGHT, IMAGES, CHUNK_GRID_WIDTH, CHUNK_GRID_HEIGHT, ENTITY_DATA } from './logic.js';
import { createPlayerMesh } from './player_model.js';
import { updatePlayerAnimation } from './player_animation.js';
import { getModelDefinition } from './models/model_loader.js'; // <-- ¡NUEVA IMPORTACIÓN!

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

// Pool para sprites simples (billboard, cube, etc.)
const instancedMeshPool = new Map();

// ¡NUEVO! Pool para modelos compuestos 3D (Key -> Array de InstancedMeshes)
const instancedModelGroups = new Map(); 

// Helpers
const tempMatrix = new THREE.Matrix4();
const tempColor = new THREE.Color();
const tempPosition = new THREE.Vector3();
const tempRotation = new THREE.Euler();
const tempQuaternion = new THREE.Quaternion();
const tempScale = new THREE.Vector3();
const entityMatrix = new THREE.Matrix4(); // Para calcular la matriz base de la entidad

// --- ¡NUEVO! Helpers para Culling ---
// El Frustum es el "cono de visión" de la cámara.
const frustum = new THREE.Frustum();
// Matriz para calcular el frustum
const projScreenMatrix = new THREE.Matrix4();
// --- FIN DE NUEVO ---

// Map de terrenos
const chunkTerrainMeshes = new Map();
export let playerMesh = null;

// --- ESTADO DE CÁMARA ---
const CAMERA_ANGLE_X = -Math.PI / 4; 
const BASE_CAMERA_DISTANCE = 1000; 
let currentCameraDistance = BASE_CAMERA_DISTANCE;
let currentCameraRotationY = 0; 
let targetCameraRotationY = 0;  
const CAMERA_ROTATION_SPEED = 5.0; 

const ZOOM_STEP = 150;
const MIN_ZOOM_DISTANCE = 210;
const MAX_ZOOM_DISTANCE = 1500;

export function initialize3DEngine($canvasElement) {
    $canvas = $canvasElement;
    renderer = new THREE.WebGLRenderer({ canvas: $canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize($canvas.clientWidth, $canvas.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.clear(true, true, true); 
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    const fov = 50;
    const aspect = $canvas.clientWidth / $canvas.clientHeight;
    camera = new THREE.PerspectiveCamera(fov, aspect, 1, BASE_CAMERA_DISTANCE * 4);

    ambientLight = new THREE.AmbientLight(0xffffff, 0.7); 
    scene.add(ambientLight);
    directionalLight = new THREE.DirectionalLight(0xfff8e1, 0.5); 
    directionalLight.position.set(0, 10, 5); 
    scene.add(directionalLight);

    playerMesh = createPlayerMesh();    
    scene.add(playerMesh);

    const raycastGeometry = new THREE.PlaneGeometry(100000, 100000); 
    const raycastMaterial = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
    raycastPlane = new THREE.Mesh(raycastGeometry, raycastMaterial);
    raycastPlane.rotation.x = -Math.PI / 2;
    scene.add(raycastPlane);

    const selectorGeo = new THREE.RingGeometry(TILE_PX_WIDTH * 0.45, TILE_PX_WIDTH * 0.55, 24);
    const selectorMat = new THREE.MeshBasicMaterial({ color: 0x00FFFF, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    selectorMesh = new THREE.Mesh(selectorGeo, selectorMat);
    selectorMesh.rotation.x = -Math.PI / 2; 
    selectorMesh.visible = false; 
    scene.add(selectorMesh);

    window.addEventListener('resize', resize3DEngine);
    resize3DEngine();
}

export function handle3DZoom(zoomIn) {
    if (zoomIn) currentCameraDistance = Math.max(MIN_ZOOM_DISTANCE, currentCameraDistance - ZOOM_STEP);
    else currentCameraDistance = Math.min(MAX_ZOOM_DISTANCE, currentCameraDistance + ZOOM_STEP);
}

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

export function handle3DCameraRotate(rotateRight) {
    const rotationStep = Math.PI / 4;
    if (rotateRight) targetCameraRotationY += rotationStep;
    else targetCameraRotationY -= rotationStep;
}

function resize3DEngine() {
    const width = $canvas.clientWidth;
    const height = $canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

function updateLighting(timeOfDay) {
    if (!ambientLight || !directionalLight) return tempColor.setRGB(1, 1, 1);
    const brightness = (Math.cos((timeOfDay - 0.5) * 2 * Math.PI) + 1) / 2;
    ambientLight.intensity = 0.3 + (0.7) * brightness;
    directionalLight.intensity = 0.1 + (1.4) * brightness;
    directionalLight.position.x = Math.cos((timeOfDay - 0.5) * Math.PI) * 10; 
    directionalLight.position.y = brightness * 10 + 2; 
    const tintValue = 0.4 + brightness * 0.6;
    tempColor.setRGB(tintValue, tintValue, tintValue);
    return tempColor;
}

export function addChunkTerrain(chunkKey, chunkData) {
    if (chunkTerrainMeshes.has(chunkKey)) return;
    const [chunkX, chunkY, chunkZ] = chunkKey.split(',').map(Number);
    const worldYLevel = chunkZ * TILE_PX_HEIGHT;
    const geometriesData = new Map();
    
    const basePositions = [-0.5, -0.5, 0.0, 0.5, -0.5, 0.0, 0.5, 0.5, 0.0, -0.5, 0.5, 0.0];
    const baseUvs = [0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0];
    const baseNormals = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
    const baseIndices = [0, 1, 2, 0, 2, 3];
    const tileWidth = TILE_PX_WIDTH;
    const tileHeight = TILE_PX_HEIGHT;

    for (let y = 0; y < CHUNK_GRID_HEIGHT; y++) {
        for (let x = 0; x < CHUNK_GRID_WIDTH; x++) {
            const tileKey = (chunkData.terrain[y] && chunkData.terrain[y][x]) ? chunkData.terrain[y][x] : "DIRT";
            if (!geometriesData.has(tileKey)) geometriesData.set(tileKey, { positions: [], uvs: [], normals: [], indices: [], vertexCount: 0 });
            const data = geometriesData.get(tileKey);

            const globalTileX = (chunkX * CHUNK_GRID_WIDTH) + x;
            const globalTileY = (chunkY * CHUNK_GRID_HEIGHT) + y;
            const worldX_3D = (globalTileX * TILE_PX_WIDTH) + (TILE_PX_WIDTH / 2);
            const worldZ_3D = (globalTileY * TILE_PX_HEIGHT) + (TILE_PX_HEIGHT / 2);

            const indexOffset = data.vertexCount;
            for (const index of baseIndices) data.indices.push(index + indexOffset);
            data.vertexCount += 4; 

            for (let i = 0; i < 4; i++) {
                data.positions.push((basePositions[i*3]*tileWidth)+worldX_3D, (basePositions[i*3+2]*1.0)+worldYLevel, (basePositions[i*3+1]*tileHeight)+worldZ_3D);
                data.normals.push(baseNormals[i*3], baseNormals[i*3+2], baseNormals[i*3+1]);
                data.uvs.push(baseUvs[i*2], baseUvs[i*2+1]);
            }
        }
    }

    const chunkGroup = new THREE.Group(); 
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
                material = new THREE.MeshLambertMaterial({ map: texture, transparent: false, side: THREE.DoubleSide });
                materialCache.set(tileKey, material);
            } else continue; 
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
        geometry.setIndex(data.indices);
        chunkGroup.add(new THREE.Mesh(geometry, material));
    }
    scene.add(chunkGroup);
    chunkTerrainMeshes.set(chunkKey, chunkGroup);
}

export function removeChunkTerrain(chunkKey) {
    const chunkGroup = chunkTerrainMeshes.get(chunkKey);
    if (chunkGroup) {
        scene.remove(chunkGroup);
        chunkGroup.children.forEach(mesh => { if (mesh.geometry) mesh.geometry.dispose(); });
        chunkTerrainMeshes.delete(chunkKey);
    }
}

function getOrCreateInstancedMesh(key, img) {
    const template = ENTITY_DATA[key];
    const renderMode = template?.renderMode || 'billboard';
    const cacheKey = `${renderMode}_${key}`;
    let geometryKey;

    switch(renderMode) {
        case 'cube': geometryKey = 'box_1x1'; break;
        case 'cross': geometryKey = 'cross_1x1'; break;
        case 'flat':
        case 'billboard':
        default: geometryKey = 'plane_1x1'; break;
    }

    if (instancedMeshPool.has(cacheKey)) return instancedMeshPool.get(cacheKey);

    let texture = textureCache.get(key);
    if (!texture) {
        texture = new THREE.Texture(img);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        textureCache.set(key, texture);
    }
    
    let geometry = geometryCache.get(geometryKey);
    if (!geometry) {
        switch (geometryKey) {
            case 'box_1x1': geometry = new THREE.BoxGeometry(1, 1, 1); break;
            case 'cross_1x1': 
                const positions = [-0.5, -0.5, 0.0, 0.5, -0.5, 0.0, 0.5, 0.5, 0.0, -0.5, 0.5, 0.0, 0.0, -0.5, -0.5, 0.0, -0.5, 0.5, 0.0, 0.5, 0.5, 0.0, 0.5, -0.5];
                const uvs = [0,0, 1,0, 1,1, 0,1, 0,0, 1,0, 1,1, 0,1];
                const indices = [0,1,2, 0,2,3, 4,5,6, 4,6,7];
                geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
                geometry.setIndex(indices);
                geometry.computeVertexNormals();
                break;
            case 'plane_1x1': default: geometry = new THREE.PlaneGeometry(1, 1); break;
        }
        geometryCache.set(geometryKey, geometry);
    }
    
    let material = materialCache.get(cacheKey); 
    if (!material) {
        if (renderMode === 'cube') material = new THREE.MeshBasicMaterial({ map: texture, transparent: false });
        else material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide });
        materialCache.set(cacheKey, material);
    }

    const instancedMesh = new THREE.InstancedMesh(geometry, material, 33000);
    instancedMesh.count = 0;
    // ¡MODIFICADO! Dejamos frustumCulled en false para el *objeto* InstancedMesh,
    // pero haremos culling manual de las *instancias*.
    instancedMesh.frustumCulled = false;
    scene.add(instancedMesh);
    instancedMeshPool.set(cacheKey, instancedMesh); 
    return instancedMesh;
}

// --- ¡NUEVO! Helper para crear el grupo de meshes para un modelo 3D cargado ---
function getOrCreateInstancedModelGroup(key, modelDef) {
    if (instancedModelGroups.has(key)) {
        return instancedModelGroups.get(key);
    }

    const groupMeshes = [];
    const MAX_INSTANCES = 10000; // Límite razonable

    // Crear un InstancedMesh por cada parte del modelo
    for (const part of modelDef) {
        const instancedMesh = new THREE.InstancedMesh(part.geometry, part.material, MAX_INSTANCES);
        instancedMesh.count = 0;
        instancedMesh.frustumCulled = false; // Optimización: culling manual de instancias
        scene.add(instancedMesh);
        groupMeshes.push(instancedMesh);
    }

    instancedModelGroups.set(key, groupMeshes);
    console.log(`Grupo 3D instanciado creado para: ${key} (${groupMeshes.length} partes)`);
    return groupMeshes;
}

export function render3DFrame(playerX, playerY, playerZ, objectsToRender, timeOfDay, deltaTime) {
    if (!renderer) return; 
    renderer.clear(true, true, true); 
    
    const worldYLevel = playerZ * TILE_PX_HEIGHT;
    if (raycastPlane) raycastPlane.position.y = worldYLevel;

    const hoveredObject = objectsToRender.find(obj => obj.isHovered);
    if (hoveredObject) {
        selectorMesh.position.set(hoveredObject.x, worldYLevel + 1, hoveredObject.y);
        selectorMesh.visible = true;
    } else {
        selectorMesh.visible = false; 
    }

    const rotationDifference = targetCameraRotationY - currentCameraRotationY;
    if (Math.abs(rotationDifference) > 0.0001) currentCameraRotationY += rotationDifference * CAMERA_ROTATION_SPEED * deltaTime;
    else currentCameraRotationY = targetCameraRotationY; 

    const playerWorldZ_3D = playerY;
    const target = new THREE.Vector3(playerX, worldYLevel, playerWorldZ_3D);
    const horizontalOffset = currentCameraDistance * Math.cos(CAMERA_ANGLE_X);
    const verticalOffset = currentCameraDistance * Math.sin(-CAMERA_ANGLE_X);
    camera.position.set(target.x + (horizontalOffset * Math.sin(currentCameraRotationY)), target.y + verticalOffset, target.z + (horizontalOffset * Math.cos(currentCameraRotationY)));
    camera.lookAt(target);

   camera.updateMatrixWorld(); // Asegura que las matrices de la cámara estén actualizadas

    // --- ¡MODIFICACIÓN! ---
    // 1. Clonamos la matriz de proyección de la cámara
    const wideProjectionMatrix = camera.projectionMatrix.clone();

    // 2. Definimos qué tan grande queremos el buffer.
    // Un valor < 1.0 "agranda" la vista (más buffer).
    // Un valor > 1.0 la "encoge" (menos buffer).
    // 0.9 = ~10% de buffer adicional
    const CULLING_BUFFER_SCALE = 0.7; 
    
    // 3. Escalamos los ejes X e Y de la matriz de proyección
    // Esto efectivamente "ensancha" el campo de visión (FOV) solo para el cálculo del frustum.
    wideProjectionMatrix.elements[0] *= CULLING_BUFFER_SCALE; // Escala eje X
    wideProjectionMatrix.elements[5] *= CULLING_BUFFER_SCALE; // Escala eje Y

    // 4. Calculamos la matriz final usando nuestra proyección "ancha"
    projScreenMatrix.multiplyMatrices(wideProjectionMatrix, camera.matrixWorldInverse);
    
    // 5. Creamos el frustum a partir de la matriz ancha
    frustum.setFromProjectionMatrix(projScreenMatrix);
    // --- FIN DE MODIFICACIÓN ---

    const entityTint = updateLighting(timeOfDay); 

    // --- RESETEO DE TODOS LOS MESHES ---
    for (const mesh of instancedMeshPool.values()) mesh.count = 0;
    
    // ¡NUEVO! Resetear meshes de modelos 3D
    for (const group of instancedModelGroups.values()) {
        for (const mesh of group) mesh.count = 0;
    }

    const playerObject = objectsToRender.find(obj => obj.uid === 'PLAYER');
    const otherObjects = objectsToRender.filter(obj => obj.entityKey !== 'PLAYER');

    if (playerObject && playerMesh) {        
        playerMesh.position.x = playerObject.x;
        playerMesh.position.z = playerObject.y; 
        playerMesh.rotation.y = playerObject.rotationY; 
        updatePlayerAnimation(playerMesh, playerObject, deltaTime);        
    }

    const dynamicObjectsByKey = new Map();
    for (const obj of otherObjects) {
        if (!obj.entityKey) continue; 
        if (!dynamicObjectsByKey.has(obj.entityKey)) dynamicObjectsByKey.set(obj.entityKey, []); 
        dynamicObjectsByKey.get(obj.entityKey).push(obj); 
    }

    // --- BUCLE DE RENDERIZADO ---
    for (const [key, objects] of dynamicObjectsByKey.entries()) {
        
        const template = ENTITY_DATA[key]; 
        const renderMode = template?.renderMode || 'billboard';

        // --- MODO 3D PERSONALIZADO ---
        if (renderMode === '3d') {
            const modelDef = getModelDefinition(key); // Busca assets/3d/key.json
            
            if (modelDef && modelDef.length > 0) {
                // Si el modelo está cargado, renderizar sus partes
                const groupMeshes = getOrCreateInstancedModelGroup(key, modelDef);
                
                // Calcular matrices para las instancias
                let instanceCount = 0; // ¡Contador de instancias VISIBLES!
                
                for (const obj of objects) {
                    
                    // 1. Calcular Posición (necesaria para el culling)
                    tempPosition.set(obj.x, worldYLevel, obj.y); // Y es 0 base + worldLevel

                    // --- ¡OPTIMIZACIÓN #1: FRUSTUM CULLING! ---
                    // Comprobamos si el punto central del objeto está en la vista
                    if (!frustum.containsPoint(tempPosition)) {
                        continue; // ¡Saltar este objeto, no es visible!
                    }
                    // --- FIN DE LA OPTIMIZACIÓN ---

                    if (instanceCount >= 10000) break; // Límite del grupo
                    
                    // 2. Calcular Matriz de la Entidad (Mundo)
                    // Posición (ya calculada arriba)
                    
                    // Rotación (Solo Y por ahora)
                    const rotationY = obj.rotationY || 0; 
                    tempRotation.set(0, rotationY, 0, 'YXZ');
                    tempQuaternion.setFromEuler(tempRotation);
                    
                    // Escala (1 por defecto)
                    tempScale.set(1, 1, 1);
                    
                    entityMatrix.compose(tempPosition, tempQuaternion, tempScale);
                    
                    // 3. Asignar matrices a cada parte
                   for (let i = 0; i < groupMeshes.length; i++) {
                        const partDef = modelDef[i];
                        const mesh = groupMeshes[i];
                        
                        // Matriz Final = MatrizEntidad * MatrizLocalParte
                        tempMatrix.multiplyMatrices(entityMatrix, partDef.localMatrix);
                        
                        mesh.setMatrixAt(instanceCount, tempMatrix); // Usar instanceCount

                        // ¡Confirmado que esto está comentado! Es bueno para el rendimiento.
                        // mesh.material.color.set(entityTint); 
                   }
                    
                    instanceCount++; // Incrementar solo si es visible
                }
                
                // Actualizar todos los meshes del grupo
                for (const mesh of groupMeshes) {
                    mesh.count = instanceCount;
                    mesh.instanceMatrix.needsUpdate = true;
                }
                continue; // ¡Saltar lógica estándar!
            } 
            
            if (modelDef === null) {
                continue;
            }
        }

        // --- MODOS ESTÁNDAR (Sprite/Cubo) ---
        const img = IMAGES[objects[0].imageKey]; 
        if (!img || !img.naturalWidth) continue; 

        const instancedMesh = getOrCreateInstancedMesh(key, img);
        instancedMesh.material.color.set(entityTint);
        instancedMesh.visible = true;
        
        // --- ¡BUCLE MODIFICADO CON CULLING! ---
        let visibleInstanceCount = 0; // <-- ¡NUEVO CONTADOR!
        const maxInstances = Math.min(objects.length, 33000); // Límite de capacidad del mesh

        for (let i = 0; i < maxInstances; i++) {
            const obj = objects[i];
            
            // --- ¡OPTIMIZACIÓN #1: FRUSTUM CULLING! ---
            const worldX_3D = obj.x;
            const worldZ_3D = obj.y;
            // Usamos la posición base (en el suelo) para el culling. Es lo suficientemente preciso.
            tempPosition.set(worldX_3D, worldYLevel, worldZ_3D); 
            if (!frustum.containsPoint(tempPosition)) {
                continue; // ¡Saltar este objeto, no es visible!
            }
            // --- FIN DE LA OPTIMIZACIÓN ---
            
            // Si es visible, calculamos la matriz completa
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
                    // tempPosition ya tiene (worldX_3D, worldYLevel, worldZ_3D)
                    tempPosition.setY(worldY_3D_Flat); // Ajustamos Y
                    tempRotation.set(-Math.PI / 2, 0, 0, 'YXZ');
                    tempQuaternion.setFromEuler(tempRotation);
                    tempScale.set(img.naturalWidth, img.naturalHeight, 1);
                    tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
                    break;

                case 'billboard':
                case '3d': // Fallback si el modelo 3d no ha cargado aún
                default:
                    const isDynamic = template?.components.some(c => c.type === 'MovementAI') || key === 'PLAYER';
                    const worldY_3D_Plane = (img.naturalHeight / 2) + worldYLevel; 
                    // tempPosition ya tiene (worldX_3D, worldYLevel, worldZ_3D)
                    tempPosition.setY(worldY_3D_Plane); // Ajustamos Y
                    let yRotation = (isDynamic) ? (obj.rotationY || 0) : currentCameraRotationY;
                    tempRotation.set(0, yRotation, 0, 'YXZ'); 
                    tempQuaternion.setFromEuler(tempRotation);
                    tempScale.set(img.naturalWidth, img.naturalHeight, 1);
                    tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
                    break;
            }
            
            instancedMesh.setMatrixAt(visibleInstanceCount, tempMatrix); // <-- Usar el nuevo contador
            visibleInstanceCount++; // <-- Incrementar solo si es visible
        }
        
        instancedMesh.count = visibleInstanceCount; // <-- Asignar el contador correcto
        instancedMesh.instanceMatrix.needsUpdate = true;
    }
    
    renderer.render(scene, camera); 
}