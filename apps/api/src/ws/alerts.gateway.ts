import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class AlertsGateway {
  @WebSocketServer()
  server!: Server;

  pushAlert(orgId: string, payload: unknown) {
    this.server.emit('alert', { orgId, ...((payload as Record<string, unknown>) || {}) });
  }
}
