'use strict';

const config = require('./../config');
const awsHandler = require('./aws-handler');
const logger = require('./../utils/logger');
const _ = require('underscore');
const moment = require('moment');
const lattisErrors = require('./../errors/lattis-errors');
const async = require('async');


class SQSHandler {
    /**
     * This is the initializer method for the SQSHandler class.
     *
     * @param {string} queueUrl
     */
    constructor(queueUrl) {
        this._queueUrl = queueUrl;
        this._sqs = awsHandler.sqs();
        this._numberOfMessages = 10;
        this._numberOfMessagesToDelete = 10;
        this._messagesToDelete = {};
    };

    /**
     * This method gets messages from the queue.
     *
     * @param {function} callback
     */
    getMessages(callback) {
        const params  = {
            AttributeNames: ['All'],
            MaxNumberOfMessages: this._numberOfMessages,
            MessageAttributeNames: ['All'],
            QueueUrl: this._queueUrl
        };

        this._sqs.receiveMessage(params, (error, messages) => {
            if (error) {
                logger('Error: failed to get messages from queue:', this._queueUrl, 'Error:', error);
                callback(lattisErrors.internalServer(false), null);
                return;
            }

            callback(null, messages);
        });
    };

    /**
     * This messages sends a messages to be put onto the queue.
     *
     * @param {object} messageObject
     * @param {function} callback
     */
    sendMessage(messageObject, callback) {
        let messageBody;
        try {
            messageBody = JSON.stringify(messageObject);
        } catch (error) {
            logger('Error could not send sqs message:', messageObject, 'failed to encode json.', error);
            callback(lattisErrors.internalServer(false), null);
            return;
        }

        const params = {
            MessageBody: messageBody,
            QueueUrl: this._queueUrl
        };

        this._sqs.sendMessage(params, (error, data) => {
            if (error) {
                logger(
                    'Error: Failed to send message:',
                    messageObject,
                    'to queue:',
                    this._queueUrl,
                    'error:',
                    error
                );
                callback(lattisErrors.internalServer(false), null);
                return;
            }

            callback(null, data);
        });
    };

    /**
     * This method sends batch messages to be put into the queue.
     *
     * @param {Array} messageObjects
     * @param {Array} identifiers
     * @param {function} callback
     */
    sendBatchMessages(messageObjects, identifiers, callback) {
        if (messageObjects.length !== identifiers.length) {
            throw new Error('message objects must be same length as identifiers');
        }

        let formattedMessages = [];
        _.each(messageObjects, (messageObject, index) => {
            try {
                formattedMessages.push({
                    MessageBody: JSON.stringify(messageObject),
                    Id: identifiers[index]
                });
            } catch(error) {
                logger('Error: failed to send encode a message while batch sending to sqs:', error);
            }
        });

        const params = {
            Entries: formattedMessages,
            QueueUrl: this._queueUrl
        };

        this._sqs.sendMessageBatch(params, (error, data) => {
            if (error) {
                logger('Error: Failed to send batch messages to queue:', this._queueUrl, 'error:', error);
                callback(lattisErrors.internalServer(false), null);
                return;
            }

            callback(null, data);
        });
    };

    /**
     * This method adds message objects to be deleted.
     *
     * @param {Array} messages
     * @private
     */
    _addMessagesToDelete(messages) {
        _.each(messages, (message) => {
            let identifier;
            if (_.has(message, 'MessageId')) {
                identifier = 'MessageId';
            } else if (_.has(message, 'Id')) {
                identifier = 'Id';
            } else {
                logger('Error: no known identifier in message:', message);
            }

            if (!!identifier && !_.has(this._messagesToDelete, message[identifier])) {
                this._messagesToDelete[message[identifier]] = {
                    Id: message[identifier],
                    ReceiptHandle: message.ReceiptHandle
                };
            }
        });
    };

    /**
     * This method deletes the messages passed in from the queue.
     *
     * @param {Array} messagesToDelete
     * @param {function} callback
     */
    deleteMessages(messagesToDelete, callback) {
        this._addMessagesToDelete(messagesToDelete);
        let asyncFunctions = [];
        let index = 0;
        let successfullyDeleted = [];
        const messages = _.values(this._messagesToDelete);
        if (messages.length === 0) {
            callback();
            return;
        }

        while (index < messages.length) {
            const subMessages = messages.slice(
                index,
                messages.length - index < this._numberOfMessagesToDelete
                    ? messages.length - index : index + this._numberOfMessagesToDelete
            );

            const params = {
                Entries: subMessages,
                QueueUrl: this._queueUrl
            };

            const deleteMessage = (callback) => {
                this._sqs.deleteMessageBatch(params, (error, result) => {
                    if (error) {
                        logger('Error: sqs could not delete messages. Failed with error:', error);
                        callback();
                        return;
                    }

                    if (_.has(result, 'Successful')) {
                        _.each(result.Successful, (successfulResult) => {
                            successfullyDeleted.push(successfulResult.Id);
                            if (_.has(this._messagesToDelete, successfulResult.Id)) {
                                delete this._messagesToDelete[successfulResult.Id];
                            }
                        });
                    }

                    callback();
                });
            };

            asyncFunctions.push(deleteMessage);
            index += this._numberOfMessagesToDelete;
        }

        async.series(asyncFunctions, (error) => {
            if (error) {
                logger('Error: failed to delete messages from:', this._queueUrl, 'with error:', error);
                callback(lattisErrors.internalServer(false), null);
                return;
            }

            this._messagesToDelete = _.omit(this._messagesToDelete, successfullyDeleted);
            callback(null, successfullyDeleted);
        });
    };
}

module.exports = SQSHandler;
