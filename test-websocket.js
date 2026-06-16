/**
 * WebSocket Connection Test Script
 * 
 * Usage:
 * 1. Make sure the server is running (npm run start:dev)
 * 2. Get a valid JWT token from login
 * 3. Run: node test-websocket.js YOUR_JWT_TOKEN
 * 
 * This will connect to both /notifications and /chat namespaces
 * and show the connection status.
 */

const { io } = require('socket.io-client');

const JWT_TOKEN = process.argv[2];
const SERVER_URL = process.argv[3] || 'http://localhost:3000';

if (!JWT_TOKEN) {
  console.error('❌ Please provide a JWT token as argument');
  console.error('Usage: node test-websocket.js YOUR_JWT_TOKEN [SERVER_URL]');
  console.error('Example: node test-websocket.js eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
  process.exit(1);
}

console.log('🔌 Testing WebSocket connections...');
console.log(`📍 Server: ${SERVER_URL}`);
console.log('');

// Test Notifications namespace
const notificationSocket = io(`${SERVER_URL}/notifications`, {
  auth: { token: JWT_TOKEN },
  transports: ['websocket'],
});

notificationSocket.on('connect', () => {
  console.log('✅ [Notifications] Connected successfully!');
  console.log(`   Socket ID: ${notificationSocket.id}`);
});

notificationSocket.on('connected', (data) => {
  console.log('✅ [Notifications] Authenticated!');
  console.log(`   User ID: ${data.userId}`);
  console.log(`   Role: ${data.role}`);
  console.log('');
  console.log('📢 You should now appear ONLINE in /api/notifications/status');
  console.log('   Try calling the API again while this script is running.');
  console.log('');
});

notificationSocket.on('notification', (payload) => {
  console.log('📩 [Notifications] Received notification:');
  console.log(JSON.stringify(payload, null, 2));
});

notificationSocket.on('connect_error', (error) => {
  console.error('❌ [Notifications] Connection error:', error.message);
});

notificationSocket.on('disconnect', (reason) => {
  console.log('🔌 [Notifications] Disconnected:', reason);
});

// Test Chat namespace
const chatSocket = io(`${SERVER_URL}/chat`, {
  auth: { token: JWT_TOKEN },
  transports: ['websocket'],
});

chatSocket.on('connect', () => {
  console.log('✅ [Chat] Connected successfully!');
  console.log(`   Socket ID: ${chatSocket.id}`);
});

chatSocket.on('connected', (data) => {
  console.log('✅ [Chat] Authenticated!');
  console.log(`   User ID: ${data.userId}`);
});

chatSocket.on('connect_error', (error) => {
  console.error('❌ [Chat] Connection error:', error.message);
});

chatSocket.on('disconnect', (reason) => {
  console.log('🔌 [Chat] Disconnected:', reason);
});

// Keep the script running
console.log('⏳ Connecting... (Press Ctrl+C to exit)');
console.log('');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Disconnecting...');
  notificationSocket.disconnect();
  chatSocket.disconnect();
  process.exit(0);
});

// Keep alive
setInterval(() => {}, 1000);
