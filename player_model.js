// --- player_model.js ---
// Define la geometría y el material para el jugador 3D.
// ¡MODELO HUMANOIDE v9 (Estructura de Torso de 3 partes)!
// --- ¡MODIFICADO para Sockets de Equipamiento! ---
// --- ¡MODIFICADO para Materiales de Skin Externos! ---
// --- ¡REFACTORIZADO (v13)! Jerarquía de Pies (Raíz en Y=0) ---

import * as THREE from 'three';
import { createSwordMesh, HAND_SIZE } from './models/sword_model.js';
import { skinMaterial, shirtMaterial, pantsMaterial, shoesMaterial } from './player_skin.js';

// --- Constantes de Proporciones (Basado en ~7.5-8 cabezas) ---
const HEAD_SIZE = 10; // Diámetro de la cabeza, nuestra unidad base

// --- ¡AJUSTADO! Cuello más alto ---
const NECK_HEIGHT = 4;
const NECK_RADIUS = 1.8;

// --- ¡REDISEÑADO! Proporciones Anatómicas del Torso ---
const PECHO_RADIUS = 10.0; 
const CADERA_RADIUS = 8.5;  
const CINTURA_RADIUS = 7.0; 
const SHOULDER_RADIUS = 8.5; 

const TORSO_DEPTH = 10; 

// Alturas de las secciones
const CHEST_HEIGHT = 16; 
const ABDOMEN_HEIGHT = 10; 
const HIPS_HEIGHT = 6;     
// Altura total de las mallas del torso: 16+10+6=32
const TORSO_HEIGHT = CHEST_HEIGHT + ABDOMEN_HEIGHT + HIPS_HEIGHT; 

// --- Aspect Ratios (para escalar en Z) ---
const HIPS_ASPECT_RATIO = (TORSO_DEPTH * 1.1) / (CADERA_RADIUS * 2); 
const ABDOMEN_ASPECT_RATIO = (TORSO_DEPTH * 0.7) / (CINTURA_RADIUS * 2); 
const CHEST_ASPECT_RATIO = TORSO_DEPTH / (PECHO_RADIUS * 2); 


// --- Proporciones de Miembros (Cónicos) ---
const SHOULDER_SIZE = 3; 
const UPPER_ARM_RADIUS_TOP = 3.0; 
const UPPER_ARM_RADIUS_BOTTOM = 2.5;
const LOWER_ARM_RADIUS_TOP = 2.5;
const LOWER_ARM_RADIUS_BOTTOM = 2.0;
const UPPER_ARM_HEIGHT = 14; 
const LOWER_ARM_HEIGHT = 13; 

const UPPER_LEG_RADIUS_TOP = 4.5; 
const UPPER_LEG_RADIUS_BOTTOM = 3.5;
const LOWER_LEG_RADIUS_TOP = 3.5;
const LOWER_LEG_RADIUS_BOTTOM = 2.5;
const UPPER_LEG_HEIGHT = 19; 
const LOWER_LEG_HEIGHT = 18; 
const FOOT_HEIGHT = 3;
const FOOT_DEPTH = 7;
const FOOT_WIDTH = 5;


// --- Posicionamiento Y (¡RECALCULADO!) ---
// (El ancla 0,0,0 está en el suelo entre los pies)

// --- ¡¡¡CLAVE DEL REFACTOR (v12)!!! ---
// HIPS_Y (Y=37) es la posición Y del pivote de la cadera.
const HIPS_Y = LOWER_LEG_HEIGHT + UPPER_LEG_HEIGHT; // (18 + 19) = 37.

// El torso (mallas) comienza en HIPS_Y (37) y sube TORSO_HEIGHT (32)
const TORSO_Y_BOTTOM = HIPS_Y; 
const TORSO_Y_TOP = TORSO_Y_BOTTOM + TORSO_HEIGHT; // 37 + 32 = 69
// El *centro* del torsoGroup (que contiene las 3 mallas)
const TORSO_CENTER_Y = TORSO_Y_BOTTOM + TORSO_HEIGHT / 2; // 37 + (32/2) = 53

// Posiciones Y centrales de las MALLAS (para .position.y)
// (Y=0 relativo al centro del torsoGroup, que estará en Y=16 relativo a la pelvis)
const HIPS_Y_POS = -(TORSO_HEIGHT / 2) + HIPS_HEIGHT / 2; // -16 + 3 = -13
const ABDOMEN_Y_POS = -(TORSO_HEIGHT / 2) + HIPS_HEIGHT + ABDOMEN_HEIGHT / 2; // -16 + 6 + 5 = -5
const CHEST_Y_POS = (TORSO_HEIGHT / 2) - CHEST_HEIGHT / 2; // 16 - 8 = 8

// --- Posiciones Y (Globales, para referencia) ---
const NECK_Y = TORSO_Y_TOP - 2 + NECK_HEIGHT / 2; // 69 + 2/2 = 70
const HEAD_Y = TORSO_Y_TOP - 3 + NECK_HEIGHT + HEAD_SIZE / 2; // 69 + 2 + 5 = 76
const SHOULDER_Y = TORSO_Y_TOP - SHOULDER_SIZE; // 69 - 3 = 66


// --- Materiales ---
const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });


/**
 * Crea la malla 3D personalizada para el jugador.
 * @returns {THREE.Group} Un grupo que contiene todas las partes del cuerpo del jugador.
 */
export function createPlayerMesh() {
    
    // playerGroup es el contenedor raíz, se queda en el suelo (Y=0)
    // --- ¡¡¡NUEVA JERARQUÍA v13!!! ---
    // playerGroup ES AHORA el pivote raíz para la gravedad.
    const playerGroup = new THREE.Group();

    // pelvisGroup (Cadera) es el pivote del torso/cabeza/brazos.
    const pelvisGroup = new THREE.Group();
    pelvisGroup.position.y = HIPS_Y; // Y=37 (relativo al suelo)
    playerGroup.add(pelvisGroup);
    // --- FIN DE NUEVA JERARQUÍA ---


    // --- Torso (Forma Anatómica) ---
    // El torsoGroup ahora es HIJO de pelvisGroup.
    const torsoGroup = new THREE.Group();
    // Su posición Y es relativa a la pelvis (Y=37).
    // Se centra en TORSO_CENTER_Y (53) global,
    // así que su Y relativa es (53 - 37) = 16.
    // O más simple: (TORSO_HEIGHT / 2)
    torsoGroup.position.y = TORSO_HEIGHT / 2; // Y=16 (relativo a la pelvis)
    pelvisGroup.add(torsoGroup); // <-- ¡AÑADIDO A LA PELVIS!

    // --- Mallas del Torso (sin cambios, relativas a torsoGroup) ---
    // 1. Cadera (Parte inferior)
    const hipsGeo = new THREE.CylinderGeometry(CINTURA_RADIUS, CADERA_RADIUS, HIPS_HEIGHT, 20, 3);
    const hips = new THREE.Mesh(hipsGeo, skinMaterial); 
    hips.position.y = HIPS_Y_POS; // (Y = -13 relativo al grupo torso)
    hips.scale.z = HIPS_ASPECT_RATIO; 
    torsoGroup.add(hips);

    // 2. Abdomen (Parte media)
    const abdomenGeo = new THREE.CylinderGeometry(PECHO_RADIUS, CINTURA_RADIUS, ABDOMEN_HEIGHT, 20, 4);
    const abdomen = new THREE.Mesh(abdomenGeo, skinMaterial); 
    abdomen.position.y = ABDOMEN_Y_POS; // (Y = -5 relativo al grupo torso)
    abdomen.scale.z = ABDOMEN_ASPECT_RATIO; 
    torsoGroup.add(abdomen);
    
    // 3. Pecho (Parte superior)
    const chestGeo = new THREE.CylinderGeometry(SHOULDER_RADIUS, PECHO_RADIUS, CHEST_HEIGHT, 20, 6);
    const chest = new THREE.Mesh(chestGeo, skinMaterial); 
    chest.position.y = CHEST_Y_POS; // (Y = 8 relativo al grupo torso)
    chest.scale.z = CHEST_ASPECT_RATIO; 
    torsoGroup.add(chest);
    // --- FIN DE MALLAS DE TORSO ---


    // --- Cuello (Hijo de torsoGroup) ---
    const neckGeo = new THREE.CylinderGeometry(NECK_RADIUS, NECK_RADIUS, NECK_HEIGHT, 12);
    const neck = new THREE.Mesh(neckGeo, skinMaterial);
    // Posición Y relativa al centro del torso (Y=16 relativo a la pelvis)
    // (GLOBAL NECK_Y = 70) - (GLOBAL TORSO_CENTER_Y = 53) = 17
    neck.position.y = NECK_Y - TORSO_CENTER_Y; // 17
    torsoGroup.add(neck); 
    
    // --- Cabeza (Hijo de torsoGroup) ---
    const headGroup = new THREE.Group();
    // (GLOBAL HEAD_Y = 76) - (GLOBAL TORSO_CENTER_Y = 53) = 23
    headGroup.position.y = HEAD_Y - TORSO_CENTER_Y; // 23
    torsoGroup.add(headGroup); 

    // 1. Esfera base de la cabeza
    const headBaseGeo = new THREE.SphereGeometry(HEAD_SIZE / 2, 32, 24); 
    const headBase = new THREE.Mesh(headBaseGeo, skinMaterial);
    headBase.position.y = 0; 
    headGroup.add(headBase);

    // 2. Ojos
    const eyeGeo = new THREE.SphereGeometry(HEAD_SIZE * 0.1, 12, 8); 
    const eyeLeft = new THREE.Mesh(eyeGeo, eyeMaterial);
    eyeLeft.position.set(-HEAD_SIZE * 0.2, HEAD_SIZE * 0.1, HEAD_SIZE * 0.45);
    headGroup.add(eyeLeft);
    const eyeRight = new THREE.Mesh(eyeGeo, eyeMaterial);
    eyeRight.position.set(HEAD_SIZE * 0.2, HEAD_SIZE * 0.1, HEAD_SIZE * 0.45);
    headGroup.add(eyeRight);

    // 3. Nariz
    const noseGeo = new THREE.BoxGeometry(HEAD_SIZE * 0.15, HEAD_SIZE * 0.2, HEAD_SIZE * 0.1);
    const nose = new THREE.Mesh(noseGeo, skinMaterial); 
    nose.position.set(0, -HEAD_SIZE * 0.05, HEAD_SIZE * 0.48);
    headGroup.add(nose);
    // --- FIN DE CABEZA ---

    // --- Geometrías de Miembros (sin cambios) ---
    const shoulderGeo = new THREE.SphereGeometry(SHOULDER_SIZE, 8, 8);
    const upperArmGeo = new THREE.CylinderGeometry(UPPER_ARM_RADIUS_TOP, UPPER_ARM_RADIUS_BOTTOM, UPPER_ARM_HEIGHT, 10, 4);
    const lowerArmGeo = new THREE.CylinderGeometry(LOWER_ARM_RADIUS_TOP, LOWER_ARM_RADIUS_BOTTOM, LOWER_ARM_HEIGHT, 10, 4);
    const handGeo = new THREE.SphereGeometry(HAND_SIZE, 8, 8); 

    const upperLegGeo = new THREE.CylinderGeometry(UPPER_LEG_RADIUS_TOP, UPPER_LEG_RADIUS_BOTTOM, UPPER_LEG_HEIGHT, 12, 4);
    const lowerLegGeo = new THREE.CylinderGeometry(LOWER_LEG_RADIUS_TOP, LOWER_LEG_RADIUS_BOTTOM, LOWER_LEG_HEIGHT, 12, 4); 
    const footGeo = new THREE.BoxGeometry(FOOT_WIDTH, FOOT_HEIGHT, FOOT_DEPTH, 4, 2, 2);

    // --- MIEMBROS IZQUIERDOS ---

    // --- Pierna Izquierda (Cadena Anidada) ---
    // --- ¡¡¡REFACTORIZADO v13!!! Anidado al playerGroup (raíz) ---
    const upperLegLeft = new THREE.Group();
    // Posición Y es HIPS_Y (relativa al suelo, Y=0)
    upperLegLeft.position.set(-CADERA_RADIUS * 0.7, HIPS_Y, 0); 
    playerGroup.add(upperLegLeft); // <-- ¡AÑADIDO AL PLAYER GROUP!

    const legLeft = new THREE.Mesh(upperLegGeo, skinMaterial);
    legLeft.position.y = -UPPER_LEG_HEIGHT / 2; // Relativo al pivote de cadera (upperLegLeft)
    upperLegLeft.add(legLeft);

    const lowerLegLeft = new THREE.Group();
    lowerLegLeft.position.y = -UPPER_LEG_HEIGHT; 
    upperLegLeft.add(lowerLegLeft); 

    const calfLeft = new THREE.Mesh(lowerLegGeo, skinMaterial);
    calfLeft.position.y = -LOWER_LEG_HEIGHT / 2;
    lowerLegLeft.add(calfLeft);

    const footLeft = new THREE.Mesh(footGeo, shoesMaterial);
    footLeft.position.set(0, -LOWER_LEG_HEIGHT + FOOT_HEIGHT / 2, FOOT_DEPTH / 2 - LOWER_LEG_RADIUS_BOTTOM / 2); 
    lowerLegLeft.add(footLeft);

    // --- Brazo Izquierdo (Cadena Anidada) ---
    // --- (Sin cambios) Anidado al torsoGroup ---
    const upperArmLeft = new THREE.Group();
    const shoulder_X_Radius = SHOULDER_RADIUS; // 8.5
    // Posición Y relativa al centro del torso (Y=16 relativo a la pelvis)
    // (GLOBAL SHOULDER_Y = 66) - (GLOBAL TORSO_CENTER_Y = 53) = 13
    upperArmLeft.position.set(-(shoulder_X_Radius + SHOULDER_SIZE * 0.5), SHOULDER_Y - TORSO_CENTER_Y, 0); // Y=13
    torsoGroup.add(upperArmLeft); // <-- ¡AÑADIDO AL TORSO!

    const shoulderLeft = new THREE.Mesh(shoulderGeo, skinMaterial);
    shoulderLeft.position.y = 0; 
    upperArmLeft.add(shoulderLeft);
    
    const armLeft = new THREE.Mesh(upperArmGeo, skinMaterial);
    armLeft.position.y = -UPPER_ARM_HEIGHT / 2; 
    upperArmLeft.add(armLeft);

    const lowerArmLeft = new THREE.Group();
    lowerArmLeft.position.y = -UPPER_ARM_HEIGHT; 
    upperArmLeft.add(lowerArmLeft);

    const forearmLeft = new THREE.Mesh(lowerArmGeo, skinMaterial);
    forearmLeft.position.y = -LOWER_ARM_HEIGHT / 2;
    lowerArmLeft.add(forearmLeft);

    const handLeftGroup = new THREE.Group(); 
    handLeftGroup.position.y = -LOWER_ARM_HEIGHT;
    lowerArmLeft.add(handLeftGroup);

    const handLeft = new THREE.Mesh(handGeo, skinMaterial);
    handLeftGroup.add(handLeft);


    // --- MIEMBROS DERECHOS ---

    // --- Pierna Derecha ---
    // --- ¡¡¡REFACTORIZADO v13!!! Anidado al playerGroup (raíz) ---
    const upperLegRight = new THREE.Group();
    // Posición Y es HIPS_Y (relativa al suelo, Y=0)
    upperLegRight.position.set(CADERA_RADIUS * 0.7, HIPS_Y, 0); 
    playerGroup.add(upperLegRight); // <-- ¡AÑADIDO AL PLAYER GROUP!

    const legRight = new THREE.Mesh(upperLegGeo, skinMaterial);
    legRight.position.y = -UPPER_LEG_HEIGHT / 2; // Relativo al pivote de cadera (upperLegRight)
    upperLegRight.add(legRight);

    const lowerLegRight = new THREE.Group();
    lowerLegRight.position.y = -UPPER_LEG_HEIGHT;
    upperLegRight.add(lowerLegRight);

    const calfRight = new THREE.Mesh(lowerLegGeo, skinMaterial);
    calfRight.position.y = -LOWER_LEG_HEIGHT / 2;
    lowerLegRight.add(calfRight);

    const footRight = new THREE.Mesh(footGeo, shoesMaterial);
    footRight.position.set(0, -LOWER_LEG_HEIGHT + FOOT_HEIGHT / 2, FOOT_DEPTH / 2 - LOWER_LEG_RADIUS_BOTTOM / 2);
    lowerLegRight.add(footRight);

    // --- Brazo Derecho ---
    // --- (Sin cambios) Anidado al torsoGroup ---
    const upperArmRight = new THREE.Group();
    // Posición Y relativa al centro del torso (Y=16 relativo a la pelvis)
    upperArmRight.position.set(shoulder_X_Radius + SHOULDER_SIZE * 0.5, SHOULDER_Y - TORSO_CENTER_Y, 0); // Y=13
    torsoGroup.add(upperArmRight); // <-- ¡AÑADIDO AL TORSO!

    const shoulderRight = new THREE.Mesh(shoulderGeo, skinMaterial);
    shoulderRight.position.y = 0;
    upperArmRight.add(shoulderRight);
    
    const armRight = new THREE.Mesh(upperArmGeo, skinMaterial);
    armRight.position.y = -UPPER_ARM_HEIGHT / 2;
    upperArmRight.add(armRight);

    const lowerArmRight = new THREE.Group();
    lowerArmRight.position.y = -UPPER_ARM_HEIGHT;
    upperArmRight.add(lowerArmRight);

    const forearmRight = new THREE.Mesh(lowerArmGeo, skinMaterial);
    forearmRight.position.y = -LOWER_ARM_HEIGHT / 2;
    lowerArmRight.add(forearmRight);

    const handRightGroup = new THREE.Group(); 
    handRightGroup.position.y = -LOWER_ARM_HEIGHT;
    lowerArmRight.add(handRightGroup);
    
    const handRight = new THREE.Mesh(handGeo, skinMaterial);
    handRightGroup.add(handRight);
    
    // --- Añadir Espada (sin cambios) ---
    const defaultSword = createSwordMesh();
    defaultSword.name = "EQUIPMENT_MESH"; 
    handLeftGroup.add(defaultSword);
    
    
    // --- Guardar referencias para Animación (¡REFACTORIZADO v13!) ---
    playerGroup.userData.pelvis = pelvisGroup; // Pivote del torso
    playerGroup.userData.head = headGroup; 
    playerGroup.userData.torso = torsoGroup; 

    // Pivotes de Cadera (Ahora en la raíz)
    playerGroup.userData.legLeft = upperLegLeft;
    playerGroup.userData.legRight = upperLegRight;
    // ...
    playerGroup.userData.lowerLegLeft = lowerLegLeft;
    playerGroup.userData.lowerLegRight = lowerLegRight;
    
    playerGroup.userData.armLeft = upperArmLeft;
    playerGroup.userData.armRight = upperArmRight;
    playerGroup.userData.lowerArmLeft = lowerArmLeft;
    playerGroup.userData.lowerArmRight = lowerArmRight;
    
    playerGroup.userData.handLeftGroup = handLeftGroup;
    playerGroup.userData.handRightGroup = handRightGroup;

    // --- ¡¡¡VALORES BASE REFACTORIZADOS v13!!! ---
    // Posición Y base de la *pelvis* (relativa al suelo)
    playerGroup.userData.basePelvisY = HIPS_Y; // 37
    // Posición Y base de las *caderas de las piernas* (relativas al suelo)
    playerGroup.userData.baseLegLeftY = HIPS_Y; // 37
    playerGroup.userData.baseLegRightY = HIPS_Y; // 37
    
    // Posición Y base del *torso* (relativa a la pelvis)
    playerGroup.userData.baseTorsoY = TORSO_HEIGHT / 2; // 16
    // Posición Y base de la *cabeza* (relativa al torso)
    playerGroup.userData.baseHeadY = HEAD_Y - TORSO_CENTER_Y; // 23

    playerGroup.userData.height = HEAD_Y + HEAD_SIZE / 2; // Aprox 81

    console.log("Malla 3D del jugador (v13 - Jerarquía de Pies) creada.");
    return playerGroup;
}