// --- generation.js ---
// Gestiona la generación procedural de chunks
// y la persistencia (guardado/carga) de chunks COMPLETOS.

import { 
    CHUNK_GRID_WIDTH, 
    CHUNK_GRID_HEIGHT, 
    TILE_PX_WIDTH, 
    TILE_PX_HEIGHT 
} from './logic.js';
// --- ¡MODIFICADO! Importar la nueva función de procesamiento y el config (vacío al inicio) ---
import { BIOME_CONFIG, processBiomeDefinitions } from './biome_definitions.js';
// --- ¡MODIFICADO! Importar la nueva función ---
import { 
    processTerrainDefinitions, 
    createEntity,
    processEntityDefinitions // <-- ¡NUEVA IMPORTACIÓN!
} from './entity.js';


// Cachés de assets
export const IMAGES = {}; // Imágenes PNG

// Clave para identificar chunks guardados en localStorage
export const CHUNK_KEY_REGEX = /^-?\d+,-?\d+,-?\d+$/; 

// --- LÓGICA DE SEMILLA (SEED) ---
let WORLD_SEED;

function _initializeNewWorldSeed() {
    
    const isLoadingGame = localStorage.getItem('GAME_STATE_LOAD') !== null;

    if (isLoadingGame) {
        console.log("Detectada carga de partida. Omitiendo limpieza de mundo.");
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


// --- ¡NUEVO! Almacén para la selección de biomas ---
let biomeWeightList = [];
let maxBiomeWeight = 0;

/**
 * Procesa los pesos de los biomas desde el JSON
 * y crea una lista de pesos acumulados para la selección.
 */
function initializeBiomeSelector(weights) {
    biomeWeightList = [];
    maxBiomeWeight = 0;
    
    if (!weights) {
        console.error("BIOME_WEIGHTS no encontrado en biome_definitions.json. Usando PLAINS por defecto.");
        biomeWeightList.push({ biome: 'PLAINS', cumulativeWeight: 1 });
        maxBiomeWeight = 1;
        return;
    }

    for (const biomeKey in weights) {
        if (weights.hasOwnProperty(biomeKey)) {
            const weight = weights[biomeKey];
            maxBiomeWeight += weight;
            biomeWeightList.push({ biome: biomeKey, cumulativeWeight: maxBiomeWeight });
        }
    }
    
    if (biomeWeightList.length === 0) {
         console.error("BIOME_WEIGHTS está vacío. Usando PLAINS por defecto.");
         biomeWeightList.push({ biome: 'PLAINS', cumulativeWeight: 1 });
         maxBiomeWeight = 1;
    }
    
    console.log("Selector de biomas inicializado. Peso total:", maxBiomeWeight);
}


/**
 * Carga una sola imagen
 */
async function loadImage(key, path) {
    // ... (Esta función no cambia)
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
 * Carga todos los JSON (terreno, entidades y biomas) y todas las imágenes PNG.
 */
export async function initializeMetadata() {
    
    // --- Cargar terrain_definitions.json ---
    console.log("Cargando terrain_definitions.json...");
    const terrainResponse = await fetch('./terrain_definitions.json');
    if (!terrainResponse.ok) throw new Error('No se pudo cargar terrain_definitions.json.');
    const terrainData = await terrainResponse.json();
    processTerrainDefinitions(terrainData);
    console.log("Metadata de terreno cargada.");

    // --- Cargar entity_definitions.json ---
    console.log("Cargando entity_definitions.json...");
    const entityResponse = await fetch('./entity_definitions.json');
    if (!entityResponse.ok) throw new Error('No se pudo cargar entity_definitions.json.');
    const entityData = await entityResponse.json();
    processEntityDefinitions(entityData); // <-- ¡NUEVA LLAMADA!
    console.log("Definiciones de entidad cargadas.");
    
    // --- ¡NUEVO! Cargar biome_definitions.json ---
    console.log("Cargando biome_definitions.json...");
    const biomeResponse = await fetch('./biome_definitions.json');
    if (!biomeResponse.ok) throw new Error('No se pudo cargar biome_definitions.json.');
    const biomeData = await biomeResponse.json();
    
    // --- ¡MODIFICADO! ---
    // Inicializar el selector de biomas con los pesos
    initializeBiomeSelector(biomeData.BIOME_WEIGHTS);
    // Procesar las definiciones de biomas
    processBiomeDefinitions(biomeData.BIOME_DEFINITIONS); // <-- Pasa solo el sub-objeto
    // --- FIN DE MODIFICACIÓN ---

    console.log("Definiciones de bioma cargadas.");
    // --- FIN DE MODIFICACIÓN ---


    const imageLoadPromises = [];
    
    // Cargar imágenes de terreno (usa 'terrainData' ahora)
    for (const key of Object.keys(terrainData)) {
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
    // (Esta lógica no cambia, sigue usando el array estático)
    const entityImageKeys = [
        "STATUE", "PLAYER", "TREE", "ROCK", "NPC", "ITEM",
        "CACTUS", "ACACIA_TREE", "JUNGLE_TREE", "SNOW_TREE",
        "MESATRABAJO", "COCHE",
        "STAIRS_UP", "STAIRS_DOWN", "IRON_VEIN" 
    ];
    
    for (const key of entityImageKeys) {
        if (!IMAGES[key.toUpperCase()]) {
            const imagePath = `./assets/${key.toLowerCase()}.png`;
            
            if (key === 'IRON_VEIN') {
                 imageLoadPromises.push(loadImage(key.toUpperCase(), './assets/rock.png'));
            }
            else if (key === 'STAIRS_UP') {
                 imageLoadPromises.push(loadImage(key.toUpperCase(), './assets/mesatrabajo.png'));
            }
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
    // ... (Esta función no cambia)
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
    // ... (Esta función no cambia)
    try {
        localStorage.setItem(chunkKey, JSON.stringify(chunkData));
    } catch (e) {
        console.error(`¡LocalStorage lleno! No se pudo guardar el chunk: ${chunkKey}`);
    }
}


// --- LÓGICA DE GENERACIÓN DE BIOMAS (VORONOI) ---
// ... (Toda la lógica de biomas, ruido y generación de chunks no cambia) ...

const TERRAIN_SCALE = 0.05;
const VEGETATION_SCALE = 0.5;
const BIOME_REGION_SIZE = 50;
const CAVE_SCALE = 0.1; 

function seededRandom(x, y, z = 0) { 
    const sin = Math.sin(x * 12.9898 + y * 78.233 + z * 45.435 + WORLD_SEED) * 43758.5453;
    return sin - Math.floor(sin); 
}

function smoothNoise(x, y, z = 0) { 
    const intX = Math.floor(x);
    const fracX = x - intX;
    const intY = Math.floor(y);
    const fracY = y - intY;
    const intZ = Math.floor(z);
    const fracZ = z - intZ;

    const v1 = seededRandom(intX, intY, intZ);
    const v2 = seededRandom(intX + 1, intY, intZ);
    const v3 = seededRandom(intX, intY + 1, intZ);
    const v4 = seededRandom(intX + 1, intY + 1, intZ);
    const v5 = seededRandom(intX, intY, intZ + 1);
    const v6 = seededRandom(intX + 1, intY, intZ + 1);
    const v7 = seededRandom(intX, intY + 1, intZ + 1);
    const v8 = seededRandom(intX + 1, intY + 1, intZ + 1);

    const i1 = (v1 * (1 - fracX)) + (v2 * fracX);
    const i2 = (v3 * (1 - fracX)) + (v4 * fracX);
    const i3 = (v5 * (1 - fracX)) + (v6 * fracX);
    const i4 = (v7 * (1 - fracX)) + (v8 * fracX);

    const j1 = (i1 * (1 - fracY)) + (i2 * fracY);
    const j2 = (i3 * (1 - fracY)) + (i4 * fracY);

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
    const biomeNoise = seededRandom(regionX * 10.7, regionY * 10.7); // Valor 0.0 a 1.0
    const targetWeight = biomeNoise * maxBiomeWeight; // Mapear al peso total

    // Encontrar el primer bioma que esté por encima del peso objetivo
    for (const item of biomeWeightList) {
        if (targetWeight < item.cumulativeWeight) {
            return item.biome;
        }
    }
    
    // Fallback (no debería pasar si maxBiomeWeight > 0)
    return biomeWeightList[biomeWeightList.length - 1]?.biome || 'PLAINS';
}

function getBiome(globalX, globalY, globalZ) {
    if (globalZ < 0) {
        return 'UNDERGROUND';
    }

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

function _applySpawnPlazaOverrides(terrain, entities) {
    // ... (Esta función no cambia)
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
            const z = 0; 

            if (globalTileX === 30 && globalTileY === 28) {
                 filteredEntities.push(
                    createEntity('STATUE', entityX, entityY, z, `uid_0_0_0_30_28_STATUE`) 
                 );
                terrain[y][x] = 'STONE_GROUND';
            }
            
             if (globalTileX === 31 && globalTileY === 30) {
                 filteredEntities.push(
                    createEntity('NPC', entityX, entityY, z, `uid_0_0_0_31_30_NPC`) 
                 );
                terrain[y][x] = 'STONE_GROUND';
            }
            
             if (globalTileX === 29 && globalTileY === 30) {
                 filteredEntities.push(
                    createEntity('CRAFTING_TABLE', entityX, entityY, z, `uid_0_0_0_29_30_CRAFTING`) 
                 );
                terrain[y][x] = 'STONE_GROUND';
            }
            
             if (globalTileX === 30 && globalTileY === 32) {
                 filteredEntities.push(
                    createEntity('SAPLING', entityX, entityY, z, `uid_0_0_0_30_32_SAPLING`) 
                 );
                terrain[y][x] = 'STONE_GROUND';
            }

             if (globalTileX === 32 && globalTileY === 32) {
                 filteredEntities.push(
                    createEntity('COCHE', entityX, entityY, z, `uid_0_0_0_32_32_COCHE`) 
                 );
                terrain[y][x] = 'STONE_GROUND';
            }

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

function generateUndergroundChunk(chunkX, chunkY, chunkZ) {
    // ... (Esta función no cambia)
    let terrain = [];
    let entities = [];
    
    for (let y = 0; y < CHUNK_GRID_HEIGHT; y++) {
        const row = [];
        for (let x = 0; x < CHUNK_GRID_WIDTH; x++) {
            
            const globalTileX = (chunkX * CHUNK_GRID_WIDTH) + x;
            const globalTileY = (chunkY * CHUNK_GRID_HEIGHT) + y;
            
            const caveNoise = smoothNoise(
                globalTileX * CAVE_SCALE, 
                globalTileY * CAVE_SCALE, 
                chunkZ * 0.5 
            );

            const entityUIDBase = `uid_${chunkX}_${chunkY}_${chunkZ}_${x}_${y}`;
            const entityX = (globalTileX * TILE_PX_WIDTH) + TILE_PX_WIDTH / 2;
            const entityY = (globalTileY * TILE_PX_HEIGHT) + TILE_PX_HEIGHT / 2;
            
            if (caveNoise > 0.6) { 
                row.push('CAVE_FLOOR');
                
            } else {
                row.push('ROCK_WALL'); 
                
                const mineralNoise = seededRandom(globalTileX * 1.5, globalTileY * 1.5, chunkZ);
                
                if (mineralNoise > 0.98) { 
                    entities.push(createEntity('IRON_VEIN', entityX, entityY, chunkZ, `${entityUIDBase}_IRON`));
                }
            }
        }
        terrain.push(row);
    }
    
    if (chunkX === 0 && chunkY === 0 && chunkZ === -1) {
        const spawnStairX = 28; 
        const spawnStairY = 32;
        
        const entityX = (spawnStairX * TILE_PX_WIDTH) + TILE_PX_WIDTH / 2;
        const entityY = (spawnStairY * TILE_PX_HEIGHT) + TILE_PX_HEIGHT / 2;

        terrain[spawnStairY][spawnStairX] = 'CAVE_FLOOR';
        
        entities.push(
           createEntity('STAIRS_UP', entityX, entityY, chunkZ, `uid_0_0_-1_28_32_STAIRS_UP`)
        );
    }

    return { terrain, entities };
}


function generateNewChunk(chunkX, chunkY, chunkZ) {
    // ... (Esta función no cambia)
    if (chunkZ < 0) {
        return generateUndergroundChunk(chunkX, chunkY, chunkZ);
    }
    
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

            // Esta línea ahora usa el BIOME_CONFIG que fue
            // poblado dinámicamente al inicio.
            const biomeConfig = BIOME_CONFIG[biome] || BIOME_CONFIG['PLAINS'];
            
            // Esta función ahora llamará a la lógica que generamos
            // dinámicamente en processBiomeDefinitions
            const result = biomeConfig.getTileAndEntities(
                noises, 
                entityUIDBase, 
                entityX, 
                entityY,
                chunkZ, 
                createEntity
            );
            
            row.push(result.tileKey);
            if (result.entities.length > 0) {
                entities.push(...result.entities.filter(e => e !== null));
            }
        }
        terrain.push(row);
    }

    if (chunkX === 0 && chunkY === 0 && chunkZ === 0) {
        const overrideResult = _applySpawnPlazaOverrides(terrain, entities);
        terrain = overrideResult.terrain;
        entities = overrideResult.entities;
    }
    
    return { terrain, entities };
}


export async function getOrGenerateChunk(chunkX, chunkY, chunkZ, chunkKey) {
    // ... (Esta función no cambia)
    const fusedChunk = await loadFusedChunk(chunkKey);
    
    if (fusedChunk) {
        return { chunkData: fusedChunk, isNew: false }; 
    }

    const baseChunk = generateNewChunk(chunkX, chunkY, chunkZ);
    
    return { chunkData: baseChunk, isNew: true }; 
}