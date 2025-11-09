// --- logic.js ---
// Contiene el ESTADO (Modelo) y las REGLAS del juego.
// Gestiona el "mundo activo" (chunks en RAM).

import { 
    initializeMetadata, 
    getOrGenerateChunk, 
    saveFusedChunk, 
    TILES as Metadata, 
    IMAGES as AssetImages 
} from './generation.js';

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
    oro: 0, madera: 0, piedra: 0,
};

// --- MUNDO ACTIVO (RAM) ---
let activeChunks = new Map(); // K: "x,y", V: { terrain: [...], entities: [...] }
let pendingChunkLoads = new Set(); // Evita cargas duplicadas
let dirtyChunks = new Set(); // Chunks modificados que deben guardarse.

// ¡NUEVO! Almacén para otros jugadores
let otherPlayers = new Map(); // K: profileName, V: { x, y, stats, name }

// --- ASSETS (RE-EXPORTADOS) ---
export const TILES = Metadata;
export const IMAGES = AssetImages;

// --- REGLAS DEL JUEGO (COMPORTAMIENTOS) ---
const TILE_BEHAVIORS = {
    TREE: {
        onInteract: (entity) => {
            stats.madera++;
            stats.energia -= 2;
            recordDeltaFromEntity(entity, {
                type: 'REMOVE_ENTITY',
                uid: entity.uid
            });
            return `Has talado un árbol. Tienes ${stats.madera} de madera.`;
        }
    },
    ROCK: {
        onInteract: (entity) => {
            stats.piedra++;
            stats.energia--;
             recordDeltaFromEntity(entity, {
                type: 'REMOVE_ENTITY',
                uid: entity.uid
            });
            return `Has picado una roca. Tienes ${stats.piedra} de piedra.`;
        }
    },
    NPC: {
        onInteract: () => '¡Este mundo es procedural!'
    },
    ITEM: {
        onEnter: (entity) => {
            stats.oro += 10;
             recordDeltaFromEntity(entity, {
                type: 'REMOVE_ENTITY',
                uid: entity.uid
            });
            return '¡Has encontrado 10 de oro!';
        }
    },
    STATUE: {
        onInteract: () => 'Una estatua imponente. Marca el spawn (0,0).'
    }
};

// --- INICIALIZACIÓN ---

export async function initializeGameLogic() {
    // 0. Comprobar si hay un estado de jugador para cargar
    try {
        const loadedStateJSON = localStorage.getItem("GAME_STATE_LOAD");
        if (loadedStateJSON) {
            console.log("Detectado estado de jugador cargado. Aplicando...");
            const loadedState = JSON.parse(loadedStateJSON);
            // Si el estado cargado es null (raro, pero posible si no había playerState)
            if (loadedState) {
                player.x = loadedState.x;
                player.y = loadedState.y;
                Object.assign(stats, loadedState.stats);
            } else {
                throw new Error("El estado del jugador cargado era nulo.");
            }
            localStorage.removeItem("GAME_STATE_LOAD");
        } else {
            console.log("No hay estado de jugador. Empezando en spawn por defecto.");
            player.x = (0.5 * CHUNK_GRID_WIDTH) * TILE_PX_WIDTH;
            player.y = (0.5 * CHUNK_GRID_HEIGHT) * TILE_PX_HEIGHT;
        }
    } catch (e) {
        console.error("Error al procesar estado de jugador cargado. Usando spawn por defecto.", e);
        player.x = (0.5 * CHUNK_GRID_WIDTH) * TILE_PX_WIDTH;
        player.y = (0.5 * CHUNK_GRID_HEIGHT) * TILE_PX_HEIGHT;
        localStorage.removeItem("GAME_STATE_LOAD");
    }

    // 1. Cargar metadata e imágenes
    await initializeMetadata();

    // 2. Adjuntar comportamientos a la metadata
    for (const key in TILE_BEHAVIORS) {
        if (TILES[key]) {
            TILES[key].onInteract = TILE_BEHAVIORS[key].onInteract;
            TILES[key].onEnter = TILE_BEHAVIORS[key].onEnter;
        }
    }
    
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

/**
 * Asegura que los chunks alrededor del jugador estén cargados.
 */
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
                
                getOrGenerateChunk(x, y, chunkKey)
                    .then(chunkData => {
                        activeChunks.set(chunkKey, chunkData);
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

/**
 * ¡NUEVO! Fuerza el guardado de todos los chunks sucios en RAM.
 * Se llama antes de guardar la partida (guardado LOCAL).
 */
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

// --- ¡NUEVO! GESTIÓN DE OTROS JUGADORES ---

/**
 * ¡NUEVO! Actualiza la lista interna de otros jugadores.
 * @param {object} playersData - El objeto completo de /playerStates_v2
 * @param {string} myProfileName - Nuestro nombre, para excluirnos
 */
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


// --- ¡FIN DE GESTIÓN DE OTROS JUGADORES! ---


// --- ¡INICIO DE NUEVAS FUNCIONES PARA LA NUBE! ---

/**
 * ¡NUEVO! Obtiene los datos de los chunks sucios en RAM
 * sin limpiarlos ni guardarlos en local.
 * Usado por cloud.js
 * @returns {Map<string, object>} Un mapa de { chunkKey: chunkData }
 */
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

/**
 * ¡NUEVO! Limpia el set de chunks sucios.
 * Se llama después de un guardado exitoso en la nube.
 */
export function clearDirtyChunks() {
    console.log(`clearDirtyChunks: Limpiando ${dirtyChunks.size} chunks sucios.`);
    dirtyChunks.clear();
}
// --- ¡FIN DE NUEVAS FUNCIONES PARA LA NUBE! ---


/**
 * Registra un cambio en la RAM y MARCA el chunk como sucio.
 * @param {string} chunkKey 
 * @param {object} deltaInfo (Info sobre qué cambiar)
 */
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
        case 'CHANGE_TILE':
            const [x, y] = deltaInfo.localCoord.split(',').map(Number);
             if (liveChunk.terrain[y]) {
                liveChunk.terrain[y][x] = deltaInfo.tileKey;
             }
            break;
    }
    
    // 2. ¡NO GUARDAR! Solo marcar como sucio.
    dirtyChunks.add(chunkKey);
    // La llamada a saveFusedChunk(chunkKey, liveChunk) se ha eliminado.
}


/**
 * Helper para encontrar el chunkKey de una entidad
 * @param {object} entity 
 */
function recordDeltaFromEntity(entity, deltaInfo) {
    const chunkX = Math.floor(entity.x / CHUNK_PX_WIDTH);
    const chunkY = Math.floor(entity.y / CHUNK_PX_HEIGHT);
    const chunkKey = `${chunkX},${chunkY}`;
    recordDelta(chunkKey, deltaInfo);
}


// --- LÓGICA DE JUEGO (LLAMADA DESDE MAIN) ---

export function getMapTileKey(gridX, gridY) {
    const chunkX = Math.floor(gridX / CHUNK_GRID_WIDTH);
    const chunkY = Math.floor(gridY / CHUNK_GRID_HEIGHT);
    const chunkKey = `${chunkX},${chunkY}`;
    const chunk = activeChunks.get(chunkKey);
    if (!chunk) return 'WALL'; 
    const localX = ((gridX % CHUNK_GRID_WIDTH) + CHUNK_GRID_WIDTH) % CHUNK_GRID_WIDTH;
    const localY = ((gridY % CHUNK_GRID_HEIGHT) + CHUNK_GRID_HEIGHT) % CHUNK_GRID_HEIGHT;
    if (chunk.terrain[localY] && chunk.terrain[localY][localX]) {
        return chunk.terrain[localY][localX];
    }
    return 'WALL';
}

/**
 * ¡MODIFICADO! Ahora incluye a los otros jugadores.
 */
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
                key: getMapTileKey(x, y),
                x: x * TILE_PX_WIDTH,
                y: y * TILE_PX_HEIGHT,
                zIndex: (y * TILE_PX_HEIGHT), 
                isGround: true
            });
        }
    }


    // 2. Recopilar ENTIDADES
    for (const chunk of activeChunks.values()) {
        for (const entity of chunk.entities) {
            const img = IMAGES[entity.key]; 
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
                continue; // No renderizar
            }
            
            objectsToRender.push({
                ...entity,
                zIndex: entity.y, 
                isGround: false
            });
        }
    }

    // 3. Añadir JUGADOR (Nosotros)
    objectsToRender.push({
        key: 'PLAYER',
        x: player.x,
        y: player.y,
        zIndex: player.y,
        isGround: false
    });
    
    // 4. ¡NUEVO! Añadir OTROS JUGADORES
    for (const [name, p] of otherPlayers.entries()) {
        // Simple comprobación de AABB (como las entidades)
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
            continue; // No renderizar
        }
        
        objectsToRender.push({
            key: p.key,
            x: p.x,
            y: p.y,
            zIndex: p.y,
            isGround: false,
            name: p.name // ¡Importante!
        });
    }
    
    // 5. Y-SORTING
    objectsToRender.sort((a, b) => a.zIndex - b.zIndex);
    
    return objectsToRender;
}

function findEntityAt(worldX, worldY) {
    const chunkX = Math.floor(worldX / CHUNK_PX_WIDTH);
    const chunkY = Math.floor(worldY / CHUNK_PX_HEIGHT);
    const chunk = activeChunks.get(`${chunkX},${chunkY}`);
    if (!chunk) return null;

    for (let i = chunk.entities.length - 1; i >= 0; i--) {
        const entity = chunk.entities[i];
        const def = TILES[entity.key];
        if (!def) continue;

        const clickWidth = (def.collisionBox?.width || TILE_PX_WIDTH * 0.8);
        const clickHeight = (def.collisionBox?.height || TILE_PX_HEIGHT * 0.8);
        const offsetY = (def.collisionBox?.offsetY || TILE_PX_HEIGHT * 0.8);
        const eX = entity.x - clickWidth / 2;
        const eY = entity.y - offsetY;
        
        if (worldX >= eX && worldX <= eX + clickWidth &&
            worldY >= eY && worldY <= eY + clickHeight) 
        {
            return { entity };
        }
    }
    return null;
}

export function handleWorldTap(worldX, worldY) {
    const target = findEntityAt(worldX, worldY);
    
    if (target && TILES[target.entity.key]?.onInteract) {
        player.isMovingToTarget = false;
        const dx = player.x - target.entity.x;
        const dy = player.y - target.entity.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        if (distance < TILE_PX_WIDTH * 1.5) {
            const message = TILES[target.entity.key].onInteract(target.entity);
            return { message };
        } else {
            return { message: "Estás demasiado lejos." };
        }
    }

    const gridX = Math.floor(worldX / TILE_PX_WIDTH);
    const gridY = Math.floor(worldY / TILE_PX_HEIGHT);
    const groundTileKey = getMapTileKey(gridX, gridY);

    if (TILES[groundTileKey]?.solid) {
        player.isMovingToTarget = false; 
        return { message: "No puedes caminar ahí." };
    }
    if (target && TILES[target.entity.key]?.solid) {
         player.isMovingToTarget = false; 
        return { message: `No puedes caminar a través de: ${TILES[target.entity.key].name}` };
    }

    player.isMovingToTarget = true;
    player.targetX = worldX;
    player.targetY = worldY;
    return { message: null };
}

function checkCollision(pixelX, pixelY) {
    // 1. Colisión con el mapa (suelo)
    const gridX = Math.floor(pixelX / TILE_PX_WIDTH);
    const gridY = Math.floor(pixelY / TILE_PX_HEIGHT);
    const groundTileKey = getMapTileKey(gridX, gridY);
    if (TILES[groundTileKey]?.solid) {
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
                const def = TILES[entity.key];
                if (!def || !def.solid) continue; 
                
                const eBox = def.collisionBox || { width: TILE_PX_WIDTH * 0.8, height: TILE_PX_HEIGHT * 0.4, offsetY: TILE_PX_HEIGHT * 0.4 };
                const eMinX = entity.x - eBox.width / 2;
                const eMaxX = entity.x + eBox.width / 2;
                const eMinY = entity.y - eBox.offsetY;
                const eMaxY = entity.y - eBox.offsetY + eBox.height;

                const pDef = TILES['PLAYER'];
                const pBox = pDef.collisionBox;
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

export function updatePlayer(deltaTime, input) {
    let message = null;
    
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

    // Comprobar onEnter
    const chunkX = Math.floor(player.x / CHUNK_PX_WIDTH);
    const chunkY = Math.floor(player.y / CHUNK_PX_HEIGHT);
    const chunk = activeChunks.get(`${chunkX},${chunkY}`);
    if(chunk) {
        for (const entity of chunk.entities) {
            const def = TILES[entity.key];
            if (def && def.onEnter) {
                const dx = player.x - entity.x;
                const dy = player.y - entity.y;
                const distance = Math.sqrt(dx*dx + dy*dy);
                const enterRadius = (def.collisionBox?.width || TILE_PX_WIDTH) / 2;
                
                if (distance < enterRadius) {
                    message = def.onEnter(entity);
                }
            }
        }
    }
    
    return { message };
}

export function playerInteract() {
    let targetX = player.x, targetY = player.y;
    const reach = TILE_PX_WIDTH * 1.5;

    if (player.facing === 'up') targetY -= reach;
    if (player.facing === 'down') targetY += reach;
    if (player.facing === 'left') targetX -= reach;
    if (player.facing === 'right') targetX += reach;

    let closestEntity = null;
    let closestDist = Infinity;

    const chunkX = Math.floor(player.x / CHUNK_PX_WIDTH);
    const chunkY = Math.floor(player.y / CHUNK_PX_HEIGHT);
    
    for (let y = chunkY - 1; y <= chunkY + 1; y++) {
         for (let x = chunkX - 1; x <= chunkX + 1; x++) {
            const chunk = activeChunks.get(`${x},${y}`);
            if (!chunk) continue;
            
            for (const entity of chunk.entities) {
                const def = TILES[entity.key];
                if (!def || !def.onInteract) continue; 

                const dx = entity.x - targetX;
                const dy = entity.y - targetY;
                const distance = Math.sqrt(dx*dx + dy*dy);
                const interactRadius = (def.collisionBox?.width || TILE_PX_WIDTH) * 0.8; 
                
                if (distance < interactRadius && distance < closestDist) {
                    closestDist = distance;
                    closestEntity = entity;
                }
            }
        }
    }
    
    if (closestEntity) {
        const message = TILES[closestEntity.key].onInteract(closestEntity);
        return { message };
    }

    return { message: "No hay nada con qué interactuar ahí." };
}

export function checkGameStatus() {
    if (stats.vida <= 0) return { alive: false, message: "Has muerto." };
    if (stats.energia <= 0) {
        stats.energia = 0;
        return { alive: true, message: "¡Estás sin energía!" };
    }
    return { alive: true, message: null };
}