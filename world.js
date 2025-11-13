// --- world.js ---
// Gestiona el estado del mundo activo (chunks en RAM)
// y proporciona funciones para consultarlo y mutarlo.
// --- ¡MODIFICADO! ---
// Añade listas globales para entidades activas (IA, Crecimiento)
// --- ¡FIX v2! ---
// 'getVisibleObjects' ahora pasa 'entityKey' y 'imageKey' por separado.

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
    CHUNK_GRID_WIDTH,
    CHUNK_GRID_HEIGHT
} from './logic.js';
// Importamos funciones del motor 3D para crear/destruir meshes de terreno
import { addChunkTerrain, removeChunkTerrain } from './engine_3d.js';


// --- ESTADO DEL MUNDO ACTIVO (RAM) ---
// K: "x,y,z"
let activeChunks = new Map(); 
let pendingChunkLoads = new Set(); 
let dirtyChunks = new Set(); 

// --- ¡NUEVO! Listas de optimización de CPU ---
// Estas listas contendrán referencias a entidades que necesitan
// actualizaciones por frame (IA, Crecimiento), para que
// entity_system.js no tenga que buscar en todos los chunks.
export let activeAiEntities = [];
export let activeGrowthEntities = [];


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
                        const chunkData = result.chunkData;
                        chunkData.x = x;
                        chunkData.y = y;
                        chunkData.z = playerChunkZ;
                        chunkData.key = chunkKey; 
                        
                        activeChunks.set(chunkKey, chunkData);
                        
                        // --- ¡NUEVO! Registrar entidades activas ---
                        for (const entity of chunkData.entities) {
                            if (entity.components.MovementAI) {
                                activeAiEntities.push(entity);
                            }
                            if (entity.components.Growth) {
                                activeGrowthEntities.push(entity);
                            }
                        }
                        
                        // Informar al motor 3D para que cree el mesh estático
                        addChunkTerrain(chunkKey, chunkData);

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
            const chunkToUnload = activeChunks.get(chunkKey); // Obtener referencia
            
            if (dirtyChunks.has(chunkKey)) {
                console.log(`Guardando chunk sucio ${chunkKey} antes de descargar...`);
                saveFusedChunk(chunkKey, chunkToUnload);
                dirtyChunks.delete(chunkKey);
            }
            
            console.log(`Descargando chunk: ${chunkKey}`);
            
            // --- ¡NUEVO! Eliminar entidades de las listas activas ---
            if (chunkToUnload && chunkToUnload.entities) {
                // Creamos un Set de UIDs a eliminar para una búsqueda rápida
                const uidsToUnload = new Set(chunkToUnload.entities.map(e => e.uid));
                
                activeAiEntities = activeAiEntities.filter(e => !uidsToUnload.has(e.uid));
                activeGrowthEntities = activeGrowthEntities.filter(e => !uidsToUnload.has(e.uid));
            }

            // Informar al motor 3D para que elimine el mesh estático
            removeChunkTerrain(chunkKey);
            
            // Finalmente, eliminar el chunk de la RAM
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

    // --- ¡NUEVO! Manejo de listas de optimización ---
    let entityToRemove = null;
    let entityToAdd = null;

    switch(deltaInfo.type) {
        case 'REMOVE_ENTITY':
            // Encontrar la entidad ANTES de filtrarla
            entityToRemove = liveChunk.entities.find(e => e.uid === deltaInfo.uid);
            liveChunk.entities = liveChunk.entities.filter(
                e => e.uid !== deltaInfo.uid
            );
            break;
        case 'ADD_ENTITY':
            entityToAdd = deltaInfo.entity;
            liveChunk.entities.push(entityToAdd);
            break;
        case 'REPLACE_ENTITY':
            const index = liveChunk.entities.findIndex(e => e.uid === deltaInfo.uid);
            if (index !== -1) {
                entityToRemove = liveChunk.entities[index]; // Registrar la entidad antigua
                entityToAdd = deltaInfo.newEntity; // Registrar la nueva
                liveChunk.entities[index] = entityToAdd;
                console.log(`Entidad ${deltaInfo.uid} reemplazada (ej: crecimiento).`);
            } else {
                console.warn(`No se pudo reemplazar la entidad ${deltaInfo.uid}: no encontrada.`);
                entityToAdd = deltaInfo.newEntity; // Solo añadir
                liveChunk.entities.push(entityToAdd);
            }
            break;
        case 'CHANGE_TILE':
            const [x, y] = deltaInfo.localCoord.split(',').map(Number);
             if (liveChunk.terrain[y]) {
                liveChunk.terrain[y][x] = deltaInfo.tileKey;
             }
             // Si un tile cambia, debemos reconstruir el mesh de ese chunk
             removeChunkTerrain(chunkKey);
             addChunkTerrain(chunkKey, liveChunk);
            break;
        case 'MOVE_ENTITY':
             const entityToMove = liveChunk.entities.find(e => e.uid === deltaInfo.uid);
             if (entityToMove) {
                entityToMove.x = deltaInfo.x;
                entityToMove.y = deltaInfo.y;
             }
             break;
    }
    
    // --- ¡NUEVO! Actualizar listas de optimización ---
    if (entityToRemove) {
        if (entityToRemove.components.MovementAI) {
            activeAiEntities = activeAiEntities.filter(e => e.uid !== entityToRemove.uid);
        }
        if (entityToRemove.components.Growth) {
            activeGrowthEntities = activeGrowthEntities.filter(e => e.uid !== entityToRemove.uid);
        }
    }
    if (entityToAdd) {
        if (entityToAdd.components.MovementAI) {
            activeAiEntities.push(entityToAdd);
        }
        if (entityToAdd.components.Growth) {
            activeGrowthEntities.push(entityToAdd);
        }
    }
    // --- FIN DE ACTUALIZACIÓN DE LISTAS ---

    dirtyChunks.add(chunkKey);
}

export function recordDeltaFromEntity(entity, deltaInfo) {
    const chunkKey = getChunkKeyForEntity(entity);
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
    const chunkZ = entity.z;
    return `${chunkX},${chunkY},${chunkZ}`;
}

export function moveEntityToNewChunk(entity, oldKey, newKey) {
    const oldChunk = activeChunks.get(oldKey);
    if (oldChunk) {
        const index = oldChunk.entities.findIndex(e => e.uid === entity.uid);
        if (index > -1) {
            oldChunk.entities.splice(index, 1);
        }
        // NOTA: La entidad permanece en las listas activeAiEntities
        // lo cual es correcto, ya que todavía está activa.
        // La lógica de descarga de chunks se encargará de
        // limpiarla si se aleja demasiado.
    }
    
    const newChunk = activeChunks.get(newKey);
    if (newChunk) {
        newChunk.entities.push(entity);
        dirtyChunks.add(newKey); 
    } else {
        // La entidad se movió a un chunk NO CARGADO.
        // Se perderá, y la lógica de descarga de chunks
        // (cuando el chunk antiguo se descargue) la limpiará
        // de las listas activas.
        const [, , newZ] = newKey.split(',').map(Number);
        if (newZ !== entity.z) {
             console.error(`¡ERROR DE LÓGICA! Entidad ${entity.uid} (z=${entity.z}) movida a chunk ${newKey} (z=${newZ})`);
        } else {
             console.warn(`La entidad ${entity.uid} se movió a un chunk no cargado (${newKey}) y se perderá.`);
             // Como se perderá, la eliminamos manualmente de las listas activas
             activeAiEntities = activeAiEntities.filter(e => e.uid !== entity.uid);
             activeGrowthEntities = activeGrowthEntities.filter(e => e.uid !== entity.uid);
        }
    }
}

// --- QUERIES PARA RENDERIZADO Y LÓGICA ---

export function getMapTileKey(gridX, gridY, gridZ) {
    const chunkX = Math.floor(gridX / CHUNK_GRID_WIDTH);
    const chunkY = Math.floor(gridY / CHUNK_GRID_HEIGHT);
    const chunkKey = `${chunkX},${chunkY},${gridZ}`;
    const chunk = activeChunks.get(chunkKey);
    if (!chunk) return 'WALL'; 
    const localX = ((gridX % CHUNK_GRID_WIDTH) + CHUNK_GRID_WIDTH) % CHUNK_GRID_WIDTH;
    const localY = ((gridY % CHUNK_GRID_HEIGHT) + CHUNK_GRID_HEIGHT) % CHUNK_GRID_HEIGHT;
    
    if (chunk.terrain[localY] && chunk.terrain[localY][localX]) {
        const tileKey = chunk.terrain[localY][localX];
        return TERRAIN_DATA[tileKey] ? tileKey : 'DIRT';
    }
    return 'WALL';
}

/**
 * ¡OPTIMIZADO!
 * Ya no devuelve tiles. Solo devuelve entidades dinámicas.
 * El terreno se maneja estáticamente en engine_3d.js.
 * --- ¡FIX v2! ---
 * Ahora pasa 'entityKey' y 'imageKey' por separado.
 */
export function getVisibleObjects() {
    let objectsToRender = []; // Empieza vacío

    // 1. Recopilar ENTIDADES desde los chunks activos
    for (const chunk of activeChunks.values()) {
        
        // (Asegurarse de que el Z del chunk es el Z del jugador)
        if (chunk.z !== player.z) {
            continue;
        }
        
        // Iterar solo las entidades
        for (const entity of chunk.entities) {
            const renderComp = entity.components.Renderable;
            if (!renderComp) continue; 
            
            const aiComp = entity.components.MovementAI;
            const isHovered = (entity.uid === player.hoveredEntityUID);
            objectsToRender.push({
                uid: entity.uid,
                imageKey: renderComp.imageKey, 
                entityKey: entity.key,         
                x: entity.x,
                y: entity.y,
                z: entity.z, // <-- ¡AÑADIDO! Pasar el Z de la entidad
                zIndex: entity.y, 
                isGround: false,
                name: null,
                facing: entity.facing || 'right',
                vx: aiComp ? aiComp.currentVelocity.x : 0,
                vy: aiComp ? aiComp.currentVelocity.y : 0,
                rotationY: entity.rotationY || 0,
                isHovered: isHovered
            });
        }
    }

   // 2. Añadir JUGADOR (Nosotros)
    if (!player.mountedVehicleUid) {
        
        // --- ¡CORRECCIÓN AÑADIDA! ---
        objectsToRender.push({
            uid: 'PLAYER',
            imageKey: 'PLAYER',  
            entityKey: 'PLAYER', 
            x: player.x,
            y: player.y,
            z: player.z, // <-- ¡¡LA CORRECCIÓN CLAVE!!
            zIndex: player.y,
            isGround: false,
            name: null,
            facing: player.facing,
            vx: player.vx,
            vy: player.vy,
            rotationY: player.rotationY || 0
        });
        // --- FIN DE CORRECCIÓN ---
    }
    
    // 3. Añadir OTROS JUGADORES
    for (const [name, p] of otherPlayers.entries()) {
        
        // --- ¡CORRECCIÓN AÑADIDA! ---
        objectsToRender.push({
            uid: name,
            imageKey: p.key,  
            entityKey: p.key, 
            x: p.x,
            y: p.y,
            z: p.z, // <-- ¡AÑADIDO!
            zIndex: p.y,
            isGround: false,
            name: p.name,
            facing: p.facing || 'right',
            vx: 0,
            vy: 0,
            rotationY: p.rotationY || 0
        });
        // --- FIN DE CORRECCIÓN ---
    }
    
    // 4. Y-SORTING (¡Importante!)
    objectsToRender.sort((a, b) => a.zIndex - b.zIndex);
    
    return objectsToRender;
}

export function findEntityAt(worldX, worldY) {
    // TODO: Optimizar esto con Spatial Hashing (Prioridad #4)
    // Por ahora, la lógica sigue siendo la misma.
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

        const interactWidth = TILE_PX_WIDTH * 0.8; // Un poco más pequeño que un tile
        const interactHeight = TILE_PX_HEIGHT * 0.8;
        
        const eMinX = entity.x - interactWidth / 2;
        const eMaxX = entity.x + interactWidth / 2;
        const eMinY = entity.y - interactHeight / 2;
        const eMaxY = entity.y + interactHeight / 2;

        // Comprobar si el clic (worldX, worldY) está en esta nueva caja
        if (worldX >= eMinX && worldX <= eMaxX &&
            worldY >= eMinY && worldY <= eMaxY)
        {
            return { entity };
        }
        // --- FIN DE LA NUEVA LÓGICA ---
    }
    return null;
}