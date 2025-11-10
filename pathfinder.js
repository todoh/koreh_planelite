// --- pathfinder.js ---
// Implementa el algoritmo A* para encontrar rutas en el mundo.
// ¡MODIFICADO! Añade suavizado de ruta (String Pulling) para
// eliminar los "zig-zags" innecesarios.

import { checkCollision } from './collision.js';
import { TILE_PX_WIDTH, TILE_PX_HEIGHT } from './logic.js';

// --- Constantes del Pathfinding ---
const GRID_SIZE_X = TILE_PX_WIDTH;
const GRID_SIZE_Y = TILE_PX_HEIGHT;

// Clase interna para los nodos de A*
class PathNode {
    // ... (Constructor y getKey sin cambios) ...
    constructor(x, y, z) {
        this.x = x; // Coordenada de grid
        this.y = y; // Coordenada de grid
        this.z = z; // Nivel Z
        this.gScore = Infinity; // Coste desde el inicio
        this.fScore = Infinity; // Coste total estimado (g + h)
        this.parent = null;
    }
    
    // Genera una clave única para el Map
    getKey() {
        return `${this.x},${this.y}`;
    }
    
    // Obtiene las coordenadas en píxeles (centro del tile)
    getPixelCoords() {
        return {
            x: (this.x * GRID_SIZE_X) + (GRID_SIZE_X / 2),
            y: (this.y * GRID_SIZE_Y) + (GRID_SIZE_Y / 2)
        };
    }
}

// Función de heurística (distancia de Manhattan)
function heuristic(nodeA, nodeB) {
    return (Math.abs(nodeA.x - nodeB.x) + Math.abs(nodeA.y - nodeB.y)) * 10;
}

// Comprueba si un tile del grid es caminable
function isWalkable(gridX, gridY, z) {
    const pixelX = (gridX * GRID_SIZE_X) + (GRID_SIZE_X / 2);
    const pixelY = (gridY * GRID_SIZE_Y) + (GRID_SIZE_Y / 2);
    // checkCollision usa la Z del jugador por defecto, pero la pasamos
    // explícitamente por seguridad.
    const collision = checkCollision(pixelX, pixelY); 
    return !collision.solid;
}

// Reconstruye el camino desde el nodo final
function reconstructPath(node) {
    const path = [];
    let current = node;
    while (current) {
        path.push(current.getPixelCoords()); // Guardamos las coordenadas de píxeles
        current = current.parent;
    }
    return path.reverse(); // De inicio a fin
}

// --- ¡NUEVA FUNCIÓN DE LÍNEA DE VISIÓN! ---
/**
 * Comprueba si hay una línea de visión recta y caminable entre dos puntos.
 */
function hasLineOfSight(startPoint, endPoint, z) {
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Comprobar cada 1/4 de tile para asegurar precisión
    const numSteps = Math.ceil(distance / (GRID_SIZE_X / 4)); 
    
    if (numSteps === 0) return true;

    const stepX = dx / numSteps;
    const stepY = dy / numSteps;

    for (let i = 1; i <= numSteps; i++) {
        const checkX = startPoint.x + stepX * i;
        const checkY = startPoint.y + stepY * i;
        
        const gridX = Math.floor(checkX / GRID_SIZE_X);
        const gridY = Math.floor(checkY / GRID_SIZE_Y);

        if (!isWalkable(gridX, gridY, z)) {
            return false; // ¡Bloqueado!
        }
    }

    return true; // ¡Despejado!
}

// --- ¡NUEVA FUNCIÓN DE SUAVIZADO! ---
/**
 * Simplifica un camino de píxeles eliminando waypoints innecesarios.
 */
function smoothPath(path, z) {
    if (path.length < 3) {
        return path; // No se puede suavizar un camino de 2 puntos
    }

    const smoothedPath = [path[0]]; // Empezar con el punto de inicio
    let currentStartIndex = 0;

    while (currentStartIndex < path.length - 1) {
        const currentStartPoint = path[currentStartIndex];
        let furthestVisibleIndex = currentStartIndex + 1;

        // Buscar el punto más lejano al que podamos ir en línea recta
        for (let i = currentStartIndex + 2; i < path.length; i++) {
            if (hasLineOfSight(currentStartPoint, path[i], z)) {
                furthestVisibleIndex = i; // Lo vemos, sigue buscando
            } else {
                break; // Perdimos línea de visión, el anterior era el bueno
            }
        }
        
        // Añadir el punto más lejano que encontramos
        smoothedPath.push(path[furthestVisibleIndex]);
        // Empezar la siguiente búsqueda desde ese punto
        currentStartIndex = furthestVisibleIndex;
    }

    return smoothedPath;
}


/**
 * Encuentra un camino usando A*.
 * ¡MODIFICADO! Ahora suaviza el camino antes de devolverlo.
 * @param {number} startPixelX - Coordenada X (píxeles) de inicio
 * @param {number} startPixelY - Coordenada Y (píxeles) de inicio
 * @param {number} endPixelX - Coordenada X (píxeles) de destino
 * @param {number} endPixelY - Coordenada Y (píxeles) de destino
 * @param {number} z - Nivel Z en el que buscar
 * @returns {Array|null} Un array de waypoints {x, y} en píxeles, o null si no hay ruta.
 */
export function findPath(startPixelX, startPixelY, endPixelX, endPixelY, z) {
    
    // 1. Convertir píxeles a grid
    const startGridX = Math.floor(startPixelX / GRID_SIZE_X);
    const startGridY = Math.floor(startPixelY / GRID_SIZE_Y);
    const endGridX = Math.floor(endPixelX / GRID_SIZE_X);
    const endGridY = Math.floor(endPixelY / GRID_SIZE_Y);

    // 2. Comprobar si el destino es caminable
    if (!isWalkable(endGridX, endGridY, z)) {
        console.warn("Pathfinder: El destino no es caminable.");
        return null; // No se puede ir a un muro
    }

    // 3. Inicializar A*
    const startNode = new PathNode(startGridX, startGridY, z);
    const endNode = new PathNode(endGridX, endGridY, z);
    startNode.gScore = 0;
    startNode.fScore = heuristic(startNode, endNode);

    const openSet = new Map(); // K: "x,y", V: PathNode
    const closedSet = new Set(); // K: "x,y"
    
    openSet.set(startNode.getKey(), startNode);

    const maxIterations = 1000; // Seguridad para evitar bucles infinitos
    let iterations = 0;

    while (openSet.size > 0 && iterations < maxIterations) {
        iterations++;

        // 4. Encontrar el nodo con el fScore más bajo en openSet
        let currentNode = null;
        let minFScore = Infinity;
        for (const node of openSet.values()) {
            if (node.fScore < minFScore) {
                minFScore = node.fScore;
                currentNode = node;
            }
        }

        // 5. ¿Hemos llegado?
        if (currentNode.x === endNode.x && currentNode.y === endNode.y) {
            // --- ¡MODIFICACIÓN! ---
            const rawPath = reconstructPath(currentNode);
            const smooth = smoothPath(rawPath, z); // ¡Suavizar el camino!
            return smooth;
            // --- FIN DE MODIFICACIÓN ---
        }

        // 6. Mover nodo actual de openSet a closedSet
        openSet.delete(currentNode.getKey());
        closedSet.add(currentNode.getKey());

        // 7. Explorar vecinos (8 direcciones)
        for (let y = -1; y <= 1; y++) {
            for (let x = -1; x <= 1; x++) {
                if (x === 0 && y === 0) continue;

                const neighborX = currentNode.x + x;
                const neighborY = currentNode.y + y;
                const neighborKey = `${neighborX},${neighborY}`;

                // A. ¿Ya explorado?
                if (closedSet.has(neighborKey)) {
                    continue;
                }
                
                // B. ¿Es caminable?
                if (!isWalkable(neighborX, neighborY, z)) {
                    closedSet.add(neighborKey); // Marcar como no caminable
                    continue;
                }

                // C. Calcular coste de movimiento
                // (10 para ortogonal, 14 para diagonal)
                const moveCost = (x === 0 || y === 0) ? 10 : 14;
                const tentativeGScore = currentNode.gScore + moveCost;

                let neighborNode = openSet.get(neighborKey);
                
                if (!neighborNode) {
                    // Descubierto un nuevo nodo
                    neighborNode = new PathNode(neighborX, neighborY, z);
                    openSet.set(neighborKey, neighborNode);
                } else if (tentativeGScore >= neighborNode.gScore) {
                    // Esta ruta no es mejor
                    continue;
                }

                // Esta es la mejor ruta hasta ahora para este vecino
                neighborNode.parent = currentNode;
                neighborNode.gScore = tentativeGScore;
                neighborNode.fScore = neighborNode.gScore + heuristic(neighborNode, endNode);
            }
        }
    }

    console.warn("Pathfinder: No se encontró ruta (o se superaron las iteraciones).");
    return null; // No se encontró ruta
}