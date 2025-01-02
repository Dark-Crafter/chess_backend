import { WebSocketServer, WebSocket } from 'ws';
import { GameManager } from './GameManager';

const port = process.env.PORT ? Number(process.env.PORT) : 8080;

const wss = new WebSocketServer({
  port,
  verifyClient: (info, done) => {
    try {
      const origin = info.origin || '';
      console.log("Incoming connection from origin:", origin);
      if (origin !== 'https://chess-frontend-4r5o.onrender.com') {
        console.log("Connection rejected: invalid origin");
        done(false, 403, 'Forbidden');
      } else {
        console.log("Connection accepted");
        done(true);
      }
    } catch (error) {
      console.error('Error in verifyClient:', error);
      done(false, 500, 'Internal Server Error');
    }
  }
});

const gameManager = new GameManager();

wss.on('connection', function connection(ws: WebSocket) {
  try {
    console.log('New WebSocket connection established');
    gameManager.addUser(ws);

    ws.on('message', (data) => {
      console.log('Server received message:', data.toString());
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    ws.on('close', () => {
      try {
        console.log('WebSocket connection closed');
        gameManager.removeUser(ws);
      } catch (error) {
        console.error('Error removing user:', error);
      }
    });
  } catch (error) {
    console.error('Error handling connection:', error);
  }
});

wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
});

console.log(`WebSocket server running on port ${port}`);

// Handle process termination
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing WebSocket server...');
  wss.close(() => {
    console.log('WebSocket server closed');
    process.exit(0);
  });
});