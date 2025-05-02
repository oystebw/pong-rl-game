# Pong RL — Player vs AI Demo 🎮🤖

This is a browser-based Pong game where you can play against an AI trained with reinforcement learning (DQN). The AI has been converted to run client-side using ONNX and JavaScript, so everything runs directly in your browser with no backend!

![screenshot](./preview.png)

---

## 🧠 How the Agent Was Trained

- **Algorithm:** Deep Q-Network (DQN)
- **Environment:** Custom-built Pong environment (not Gym)
- **Opponent:** A deterministic, rule-based paddle
- **Goal:** Train until the agent achieves ~80% win rate against the deterministic opponent
- **Export:** Model converted to ONNX for use in browser (see `source/convert_model.py`)

Training scripts and supporting files:
- `source/train.py`: Training loop
- `source/dqn_agent.py`: Agent logic
- `source/pong_env.py`: Custom environment
- `source/model.py`: PyTorch DQN model
- `source/replay_buffer.py`: Experience replay implementation
- `pong.pth`: Fully trained Pong RL Agent

---

## 🎮 How to Play

- Use **`W` / `S` keys** (or touch buttons on mobile) to move your paddle (right side).
- Try to beat the AI agent (left paddle)!
- The first to 10 points wins.

---

## 🛠️ Tech Stack

### 🕹️ Frontend (docs/)
- **HTML, CSS, JavaScript** — Interactive game UI
- **Model Runtime:** [ONNX Runtime Web](https://www.npmjs.com/package/onnxruntime-web)
- **Font:** [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P)
- **Model Inference:** `agent.js` uses ONNX to infer paddle movement in real time

### 🧠 Training (source/)
- **Framework:** PyTorch
- **RL Algorithm:** Deep Q-Network (DQN) with target network and replay buffer
- **Model Export:** Python-to-ONNX conversion using `torch.onnx.export`
- **Testing Tools:** `play.py` using `pygame` for visual evaluation of RL Agent

---

## 🌐 Try It Out

👉 [Play Now on GitHub Pages](https://oystebw.github.io/pong-rl-game/)

---

## 📦 Setup Locally

### 1. Clone the Repository
```bash
git clone https://github.com/oystebw/pong-rl-game.git
cd pong-rl-game
```

### 2. Set Up Python Environment
```bash
python3.10 -m venv venv
source venv/bin/activate
pip3 install -r requirements.txt
```

> ⚠️ **Note:** If you encounter errors during setup, make sure you're using **Python 3.10**.
> You can install it via [pyenv](https://github.com/pyenv/pyenv), [Homebrew](https://brew.sh), or your system package manager.

### 3. Launch Browser Game
```bash
cd docs
python3 -m http.server 8000
# Then open http://localhost:8000 in your browser
```

### 4. Train a New Agent (Optional)
```bash
cd source
python3 train.py # See file for tunable parameters
```

### 4.1. Convert the New Agent to ONNX and Integrate with Frontend (Optional)
```bash
python3 convert_model.py
cd ..
mv dqn_pong_agent.onnx docs/dqn_pong_agent.onnx
```

### 5. Visualize Agent Performance (Optional)
```bash
cd source
python3 play.py # See file for tunable parameters
```