const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const WebSocket = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// グローバルでDiscord Gatewayの接続状態とログを保持
let ws = null;
let heartbeatInterval = null;
let gatewayLogs = [];

function addGatewayLog(text, type = 'info') {
  const now = new Date();
  const timestamp = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
  const log = { id: Math.random().toString(36).substring(2, 9), timestamp, type, text };
  gatewayLogs.push(log);
  if (gatewayLogs.length > 100) gatewayLogs.shift(); // 最新100件を保持
  console.log(`[WSS-SERVER] [${timestamp}] [${type.toUpperCase()}] ${text}`);
}

// Discord Gatewayへ接続する関数
function connectGateway(token, tokenType) {
  if (ws) {
    try { ws.terminate(); } catch (e) {}
    ws = null;
  }
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  const gatewayUrl = 'wss://gateway.discord.gg/?v=10&encoding=json';
  addGatewayLog(`Connecting to gateway: ${gatewayUrl}`, 'info');

  ws = new WebSocket(gatewayUrl);

  ws.on('open', () => {
    addGatewayLog('Connected to Discord Gateway successfully!', 'success');
  });

  ws.on('message', (data) => {
    try {
      const packet = JSON.parse(data.toString());
      const { t, s, op, d } = packet;

      addGatewayLog(`[RECV] Opcode: ${op}${t ? ` | Event: ${t}` : ''}${s ? ` | Seq: ${s}` : ''}`, 'info');

      if (op === 10) {
        const interval = d.heartbeat_interval;
        addGatewayLog(`[HELLO] Heartbeat interval received: ${interval}ms`, 'info');

        heartbeatInterval = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            addGatewayLog('[SEND] Heartbeat (Op 1)', 'info');
            ws.send(JSON.stringify({ op: 1, d: null }));
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
        ws.send(JSON.stringify(identifyPayload));
      }

      if (t === 'READY') {
        addGatewayLog(`[READY] Logged in as: ${d.user.username} (ID: ${d.user.id}) | Guilds: ${d.guilds.length}`, 'success');
      }
    } catch (err) {
      addGatewayLog(`Packet parse error: ${err.message}`, 'error');
    }
  });

  ws.on('error', (err) => {
    addGatewayLog(`WSS ERROR: ${err.message}`, 'error');
  });

  ws.on('close', (code, reason) => {
    addGatewayLog(`WSS CLOSED: Code ${code}, Reason: ${reason.toString() || 'None'}`, 'warn');
    if (heartbeatInterval) clearInterval(heartbeatInterval);
  });
}

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    const { pathname } = parsedUrl;

    // カスタムGatewayエンドポイントの処理
    if (pathname && pathname.startsWith('/api/custom-gateway')) {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          if (data.action === 'connect') {
            connectGateway(data.token, data.tokenType);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Gateway connection initiated' }));
          } else if (data.action === 'logs') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ logs: gatewayLogs }));
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid action' }));
          }
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // 通常のNext.jsリクエスト処理
    handle(req, res, parsedUrl);
  }).listen(3000, (err) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3000');
  });
});
