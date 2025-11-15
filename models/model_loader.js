// --- models/model_loader.js ---
import * as THREE from 'three';

const modelCache = new Map(); 
const pendingLoads = new Map();
const textureLoader = new THREE.TextureLoader(); // Cargador de texturas
const TEXTURE_PATH = 'assets/';

/**
 * Parsea los datos del JSON a objetos Three.js soportando Colores y Texturas
 */
function parseModelData(data) {
    const parts = [];
    
    for (const partKey in data.geometries) {
        const geoData = data.geometries[partKey];
        const matData = data.materials[partKey] || {};
        const posData = data.positions[partKey] || { x: 0, y: 0, z: 0 };
        const rotData = data.rotations ? (data.rotations[partKey] || { x:0, y:0, z:0 }) : { x:0, y:0, z:0 }; // Soporte opcional para rotación local
        
        // 1. Geometría
     let geometry; 

// ¡NUEVO! Añadir un switch para comprobar la forma
const shape = geoData.shape || 'box'; // 'box' por defecto si no se especifica

switch (shape) {
    case 'cylinder':
        geometry = new THREE.CylinderGeometry(
            geoData.geoParams.radiusTop,
            geoData.geoParams.radiusBottom,
            geoData.geoParams.height,
            geoData.geoParams.radialSegments || 8 // 8 segmentos por defecto
        );
        break;
    case 'sphere':
        geometry = new THREE.SphereGeometry(
            geoData.geoParams.radius,
            geoData.geoParams.widthSegments || 16, // 16x8 por defecto
            geoData.geoParams.heightSegments || 8
        );
        break;
    case 'box':
    default:
        // MODIFICACIÓN CLAVE: Si la forma es 'box', comprueba si las dimensiones están en geoParams (silla)
        // o si están directamente en geoData (Ferrari/simple).
        const dims = geoData.geoParams || geoData;
        geometry = new THREE.BoxGeometry(
            dims.width || 1,
            dims.height || 1,
            dims.depth || 1
        );
}
        
        // 2. Material (Color o Textura)
        let material;

        // Configuración base del material
        const materialConfig = {
            transparent: true, // Permite transparencias en PNGs
            alphaTest: 0.5     // Recorta los píxeles transparentes (útil para estilo retro)
        };

        // A. Si hay TEXTURA
        if (matData.texture) {
            let textureName = matData.texture.toLowerCase();
            // Si no tiene un punto (asumimos que no tiene extensión), añade .png
            if (!textureName.includes('.')) {
                textureName += '.png';
            }

            const textureUrl = `${TEXTURE_PATH}${textureName}`;
            const texture = textureLoader.load(textureUrl);
            
            // Filtros para Pixel Art (NearestFilter evita el borrosidad)
            texture.magFilter = THREE.NearestFilter;
            texture.minFilter = THREE.NearestFilter;
            texture.colorSpace = THREE.SRGBColorSpace;

            materialConfig.map = texture;
            // Si también hay color, Three.js teñirá la textura con ese color
            if (matData.color) {
                materialConfig.color = new THREE.Color(matData.color);
            } else {
                materialConfig.color = 0xFFFFFF; // Blanco para no alterar la textura
            }
        } 
        // B. Si solo hay COLOR
        else if (matData.color) {
            materialConfig.color = new THREE.Color(matData.color);
        } 
        // C. Default (Blanco)
        else {
            materialConfig.color = 0xFFFFFF;
        }

        // Usamos MeshStandardMaterial para que reaccione a la luz, o Basic si prefieres sin sombras
        material = new THREE.MeshStandardMaterial(materialConfig);

        // 3. Matriz Local (Posición relativa al centro del modelo)
        const localMatrix = new THREE.Matrix4();
        
        // Crear posición
        const position = new THREE.Vector3(posData.x, posData.y, posData.z);
        
        // Crear rotación (Quaternion)
        const quaternion = new THREE.Quaternion();
        const euler = new THREE.Euler(
            (rotData.x || 0) * (Math.PI/180), // Convertir grados a radianes si usas grados en JSON
            (rotData.y || 0) * (Math.PI/180), 
            (rotData.z || 0) * (Math.PI/180)
        );
        quaternion.setFromEuler(euler);
        
        // Crear escala
        const scale = new THREE.Vector3(1, 1, 1);

        localMatrix.compose(position, quaternion, scale);

        parts.push({
            id: partKey,
            geometry: geometry,
            material: material,
            localMatrix: localMatrix
        });
    }
    
    return parts;
}

export function getModelDefinition(key) {
    if (modelCache.has(key)) return modelCache.get(key);
    if (pendingLoads.has(key)) return null;
    
    const filename = key.toLowerCase();
    // Asegúrate de que la ruta sea correcta en tu servidor
    const url = `assets/3d/${filename}.json`;
    
    // Creamos la promesa de carga
    const loadPromise = fetch(url)
        .then(response => {
            if (!response.ok) throw new Error(`Model JSON not found: ${url}`);
            return response.json();
        })
        .then(data => {
            const parts = parseModelData(data);
            modelCache.set(key, parts);
            pendingLoads.delete(key);
            console.log(`Modelo 3D cargado con texturas/colores: ${key}`);
            return parts; // Retornamos las partes para quien espere la promesa
        })
        .catch(err => {
            console.warn(`Fallo al cargar modelo 3D para ${key}:`, err);
            pendingLoads.delete(key);
            return null;
        });

    pendingLoads.set(key, loadPromise);
    return null; // Retorna null inmediatamente mientras carga asíncronamente
}