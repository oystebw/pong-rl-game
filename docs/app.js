document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const canvas = document.getElementById('pongCanvas');
    const statusDiv = document.getElementById('status');
    const startButton = document.getElementById('startButton');
    const resetButton = document.getElementById('resetButton');
    const aiScoreSpan = document.getElementById('aiScore');     // Left paddle (Agent)
    const playerScoreSpan = document.getElementById('playerScore'); // Right paddle (Human)
    const touchUpButton = document.getElementById('touchUpButton');
    const touchDownButton = document.getElementById('touchDownButton');

    // --- Game State ---
    let env = null;
    let agent = null; // The RL Agent (Left Paddle)
    let animationFrameId = null;
    let gameState = 'loading'; // loading, ready, running, paused, scored
    let aiScore = 0;
    let playerScore = 0;
    let lastTimestamp = 0;
    let roundResetTimeoutId = null;

    // --- Player Control ---
    let playerPaddleY = 0; // Player paddle center y (physics coordinates)
    const keysPressed = {};
    let touchUpActive = false;
    let touchDownActive = false;

    // --- Constants ---
    const PADDLE_SPEED = 12.0;
    const NORM_HEIGHT = 400 / 2.0;
    const PADDLE_HALF_HEIGHT = 60 / 2.0;
    const SCORE_RESET_DELAY = 1000;

    // ================================================
    // INITIALIZATION
    // ================================================
    async function initialize() {
        setStatus('Initializing environment...');
        try {
            canvas.width = 600;
            canvas.height = 400;
            env = new PongEnvJs(canvas); // Should be the 5D
        } catch (e) {
            setStatus(`Error creating environment: ${e}`); console.error("Env creation failed:", e); return;
        }

        setStatus('Initializing AI agent...');
        agent = new PongAgent(); // Should load 5D
        const modelLoaded = await agent.loadModel();

        if (modelLoaded) {
            setStatus('Ready! Press Start / Resume.');
            gameState = 'ready';
            startButton.disabled = false; startButton.textContent = 'Start Game';
            resetButton.disabled = true;
            setupEventListeners();
            resetGameVisuals();
        } else {
            setStatus('Error loading AI model. Cannot start game.');
            startButton.disabled = true; resetButton.disabled = true;
        }
    }

    // ================================================
    // EVENT LISTENERS
    // ================================================
    function setupEventListeners() {
        startButton.addEventListener('click', togglePauseResume);
        resetButton.addEventListener('click', resetGame);

        // Keyboard controls for player paddle
        document.addEventListener('keydown', (event) => {
            keysPressed[event.key.toLowerCase()] = true;
             if (event.key.toLowerCase() === 'w' || event.key.toLowerCase() === 's') {
                event.preventDefault();
            }
        });
        document.addEventListener('keyup', (event) => {
            keysPressed[event.key.toLowerCase()] = false;
        });

        // Touch controls
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
        if (gameState === 'running') { // Pause
            gameState = 'paused';
            setStatus('Game Paused. Press Start / Resume.');
            startButton.textContent = 'Resume Game'; startButton.disabled = false;
            if (animationFrameId) cancelAnimationFrame(animationFrameId); animationFrameId = null;
            if (roundResetTimeoutId) clearTimeout(roundResetTimeoutId); roundResetTimeoutId = null;
        } else if (gameState === 'paused' || gameState === 'ready' || gameState === 'scored') { // Start or Resume
            if (gameState === 'ready') { // Reset only if starting fresh
                 env.reset();
                 playerPaddleY = 0; // Reset player paddle
                 resetGameVisuals();
            }
            if (gameState !== 'scored') {
                startOrResumeGameLoop();
            } else {
                setStatus('Get Ready...');
                startButton.disabled = true;
            }
        }
    }

    function startOrResumeGameLoop() {
        gameState = 'running';
        setStatus('Game running...');
        startButton.textContent = 'Pause Game'; startButton.disabled = false;
        resetButton.disabled = false;
        lastTimestamp = performance.now();
        if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(gameLoop);
        }
    }


    function resetGame() { // Full reset
        console.log("Resetting game...");
        if (animationFrameId) cancelAnimationFrame(animationFrameId); animationFrameId = null;
        if (roundResetTimeoutId) clearTimeout(roundResetTimeoutId); roundResetTimeoutId = null;
        aiScore = 0; playerScore = 0; // Reset scores
        updateScoreDisplay();
        env.reset();
        playerPaddleY = 0; // Reset player paddle
        resetGameVisuals();
        setStatus('Game Reset. Press Start Game.');
        gameState = 'ready';
        startButton.textContent = 'Start Game'; startButton.disabled = false;
        resetButton.disabled = true;
    }

    // Called after SCORE_RESET_DELAY when a point is scored
    function resetRound() {
        console.log("Resetting round...");
        roundResetTimeoutId = null;

        env.reset(); // Resets ball and internal AI agent paddle position
        playerPaddleY = 0; // Reset player paddle control position
        resetGameVisuals(); // Draw the reset state

        startOrResumeGameLoop(); // Resume the game loop
    }


    function resetGameVisuals() {
         if (env && env.ctx) {
            env.paddle1_y = 0; // AI Agent paddle
            env.paddle2_y = playerPaddleY; // Player paddle
            env.render();
         }
    }

    function handleScore(winner) {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        gameState = 'scored';
        setStatus(`Point for ${winner}!`);
        updateScoreDisplay();
        startButton.disabled = true;

        if (roundResetTimeoutId) clearTimeout(roundResetTimeoutId);
        roundResetTimeoutId = setTimeout(resetRound, SCORE_RESET_DELAY);
    }

    // ================================================
    // PLAYER PADDLE MOVEMENT
    // ================================================
    function updatePlayerPaddle(deltaTime) {
        if (gameState !== 'running') return; // Ignore input if not running

        const dt_paddle_speed = PADDLE_SPEED * 60 * deltaTime; // Use faster speed
        let moveDirection = 0;
        // Combine keyboard and touch input
        if (keysPressed['w'] || touchUpActive) { moveDirection = -1; } // Up
        if (keysPressed['s'] || touchDownActive) { moveDirection = 1; } // Down
        if ((keysPressed['w'] || touchUpActive) && (keysPressed['s'] || touchDownActive)) { moveDirection = 0; } // Cancel out

        let targetY = playerPaddleY + moveDirection * dt_paddle_speed;

        // Clamp player paddle position
        targetY = Math.max(-NORM_HEIGHT + PADDLE_HALF_HEIGHT, Math.min(NORM_HEIGHT - PADDLE_HALF_HEIGHT, targetY));
        playerPaddleY = targetY; // Update the player paddle position variable
    }


    // ================================================
    // GAME LOOP (using requestAnimationFrame)
    // ================================================
    async function gameLoop(timestamp) {
        if (gameState !== 'running') {
            animationFrameId = null; return; // Stop if not running
        }

        const deltaTime = Math.min(0.05, (timestamp - lastTimestamp) / 1000.0);
        lastTimestamp = timestamp;

        // --- Input Phase ---
        updatePlayerPaddle(deltaTime); // <<< Move the HUMAN player paddle

        // --- Agent Update Phase ---
        const currentState = env._normalize_state(); // Get 5D state
        const agentAction = await agent.selectAction(currentState); // RL Agent action

        // --- Environment Step Phase ---
        // Pass RL agent's action and the HUMAN player's paddle position
        const [nextState, reward, terminated, truncated, info] = env.step(agentAction, playerPaddleY, deltaTime);

        // --- Scoring ---
        if (terminated) {
            // If RL agent (paddle 1) wins, reward is +1
            if (reward > 0) { aiScore++; handleScore('AI'); }
            else { playerScore++; handleScore('Player'); } // Player scored
            return; // Exit gameLoop this frame
        }

        // --- Render Phase ---
        if (env) { env.render(); } // Render uses internal env.paddle1_y and env.paddle2_y

        // --- Loop ---
        if (gameState === 'running') { // Request next frame ONLY if still running
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
        playerScoreSpan.textContent = playerScore; // Use correct span ID for player
    }

    // --- Start Initialization ---
    initialize();
});