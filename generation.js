// --- generation.js ---
// Gestiona la generación procedural de chunks
// y la persistencia (guardado/carga) de chunks COMPLETOS.

import { 
    CHUNK_GRID_WIDTH, 
    CHUNK_GRID_HEIGHT, 
    TILE_PX_WIDTH, 
    TILE_PX_HEIGHT 
} from './logic.js';
import { BIOME_CONFIG } from './biome_definitions.js';
import { processTerrainDefinitions, createEntity } from './entity.js';


// Cachés de assets
export const IMAGES = {}; // Imágenes PNG

// Clave para identificar chunks guardados en localStorage
// --- ¡MODIFICADO! Ahora acepta una tercera coordenada Z ---
export const CHUNK_KEY_REGEX = /^-?\d+,-?\d+,-?\d+$/; 

// --- LÓGICA DE SEMILLA (SEED) ---
let WORLD_SEED;

function _initializeNewWorldSeed() {
    
    const isLoadingGame = localStorage.getItem('GAME_STATE_LOAD') !== null;

    if (isLoadingGame) {
        console.log("Detectada carga de partida. Omitiendo limpieza de mundo.");
        // ¡MODIFICADO! Cargar la semilla existente
        const savedSeed = localStorage.getItem('WORLD_SEED');
        if (savedSeed) {
             WORLD_SEED = parseFloat(savedSeed);
             console.log(`Semilla de partida cargada: ${WORLD_SEED}`);
        } else {
            console.warn("No se encontró semilla en la partida cargada, generando una temporal.");
            WORLD_SEED = Math.random() * 1000000;
        }
        
    } else {
        console.log("Forzando nuevo mundo: Limpiando localStorage...");
        
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            // --- ¡MODIFICADO! Limpia claves 2D antiguas y 3D nuevas ---
            if (CHUNK_KEY_REGEX.test(key) || /^-?\d+,-?\d+$/.test(key) || key === 'WORLD_SEED') {
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
 * Carga sprites.json (SOLO TERRENO) y todas las imágenes PNG (TODAS).
 */
export async function initializeMetadata() {
    console.log("Cargando sprites.json (para metadata de terreno)...");
    const response = await fetch('./sprites.json');
    if (!response.ok) throw new Error('No se pudo cargar sprites.json.');
    
    const spriteData = await response.json();
    console.log("Metadata de terreno cargada.");

    // Procesa terrenos (incluyendo CAVE_FLOOR, ROCK_WALL)
    processTerrainDefinitions(spriteData);

    const imageLoadPromises = [];
    
    // Cargar imágenes de terreno
    for (const key of Object.keys(spriteData)) {
        if (key.startsWith("//")) continue; 
        const imagePath = `./assets/${key.toLowerCase()}.png`;
        
        // Fallbacks para nuevos terrenos de cueva
        if (key === 'CAVE_FLOOR') {
            imageLoadPromises.push(loadImage(key, './assets/stone_ground.png'));
        } else if (key === 'ROCK_WALL') {
            imageLoadPromises.push(loadImage(key, './assets/wall.png'));
        } else {
            imageLoadPromises.push(loadImage(key, imagePath));
        }
    }
    
    // Cargar imágenes de entidades
    const entityImageKeys = [
        "STATUE", "PLAYER", "TREE", "ROCK", "NPC", "ITEM",
        "CACTUS", "ACACIA_TREE", "JUNGLE_TREE", "SNOW_TREE",
        "MESATRABAJO", "COCHE",
        "STAIRS_UP", "STAIRS_DOWN", "IRON_VEIN" // <-- ¡AÑADIDO!
    ];
    
    for (const key of entityImageKeys) {
        if (!IMAGES[key.toUpperCase()]) {
            const imagePath = `./assets/${key.toLowerCase()}.png`;
            
            // Reutilizar 'ROCK' para 'IRON_VEIN'
            if (key === 'IRON_VEIN') {
                 imageLoadPromises.push(loadImage(key.toUpperCase(), './assets/rock.png'));
            }
            // Reutilizar 'MESATRABAJO' para 'STAIRS_UP'
            else if (key === 'STAIRS_UP') {
                 imageLoadPromises.push(loadImage(key.toUpperCase(), './assets/mesatrabajo.png'));
            }
             // Reutilizar 'COCHE' para 'STAIRS_DOWN'
            else if (key === 'STAIRS_DOWN') {
                 imageLoadPromises.push(loadImage(key.toUpperCase(), './assets/coche.png'));
            }
            else {
                imageLoadPromises.push(loadImage(key.toUpperCase(), imagePath));
            }
        }
    }
    
    await Promise.all(imageLoadPromises);
    console.log("¡Todas las imágenes (terreno y entidades) cargadas!");
}

/**
 * Intenta cargar un chunk COMPLETO desde localStorage
 */
async function loadFusedChunk(chunkKey) {
    try {
        const savedData = localStorage.getItem(chunkKey);
        if (savedData) {
            const chunk = JSON.parse(savedData);
            if (chunk && chunk.terrain && chunk.entities) {
                return chunk;
            }
        }
    } catch (e) {
        console.error(`Error al cargar chunk fusionado ${chunkKey}:`, e);
    }
    return null;
}

/**
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

const TERRAIN_SCALE = 0.05;
const VEGETATION_SCALE = 0.5;
const BIOME_REGION_SIZE = 50;
// --- ¡NUEVO! Escala para cuevas ---
const CAVE_SCALE = 0.1; 

/**
 * Devuelve un valor pseudoaleatorio determinista entre [0.0, 1.0)
 */
function seededRandom(x, y, z = 0) { // <-- ¡Acepta Z!
    const sin = Math.sin(x * 12.9898 + y * 78.233 + z * 45.435 + WORLD_SEED) * 43758.5453;
    return sin - Math.floor(sin); // Devuelve [0.0, 1.0)
}

/**
 * Interpola suavemente entre los valores de seededRandom.
 */
function smoothNoise(x, y, z = 0) { // <-- ¡Acepta Z!
    const intX = Math.floor(x);
    const fracX = x - intX;
    const intY = Math.floor(y);
    const fracY = y - intY;
    const intZ = Math.floor(z);
    const fracZ = z - intZ;

    // Obtener el ruido de las 8 esquinas del cubo
    const v1 = seededRandom(intX, intY, intZ);
    const v2 = seededRandom(intX + 1, intY, intZ);
    const v3 = seededRandom(intX, intY + 1, intZ);
    const v4 = seededRandom(intX + 1, intY + 1, intZ);
    const v5 = seededRandom(intX, intY, intZ + 1);
    const v6 = seededRandom(intX + 1, intY, intZ + 1);
    const v7 = seededRandom(intX, intY + 1, intZ + 1);
    const v8 = seededRandom(intX + 1, intY + 1, intZ + 1);

    // Interpolar en X
    const i1 = (v1 * (1 - fracX)) + (v2 * fracX);
    const i2 = (v3 * (1 - fracX)) + (v4 * fracX);
    const i3 = (v5 * (1 - fracX)) + (v6 * fracX);
    const i4 = (v7 * (1 - fracX)) + (v8 * fracX);

    // Interpolar en Y
    const j1 = (i1 * (1 - fracY)) + (i2 * fracY);
    const j2 = (i3 * (1 - fracY)) + (i4 * fracY);

    // Interpolar en Z
    return (j1 * (1 - fracZ)) + (j2 * fracZ);
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
    const slice = 1.0 / 6.0; 

    if (biomeNoise < slice * 1) return 'DESERT';
    if (biomeNoise < slice * 2) return 'SAVANNA';
    if (biomeNoise < slice * 3) return 'JUNGLE';
    if (biomeNoise < slice * 4) return 'ROCKY';
    if (biomeNoise < slice * 5) return 'TUNDRA';
    
    return 'PLAINS';
}

/**
 * ¡MODIFICADO! Acepta Z y lo usa
 */
function getBiome(globalX, globalY, globalZ) {
    // 1. ¡NUEVO! Comprobar si estamos bajo tierra
    if (globalZ < 0) {
        return 'UNDERGROUND';
    }

    // 2. Lógica de superficie (z=0)
    const elevationNoise = smoothNoise(globalX * TERRAIN_SCALE, globalY * TERRAIN_SCALE, 0);
    
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
 * Aplica las sobreescrituras de la plaza de spawn (SOLO Z=0).
 */
function _applySpawnPlazaOverrides(terrain, entities) {
    const plazaCenterX = 30;
    const plazaCenterY = 30;
    const plazaRadius = 4;
    
    const filteredEntities = entities.filter(entity => {
        const eGridX = Math.floor(entity.x / TILE_PX_WIDTH);
        const eGridY = Math.floor(entity.y / TILE_PX_HEIGHT);
        const eInPlaza = Math.abs(eGridX - plazaCenterX) <= plazaRadius &&
                         Math.abs(eGridY - plazaCenterY) <= plazaRadius;
        return !eInPlaza;
    });

    for (let y = 0; y < CHUNK_GRID_HEIGHT; y++) {
        for (let x = 0; x < CHUNK_GRID_WIDTH; x++) {
            
            const globalTileX = x;
            const globalTileY = y;

            const inPlaza = Math.abs(globalTileX - plazaCenterX) <= plazaRadius &&
                            Math.abs(globalTileY - plazaCenterY) <= plazaRadius;
            
            if (inPlaza) {
                terrain[y][x] = 'STONE_GROUND';
            }
            
            const entityX = (globalTileX * TILE_PX_WIDTH) + TILE_PX_WIDTH / 2;
            const entityY = (globalTileY * TILE_PX_HEIGHT) + TILE_PX_HEIGHT / 2;

            // ¡MODIFICADO! Pasar Z=0 a createEntity
            const z = 0; 

            // ESTATUA (30, 28)
            if (globalTileX === 30 && globalTileY === 28) {
                 filteredEntities.push(
                    createEntity('STATUE', entityX, entityY, z, `uid_0_0_0_30_28_STATUE`) 
                 );
                terrain[y][x] = 'STONE_GROUND';
            }
            
            // NPC (31, 30)
             if (globalTileX === 31 && globalTileY === 30) {
                 filteredEntities.push(
                    createEntity('NPC', entityX, entityY, z, `uid_0_0_0_31_30_NPC`) 
                 );
                terrain[y][x] = 'STONE_GROUND';
            }
            
            // Mesa de Crafting (29, 30)
             if (globalTileX === 29 && globalTileY === 30) {
                 filteredEntities.push(
                    createEntity('CRAFTING_TABLE', entityX, entityY, z, `uid_0_0_0_29_30_CRAFTING`) 
                 );
                terrain[y][x] = 'STONE_GROUND';
            }
            
            // Brote (30, 32)
             if (globalTileX === 30 && globalTileY === 32) {
                 filteredEntities.push(
                    createEntity('SAPLING', entityX, entityY, z, `uid_0_0_0_30_32_SAPLING`) 
                 );
                terrain[y][x] = 'STONE_GROUND';
            }

            // Coche (32, 32)
             if (globalTileX === 32 && globalTileY === 32) {
                 filteredEntities.push(
                    createEntity('COCHE', entityX, entityY, z, `uid_0_0_0_32_32_COCHE`) 
                 );
                terrain[y][x] = 'STONE_GROUND';
            }

            // --- ¡NUEVO! Escalera para bajar (28, 32) ---
             if (globalTileX === 28 && globalTileY === 32) {
                 filteredEntities.push(
                    createEntity('STAIRS_DOWN', entityX, entityY, z, `uid_0_0_0_28_32_STAIRS_DOWN`)
                 );
                terrain[y][x] = 'STONE_GROUND';
            }
        }
    }
    
    return { terrain, entities: filteredEntities };
}

// --- ¡NUEVA FUNCIÓN! ---
/**
 * Genera un chunk de subsuelo (cuevas, minerales)
 * @param {number} chunkX 
 * @param {number} chunkY 
 * @param {number} chunkZ 
 * @returns {object} { terrain: [...], entities: [...] }
 */
function generateUndergroundChunk(chunkX, chunkY, chunkZ) {
    let terrain = [];
    let entities = [];
    
    for (let y = 0; y < CHUNK_GRID_HEIGHT; y++) {
        const row = [];
        for (let x = 0; x < CHUNK_GRID_WIDTH; x++) {
            
            const globalTileX = (chunkX * CHUNK_GRID_WIDTH) + x;
            const globalTileY = (chunkY * CHUNK_GRID_HEIGHT) + y;
            
            // 1. Generar cuevas usando 3D noise
            const caveNoise = smoothNoise(
                globalTileX * CAVE_SCALE, 
                globalTileY * CAVE_SCALE, 
                chunkZ * 0.5 // Z influye en la forma de la cueva
            );

            const entityUIDBase = `uid_${chunkX}_${chunkY}_${chunkZ}_${x}_${y}`;
            const entityX = (globalTileX * TILE_PX_WIDTH) + TILE_PX_WIDTH / 2;
            const entityY = (globalTileY * TILE_PX_HEIGHT) + TILE_PX_HEIGHT / 2;
            
            if (caveNoise > 0.6) { // 60% umbral para espacio abierto
                row.push('CAVE_FLOOR');
                
            } else {
                row.push('ROCK_WALL'); // Sólido
                
                // 2. Generar vetas de mineral en las paredes
                const mineralNoise = seededRandom(globalTileX * 1.5, globalTileY * 1.5, chunkZ);
                
                if (mineralNoise > 0.98) { // 2% de probabilidad
                    // ¡MODIFICADO! Pasar Z a createEntity
                    entities.push(createEntity('IRON_VEIN', entityX, entityY, chunkZ, `${entityUIDBase}_IRON`));
                }
            }
        }
        terrain.push(row);
    }
    
    // --- ¡NUEVO! Conexión de escalera de spawn ---
    // Si estamos generando el chunk (0, 0, -1), poner la escalera de subida
    if (chunkX === 0 && chunkY === 0 && chunkZ === -1) {
        const spawnStairX = 28; // Debe coincidir con _applySpawnPlazaOverrides
        const spawnStairY = 32;
        
        const entityX = (spawnStairX * TILE_PX_WIDTH) + TILE_PX_WIDTH / 2;
        const entityY = (spawnStairY * TILE_PX_HEIGHT) + TILE_PX_HEIGHT / 2;

        terrain[spawnStairY][spawnStairX] = 'CAVE_FLOOR';
        
        // ¡MODIFICADO! Pasar Z a createEntity
        entities.push(
           createEntity('STAIRS_UP', entityX, entityY, chunkZ, `uid_0_0_-1_28_32_STAIRS_UP`)
        );
    }

    return { terrain, entities };
}


/**
 * Genera el chunk "base" (terreno y entidades)
 * (¡MODIFICADO PARA Z-LEVELS!)
 * @param {number} chunkX 
 * @param {number} chunkY 
 * @param {number} chunkZ // <-- ¡NUEVO!
 * @returns {object} { terrain: [...], entities: [...] }
 */
function generateNewChunk(chunkX, chunkY, chunkZ) {
    
    // --- ¡NUEVO! Delegar a generador de subsuelo si Z < 0 ---
    if (chunkZ < 0) {
        return generateUndergroundChunk(chunkX, chunkY, chunkZ);
    }
    
    // --- Generación de Superficie (Z=0) ---
    let terrain = [];
    let entities = [];
    
    for (let y = 0; y < CHUNK_GRID_HEIGHT; y++) {
        const row = [];
        for (let x = 0; x < CHUNK_GRID_WIDTH; x++) {
            
            const globalTileX = (chunkX * CHUNK_GRID_WIDTH) + x;
            const globalTileY = (chunkY * CHUNK_GRID_HEIGHT) + y;
            
            const biome = getBiome(globalTileX, globalTileY, chunkZ); 
            
            const terrainNoise = seededRandom(globalTileX * TERRAIN_SCALE, globalTileY * TERRAIN_SCALE);
            const vegetationNoise = seededRandom(globalTileX * VEGETATION_SCALE, globalTileY * VEGETATION_SCALE);
            
            const noises = { terrain: terrainNoise, vegetation: vegetationNoise };
            const entityUIDBase = `uid_${chunkX}_${chunkY}_${chunkZ}_${x}_${y}`; 
            const entityX = (globalTileX * TILE_PX_WIDTH) + TILE_PX_WIDTH / 2;
            const entityY = (globalTileY * TILE_PX_HEIGHT) + TILE_PX_HEIGHT / 2;

            const biomeConfig = BIOME_CONFIG[biome] || BIOME_CONFIG['PLAINS'];
            
            // ¡MODIFICADO! Pasar Z a getTileAndEntities
            const result = biomeConfig.getTileAndEntities(
                noises, 
                entityUIDBase, 
                entityX, 
                entityY,
                chunkZ, // <-- ¡PASAR Z!
                createEntity
            );
            
            row.push(result.tileKey);
            if (result.entities.length > 0) {
                entities.push(...result.entities.filter(e => e !== null));
            }
        }
        terrain.push(row);
    }

    // Solo aplicar en la superficie
    if (chunkX === 0 && chunkY === 0 && chunkZ === 0) {
        const overrideResult = _applySpawnPlazaOverrides(terrain, entities);
        terrain = overrideResult.terrain;
        entities = overrideResult.entities;
    }
    
    return { terrain, entities };
}


/**
 * Orquestador: Carga un chunk fusionado O Genera uno nuevo
 * (¡MODIFICADO!)
 * @param {number} chunkX 
 * @param {number} chunkY 
 * @param {number} chunkZ // <-- ¡NUEVO!
 * @param {string} chunkKey // <-- (ej: "x,y,z")
 * @returns {object} { chunkData, isNew }
 */
export async function getOrGenerateChunk(chunkX, chunkY, chunkZ, chunkKey) {
    const fusedChunk = await loadFusedChunk(chunkKey);
    
    if (fusedChunk) {
        return { chunkData: fusedChunk, isNew: false }; 
    }

    // ¡MODIFICADO! Pasar Z al generador
    const baseChunk = generateNewChunk(chunkX, chunkY, chunkZ);
    
    return { chunkData: baseChunk, isNew: true }; 
}