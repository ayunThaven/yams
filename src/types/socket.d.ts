import 'socket.io';

declare module 'socket.io' {
  interface SocketData {
    userId?: string;
    authenticated?: boolean;
    username?: string;
    playerName?: string;
    avatar?: string;
    ready?: boolean;
    serverRestartId?: string;
    serverRestarted?: boolean;
    voluntaryAbandon?: boolean;
  }
}
