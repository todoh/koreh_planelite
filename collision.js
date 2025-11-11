// --- collision.js ---
// Contiene el sistema de detección de colisiones.

import { 
    player, 
    ENTITY_DATA, 
    TERRAIN_DATA,
    TILE_PX_WIDTH,
    TILE_PX_HEIGHT,
    CHUNK_PX_WIDTH, // <-- ¡AÑADIDO!
    CHUNK_PX_HEIGHT // <-- ¡AÑADIDO!
} from './logic.js';

import { 
    getActiveChunk,
    getMapTileKey, 
    findEntityByUid 
} from './world.js';

/**
 * Comprueba si una posición en píxeles colisiona con el mapa o con entidades.
 * @param {number} pixelX - Posición X del ancla (pies) de la entidad
 * @param {number} pixelY - Posición Y del ancla (pies) de la entidad
 * @param {object|null} entityToIgnore - La propia entidad que se mueve (para no chocar consigo misma)
 * @param {object|null} collisionBoxOverride - ¡AÑADIDO! Una caja de colisión para usar en lugar de la del jugador.
 * @returns {object} { solid: boolean, type?: string, entity?: object }
 */
export function checkCollision(pixelX, pixelY, entityToIgnore = null, collisionBoxOverride = null) {
    
    // 1. Obtener la Z correcta
    // Si es una IA moviéndose, usa su Z. Si no (jugador), usa la Z del jugador.
    const gridZ = entityToIgnore ? entityToIgnore.z : player.z;

    // 2. Colisión con el mapa (suelo)
    const gridX = Math.floor(pixelX / TILE_PX_WIDTH);
    const gridY = Math.floor(pixelY / TILE_PX_HEIGHT);
    const groundTileKey = getMapTileKey(gridX, gridY, gridZ); // <-- ¡PASAR Z!
    
    if (TERRAIN_DATA[groundTileKey]?.solid) {
        return { solid: true, type: 'map' };
    }

    // 3. Colisión con entidades
    // Solo colisionaremos con entidades en el mismo Z-level.
    const chunkX = Math.floor(pixelX / CHUNK_PX_WIDTH);
    const chunkY = Math.floor(pixelY / CHUNK_PX_HEIGHT);
    const chunkKey = `${chunkX},${chunkY},${gridZ}`; // <-- ¡USAR Z!

    // ¡Optimización! Solo comprobar el chunk actual.
    const chunk = getActiveChunk(chunkKey);
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
        if (collisionBoxOverride) {
            // --- ¡NUEVO! Caso 1: Se proporciona una caja (para construcción)
            pBox = collisionBoxOverride;
        } else if (entityToIgnore) {
            // Caso 2: Es una IA u otra entidad moviéndose
            const pColComp = entityToIgnore.components.Collision;
            // Usar su propia caja o, como fallback, la caja de la entidad con la que choca (eBox)
            const entityBox = (pColComp && pColComp.collisionBox) ? pColComp.collisionBox : null;
            pBox = entityBox || eBox; 
        } else {
            // Caso 3: Es el jugador (movimiento normal)
            let pEntityKey = 'PLAYER';
            if (player.mountedVehicleUid) {
                const vehicle = findEntityByUid(player.mountedVehicleUid);
                if(vehicle) pEntityKey = vehicle.key;
            }
            const pDef = ENTITY_DATA[pEntityKey];
            // Asegurarse de que pDef y el componente existen
            const pCompDef = pDef?.components.find(c => c.type === 'Collision');
            pBox = pCompDef?.args[1]; // Usar la caja de colisión del jugador (o vehiculo)

            // Fallback MUY importante si la def del jugador/vehículo falla
            if (!pBox) {
                 console.warn(`No se encontró pBox para ${pEntityKey}, usando fallback.`);
                 pBox = { width: 40, height: 20, offsetY: 40 };
            }
        }
        
        const pMinX = pixelX - pBox.width / 2;
        const pMaxX = pixelX + pBox.width / 2;
        const pMinY = pixelY - pBox.offsetY;
        const pMaxY = pixelY - pBox.offsetY + pBox.height;

        // Comprobación AABB
        if (pMinX < eMaxX && pMaxX > eMinX && pMinY < eMaxY && pMaxY > eMinY) {
            return { solid: true, type: 'entity', entity: entity };
        }
    }
    
    return { solid: false };
}