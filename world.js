// --- world.js ---
// Gestiona el estado del mundo activo (chunks en RAM)
// y proporciona funciones para consultarlo y mutarlo.

import { 
    getOrGenerateChunk, 
    saveFusedChunk 
} from './generation.js';
import { 
    player, 
    otherPlayers,
    TERRAIN_DATA,
    IMAGES,
    TILE_PX_WIDTH, 
    TILE_PX_HEIGHT,
    CHUNK_PX_WIDTH,
    CHUNK_PX_HEIGHT,
        CHUNK_GRID_WIDTH,  // <-- ¡AÑADIDO!
    CHUNK_GRID_HEIGHT // <-- ¡AÑADIDO!
} from './logic.js';

// --- ESTADO DEL MUNDO ACTIVO (RAM) ---
// K: "x,y,z"
let activeChunks = new Map(); 
let pendingChunkLoads = new Set(); 
let dirtyChunks = new Set(); 

// --- GESTIÓN DE CHUNKS ---

export function getActiveChunks() {
    return activeChunks;
}

export function getActiveChunk(key) {
    return activeChunks.get(key);
}
export function updateActiveChunks(playerX, playerY) {
    const playerChunkX = Math.floor(playerX / CHUNK_PX_WIDTH);
    const playerChunkY = Math.floor(playerY / CHUNK_PX_HEIGHT);
    const playerChunkZ = player.z; 

    // 1. Cargar área activa (3x3 chunks en el Z-level actual)
    for (let y = playerChunkY - 1; y <= playerChunkY + 1; y++) {
        for (let x = playerChunkX - 1; x <= playerChunkX + 1; x++) {
            const chunkKey = `${x},${y},${playerChunkZ}`; 
            
            if (!activeChunks.has(chunkKey) && !pendingChunkLoads.has(chunkKey)) {
                pendingChunkLoads.add(chunkKey);
                console.log(`Pidiendo chunk: ${chunkKey}`);
                
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
    
    // 2. Descargar chunks lejanos
    for (const chunkKey of activeChunks.keys()) {
        const [x, y, z] = chunkKey.split(',').map(Number);
        if (Math.abs(x - playerChunkX) > 2 || 
            Math.abs(y - playerChunkY) > 2 ||
            z !== playerChunkZ) 
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

// --- HELPERS PARA LA NUBE ---

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

// --- GESTIÓN DE DELTAS (MUTACIONES DEL MUNDO) ---

export function recordDelta(chunkKey, deltaInfo) {
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

export function recordDeltaFromEntity(entity, deltaInfo) {
    const chunkKey = getChunkKeyForEntity(entity); // ¡Usar helper!
    recordDelta(chunkKey, deltaInfo);
}


// --- HELPERS DE ENTIDADES/MUNDO (QUERIES) ---

export function findEntityByUid(uid) {
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

export function getChunkKeyForEntity(entity) {
    const chunkX = Math.floor(entity.x / CHUNK_PX_WIDTH);
    const chunkY = Math.floor(entity.y / CHUNK_PX_HEIGHT);
    const chunkZ = entity.z; // <-- ¡USAR Z DE LA ENTIDAD!
    return `${chunkX},${chunkY},${chunkZ}`;
}

export function moveEntityToNewChunk(entity, oldKey, newKey) {
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
        const [, , newZ] = newKey.split(',').map(Number);
        if (newZ !== entity.z) {
             console.error(`¡ERROR DE LÓGICA! Entidad ${entity.uid} (z=${entity.z}) movida a chunk ${newKey} (z=${newZ})`);
        } else {
             console.warn(`La entidad ${entity.uid} se movió a un chunk no cargado (${newKey}) y se perderá.`);
        }
    }
}

// --- QUERIES PARA RENDERIZADO Y LÓGICA ---

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
                facing: 'right', // Suelo no tiene dirección
                uid: `tile_${x}_${y}` // UID para el suelo
            });
        }
    }

    // 2. Recopilar ENTIDADES
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
                // --- ¡MODIFICACIÓN! ---
                uid: entity.uid, // <--- ¡AÑADIDO!
                // --- FIN ---
                key: renderComp.imageKey, 
                x: entity.x,
                y: entity.y,
                zIndex: entity.y, 
                isGround: false,
                name: null,
                facing: entity.facing || 'right' 
            });
        }
    }

   // 3. Añadir JUGADOR (Nosotros)
    if (!player.mountedVehicleUid) {
        objectsToRender.push({
            // --- ¡MODIFICACIÓN! ---
            uid: 'PLAYER', // <--- ¡AÑADIDO!
            // --- FIN ---
            key: 'PLAYER',
            x: player.x,
            y: player.y,
            zIndex: player.y,
            isGround: false,
            name: null,
            facing: player.facing 
        });
    }
    
    // 4. Añadir OTROS JUGADORES
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
            // --- ¡MODIFICACIÓN! ---
            uid: name, // <--- ¡AÑADIDO! (usamos el nombre como uid)
            // --- FIN ---
            key: p.key,
            x: p.x,
            y: p.y,
            zIndex: p.y,
            isGround: false,
            name: p.name,
            facing: p.facing || 'right' 
        });
    }
    
    // 5. Y-SORTING
    objectsToRender.sort((a, b) => a.zIndex - b.zIndex);
    
    return objectsToRender;
}

export function findEntityAt(worldX, worldY) {
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
            !entity.components.InteractableLevelChange) { 
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