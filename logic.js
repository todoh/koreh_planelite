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
} from './entity_components.js';
import { ITEM_DEFINITIONS } from './items.js';


// --- CONFIGURACIÓN DEL JUEGO ---
export const TILE_PX_WIDTH = 70;
export const TILE_PX_HEIGHT = 70;
export const CHUNK_GRID_WIDTH = 60;
export const CHUNK_GRID_HEIGHT = 60;
export const CHUNK_PX_WIDTH = CHUNK_GRID_WIDTH * TILE_PX_WIDTH;
export const CHUNK_PX_HEIGHT = CHUNK_GRID_HEIGHT * TILE_PX_HEIGHT;
export const PLAYER_SPEED = 200; // píxeles por segundo

// --- ESTADO DEL JUEGO (GLOBAL) ---
export const player = {
    x: 0, y: 0, vx: 0, vy: 0, 
    facing: 'down',
    isMovingToTarget: false,
    targetX: 0, targetY: 0
};

export const stats = {
    vida: 1000, vidamax: 1000,
    energia: 1000, energiamax: 1000,
};

// --- MUNDO ACTIVO (RAM) ---
let activeChunks = new Map(); // K: "x,y", V: { terrain: [...], entities: [...] }
let pendingChunkLoads = new Set(); // Evita cargas duplicadas
let dirtyChunks = new Set(); // Chunks modificados que deben guardarse.

let otherPlayers = new Map(); // K: profileName, V: { x, y, stats, name }

// --- ¡MODIFICADO! ASSETS Y DEFINICIONES ---
export let TERRAIN_DATA = {}; // Rellenado por initializeGameLogic
export let ENTITY_DATA = {}; // Rellenado por initializeGameLogic
export const IMAGES = AssetImages;

// --- ¡NUEVO! Callback para abrir menús ---
let openMenuCallback = (menuId) => {
    console.warn(`openMenuCallback no inicializado. Se intentó abrir: ${menuId}`);
};


// --- ¡COMPORTAMIENTOS ELIMINADOS! ---
// const TILE_BEHAVIORS = { ... }; // <-- ELIMINADO


// --- INICIALIZACIÓN ---

export async function initializeGameLogic(callbacks) {
    // Recibir callbacks de main.js
    if (callbacks && callbacks.openMenu) {
        openMenuCallback = callbacks.openMenu;
    }

    // 0. Cargar estado del jugador (sin cambios)
    try {
        const loadedStateJSON = localStorage.getItem("GAME_STATE_LOAD");
        if (loadedStateJSON) {
            console.log("Detectado estado de jugador cargado. Aplicando...");
            const loadedState = JSON.parse(loadedStateJSON);
            
            if (loadedState) {
                player.x = loadedState.x;
                player.y = loadedState.y;
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
            initializeInventory(null);
        }
    } catch (e) {
        console.error("Error al procesar estado de jugador cargado. Usando spawn por defecto.", e);
        player.x = (30.5 * TILE_PX_WIDTH);
        player.y = (30.5 * TILE_PX_HEIGHT);
        localStorage.removeItem("GAME_STATE_LOAD");
        initializeInventory(null);
    }

    // 1. ¡MODIFICADO! Cargar metadata (imágenes y definiciones)
    // initializeMetadata ahora solo carga imágenes y sprites.json
    await initializeMetadata(); 
    
    // 2. ¡NUEVO! Obtener las definiciones procesadas desde entity.js
    TERRAIN_DATA = getTerrainDefinitions();
    ENTITY_DATA = getEntityDefinitions();
    
    // 3. Cargar los primeros chunks
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
// ... (Sin cambios en updateActiveChunks, flushDirtyChunks) ...
export function updateActiveChunks(playerX, playerY) {
    const playerChunkX = Math.floor(playerX / CHUNK_PX_WIDTH);
    const playerChunkY = Math.floor(playerY / CHUNK_PX_HEIGHT);

    // 1. Cargar área activa (3x3 chunks)
for (let y = playerChunkY - 1; y <= playerChunkY + 1; y++) {
        for (let x = playerChunkX - 1; x <= playerChunkX + 1; x++) {
            const chunkKey = `${x},${y}`;
            
            if (!activeChunks.has(chunkKey) && !pendingChunkLoads.has(chunkKey)) {
                pendingChunkLoads.add(chunkKey);
                console.log(`Pidiendo chunk: ${chunkKey}`);
                
                // --- INICIO DE MODIFICACIÓN ---
                getOrGenerateChunk(x, y, chunkKey)
                    .then(result => { // 'chunkData' ahora es 'result'
                        activeChunks.set(chunkKey, result.chunkData);
                        
                        // ¡LA SOLUCIÓN!
                        // Si el chunk es nuevo, marcarlo como sucio
                        // para que se guarde en localStorage.
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
                // --- FIN DE MODIFICACIÓN ---
            }
        }
    }
    
    // 2. Descargar chunks lejanos
    for (const chunkKey of activeChunks.keys()) {
        const [x, y] = chunkKey.split(',').map(Number);
        if (Math.abs(x - playerChunkX) > 2 || Math.abs(y - playerChunkY) > 2) {
            
            // ¡NUEVO! Guardar si está sucio antes de descargar
            if (dirtyChunks.has(chunkKey)) {
                console.log(`Guardando chunk sucio ${chunkKey} antes de descargar...`);
                // "Fire and forget" - No bloqueamos el bucle
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
            // Solo podemos guardar los que siguen en RAM
            promises.push(saveFusedChunk(chunkKey, chunkData));
        }
    }
    await Promise.all(promises);
    dirtyChunks.clear();
    console.log("Chunks sucios guardados.");
}


// --- GESTIÓN DE OTROS JUGADORES ---
// ... (Sin cambios en updateAllPlayers) ...
export function updateAllPlayers(playersData, myProfileName) {
    otherPlayers.clear();
    if (!playersData) return;
    
    for (const profileName in playersData) {
        if (profileName === myProfileName) {
            continue; // Omitirnos a nosotros mismos
        }
        
        const data = playersData[profileName];
        otherPlayers.set(profileName, {
            ...data, // x, y, stats
            key: 'PLAYER', // Usar el sprite de 'PLAYER'
            name: profileName // El nombre a dibujar
        });
    }
}


// --- GESTIÓN DE DATOS EN LA NUBE ---
// ... (Sin cambios en getDirtyChunksData, clearDirtyChunks) ...
export function getDirtyChunksData() {
    const dirtyData = new Map();
    for (const chunkKey of dirtyChunks) {
        const chunkData = activeChunks.get(chunkKey);
        if (chunkData) {
            // Clonar datos si es necesario, aunque set(chunkData) debería estar bien
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
// --- ¡MODIFICADO! ---
function recordDelta(chunkKey, deltaInfo) {
    // 1. Aplicar cambio a la RAM
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
        // --- ¡NUEVO! ---
        case 'REPLACE_ENTITY':
            const index = liveChunk.entities.findIndex(e => e.uid === deltaInfo.uid);
            if (index !== -1) {
                liveChunk.entities[index] = deltaInfo.newEntity;
                console.log(`Entidad ${deltaInfo.uid} reemplazada (ej: crecimiento).`);
            } else {
                console.warn(`No se pudo reemplazar la entidad ${deltaInfo.uid}: no encontrada.`);
                // Por si acaso, la añadimos para evitar que desaparezca
                liveChunk.entities.push(deltaInfo.newEntity);
            }
            break;
        case 'CHANGE_TILE':
            const [x, y] = deltaInfo.localCoord.split(',').map(Number);
             if (liveChunk.terrain[y]) {
                liveChunk.terrain[y][x] = deltaInfo.tileKey;
             }
            break;
        // --- ¡NUEVO! ---
        case 'MOVE_ENTITY':
             const entityToMove = liveChunk.entities.find(e => e.uid === deltaInfo.uid);
             if (entityToMove) {
                entityToMove.x = deltaInfo.x;
                entityToMove.y = deltaInfo.y;
             }
             break;
    }
    
    // 2. ¡NO GUARDAR! Solo marcar como sucio.
    dirtyChunks.add(chunkKey);
}

// ... (Sin cambios en recordDeltaFromEntity) ...
function recordDeltaFromEntity(entity, deltaInfo) {
    const chunkX = Math.floor(entity.x / CHUNK_PX_WIDTH);
    const chunkY = Math.floor(entity.y / CHUNK_PX_HEIGHT);
    const chunkKey = `${chunkX},${chunkY}`;
    recordDelta(chunkKey, deltaInfo);
}


// --- LÓGICA DE JUEGO (LLAMADA DESDE MAIN) ---

// --- ¡MODIFICADO! ---
export function getMapTileKey(gridX, gridY) {
    const chunkX = Math.floor(gridX / CHUNK_GRID_WIDTH);
    const chunkY = Math.floor(gridY / CHUNK_GRID_HEIGHT);
    const chunkKey = `${chunkX},${chunkY}`;
    const chunk = activeChunks.get(chunkKey);
    if (!chunk) return 'WALL'; 
    const localX = ((gridX % CHUNK_GRID_WIDTH) + CHUNK_GRID_WIDTH) % CHUNK_GRID_WIDTH;
    const localY = ((gridY % CHUNK_GRID_HEIGHT) + CHUNK_GRID_HEIGHT) % CHUNK_GRID_HEIGHT;
    if (chunk.terrain[localY] && chunk.terrain[localY][localX]) {
        // Asegurarse de que el tile de terreno existe, si no, devolver 'DIRT'
        const tileKey = chunk.terrain[localY][localX];
        return TERRAIN_DATA[tileKey] ? tileKey : 'DIRT';
    }
    return 'WALL';
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
                key: getMapTileKey(x, y), // Clave del terreno
                x: x * TILE_PX_WIDTH,
                y: y * TILE_PX_HEIGHT,
                zIndex: (y * TILE_PX_HEIGHT), 
                isGround: true,
                name: null, // El terreno no tiene nombre para dibujar
            });
        }
    }


    // 2. Recopilar ENTIDADES
    for (const chunk of activeChunks.values()) {
        for (const entity of chunk.entities) {
            // --- ¡NUEVA LÓGICA DE COMPONENTES! ---
            const renderComp = entity.components.Renderable;
            if (!renderComp) continue; // No dibujable
            
            const img = IMAGES[renderComp.imageKey]; 
            const imgHeight = img ? img.height : TILE_PX_HEIGHT;
            const imgWidth = img ? img.width : TILE_PX_WIDTH;
            // --- Fin Lógica Componentes ---

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
                continue; // No renderizar
            }
            
            objectsToRender.push({
                key: renderComp.imageKey, // Clave de la imagen
                x: entity.x,
                y: entity.y,
                zIndex: entity.y, 
                isGround: false,
                name: null, // Las entidades no dibujan su nombre (aún)
            });
        }
    }

    // 3. Añadir JUGADOR (Nosotros)
    objectsToRender.push({
        key: 'PLAYER',
        x: player.x,
        y: player.y,
        zIndex: player.y,
        isGround: false,
        name: null,
    });
    
    // 4. ¡NUEVO! Añadir OTROS JUGADORES
    for (const [name, p] of otherPlayers.entries()) {
        const img = IMAGES[p.key]; // p.key sigue siendo 'PLAYER'
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
            continue; // No renderizar
        }
        
        objectsToRender.push({
            key: p.key,
            x: p.x,
            y: p.y,
            zIndex: p.y,
            isGround: false,
            name: p.name // ¡Importante! El renderizador dibujará esto
        });
    }
    
    // 5. Y-SORTING
    objectsToRender.sort((a, b) => a.zIndex - b.zIndex);
    
    return objectsToRender;
}

// --- ¡MODIFICADO! ---
function findEntityAt(worldX, worldY) {
    const chunkX = Math.floor(worldX / CHUNK_PX_WIDTH);
    const chunkY = Math.floor(worldY / CHUNK_PX_HEIGHT);
    const chunk = activeChunks.get(`${chunkX},${chunkY}`);
    if (!chunk) return null;

    for (let i = chunk.entities.length - 1; i >= 0; i--) {
        const entity = chunk.entities[i];
        
        // --- ¡NUEVA LÓGICA DE COMPONENTES! ---
        // 1. Debe ser interactuable
        if (!entity.components.InteractableResource &&
            !entity.components.InteractableDialogue &&
            !entity.components.InteractableMenu) {
            continue; 
        }

        // 2. Usar su caja de colisión para el clic
        const colComp = entity.components.Collision;
        if (!colComp) continue; // Si no tiene colisión, no se puede clickear (¿o sí? por ahora no)

        // Usar caja de colisión o una caja por defecto generosa
        const clickBox = colComp.collisionBox || { 
            width: TILE_PX_WIDTH * 0.8, 
            height: TILE_PX_HEIGHT * 0.8, 
            offsetY: TILE_PX_HEIGHT * 0.8 
        };
        // --- Fin Lógica Componentes ---
        
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
    const target = findEntityAt(worldX, worldY);
    
    // 1. Clic en Entidad Interactuable
    if (target) {
        player.isMovingToTarget = false;
        const dx = player.x - target.entity.x;
        const dy = player.y - target.entity.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        if (distance < TILE_PX_WIDTH * 1.5) {
            // ¡Llamar al sistema de interacción!
            return playerInteract(target.entity);
        } else {
            return { message: "Estás demasiado lejos." };
        }
    }

    // 2. Clic en el Terreno
    const gridX = Math.floor(worldX / TILE_PX_WIDTH);
    const gridY = Math.floor(worldY / TILE_PX_HEIGHT);
    const groundTileKey = getMapTileKey(gridX, gridY);

    if (TERRAIN_DATA[groundTileKey]?.solid) {
        player.isMovingToTarget = false; 
        return { message: "No puedes caminar ahí." };
    }
    
    // (La comprobación de colisión con entidad en tap se elimina,
    // findEntityAt ahora solo devuelve entidades *interactuables*)
    
    // 3. Moverse al punto
    player.isMovingToTarget = true;
    player.targetX = worldX;
    player.targetY = worldY;
    return { message: null };
}

// --- ¡MODIFICADO! ---
function checkCollision(pixelX, pixelY, entityToIgnore = null) {
    // 1. Colisión con el mapa (suelo)
    const gridX = Math.floor(pixelX / TILE_PX_WIDTH);
    const gridY = Math.floor(pixelY / TILE_PX_HEIGHT);
    const groundTileKey = getMapTileKey(gridX, gridY);
    if (TERRAIN_DATA[groundTileKey]?.solid) {
        return { solid: true, type: 'map' };
    }

    // 2. Colisión con entidades
    const chunkX = Math.floor(pixelX / CHUNK_PX_WIDTH);
    const chunkY = Math.floor(pixelY / CHUNK_PX_HEIGHT);
    for (let y = chunkY - 1; y <= chunkY + 1; y++) {
        for (let x = chunkX - 1; x <= chunkX + 1; x++) {
            const chunk = activeChunks.get(`${x},${y}`);
            if (!chunk) continue;
            
            for (const entity of chunk.entities) {
                // --- ¡MODIFICADO! Ignorar entidad específica (para IA) ---
                if (entityToIgnore && entity.uid === entityToIgnore.uid) {
                    continue;
                }

                // --- ¡NUEVA LÓGICA DE COMPONENTES! ---
                const colComp = entity.components.Collision;
                if (!colComp || !colComp.isSolid) continue; 
                
                const eBox = colComp.collisionBox || { 
                    width: TILE_PX_WIDTH * 0.8, 
                    height: TILE_PX_HEIGHT * 0.4, 
                    offsetY: TILE_PX_HEIGHT * 0.4 
                };
                // --- Fin Lógica Componentes ---
                
                const eMinX = entity.x - eBox.width / 2;
                const eMaxX = entity.x + eBox.width / 2;
                const eMinY = entity.y - eBox.offsetY;
                const eMaxY = entity.y - eBox.offsetY + eBox.height;

                // --- ¡MODIFICADO! Determinar la caja del "colisionador" ---
                let pBox;
                if (entityToIgnore) {
                    // Si estamos comprobando una entidad (IA), usamos su propia caja
                    const pColComp = entityToIgnore.components.Collision;
                    pBox = pColComp ? pColComp.collisionBox : eBox; // Fallback a eBox si es necesario
                } else {
                    // Si no (jugador), usamos la caja del jugador
                    const pDef = ENTITY_DATA['PLAYER'];
                    const pCompDef = pDef.components.find(c => c.type === 'Collision');
                    pBox = pCompDef.args[1]; // La collisionBox es el segundo argumento
                }
                
                const pMinX = pixelX - pBox.width / 2;
                const pMaxX = pixelX + pBox.width / 2;
                const pMinY = pixelY - pBox.offsetY;
                const pMaxY = pixelY - pBox.offsetY + pBox.height;

                if (pMinX < eMaxX && pMaxX > eMinX && pMinY < eMaxY && pMaxY > eMinY) {
                    return { solid: true, type: 'entity', entity: entity };
                }
            }
        }
    }
    return { solid: false };
}

// --- ¡MODIFICADO! ---
export function updatePlayer(deltaTime, input) {
    let message = null;
    
    // ... (Lógica de movimiento del jugador sin cambios) ...
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

        player.vx = baseVx * PLAYER_SPEED;
        player.vy = baseVy * PLAYER_SPEED;
    }
    else if (player.isMovingToTarget) {
        const dx = player.targetX - player.x;
        const dy = player.targetY - player.y;
        const distance = Math.sqrt(dx*dx + dy*dy);

        if (distance < 10) {
            player.isMovingToTarget = false;
            player.vx = 0; player.vy = 0;
        } else {
            player.vx = (dx / distance) * PLAYER_SPEED;
            player.vy = (dy / distance) * PLAYER_SPEED;
        }
    } else {
        player.vx = 0; player.vy = 0;
    }

    if (player.vx !== 0 || player.vy !== 0) {
        let newX = player.x + player.vx * deltaTime;
        let newY = player.y + player.vy * deltaTime;

        // --- ¡MODIFICADO! checkCollision ahora no toma argumentos extra ---
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

    // --- ¡NUEVO! Sistema "OnEnter" (Collectible) ---
    const chunkX = Math.floor(player.x / CHUNK_PX_WIDTH);
    const chunkY = Math.floor(player.y / CHUNK_PX_HEIGHT);
    const chunk = activeChunks.get(`${chunkX},${chunkY}`);
    if(chunk) {
        // Recorrer en reversa por si eliminamos una
        for (let i = chunk.entities.length - 1; i >= 0; i--) {
            const entity = chunk.entities[i];
            const comp = entity.components.Collectible;
            
            if (comp) {
                const dx = player.x - entity.x;
                const dy = player.y - entity.y;
                const distance = Math.sqrt(dx*dx + dy*dy);
                const enterRadius = TILE_PX_WIDTH / 2; // Radio de recolección
                
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

// --- ¡NUEVO! Sistema de Crecimiento y otros (llamado desde main.js) ---
export function updateEntities(deltaTime) {
    const deltaMs = deltaTime * 1000;

    for (const chunkKey of activeChunks.keys()) {
        const chunk = activeChunks.get(chunkKey);
        
        // Usar un índice normal por si reemplazamos (crecimiento)
        for (let i = 0; i < chunk.entities.length; i++) {
            const entity = chunk.entities[i];
            
            // Si la entidad fue eliminada (ej. por crecimiento), puede ser nula
            if (!entity) continue; 
            
            const comps = entity.components;

            // --- Sistema de Crecimiento ---
            if (comps.Growth) {
                comps.Growth.currentTime += deltaMs;
                if (comps.Growth.currentTime >= comps.Growth.timeToGrowMs) {
                    // ¡Hora de crecer!
                    // Re-usamos el UID, pero creamos una entidad nueva
                    const newEntity = createEntity(comps.Growth.nextEntityKey, entity.x, entity.y, entity.uid);
                    if (newEntity) {
                        // Reemplazar la entidad en el chunk
                        recordDelta(chunkKey, { 
                            type: 'REPLACE_ENTITY', 
                            uid: entity.uid, 
                            newEntity: newEntity 
                        });
                        // chunk.entities[i] = newEntity; // Aplicación directa (recordDelta ya lo hace)
                    }
                }
            }
            
            // --- ¡MODIFICADO! Sistema de Movimiento AI ---
            if (comps.MovementAI) {
                const ai = comps.MovementAI;
                ai.timeUntilNextAction -= deltaMs;

                if (ai.timeUntilNextAction <= 0) {
                    // 1. Elegir nueva acción
                    ai.timeUntilNextAction = (Math.random() * 3000) + 2000; // Entre 2 y 5 segundos

                    const action = Math.random();
                    if (action < 0.6) { // 60% probabilidad de quedarse quieto
                        ai.currentVelocity.x = 0;
                        ai.currentVelocity.y = 0;
                    } else { // 40% probabilidad de moverse
                        const angle = Math.random() * Math.PI * 2;
                        ai.currentVelocity.x = Math.cos(angle) * ai.speed;
                        ai.currentVelocity.y = Math.sin(angle) * ai.speed;
                    }
                }

                // 2. Aplicar movimiento
                if (ai.currentVelocity.x !== 0 || ai.currentVelocity.y !== 0) {
                    let newX = entity.x + ai.currentVelocity.x * deltaTime;
                    let newY = entity.y + ai.currentVelocity.y * deltaTime;

                    let newChunkKey = chunkKey;
                    
                    // Comprobar colisión (¡pasando la entidad a ignorar!)
                    if (!checkCollision(newX, entity.y, entity).solid) {
                        entity.x = newX;
                    } else {
                        ai.currentVelocity.x = 0; // Detenerse si choca
                        ai.timeUntilNextAction = 500; // Elegir nueva acción pronto
                    }
                    
                    if (!checkCollision(entity.x, newY, entity).solid) {
                        entity.y = newY;
                    } else {
                        ai.currentVelocity.y = 0; // Detenerse si choca
                        ai.timeUntilNextAction = 500; // Elegir nueva acción pronto
                    }

                    // 3. Marcar el chunk como sucio
                    // (Necesitamos comprobar si la entidad se movió a un nuevo chunk)
                    const newChunkX = Math.floor(entity.x / CHUNK_PX_WIDTH);
                    const newChunkY = Math.floor(entity.y / CHUNK_PX_HEIGHT);
                    newChunkKey = `${newChunkX},${newChunkY}`;

                    if (newChunkKey !== chunkKey) {
                        // La entidad cambió de chunk
                        console.log(`NPC ${entity.uid} se movió a ${newChunkKey}`);
                        // Eliminar de este chunk
                        const entityToMove = chunk.entities.splice(i, 1)[0];
                        i--; // Ajustar índice del bucle
                        
                        // Añadir al nuevo chunk
                        const newChunk = activeChunks.get(newChunkKey);
                        if (newChunk) {
                            newChunk.entities.push(entityToMove);
                            dirtyChunks.add(newChunkKey);
                        } else {
                             // Ups, el chunk no está cargado. La entidad se perderá.
                             // Esto es un bug conocido por ahora.
                             console.warn(`NPC ${entity.uid} intentó moverse al chunk descargado ${newChunkKey}.`);
                        }
                    } 
                    
                    dirtyChunks.add(chunkKey); // Marcar el chunk (original o nuevo) como sucio
                }
            }
        }
    }
}


// --- ¡MODIFICADO! Sistema de Interacción ---
export function playerInteract(targetEntity = null) {
    let entityToInteract = targetEntity;

    // 1. Si no nos pasaron una entidad (ej: por tap), buscar una (ej: por tecla espacio)
    if (!entityToInteract) {
        let targetX = player.x, targetY = player.y;
        const reach = TILE_PX_WIDTH * 1.5;

        if (player.facing === 'up') targetY -= reach;
        if (player.facing === 'down') targetY += reach;
        if (player.facing === 'left') targetX -= reach;
        if (player.facing === 'right') targetX += reach;

        let closestDist = Infinity;
        const chunkX = Math.floor(player.x / CHUNK_PX_WIDTH);
        const chunkY = Math.floor(player.y / CHUNK_PX_HEIGHT);
        
        for (let y = chunkY - 1; y <= chunkY + 1; y++) {
             for (let x = chunkX - 1; x <= chunkX + 1; x++) {
                const chunk = activeChunks.get(`${x},${y}`);
                if (!chunk) continue;
                
                for (const entity of chunk.entities) {
                    // --- ¡NUEVA LÓGICA DE COMPONENTES! ---
                    // 1. Debe ser interactuable
                    if (!entity.components.InteractableResource &&
                        !entity.components.InteractableDialogue &&
                        !entity.components.InteractableMenu) {
                        continue; 
                    }
                    
                    // 2. Usar su caja de colisión para el rango
                    const colComp = entity.components.Collision;
                    if (!colComp) continue;
                    // --- Fin Lógica Componentes ---

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
    }
    
    // 2. Procesar la entidad encontrada (si hay una)
    if (entityToInteract) {
        const comps = entityToInteract.components;
        
        // --- Sistema de Interacción: Prioridad de componentes ---

        // A. ¿Es un Recurso?
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
        
        // B. ¿Es un Menú?
        if (comps.InteractableMenu) {
            const comp = comps.InteractableMenu;
            openMenuCallback(comp.menuId); // ¡Llama al callback de UI!
            const entityDef = ENTITY_DATA[entityToInteract.key];
            return { message: `Abriendo ${entityDef.name}...` };
        }

        // C. ¿Es un Diálogo?
        if (comps.InteractableDialogue) {
            const comp = comps.InteractableDialogue;
            return { message: comp.message };
        }
    }

    return { message: "No hay nada con qué interactuar ahí." };
}

// ... (Sin cambios en checkGameStatus) ...
export function checkGameStatus() {
    if (stats.vida <= 0) return { alive: false, message: "Has muerto." };
    if (stats.energia <= 0) {
        stats.energia = 0;
        return { alive: true, message: "¡Estás sin energía!" };
    }
    return { alive: true, message: null };
}