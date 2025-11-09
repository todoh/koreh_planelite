// --- generation.js ---
// Gestiona la generación procedural de chunks
// y la persistencia (guardado/carga) de chunks COMPLETOS.

import { 
    CHUNK_GRID_WIDTH, 
    CHUNK_GRID_HEIGHT, 
    TILE_PX_WIDTH, 
    TILE_PX_HEIGHT 
} from './logic.js';

// Cachés de assets
export const TILES = {}; // Metadata
export const IMAGES = {}; // Imágenes PNG

// Clave para identificar chunks guardados en localStorage
// (Sigue sirviendo la misma regex)
export const CHUNK_KEY_REGEX = /^-?\d+,-?\d+$/;

/**
 * Carga una sola imagen
 */
async function loadImage(key, path) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            IMAGES[key] = img;
            resolve(img);
        };
        img.onerror = () => {
            console.error(`Error al cargar imagen: ${path}`);
            resolve(null);
        };
        img.src = path;
    });
}

/**
 * Carga sprites.json y todas las imágenes PNG
 */
export async function initializeMetadata() {
    console.log("Cargando sprites.json (para metadata)...");
    const response = await fetch('./sprites.json');
    if (!response.ok) throw new Error('No se pudo cargar sprites.json.');
    
    const spriteData = await response.json();
    console.log("Metadata cargada.");

    const imageLoadPromises = [];
    for (const key of Object.keys(spriteData)) {
        TILES[key] = spriteData[key]; // Guardar metadata
        const imagePath = `./assets/${key.toLowerCase()}.png`;
        imageLoadPromises.push(loadImage(key, imagePath));
    }
    
    await Promise.all(imageLoadPromises);
    console.log("¡Todas las imágenes cargadas!");
}

/**
 * Intenta cargar un chunk COMPLETO desde localStorage
 * @param {string} chunkKey (ej: "0,0")
 * @returns {object | null}
 */
async function loadFusedChunk(chunkKey) {
    try {
        const savedData = localStorage.getItem(chunkKey);
        if (savedData) {
            const chunk = JSON.parse(savedData);
            // Verificamos que sea un chunk completo, no un delta antiguo
            if (chunk && chunk.terrain && chunk.entities) {
                return chunk;
            }
        }
    } catch (e) {
        console.error(`Error al cargar chunk fusionado ${chunkKey}:`, e);
    }
    return null; // No encontrado o corrupto
}

/**
 * Guarda un chunk COMPLETO en localStorage
 * @param {string} chunkKey 
 * @param {object} chunkData (El objeto { terrain, entities })
 */
export async function saveFusedChunk(chunkKey, chunkData) {
    try {
        localStorage.setItem(chunkKey, JSON.stringify(chunkData));
    } catch (e) {
        console.error(`¡LocalStorage lleno! No se pudo guardar el chunk: ${chunkKey}`);
        // Aquí podrías alertar al jugador
    }
}

/**
 * Genera el chunk "base" (terreno y entidades)
 * (Esta función no cambia)
 * @param {number} chunkX 
 * @param {number} chunkY 
 * @returns {object} { terrain: [...], entities: [...] }
 */
function generateNewChunk(chunkX, chunkY) {
    const terrain = [];
    const entities = [];
    const scale = 0.05; 
    
    // --- INICIO DE LÓGICA DE GENERACIÓN ---
    for (let y = 0; y < CHUNK_GRID_HEIGHT; y++) {
        const row = [];
        for (let x = 0; x < CHUNK_GRID_WIDTH; x++) {
            
            const globalTileX = (chunkX * CHUNK_GRID_WIDTH) + x;
            const globalTileY = (chunkY * CHUNK_GRID_HEIGHT) + y;
            
            const noiseValue = seededRandom(globalTileX * scale, globalTileY * scale);
            const detailNoise = seededRandom(globalTileX * 0.5, globalTileY * 0.5);

            // 1. Generar Terreno por defecto
            let tileKey;
            if (noiseValue < 0.25) tileKey = 'WATER';
            else if (noiseValue < 0.45) tileKey = 'DIRT';
            else if (noiseValue < 0.8) tileKey = 'GRASS';
            else tileKey = 'STONE_GROUND';

            const entityUID = `uid_${chunkX}_${chunkY}_${x}_${y}`;
            const entityX = (globalTileX * TILE_PX_WIDTH) + TILE_PX_WIDTH / 2;
            const entityY = (globalTileY * TILE_PX_HEIGHT) + TILE_PX_HEIGHT / 2;

            // 2. --- ¡MODIFICACIÓN! --- Crear la plaza
            const plazaCenterX = 30;
            const plazaCenterY = 30;
            const plazaRadius = 4; // Un radio de 4 crea una plaza de 9x9 (de 26 a 34)
            
            const inPlaza = Math.abs(globalTileX - plazaCenterX) <= plazaRadius &&
                            Math.abs(globalTileY - plazaCenterY) <= plazaRadius;

            if (inPlaza) {
                tileKey = 'STONE_GROUND'; // Forzar suelo de piedra
            }


            // 3. --- ¡MODIFICACIÓN! --- Generar Entidades (solo si NO estamos en la plaza)
            if (!inPlaza) {
                if (tileKey === 'GRASS' && detailNoise > 0.9) { 
                    entities.push({
                        uid: `${entityUID}_TREE`,
                        key: 'TREE',
                        x: entityX, y: entityY
                    });
                } else if (tileKey === 'STONE_GROUND' && detailNoise > 0.85) { 
                     entities.push({
                        uid: `${entityUID}_ROCK`,
                        key: 'ROCK',
                        x: entityX, y: entityY
                    });
                } else if (tileKey === 'DIRT' && detailNoise > 0.98) { 
                     entities.push({
                        uid: `${entityUID}_ITEM`,
                        key: 'ITEM',
                        x: entityX, y: entityY
                    });
                }
            }
            
            // 4. --- ¡MODIFICACIÓN! --- Colocar Entidades Especiales (Estatua y NPC)
            // Esto se ejecuta *después* de la lógica de la plaza,
            // para asegurar que se colocan donde queremos.
            
            // ESTATUA MOVIDA AL NORTE: (30, 28)
            if (globalTileX === 30 && globalTileY === 28) {
                 entities.push({
                    uid: `${entityUID}_STATUE`,
                    key: 'STATUE',
                    x: entityX, y: entityY
                });
                tileKey = 'STONE_GROUND'; // Asegurar que el suelo bajo la estatua sea piedra
            }
            
            // NPC (lo dejamos al lado del centro de la plaza, en 31, 30)
             if (globalTileX === 31 && globalTileY === 30) {
                 entities.push({
                    uid: `${entityUID}_NPC`,
                    key: 'NPC',
                    x: entityX, y: entityY
                });
                tileKey = 'STONE_GROUND'; // Asegurar que el suelo bajo el NPC sea piedra
            }

            row.push(tileKey);
        }
        terrain.push(row);
    }
    // --- FIN DE LÓGICA DE GENERACIÓN ---
    
    return { terrain, entities };
}

// Función seededRandom (copiada, necesaria para generateNewChunk)
function seededRandom(x, y) {
    const sin = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return (sin - Math.floor(sin)) / 2 + 0.5; // Devuelve 0 a 1
}


/**
 * Orquestador: Carga un chunk fusionado O Genera uno nuevo
 * @param {number} chunkX 
 * @param {number} chunkY 
 * @param {string} chunkKey 
 * @returns {object} El chunk listo para RAM
 */
export async function getOrGenerateChunk(chunkX, chunkY, chunkKey) {
    // 1. Intentar cargar el chunk COMPLETO desde persistencia
    const fusedChunk = await loadFusedChunk(chunkKey);
    
    if (fusedChunk) {
        // ¡Éxito! Este chunk fue modificado y guardado
        return fusedChunk; 
    }

    // 2. Si no, generar uno nuevo (determinista)
    const baseChunk = generateNewChunk(chunkX, chunkY);
    
    return baseChunk;
}