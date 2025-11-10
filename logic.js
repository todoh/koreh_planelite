// --- logic.js ---
// Contiene el ESTADO (Modelo) y las REGLAS del juego.
// Gestiona el "mundo activo" (chunks en RAM).

import { 
    initializeMetadata, 
    getOrGenerateChunk, 
    saveFusedChunk, 
    IMAGES as AssetImages 
} from './generation.js';
// --- ¡NUEVA IMPORTACIÓN! ---
import { initializeInventory, addItem } from './inventory.js';
// --- ¡NUEVAS IMPORTACIONES DE ENTIDADES! ---
import { 
    getTerrainDefinitions, 
    getEntityDefinitions, 
    createEntity 
} from './entity.js'; 
import { ITEM_DEFINITIONS } from './items.js';
// --- ¡NUEVA IMPORTACIÓN DE VEHÍCULOS! ---
import * as VehicleSystem from './vehicle_logic.js';


// --- CONFIGURACIÓN DEL JUEGO ---
export const TILE_PX_WIDTH = 70;
export const TILE_PX_HEIGHT = 70;
export const CHUNK_GRID_WIDTH = 60;
export const CHUNK_GRID_HEIGHT = 60;
export const CHUNK_PX_WIDTH = CHUNK_GRID_WIDTH * TILE_PX_WIDTH;
export const CHUNK_PX_HEIGHT = CHUNK_GRID_HEIGHT * TILE_PX_HEIGHT;
export const PLAYER_SPEED = 200; // píxeles por segundo

// --- ESTADO DEL JUEGO (GLOBAL) ---
// --- ¡MODIFICADO! ---
export const player = {
    x: 0, y: 0, z: 0, // <-- ¡AÑADIDO Z!
    vx: 0, vy: 0, 
    facing: 'down',
    isMovingToTarget: false,
    targetX: 0, targetY: 0,
    mountedVehicleUid: null,
    currentSpeed: PLAYER_SPEED
};

export const stats = {
    vida: 1000, vidamax: 1000,
    energia: 1000, energiamax: 1000,
};

// --- MUNDO ACTIVO (RAM) ---
// K: "x,y,z"
let activeChunks = new Map(); 
let pendingChunkLoads = new Set(); 
let dirtyChunks = new Set(); 

let otherPlayers = new Map(); 

// --- ¡MODIFICADO! ASSETS Y DEFINICIONES ---
export let TERRAIN_DATA = {}; 
export let ENTITY_DATA = {}; 
export const IMAGES = AssetImages;

// --- ¡NUEVO! Callback para abrir menús ---
let openMenuCallback = (menuId) => {
    console.warn(`openMenuCallback no inicializado. Se intentó abrir: ${menuId}`);
};

// --- INICIALIZACIÓN ---

export async function initializeGameLogic(callbacks) {
    if (callbacks && callbacks.openMenu) {
        openMenuCallback = callbacks.openMenu;
    }

    // 0. Cargar estado del jugador
    // --- ¡MODIFICADO! ---
    try {
        const loadedStateJSON = localStorage.getItem("GAME_STATE_LOAD");
        if (loadedStateJSON) {
            console.log("Detectado estado de jugador cargado. Aplicando...");
            const loadedState = JSON.parse(loadedStateJSON);
            
            if (loadedState) {
                player.x = loadedState.x;
                player.y = loadedState.y;
                player.z = loadedState.z || 0; // <-- ¡CARGAR Z!
                Object.assign(stats, loadedState.stats);
                initializeInventory(loadedState.inventory);
            } else {
                throw new Error("El estado del jugador cargado era nulo.");
            }
            localStorage.removeItem("GAME_STATE_LOAD");
        } else {
            console.log("No hay estado de jugador. Empezando en spawn por defecto.");
            player.x = (30.5 * TILE_PX_WIDTH);
            player.y = (30.5 * TILE_PX_HEIGHT);
            player.z = 0; // <-- ESTABLECER Z INICIAL
            initializeInventory(null);
        }
    } catch (e) {
        console.error("Error al procesar estado de jugador cargado. Usando spawn por defecto.", e);
        player.x = (30.5 * TILE_PX_WIDTH);
        player.y = (30.5 * TILE_PX_HEIGHT);
        player.z = 0;
        localStorage.removeItem("GAME_STATE_LOAD");
        initializeInventory(null);
    }
    
    player.currentSpeed = PLAYER_SPEED;

    // 1. Cargar metadata
    await initializeMetadata(); 
    
    // 2. Obtener definiciones
    TERRAIN_DATA = getTerrainDefinitions();
    ENTITY_DATA = getEntityDefinitions();
    
    // 3. Cargar primeros chunks
    console.log("Cargando área de spawn inicial...");
    await updateActiveChunks(player.x, player.y);
    
    // Esperar a que todas las cargas pendientes iniciales terminen
    const loadPromises = Array.from(pendingChunkLoads).map(key =>
        new Promise(resolve => {
            const interval = setInterval(() => {
                if (activeChunks.has(key)) {
                    clearInterval(interval);
                    resolve();
                }
            }, 50);
        })
    );
    await Promise.all(loadPromises);
    
    console.log("¡Área de spawn lista!");
}

// --- GESTIÓN DE CHUNKS ---

// --- ¡MODIFICADO! ---
export function updateActiveChunks(playerX, playerY) {
    const playerChunkX = Math.floor(playerX / CHUNK_PX_WIDTH);
    const playerChunkY = Math.floor(playerY / CHUNK_PX_HEIGHT);
    const playerChunkZ = player.z; // <-- ¡OBTENER Z ACTUAL!

    // 1. Cargar área activa (3x3 chunks en el Z-level actual)
    for (let y = playerChunkY - 1; y <= playerChunkY + 1; y++) {
        for (let x = playerChunkX - 1; x <= playerChunkX + 1; x++) {
            const chunkKey = `${x},${y},${playerChunkZ}`; // <-- ¡CLAVE 3D!
            
            if (!activeChunks.has(chunkKey) && !pendingChunkLoads.has(chunkKey)) {
                pendingChunkLoads.add(chunkKey);
                console.log(`Pidiendo chunk: ${chunkKey}`);
                
                // ¡MODIFICADO! Pasar Z al generador
                getOrGenerateChunk(x, y, playerChunkZ, chunkKey)
                    .then(result => { 
                        activeChunks.set(chunkKey, result.chunkData);
                        
                        if (result.isNew) {
                            dirtyChunks.add(chunkKey);
                            console.log(`Chunk ${chunkKey} marcado como 'dirty' (nuevo).`);
                        }
                        
                        pendingChunkLoads.delete(chunkKey);
                    })
                    .catch(err => {
                        console.error(`Error al cargar chunk ${chunkKey}:`, err);
                        pendingChunkLoads.delete(chunkKey);
                    });
            }
        }
    }
    
    // 2. Descargar chunks lejanos (Esta lógica sigue funcionando)
    // Solo descarga chunks que NO están en el rango 3x3 actual.
    // Si cambiamos de Z, todos los chunks antiguos se limpiarán aquí.
    for (const chunkKey of activeChunks.keys()) {
        const [x, y, z] = chunkKey.split(',').map(Number);
        if (Math.abs(x - playerChunkX) > 2 || 
            Math.abs(y - playerChunkY) > 2 ||
            z !== playerChunkZ) // <-- ¡Y SI NO ES EL Z-LEVEL ACTUAL!
        {
            
            if (dirtyChunks.has(chunkKey)) {
                console.log(`Guardando chunk sucio ${chunkKey} antes de descargar...`);
                saveFusedChunk(chunkKey, activeChunks.get(chunkKey));
                dirtyChunks.delete(chunkKey);
            }
            
            console.log(`Descargando chunk: ${chunkKey}`);
            activeChunks.delete(chunkKey);
        }
    }
}

export async function flushDirtyChunks() {
    console.log(`Guardando ${dirtyChunks.size} chunks sucios...`);
    const promises = [];
    for (const chunkKey of dirtyChunks) {
        const chunkData = activeChunks.get(chunkKey);
        if (chunkData) {
            promises.push(saveFusedChunk(chunkKey, chunkData));
        }
    }
    await Promise.all(promises);
    dirtyChunks.clear();
    console.log("Chunks sucios guardados.");
}


// --- GESTIÓN DE OTROS JUGADORES ---
// --- ¡MODIFICADO! ---
export function updateAllPlayers(playersData, myProfileName) {
    otherPlayers.clear();
    if (!playersData) return;
    
    for (const profileName in playersData) {
        if (profileName === myProfileName) {
            continue; 
        }
        
        const data = playersData[profileName];
        
        // ¡NUEVO! Solo añadir otros jugadores si están en el mismo Z-level
        if (data.z === player.z) {
            otherPlayers.set(profileName, {
                ...data, // x, y, z, stats
                key: 'PLAYER', 
                name: profileName 
            });
        }
    }
}


// --- GESTIÓN DE DATOS EN LA NUBE ---
export function getDirtyChunksData() {
    const dirtyData = new Map();
    for (const chunkKey of dirtyChunks) {
        const chunkData = activeChunks.get(chunkKey);
        if (chunkData) {
            dirtyData.set(chunkKey, chunkData);
        }
    }
    console.log(`getDirtyChunksData: Encontrados ${dirtyData.size} chunks sucios en RAM.`);
    return dirtyData;
}
export function clearDirtyChunks() {
    console.log(`clearDirtyChunks: Limpiando ${dirtyChunks.size} chunks sucios.`);
    dirtyChunks.clear();
}

// --- GESTIÓN DE DELTAS ---
function recordDelta(chunkKey, deltaInfo) {
    const liveChunk = activeChunks.get(chunkKey);
    if (!liveChunk) {
        console.warn(`Se intentó modificar un chunk (${chunkKey}) no activo.`);
        return; 
    }

    switch(deltaInfo.type) {
        case 'REMOVE_ENTITY':
            liveChunk.entities = liveChunk.entities.filter(
                e => e.uid !== deltaInfo.uid
            );
            break;
        case 'ADD_ENTITY':
            liveChunk.entities.push(deltaInfo.entity);
            break;
        case 'REPLACE_ENTITY':
            const index = liveChunk.entities.findIndex(e => e.uid === deltaInfo.uid);
            if (index !== -1) {
                liveChunk.entities[index] = deltaInfo.newEntity;
                console.log(`Entidad ${deltaInfo.uid} reemplazada (ej: crecimiento).`);
            } else {
                console.warn(`No se pudo reemplazar la entidad ${deltaInfo.uid}: no encontrada.`);
                liveChunk.entities.push(deltaInfo.newEntity);
            }
            break;
        case 'CHANGE_TILE':
            const [x, y] = deltaInfo.localCoord.split(',').map(Number);
             if (liveChunk.terrain[y]) {
                liveChunk.terrain[y][x] = deltaInfo.tileKey;
             }
            break;
        case 'MOVE_ENTITY':
             const entityToMove = liveChunk.entities.find(e => e.uid === deltaInfo.uid);
             if (entityToMove) {
                entityToMove.x = deltaInfo.x;
                entityToMove.y = deltaInfo.y;
             }
             break;
    }
    
    dirtyChunks.add(chunkKey);
}

function recordDeltaFromEntity(entity, deltaInfo) {
    const chunkKey = getChunkKeyForEntity(entity); // ¡Usar helper!
    recordDelta(chunkKey, deltaInfo);
}


// --- HELPERS DE ENTIDADES/VEHICULOS ---

function findEntityByUid(uid) {
    if (!uid) return null;
    for (const chunk of activeChunks.values()) {
        for (const entity of chunk.entities) {
            if (entity.uid === uid) {
                return entity;
            }
        }
    }
    return null;
}

// --- ¡MODIFICADO! ---
function getChunkKeyForEntity(entity) {
    const chunkX = Math.floor(entity.x / CHUNK_PX_WIDTH);
    const chunkY = Math.floor(entity.y / CHUNK_PX_HEIGHT);
    const chunkZ = entity.z; // <-- ¡USAR Z DE LA ENTIDAD!
    return `${chunkX},${chunkY},${chunkZ}`;
}

// --- ¡MODIFICADO! ---
function moveEntityToNewChunk(entity, oldKey, newKey) {
    const oldChunk = activeChunks.get(oldKey);
    if (oldChunk) {
        const index = oldChunk.entities.findIndex(e => e.uid === entity.uid);
        if (index > -1) {
            oldChunk.entities.splice(index, 1);
        }
    }
    
    const newChunk = activeChunks.get(newKey);
    if (newChunk) {
        newChunk.entities.push(entity);
        dirtyChunks.add(newKey); 
    } else {
        // ¡MODIFICADO! Asegurarse de que el Z coincida
        // Si el newKey z no coincide con el entity.z, es un error
        const [, , newZ] = newKey.split(',').map(Number);
        if (newZ !== entity.z) {
             console.error(`¡ERROR DE LÓGICA! Entidad ${entity.uid} (z=${entity.z}) movida a chunk ${newKey} (z=${newZ})`);
        } else {
             console.warn(`La entidad ${entity.uid} se movió a un chunk no cargado (${newKey}) y se perderá.`);
        }
    }
}

function findSafeDismountPos(startX, startY) {
    const offsets = [
        { x: 0, y: TILE_PX_HEIGHT }, 
        { x: -TILE_PX_WIDTH, y: 0 }, 
        { x: TILE_PX_WIDTH, y: 0 }, 
        { x: 0, y: -TILE_PX_HEIGHT },
    ];

    for (const offset of offsets) {
        const newX = startX + offset.x;
        const newY = startY + offset.y;
        // checkCollision usa player.z por defecto, lo cual es correcto
        if (!checkCollision(newX, newY).solid) {
            return { x: newX, y: newY };
        }
    }
    return { x: startX, y: startY };
}

// --- LÓGICA DE JUEGO (LLAMADA DESDE MAIN) ---

// --- ¡MODIFICADO! ---
export function getMapTileKey(gridX, gridY, gridZ) {
    const chunkX = Math.floor(gridX / CHUNK_GRID_WIDTH);
    const chunkY = Math.floor(gridY / CHUNK_GRID_HEIGHT);
    // gridZ ya es el chunkZ
    const chunkKey = `${chunkX},${chunkY},${gridZ}`; // <-- ¡CLAVE 3D!
    const chunk = activeChunks.get(chunkKey);
    if (!chunk) return 'WALL'; 
    const localX = ((gridX % CHUNK_GRID_WIDTH) + CHUNK_GRID_WIDTH) % CHUNK_GRID_WIDTH;
    const localY = ((gridY % CHUNK_GRID_HEIGHT) + CHUNK_GRID_HEIGHT) % CHUNK_GRID_HEIGHT;
    
    if (chunk.terrain[localY] && chunk.terrain[localY][localX]) {
        const tileKey = chunk.terrain[localY][localX];
        return TERRAIN_DATA[tileKey] ? tileKey : 'DIRT';
    }
    return 'WALL'; // Fallback si el índice está fuera de rango
}

// --- ¡MODIFICADO! ---
export function getVisibleObjects(viewport) {
    let objectsToRender = [];

    // 1. Recopilar TILES (Suelo)
    const startX = Math.floor(viewport.minX / TILE_PX_WIDTH) - 1;
    const endX = Math.ceil(viewport.maxX / TILE_PX_WIDTH) + 1;
    const startY = Math.floor(viewport.minY / TILE_PX_HEIGHT) - 1;
    const endY = Math.ceil(viewport.maxY / TILE_PX_HEIGHT) + 1;
    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            objectsToRender.push({
                key: getMapTileKey(x, y, player.z), // <-- ¡PASAR Z!
                x: x * TILE_PX_WIDTH,
                y: y * TILE_PX_HEIGHT,
                zIndex: (y * TILE_PX_HEIGHT), 
                isGround: true,
                name: null, 
            });
        }
    }


    // 2. Recopilar ENTIDADES
    // ¡NO SE NECESITAN CAMBIOS!
    // 'activeChunks' SOLO contiene chunks del Z-level actual.
    // Esta lógica ya filtra por Z implícitamente.
    for (const chunk of activeChunks.values()) {
        for (const entity of chunk.entities) {
            const renderComp = entity.components.Renderable;
            if (!renderComp) continue; 
            
            const img = IMAGES[renderComp.imageKey]; 
            const imgHeight = img ? img.height : TILE_PX_HEIGHT;
            const imgWidth = img ? img.width : TILE_PX_WIDTH;
            
            const entityTop = entity.y - imgHeight;
            const entityBottom = entity.y;
            const entityLeft = entity.x - (imgWidth / 2);
            const entityRight = entity.x + (imgWidth / 2);
            const buffer = TILE_PX_HEIGHT * 2; 
    
            if (entityRight < viewport.minX - buffer ||
                entityLeft > viewport.maxX + buffer ||
                entityBottom < viewport.minY - buffer ||
                entityTop > viewport.maxY + buffer) 
            {
                continue; 
            }
            
            objectsToRender.push({
                key: renderComp.imageKey, 
                x: entity.x,
                y: entity.y,
                zIndex: entity.y, 
                isGround: false,
                name: null,
            });
        }
    }

   // 3. Añadir JUGADOR (Nosotros)
    if (!player.mountedVehicleUid) {
        objectsToRender.push({
            key: 'PLAYER',
            x: player.x,
            y: player.y,
            zIndex: player.y,
            isGround: false,
            name: null,
        });
    }
    
    // 4. Añadir OTROS JUGADORES
    // ¡NO SE NECESITAN CAMBIOS!
    // 'otherPlayers' ya fue filtrado por Z en 'updateAllPlayers'
    for (const [name, p] of otherPlayers.entries()) {
        const img = IMAGES[p.key]; 
        const imgHeight = img ? img.height : TILE_PX_HEIGHT;
        const imgWidth = img ? img.width : TILE_PX_WIDTH;
        const pTop = p.y - imgHeight;
        const pBottom = p.y;
        const pLeft = p.x - (imgWidth / 2);
        const pRight = p.x + (imgWidth / 2);
        const buffer = TILE_PX_HEIGHT * 2;
        
        if (pRight < viewport.minX - buffer ||
            pLeft > viewport.maxX + buffer ||
            pBottom < viewport.minY - buffer ||
            pTop > viewport.maxY + buffer) 
        {
            continue; 
        }
        
        objectsToRender.push({
            key: p.key,
            x: p.x,
            y: p.y,
            zIndex: p.y,
            isGround: false,
            name: p.name 
        });
    }
    
    // 5. Y-SORTING
    objectsToRender.sort((a, b) => a.zIndex - b.zIndex);
    
    return objectsToRender;
}

// --- ¡MODIFICADO! ---
function findEntityAt(worldX, worldY) {
    // ¡NO SE NECESITAN CAMBIOS!
    // 'activeChunks' ya está filtrado por Z, así que solo
    // encontraremos entidades en el Z-level actual.
    const chunkX = Math.floor(worldX / CHUNK_PX_WIDTH);
    const chunkY = Math.floor(worldY / CHUNK_PX_HEIGHT);
    const chunkKey = `${chunkX},${chunkY},${player.z}`; // <-- Usar Z del jugador
    const chunk = activeChunks.get(chunkKey);
    if (!chunk) return null;

    for (let i = chunk.entities.length - 1; i >= 0; i--) {
        const entity = chunk.entities[i];
        
        // Comprobar si es interactuable
        if (!entity.components.InteractableResource &&
            !entity.components.InteractableDialogue &&
            !entity.components.InteractableMenu &&
            !entity.components.InteractableVehicle &&
            !entity.components.InteractableLevelChange) { // <-- ¡AÑADIDO!
            continue;
        }

        const colComp = entity.components.Collision;
        if (!colComp) continue; 

        const clickBox = colComp.collisionBox || { 
            width: TILE_PX_WIDTH * 0.8, 
            height: TILE_PX_HEIGHT * 0.8, 
            offsetY: TILE_PX_HEIGHT * 0.8 
        };
        
        const eX = entity.x - clickBox.width / 2;
        const eY = entity.y - clickBox.offsetY;
        
        if (worldX >= eX && worldX <= eX + clickBox.width &&
            worldY >= eY && worldY <= eY + clickBox.height) 
        {
            return { entity };
        }
    }
    return null;
}

// --- ¡MODIFICADO! ---
export function handleWorldTap(worldX, worldY) {
    
    if (player.mountedVehicleUid) {
        // ... (lógica de desmontaje sin cambios) ...
        const dx = worldX - player.x;
        const dy = worldY - player.y;
        const distSq = dx*dx + dy*dy;
        const playerClickRadius = TILE_PX_WIDTH * 0.7; 
        
        if (distSq < (playerClickRadius * playerClickRadius)) {
            const vehicle = findEntityByUid(player.mountedVehicleUid);
            VehicleSystem.dismountVehicle(player, vehicle, PLAYER_SPEED, dirtyChunks, findSafeDismountPos, getChunkKeyForEntity);
            return { message: "Te has bajado del vehículo." };
        }
    }

    const target = findEntityAt(worldX, worldY);
    
    // 1. Clic en Entidad Interactuable
    if (target) {
        player.isMovingToTarget = false;
        const dx = player.x - target.entity.x;
        const dy = player.y - target.entity.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        if (distance < TILE_PX_WIDTH * 1.5) {
            return playerInteract(target.entity);
        } else {
            return { message: "Estás demasiado lejos." };
        }
    }

    // 2. Clic en el Terreno
    const gridX = Math.floor(worldX / TILE_PX_WIDTH);
    const gridY = Math.floor(worldY / TILE_PX_HEIGHT);
    // ¡MODIFICADO!
    const groundTileKey = getMapTileKey(gridX, gridY, player.z);

    if (TERRAIN_DATA[groundTileKey]?.solid) {
        player.isMovingToTarget = false; 
        return { message: "No puedes caminar ahí." };
    }
    
    // 3. Moverse al punto
    player.isMovingToTarget = true;
    player.targetX = worldX;
    player.targetY = worldY;
    return { message: null };
}

// --- ¡MODIFICADO! ---
function checkCollision(pixelX, pixelY, entityToIgnore = null) {
    
    // ¡NUEVO! Obtener la Z correcta
    // Si es una IA moviéndose, usa su Z. Si no (jugador), usa la Z del jugador.
    const gridZ = entityToIgnore ? entityToIgnore.z : player.z;

    // 1. Colisión con el mapa (suelo)
    const gridX = Math.floor(pixelX / TILE_PX_WIDTH);
    const gridY = Math.floor(pixelY / TILE_PX_HEIGHT);
    const groundTileKey = getMapTileKey(gridX, gridY, gridZ); // <-- ¡PASAR Z!
    
    if (TERRAIN_DATA[groundTileKey]?.solid) {
        return { solid: true, type: 'map' };
    }

    // 2. Colisión con entidades
    // ¡NO SE NECESITAN CAMBIOS!
    // 'activeChunks' ya está filtrado por Z.
    // Solo colisionaremos con entidades en el mismo Z-level.
    const chunkX = Math.floor(pixelX / CHUNK_PX_WIDTH);
    const chunkY = Math.floor(pixelY / CHUNK_PX_HEIGHT);
    const chunkKey = `${chunkX},${chunkY},${gridZ}`; // <-- ¡USAR Z!

    // ¡Optimización! Solo comprobar el chunk actual.
    // (Para colisiones más grandes, necesitarías el bucle 3x3)
    const chunk = activeChunks.get(chunkKey);
    if (!chunk) return { solid: false }; // Chunk no cargado = no sólido
            
    for (const entity of chunk.entities) {
        if (entityToIgnore && entity.uid === entityToIgnore.uid) {
            continue;
        }
        if (player.mountedVehicleUid === entity.uid) {
            continue;
        }

        const colComp = entity.components.Collision;
        if (!colComp || !colComp.isSolid) continue; 
        
        const eBox = colComp.collisionBox || { 
            width: TILE_PX_WIDTH * 0.8, 
            height: TILE_PX_HEIGHT * 0.4, 
            offsetY: TILE_PX_HEIGHT * 0.4 
        };
        
        const eMinX = entity.x - eBox.width / 2;
        const eMaxX = entity.x + eBox.width / 2;
        const eMinY = entity.y - eBox.offsetY;
        const eMaxY = entity.y - eBox.offsetY + eBox.height;

        let pBox;
        if (entityToIgnore) {
            const pColComp = entityToIgnore.components.Collision;
            pBox = pColComp ? pColComp.collisionBox : eBox; 
        } else {
            let pEntityKey = 'PLAYER';
            if (player.mountedVehicleUid) {
                const vehicle = findEntityByUid(player.mountedVehicleUid);
                if(vehicle) pEntityKey = vehicle.key;
            }
            const pDef = ENTITY_DATA[pEntityKey];
            const pCompDef = pDef.components.find(c => c.type === 'Collision');
            pBox = pCompDef.args[1]; 
        }
        
        const pMinX = pixelX - pBox.width / 2;
        const pMaxX = pixelX + pBox.width / 2;
        const pMinY = pixelY - pBox.offsetY;
        const pMaxY = pixelY - pBox.offsetY + pBox.height;

        if (pMinX < eMaxX && pMaxX > eMinX && pMinY < eMaxY && pMaxY > eMinY) {
            return { solid: true, type: 'entity', entity: entity };
        }
    }
    
    return { solid: false };
}

// --- ¡MODIFICADO! ---
export function updatePlayer(deltaTime, input) {
    let message = null;
    
    // ... (lógica de cálculo de vx/vy sin cambios) ...
    if (input.up || input.down || input.left || input.right) {
        player.isMovingToTarget = false;
        let baseVx = 0, baseVy = 0;
        
        if (input.left) baseVx = -1;
        else if (input.right) baseVx = 1;
        if (input.up) baseVy = -1;
        else if (input.down) baseVy = 1;

        if (baseVx !== 0 && baseVy !== 0) {
            baseVx /= Math.SQRT2;
            baseVy /= Math.SQRT2;
        }

        player.vx = baseVx * player.currentSpeed;
        player.vy = baseVy * player.currentSpeed;
    }
    else if (player.isMovingToTarget) {
        const dx = player.targetX - player.x;
        const dy = player.targetY - player.y;
        const distance = Math.sqrt(dx*dx + dy*dy);

        if (distance < 10) {
            player.isMovingToTarget = false;
            player.vx = 0; player.vy = 0;
        } else {
            player.vx = (dx / distance) * player.currentSpeed;
            player.vy = (dy / distance) * player.currentSpeed;
        }
    } else {
        player.vx = 0; player.vy = 0;
    }

    if (player.vx !== 0 || player.vy !== 0) {
        let newX = player.x + player.vx * deltaTime;
        let newY = player.y + player.vy * deltaTime;

        // checkCollision usa player.z por defecto, ¡correcto!
        if (!checkCollision(newX, player.y).solid) player.x = newX;
        else if (player.isMovingToTarget) player.isMovingToTarget = false;
        
        if (!checkCollision(player.x, newY).solid) player.y = newY;
        else if (player.isMovingToTarget) player.isMovingToTarget = false;
        
        if (Math.abs(player.vx) > Math.abs(player.vy)) {
            player.facing = player.vx > 0 ? 'right' : 'left';
        } else if (Math.abs(player.vy) > 0) {
            player.facing = player.vy > 0 ? 'down' : 'up';
        }
    }
    
    // Sincronizar vehiculo si estamos montados
    if (player.mountedVehicleUid) {
        const vehicle = findEntityByUid(player.mountedVehicleUid);
        if (vehicle) {
            // ¡MODIFICADO! Asegurarse de que el Z del vehículo coincida
            if (vehicle.z !== player.z) {
                 console.error(`¡ERROR DE Z! Jugador (z=${player.z}) montado en vehículo (z=${vehicle.z})`);
            }
            
            const oldVehicleChunkKey = getChunkKeyForEntity(vehicle);
            vehicle.x = player.x;
            vehicle.y = player.y; 
            const newVehicleChunkKey = getChunkKeyForEntity(vehicle);

            dirtyChunks.add(oldVehicleChunkKey);
            if (oldVehicleChunkKey !== newVehicleChunkKey) {
                moveEntityToNewChunk(vehicle, oldVehicleChunkKey, newVehicleChunkKey);
            }
        } else {
            console.warn(`Vehiculo ${player.mountedVehicleUid} no encontrado, desmontando.`);
            VehicleSystem.dismountVehicle(player, null, PLAYER_SPEED, dirtyChunks, findSafeDismountPos, getChunkKeyForEntity);
        }
    }


    // Sistema "OnEnter" (Collectible)
    const chunkX = Math.floor(player.x / CHUNK_PX_WIDTH);
    const chunkY = Math.floor(player.y / CHUNK_PX_HEIGHT);
    const chunkKey = `${chunkX},${chunkY},${player.z}`; // <-- ¡USAR Z!
    const chunk = activeChunks.get(chunkKey);
    
    if(chunk) {
        for (let i = chunk.entities.length - 1; i >= 0; i--) {
            const entity = chunk.entities[i];
            
            // ¡NO SE NECESITA CAMBIO DE Z!
            // 'chunk' ya es del Z-level correcto.
            
            const comp = entity.components.Collectible;
            
            if (comp) {
                const dx = player.x - entity.x;
                const dy = player.y - entity.y;
                const distance = Math.sqrt(dx*dx + dy*dy);
                const enterRadius = TILE_PX_WIDTH / 2; 
                
                if (distance < enterRadius) {
                    addItem(comp.itemId, comp.quantity);
                    recordDeltaFromEntity(entity, { type: 'REMOVE_ENTITY', uid: entity.uid });
                    const itemDef = ITEM_DEFINITIONS[comp.itemId];
                    message = `¡Has recogido ${comp.quantity} de ${itemDef.name}!`;
                }
            }
        }
    }
    
    return { message };
}

// --- ¡MODIFICADO! ---
export function updateEntities(deltaTime) {
    const deltaMs = deltaTime * 1000;

    // ¡NO SE NECESITAN CAMBIOS!
    // 'activeChunks' ya está filtrado por Z.
    // Solo procesa entidades en el Z-level actual.
    for (const chunkKey of activeChunks.keys()) {
        const chunk = activeChunks.get(chunkKey);
        
        for (let i = 0; i < chunk.entities.length; i++) {
            const entity = chunk.entities[i];
            if (!entity) continue; 
            
            const comps = entity.components;

            // Sistema de Crecimiento
            if (comps.Growth) {
                comps.Growth.currentTime += deltaMs;
                if (comps.Growth.currentTime >= comps.Growth.timeToGrowMs) {
                    // ¡MODIFICADO! Pasar Z a createEntity
                    const newEntity = createEntity(
                        comps.Growth.nextEntityKey, 
                        entity.x, 
                        entity.y, 
                        entity.z, // <-- ¡PASAR Z!
                        entity.uid
                    );
                    if (newEntity) {
                        recordDelta(chunkKey, { 
                            type: 'REPLACE_ENTITY', 
                            uid: entity.uid, 
                            newEntity: newEntity 
                        });
                    }
                }
            }
            
            // Sistema de Movimiento AI
            if (comps.MovementAI) {
                const ai = comps.MovementAI;
                ai.timeUntilNextAction -= deltaMs;

                if (ai.timeUntilNextAction <= 0) {
                    ai.timeUntilNextAction = (Math.random() * 3000) + 2000; 
                    const action = Math.random();
                    if (action < 0.6) { 
                        ai.currentVelocity.x = 0;
                        ai.currentVelocity.y = 0;
                    } else { 
                        const angle = Math.random() * Math.PI * 2;
                        ai.currentVelocity.x = Math.cos(angle) * ai.speed;
                        ai.currentVelocity.y = Math.sin(angle) * ai.speed;
                    }
                }

                if (ai.currentVelocity.x !== 0 || ai.currentVelocity.y !== 0) {
                    let newX = entity.x + ai.currentVelocity.x * deltaTime;
                    let newY = entity.y + ai.currentVelocity.y * deltaTime;

                    // ¡MODIFICADO! checkCollision usa la Z de la entidad
                    if (!checkCollision(newX, entity.y, entity).solid) {
                        entity.x = newX;
                    } else {
                        ai.currentVelocity.x = 0; 
                        ai.timeUntilNextAction = 500; 
                    }
                    
                    if (!checkCollision(entity.x, newY, entity).solid) {
                        entity.y = newY;
                    } else {
                        ai.currentVelocity.y = 0; 
                        ai.timeUntilNextAction = 500; 
                    }

                    // ¡MODIFICADO! Usar Z para la clave de chunk
                    const newChunkX = Math.floor(entity.x / CHUNK_PX_WIDTH);
                    const newChunkY = Math.floor(entity.y / CHUNK_PX_HEIGHT);
                    const newChunkKey = `${newChunkX},${newChunkY},${entity.z}`; // <-- ¡USAR Z!

                    if (newChunkKey !== chunkKey) {
                        console.log(`NPC ${entity.uid} se movió a ${newChunkKey}`);
                        const entityToMove = chunk.entities.splice(i, 1)[0];
                        i--; 
                        
                        // ¡moveEntityToNewChunk se encarga de la lógica!
                        moveEntityToNewChunk(entityToMove, chunkKey, newChunkKey);
                    } 
                    
                    dirtyChunks.add(chunkKey); 
                }
            }
        }
    }
}


// --- ¡MODIFICADO! Sistema de Interacción ---
export function playerInteract(targetEntity = null) {
    
    if (player.mountedVehicleUid) {
        const vehicle = findEntityByUid(player.mountedVehicleUid);
        VehicleSystem.dismountVehicle(player, vehicle, PLAYER_SPEED, dirtyChunks, findSafeDismountPos, getChunkKeyForEntity);
        return { message: "Te has bajado del vehículo." };
    }

    let entityToInteract = targetEntity;

    // 1. Si no hay objetivo (tecla Espacio), buscar uno
    if (!entityToInteract) {
        let targetX = player.x, targetY = player.y;
        const reach = TILE_PX_WIDTH * 1.5;

        if (player.facing === 'up') targetY -= reach;
        if (player.facing === 'down') targetY += reach;
        if (player.facing === 'left') targetX -= reach;
        if (player.facing === 'right') targetX += reach;

        let closestDist = Infinity;
        
        // ¡NO SE NECESITA CAMBIO!
        // 'activeChunks' ya está filtrado por Z.
        for (const chunk of activeChunks.values()) {
            for (const entity of chunk.entities) {
                // ¡MODIFICADO! Comprobar componente de escalera
                if (!entity.components.InteractableResource &&
                    !entity.components.InteractableDialogue &&
                    !entity.components.InteractableMenu &&
                    !entity.components.InteractableVehicle &&
                    !entity.components.InteractableLevelChange) { // <-- ¡AÑADIDO!
                    continue; 
                }
                
                const colComp = entity.components.Collision;
                if (!colComp) continue;

                const dx = entity.x - targetX;
                const dy = entity.y - targetY;
                const distance = Math.sqrt(dx*dx + dy*dy);
                
                const interactRadius = (colComp.collisionBox?.width || TILE_PX_WIDTH) * 0.8; 
                
                if (distance < interactRadius && distance < closestDist) {
                    closestDist = distance;
                    entityToInteract = entity;
                }
            }
        }
    }
    
    // 2. Procesar la entidad encontrada
    if (entityToInteract) {
        const comps = entityToInteract.components;
        
        // --- Sistema de Interacción: Prioridad de componentes ---

        // ¡NUEVO! A. ¿Es un cambio de nivel?
        if (comps.InteractableLevelChange) {
            const dir = comps.InteractableLevelChange.direction;
            let message = "";
            if (dir === 'down') {
                player.z -= 1;
                message = "Bajas por la escalera.";
            } else if (dir === 'up') {
                if (player.z === -1) { // Lógica especial para volver a la superficie
                     player.z = 0;
                } else {
                     player.z += 1;
                }
                message = "Subes por la escalera.";
            }
            
            // ¡CRÍTICO! Forzar recarga de chunks del nuevo nivel
            // (La llamada a updateActiveChunks en el bucle principal se encargará
            // de descargar los chunks antiguos y cargar los nuevos)
            
            return { message: message };
        }

        // B. ¿Es un Vehiculo?
        if (comps.InteractableVehicle && comps.Vehicle) {            
            VehicleSystem.mountVehicle(player, entityToInteract, dirtyChunks, getChunkKeyForEntity);
            const entityDef = ENTITY_DATA[entityToInteract.key];
            return { message: `Te has montado en: ${entityDef.name}.` };
        }

        // C. ¿Es un Recurso?
        if (comps.InteractableResource) {
            const comp = comps.InteractableResource;
            if (stats.energia >= comp.energyCost) {
                addItem(comp.itemId, comp.quantity);
                stats.energia -= comp.energyCost;
                recordDeltaFromEntity(entityToInteract, { type: 'REMOVE_ENTITY', uid: entityToInteract.uid });
                const itemDef = ITEM_DEFINITIONS[comp.itemId];
                return { message: `Has conseguido ${comp.quantity} de ${itemDef.name}.` };
            } else {
                return { message: "No tienes suficiente energía." };
            }
        }
        
        // D. ¿Es un Menú?
        if (comps.InteractableMenu) {
            const comp = comps.InteractableMenu;
            openMenuCallback(comp.menuId); 
            const entityDef = ENTITY_DATA[entityToInteract.key];
            return { message: `Abriendo ${entityDef.name}...` };
        }

        // E. ¿Es un Diálogo?
        if (comps.InteractableDialogue) {
            const comp = comps.InteractableDialogue;
            // Asegurarse de que el mensaje sea un string
            if (Array.isArray(comp.message)) {
                return { message: comp.message[0] || "..." };
            }
            return { message: comp.message };
        }
    }

    return { message: "No hay nada con qué interactuar ahí." };
}

// ---
export function checkGameStatus() {
    if (stats.vida <= 0) return { alive: false, message: "Has muerto." };
    if (stats.energia <= 0) {
        stats.energia = 0;
        return { alive: true, message: "¡Estás sin energía!" };
    }
    return { alive: true, message: null };
}