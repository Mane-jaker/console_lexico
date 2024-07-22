import { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import axios from 'axios'; // Asegúrate de instalar axios

const TerminalComponent = () => {
    const [socket, setSocket] = useState(null);
    const [inputValue, setInputValue] = useState('');
    const [output, setOutput] = useState([]);
    const [lexicalAnalysis, setLexicalAnalysis] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(true); // Modal abierto por defecto
    const [sshConfig, setSshConfig] = useState({
        host: '',
        port: '',
        username: '',
        password: ''
    });

    useEffect(() => {
        // Conectar al servidor Socket.IO
        const socketInstance = io('http://localhost:3000');
        setSocket(socketInstance);

        socketInstance.on('connect', () => {
            console.log('Conectado al servidor Socket.IO');
        });

        socketInstance.on('disconnect', () => {
            console.log('Desconectado del servidor Socket.IO');
        });

        socketInstance.on('output', (data) => {
            const { message, isError } = data;
            setOutput((prevOutput) => [...prevOutput, message]);
            analyzeLexically(inputValue, isError, message);
        });

        return () => {
            socketInstance.disconnect();
        };
    }, []); // Dependencia vacía para ejecutar una sola vez

    const comandoTraducido = {
        listar: 'ls',
        crearDirectorio: 'mkdir',
        eliminar: 'rm',
        mover: 'mv',
        copiar: 'cp',
        cambiarDirectorio: 'cd',
        mostrarDirectorioActual: 'pwd',
        verContenidoArchivo: 'cat',
        cambiarPermisos: 'chmod',
        verEspacioDisco: 'df',
        verConsumoRecursos: 'top',
        listarProcesos: 'ps',
        verHistorialComandos: 'history',
        eliminarDirectorio: 'rm -r'
    };

    const parseCommand = useCallback((input) => {
        const tokens = input.trim().split(' ');
        const command = tokens[0];
        const args = tokens.slice(1);
        return { command, args };
    }, []);

    const sendCommand = useCallback(() => {
        if (socket && inputValue.trim() !== '') {
            const { command, args } = parseCommand(inputValue.trim());
            const translatedCommand = comandoTraducido[command] || command;
            socket.emit('command', { command: translatedCommand, args });
            analyzeLexically(inputValue, false);
            setInputValue('');
        }
    }, [inputValue, socket, parseCommand]);

    const analyzeLexically = (input, isError, message) => {
        const tokens = input.trim().split(' ');
        const command = tokens[0];
        const args = tokens.slice(1);
        const reservedWords = Object.keys(comandoTraducido);
        let analysisResult = [];

        if (isError) {
            analysisResult.push({ input: message, type: 'Error', error: true });
        } else {
            if (reservedWords.includes(command)) {
                analysisResult.push({ input: command, type: 'Palabra reservada', error: false });
            } else {
                analysisResult.push({ input: command, type: 'Palabra no reservada', error: false });
            }

            args.forEach(arg => {
                analysisResult.push({ input: arg, type: 'Identificador', error: false });
            });
        }

        setLexicalAnalysis(prevAnalysis => [...prevAnalysis, ...analysisResult]);
    };

    const handleModalSubmit = async () => {
        try {
            await axios.post('http://localhost:3000/set-ssh-config', sshConfig);
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error al enviar la configuración SSH:', error);
        }
    };

    return (
        <div className="flex flex-col h-screen">
            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg">
                        <h2 className="text-lg font-bold mb-4">Configuración SSH</h2>
                        <div className="mb-4">
                            <label className="block text-gray-700">Host</label>
                            <input
                                type="text"
                                className="w-full p-2 border border-gray-300 rounded"
                                value={sshConfig.host}
                                onChange={(e) => setSshConfig({ ...sshConfig, host: e.target.value })}
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-gray-700">Puerto</label>
                            <input
                                type="text"
                                className="w-full p-2 border border-gray-300 rounded"
                                value={sshConfig.port}
                                onChange={(e) => setSshConfig({ ...sshConfig, port: e.target.value })}
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-gray-700">Usuario</label>
                            <input
                                type="text"
                                className="w-full p-2 border border-gray-300 rounded"
                                value={sshConfig.username}
                                onChange={(e) => setSshConfig({ ...sshConfig, username: e.target.value })}
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-gray-700">Contraseña</label>
                            <input
                                type="password"
                                className="w-full p-2 border border-gray-300 rounded"
                                value={sshConfig.password}
                                onChange={(e) => setSshConfig({ ...sshConfig, password: e.target.value })}
                            />
                        </div>
                        <button
                            className="px-4 py-2 bg-blue-500 text-white rounded"
                            onClick={handleModalSubmit}
                        >
                            Enviar
                        </button>
                    </div>
                </div>
            )}
            
            <div className="flex-1 flex">
                <div className="w-1/4 p-4 bg-gray-800 text-white">
                    <h2 className="text-lg font-bold mb-4">Comandos personalizados</h2>
                    <ul>
                        {Object.entries(comandoTraducido).map(([comando, traduccion]) => (
                            <li key={comando} className="mb-2">
                                <strong>{comando}:</strong> {traduccion}
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="flex-1 flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto p-4 bg-black text-white">
                        <textarea
                            className="w-full h-full bg-black text-white border-0 focus:outline-none resize-none"
                            value={output.join('\n')}
                            readOnly
                        />
                    </div>
                    <div className="input-container p-4 bg-black flex">
                        <input
                            type="text"
                            className="flex-1 px-2 py-1 bg-black text-white rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500"
                            placeholder="Escribe un comando..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    sendCommand();
                                }
                            }}
                        />
                        <button
                            className="ml-2 px-4 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none"
                            onClick={sendCommand}
                        >
                            Enviar
                        </button>
                    </div>
                </div>
            </div>
            <div className="lexical-analysis-container p-4 bg-gray-100">
                <h2 className="text-lg font-bold mb-4">Análisis léxico</h2>
                <table className="min-w-full bg-white">
                    <thead>
                        <tr>
                            <th className="py-2">Comando</th>
                            <th className="py-2">Palabra reservada</th>
                            <th className="py-2">Identificador</th>
                            <th className="py-2">Error</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lexicalAnalysis.map((item, index) => (
                            <tr key={index}>
                                <td className="border px-4 py-2">{item.input}</td>
                                <td className="border px-4 py-2">
                                    {item.type === 'Palabra reservada' ? item.input : '-'}
                                </td>
                                <td className="border px-4 py-2">
                                    {item.type === 'Identificador' ? item.input : '-'}
                                </td>
                                <td className="border px-4 py-2">
                                    {item.type === 'Error' ? '❌' : '✔️'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TerminalComponent;
