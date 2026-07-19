const net = require('net');

// Порт, на котором будет работать сервер (по умолчанию 25565)
const PORT = process.env.PORT || 25565;

let waitingClient = null;
const rooms = new Map(); // Здесь храним пары игроков: Игрок -> его Соперник

const server = net.createServer((socket) => {
    console.log('Новое подключение с IP:', socket.remoteAddress);
    socket.setEncoding('utf8');
    let buffer = '';

    socket.on('data', (data) => {
        buffer += data;
        let lines = buffer.split('\n');
        buffer = lines.pop(); // Остаток неполной строки оставляем в буфере

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;

            // Если игрок нажал "ИСКАТЬ БОЙ"
            if (line === 'SEARCH') {
                console.log('Игрок ищет матч...');
                if (waitingClient === null || waitingClient === socket || waitingClient.destroyed) {
                    waitingClient = socket;
                } else {
                    // Нашли пару!
                    const player1 = waitingClient;
                    const player2 = socket;
                    waitingClient = null;

                    // Связываем их друг с другом в комнату
                    rooms.set(player1, player2);
                    rooms.set(player2, player1);

                    // Отправляем роли, чтобы телефоны запустили игру
                    player1.write('MATCH:1\n');
                    player2.write('MATCH:2\n');
                    console.log('Матч найден! Игроки соединены в комнату.');
                }
            } 
            // Если игрок сделал ход и отправил данные атак
            else if (line.startsWith('TURN:')) {
                const partner = rooms.get(socket);
                if (partner && !partner.destroyed) {
                    partner.write(line + '\n'); // Просто пересылаем ход сопернику
                }
            }
        }
    });

    // Если игрок закрыл игру, отключился или пропал интернет
    socket.on('close', () => {
        console.log('Игрок отключился');
        if (waitingClient === socket) {
            waitingClient = null;
        }
        const partner = rooms.get(socket);
        if (partner) {
            rooms.delete(partner);
            rooms.delete(socket);
            partner.destroy(); // Разрываем связь у соперника, т.к. бой окончен
        }
    });

    socket.on('error', (err) => {
        console.log('Ошибка сокета:', err.message);
    });
});

// Запускаем сервер
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Игровой сервер матчмейкинга успешно запущен на порту ${PORT}!`);
});
