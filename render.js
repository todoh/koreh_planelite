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
 * ¡NUEVO! Calcula los colores de tinte para el ciclo de día/noche.
 * @param {number} timeOfDay - 0.0 a 1.0
 * @returns {object} { nightTint: string, sunTint: string }
 */
function calculateTints(timeOfDay) {
    // 1. Calcular Brillo (0.0 = medianoche, 1.0 = mediodía)
    // Usamos un coseno para una transición suave
    const brightness = (Math.cos((timeOfDay - 0.5) * 2 * Math.PI) + 1) / 2;

    // 2. Tinte de Noche (Oscuridad y Azul)
    // 'multiply' oscurece todo.
    const nightAlpha = (1.0 - brightness) * 0.7; // Max 70% de oscuridad
    const nightTint = `rgba(0, 5, 50, ${nightAlpha.toFixed(2)})`;

    // 3. Tinte de Amanecer/Atardecer (Naranja/Rojo)
    // 'soft-light' o 'overlay' da color sin oscurecer demasiado.
    // Queremos esto cuando el brillo es bajo (cerca de 0), pero no 0.
    let sunAlpha = 0;
    if (brightness > 0.0 && brightness < 0.3) {
        // Pico de color al amanecer/atardecer (brightness ~ 0)
        sunAlpha = (1.0 - (brightness / 0.3)) * 0.4; // Max 40% de tinte
    }
    const sunTint = `rgba(255, 150, 0, ${sunAlpha.toFixed(2)})`;
    
    return { nightTint, sunTint };
}


/**
 * Dibuja el frame actual del juego.
 * ¡MODIFICADO! Acepta timeOfDay.
 * @param {number} playerX 
 * @param {number} playerY 
 * @param {Array<object>} objectsToRender - Lista ordenada de tiles y entidades
 * @param {number} timeOfDay - Reloj del juego (0.0 a 1.0)
 */
export function renderFrame(playerX, playerY, objectsToRender, timeOfDay) {
    // 1. Limpiar el canvas
    ctx.fillStyle = '#1a1a1a'; 
    ctx.fillRect(0, 0, $canvas.width, $canvas.height);

    // 2. Aplicar transformaciones de cámara
    const cameraYOffset = TILE_PX_HEIGHT * 1.5;
    applyCameraTransforms(ctx, playerX, playerY - cameraYOffset);

    // 3. Dibujar todos los objetos ordenados
    for (const obj of objectsToRender) {
        // Pasamos '0' como rotación y la nueva dirección 'obj.facing'
        drawSprite(ctx, obj.key, obj.x, obj.y, obj.isGround, 0, obj.facing); // <-- ¡MODIFICADO!
        
        // ¡NUEVO! Dibujar nombres de otros jugadores
        if (obj.name) {
            drawPlayerName(ctx, obj.name, obj.x, obj.y);
        }
    }
    
    // 4. Restaurar
    restoreCameraTransforms(ctx);

    // --- ¡NUEVO! Aplicar Tinte de Día/Noche ---
    // Lo dibujamos DESPUÉS de restaurar la cámara, como una superposición
    // en el espacio de la pantalla (Screen Space).
    
    const { nightTint, sunTint } = calculateTints(timeOfDay);

    // Capa 1: Oscuridad (Multiply)
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = nightTint;
    ctx.fillRect(0, 0, $canvas.width, $canvas.height);
    
    // Capa 2: Color de sol (Soft Light)
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = sunTint;
    ctx.fillRect(0, 0, $canvas.width, $canvas.height);
    
    // Resetear al modo normal para el siguiente frame
    ctx.globalCompositeOperation = 'source-over';
} 

/**
 * Dibuja un sprite (PNG) en el canvas
 * @param {CanvasRenderingContext2D} ctx 
 * @param {string} key - Clave de la imagen (ej: "PLAYER", "TREE")
 * @param {number} x - Coordenada X del MUNDO (ancla)
 * @param {number} y - Coordenada Y del MUNDO (ancla)
 * @param {boolean} isGround - ¿Es un tile de suelo?
 * @param {number} rotationToUndo - Rotación de la cámara (para billboarding)
 * @param {string} facing - Dirección ('left', 'right', 'up', 'down')
 */
function drawSprite(ctx, key, x, y, isGround = false, rotationToUndo = 0, facing = 'right') { // <-- ¡MODIFICADO!
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
        
        // --- ¡NUEVA LÓGICA DE VOLTEO! ---
        // 3. Si mira a la izquierda, voltear el contexto horizontalmente
        if (facing === 'left') {
            ctx.scale(-1, 1);
        }
        // --- FIN DE LÓGICA ---

        // 4. Calcular pos. de dibujo (top-left) RELATIVA al ancla
        const drawX = -img.width / 2;
        const drawY = -img.height;
        // 5. Dibujar
        ctx.drawImage(img, drawX, drawY);
        // 6. Restaurar
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