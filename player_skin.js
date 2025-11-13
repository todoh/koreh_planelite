// --- player_skin.js ---
// Gestiona los materiales del jugador (piel, ropa)
// y permite la personalización de la "skin" de la cara.
// --- ¡MODIFICADO! Se exportan los materiales ---
// --- ¡MODIFICADO! Usa MeshLambertMaterial y textura procedural ---
// --- ¡MODIFICADO! Ruido multiplicativo para coherencia de color ---

import * as THREE from 'three';

/**
 * ¡MODIFICADO!
 * Esta función AHORA SÍ se usa para crear una textura de ruido.
 * @param {THREE.Color} baseColor El color base de la piel.
 * @returns {THREE.CanvasTexture}
 */
function createProceduralSkinTexture(baseColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Color de piel base (de los parámetros)
    const baseR = baseColor.r * 255;
    const baseG = baseColor.g * 255;
    const baseB = baseColor.b * 255;

    // --- ¡AJUSTE! Usar ruido multiplicativo para "coherencia" ---
    // El ruido ahora aclara u oscurece el color base en un 5% (ej. 0.95 a 1.05)
    const noiseRange = 0.1; // Rango total (10%)
    const baseNoise = 1.0 - (noiseRange / 2); // 0.95 (el factor más bajo)
    const noiseAmount = noiseRange; // 0.1 (el rango a sumar)

    const imageData = ctx.createImageData(64, 64);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        // Generar un factor de ruido aleatorio para este píxel (ej. 0.95 a 1.05)
        const noiseFactor = baseNoise + (Math.random() * noiseAmount);
        
        // Aplicar ruido multiplicativo al color base
        data[i] = Math.max(0, Math.min(255, baseR * noiseFactor));     // Red
        data[i + 1] = Math.max(0, Math.min(255, baseG * noiseFactor)); // Green
        data[i + 2] = Math.max(0, Math.min(255, baseB * noiseFactor)); // Blue
        data[i + 3] = 255; // Alpha (sólido)
    }

    // Poner los datos de píxeles generados en el canvas
    ctx.putImageData(imageData, 0, 0);

    // --- OJOS Y BOCA 2D ELIMINADOS ---
    // (Ahora se manejan con geometría 3D en player_model.js)

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    // --- ¡AÑADIDO! Opciones de filtro para un look "pixelado" pero suave ---
    texture.magFilter = THREE.NearestFilter; // Mantiene el aspecto de píxel al acercarse
    texture.minFilter = THREE.LinearMipMapLinearFilter; // Suaviza a distancia
    texture.generateMipmaps = true; // Habilitar mipmaps
    texture.needsUpdate = true;
    return texture;
}


// --- Materiales Compartidos ---

// Guardamos el color base
const baseSkinColor = new THREE.Color(0xffffff);
// Creamos la textura procedural con ese color
const skinTexture = createProceduralSkinTexture(baseSkinColor);


// Usamos 'map' en skinMaterial. El color 0xffffff (blanco)
// asegura que la textura se muestre con sus colores originales.
// --- ¡AÑADIDO 'export'! ---
// --- ¡CAMBIADO a MeshLambertMaterial! ---
export const skinMaterial = new THREE.MeshLambertMaterial({ 
    color: 0xffffff, // Blanco, para que la textura no se tintee
    map: skinTexture // <-- ¡CAMBIO CLAVE! Usamos la textura procedural.
});
// ¡AÑADIDO! Guardamos el color base en userData (para futura referencia)
skinMaterial.userData = { baseColor: baseSkinColor };

// --- ¡CAMBIADO a MeshLambertMaterial! ---
export const shirtMaterial = new THREE.MeshLambertMaterial({ color: 0x3366cc });
// ¡AÑADIDO!
shirtMaterial.userData = { baseColor: new THREE.Color(0x3366cc) };

// --- ¡CAMBIADO a MeshLambertMaterial! ---
export const pantsMaterial = new THREE.MeshLambertMaterial({ color: 0x223344 });
// ¡AÑADIDO!
pantsMaterial.userData = { baseColor: new THREE.Color(0x223344) };

// --- ¡CAMBIADO a MeshLambertMaterial! ---
export const shoesMaterial = new THREE.MeshLambertMaterial({ color: 0x111111 });
// ¡AÑADIDO!
shoesMaterial.userData = { baseColor: new THREE.Color(0x111111) };