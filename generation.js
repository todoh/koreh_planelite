// --- generation.js ---
// Gestiona la generación procedural de chunks
// y la persistencia (guardado/carga) de chunks COMPLETOS.

import { 
    CHUNK_GRID_WIDTH, 
    CHUNK_GRID_HEIGHT, 
    TILE_PX_WIDTH, 
    TILE_PX_HEIGHT 
} from './logic.js';
// --- ¡NUEVA IMPORTACIÓN! ---
import { BIOME_CONFIG } from './biome_definitions.js';
// --- ¡NUEVAS IMPORTACIONES DE ENTIDADES! ---
import { processTerrainDefinitions, createEntity } from './entity_components.js';


// Cachés de assets
// export const TILES = {}; // <-- ELIMINADO (movido a entity.js)
export const IMAGES = {}; // Imágenes PNG

// Clave para identificar chunks guardados en localStorage
export const CHUNK_KEY_REGEX = /^-?\d+,-?\d+$/;

// --- LÓGICA DE SEMILLA (SEED) ---
// ... (Sin cambios) ...
let WORLD_SEED;

function _initializeNewWorldSeed() {
    
    const isLoadingGame = localStorage.getItem('GAME_STATE_LOAD') !== null;

    if (isLoadingGame) {
        console.log("Detectada carga de partida. Omitiendo limpieza de mundo.");
        WORLD_SEED = parseFloat(localStorage.getItem('WORLD_SEED'));
        if (!WORLD_SEED) {
            console.warn("No se encontró semilla en la partida cargada, generando una temporal.");
            WORLD_SEED = Math.random() * 1000000;
        }
        console.log(`Semilla de partida cargada: ${WORLD_SEED}`);
        
    } else {
        console.log("Forzando nuevo mundo: Limpiando localStorage...");
        
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (CHUNK_KEY_REGEX.test(key) || key === 'WORLD_SEED') {
                keysToRemove.push(key);
            }
        }
        
        for (const key of keysToRemove) {
            localStorage.removeItem(key);
        }
        console.log(`Mundo anterior limpiado (${keysToRemove.length} items).`);

        WORLD_SEED = Math.random() * 1000000;
        localStorage.setItem('WORLD_SEED', WORLD_SEED.toString());
        console.log(`¡Mundo LIMPIADO y nueva semilla generada: ${WORLD_SEED}`);
    }
}
_initializeNewWorldSeed();


/**
 * (Sin cambios)
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
            const baseImg = new Image();
            baseImg.onload = () => {
                console.warn(`Usando 'dirt.png' como fallback para ${key}`);
                IMAGES[key] = baseImg;
                resolve(baseImg);
            };
            baseImg.onerror = () => {
                 console.error(`¡Error fatal! No se pudo cargar ni ${path} ni el fallback dirt.png`);
                 resolve(null);
            };
            baseImg.src = './assets/dirt.png';
        };
        img.src = path;
    });
}

/**
 * ¡MODIFICADO!
 * Carga sprites.json (SOLO TERRENO) y todas las imágenes PNG (TODAS).
 */
export async function initializeMetadata() {
    console.log("Cargando sprites.json (para metadata de terreno)...");
    const response = await fetch('./sprites.json');
    if (!response.ok) throw new Error('No se pudo cargar sprites.json.');
    
    const spriteData = await response.json();
    console.log("Metadata de terreno cargada.");

    // ¡NUEVO! Enviar los datos del terreno a entity.js para que los procese
    processTerrainDefinitions(spriteData);

    const imageLoadPromises = [];
    
    // 1. Cargar imágenes del TERRENO (definidas en sprites.json)
    for (const key of Object.keys(spriteData)) {
        if (key.startsWith("//")) continue; 
        const imagePath = `./assets/${key.toLowerCase()}.png`;
        imageLoadPromises.push(loadImage(key, imagePath));
    }
    
    // 2. Cargar imágenes de ENTIDADES (definidas en entity_definitions.js)
    // Esto es un poco "manual" pero necesario
    // Podríamos automatizarlo leyendo las ENTITY_DEFINITIONS
    const entityImageKeys = [
        "STATUE", "PLAYER", "TREE", "ROCK", "NPC", "ITEM",
        "CACTUS", "ACACIA_TREE", "JUNGLE_TREE", "SNOW_TREE"
    ];
    
    for (const key of entityImageKeys) {
        // Evitar cargar imágenes duplicadas si un tile y una entidad comparten clave
        if (!IMAGES[key]) {
            const imagePath = `./assets/${key.toLowerCase()}.png`;
            imageLoadPromises.push(loadImage(key, imagePath));
        }
    }
    
    await Promise.all(imageLoadPromises);
    console.log("¡Todas las imágenes (terreno y entidades) cargadas!");
}

/**
 * (Sin cambios)
 * Intenta cargar un chunk COMPLETO desde localStorage
 */
async function loadFusedChunk(chunkKey) {
    try {
        const savedData = localStorage.getItem(chunkKey);
        if (savedData) {
            const chunk = JSON.parse(savedData);
            if (chunk && chunk.terrain && chunk.entities) {
                // TODO: Aquí deberíamos re-hidratar las entidades
                // con sus clases de componentes, pero por ahora
                // los datos JSON simples funcionan.
                return chunk;
            }
        }
    } catch (e) {
        console.error(`Error al cargar chunk fusionado ${chunkKey}:`, e);
    }
    return null;
}

/**
 * (Sin cambios)
 * Guarda un chunk COMPLETO en localStorage
 */
export async function saveFusedChunk(chunkKey, chunkData) {
    try {
        localStorage.setItem(chunkKey, JSON.stringify(chunkData));
    } catch (e) {
        console.error(`¡LocalStorage lleno! No se pudo guardar el chunk: ${chunkKey}`);
    }
}


// --- LÓGICA DE GENERACIÓN DE BIOMAS (VORONOI) ---
// (Toda esta lógica pura se mantiene sin cambios)

const TERRAIN_SCALE = 0.05;
const VEGETATION_SCALE = 0.5;
const BIOME_REGION_SIZE = 50;

function seededRandom(x, y) {
    const sin = Math.sin(x * 12.9898 + y * 78.233 + WORLD_SEED) * 43758.5453;
    return (sin - Math.floor(sin)) / 2 + 0.5;
}

function getBiomeRegionCenter(regionX, regionY) {
    const randomX = seededRandom(regionX * 1.3, regionY * 2.1);
    const randomY = seededRandom(regionX * 2.1, regionY * 1.3);
    const baseX = regionX * BIOME_REGION_SIZE;
    const baseY = regionY * BIOME_REGION_SIZE;
    return { x: baseX + randomX * BIOME_REGION_SIZE, y: baseY + randomY * BIOME_REGION_SIZE };
}

function getBiomeRegionType(regionX, regionY) {
    const biomeNoise = seededRandom(regionX * 10.7, regionY * 10.7);
    
    // --- ¡INICIO DE MODIFICACIÓN! ---
    // Distribución de biomas reequilibrada (aprox. 16.6% cada uno)
    if (biomeNoise < 0.57) return 'DESERT';   // 17%
    if (biomeNoise < 0.54) return 'SAVANNA';  // 17%
    if (biomeNoise < 0.51) return 'JUNGLE';   // 17%
    if (biomeNoise < 0.68) return 'ROCKY';    // 17%
    if (biomeNoise < 0.55) return 'TUNDRA';   // 17%
    return 'PLAINS';                         // 15% (Default)
    // --- ¡FIN DE MODIFICACIÓN! ---
}

function getBiome(globalX, globalY) {
    const elevationNoise = seededRandom(globalX * TERRAIN_SCALE, globalY * TERRAIN_SCALE);
    if (elevationNoise < 0.25) return 'OCEAN';
    if (elevationNoise < 0.30) return 'BEACH';
    
    const currentRegionX = Math.floor(globalX / BIOME_REGION_SIZE);
    const currentRegionY = Math.floor(globalY / BIOME_REGION_SIZE);
    
    let minDistanceSq = Infinity;
    let closestBiomeType = 'PLAINS';

    for (let y = currentRegionY - 1; y <= currentRegionY + 1; y++) {
        for (let x = currentRegionX - 1; x <= currentRegionX + 1; x++) {
            const center = getBiomeRegionCenter(x, y);
            const type = getBiomeRegionType(x, y);
            const dx = center.x - globalX;
            const dy = center.y - globalY;
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq < minDistanceSq) {
                minDistanceSq = distanceSq;
                closestBiomeType = type;
            }
        }
    }
    return closestBiomeType;
}

// --- FIN DE LÓGICA DE BIOMAS VORONOI ---


/**
 * ¡MODIFICADO!
 * Aplica las sobreescrituras de la plaza de spawn.
 * @param {Array<Array<string>>} terrain - El terreno generado por biomas
 * @param {Array<object>} entities - Las entidades generadas por biomas
 * @returns {object} { terrain, entities } - Las listas modificadas
 */
function _applySpawnPlazaOverrides(terrain, entities) {
    const plazaCenterX = 30;
    const plazaCenterY = 30;
    const plazaRadius = 4;
    
    // 1. Filtrar entidades que caen en la plaza
    const filteredEntities = entities.filter(entity => {
        // La entidad ya tiene 'x' e 'y' en píxeles del mundo
        const eGridX = Math.floor(entity.x / TILE_PX_WIDTH);
        const eGridY = Math.floor(entity.y / TILE_PX_HEIGHT);
        const eInPlaza = Math.abs(eGridX - plazaCenterX) <= plazaRadius &&
                         Math.abs(eGridY - plazaCenterY) <= plazaRadius;
        return !eInPlaza; // Mantener solo las que NO están en la plaza
    });

    // 2. Sobreescribir terreno y añadir entidades especiales
    for (let y = 0; y < CHUNK_GRID_HEIGHT; y++) {
        for (let x = 0; x < CHUNK_GRID_WIDTH; x++) {
            
            const globalTileX = x; // Asumimos chunk 0,0
            const globalTileY = y; // Asumimos chunk 0,0

            const inPlaza = Math.abs(globalTileX - plazaCenterX) <= plazaRadius &&
                            Math.abs(globalTileY - plazaCenterY) <= plazaRadius;
            
            if (inPlaza) {
                terrain[y][x] = 'STONE_GROUND'; // Forzar suelo de piedra
            }
            
            // Coordenadas en píxeles para las nuevas entidades
            const entityX = (globalTileX * TILE_PX_WIDTH) + TILE_PX_WIDTH / 2;
            const entityY = (globalTileY * TILE_PX_HEIGHT) + TILE_PX_HEIGHT / 2;

            // ESTATUA (30, 28)
            if (globalTileX === 30 && globalTileY === 28) {
                 filteredEntities.push(
                    createEntity('STATUE', entityX, entityY, `uid_0_0_30_28_STATUE`)
                 );
                terrain[y][x] = 'STONE_GROUND'; // Asegurar suelo
            }
            
            // NPC (31, 30)
             if (globalTileX === 31 && globalTileY === 30) {
                 filteredEntities.push(
                    createEntity('NPC', entityX, entityY, `uid_0_0_31_30_NPC`)
                 );
                terrain[y][x] = 'STONE_GROUND'; // Asegurar suelo
            }
            
            // ¡NUEVO! Mesa de Crafting (29, 30)
             if (globalTileX === 29 && globalTileY === 30) {
                 filteredEntities.push(
                    createEntity('CRAFTING_TABLE', entityX, entityY, `uid_0_0_29_30_CRAFTING`)
                 );
                terrain[y][x] = 'STONE_GROUND'; // Asegurar suelo
            }
            
            // ¡NUEVO! Brote (30, 32)
             if (globalTileX === 30 && globalTileY === 32) {
                 filteredEntities.push(
                    createEntity('SAPLING', entityX, entityY, `uid_0_0_30_32_SAPLING`)
                 );
                terrain[y][x] = 'STONE_GROUND'; // Asegurar suelo
            }
        }
    }
    
    return { terrain, entities: filteredEntities };
}


/**
 * Genera el chunk "base" (terreno y entidades)
 * (¡REFACTORIZADO PARA USAR BIOME_CONFIG y createEntity!)
 * @param {number} chunkX 
 * @param {number} chunkY 
 * @returns {object} { terrain: [...], entities: [...] }
 */
function generateNewChunk(chunkX, chunkY) {
    let terrain = [];
    let entities = []; // Lista para todas las entidades de este chunk
    
    for (let y = 0; y < CHUNK_GRID_HEIGHT; y++) {
        const row = [];
        for (let x = 0; x < CHUNK_GRID_WIDTH; x++) {
            
            const globalTileX = (chunkX * CHUNK_GRID_WIDTH) + x;
            const globalTileY = (chunkY * CHUNK_GRID_HEIGHT) + y;
            
            // 1. Determinar Bioma
            const biome = getBiome(globalTileX, globalTileY);

            // 2. Obtener ruidos de detalle
            const terrainNoise = seededRandom(globalTileX * TERRAIN_SCALE, globalTileY * TERRAIN_SCALE);
            const vegetationNoise = seededRandom(globalTileX * VEGETATION_SCALE, globalTileY * VEGETATION_SCALE);
            
            // 3. Preparar datos para la configuración del bioma
            const noises = { terrain: terrainNoise, vegetation: vegetationNoise };
            const entityUIDBase = `uid_${chunkX}_${chunkY}_${x}_${y}`;
            const entityX = (globalTileX * TILE_PX_WIDTH) + TILE_PX_WIDTH / 2;
            const entityY = (globalTileY * TILE_PX_HEIGHT) + TILE_PX_HEIGHT / 2;

            // 4. --- ¡LÓGICA REFACTORIZADA! ---
            const biomeConfig = BIOME_CONFIG[biome] || BIOME_CONFIG['PLAINS'];
            
            // Llamar a la función pura del bioma
            // (Modificado para pasar la fábrica de entidades)
            const result = biomeConfig.getTileAndEntities(
                noises, 
                entityUIDBase, 
                entityX, 
                entityY,
                createEntity // ¡Pasamos la fábrica!
            );
            
            // 5. Aplicar resultados
            row.push(result.tileKey);
            if (result.entities.length > 0) {
                entities.push(...result.entities.filter(e => e !== null)); // Filtrar nulos
            }
            // --- FIN DEL REFACTOR ---
        }
        terrain.push(row);
    }

    // 6. --- APLICAR SOBREESCRITURAS (SPAWN, ETC) ---
    if (chunkX === 0 && chunkY === 0) {
        const overrideResult = _applySpawnPlazaOverrides(terrain, entities);
        terrain = overrideResult.terrain; // Reasignar
        entities = overrideResult.entities; // Reasignar
    }
    
    return { terrain, entities };
}


/**
 * Orquestador: Carga un chunk fusionado O Genera uno nuevo
 * (Sin cambios)
 * @param {number} chunkX 
 * @param {number} chunkY 
 * @param {string} chunkKey 
 * @returns {object} { chunkData, isNew }
 */
export async function getOrGenerateChunk(chunkX, chunkY, chunkKey) {
    // 1. Intentar cargar el chunk COMPLETO desde persistencia
    const fusedChunk = await loadFusedChunk(chunkKey);
    
    if (fusedChunk) {
        return { chunkData: fusedChunk, isNew: false }; 
    }

    // 2. Si no, generar uno nuevo (determinista)
    const baseChunk = generateNewChunk(chunkX, chunkY);
    
    return { chunkData: baseChunk, isNew: true }; 
}