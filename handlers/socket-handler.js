'use strict';

const _ = require('underscore');
const socketConstants = require('./../constants/socket-constants');
const LattisException = require('./../errors/lattis-exceptions');
const logger = require('./../utils/logger');


class SocketHandler {
    /**
     * This method initializes a socket handler instance.
     *
     * @param {object} socketServer
     * @param {string} typeId - The type of client this handler will connect to.
     *      i.e. `operator_id`, `user_id`.
     */
    constructor(socketServer, typeId) {
        this._socketServer = socketServer;
        this._clients = {};
        this._typeId = typeId;
    };

    /**
     * This method should be run after initializing a socket handler.
     */
    setup() {
        logger('setting up socket handler');
        this._socketServer.on(socketConstants.socketConnected, (socket) => {
            logger('socket handler got connection');
            socket.on(socketConstants.clientSignedIn, (clientInfo) => {
                logger('got event:', socketConstants.clientSignedIn);
                this._clientConnected(socket, clientInfo);
            });

            socket.on(socketConstants.socketDisconnected, () => {
                this._clientDisconnected(socket.id);
            });

            this.setupSocketServerHooks(socket);
        });
    };

    /**
     * This method should be overridden in the child classes.
     * Any additional events should be added in this method.
     *
     * @param {object} socket
     */
    setupSocketServerHooks(socket) {
        throw LattisException('OverrideBaseClass', 'setupSocketServerHooks should be overriden in child');
    };

    /**
     * This method saves saves the client info for future reference.
     *
     * @param {object} socket
     * @param {object} clientInfo
     * @private
     */
    _clientConnected(socket, clientInfo) {
        this._clients[clientInfo[this._typeId]] = socket;
    };

    /**
     * This method removes a client when they have been disconnected.
     *
     * @param {string} socketId
     * @private
     */
    _clientDisconnected(socketId) {
        const keys = _.keys(this._clients);
        let targetKey;
        for (let i=0; i < keys.length; i++) {
            if (this._clients[keys[i]].id === socketId) {
                targetKey = key;
                break;
            }
        }

        if (targetKey) {
            delete this._clients[targetKey];
        }
    };
}

module.exports = SocketHandler;
