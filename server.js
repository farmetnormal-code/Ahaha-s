const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 8080;

let waitingClient = null;
const rooms = new Map();

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Connection', 'close');

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;
    const id = query.id;

    if (!id) {
        res.writeHead(400);
        return res.end('Missing ID\n');
    }

    if (waitingClient && Date.now() - waitingClient.time > 60000) {
        waitingClient = null;
    }

    if (pathname === '/search') {
        console.log(`Игрок ${id} ищет матч...`);
        
        if (rooms.has(id)) {
            const room = rooms.get(id);
            res.writeHead(200);
            return res.end(`MATCH:${room.role}\n`);
        }

        if (!waitingClient || waitingClient.id === id) {
            waitingClient = { id: id, time: Date.now() };
            res.writeHead(200);
            return res.end('WAIT\n');
        } else {
            const partnerId = waitingClient.id;
            waitingClient = null;

            rooms.set(partnerId, { role: 1, partner: id, moves: null });
            rooms.set(id, { role: 2, partner: partnerId, moves: null });

            console.log(`Матч найден! Игрок 1 (${partnerId}) против Игрока 2 (${id})`);
            res.writeHead(200);
            return res.end('MATCH:2\n');
        }
    } 
    else if (pathname === '/turn') {
        const data = query.data || '';
        const room = rooms.get(id);
        if (room && room.partner && rooms.has(room.partner)) {
            const partnerRoom = rooms.get(room.partner);
            partnerRoom.moves = data;
            console.log(`Ход от ${id} передан партнёру ${room.partner}`);
        }
        res.writeHead(200);
        return res.end('OK\n');
    } 
    else if (pathname === '/check') {
        const room = rooms.get(id);
        if (room && room.moves !== null) {
            const movesData = room.moves;
            room.moves = null;
            res.writeHead(200);
            return res.end(`TURN:${movesData}\n`);
        }
        res.writeHead(200);
        return res.end('WAIT\n');
    } 
    else if (pathname === '/disconnect') {
        if (waitingClient && waitingClient.id === id) {
            waitingClient = null;
        }
        if (rooms.has(id)) {
            const room = rooms.get(id);
            if (room.partner && rooms.has(room.partner)) {
                rooms.delete(room.partner);
            }
            rooms.delete(id);
        }
        res.writeHead(200);
        return res.end('OK\n');
    } 
    else {
        res.writeHead(404);
        return res.end('Not Found\n');
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Игровой HTTP-сервер матчмейкинга успешно запущен на порту ${PORT}!`);
});
