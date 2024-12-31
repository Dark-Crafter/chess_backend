import { WebSocket } from "ws";
import { Chess, Move } from "chess.js";
import { GAME_OVER, INIT_GAME, MOVE, GAME_UPDATE, PLAYER_JOINED, GAME_STATE } from "./messages";

export class Game {
  public player1: WebSocket;
  public player2: WebSocket;
  public board: Chess;
  public id: string;
  private startTime: Date;
  private moveCount: number;
  private lastMove: Move | null;
  private spectators: Set<WebSocket>;
  private isGameOver: boolean;

  constructor(player1: WebSocket, player2: WebSocket) {
    this.player1 = player1;
    this.player2 = player2;
    this.board = new Chess();
    this.startTime = new Date();
    this.moveCount = 0;
    this.lastMove = null;
    this.id = Math.random().toString(36).substring(7);
    this.spectators = new Set();
    this.isGameOver = false;

    // Initialize game for both players
    this.initializeGame();
  }

  private initializeGame() {
    try {
      // Notify both players about the game start and their colors
      this.sendToPlayer(this.player1, {
        type: INIT_GAME,
        payload: { 
          color: "white",
          gameId: this.id
        }
      });

      this.sendToPlayer(this.player2, {
        type: INIT_GAME,
        payload: { 
          color: "black",
          gameId: this.id
        }
      });

      // Broadcast initial game state
      this.broadcastGameState();
    } catch (error) {
      console.error('Error initializing game:', error);
    }
  }

  private sendToPlayer(player: WebSocket, message: any) {
    try {
      if (player.readyState === WebSocket.OPEN) {
        player.send(JSON.stringify(message));
      }
    } catch (error) {
      console.error('Error sending message to player:', error);
    }
  }

  private broadcastGameState() {
    if (this.isGameOver) return;

    const gameState = {
      type: GAME_UPDATE,
      payload: {
        fen: this.board.fen(),
        whiteTime: this.getWhiteTime(),
        blackTime: this.getBlackTime(),
        lastMove: this.lastMove,
        gameId: this.id,
        status: this.getStatus()
      }
    };

    this.broadcastToAll(gameState);
  }

  private broadcastToAll(message: any) {
    const jsonMessage = JSON.stringify(message);
    [this.player1, this.player2, ...this.spectators].forEach(client => {
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.send(jsonMessage);
        }
      } catch (error) {
        console.error('Error broadcasting message:', error);
      }
    });
  }

  addSpectator(socket: WebSocket) {
    try {
      this.spectators.add(socket);
      this.sendToPlayer(socket, {
        type: GAME_STATE,
        payload: {
          fen: this.board.fen(),
          whiteTime: this.getWhiteTime(),
          blackTime: this.getBlackTime(),
          gameId: this.id,
          status: this.getStatus()
        }
      });
    } catch (error) {
      console.error('Error adding spectator:', error);
    }
  }

  removeSpectator(socket: WebSocket) {
    this.spectators.delete(socket);
  }

  makeMove(socket: WebSocket, move: { from: string; to: string; }) {
    if (this.isGameOver) return;
    
    // Validate player turn
    if (this.moveCount % 2 === 0 && socket !== this.player1) return;
    if (this.moveCount % 2 === 1 && socket !== this.player2) return;

    try {
      // Validate and make the move
      this.lastMove = this.board.move(move);
      
      if (!this.lastMove) {
        throw new Error('Invalid move');
      }

      // Check for game end conditions
      if (this.board.isGameOver()) {
        this.isGameOver = true;
        const gameOverMessage = {
          type: GAME_OVER,
          payload: {
            winner: this.board.turn() === "w" ? "black" : "white",
            gameId: this.id,
            reason: this.getGameOverReason()
          }
        };
        this.broadcastToAll(gameOverMessage);
        return;
      }

      // Broadcast the move to all players and spectators
      const moveMessage = {
        type: MOVE,
        payload: {
          move,
          gameId: this.id
        }
      };
      this.broadcastToAll(moveMessage);

      this.moveCount++;
      this.broadcastGameState();
    } catch (error) {
      console.error('Error making move:', error);
      this.sendToPlayer(socket, {
        type: 'error',
        payload: { message: 'Invalid move' }
      });
    }
  }

  private getGameOverReason(): string {
    if (this.board.isCheckmate()) return "Checkmate";
    if (this.board.isStalemate()) return "Stalemate";
    if (this.board.isThreefoldRepetition()) return "Threefold Repetition";
    if (this.board.isInsufficientMaterial()) return "Insufficient Material";
    if (this.board.isDraw()) return "Draw";
    return "Game Over";
  }

  getStatus(): string {
    if (this.board.isCheckmate()) return "Checkmate";
    if (this.board.isDraw()) return "Draw";
    if (this.board.isCheck()) return "Check";
    return "In Progress";
  }

  getWhiteTime(): number {
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  getBlackTime(): number {
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  getLastMove(): Move | null {
    return this.lastMove;
  }

  cleanup() {
    this.isGameOver = true;
    this.spectators.clear();
  }
}