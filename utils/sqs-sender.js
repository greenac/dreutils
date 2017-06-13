'use strict';

const SQSHandler = require('./../handlers/sqs-handler');
const logger = require('./logger');
const _ = require('underscore');
const FifoQueue = require('./fifo-queue');


class SQSSender {
    /**
     * This is the initializer for an sqs sender instance.
     *
     * @param {string} queueUrl
     * @param {string} type
     * @param {string} idName
     * @param {Array} properties
     * @param {number} delay
     */
    constructor(queueUrl, type, idName, properties, delay=2000) {
        this._queueUrl = queueUrl;
        this._type = type;
        this._idName = idName;
        this._properties = properties;
        this._delay = delay;
        this._sqsHandler = new SQSHandler(queueUrl);
        this._numberOfMessagesToSend = 10;
        this._stagedObjects = [];
        this._timer = null;
        this._callback = null;
        this._queue = new FifoQueue();
        this._enQueuedMessageIds = new Set();
        this._sentMessages = {};
    };

    /**
     * This method starts the sqs sender.
     *
     * @param {function} callback
     */
    start(callback) {
        this._callback = callback;
        this._timer = setInterval(this._sendMessages.bind(this), this._delay);
    };

    /**
     * This method ceases the sending of objects to sqs.
     */
    stopSending() {
        clearInterval(this._timer);
    };

    /**
     * This method adds objects to send to sqs.
     *
     * @param {Array} objects
     */
    addObjects(objects) {
        objects.forEach((object) => {
            const identifier = this._identifier(object);
            if (!_.has(this._sentMessages, identifier) && !this._enQueuedMessageIds.has(identifier)) {
                if (!_.has(object, 'type')) {
                    object.type = this._type;
                }

                this._stagedObjects.push(object);
            }
        });
    };

    /**
     * This method handles the sending of messages to sqs.
     *
     * @private
     */
    _sendMessages() {
        let counter = 0;
        for (let i=0; i < this._stagedObjects.length; i++) {
            const identifier = this._identifier(this._stagedObjects[i]);
            if (_.has(this._sentMessages, identifier)) {
                continue;
            }

            if (!this._enQueuedMessageIds.has(identifier)) {
                this._enQueuedMessageIds.add(identifier);
                this._queue.enqueue(this._stagedObjects[i]);
                counter += 1;
            }
        }

        if (counter !== 0) {
            logger(
                'sqs sender adding:',
                counter,
                'objects to queue. There are:',
                this._queue.count(),
                'enqueued objects'
            );
        }

        const queuedObjects = this._queue.deQueueMultiple(this._numberOfMessagesToSend);
        if (queuedObjects.length === 0) {
            return;
        }

        this._sqsHandler.sendBatchMessages(
            this._messages(queuedObjects),
            this._identifiers(queuedObjects),
            (error, returnedData) => {
                if (_.has(returnedData, 'Successful') && _.has(returnedData, 'Failed')) {
                    returnedData.Successful.forEach((successfulMessage) => {
                        delete this._sentMessages[successfulMessage.Id];
                    });

                    returnedData.Failed.forEach((failedMessage) => {
                        logger('failed to send message to sqs:', failedMessage);
                        if (_.has(this._sentMessages, failedMessage.Id)) {
                            this._queue.enqueue(this._sentMessages[failedMessage.Id]);
                            delete this._sentMessages[failedMessage.Id];
                        }
                    });

                    if (this._callback) {
                        this._callback(returnedData.Successful, returnedData.Failed);
                    }
                }
            }
        );
    };

    /**
     * This method creates an array of unique identifiers for a group of messages.
     *
     * @param {Array} objects
     * @returns {Array}
     * @private
     */
    _identifiers(objects) {
        let identifiers = [];
        objects.forEach((object) => {
            const identifier = this._identifier(object);
            identifiers.push(identifier);
            this._sentMessages[identifier] = object;
        });

        return identifiers;
    };

    /**
     * This method creates the messages that will be sent to sqs.
     *
     * @param {Array} objects
     * @returns {Array}
     * @private
     */
    _messages(objects) {
        let messages = [];
        objects.forEach((object) => {
            let formattedObject = {};
            this._properties.forEach((property) => {
                formattedObject[property] = object[property];
            });

            messages.push(formattedObject);
        });

        return messages;
    };

    /**
     * This method creates a unique identifier for a given object.
     *
     * @param {object} object
     * @returns {string}
     * @private
     */
    _identifier(object) {
        return this._type + '-' + object[this._idName];
    };
}

module.exports = SQSSender;
