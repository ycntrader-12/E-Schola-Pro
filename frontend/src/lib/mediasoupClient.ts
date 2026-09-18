/**
 * Mediasoup / Janus C++ SFU Client Adapter — E-Schola Pro
 * Client TypeScript gérant la négociation haute performance des flux WebRTC SFU:
 * - Demande des capacités RTP du Router Mediasoup C++ (getRouterRtpCapabilities)
 * - Création et connexion des WebRtcTransports (SendTransport & RecvTransport)
 * - Ingestion et émission de flux (Producers: micro, caméra HD, partage d'écran)
 * - Réception sélective multi-flux (Consumers) avec régulation dynamique du débit et bande passante
 */

export interface MediasoupRtpCapabilities {
  codecs: Array<{
    mimeType: string;
    kind: string;
    clockRate: number;
    channels?: number;
    preferredPayloadType: number;
    parameters?: any;
    rtcpFeedback?: any[];
  }>;
  headerExtensions?: Array<{
    kind: string;
    uri: string;
    preferredId: number;
  }>;
}

export interface MediasoupTransportOptions {
  id: string;
  iceParameters: any;
  iceCandidates: any[];
  dtlsParameters: any;
  sctpParameters?: any;
}

export class MediasoupSFUAdapter {
  private sendWsMessage: (msg: any) => void;
  private pendingRequests: Map<string, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();

  private sendTransport: MediasoupTransportOptions | null = null;
  private recvTransport: MediasoupTransportOptions | null = null;
  private activeProducers: Map<string, string> = new Map(); // kind -> producer_id
  private activeConsumers: Map<string, any> = new Map(); // consumer_id -> data

  constructor(sendWsMessage: (msg: any) => void) {
    this.sendWsMessage = sendWsMessage;
  }

  private request(type: string, data: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      this.pendingRequests.set(requestId, { resolve, reject });
      this.sendWsMessage({
        type,
        request_id: requestId,
        ...data
      });

      // Timeout de protection à 8 secondes
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.get(requestId)?.reject(new Error(`Timeout requêtes SFU: ${type}`));
          this.pendingRequests.delete(requestId);
        }
      }, 8000);
    });
  }

  public handleSignalMessage(msg: any) {
    const requestId = msg.request_id;
    if (requestId && this.pendingRequests.has(requestId)) {
      const { resolve } = this.pendingRequests.get(requestId)!;
      this.pendingRequests.delete(requestId);

      switch (msg.type) {
        case 'mediasoup_router_rtp_capabilities':
          resolve(msg.rtpCapabilities);
          break;
        case 'mediasoup_webrtc_transport_created':
          resolve(msg.transportOptions);
          break;
        case 'mediasoup_webrtc_transport_connected':
          resolve(msg.success);
          break;
        case 'mediasoup_produced':
          resolve({ id: msg.producer_id, kind: msg.kind });
          break;
        case 'mediasoup_consumed':
          resolve(msg.consumerOptions);
          break;
        default:
          resolve(msg);
          break;
      }
    }
  }

  public async getRouterRtpCapabilities(): Promise<MediasoupRtpCapabilities> {
    return await this.request('mediasoup_get_router_rtp_capabilities');
  }

  public async createSendTransport(): Promise<MediasoupTransportOptions> {
    const options = await this.request('mediasoup_create_webrtc_transport', { direction: 'send' });
    this.sendTransport = options;
    return options;
  }

  public async createRecvTransport(): Promise<MediasoupTransportOptions> {
    const options = await this.request('mediasoup_create_webrtc_transport', { direction: 'recv' });
    this.recvTransport = options;
    return options;
  }

  public async connectTransport(transportId: string, dtlsParameters: any): Promise<boolean> {
    return await this.request('mediasoup_connect_webrtc_transport', {
      transport_id: transportId,
      dtlsParameters
    });
  }

  public async produceTrack(kind: 'audio' | 'video' | 'screen', rtpParameters: any, appData: any = {}): Promise<string> {
    if (!this.sendTransport) {
      await this.createSendTransport();
    }
    const res = await this.request('mediasoup_produce', {
      transport_id: this.sendTransport?.id,
      kind,
      rtpParameters,
      appData
    });
    this.activeProducers.set(kind, res.id);
    return res.id;
  }

  public async consumeProducer(producerId: string, rtpCapabilities: MediasoupRtpCapabilities): Promise<any> {
    if (!this.recvTransport) {
      await this.createRecvTransport();
    }
    const consumer = await this.request('mediasoup_consume', {
      producer_id: producerId,
      rtpCapabilities
    });
    this.activeConsumers.set(consumer.id, consumer);
    return consumer;
  }

  public clearTransports() {
    this.sendTransport = null;
    this.recvTransport = null;
    this.activeProducers.clear();
    this.activeConsumers.clear();
  }
}
