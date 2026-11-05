import { NextRequest, NextResponse } from 'next/server';
import WebSocket from 'ws';

interface GatewaySession {
  ws: WebSocket | null;
  heartbeatTimer: NodeJS.Timeout | null;
  token: string;
  tokenType: 'bot' | 'user';
  isConnecting: boolean;
}

declare global {
  var activeSessions: Map<string, GatewaySession>;
  var gatewayLogs: Array<{ id: string; timestamp: string; type: 'info' | 'success' | 'error' | 'warn'; text: string }>;
}

if (!global.activeSessions) global.activeSessions = new Map();
if (!global.gatewayLogs) global.gatewayLogs = [];

function addGatewayLog(text: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const now = new Date();
  const timestamp = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
  global.gatewayLogs.push({ id: Math.random().toString(36).substring(2, 9), timestamp, type, text });
  if (global.gatewayLogs.length > 150) global.gatewayLogs.shift();
}

function connectGateway(token: string, tokenType: 'bot' | 'user') {
  // すでにセッションが存在する場合は、既存の接続を生かすかクリーンアップする
  if (global.activeSessions.has(token)) {
    const existing = global.activeSessions.get(token)!;
    if (existing.ws && existing.ws.readyState === WebSocket.OPEN) {
      addGatewayLog(`Session already active for [${token.substring(0, 6)}...]. Skipping duplicate connect.`, 'info');
      return;
    }
    // 壊れているなら掃除する
    try { existing.ws?.terminate(); } catch (e) {}
    if (existing.heartbeatTimer) clearInterval(existing.heartbeatTimer);
  }

  const session: GatewaySession = {
    ws: null,
    heartbeatTimer: null,
    token,
    tokenType,
    isConnecting: true
  };
  global.activeSessions.set(token, session);

  const gatewayUrl = 'wss://gateway.discord.gg/?v=10&encoding=json';
  addGatewayLog(`Connecting to gateway for token prefix [${token.substring(0, 6)}...]: ${gatewayUrl}`, 'info');

  const ws = new WebSocket(gatewayUrl);
  session.ws = ws;

  ws.on('open', () => {
    session.isConnecting = false;
    addGatewayLog(`Connected to Discord Gateway successfully! [${token.substring(0, 6)}...]`, 'success');
  });

  ws.on('message', (data: WebSocket.Data) => {
    try {
      const packet = JSON.parse(data.toString());
      const { t, s, op, d } = packet;

      // ログがうるさくなりすぎるのを防ぐためPRESENCE_UPDATEは一部間引くかそのまま流す
      addGatewayLog(`[RECV] [${token.substring(0, 6)}...] Opcode: ${op}${t ? ` | Event: ${t}` : ''}${s ? ` | Seq: ${s}` : ''}`, 'info');

      if (op === 10) {
        const interval = d.heartbeat_interval;
        addGatewayLog(`[HELLO] Heartbeat interval received: ${interval}ms [${token.substring(0, 6)}...]`, 'info');

        if (session.heartbeatTimer) clearInterval(session.heartbeatTimer);
        session.heartbeatTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            addGatewayLog(`[SEND] Heartbeat (Op 1) [${token.substring(0, 6)}...]`, 'info');
            ws.send(JSON.stringify({ op: 1, d: null }));
          }
        }, interval);

        addGatewayLog(`[SEND] Identifying to gateway (Op 2)... [${token.substring(0, 6)}...]`, 'info');
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
        ws.send(JSON.stringify(identifyPayload));
      }

      if (t === 'READY') {
        addGatewayLog(`[READY] Logged in as: ${d.user.username} (ID: ${d.user.id}) | Guilds: ${d.guilds.length} [${token.substring(0, 6)}...]`, 'success');
      }
    } catch (err: any) {
      addGatewayLog(`Packet parse error [${token.substring(0, 6)}...]: ${err.message}`, 'error');
    }
  });

  ws.on('error', (err: Error) => {
    addGatewayLog(`WSS ERROR [${token.substring(0, 6)}...]: ${err.message}`, 'error');
  });

  ws.on('close', (code: number, reason: Buffer) => {
    addGatewayLog(`WSS CLOSED [${token.substring(0, 6)}...]: Code ${code}, Reason: ${reason.toString() || 'None'}`, 'warn');
    if (session.heartbeatTimer) clearInterval(session.heartbeatTimer);
    
    // 自動再接続（5秒後にリトライ）
    addGatewayLog(`Scheduling auto-reconnect for [${token.substring(0, 6)}...] in 5 seconds...`, 'warn');
    setTimeout(() => {
      // まだセッションマップに生きていれば再接続を試みる
      if (global.activeSessions.has(token)) {
        connectGateway(token, tokenType);
      }
    }, 5000);
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
      return NextResponse.json({ 
        success: true, 
        message: 'Gateway connection initiated with auto-reconnect',
        activeCount: global.activeSessions.size 
      });
    }

    if (action === 'logs') {
      return NextResponse.json({ 
        logs: global.gatewayLogs || [],
        activeSessionsCount: global.activeSessions.size 
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
