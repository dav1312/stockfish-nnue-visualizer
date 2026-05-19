# Stockfish NNUE Visualizer

A modern, browser-based tool to inspect and visualize the internal neural network activations of Stockfish's evaluation function (SFNNv14 architecture).

## Overview

Modern chess engines like Stockfish use Efficiently Updatable Neural Networks (NNUE) to evaluate chess positions. This tool allows you to upload a compiled Stockfish network file (`.nnue`) and observe exactly how the network "thinks" by dynamically rendering its internal tensor activations based on different board states (FENs).

## Features

- **100% Client-Side:** Parses `.nnue` files entirely in the browser using the File API and JavaScript `DataView`. No server required.
- **Dynamic FEN Evaluation:** Type in any valid FEN string to instantly see how the board state propagates through the network.
- **Feature Extraction:** Accurately extracts `HalfKAv2` (Piece-Square) and `FullThreats` features, properly handling Side-to-Move (STM) and Not-Side-to-Move (NSTM) perspectives.
- **Layer Heatmaps:** Visualizes the network layers using logarithmic heatmaps:
  - L1: Feature Transformer (1024 dims, split by perspective)
  - L2: Hidden Layer 0 (SqrClippedReLU + ClippedReLU)
  - L3: Hidden Layer 1 (ClippedReLU)
  - Output: Calculates positional evaluation alongside the base PSQT skip connection.
