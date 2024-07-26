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
let ssh = new Client(); // Mover la instancia de Client fuera del callback de la conexión
let isConnected = false;

// Ruta para recibir las credenciales SSH del frontend
app.post('/set-ssh-config', (req, res) => {
    sshConfig = req.body;
    console.log('Configuración SSH actualizada:', sshConfig);
    res.sendStatus(200);

    // Intentar conectar al servidor SSH con la configuración actualizada
    if (isConnected) {
        ssh.end();
    }

    ssh.connect(sshConfig);
});

ssh.on('ready', () => {
    console.log('Conexión SSH establecida');
    isConnected = true;
});

ssh.on('error', (err) => {
    console.error('Error de conexión SSH:', err.message);
    isConnected = false;
});

ssh.on('end', () => {
    console.log('Conexión SSH finalizada');
    isConnected = false;
});

ssh.on('close', () => {
    console.log('Conexión SSH cerrada');
    isConnected = false;
});

io.on('connection', (socket) => {
    console.log('Cliente conectado');

    socket.on('command', (commandData) => {
        if (!sshConfig.host) {
            socket.emit('output', { message: 'No se ha configurado la conexión SSH', isError: true });
            return;
        }

        if (!isConnected) {
            socket.emit('output', { message: 'Conexión SSH no establecida', isError: true });
            return;
        }

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

    socket.on('disconnect', () => {
        console.log('Cliente desconectado');
        if (isConnected) {
            ssh.end();
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});
