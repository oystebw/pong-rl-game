# train.py (Configured for 5D State Retraining)
import numpy as np
import matplotlib.pyplot as plt
from collections import deque
import torch
import time
import random
import copy

# Import custom environment and agent
from pong_env import PongEnv
from dqn_agent import DQNAgent

def train_pong(
    num_episodes: int = 5000,
    max_episode_steps: int = 3000,
    buffer_size: int = 100_000,
    batch_size: int = 64,
    gamma: float = 0.99,
    tau: float = 1e-3,
    lr: float = 1e-4,               # Start with a reasonable LR
    update_freq: int = 4,
    hidden_dim: int = 128,          # Or 256, choose consistently
    eps_start: float = 1.0,         # Start exploration high
    eps_end: float = 0.02,
    eps_decay_steps: int = 300_000, # Allow ample decay time
    start_steps: int = 5000,        # Some initial random exploration
    target_reward_avg: float = 0.8, # Agent must win 90% of the time before we consider it solved
    print_every: int = 50,
    render_every: int = 0,
    model_save_path: str = "../pong.pth",
    load_model_from: str = None, # Path to load a pre-trained model
    seed: int = 44 # Random seed for reproducibility
):
    """Trains a DQN agent on the custom Pong environment with 5D state."""

    # --- Environment and Agent Setup ---
    env = PongEnv()
    print("Initializing Pong Environment (5D State) for Training...")
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)

    state_dim = env.state_dim
    action_dim = env.action_dim

    agent = DQNAgent(
        state_dim, action_dim, buffer_size, batch_size, lr, gamma, tau,
        update_freq, hidden_dim
    )

    # --- Load Model ---
    if load_model_from:
        print(f"Warning: load_model_from='{load_model_from}' ignored. Retraining required due to state dimension change.")
    print("\nStarting training from scratch with 5D state...")


    scores = []
    scores_window = deque(maxlen=100)
    total_timesteps = 0
    start_time = time.time()

    best_avg_score = -float('inf')
    best_model_state = None

    print(f"State Dim: {state_dim}, Action Dim: {action_dim}")
    print(f"Target Average Reward (100 eps): {target_reward_avg}")

    # --- Training Loop ---
    for ep in range(1, num_episodes + 1):
        state, _ = env.reset()
        ep_reward = 0.0
        ep_timesteps = 0
        render_this_episode = (render_every > 0 and ep % render_every == 0)

        while ep_timesteps < max_episode_steps:
            total_timesteps += 1
            ep_timesteps += 1

            eps = eps_end + (eps_start - eps_end) * np.exp(-1. * total_timesteps / eps_decay_steps)

            if total_timesteps < start_steps:
                action = random.randint(0, action_dim - 1)
            else:
                action = agent.select_action(state, eps) # Agent expects 5D state

            next_state, reward, terminated, truncated, _ = env.step(action)
            done = terminated or truncated

            agent.step(state, action, reward, next_state, done)

            state = next_state
            ep_reward += reward

            if render_this_episode:
                try: env.render()
                except Exception: render_this_episode = False

            if done: break
        # --- End Step Loop ---

        scores_window.append(ep_reward)
        scores.append(ep_reward)

        # --- Logging ---
        if ep % print_every == 0:
            avg_score = np.mean(scores_window) if len(scores_window) > 0 else -1.0
            elapsed_time = time.time() - start_time
            loss = agent.get_last_loss()
            loss_str = f"{loss:.4f}" if loss is not None else "N/A"
            print(f"Ep {ep:5d} | Avg Score (100): {avg_score:6.2f} | Epsilon: {eps:.3f} | Steps: {total_timesteps:8d} | Ep Reward: {ep_reward:5.1f} | Loss: {loss_str} | Time: {elapsed_time:.1f}s")

        # --- Save Best Model ---
        current_avg_score = np.mean(scores_window) if len(scores_window) >= 100 else -float('inf')
        if len(scores_window) >= 100 and current_avg_score > best_avg_score:
             best_avg_score = current_avg_score
             print(f"*** New best average score: {best_avg_score:.2f}. Saving model to {model_save_path} ***")
             agent.save(model_save_path)

        # --- Check if solved ---
        if len(scores_window) >= 100 and np.mean(scores_window) >= target_reward_avg:
            print(f"\nEnvironment considered solved in {ep} episodes!\tAverage Score: {np.mean(scores_window):.2f}")
            if best_avg_score < current_avg_score: agent.save(model_save_path)
            break
    # --- End Episode Loop ---

    print(f"\nTraining finished after {ep} episodes.")
    print(f"Best model during run saved to {model_save_path} (Achieved Avg Score: {best_avg_score:.2f})")
    env.close()

    # --- Plotting ---
    plt.ioff()
    fig = plt.figure(figsize=(12, 6))
    plt.plot(np.arange(1, len(scores) + 1), scores, label="Episode Reward", alpha=0.6)
    if len(scores) >= 100:
        rolling_avg = np.convolve(scores, np.ones(100)/100, mode='valid')
        plt.plot(np.arange(100, len(scores) + 1), rolling_avg, label='Rolling Average (100 episodes)', color='orange', linewidth=2)
    plt.axhline(y=target_reward_avg, color='r', linestyle='--', label=f'Target Avg Score ({target_reward_avg})')
    plt.xlabel("Episode")
    plt.ylabel("Reward (+1 win, -1 loss)")
    plt.title(f"DQN Training Progress on Pong (5D State)")
    plt.legend()
    plt.grid(True)
    plot_filename = "dqn_pong_5d_training_curve.png"
    plt.savefig(plot_filename)
    print(f"Training curve saved to {plot_filename}")


if __name__ == "__main__":
    # --- Change these as you want ---
    LOAD_MODEL_PATH = None
    HIDDEN_DIM = 128
    NUM_EPISODES = 5000
    LEARNING_RATE = 1e-4
    SAVE_PATH = "../pong.pth"
    RENDER_EVERY_N = 0 # Set to 0 to disable rendering
    EPS_DECAY_STEPS = 300_000

    # --- Start Training ---
    train_pong(
        load_model_from=LOAD_MODEL_PATH,
        num_episodes=NUM_EPISODES,
        lr=LEARNING_RATE,
        hidden_dim=HIDDEN_DIM,
        model_save_path=SAVE_PATH,
        render_every=RENDER_EVERY_N,
        eps_decay_steps=EPS_DECAY_STEPS
        # Add other parameters here if desired
    )