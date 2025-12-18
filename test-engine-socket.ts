import { io } from 'socket.io-client';

const socket = io('http://localhost:3002');

socket.on('connect', () => {
    console.log('Connected to Engine Socket');
});

socket.on('price:update', (data) => {
    // Check if any update is from nado
    const nadoUpdates = data.filter((p: any) => p.exchange === 'nado');
    if (nadoUpdates.length > 0) {
        console.log('Received Nado updates:', nadoUpdates.map((p: any) => `${p.symbol}: ${p.bid}/${p.ask}`));
    }
});

socket.on('exchange:connected', (ex) => {
    console.log('Exchange connected:', ex);
});

socket.on('disconnect', () => {
    console.log('Disconnected');
});
