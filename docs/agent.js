// agent.js
/**
 * Handles loading the ONNX model and performing inference.
 * Expects a model trained on 5D state.
 */
class PongAgent {
    constructor(modelPath = "./dqn_pong_agent.onnx") {
        this.modelPath = modelPath;
        this.ortSession = null;
        this.stateDim = 5;
        this.actionDim = 3;
    }

    async loadModel() {
        console.log(`Attempting to load ONNX model (5D State, Faster) from: ${this.modelPath}`);
        try {
            this.ortSession = await ort.InferenceSession.create(this.modelPath, {
                executionProviders: ['wasm'],
                graphOptimizationLevel: 'all'
            });
            console.log("ONNX Runtime session created successfully.");
            if (this.ortSession.inputNames.length === 0 || this.ortSession.outputNames.length === 0) {
                 console.error("Model loaded but has no input or output names defined.");
                 return false;
            }
            console.log("Input names:", this.ortSession.inputNames);
            console.log("Output names:", this.ortSession.outputNames);
            return true;
        } catch (e) {
            console.error(`Failed to load ONNX model: ${e}`);
            this.ortSession = null;
            return false;
        }
    }

    async selectAction(state) {
        if (!this.ortSession) {
            console.error("ONNX session not loaded. Returning default action (0).");
            return 0;
        }
        if (!state || state.length !== this.stateDim) {
             console.error(`Invalid state received by agent: Expected length ${this.stateDim}, got ${state ? state.length : 'undefined'}. State:`, state);
             return 0;
        }

        try {
            const stateArray = (state instanceof Float32Array) ? state : new Float32Array(state);
            // Input shape [batch_size, state_dim] = [1, 5]
            const stateTensor = new ort.Tensor('float32', stateArray, [1, this.stateDim]);
            const feeds = { [this.ortSession.inputNames[0]]: stateTensor };
            const results = await this.ortSession.run(feeds);
            const outputTensor = results[this.ortSession.outputNames[0]];
            const qValues = outputTensor.data;
            let bestAction = 0; let maxQ = -Infinity;
            for (let i = 0; i < qValues.length; i++) {
                if (qValues[i] > maxQ) { maxQ = qValues[i]; bestAction = i; }
            }
            return bestAction;
        } catch (e) {
            console.error(`Error during model inference: ${e}`);
            return 0;
        }
    }
}