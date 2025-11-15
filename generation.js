// --- generation.js ---
// Gestiona la generación procedural de chunks
// y la persistencia (guardado/carga) de chunks COMPLETOS.
// ¡REFACTORIZADO! Ahora usa un 'getNoise' dinámico en lugar de ruidos pre-calculados.

import { 
    CHUNK_GRID_WIDTH, 
    CHUNK_GRID_HEIGHT, 
    TILE_PX_WIDTH, 
    TILE_PX_HEIGHT 
} from './logic.js';
import { BIOME_CONFIG, processBiomeDefinitions } from './biome_definitions.js';
import { 
    processTerrainDefinitions, 
    createEntity,
    processEntityDefinitions
} from './entity.js';
import { generateProceduralHouseBlueprint, placeHouse } from './structure_generation.js';
import { loadItemDefinitions, ITEM_DEFINITIONS } from './items.js';
import { loadCraftingRecipes } from './crafting_recipes.js';
// ¡NO NECESITAMOS IMPORTAR NADA DE initial_inventory.js aquí, logic.js lo maneja!


// Cachés de assets
export const IMAGES = {}; // Imágenes PNG

// Clave para identificar chunks guardados en localStorage
export const CHUNK_KEY_REGEX = /^-?\d+,-?\d+,-?\d+$/; 

// --- LÓGICA DE SEMILLA (SEED) ---
export let WORLD_SEED;

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


// --- Almacén para la selección de biomas ---
let biomeWeightList = [];
let maxBiomeWeight = 0;

/**
 * Procesa los pesos de los biomas desde el JSON
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
    processEntityDefinitions(entityData);
    console.log("Definiciones de entidad cargadas.");
    
    // --- Cargar biome_definitions.json ---
    console.log("Cargando biome_definitions.json...");
    const biomeResponse = await fetch('./biome_definitions.json');
    if (!biomeResponse.ok) throw new Error('No se pudo cargar biome_definitions.json.');
    const biomeData = await biomeResponse.json();
    
    initializeBiomeSelector(biomeData.BIOME_WEIGHTS);
    processBiomeDefinitions(biomeData.BIOME_DEFINITIONS);

    console.log("Definiciones de bioma cargadas.");

    // --- Cargar Items y Recetas ---
    console.log("Cargando items.json...");
    await loadItemDefinitions();
    
    console.log("Cargando crafting_recipes.json...");
    await loadCraftingRecipes();

    // --- Carga dinámica de imágenes ---
    console.log("Generando lista dinámica de assets...");
    const imageKeysToLoad = new Set();

    // 1. Añadir de terrain_definitions.json
    for (const key of Object.keys(terrainData)) {
        if (!key.startsWith("//")) imageKeysToLoad.add(key.toUpperCase());
    }

    // 2. Añadir de entity_definitions.json
    for (const key of Object.keys(entityData)) {
        if (key.startsWith("//")) continue;
        const renderComp = entityData[key].components?.find(c => c.type === 'Renderable');
        if (renderComp && renderComp.args && renderComp.args[0]) {
            imageKeysToLoad.add(renderComp.args[0].toUpperCase());
        }
    }

    // 3. Añadir de items.json
    for (const key of Object.keys(ITEM_DEFINITIONS)) {
        if (key.startsWith("//")) continue;
        if (ITEM_DEFINITIONS[key].imageKey) {
            imageKeysToLoad.add(ITEM_DEFINITIONS[key].imageKey.toUpperCase());
        }
    }
    console.log(`Lista de assets generada. ${imageKeysToLoad.size} imágenes únicas a cargar.`);
    
    // --- Bucle de carga unificado ---
    const imageLoadPromises = [];
    
    for (const key of imageKeysToLoad) {
        if (IMAGES[key]) continue; 
        
        const imagePath = `./assets/${key.toLowerCase()}.png`;
        
        // Fallbacks (mantenerlos por si acaso)
        if (key === 'CAVE_FLOOR') {
            imageLoadPromises.push(loadImage(key, './assets/stone_ground.png'));
        } else if (key === 'ROCK_WALL') {
            imageLoadPromises.push(loadImage(key, './assets/wall.png'));
        } else if (key === 'IRON_VEIN') {
             imageLoadPromises.push(loadImage(key.toUpperCase(), './assets/rock.png'));
        } else if (key === 'STAIRS_UP') {
             imageLoadPromises.push(loadImage(key.toUpperCase(), './assets/mesatrbajo.png'));
        } else if (key === 'STAIRS_DOWN') {
             imageLoadPromises.push(loadImage(key.toUpperCase(), './assets/coche.png'));
        } else if (key === 'WOOD_PLANK') {
             imageLoadPromises.push(loadImage(key.toUpperCase(), './assets/wall.png'));
        } else if (key === 'STICK') {
             imageLoadPromises.push(loadImage(key.toUpperCase(), './assets/item.png'));
        } else if (key === 'WOODEN_PICKAXE') {
             imageLoadPromises.push(loadImage(key.toUpperCase(), './assets/mano.png'));
        } else {
            // Carga estándar
            imageLoadPromises.push(loadImage(key.toUpperCase(), imagePath));
        }
    }
    
    await Promise.all(imageLoadPromises);
    console.log("¡Todas las imágenes (dinámicas) cargadas!");
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


// --- LÓGICA DE GENERACIÓN DE RUIDO Y BIOMAS ---

// --- ¡ESCALAS DE RUIDO MOVIDAS AQUÍ! ---
const TERRAIN_SCALE = 0.05;
const VEGETATION_SCALE = 0.5;
const MINERAL_SCALE = 0.2;     // <-- NUEVO
const NPC_SCALE = 1.5;         // <-- NUEVO
const ANIMAL_SCALE = 1.0;      // <-- NUEVO
const ENEMY_SCALE = 0.8;       // <-- NUEVO
const SPECIAL_SCALE = 3.0;     // <-- NUEVO

const BIOME_REGION_SIZE = 50;
const CAVE_SCALE = 0.1; 

export function seededRandom(x, y, z = 0) { 
    const sin = Math.sin(x * 12.9898 + y * 78.233 + z * 45.435 + WORLD_SEED) * 43758.5453;
    return sin - Math.floor(sin); 
}

function randomInt(min, max, seed) {
    const r = seededRandom(seed, min, max);
    return Math.floor(r * (max - min + 1)) + min;
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

/**
 * ¡NUEVO! Hub central para calcular cualquier tipo de ruido.
 * Esto es llamado por la función 'getNoise' pasada a los biomas.
 */
function getNoiseValue(noiseType, globalX, globalY, globalZ) {
    switch(noiseType) {
        case 'terrain':
            // Ruido simple y rápido para variaciones de tile
            return seededRandom(globalX * TERRAIN_SCALE, globalY * TERRAIN_SCALE, globalZ);
        case 'vegetation':
            // Ruido suave para agrupar vegetación
            return smoothNoise(globalX * VEGETATION_SCALE, globalY * VEGETATION_SCALE, globalZ);
        case 'mineral':
            // Ruido suave con escala diferente para minerales
            return smoothNoise(globalX * MINERAL_SCALE, globalY * MINERAL_SCALE, globalZ);
        case 'npc':
            // Ruido rápido y "punteado" para spawns raros de NPCs
            return seededRandom(globalX * NPC_SCALE, globalY * NPC_SCALE, globalZ);
        case 'animal':
            // Ruido suave para "manadas" de animales
            return smoothNoise(globalX * ANIMAL_SCALE, globalY * ANIMAL_SCALE, globalZ);
        case 'enemy':
            // Ruido suave para grupos de enemigos
            return smoothNoise(globalX * ENEMY_SCALE, globalY * ENEMY_SCALE, globalZ);
        case 'special':
            // Ruido muy "punteado" para eventos especiales/únicos
            return seededRandom(globalX * SPECIAL_SCALE, globalY * SPECIAL_SCALE, globalZ);
        default:
            console.warn(`Tipo de ruido desconocido: ${noiseType}. Usando 'vegetation'.`);
            return smoothNoise(globalX * VEGETATION_SCALE, globalY * VEGETATION_SCALE, globalZ);
    }
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
    const targetWeight = biomeNoise * maxBiomeWeight;

    for (const item of biomeWeightList) {
        if (targetWeight < item.cumulativeWeight) {
            return item.biome;
        }
    }
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
    const plazaCenterX = 30;
    const plazaCenterY = 30;
    const plazaRadius = 8;
    // Usamos el radio al cuadrado para comparaciones de distancia más rápidas
    const plazaRadiusSq = plazaRadius * plazaRadius;

    // 1. Filtrar entidades basado en la nueva área CIRCULAR
    const filteredEntities = entities.filter(entity => {
        const eGridX = Math.floor(entity.x / TILE_PX_WIDTH);
        const eGridY = Math.floor(entity.y / TILE_PX_HEIGHT);
        
        const dx = eGridX - plazaCenterX;
        const dy = eGridY - plazaCenterY;
        
        // Comprobación circular: (dx^2 + dy^2 <= r^2)
        const eInPlaza = (dx * dx + dy * dy) <= plazaRadiusSq;
        
        return !eInPlaza; // Mantiene solo las entidades FUERA de la plaza
    });

    // 2. Establecer el terreno circular
    for (let y = 0; y < CHUNK_GRID_HEIGHT; y++) {
        for (let x = 0; x < CHUNK_GRID_WIDTH; x++) {
            
            const globalTileX = x;
            const globalTileY = y;

            const dx = globalTileX - plazaCenterX;
            const dy = globalTileY - plazaCenterY;
            
            // Comprobación circular
            const inPlaza = (dx * dx + dy * dy) <= plazaRadiusSq;
            
            if (inPlaza) {
                terrain[y][x] = 'STONE_GROUND';
            }
        }
    }

    // 3. Añadir las nuevas entidades específicas de la plaza
    
    // Función auxiliar para crear las entidades y asegurar el suelo debajo
    const createPlazaEntity = (type, gridX, gridY) => {
        const entityX = (gridX * TILE_PX_WIDTH) + TILE_PX_WIDTH / 2;
        const entityY = (gridY * TILE_PX_HEIGHT) + TILE_PX_HEIGHT / 2;
        const z = 0;
        
        // Aseguramos el suelo, aunque el bucle anterior ya debería haberlo hecho
        terrain[gridY][gridX] = 'STONE_GROUND'; 
        
        return createEntity(type, entityX, entityY, z, `uid_0_0_0_${gridX}_${gridY}_${type}`);
    };

    // --- Colocación según tus requisitos ---

    // Centro (30, 30): Estatua
    filteredEntities.push(createPlazaEntity('STATUE', 28, 28));

    // Arriba (30, 28): Escaleras Abajo
    filteredEntities.push(createPlazaEntity('STAIRS_DOWN', 30, 23));

    // Abajo (30, 32): Coche
    filteredEntities.push(createPlazaEntity('CRAFTING_TABLE', 30, 32));

    // Izquierda (28, 30): Cofre (Asumiendo que 'CHEST' es un tipo de entidad válido)
    // Nota: Si 'CHEST' no existe, cámbialo por 'CRAFTING_TABLE' o el nombre correcto.
    filteredEntities.push(createPlazaEntity('TREE', 24, 30));

    // Derecha (32, 30): NPC
    filteredEntities.push(createPlazaEntity('NPC', 32, 30));

    
    return { terrain, entities: filteredEntities };
}
function generateUndergroundChunk(chunkX, chunkY, chunkZ) {
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
                
                // --- ¡REFACTORIZADO! ---
                // Usar el nuevo sistema de ruido para generar minerales subterráneos
                const mineralNoise = getNoiseValue('mineral', globalTileX, globalTileY, chunkZ);
                // --- FIN DE REFACTORIZACIÓN ---

                if (mineralNoise > 0.98) { // Ajusta este umbral
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


/**
 * ¡FUNCIÓN REFACTORIZADA!
 * Ya no pre-calcula 'vegetationNoise' y 'terrainNoise'.
 * En su lugar, crea una función 'getNoise' que calcula ruidos bajo demanda.
 */
function generateNewChunk(chunkX, chunkY, chunkZ) {
    
    if (chunkZ < 0) {
        return generateUndergroundChunk(chunkX, chunkY, chunkZ);
    }
    
    let terrain = [];
    let entities = [];
    
    // 1. Generar terreno y entidades base (bioma)
    for (let y = 0; y < CHUNK_GRID_HEIGHT; y++) {
        const row = [];
        for (let x = 0; x < CHUNK_GRID_WIDTH; x++) {
            
            const globalTileX = (chunkX * CHUNK_GRID_WIDTH) + x;
            const globalTileY = (chunkY * CHUNK_GRID_HEIGHT) + y;
            
            const biome = getBiome(globalTileX, globalTileY, chunkZ); 
            
            // --- ¡REFACTORIZADO! ---
            // Ya no pre-calculamos ruidos. Creamos una caché y una función 'getter'
            // que se pasarán al bioma.
            
            const noiseCache = new Map(); // Caché POR TILE
            const getNoise = (noiseType) => {
                if (noiseCache.has(noiseType)) {
                    return noiseCache.get(noiseType);
                }
                // 'getNoiseValue' es la nueva función central de ruido
                const value = getNoiseValue(noiseType, globalTileX, globalTileY, chunkZ);
                noiseCache.set(noiseType, value);
                return value;
            };
            // --- FIN DE REFACTORIZACIÓN ---

            const entityUIDBase = `uid_${chunkX}_${chunkY}_${chunkZ}_${x}_${y}`; 
            const entityX = (globalTileX * TILE_PX_WIDTH) + TILE_PX_WIDTH / 2;
            const entityY = (globalTileY * TILE_PX_HEIGHT) + TILE_PX_HEIGHT / 2;

            const biomeConfig = BIOME_CONFIG[biome] || BIOME_CONFIG['PLAINS'];
            
            // --- ¡MODIFICADO! Pasamos la función 'getNoise' en lugar del objeto 'noises'
            const result = biomeConfig.getTileAndEntities(
                getNoise, // <-- ¡CAMBIO!
                entityUIDBase, 
                entityX, 
                entityY,
                chunkZ, 
                createEntity
            );
            // --- FIN DE MODIFICACIÓN ---
            
            row.push(result.tileKey);
            if (result.entities.length > 0) {
                entities.push(...result.entities.filter(e => e !== null));
            }
        }
        terrain.push(row);
    }

    // 2. Lógica de Estructuras (sin cambios)
    const structureNoiseScale = 0.1; 
    const houseCheckIncrement = 10;
    
    for (let y = 0; y < CHUNK_GRID_HEIGHT; y += houseCheckIncrement) {
        for (let x = 0; x < CHUNK_GRID_WIDTH; x += houseCheckIncrement) {
            
            const globalTileX = (chunkX * CHUNK_GRID_WIDTH) + x;
            const globalTileY = (chunkY * CHUNK_GRID_HEIGHT) + y;
            
            const biome = getBiome(globalTileX, globalTileY, chunkZ);
            
            if (biome !== 'VILLAGE' && biome !== 'PLAINS') {
                continue;
            }

            const structureNoise = seededRandom(
                globalTileX * structureNoiseScale, 
                globalTileY * structureNoiseScale, 
                chunkZ
            );
            
            if (structureNoise > 0.85) { 
                const numHouses = 2 + Math.floor(seededRandom(globalTileX, globalTileY, chunkZ + 1) * 3);
                
                for (let i = 0; i < numHouses; i++) {
                    const offsetX = Math.floor(seededRandom(i, globalTileX, 1) * 30) - 15;
                    const offsetY = Math.floor(seededRandom(i, globalTileY, 2) * 30) - 15;
                    
                    const houseAnchorX = x + offsetX;
                    const houseAnchorY = y + offsetY;
                    
                    const houseSeed = (globalTileX + offsetX) * (globalTileY + offsetY);
                    const numRooms = randomInt(2, 4, houseSeed);
                    const blueprint = generateProceduralHouseBlueprint(
                        numRooms,
                        houseSeed 
                    );
                    
                    if (blueprint.length === 0) continue;

                    const finalAnchorX = Math.max(0, houseAnchorX);
                    const finalAnchorY = Math.max(0, houseAnchorY);

                    placeHouse(
                        chunkX, chunkY, chunkZ, 
                        finalAnchorX, finalAnchorY,
                        terrain, entities,
                        createEntity, 
                        blueprint
                    );
                }
                 break;
            }
        }
    }

    // 3. Aplicar "Spawn Plaza" (sin cambios)
    let { terrain: finalTerrain, entities: finalEntities } = { terrain, entities };
    if (chunkX === 0 && chunkY === 0 && chunkZ === 0) {
        const overrideResult = _applySpawnPlazaOverrides(finalTerrain, finalEntities);
        finalTerrain = overrideResult.terrain;
        finalEntities = overrideResult.entities;
    }
    
    return { terrain: finalTerrain, entities: finalEntities };
}


export async function getOrGenerateChunk(chunkX, chunkY, chunkZ, chunkKey) {
    const fusedChunk = await loadFusedChunk(chunkKey);
    
    if (fusedChunk) {
        return { chunkData: fusedChunk, isNew: false }; 
    }

    const baseChunk = generateNewChunk(chunkX, chunkY, chunkZ);
    
    return { chunkData: baseChunk, isNew: true }; 
}