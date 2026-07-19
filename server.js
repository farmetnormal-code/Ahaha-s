const http = require('http');
const url = require('url');

// Порт, на котором будет работать сервер (по умолчанию 8080 для Fly.io)
const PORT = process.env.PORT || 8080;

let waitingClient = null; // { id: '123456', time: Date.now() }
const rooms = new Map(); // id -> { role: 1 или 2, partner: '654321', moves: null }

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;
    const id = query.id;

    if (!id) {
        res.writeHead(400);
        return res.end('Missing ID');
    }

    // Очистка старого ожидающего игрока, если он завис более чем на 60 секунд
    if (waitingClient && Date.now() - waitingClient.time > 60000) {
        waitingClient = null;
    }

    // Если игрок нажал "ИСКАТЬ БОЙ" (или периодически опрашивает статус поиска)
    if (pathname === '/search') {
        console.log(`Игрок ${id} ищет матч...`);
        
        // Если игрок уже соединен в комнату
        if (rooms.has(id)) {
            const room = rooms.get(id);
            res.writeHead(200);
            return res.end(`MATCH:${room.role}`);
        }

        // Если комната еще не найдена и в очереди никого нет (или это тот же игрок)
        if (!waitingClient || waitingClient.id === id) {
            waitingClient = { id: id, time: Date.now() };
            res.writeHead(200);
            return res.end('WAIT');
        } else {
            // Нашли пару!
            const partnerId = waitingClient.id;
            waitingClient = null;

            rooms.set(partnerId, { role: 1, partner: id, moves: null });
            rooms.set(id, { role: 2, partner: partnerId, moves: null });

            console.log(`Матч найден! Игрок 1 (${partnerId}) против Игрока 2 (${id})`);
            res.writeHead(200);
            return res.end('MATCH:2');
        }
    } 
    // Если игрок сделал ход и отправляет данные атак
    else if (pathname === '/turn') {
        const data = query.data || '';
        const room = rooms.get(id);
        if (room && room.partner && rooms.has(room.partner)) {
            const partnerRoom = rooms.get(room.partner);
            partnerRoom.moves = data; // Сохраняем ход для соперника
            console.log(`Ход от ${id} передан партнёру ${room.partner}`);
        }
        res.writeHead(200);
        return res.end('OK');
    } 
    // Опрос входящих ходов от соперника
    else if (pathname === '/check') {
        const room = rooms.get(id);
        if (room && room.moves !== null) {
            const movesData = room.moves;
            room.moves = null; // Очищаем буфер после чтения
            res.writeHead(200);
            return res.end(`TURN:${movesData}`);
        }
        res.writeHead(200);
        return res.end('WAIT');
    } 
    // Отключение или выход в меню
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
        return res.end('OK');
    } 
    else {
        res.writeHead(404);
        return res.end('Not Found');
    }
});

// Запускаем HTTP-сервер
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Игровой HTTP-сервер матчмейкинга успешно запущен на порту ${PORT}!`);
});
