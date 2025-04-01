// Constants
const SEED = 12345; // Changed seed for potentially better results
const PIXEL_SIZE = 6; // Size of each pixel in the grid
const IMAGE_SIZE = 64; // Size of the image in pixels (adjust if cat.png is different)
const MASK_SIZE = 96; // Size of the mask in pixels (larger than image)
const SOLUTION_OFFSET = { x: 16, y: 12 }; // Mask offset relative to Encrypted Image for solution

// Layout constants
let ENCRYPTED_IMG_POS = { x: 0, y: 0 };
let INITIAL_MASK_POS = { x: 0, y: 0 };
let CANVAS_WIDTH = 0;
let CANVAS_HEIGHT = 0;

// Perlin Noise constants
const PERLIN_SCALE = 0.1; // Adjust for different noise granularity
const PERLIN_SEED_OFFSET = 1000; // Offset seed for Perlin noise

// LCG PRNG state
let lcg_seed = SEED;

// LCG PRNG function
function seededRandom() {
    const a = 1664525;
    const c = 1013904223;
    const m = 2**32;
    lcg_seed = (a * lcg_seed + c) % m;
    return lcg_seed / m;
}

// Reset seed function
function resetSeed(offset = 0) {
    lcg_seed = SEED + offset;
}

// Generate random color
function getRandomColor() {
    const r = Math.floor(seededRandom() * 256);
    const g = Math.floor(seededRandom() * 256);
    const b = Math.floor(seededRandom() * 256);
    return `rgb(${r},${g},${b})`;
}

// --- Perlin Noise Implementation (Simple 2D) ---
// Based on example by Ken Perlin, adapted for seeding
const perlin_p = []; // Permutation table
function initPerlinNoise(seedOffset) {
    resetSeed(seedOffset); // Use our PRNG to seed the permutation table
    const p_source = Array.from({length: 256}, (_, i) => i);
    for (let i = p_source.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom() * (i + 1));
        [p_source[i], p_source[j]] = [p_source[j], p_source[i]]; // Shuffle
    }
    // Duplicate the array to avoid overflow checks
    for (let i = 0; i < 256; i++) perlin_p[i] = perlin_p[i + 256] = p_source[i];
}
function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(t, a, b) { return a + t * (b - a); }
function grad(hash, x, y) {
    const h = hash & 7; // Use bottom 3 bits (0-7)
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}
function perlin2D(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x);
    const v = fade(y);
    const p = perlin_p;
    const A = p[X] + Y, AA = p[A], AB = p[A + 1];
    const B = p[X + 1] + Y, BA = p[B], BB = p[B + 1];

    const res = lerp(v, lerp(u, grad(p[AA], x, y), grad(p[BA], x - 1, y)),
                      lerp(u, grad(p[AB], x, y - 1), grad(p[BB], x - 1, y - 1)));
    return (res + 1.0) / 2.0; // Map result to 0.0 - 1.0
}

// Create pixel grid for mask
function createRandomMaskGrid(size) {
    resetSeed();
    const grid = [];
    for (let y = 0; y < size; y++) {
        grid[y] = [];
        for (let x = 0; x < size; x++) {
            grid[y][x] = getRandomColor();
        }
    }
    return grid;
}

function createCoherentMaskGrid(size) {
    initPerlinNoise(PERLIN_SEED_OFFSET); // Initialize Perlin noise with offset seed
    const grid = [];
    for (let y = 0; y < size; y++) {
        grid[y] = [];
        for (let x = 0; x < size; x++) {
            // Get noise value (0-1) for each color channel separately for more variation
            const noiseR = perlin2D(x * PERLIN_SCALE, y * PERLIN_SCALE);
            const noiseG = perlin2D((x + 100) * PERLIN_SCALE, y * PERLIN_SCALE); // Offset inputs slightly
            const noiseB = perlin2D(x * PERLIN_SCALE, (y + 200) * PERLIN_SCALE);
            
            const r = Math.floor(noiseR * 256);
            const g = Math.floor(noiseG * 256);
            const b = Math.floor(noiseB * 256);
            grid[y][x] = `rgb(${r},${g},${b})`;
        }
    }
    return grid;
}

// Wrapper function to select mask type
function createMaskGrid(size, type = 'coherent') {
    if (type === 'random') {
        return createRandomMaskGrid(size);
    } else { // Default to coherent
        return createCoherentMaskGrid(size);
    }
}

// Load and process image
async function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            canvas.width = IMAGE_SIZE;
            canvas.height = IMAGE_SIZE;
            ctx.drawImage(img, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
            try {
                const imageData = ctx.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE);
                const grid = [];
                for (let y = 0; y < IMAGE_SIZE; y++) {
                    grid[y] = [];
                    for (let x = 0; x < IMAGE_SIZE; x++) {
                        const i = (y * IMAGE_SIZE + x) * 4;
                        grid[y][x] = `rgba(${imageData.data[i]},${imageData.data[i + 1]},${imageData.data[i + 2]},${imageData.data[i + 3]})`;
                    }
                }
                resolve(grid);
            } catch (e) {
                reject(e);
            }
        };
        img.onerror = (err) => reject(new Error(`Failed to load image: ${src}. Error: ${err}`));
        img.src = src;
    });
}

// Draw grid to canvas (now used for the single displayCanvas)
function drawGrid(canvas, grid, pixelSize) {
    if (!canvas || !grid || grid.length === 0 || !grid[0] || grid[0].length === 0) {
        console.error("Attempted to draw an empty or invalid grid, or canvas is missing.");
        return;
    }
    const ctx = canvas.getContext('2d');
    const gridHeight = grid.length;
    const gridWidth = grid[0].length;

    // Set canvas dimensions based on the grid being drawn
    canvas.width = gridWidth * pixelSize;
    canvas.height = gridHeight * pixelSize;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            if (grid[y] && grid[y][x]) {
                ctx.fillStyle = grid[y][x];
                ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
            } else {
                console.warn(`Missing or invalid grid cell at (${x}, ${y})`);
            }
        }
    }
}

// Combine colors using XOR
function combineColors(color1, color2) {
    const c1 = color1.match(/(\d+),?\s*(\d+),?\s*(\d+)/);
    const c2 = color2.match(/(\d+),?\s*(\d+),?\s*(\d+)/);
    if (!c1 || !c2) { return 'rgb(255, 0, 255)'; }
    const r1 = parseInt(c1[1], 10);
    const g1 = parseInt(c1[2], 10);
    const b1 = parseInt(c1[3], 10);
    const r2 = parseInt(c2[1], 10);
    const g2 = parseInt(c2[2], 10);
    const b2 = parseInt(c2[3], 10);
    return `rgb(${r1 ^ r2},${g1 ^ g2},${b1 ^ b2})`;
}

// Create the encrypted grid (remains the same)
function createEncryptedGrid(originalGrid, maskGrid, solutionOffset) {
    const encrypted = [];
    for (let y = 0; y < IMAGE_SIZE; y++) {
        encrypted[y] = [];
        for (let x = 0; x < IMAGE_SIZE; x++) {
            const maskX = x + solutionOffset.x;
            const maskY = y + solutionOffset.y;
            if (maskX >= 0 && maskX < MASK_SIZE && maskY >= 0 && maskY < MASK_SIZE) {
                encrypted[y][x] = combineColors(originalGrid[y][x], maskGrid[maskY][maskX]);
            } else {
                console.warn(`Mask coordinates out of bounds during initial encryption: (${maskX}, ${maskY}) for image pixel (${x}, ${y})`);
                encrypted[y][x] = originalGrid[y][x]; // Should not happen with valid offset
            }
        }
    }
    return encrypted;
}

// Calculate distance (remains the same)
function calculateDistance(offset) {
    return Math.sqrt(
        Math.pow(offset.x - SOLUTION_OFFSET.x, 2) +
        Math.pow(offset.y - SOLUTION_OFFSET.y, 2)
    );
}

// Generate hint (remains the same)
function generateHint(offset) {
    const distance = calculateDistance(offset);
    if (Math.abs(offset.x - SOLUTION_OFFSET.x) < 1 && Math.abs(offset.y - SOLUTION_OFFSET.y) < 1) {
        return "Perfekt! Du hast das Bild entschlüsselt!";
    }
    let hint = "Tipp: ";
    if (offset.x < SOLUTION_OFFSET.x) hint += "bewege die Maske nach rechts ";
    else if (offset.x > SOLUTION_OFFSET.x) hint += "bewege die Maske nach links ";
    if (offset.y < SOLUTION_OFFSET.y) hint += (offset.x !== SOLUTION_OFFSET.x ? "und " : "") + "nach unten";
    else if (offset.y > SOLUTION_OFFSET.y) hint += (offset.x !== SOLUTION_OFFSET.x ? "und " : "") + "nach oben";
    if (distance < 5) hint += " (Sehr nah!) ";
    else if (distance < 10) hint += " (Nah!) ";
    return hint.trim();
}

// Helper function to snap coordinates to the grid
function snapToGrid(coordinate) {
    return Math.round(coordinate / PIXEL_SIZE) * PIXEL_SIZE;
}

// --- Global state ---
let originalImageGrid = null;
let encryptedGrid = null; // Stored but not directly displayed initially
let maskGrid = null;
let displayCanvas = null; // The single canvas for display
let hintElement = null;
let maskTypeSelect = null; // Add reference to select element
let currentMaskPosPixels = { x: 0, y: 0 }; // Initialize to zero, calculated in init

// --- Initialization ---
async function init() {
    displayCanvas = document.getElementById('displayCanvas');
    hintElement = document.getElementById('hint');
    maskTypeSelect = document.getElementById('maskType'); // Get select element
    const resetButton = document.getElementById('resetButton');
    const demoContainer = document.querySelector('.demo-container'); // Get container element

    if (!displayCanvas || !hintElement || !resetButton || !maskTypeSelect || !demoContainer) {
        console.error("Initialization failed: Missing required HTML elements.");
        hintElement.textContent = "Fehler: Wichtige Seitenelemente fehlen.";
        return;
    }

    // Set Canvas Size to fill container
    CANVAS_WIDTH = demoContainer.clientWidth;
    CANVAS_HEIGHT = demoContainer.clientHeight;
    displayCanvas.width = CANVAS_WIDTH;
    displayCanvas.height = CANVAS_HEIGHT;

    // Calculate and Snap initial positions based on new canvas size
    // (Calculations moved to regenerateGridsAndRedraw for consistency)

    try {
        console.log('Loading image...');
        originalImageGrid = await loadImage('cat.png');
        console.log('Image loaded.');

        await regenerateGridsAndRedraw(); // Initial setup which now calculates and snaps positions

        setupEventListeners();
        hintElement.textContent = generateHint(currentMaskPosPixels); // Initial hint

    } catch (error) {
        console.error('Error during initialization:', error);
        if (error.message && error.message.includes('Tainted Canvas')) {
            hintElement.innerHTML = "Fehler: Canvas ist 'tainted'. <br>Bitte führe die Seite über einen lokalen Webserver aus (z.B. `python -m http.server`) und lade sie über `http://localhost:8000`.";
        } else if (error.message && error.message.includes('Failed to load image')) {
            hintElement.textContent = `Fehler beim Laden des Bildes 'cat.png'. Ist die Datei im richtigen Verzeichnis? Details: ${error.message}`;
        } else {
            hintElement.textContent = "Fehler bei der Initialisierung. Überprüfe die Konsole (F12) für Details.";
        }
    }
}

// --- Grid Regeneration and Redrawing --- 
async function regenerateGridsAndRedraw() {
    const selectedMaskType = maskTypeSelect.value;
    console.log(`Regenerating grids with type: ${selectedMaskType}`);

    console.log('Creating mask grid...');
    maskGrid = createMaskGrid(MASK_SIZE, selectedMaskType);
    console.log('Mask grid created.');

    console.log('Creating encrypted grid (in memory)...');
    encryptedGrid = createEncryptedGrid(originalImageGrid, maskGrid, SOLUTION_OFFSET);
    console.log('Encrypted grid created.');

    // Recalculate and SNAP positions
    let rawEncX = Math.floor(CANVAS_WIDTH / 4 - (IMAGE_SIZE * PIXEL_SIZE) / 2);
    let rawEncY = Math.floor(CANVAS_HEIGHT / 2 - (IMAGE_SIZE * PIXEL_SIZE) / 2);
    ENCRYPTED_IMG_POS = {
        x: snapToGrid(Math.max(0, rawEncX)),
        y: snapToGrid(Math.max(0, rawEncY))
    };

    let rawMaskX = Math.floor(3 * CANVAS_WIDTH / 4 - (MASK_SIZE * PIXEL_SIZE) / 2);
    let rawMaskY = Math.floor(CANVAS_HEIGHT / 2 - (MASK_SIZE * PIXEL_SIZE) / 2);
    INITIAL_MASK_POS = {
        x: snapToGrid(Math.max(0, rawMaskX)),
        y: snapToGrid(Math.max(0, rawMaskY))
    };
    currentMaskPosPixels = { ...INITIAL_MASK_POS }; // Reset position to snapped initial

    // Ensure canvas size is set
    displayCanvas.width = CANVAS_WIDTH;
    displayCanvas.height = CANVAS_HEIGHT;

    console.log('Drawing state...');
    redrawDisplayCanvas(currentMaskPosPixels);
    console.log('State drawn.');
    hintElement.textContent = generateHint(currentMaskPosPixels); // Update hint
}

// --- Drawing Logic ---
function redrawDisplayCanvas(maskTopLeftPixels) {
    if (!displayCanvas || !maskGrid || !encryptedGrid) return;
    const ctx = displayCanvas.getContext('2d');

    // 1. Clear Canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 2. Draw Encrypted Image Base
    for (let ey = 0; ey < IMAGE_SIZE; ey++) {
        for (let ex = 0; ex < IMAGE_SIZE; ex++) {
            ctx.fillStyle = encryptedGrid[ey][ex];
            ctx.fillRect(
                ENCRYPTED_IMG_POS.x + ex * PIXEL_SIZE,
                ENCRYPTED_IMG_POS.y + ey * PIXEL_SIZE,
                PIXEL_SIZE, PIXEL_SIZE
            );
        }
    }

    // 3. Draw Mask (potentially XORing where it overlaps)
    for (let my = 0; my < MASK_SIZE; my++) {
        for (let mx = 0; mx < MASK_SIZE; mx++) {
            // Position of this mask pixel on the canvas
            const maskPixelX = maskTopLeftPixels.x + mx * PIXEL_SIZE;
            const maskPixelY = maskTopLeftPixels.y + my * PIXEL_SIZE;

            // --- Optimization: Only draw if pixel is within canvas bounds --- 
            if (maskPixelX + PIXEL_SIZE < 0 || maskPixelX > CANVAS_WIDTH || 
                maskPixelY + PIXEL_SIZE < 0 || maskPixelY > CANVAS_HEIGHT) {
                continue; // Skip drawing if entire pixel is off-canvas
            }
            // --- End Optimization ---

            const relEncX = maskPixelX - ENCRYPTED_IMG_POS.x;
            const relEncY = maskPixelY - ENCRYPTED_IMG_POS.y;
            const encGridX = Math.floor(relEncX / PIXEL_SIZE);
            const encGridY = Math.floor(relEncY / PIXEL_SIZE);

            let displayColor;
            if (encGridX >= 0 && encGridX < IMAGE_SIZE && encGridY >= 0 && encGridY < IMAGE_SIZE) {
                const encryptedColor = encryptedGrid[encGridY][encGridX];
                const maskColor = maskGrid[my][mx];
                displayColor = combineColors(encryptedColor, maskColor);
            } else {
                displayColor = maskGrid[my][mx];
            }
            ctx.fillStyle = displayColor;
            ctx.fillRect(maskPixelX, maskPixelY, PIXEL_SIZE, PIXEL_SIZE);
        }
    }
}

// --- Hint Generation ---
function generateHint(currentMaskPosPixels) {
    // Target position uses snapped ENCRYPTED_IMG_POS and user SOLUTION_OFFSET
    const SOLUTION_POS_PIXELS = {
        x: snapToGrid(ENCRYPTED_IMG_POS.x - SOLUTION_OFFSET.x * PIXEL_SIZE),
        y: snapToGrid(ENCRYPTED_IMG_POS.y - SOLUTION_OFFSET.y * PIXEL_SIZE)
    };
    const diffX_pixels = SOLUTION_POS_PIXELS.x - currentMaskPosPixels.x;
    const diffY_pixels = SOLUTION_POS_PIXELS.y - currentMaskPosPixels.y;
    const distance_pixels = Math.sqrt(diffX_pixels**2 + diffY_pixels**2);
    if (distance_pixels < PIXEL_SIZE * 0.7) { return "Perfekt! 👍"; }
    let arrow = "";
    const threshold = PIXEL_SIZE * 0.5;
    let needsRight = diffX_pixels > threshold;
    let needsLeft = diffX_pixels < -threshold;
    let needsDown = diffY_pixels > threshold;
    let needsUp = diffY_pixels < -threshold;
    if (needsUp && needsLeft) arrow = "↖";
    else if (needsUp && needsRight) arrow = "↗";
    else if (needsDown && needsLeft) arrow = "↙";
    else if (needsDown && needsRight) arrow = "↘";
    else if (needsUp) arrow = "↑";
    else if (needsDown) arrow = "↓";
    else if (needsLeft) arrow = "←";
    else if (needsRight) arrow = "→";
    else arrow = "?";
    let proximity = "";
    const distance_grid = distance_pixels / PIXEL_SIZE;
    if (distance_grid < 5) proximity = " (Sehr nah!)";
    else if (distance_grid < 15) proximity = " (Nah)";
    else if (distance_grid < 30) proximity = "";
    else proximity = " (Weit weg)";
    return `Tipp: ${arrow}${proximity}`;
}

// --- Event Listeners ---
function setupEventListeners() {
    let isDragging = false;
    let dragStartX, dragStartY;
    let maskStartPosPixels;

    displayCanvas.addEventListener('mousedown', (e) => {
        // Check if the click is on the mask area (approximate)
        const rect = displayCanvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        if (clickX >= currentMaskPosPixels.x && clickX < currentMaskPosPixels.x + MASK_SIZE * PIXEL_SIZE &&
            clickY >= currentMaskPosPixels.y && clickY < currentMaskPosPixels.y + MASK_SIZE * PIXEL_SIZE)
        {
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            maskStartPosPixels = { ...currentMaskPosPixels };
            displayCanvas.style.cursor = 'grabbing';
            e.preventDefault();
        } else {
             isDragging = false; // Don't start drag if clicking outside mask
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const mouseDx = e.clientX - dragStartX;
        const mouseDy = e.clientY - dragStartY;
        let targetMaskX = maskStartPosPixels.x + mouseDx;
        let targetMaskY = maskStartPosPixels.y + mouseDy;
        
        // Snap the current dragged position
        currentMaskPosPixels.x = snapToGrid(targetMaskX);
        currentMaskPosPixels.y = snapToGrid(targetMaskY);

        redrawDisplayCanvas(currentMaskPosPixels);
        hintElement.textContent = generateHint(currentMaskPosPixels);
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            displayCanvas.style.cursor = 'move';
        }
    });

    document.addEventListener('mouseleave', () => {
        if (isDragging) {
            isDragging = false;
            displayCanvas.style.cursor = 'move';
        }
    });

    maskTypeSelect.addEventListener('change', () => {
        regenerateGridsAndRedraw();
    });

    const resetButton = document.getElementById('resetButton');
    resetButton.addEventListener('click', () => {
        regenerateGridsAndRedraw();
    });
}

// Start the demo when the page loads
window.addEventListener('load', init); 