import { NextRequest, NextResponse } from 'next/server';
import WebSocket from 'ws';

// サーバープロセスのメモリ上でWebSocketとログを保持
declare global {
  var activeWs: WebSocket | null;
  var heartbeatTimer: NodeJS.Timeout | null;
  var gatewayLogs: Array<{ id: string; timestamp: string; type: 'info' | 'success' | 'error' | 'warn'; text: string }>;
}

if (!global.gatewayLogs) global.gatewayLogs = [];

function addGatewayLog(text: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const now = new Date();
  const timestamp = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
  global.gatewayLogs.push({ id: Math.random().toString(36).substring(2, 9), timestamp, type, text });
  if (global.gatewayLogs.length > 100) global.gatewayLogs.shift();
}

function connectGateway(token: string, tokenType: 'bot' | 'user') {
  if (global.activeWs) {
    try { global.activeWs.terminate(); } catch (e) {}
    global.activeWs = null;
  }
  if (global.heartbeatTimer) {
    clearInterval(global.heartbeatTimer);
    global.heartbeatTimer = null;
  }

  const gatewayUrl = 'wss://gateway.discord.gg/?v=10&encoding=json';
  addGatewayLog(`Connecting to gateway: ${gatewayUrl}`, 'info');

  const ws = new WebSocket(gatewayUrl);
  global.activeWs = ws;

  ws.on('open', () => {
    addGatewayLog('Connected to Discord Gateway successfully!', 'success');
  });

  ws.on('message', (data: WebSocket.Data) => {
    try {
      const packet = JSON.parse(data.toString());
      const { t, s, op, d } = packet;

      addGatewayLog(`[RECV] Opcode: ${op}${t ? ` | Event: ${t}` : ''}${s ? ` | Seq: ${s}` : ''}`, 'info');

      if (op === 10) {
        const interval = d.heartbeat_interval;
        addGatewayLog(`[HELLO] Heartbeat interval received: ${interval}ms`, 'info');

        global.heartbeatTimer = setInterval(() => {
          if (global.activeWs && global.activeWs.readyState === WebSocket.OPEN) {
            addGatewayLog('[SEND] Heartbeat (Op 1)', 'info');
            global.activeWs?.send(JSON.stringify({ op: 1, d: null }));
          }
        }, interval);

        addGatewayLog('[SEND] Identifying to gateway (Op 2)...', 'info');
        const identifyPayload = {
          op: 2,
          d: {
            token: tokenType === 'bot' ? `Bot ${token}` : token,
            properties: {
              os: 'Windows',
              browser: 'Chrome',
              device: '',
              system_locale: 'ja',
              browser_user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              browser_version: '124.0.0.0',
              os_version: '10',
              release_channel: 'stable',
              client_build_number: 305412,
            },
            presence: {
              status: 'online',
              since: 0,
              activities: [],
              afk: false,
            }
          }
        };
        global.activeWs?.send(JSON.stringify(identifyPayload));
      }

      if (t === 'READY') {
        addGatewayLog(`[READY] Logged in as: ${d.user.username} (ID: ${d.user.id}) | Guilds: ${d.guilds.length}`, 'success');
      }
    } catch (err: any) {
      addGatewayLog(`Packet parse error: ${err.message}`, 'error');
    }
  });

  ws.on('error', (err: Error) => {
    addGatewayLog(`WSS ERROR: ${err.message}`, 'error');
  });

  ws.on('close', (code: number, reason: Buffer) => {
    addGatewayLog(`WSS CLOSED: Code ${code}, Reason: ${reason.toString() || 'None'}`, 'warn');
    if (global.heartbeatTimer) clearInterval(global.heartbeatTimer);
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, token, tokenType } = body;

    if (action === 'connect') {
      if (!token) {
        return NextResponse.json({ error: 'Token is required' }, { status: 400 });
      }
      connectGateway(token, tokenType || 'bot');
      return NextResponse.json({ success: true, message: 'Gateway connection initiated' });
    }

    if (action === 'logs') {
      return NextResponse.json({ logs: global.gatewayLogs || [] });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
