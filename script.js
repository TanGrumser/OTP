// Constants
const SEED = 12345; // Changed seed for potentially better results
const PIXEL_SIZE = 6; // Size of each pixel in the grid
const IMAGE_SIZE = 64; // Size of the image in pixels (adjust if cat.png is different)
const MASK_SIZE = 96; // Size of the mask in pixels (larger than image)
const SOLUTION_OFFSET = { x: 16, y: 16 }; // Correct position offset for the mask (in grid units)

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
let currentMaskOffsetGrid = { x: 0, y: 0 }; // Keep track of mask offset in GRID units

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

        console.log('Creating encrypted grid...');
        // Encrypted grid is calculated but stored in memory, not drawn initially
        encryptedGrid = createEncryptedGrid(originalImageGrid, maskGrid, SOLUTION_OFFSET);
        console.log('Encrypted grid created (in memory).');

        console.log('Drawing initial mask view...');
        // Initially, the display canvas shows only the mask
        drawGrid(displayCanvas, maskGrid, PIXEL_SIZE);
        console.log('Initial mask view drawn.');

        setupEventListeners();
        hintElement.textContent = "Tipp: Bewege die Maske, um das verschlüsselte Bild zu entschlüsseln";

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

// --- Function to update the single display canvas ---
function updateDisplayCanvas(offsetGrid) {
    if (!displayCanvas || !maskGrid || !encryptedGrid) return;

    const newViewGrid = []; // Create the grid representing the current view
    const ctx = displayCanvas.getContext('2d');

    // Ensure canvas dimensions match the mask size
    displayCanvas.width = MASK_SIZE * PIXEL_SIZE;
    displayCanvas.height = MASK_SIZE * PIXEL_SIZE;
    ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);

    for (let y = 0; y < MASK_SIZE; y++) {
        newViewGrid[y] = [];
        for (let x = 0; x < MASK_SIZE; x++) {
            // Calculate potential coordinates in the encrypted image grid
            const encX = x - offsetGrid.x;
            const encY = y - offsetGrid.y;

            // Check if these coordinates fall within the encrypted image bounds
            if (encX >= 0 && encX < IMAGE_SIZE && encY >= 0 && encY < IMAGE_SIZE) {
                // Overlap: Calculate decrypted color using XOR
                const encryptedColor = encryptedGrid[encY][encX];
                const maskColor = maskGrid[y][x];
                newViewGrid[y][x] = combineColors(encryptedColor, maskColor);
            } else {
                // No overlap: Just show the mask pixel
                newViewGrid[y][x] = maskGrid[y][x];
            }
            // Draw the calculated pixel immediately (alternative to drawing the whole grid at the end)
            ctx.fillStyle = newViewGrid[y][x];
            ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
        }
    }
    // If drawing pixel by pixel above, this call is redundant:
    // drawGrid(displayCanvas, newViewGrid, PIXEL_SIZE);
}

// --- Event Listeners ---
function setupEventListeners() {
    let isDragging = false;
    let lastPixelX, lastPixelY; // Store the last pixel coordinates of the mouse

    displayCanvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        // Get mouse position relative to the canvas
        const rect = displayCanvas.getBoundingClientRect();
        lastPixelX = e.clientX - rect.left;
        lastPixelY = e.clientY - rect.top;
        displayCanvas.style.cursor = 'grabbing';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const rect = displayCanvas.getBoundingClientRect();
        const currentPixelX = e.clientX - rect.left;
        const currentPixelY = e.clientY - rect.top;

        // Calculate change in pixels
        const dx = currentPixelX - lastPixelX;
        const dy = currentPixelY - lastPixelY;

        // Update last position
        lastPixelX = currentPixelX;
        lastPixelY = currentPixelY;

        // Update the grid offset based on pixel change
        // Note: We don't move the canvas element itself anymore
        currentMaskOffsetGrid.x += dx / PIXEL_SIZE;
        currentMaskOffsetGrid.y += dy / PIXEL_SIZE;

        // Snap the grid offset
        let snappedGridX = Math.round(currentMaskOffsetGrid.x);
        let snappedGridY = Math.round(currentMaskOffsetGrid.y);

        // Update the display canvas based on the snapped grid offset
        updateDisplayCanvas({ x: snappedGridX, y: snappedGridY });

        // Update hint based on the snapped grid offset
        hintElement.textContent = generateHint({ x: snappedGridX, y: snappedGridY });
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            displayCanvas.style.cursor = 'move';
            // Final snap of the logical offset
            currentMaskOffsetGrid.x = Math.round(currentMaskOffsetGrid.x);
            currentMaskOffsetGrid.y = Math.round(currentMaskOffsetGrid.y);
            // Redraw with final snapped position (optional, mousemove already did)
             updateDisplayCanvas(currentMaskOffsetGrid);
        }
    });

    document.addEventListener('mouseleave', () => {
        if (isDragging) {
            isDragging = false;
            displayCanvas.style.cursor = 'move';
            // Optional: reset or leave as is when mouse leaves?
            // Let's leave it as is for now.
        }
    });

    const resetButton = document.getElementById('resetButton');
    resetButton.addEventListener('click', () => {
        currentMaskOffsetGrid = { x: 0, y: 0 };
        // Redraw the initial state (just the mask)
        drawGrid(displayCanvas, maskGrid, PIXEL_SIZE);
        hintElement.textContent = "Tipp: Bewege die Maske, um das verschlüsselte Bild zu entschlüsseln";
    });
}

// Start the demo when the page loads
window.addEventListener('load', init); 