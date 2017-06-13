'use strict';

const SQSPoller = require('./../utils/sqs-poller');
const sqsConstants = require('./../constants/sqs-constants');
const logger = require('./../utils/logger');
const queryFormatter = require('./../db/query-formatter');
const queryCreator = require('./../db/query-creator');
const dbConstants = require('./../constants/db-constants');
const sqlPool = require('./../db/sql-pool');
const errors = require('./../errors/lattis-errors');


class NotificationHandler {
    /**
     * This is the initializer for a notification handler object.
     */
    constructor() {
        this._poller = new SQSPoller(sqsConstants.lucy.queues.write, 2000, true);
        this._pollingFinishedCallback = null;
    };

    /**
     * This method starts polling sqs and receiving notifications.
     *
     * @param {function} pollingFinishedCallback
     */
    start(pollingFinishedCallback) {
        this._pollingFinishedCallback = pollingFinishedCallback;
        this._poller.poll((messages) => {
            let notifications = [];
            messages.forEach((message) => {
                notifications.push({
                    operator_id: message.Body.operator_id,
                    customer_id: message.Body.customer_id || null,
                    user_id: message.Body.user_id || null,
                    type: message.Body.type,
                    type_id: message.Body.type_id,
                    date: message.Body.date,
                    rank: message.Body.rank
                });
            });

            const columnsAndValues = queryFormatter.formatObjectsForMultipleQuery(notifications);
            let query = queryCreator.insertMultiple(
                dbConstants.tables.notifications,
                columnsAndValues.columns,
                columnsAndValues.values
            );
            sqlPool.makeQuery(query, (error, insertInfo) => {
                if (error) {
                    logger(
                        'Error: could not insert notifications. Failed with error:',
                        errors.errorWithMessage(error)
                    );
                    return;
                }

                let values = [];
                let columns = [];
                for (let i=insertInfo.insertId; i < insertInfo.insertId + insertInfo.affectedRows; i++) {
                    values.push(i);
                    columns.push('notification_id');
                }

                query = queryCreator.selectWithOr(dbConstants.tables.notifications, null, columns, values);
                sqlPool.makeQuery(query, (error, notifications) => {
                    if (error) {
                        logger(
                            'Error: could not retrieve saved notifications.',
                            errors.errorWithMessage(error)
                        );
                        return;
                    }

                    if (!!this._pollingFinishedCallback) {
                        this._pollingFinishedCallback(notifications);
                    }
                });

                this._poller.addMessagesToDelete(messages);
            });
        });
    };
}

module.exports = NotificationHandler;
