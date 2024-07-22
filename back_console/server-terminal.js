const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('ssh2');
const cors = require('cors');
const bodyParser = require('body-parser'); // Necesario para parsear el JSON

const app = express();
app.use(cors());
app.use(bodyParser.json()); // Middleware para parsear JSON

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type"],
        credentials: true,
    },
});

let sshConfig = {};

// Ruta para recibir las credenciales SSH del frontend
app.post('/set-ssh-config', (req, res) => {
    sshConfig = req.body;
    console.log('Configuración SSH actualizada:', sshConfig);
    res.sendStatus(200);
});

io.on('connection', (socket) => {
    console.log('Cliente conectado');

    let ssh = new Client();

    // Se establece la conexión SSH cuando se recibe una conexión del cliente
    socket.on('command', (commandData) => {
        if (!sshConfig.host) {
            socket.emit('output', { message: 'No se ha configurado la conexión SSH', isError: true });
            return;
        }

        ssh.on('ready', () => {
            console.log('Conexión SSH establecida');

            const { command, args } = commandData;
            const fullCommand = `${command} ${args.join(' ')}`;
            console.log('Comando recibido:', fullCommand);

            ssh.exec(fullCommand, (err, stream) => {
                if (err) {
                    socket.emit('output', { message: `Error al ejecutar el comando: ${err.message}`, isError: true });
                    return;
                }

                let output = '';
                let errorOutput = '';

                stream.on('data', (data) => {
                    output += data.toString('utf8');
                });

                stream.stderr.on('data', (data) => {
                    errorOutput += data.toString('utf8');
                });

                stream.on('close', () => {
                    if (errorOutput) {
                        socket.emit('output', { message: errorOutput, isError: true });
                    } else {
                        socket.emit('output', { message: output, isError: false });
                    }
                    console.log(output); // Muestra la salida en el servidor
                });
            });
        });

        // Conectar al servidor SSH con la configuración actualizada
        ssh.connect(sshConfig);
    });

    socket.on('disconnect', () => {
        console.log('Cliente desconectado');
        ssh.end();
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});
