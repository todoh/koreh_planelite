// --- entity_system.js ---
// Gestiona las actualizaciones de todas las entidades no-jugador (IA, crecimiento, etc.)
// --- ¡MODIFICADO! ---
// Ahora itera sobre listas pre-filtradas de world.js
// en lugar de iterar todos los chunks.

import { createEntity } from './entity.js';
import { 
    recordDelta,
    moveEntityToNewChunk,
    getChunkKeyForEntity,
    activeAiEntities,     // <-- ¡NUEVA IMPORTACIÓN!
    activeGrowthEntities  // <-- ¡NUEVA IMPORTACIÓN!
} from './world.js';
import { checkCollision } from './collision.js';
import { 
    CHUNK_PX_WIDTH, 
    CHUNK_PX_HEIGHT 
} from './logic.js';


/**
 * ¡FUNCIÓN REESCRITA PARA OPTIMIZACIÓN DE CPU!
 * Actualiza todas las entidades activas (IA, crecimiento).
 * Se llama en cada frame desde main.js.
 * @param {number} deltaTime - Tiempo en segundos desde el último frame
 */
export function updateEntities(deltaTime) {
    const deltaMs = deltaTime * 1000;

    // --- Sistema de Crecimiento ---
    // Itera solo la lista de entidades que pueden crecer
    for (const entity of activeGrowthEntities) {
        const comps = entity.components; // Ya sabemos que comps.Growth existe
        
        comps.Growth.currentTime += deltaMs;
        if (comps.Growth.currentTime >= comps.Growth.timeToGrowMs) {
            const newEntity = createEntity(
                comps.Growth.nextEntityKey, 
                entity.x, 
                entity.y, 
                entity.z, // Pasar Z
                entity.uid // Reusar UID
            );
            if (newEntity) {
                const chunkKey = getChunkKeyForEntity(entity);
                // recordDelta se encargará de actualizar las listas
                // (eliminar esta entidad de 'activeGrowthEntities' y
                // añadir la nueva si es necesario)
                recordDelta(chunkKey, { 
                    type: 'REPLACE_ENTITY', 
                    uid: entity.uid, 
                    newEntity: newEntity 
                });
            }
        }
    }
    
    // --- Sistema de Movimiento AI ---
    // Itera solo la lista de entidades con IA
    // Usamos un bucle 'for' inverso para poder eliminar 'splice'
    // si una entidad se mueve a un chunk no cargado.
    for (let i = activeAiEntities.length - 1; i >= 0; i--) {
        const entity = activeAiEntities[i];
        const comps = entity.components; // Ya sabemos que comps.MovementAI existe
        const ai = comps.MovementAI;

        ai.timeUntilNextAction -= deltaMs;

        // Decidir nueva acción
        if (ai.timeUntilNextAction <= 0) {
            ai.timeUntilNextAction = (Math.random() * 3000) + 2000; 
            const action = Math.random();
            if (action < 0.6) { // 60% chance de parar
                ai.currentVelocity.x = 0;
                ai.currentVelocity.y = 0;
            } else { // 40% chance de moverse
                const angle = Math.random() * Math.PI * 2;
                ai.currentVelocity.x = Math.cos(angle) * ai.speed;
                ai.currentVelocity.y = Math.sin(angle) * ai.speed;
            }
        }

        // Aplicar movimiento
        if (ai.currentVelocity.x !== 0 || ai.currentVelocity.y !== 0) {
            
            // Actualizar dirección (facing)
            if (Math.abs(ai.currentVelocity.x) > Math.abs(ai.currentVelocity.y)) {
                entity.facing = ai.currentVelocity.x > 0 ? 'right' : 'left';
            } else if (Math.abs(ai.currentVelocity.y) > 0) {
                entity.facing = ai.currentVelocity.y > 0 ? 'down' : 'up';
            }

            let newX = entity.x + ai.currentVelocity.x * deltaTime;
            let newY = entity.y + ai.currentVelocity.y * deltaTime;

            // Colisión (pasando la entidad para ignorarla)
            if (!checkCollision(newX, entity.y, entity).solid) {
                entity.x = newX;
            } else {
                ai.currentVelocity.x = 0; 
                ai.timeUntilNextAction = 500; // Recalcular pronto
            }
            
            if (!checkCollision(entity.x, newY, entity).solid) {
                entity.y = newY;
            } else {
                ai.currentVelocity.y = 0; 
                ai.timeUntilNextAction = 500; // Recalcular pronto
            }

            const oldChunkKey = getChunkKeyForEntity(entity);

            // Registrar movimiento (delta)
            recordDelta(oldChunkKey, { type: 'MOVE_ENTITY', uid: entity.uid, x: entity.x, y: entity.y });

            // Comprobar si cambió de chunk
            const newChunkX = Math.floor(entity.x / CHUNK_PX_WIDTH);
            const newChunkY = Math.floor(entity.y / CHUNK_PX_HEIGHT);
            const newChunkKey = `${newChunkX},${newChunkY},${entity.z}`; 

            if (newChunkKey !== oldChunkKey) {
                console.log(`NPC ${entity.uid} se movió de ${oldChunkKey} a ${newChunkKey}`);
                
                // moveEntityToNewChunk se encargará de:
                // 1. Quitar la entidad del chunk antiguo
                // 2. Añadirla al chunk nuevo (si está cargado)
                // 3. O eliminarla de las listas activas si el chunk nuevo NO está cargado
                moveEntityToNewChunk(entity, oldChunkKey, newChunkKey);
            } 
        }
    }
}