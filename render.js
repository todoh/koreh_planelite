// --- render.js ---
// Gestiona el dibujado en el Canvas y su redimensionamiento.

import { 
    applyCameraTransforms, 
    restoreCameraTransforms 
} from './camera.js';
import { 
    IMAGES, 
    TILE_PX_WIDTH, 
    TILE_PX_HEIGHT 
} from './logic.js';

let $canvas;
let ctx;
let onResizeCamera = () => {};

/**
 * Inicializa el renderer, obtiene el contexto y añade el listener de redimensionado.
 * @param {HTMLCanvasElement} $canvasElement 
 * @param {function} cameraResizer - Función de callback (resizeCamera)
 */
export function initializeRenderer($canvasElement, cameraResizer) {
    $canvas = $canvasElement;
    ctx = $canvas.getContext('2d');
    onResizeCamera = cameraResizer;

    resizeCanvas(); // Ajustar tamaño inicial
    window.addEventListener('resize', resizeCanvas);
}

/**
 * Redimensiona el canvas para que ocupe su contenedor e informa a la cámara.
 */
function resizeCanvas() {
    $canvas.width = $canvas.clientWidth;
    $canvas.height = $canvas.clientHeight;
    ctx.imageSmoothingEnabled = false;
    onResizeCamera($canvas); // Informar a la cámara del nuevo tamaño
}

/**
 * Dibuja el frame actual del juego.
 * @param {number} playerX 
 * @param {number} playerY 
 * @param {Array<object>} objectsToRender - Lista ordenada de tiles y entidades
 */
export function renderFrame(playerX, playerY, objectsToRender) {
    // 1. Limpiar el canvas
    ctx.fillStyle = '#1a1a1a'; 
    ctx.fillRect(0, 0, $canvas.width, $canvas.height);

    // 2. Aplicar transformaciones de cámara
    applyCameraTransforms(ctx, playerX, playerY);

    // 3. Dibujar todos los objetos ordenados
    for (const obj of objectsToRender) {
        // Pasamos '0' como rotación, ya que la cámara no rota
        drawSprite(ctx, obj.key, obj.x, obj.y, obj.isGround, 0);
        
        // ¡NUEVO! Dibujar nombres de otros jugadores
        if (obj.name) {
            drawPlayerName(ctx, obj.name, obj.x, obj.y);
        }
    }
    
    // 4. Restaurar
    restoreCameraTransforms(ctx);
} 

/**
 * Dibuja un sprite (PNG) en el canvas
 * @param {CanvasRenderingContext2D} ctx 
 * @param {string} key - Clave de la imagen (ej: "PLAYER", "TREE")
 * @param {number} x - Coordenada X del MUNDO (ancla)
 * @param {number} y - Coordenada Y del MUNDO (ancla)
 * @param {boolean} isGround - ¿Es un tile de suelo?
 * @param {number} rotationToUndo - Rotación de la cámara (para billboarding)
 */
function drawSprite(ctx, key, x, y, isGround = false, rotationToUndo = 0) {
    const img = IMAGES[key];
    if (!img) return; // Imagen no encontrada o no cargada

    if (isGround) {
        // SUELO: 'y' es la esquina SUPERIOR-izquierda.
        ctx.drawImage(img, x, y, TILE_PX_WIDTH, TILE_PX_HEIGHT);
    } else {
        // ENTIDAD: 'y' son los 'PIES' (centro-inferior).
        ctx.save();
        // 1. Moverse al ancla (pies) de la entidad
        ctx.translate(x, y);
        // 2. Des-rotar el canvas localmente (siempre 0)
        ctx.rotate(rotationToUndo); 
        // 3. Calcular pos. de dibujo (top-left) RELATIVA al ancla
        const drawX = -img.width / 2;
        const drawY = -img.height;
        // 4. Dibujar
        ctx.drawImage(img, drawX, drawY);
        // 5. Restaurar
        ctx.restore();
    }
}

/**
 * ¡NUEVO! Dibuja el nombre de un jugador sobre su cabeza.
 */
function drawPlayerName(ctx, name, x, y) {
    const img = IMAGES['PLAYER']; // Asumir altura del sprite de jugador
    const imgHeight = img ? img.height : TILE_PX_HEIGHT;
    
    // Posición sobre la cabeza
    const textX = x;
    const textY = y - imgHeight - 10; // 10 píxeles sobre la imagen

    ctx.save();
    ctx.translate(textX, textY);
    // ctx.rotate(rotationToUndo); // Des-rotar (0)
    
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    
    // Sombra de texto
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillText(name, 1, 1);
    
    // Texto principal
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(name, 0, 0);
    
    ctx.restore();
}