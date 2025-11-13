// --- models/item_sprite_model.js ---
// Crea un mesh 3D (plano) a partir de una clave de imagen 2D.

import * as THREE from 'three';
import { IMAGES } from '../logic.js';
import { HAND_SIZE } from './sword_model.js'; // Usamos la misma constante para el posicionamiento

// Caché para no recrear texturas y materiales
const textureCache = new Map();
const materialCache = new Map();

// Dimensión máxima (en unidades 3D) que tendrá el sprite en la mano.
// const MAX_SPRITE_DIMENSION = 20; // <--- 1. ¡ELIMINA O COMENTA ESTA LÍNEA!

/**
 * Crea un mesh 3D (Plano) para un item, basado en su imagen.
 * @param {string} imageKey - La clave de la imagen (ej: "ITEM_WOOD_WALL").
 * @returns {THREE.Group | null} Un grupo que contiene el sprite, listo para ser acoplado.
 */
export function createItemSpriteMesh(imageKey) {
    const img = IMAGES[imageKey];
    if (!img || !img.naturalWidth || img.naturalWidth === 0) {
        console.warn(`[ItemSprite] No se encontró imagen o la imagen no tiene dimensiones para: ${imageKey}`);
        return null;
    }

    // --- 1. Calcular Tamaño ---
    
    // --- ¡INICIO DE LA MODIFICACIÓN! ---
    // Mantenemos el aspect ratio, pero escalamos para que quepa en la mano
    // const scale = MAX_SPRITE_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight); // <--- 2. ELIMINA ESTA LÍNEA
    
    // 3. CAMBIA ESTAS DOS LÍNEAS:
    // const spriteWidth = img.naturalWidth * scale; // (Línea antigua)
    // const spriteHeight = img.naturalHeight * scale; // (Línea antigua)
    
    // POR ESTAS DOS LÍNEAS NUEVAS:
    const spriteWidth = img.naturalWidth / 4;
    const spriteHeight = img.naturalHeight / 4;
    // --- FIN DE LA MODIFICACIÓN! ---


    // --- 2. Geometría ---
    // PlaneGeometry es vertical (plano XY) por defecto, lo cual es correcto.
    const geometry = new THREE.PlaneGeometry(spriteWidth, spriteHeight);

    // --- 3. Textura (Cacheada) ---
    let texture = textureCache.get(imageKey);
    if (!texture) {
        texture = new THREE.Texture(img);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        textureCache.set(imageKey, texture);
    }

    // --- 4. Material (Cacheado) ---
    let material = materialCache.get(imageKey);
    if (!material) {
        material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.1, // No renderizar píxeles transparentes
            side: THREE.DoubleSide // Asegura que se vea por ambos lados
        });
        materialCache.set(imageKey, material);
    }

    // --- 5. Ensamblaje ---
    // Usamos un Grupo para posicionar el pivote (el "mango")
    const itemGroup = new THREE.Group();
    const mesh = new THREE.Mesh(geometry, material);

    // Centramos el mesh verticalmente para que su base (y=0) sea el "mango"
    mesh.position.y = spriteHeight / 2.1;
    itemGroup.add(mesh);

    // --- 6. Posicionamiento en el Socket de la Mano ---
    // (Copiado de sword_model.js para consistencia)
    
    // Posiciona el "mango" (el origen del grupo) en el centro de la mano
    itemGroup.position.y = -HAND_SIZE;
    // Lo mueve ligeramente hacia adelante para que no se clave en la mano
    itemGroup.position.z = HAND_SIZE / 2; 

    // Rotamos el grupo para que el sprite apunte hacia adelante.
    // (Igual que la espada, rotamos 90 grados en X)
    itemGroup.rotation.x = Math.PI / 2;

    return itemGroup;
}