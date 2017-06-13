'use strict';

const SQSHandler = require('./../handlers/sqs-handler');
const logger = require('./logger');
const _ = require('underscore');


class SQSPoller {
    /**
     * This method is the initializer for the SQSPoller class.
     *
     * @param {string} queueUrl
     * @param {number} delay
     * @param {boolean} shouldDeleteMessages
     */
    constructor(queueUrl, delay=5000, shouldDeleteMessages=true) {
        this._queueUrl = queueUrl;
        this._sqsHandler = new SQSHandler(queueUrl);
        this._delay = delay;
        this._shouldDeleteMessages = shouldDeleteMessages;
        this._timer = null;
        this._deleteTimer = null;
        this._callback = null;
        this._retrievedMessages = new Set();
        this._messagesToDelete = {};
    };

    /**
     * This method starts the polling of the object.
     *
     * @param {function} callback
     */
    poll(callback) {
        this._callback = callback;
        this._timer = setInterval(this._checkSQS.bind(this), this._delay);
        if (this._shouldDeleteMessages) {
            this._deleteTimer = setInterval(this._deleteMessages.bind(this), this._delay);
        }
    };

    /**
     * Stops the polling object from polling.
     */
    stopPolling() {
        clearInterval(this._timer);
        if (this._shouldDeleteMessages) {
            clearInterval(this._deleteTimer);
        }
    };

    addMessagesToDelete(messages) {
        messages.forEach((message) => {
            if (!_.has(this._messagesToDelete, message.MessageId)) {
                this._messagesToDelete[message.MessageId] = {
                    originalMessage: message,
                    formattedMessage: {
                        Id: message.MessageId,
                        ReceiptHandle: message.ReceiptHandle
                    }
                };
            }
        });
    };

    _checkSQS() {
        this._sqsHandler.getMessages((error, messages) => {
            if (error) {
                logger('Error: failed to check sqs messages with error:', error);
                return;
            }

            messages = Array.isArray(messages) ? messages : messages.Messages;
            let newMessages = [];
            _.each(messages, (message) => {
                  if (!this._retrievedMessages.has(message.MessageId)) {
                      this._retrievedMessages.add(message.MessageId);
                      newMessages.push(SQSPoller._parseMessage(message));
                  } else if (this._shouldDeleteMessages && !_.has(this._messagesToDelete, message.MessageId)) {
                      this._messagesToDelete[message.MessageId] = {
                          originalMessage: message,
                          formattedMessage: {
                              Id: message.MessageId,
                              ReceiptHandle: message.ReceiptHandle
                          }
                      };
                  }
            });

            if (newMessages.length > 0) {
                this._callback(newMessages);
            }
        });
    };

    _deleteMessages() {
        const messages = _.values(this._messagesToDelete).map((value) => {
            return value.formattedMessage;
        });

        if (messages.length === 0) {
            return;
        }

        this._sqsHandler.deleteMessages(messages, (error, successfullyDeletedMessages) => {
            if (error) {
                logger('Error: Failed to delete messages with error:', error);
                return;
            }

            successfullyDeletedMessages.forEach((messageId) => {
                if (_.has(this._messagesToDelete, messageId)) {
                    delete this._messagesToDelete[messageId];
                }
            });
        });
    };

    /**
     * This method formats a messages object coming back from SQS.
     *
     * @param {object} message
     * @returns {object}
     * @static
     * @private
     */
    static _parseMessage(message) {
        message.Body = JSON.parse(message.Body);
        return message;
    };
}

module.exports = SQSPoller;
