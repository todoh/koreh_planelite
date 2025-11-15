// Archivo: pipe_system.js
// Contiene la lógica para el sistema de generación y transporte de items (tuberías).
// Este archivo es NUEVO y se basa en tu informe técnico.

import { activePipeEntities, findEntityAtGrid } from './world.js';
import { TILE_PX_WIDTH, TILE_PX_HEIGHT } from './logic.js'; // Importar tamaños de tiles

// --- Configuración del Sistema ---
const PIPE_SYSTEM_TICK_RATE_MS = 250; // Cada cuánto se actualiza el sistema (4 veces por segundo)
let timeSinceLastTick = 0;

/**
 * Actualiza el estado de todas las entidades del sistema de tuberías.
 * Se llama desde el bucle principal del juego (main.js).
 * @param {number} deltaMs - Tiempo en milisegundos desde el último frame.
 */
export function updatePipeSystem(deltaMs) {
    timeSinceLastTick += deltaMs;

    // Controlar el "tick" del sistema para optimizar rendimiento
    if (timeSinceLastTick < PIPE_SYSTEM_TICK_RATE_MS) {
        return; // No es tiempo de actualizar todavía
    }

    const ticksToProcess = Math.floor(timeSinceLastTick / PIPE_SYSTEM_TICK_RATE_MS);
    
    // Procesar todos los ticks acumulados (si hay lag, procesa varios)
    for (let i = 0; i < ticksToProcess; i++) {
        runPipeSystemTick();
    }
    
    // Guardar el tiempo restante para el próximo frame
    timeSinceLastTick = timeSinceLastTick % PIPE_SYSTEM_TICK_RATE_MS;
}

/**
 * Ejecuta un solo "tick" de lógica del sistema de tuberías.
 */
function runPipeSystemTick() {
    const sources = [];
    const pipes = [];
    const depots = [];

    // Clasificar entidades
    for (const entity of activePipeEntities) {
        const tags = entity.get('Tag');
        if (!tags) continue;

        if (tags.has('FUENTE')) {
            sources.push(entity);
        } else if (tags.has('TUBERIA')) {
            pipes.push(entity);
        } else if (tags.has('DEPOSITO')) {
            depots.push(entity);
        }
    }

    // Fase 1: Generación (Fuentes)
    processGeneration(sources);

    // Fase 2: Transferencia (Fuentes y Tuberías)
    processTransfer([...sources, ...pipes]);
}

// --- FASE 1: GENERACIÓN ---

function processGeneration(sources) {
    for (const source of sources) {
        const itemSource = source.get('ItemSource');
        const pipeLogic = source.get('PipeLogic');
        const attrs = source.get('Attribute');
        if (!itemSource || !pipeLogic || !attrs) continue;

        // Leer atributos
        const capacity = attrs.get('CAPACITY') || 0;
        const genRateMs = attrs.get('GENERATION_RATE_MS') || 1000;
        const genAmount = attrs.get('GENERATION_AMOUNT') || 1;

        // Actualizar temporizador de generación
        itemSource.timeUntilNextGen -= PIPE_SYSTEM_TICK_RATE_MS;

        if (itemSource.timeUntilNextGen <= 0) {
            // Tiempo de generar
            itemSource.timeUntilNextGen = genRateMs; // Reiniciar temporizador

            const contentToGen = itemSource.contentId;
            
            // Verificar si hay espacio y si el tipo de contenido es correcto
            if (pipeLogic.amount < capacity && (pipeLogic.content === "NONE" || pipeLogic.content === contentToGen)) {
                pipeLogic.content = contentToGen;
                pipeLogic.amount = Math.min(capacity, pipeLogic.amount + genAmount);
                // console.log(`Fuente ${source.id} generó ${genAmount} de ${contentToGen}. Total: ${pipeLogic.amount}`);
            }
        }
    }
}

// --- FASE 2: TRANSFERENCIA ---

function processTransfer(transferEntities) {
    for (const entity of transferEntities) {
        const pipeLogic = entity.get('PipeLogic');
        const attrs = entity.get('Attribute');
        const outputDir = entity.get('OutputDirection');
        const pos = entity.get('Position'); // Este es PositionComponent

        if (!pipeLogic || pipeLogic.amount <= 0 || !attrs || !outputDir || !pos) {
            continue; // No hay nada que transferir o no es una entidad de transferencia válida
        }

        // 1. Determinar la cantidad a transferir
        const transferRate = attrs.get('TRANSFER_RATE') || pipeLogic.amount;
        const amountToTransfer = Math.min(pipeLogic.amount, transferRate);

        // 2. Encontrar la entidad de destino
        const targetCoords = getTargetGridCoordinates(pos, outputDir.direction);
        if (!targetCoords) continue;

        // Usar el helper del world (findEntityAtGrid)
        const targetEntity = findEntityAtGrid(targetCoords.gx, targetCoords.gy, targetCoords.z);
        
        if (!targetEntity) {
            // console.log(`Entidad ${entity.id} no encontró destino en ${outputDir.direction}`);
            continue; // No hay nada en esa dirección
        }

        // 3. Validar y ejecutar la transferencia
        if (canTransfer(entity, targetEntity, amountToTransfer)) {
            executeTransfer(entity, targetEntity, amountToTransfer);
        }
    }
}

/**
 * Comprueba si el contenido de 'source' puede ser transferido a 'target'.
 * @param {Entity} source - La entidad que envía (Fuente o Tubería)
 * @param {Entity} target - La entidad que recibe (Tubería o Depósito)
 * @param {number} amount - La cantidad que se intenta transferir
 * @returns {boolean}
 */
function canTransfer(source, target, amount) {
    const sourceLogic = source.get('PipeLogic');
    const targetLogic = target.get('PipeLogic');
    const targetTags = target.get('Tag');
    
    // 1. El destino debe tener PipeLogic y ser Tubería o Depósito
    if (!targetLogic || !targetTags || !(targetTags.has('TUBERIA') || targetTags.has('DEPOSITO'))) {
        return false;
    }
    
    // 2. El destino debe ser compatible con el sistema (ej. AGUA con AGUA)
    const sourceSystemTag = getSystemTag(source.get('Tag'));
    const targetSystemTag = getSystemTag(target.get('Tag'));
    if (sourceSystemTag !== targetSystemTag) {
        return false;
    }

    // 3. El destino debe tener espacio
    const targetAttrs = target.get('Attribute');
    if (!targetAttrs) return false;
    const targetCapacity = targetAttrs.get('CAPACITY') || 0;
    
    if (targetLogic.amount >= targetCapacity) {
        return false; // Destino lleno
    }

    // 4. El contenido debe ser compatible
    if (targetLogic.content !== "NONE" && targetLogic.content !== sourceLogic.content) {
        return false; // El destino ya contiene algo diferente
    }
    
    return true;
}

/**
 * Mueve el contenido de 'source' a 'target'.
 * @param {Entity} source
 * @param {Entity} target
 * @param {number} maxAmountToTransfer - La cantidad máxima que la fuente quiere enviar
 */
function executeTransfer(source, target, maxAmountToTransfer) {
    const sourceLogic = source.get('PipeLogic');
    const targetLogic = target.get('PipeLogic');
    const targetAttrs = target.get('Attribute');
    
    const targetCapacity = targetAttrs.get('CAPACITY');
    const availableSpace = targetCapacity - targetLogic.amount;
    
    // Determinar la cantidad real que se moverá
    const actualAmount = Math.min(maxAmountToTransfer, availableSpace);
    
    if (actualAmount <= 0) return;

    // Actualizar destino
    targetLogic.content = sourceLogic.content;
    targetLogic.amount += actualAmount;

    // Actualizar fuente
    sourceLogic.amount -= actualAmount;
    if (sourceLogic.amount <= 0) {
        sourceLogic.amount = 0;
        sourceLogic.content = "NONE"; // Se vació
    }
    
    // console.log(`Transfirió ${actualAmount} de ${source.id} a ${target.id}`);
}


// --- FUNCIONES HELPER ---

/**
 * Obtiene las coordenadas del grid (gx, gy, z) de la celda adyacente.
 * @param {PositionComponent} pos - Posición de la entidad de origen (en píxeles)
 * @param {string} direction - "up", "down", "left", "right"
 * @returns {{gx: number, gy: number, z: number} | null}
 */
function getTargetGridCoordinates(pos, direction) {
    // 1. Convertir la posición de píxeles de la entidad a su celda de grid
    const gx = Math.floor(pos.x / TILE_PX_WIDTH);
    const gy = Math.floor(pos.y / TILE_PX_HEIGHT);
    const z = Math.floor(pos.z); // Asumimos que Z es 1 unidad por nivel

    // 2. Calcular la celda de destino
    switch (direction) {
        case 'right': // +X
            return { gx: gx + 1, gy: gy, z: z };
        case 'left': // -X
            return { gx: gx - 1, gy: gy, z: z };
        case 'up': // +Y (hacia "arriba" en la pantalla, -Y en coordenadas de mundo si Y crece hacia abajo)
                   // O +Y si Y crece hacia arriba. Asumiremos +Y del mundo (como "norte")
            return { gx: gx, gy: gy + 1, z: z };
        case 'down': // -Y (hacia "abajo" en la pantalla, "sur")
            return { gx: gx, gy: gy - 1, z: z };
        default:
            console.warn(`Dirección desconocida: ${direction}`);
            return null;
    }
}

/**
 * Extrae el tag del sistema (AGUA, OBJETOS, ENERGIA) de un TagComponent.
 * @param {TagComponent} tagComponent
 * @returns {string | null}
 */
function getSystemTag(tagComponent) {
    if (!tagComponent) return null;
    if (tagComponent.has('AGUA')) return 'AGUA';
    if (tagComponent.has('OBJETOS')) return 'OBJETOS';
    if (tagComponent.has('ENERGIA')) return 'ENERGIA';
    if (tagComponent.has('GAS')) return 'GAS';
    return null;
}