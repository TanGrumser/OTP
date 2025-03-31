// Constants
const SEED = 12345; // Changed seed for potentially better results
const PIXEL_SIZE = 8; // Size of each pixel in the grid
const IMAGE_SIZE = 32; // Size of the image in pixels (adjust if cat.png is different)
const MASK_SIZE = 48; // Size of the mask in pixels (larger than image)
const SOLUTION_OFFSET = { x: 8, y: 8 }; // Correct position offset for the mask (in grid units)

// LCG Pseudo-Random Number Generator state
let lcg_seed = SEED;

// LCG PRNG function
function seededRandom() {
    // Parameters from Numerical Recipes
    const a = 1664525;
    const c = 1013904223;
    const m = 2**32;
    lcg_seed = (a * lcg_seed + c) % m;
    return lcg_seed / m;
}

// Reset seed function (used for mask generation)
function resetSeed() {
    lcg_seed = SEED;
}

// Generate random color for mask
function getRandomColor() {
    const r = Math.floor(seededRandom() * 256);
    const g = Math.floor(seededRandom() * 256);
    const b = Math.floor(seededRandom() * 256);
    return `rgb(${r},${g},${b})`;
}

// Create pixel grid for mask
function createMaskGrid(size) {
    resetSeed(); // Ensure mask is always the same for a given SEED
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
            const ctx = canvas.getContext('2d', { willReadFrequently: true }); // Optimization hint

            // Resize image to match our grid size
            canvas.width = IMAGE_SIZE;
            canvas.height = IMAGE_SIZE;

            // Draw and scale image
            ctx.drawImage(img, 0, 0, IMAGE_SIZE, IMAGE_SIZE);

            // Get pixel data
            try {
                const imageData = ctx.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE);
                const grid = [];

                // Convert to our grid format
                for (let y = 0; y < IMAGE_SIZE; y++) {
                    grid[y] = [];
                    for (let x = 0; x < IMAGE_SIZE; x++) {
                        const i = (y * IMAGE_SIZE + x) * 4;
                        // Store alpha too, just in case, though we ignore it later
                        grid[y][x] = `rgba(${imageData.data[i]},${imageData.data[i + 1]},${imageData.data[i + 2]},${imageData.data[i + 3]})`;
                    }
                }
                resolve(grid);
            } catch (e) {
                reject(e); // Propagate error (e.g., Tainted Canvas)
            }
        };
        img.onerror = (err) => reject(new Error(`Failed to load image: ${src}. Error: ${err}`));
        img.src = src;
    });
}

// Draw grid to canvas
function drawGrid(canvas, grid, pixelSize) {
    if (!canvas || !grid || grid.length === 0 || !grid[0] || grid[0].length === 0) {
        console.error("Attempted to draw an empty or invalid grid, or canvas is missing.");
        return;
    }
    const ctx = canvas.getContext('2d');
    const gridHeight = grid.length;
    const gridWidth = grid[0].length;

    canvas.width = gridWidth * pixelSize;
    canvas.height = gridHeight * pixelSize;

    // Clear previous content
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            if (grid[y] && grid[y][x]) { // Add check for valid cell
                ctx.fillStyle = grid[y][x];
                ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
            } else {
                console.warn(`Missing or invalid grid cell at (${x}, ${y})`);
            }
        }
    }
}

// Combine two colors using XOR operation
function combineColors(color1, color2) {
    // Extract RGB values, handling potential rgba format from image load
    const c1 = color1.match(/(\d+),?\s*(\d+),?\s*(\d+)/);
    const c2 = color2.match(/(\d+),?\s*(\d+),?\s*(\d+)/);

    if (!c1 || !c2) {
        // console.warn(`Invalid color format for combining: ${color1}, ${color2}`);
        return 'rgb(255, 0, 255)'; // Return magenta for errors
    }

    const r1 = parseInt(c1[1], 10);
    const g1 = parseInt(c1[2], 10);
    const b1 = parseInt(c1[3], 10);

    const r2 = parseInt(c2[1], 10);
    const g2 = parseInt(c2[2], 10);
    const b2 = parseInt(c2[3], 10);

    // Perform XOR on each channel
    return `rgb(${r1 ^ r2},${g1 ^ g2},${b1 ^ b2})`;
}

// Create the encrypted version of the image grid
function createEncryptedGrid(originalGrid, maskGrid, solutionOffset) {
    const encrypted = [];
    for (let y = 0; y < IMAGE_SIZE; y++) {
        encrypted[y] = [];
        for (let x = 0; x < IMAGE_SIZE; x++) {
            const maskX = x + solutionOffset.x;
            const maskY = y + solutionOffset.y;

            // Ensure mask coordinates are within mask bounds
            if (maskX >= 0 && maskX < MASK_SIZE && maskY >= 0 && maskY < MASK_SIZE) {
                encrypted[y][x] = combineColors(originalGrid[y][x], maskGrid[maskY][maskX]);
            } else {
                // Should not happen if solutionOffset is valid, but handle defensively
                console.warn(`Mask coordinates out of bounds during initial encryption: (${maskX}, ${maskY})`);
                encrypted[y][x] = originalGrid[y][x]; // Or black: 'rgb(0,0,0)'
            }
        }
    }
    return encrypted;
}


// Calculate distance to solution (in grid units)
function calculateDistance(offset) {
    return Math.sqrt(
        Math.pow(offset.x - SOLUTION_OFFSET.x, 2) +
        Math.pow(offset.y - SOLUTION_OFFSET.y, 2)
    );
}

// Generate hint based on position (in grid units)
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

    // Add proximity hint
    if (distance < 5) hint += " (Sehr nah!) ";
    else if (distance < 10) hint += " (Nah!) ";

    return hint.trim();
}

// --- Global state --- 
let originalImageGrid = null;
let encryptedGrid = null;
let maskGrid = null;
let imageCanvas = null;
let maskCanvas = null;
let hintElement = null;
let currentMaskOffsetPixels = { x: 0, y: 0 }; // Keep track of mask offset

// --- Initialization ---
async function init() {
    imageCanvas = document.getElementById('imageCanvas');
    maskCanvas = document.getElementById('maskCanvas');
    hintElement = document.getElementById('hint');
    const resetButton = document.getElementById('resetButton');

    if (!imageCanvas || !maskCanvas || !hintElement || !resetButton) {
        console.error("Initialization failed: Missing required HTML elements.");
        hintElement.textContent = "Fehler: Wichtige Seitenelemente fehlen.";
        return;
    }

    // *** Make the mask canvas visually transparent ***
    // We only use it for dragging, not for displaying pixels
    maskCanvas.width = MASK_SIZE * PIXEL_SIZE; // Set size for correct drag area
    maskCanvas.height = MASK_SIZE * PIXEL_SIZE;
    const maskCtx = maskCanvas.getContext('2d');
    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height); // Ensure it's clear

    try {
        // 1. Load the original image
        console.log('Loading image...');
        originalImageGrid = await loadImage('cat.png');
        console.log('Image loaded.');

        // 2. Create the mask grid
        console.log('Creating mask grid...');
        maskGrid = createMaskGrid(MASK_SIZE);
        console.log('Mask grid created.');

        // 3. Create the encrypted image
        console.log('Creating encrypted grid...');
        encryptedGrid = createEncryptedGrid(originalImageGrid, maskGrid, SOLUTION_OFFSET);
        console.log('Encrypted grid created.');

        // 4. Draw initial state
        console.log('Drawing initial encrypted grid...');
        drawGrid(imageCanvas, encryptedGrid, PIXEL_SIZE);
        console.log('Initial grid drawn.');

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

// --- Dynamic Decryption View (Draws result on imageCanvas) ---
function updateDecryptionView(currentOffsetGrid) {
    if (!encryptedGrid || !maskGrid || !imageCanvas) return;

    const decryptedViewGrid = [];
    for (let y = 0; y < IMAGE_SIZE; y++) {
        decryptedViewGrid[y] = [];
        for (let x = 0; x < IMAGE_SIZE; x++) {
            const maskX = x + currentOffsetGrid.x;
            const maskY = y + currentOffsetGrid.y;
            if (maskX >= 0 && maskX < MASK_SIZE && maskY >= 0 && maskY < MASK_SIZE) {
                decryptedViewGrid[y][x] = combineColors(encryptedGrid[y][x], maskGrid[maskY][maskX]);
            } else {
                decryptedViewGrid[y][x] = encryptedGrid[y][x]; // Show encrypted if mask doesn't cover
            }
        }
    }
    // *** Redraw the imageCanvas (bottom) with the dynamically decrypted view ***
    drawGrid(imageCanvas, decryptedViewGrid, PIXEL_SIZE);
}

// --- Event Listeners ---
function setupEventListeners() {
    let isDragging = false;
    let startX, startY; // Mouse position when drag started (relative to page)

    maskCanvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        // Record the starting mouse position relative to the *page*,
        // and subtract the *current* offset of the mask element.
        // This allows calculating the new offset correctly in mousemove.
        startX = e.clientX - currentMaskOffsetPixels.x;
        startY = e.clientY - currentMaskOffsetPixels.y;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        // Calculate the desired new raw pixel offset based on mouse movement
        let newRawX = e.clientX - startX;
        let newRawY = e.clientY - startY;

        // Snap the raw pixel offset to the PIXEL_SIZE grid
        currentMaskOffsetPixels.x = Math.round(newRawX / PIXEL_SIZE) * PIXEL_SIZE;
        currentMaskOffsetPixels.y = Math.round(newRawY / PIXEL_SIZE) * PIXEL_SIZE;

        // Update mask *element* position visually (even though it's transparent)
        maskCanvas.style.transform = `translate(calc(-50% + ${currentMaskOffsetPixels.x}px), calc(-50% + ${currentMaskOffsetPixels.y}px))`;

        // Calculate the grid offset for decryption and hints
        const currentOffsetGrid = {
            x: Math.round(currentMaskOffsetPixels.x / PIXEL_SIZE),
            y: Math.round(currentMaskOffsetPixels.y / PIXEL_SIZE)
        };

        // Update the underlying image canvas to show the dynamically decrypted view
        updateDecryptionView(currentOffsetGrid);

        // Update hint
        hintElement.textContent = generateHint(currentOffsetGrid);
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            // Optional: When drag stops, you could leave the last decrypted view,
            // or snap back to showing the fully encrypted image:
            // if(encryptedGrid) drawGrid(imageCanvas, encryptedGrid, PIXEL_SIZE);
        }
    });

    document.addEventListener('mouseleave', () => {
        if (isDragging) {
            isDragging = false;
            // Optional: Snap back when mouse leaves window
            // if(encryptedGrid) drawGrid(imageCanvas, encryptedGrid, PIXEL_SIZE);
        }
    });
    
    const resetButton = document.getElementById('resetButton');
    resetButton.addEventListener('click', () => {
        currentMaskOffsetPixels = { x: 0, y: 0 };
        maskCanvas.style.transform = 'translate(-50%, -50%)';
        if(encryptedGrid) {
             drawGrid(imageCanvas, encryptedGrid, PIXEL_SIZE); // Restore encrypted view
        }
        hintElement.textContent = "Tipp: Bewege die Maske, um das verschlüsselte Bild zu entschlüsseln";
    });
}

// Start the demo when the page loads
window.addEventListener('load', init); 