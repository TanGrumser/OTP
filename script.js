// Constants
const SEED = 12345; // Changed seed for potentially better results
const PIXEL_SIZE = 6; // Size of each pixel in the grid
const IMAGE_SIZE = 64; // Size of the image in pixels (adjust if cat.png is different)
const MASK_SIZE = 96; // Size of the mask in pixels (larger than image)
const SOLUTION_OFFSET = { x: 16, y: 16 }; // Correct position offset for the mask (in grid units)

// Layout constants
const PADDING = 10; // Canvas padding
const SPACING = 20; // Space between initial image and mask
const ENCRYPTED_IMG_POS = { x: PADDING, y: PADDING }; // Top-left pixel pos of encrypted image
const INITIAL_MASK_POS = { // Top-left pixel pos of mask initially
    x: ENCRYPTED_IMG_POS.x + IMAGE_SIZE * PIXEL_SIZE + SPACING,
    y: PADDING
};

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
function resetSeed() {
    lcg_seed = SEED;
}

// Generate random color
function getRandomColor() {
    const r = Math.floor(seededRandom() * 256);
    const g = Math.floor(seededRandom() * 256);
    const b = Math.floor(seededRandom() * 256);
    return `rgb(${r},${g},${b})`;
}

// Create pixel grid for mask
function createMaskGrid(size) {
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
                console.warn(`Mask coordinates out of bounds during initial encryption: (${maskX}, ${maskY})`);
                encrypted[y][x] = originalGrid[y][x];
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

// --- Global state ---
let originalImageGrid = null;
let encryptedGrid = null; // Stored but not directly displayed initially
let maskGrid = null;
let displayCanvas = null; // The single canvas for display
let hintElement = null;
let currentMaskPosPixels = { ...INITIAL_MASK_POS }; // Mask's top-left corner in pixels

// --- Initialization ---
async function init() {
    displayCanvas = document.getElementById('displayCanvas');
    hintElement = document.getElementById('hint');
    const resetButton = document.getElementById('resetButton');

    if (!displayCanvas || !hintElement || !resetButton) {
        console.error("Initialization failed: Missing required HTML elements.");
        hintElement.textContent = "Fehler: Wichtige Seitenelemente fehlen.";
        return;
    }

    try {
        console.log('Loading image...');
        originalImageGrid = await loadImage('cat.png');
        console.log('Image loaded.');

        console.log('Creating mask grid...');
        maskGrid = createMaskGrid(MASK_SIZE);
        console.log('Mask grid created.');

        console.log('Creating encrypted grid (in memory)...');
        encryptedGrid = createEncryptedGrid(originalImageGrid, maskGrid, SOLUTION_OFFSET);
        console.log('Encrypted grid created.');

        // Set initial canvas size
        displayCanvas.width = INITIAL_MASK_POS.x + MASK_SIZE * PIXEL_SIZE + PADDING;
        displayCanvas.height = PADDING + Math.max(IMAGE_SIZE, MASK_SIZE) * PIXEL_SIZE + PADDING;

        console.log('Drawing initial state...');
        currentMaskPosPixels = { ...INITIAL_MASK_POS }; // Reset position
        redrawDisplayCanvas(currentMaskPosPixels);
        console.log('Initial state drawn.');

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

// --- Drawing Logic ---
function redrawDisplayCanvas(maskTopLeftPixels) {
    if (!displayCanvas || !maskGrid || !encryptedGrid) return;
    const ctx = displayCanvas.getContext('2d');

    // 1. Clear Canvas
    ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);

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
    for (let my = 0; my < MASK_SIZE; my++) { // Mask grid Y
        for (let mx = 0; mx < MASK_SIZE; mx++) { // Mask grid X
            // Absolute pixel coords of the top-left of this mask pixel on the canvas
            const maskPixelX = maskTopLeftPixels.x + mx * PIXEL_SIZE;
            const maskPixelY = maskTopLeftPixels.y + my * PIXEL_SIZE;

            // Coords relative to encrypted image's top-left origin
            const relEncX = maskPixelX - ENCRYPTED_IMG_POS.x;
            const relEncY = maskPixelY - ENCRYPTED_IMG_POS.y;

            // Grid coords within encrypted image (if they fall inside)
            const encGridX = Math.floor(relEncX / PIXEL_SIZE);
            const encGridY = Math.floor(relEncY / PIXEL_SIZE);

            let displayColor;
            // Check if this mask pixel overlaps the encrypted image area
            if (encGridX >= 0 && encGridX < IMAGE_SIZE && encGridY >= 0 && encGridY < IMAGE_SIZE) {
                // Overlap: Calculate XORed color
                const encryptedColor = encryptedGrid[encGridY][encGridX];
                const maskColor = maskGrid[my][mx];
                displayColor = combineColors(encryptedColor, maskColor);
            } else {
                // No Overlap: Use the plain mask color
                displayColor = maskGrid[my][mx];
            }

            // Draw the resulting pixel for this part of the mask
            ctx.fillStyle = displayColor;
            ctx.fillRect(maskPixelX, maskPixelY, PIXEL_SIZE, PIXEL_SIZE);
        }
    }
}

// --- Hint Generation ---
function generateHint(currentMaskPosPixels) {
    // Target position for the mask's top-left corner for perfect decryption
    const SOLUTION_POS_PIXELS = {
        x: ENCRYPTED_IMG_POS.x - SOLUTION_OFFSET.x * PIXEL_SIZE,
        y: ENCRYPTED_IMG_POS.y - SOLUTION_OFFSET.y * PIXEL_SIZE
    };

    const diffX_pixels = SOLUTION_POS_PIXELS.x - currentMaskPosPixels.x;
    const diffY_pixels = SOLUTION_POS_PIXELS.y - currentMaskPosPixels.y;

    const distance_pixels = Math.sqrt(diffX_pixels**2 + diffY_pixels**2);

    // Check if solved (within ~half a pixel size distance)
    if (distance_pixels < PIXEL_SIZE * 0.7) { // Adjusted threshold slightly
        return "Perfekt! 👍";
    }

    // Determine arrow direction
    let arrow = "";
    const threshold = PIXEL_SIZE * 0.5; // Threshold distance to trigger arrow component
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
    else arrow = "?"; // Should indicate very close if not solved

    // Proximity text
    let proximity = "";
    const distance_grid = distance_pixels / PIXEL_SIZE;
    if (distance_grid < 5) proximity = " (Sehr nah!)";
    else if (distance_grid < 15) proximity = " (Nah)";
    else if (distance_grid < 30) proximity = ""; // Further away, just arrow
    else proximity = " (Weit weg)";

    return `Tipp: ${arrow}${proximity}`;
}

// --- Event Listeners ---
function setupEventListeners() {
    let isDragging = false;
    let dragStartX, dragStartY; // Mouse position when drag started (client coords)
    let maskStartPosPixels; // Mask position when drag started

    displayCanvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        maskStartPosPixels = { ...currentMaskPosPixels }; // Store position at drag start
        displayCanvas.style.cursor = 'grabbing';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const mouseDx = e.clientX - dragStartX;
        const mouseDy = e.clientY - dragStartY;

        // Calculate new target mask position
        let targetMaskX = maskStartPosPixels.x + mouseDx;
        let targetMaskY = maskStartPosPixels.y + mouseDy;

        // Snap the target position to the grid
        currentMaskPosPixels.x = Math.round(targetMaskX / PIXEL_SIZE) * PIXEL_SIZE;
        currentMaskPosPixels.y = Math.round(targetMaskY / PIXEL_SIZE) * PIXEL_SIZE;

        // Redraw the canvas with the new mask position
        redrawDisplayCanvas(currentMaskPosPixels);

        // Update hint
        hintElement.textContent = generateHint(currentMaskPosPixels);
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            displayCanvas.style.cursor = 'move';
            // Final position is already snapped and drawn in mousemove
        }
    });

    document.addEventListener('mouseleave', () => {
        if (isDragging) {
            isDragging = false;
            displayCanvas.style.cursor = 'move';
            // Leave mask where it was when mouse left
        }
    });

    const resetButton = document.getElementById('resetButton');
    resetButton.addEventListener('click', () => {
        currentMaskPosPixels = { ...INITIAL_MASK_POS }; // Reset position
        redrawDisplayCanvas(currentMaskPosPixels);    // Redraw initial state
        hintElement.textContent = generateHint(currentMaskPosPixels); // Reset hint
    });
}

// Start the demo when the page loads
window.addEventListener('load', init); 