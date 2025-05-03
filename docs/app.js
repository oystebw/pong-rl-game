// app.js
/**
 * Main application logic for the Pong RL Demo. Player vs AI mode.
 * Handles game loop, user input (keyboard, touch, slider), agent interaction,
 * UI updates, speed slider, keyboard shortcuts.
 * Includes auto-reset after scoring.
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const canvas = document.getElementById('pongCanvas');
    const statusDiv = document.getElementById('status');
    const startButton = document.getElementById('startButton');
    const resetButton = document.getElementById('resetButton');
    const aiScoreSpan = document.getElementById('aiScore');
    const playerScoreSpan = document.getElementById('playerScore');
    const touchUpButton = document.getElementById('touchUpButton');
    const touchDownButton = document.getElementById('touchDownButton');
    const difficultySlider = document.getElementById('difficultySlider');
    const difficultyValueSpan = document.getElementById('difficultyValue');

    // --- Game State ---
    let env = null;
    let agent = null;
    let animationFrameId = null;
    let gameState = 'loading';
    let aiScore = 0;
    let playerScore = 0;
    let lastTimestamp = 0;
    let roundResetTimeoutId = null;
    let gameSpeedMultiplier = 1.0;

    // --- Player Control ---
    let playerPaddleY = 0;
    const keysPressed = {};
    let touchUpActive = false;
    let touchDownActive = false;

    // --- Constants ---
    const BASE_PADDLE_SPEED = 12.0;
    const NORM_HEIGHT = 400 / 2.0;
    const PADDLE_HALF_HEIGHT = 60 / 2.0;
    const SCORE_RESET_DELAY = 1000;

    // ================================================
    // INITIALIZATION
    // ================================================
    async function initialize() {
        if (!canvas || !statusDiv || !startButton || !resetButton || !aiScoreSpan || !playerScoreSpan || !difficultySlider || !difficultyValueSpan) {
            console.error("Initialization failed: One or more required DOM elements not found.");
            setStatus("Error: UI elements missing.");
            return;
        }
        setStatus('Initializing environment...');
        try {
            canvas.width = 600; canvas.height = 400;
            env = new PongEnvJs(canvas);
        } catch (e) {
            setStatus(`Error creating environment: ${e}`); console.error("Env creation failed:", e); return;
        }
        setStatus('Initializing AI agent...');
        agent = new PongAgent(); // Assumes agent.js defines PongAgent
        const modelLoaded = await agent.loadModel();

        if (modelLoaded) {
            setStatus('Ready! Press Start / Resume or Space Bar.'); // Update status
            gameState = 'ready';
            startButton.disabled = false; startButton.textContent = 'Start Game';
            resetButton.disabled = true;
            difficultySlider.disabled = false;
            setupEventListeners();
            gameSpeedMultiplier = parseFloat(difficultySlider.value);
            difficultyValueSpan.textContent = `${gameSpeedMultiplier.toFixed(1)}x`;
            resetGameVisuals();
        } else {
            setStatus('Error loading AI model. Cannot start game.');
            startButton.disabled = true; resetButton.disabled = true;
            difficultySlider.disabled = true;
        }
    }

    // ================================================
    // EVENT LISTENERS
    // ================================================
    function setupEventListeners() {
        startButton.addEventListener('click', togglePauseResume);
        resetButton.addEventListener('click', resetGame);

        difficultySlider.addEventListener('input', (event) => {
            if (difficultyValueSpan) {
                gameSpeedMultiplier = parseFloat(event.target.value);
                difficultyValueSpan.textContent = `${gameSpeedMultiplier.toFixed(1)}x`;
            }
        });

        // --- Keyboard Controls ---
        document.addEventListener('keydown', (event) => {
            const key = event.key.toLowerCase();
            const code = event.code; // Use code for Space bar

            // Paddle Movement Keys
            if (key === 'w' || key === 's') {
                keysPressed[key] = true;
                event.preventDefault(); // Prevent page scrolling
            }

            // --- Game Control Keys ---
            // Space Bar: Toggle Start/Pause/Resume
            if (code === 'Space') {
                event.preventDefault(); // Prevent default space bar action (scrolling/button press)
                // Only allow toggle if not loading and not in the middle of score reset delay
                if (gameState !== 'loading' && gameState !== 'scored') {
                     togglePauseResume();
                }
            }
            // 'R' Key: Reset Game
            else if (key === 'r') {
                 // Only allow reset if game is not in initial loading state
                 if (gameState !== 'loading') {
                     resetGame();
                 }
            }
        });

        document.addEventListener('keyup', (event) => {
            const key = event.key.toLowerCase();
            if (key === 'w' || key === 's') {
                keysPressed[key] = false;
            }
        });

        // --- Touch Controls ---
        touchUpButton.addEventListener('touchstart', (e) => { e.preventDefault(); touchUpActive = true; });
        touchUpButton.addEventListener('touchend', (e) => { e.preventDefault(); touchUpActive = false; });
        touchUpButton.addEventListener('contextmenu', (e) => e.preventDefault());

        touchDownButton.addEventListener('touchstart', (e) => { e.preventDefault(); touchDownActive = true; });
        touchDownButton.addEventListener('touchend', (e) => { e.preventDefault(); touchDownActive = false; });
        touchDownButton.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // ================================================
    // GAME CONTROL FUNCTIONS
    // ================================================
    function togglePauseResume() {
        // This function now handles the logic based on gameState
        // It's called by both the button click and space bar press
        if (gameState === 'running') { // Pause
            gameState = 'paused';
            setStatus('Game Paused. Press Start / Resume or Space Bar.');
            startButton.textContent = 'Resume Game'; startButton.disabled = false;
            difficultySlider.disabled = false;
            if (animationFrameId) cancelAnimationFrame(animationFrameId); animationFrameId = null;
            if (roundResetTimeoutId) clearTimeout(roundResetTimeoutId); roundResetTimeoutId = null;
        } else if (gameState === 'paused' || gameState === 'ready' || gameState === 'scored') { // Start or Resume
            if (gameState === 'ready') {
                 env.reset();
                 playerPaddleY = 0;
                 resetGameVisuals();
            }
            // If resuming from 'scored', resetRound will handle the env reset
            if (gameState !== 'scored') {
                startOrResumeGameLoop();
            } else {
                // If currently 'scored', pressing space/button shouldn't immediately restart
                // It should wait for the resetRound timeout to finish
                setStatus('Get Ready...'); // Indicate waiting
            }
        }
    }

    function startOrResumeGameLoop() {
        // This function strictly starts/resumes the animation loop

        gameState = 'running';
        setStatus('Game running...');
        startButton.textContent = 'Pause Game'; startButton.disabled = false;
        resetButton.disabled = false;
        difficultySlider.disabled = true; // Disable slider while running
        lastTimestamp = performance.now();
        if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(gameLoop);
        }
    }


    function resetGame() { // Full reset triggered by button or 'R' key
        console.log("Resetting game...");
        if (animationFrameId) cancelAnimationFrame(animationFrameId); animationFrameId = null;
        if (roundResetTimeoutId) clearTimeout(roundResetTimeoutId); roundResetTimeoutId = null;
        aiScore = 0; playerScore = 0;
        updateScoreDisplay();
        env.reset();
        playerPaddleY = 0;
        resetGameVisuals();
        setStatus('Game Reset. Press Start Game or Space Bar.'); // Update status text
        gameState = 'ready';
        startButton.textContent = 'Start Game'; startButton.disabled = false;
        resetButton.disabled = true;
        difficultySlider.disabled = false;
    }

    function resetRound() {
        console.log("Resetting round...");
        roundResetTimeoutId = null;
        env.reset();
        playerPaddleY = 0;
        resetGameVisuals();
        startOrResumeGameLoop(); // Resume the game loop after reset
    }


    function resetGameVisuals() {
         if (env && env.ctx) {
            env.paddle1_y = 0;
            env.paddle2_y = playerPaddleY;
            env.render();
         }
    }

    function handleScore(winner) {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        gameState = 'scored'; // Set state to 'scored'
        setStatus(`Point for ${winner}!`);
        updateScoreDisplay();
        startButton.disabled = true; // Disable start/pause during score display
        difficultySlider.disabled = true;

        if (roundResetTimeoutId) clearTimeout(roundResetTimeoutId);
        roundResetTimeoutId = setTimeout(resetRound, SCORE_RESET_DELAY);
    }

    // ================================================
    // PLAYER PADDLE MOVEMENT
    // ================================================
    function updatePlayerPaddle(deltaTime) {
        if (gameState !== 'running') return;

        const dt_factor = 60 * deltaTime * gameSpeedMultiplier;
        const dt_paddle_move = BASE_PADDLE_SPEED * dt_factor;

        let moveDirection = 0;
        if (keysPressed['w'] || touchUpActive) { moveDirection = -1; }
        if (keysPressed['s'] || touchDownActive) { moveDirection = 1; }
        if ((keysPressed['w'] || touchUpActive) && (keysPressed['s'] || touchDownActive)) { moveDirection = 0; }

        let targetY = playerPaddleY + moveDirection * dt_paddle_move;
        targetY = Math.max(-NORM_HEIGHT + PADDLE_HALF_HEIGHT, Math.min(NORM_HEIGHT - PADDLE_HALF_HEIGHT, targetY));
        playerPaddleY = targetY;
    }


    // ================================================
    // GAME LOOP (using requestAnimationFrame)
    // ================================================
    async function gameLoop(timestamp) {
        if (gameState !== 'running') {
            animationFrameId = null; return;
        }

        const deltaTime = Math.min(0.05, (timestamp - lastTimestamp) / 1000.0);
        lastTimestamp = timestamp;

        updatePlayerPaddle(deltaTime);

        const currentState = env._normalize_state();
        const agentAction = await agent.selectAction(currentState);

        const [nextState, reward, terminated, truncated, info] = env.step(agentAction, playerPaddleY, deltaTime, gameSpeedMultiplier);

        if (terminated) {
            if (reward > 0) { aiScore++; handleScore('AI'); }
            else { playerScore++; handleScore('Player'); }
            return;
        }

        if (env) { env.render(); }

        if (gameState === 'running') {
            animationFrameId = requestAnimationFrame(gameLoop);
        } else {
             animationFrameId = null;
        }
    }

    // ================================================
    // UI UPDATES
    // ================================================
    function setStatus(message) { statusDiv.textContent = message; }
    function updateScoreDisplay() {
        aiScoreSpan.textContent = aiScore;
        playerScoreSpan.textContent = playerScore;
    }

    // --- Start Initialization ---
    initialize();
});