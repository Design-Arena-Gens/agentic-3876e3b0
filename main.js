import * as THREE from 'three';

// Game state
const gameState = {
    blocks: new Map(),
    selectedBlockType: 'grass',
    playerVelocity: new THREE.Vector3(),
    isJumping: false,
    keys: {},
    mouse: { x: 0, y: 0 },
    pointerLocked: false
};

// Block types
const blockTypes = {
    grass: { color: 0x7CFC00, top: 0x228B22, sides: 0x8B4513 },
    dirt: { color: 0x8B4513 },
    stone: { color: 0x808080 },
    wood: { color: 0xDEB887 },
    sand: { color: 0xF4A460 },
    water: { color: 0x4169E1, transparent: true, opacity: 0.7 }
};

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 50, 200);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(50, 100, 50);
directionalLight.castShadow = true;
directionalLight.shadow.camera.left = -100;
directionalLight.shadow.camera.right = 100;
directionalLight.shadow.camera.top = 100;
directionalLight.shadow.camera.bottom = -100;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Create block mesh
function createBlock(type, x, y, z) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const blockType = blockTypes[type];

    let materials;
    if (blockType.top) {
        materials = [
            new THREE.MeshLambertMaterial({ color: blockType.sides }),
            new THREE.MeshLambertMaterial({ color: blockType.sides }),
            new THREE.MeshLambertMaterial({ color: blockType.top }),
            new THREE.MeshLambertMaterial({ color: blockType.sides }),
            new THREE.MeshLambertMaterial({ color: blockType.sides }),
            new THREE.MeshLambertMaterial({ color: blockType.sides })
        ];
    } else {
        const material = new THREE.MeshLambertMaterial({
            color: blockType.color,
            transparent: blockType.transparent || false,
            opacity: blockType.opacity || 1
        });
        materials = material;
    }

    const mesh = new THREE.Mesh(geometry, materials);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { type, x, y, z };

    return mesh;
}

// Generate initial terrain
function generateTerrain() {
    const size = 30;
    for (let x = -size; x < size; x++) {
        for (let z = -size; z < size; z++) {
            const height = Math.floor(Math.sin(x * 0.1) * Math.cos(z * 0.1) * 3);

            // Ground layer
            for (let y = -2; y <= height; y++) {
                let type = 'stone';
                if (y === height) {
                    type = Math.random() > 0.9 ? 'sand' : 'grass';
                } else if (y === height - 1) {
                    type = 'dirt';
                }

                const block = createBlock(type, x, y, z);
                const key = `${x},${y},${z}`;
                gameState.blocks.set(key, block);
                scene.add(block);
            }

            // Random trees
            if (height >= 0 && Math.random() > 0.98) {
                for (let y = height + 1; y <= height + 4; y++) {
                    const block = createBlock('wood', x, y, z);
                    const key = `${x},${y},${z}`;
                    gameState.blocks.set(key, block);
                    scene.add(block);
                }

                // Leaves
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dz = -1; dz <= 1; dz++) {
                        if (dx === 0 && dz === 0) continue;
                        const block = createBlock('grass', x + dx, height + 5, z + dz);
                        const key = `${x + dx},${height + 5},${z + dz}`;
                        gameState.blocks.set(key, block);
                        scene.add(block);
                    }
                }
            }
        }
    }
}

// Raycasting for block interaction
const raycaster = new THREE.Raycaster();
const rayDirection = new THREE.Vector3();

function getTargetBlock() {
    camera.getWorldDirection(rayDirection);
    raycaster.set(camera.position, rayDirection);

    const intersects = raycaster.intersectObjects(Array.from(gameState.blocks.values()));

    if (intersects.length > 0 && intersects[0].distance < 8) {
        return intersects[0];
    }
    return null;
}

// Block interaction
function breakBlock() {
    const target = getTargetBlock();
    if (target) {
        const block = target.object;
        const key = `${block.userData.x},${block.userData.y},${block.userData.z}`;
        scene.remove(block);
        gameState.blocks.delete(key);
        block.geometry.dispose();
        if (Array.isArray(block.material)) {
            block.material.forEach(m => m.dispose());
        } else {
            block.material.dispose();
        }
    }
}

function placeBlock() {
    const target = getTargetBlock();
    if (target) {
        const normal = target.face.normal;
        const block = target.object;
        const newPos = {
            x: Math.round(block.position.x + normal.x),
            y: Math.round(block.position.y + normal.y),
            z: Math.round(block.position.z + normal.z)
        };

        // Check player collision
        const dist = camera.position.distanceTo(new THREE.Vector3(newPos.x, newPos.y, newPos.z));
        if (dist < 2) return;

        const key = `${newPos.x},${newPos.y},${newPos.z}`;
        if (!gameState.blocks.has(key)) {
            const newBlock = createBlock(gameState.selectedBlockType, newPos.x, newPos.y, newPos.z);
            gameState.blocks.set(key, newBlock);
            scene.add(newBlock);
        }
    }
}

// Block selector UI
const blockSelector = document.getElementById('blockSelector');
Object.keys(blockTypes).forEach((type, index) => {
    const div = document.createElement('div');
    div.className = 'blockOption';
    if (type === gameState.selectedBlockType) div.classList.add('active');

    const color = blockTypes[type].top || blockTypes[type].color;
    div.style.background = `#${color.toString(16).padStart(6, '0')}`;
    div.title = type;

    div.addEventListener('click', () => {
        gameState.selectedBlockType = type;
        document.querySelectorAll('.blockOption').forEach(el => el.classList.remove('active'));
        div.classList.add('active');
    });

    blockSelector.appendChild(div);
});

// Input handling
document.addEventListener('keydown', (e) => {
    gameState.keys[e.code] = true;

    const num = parseInt(e.key);
    if (num >= 1 && num <= 6) {
        const types = Object.keys(blockTypes);
        if (types[num - 1]) {
            gameState.selectedBlockType = types[num - 1];
            document.querySelectorAll('.blockOption').forEach((el, i) => {
                el.classList.toggle('active', i === num - 1);
            });
        }
    }
});

document.addEventListener('keyup', (e) => {
    gameState.keys[e.code] = false;
});

document.addEventListener('click', () => {
    if (!gameState.pointerLocked) {
        renderer.domElement.requestPointerLock();
    } else {
        breakBlock();
    }
});

document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (gameState.pointerLocked) {
        placeBlock();
    }
});

document.addEventListener('pointerlockchange', () => {
    gameState.pointerLocked = document.pointerLockElement === renderer.domElement;
});

document.addEventListener('mousemove', (e) => {
    if (gameState.pointerLocked) {
        const sensitivity = 0.002;
        camera.rotation.y -= e.movementX * sensitivity;
        camera.rotation.x -= e.movementY * sensitivity;
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
    }
});

// Physics and movement
const GRAVITY = -0.5;
const JUMP_FORCE = 0.3;
const MOVE_SPEED = 0.2;

function checkCollision(position) {
    const tolerance = 0.4;
    for (let y = -1; y <= 1; y++) {
        for (let x = -1; x <= 1; x++) {
            for (let z = -1; z <= 1; z++) {
                const key = `${Math.floor(position.x + x * tolerance)},${Math.floor(position.y + y)},${Math.floor(position.z + z * tolerance)}`;
                if (gameState.blocks.has(key)) {
                    return true;
                }
            }
        }
    }
    return false;
}

function updatePlayer(delta) {
    // Gravity
    gameState.playerVelocity.y += GRAVITY * delta;

    // Check ground
    const groundCheck = camera.position.clone();
    groundCheck.y -= 1.8;
    const onGround = checkCollision(groundCheck);

    if (onGround && gameState.playerVelocity.y < 0) {
        gameState.playerVelocity.y = 0;
        gameState.isJumping = false;
    }

    // Jump
    if (gameState.keys['Space'] && onGround && !gameState.isJumping) {
        gameState.playerVelocity.y = JUMP_FORCE;
        gameState.isJumping = true;
    }

    // Movement
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();

    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    right.crossVectors(forward, camera.up).normalize();

    const moveVector = new THREE.Vector3();

    if (gameState.keys['KeyW']) moveVector.add(forward);
    if (gameState.keys['KeyS']) moveVector.sub(forward);
    if (gameState.keys['KeyD']) moveVector.add(right);
    if (gameState.keys['KeyA']) moveVector.sub(right);

    if (moveVector.length() > 0) {
        moveVector.normalize().multiplyScalar(MOVE_SPEED);
    }

    // Apply movement with collision
    const newPos = camera.position.clone();
    newPos.x += moveVector.x;
    if (!checkCollision(newPos)) {
        camera.position.x = newPos.x;
    }

    newPos.set(camera.position.x, camera.position.y, camera.position.z);
    newPos.z += moveVector.z;
    if (!checkCollision(newPos)) {
        camera.position.z = newPos.z;
    }

    // Apply vertical velocity
    newPos.set(camera.position.x, camera.position.y + gameState.playerVelocity.y, camera.position.z);
    if (!checkCollision(newPos)) {
        camera.position.y += gameState.playerVelocity.y;
    } else {
        gameState.playerVelocity.y = 0;
    }

    // Prevent falling through floor
    if (camera.position.y < -5) {
        camera.position.set(0, 10, 20);
        gameState.playerVelocity.set(0, 0, 0);
    }
}

// Animation loop
let lastTime = performance.now();

function animate() {
    requestAnimationFrame(animate);

    const currentTime = performance.now();
    const delta = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    updatePlayer(delta);
    renderer.render(scene, camera);
}

// Window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize
generateTerrain();
animate();
