'use strict';

const mysql = require('mysql');
const config = require('./../config');
const logger = require('./../utils/logger');
const _ = require('underscore');
const lattisErrors = require('./../errors/lattis-errors');
const async = require('async');


module.exports = {
    _usersPool: null,
    _mainPool: null,

    initUsersPool: function(shouldUseDatabase) {
        if (this._usersPool) {
            return;
        }

        if (shouldUseDatabase) {
            this._usersPool = mysql.createPool({
                host: config.databaseInfo.users.host,
                user: config.databaseInfo.users.userName,
                password: config.databaseInfo.users.password,
                database: config.databaseInfo.users.databaseName,
                port: config.databaseInfo.users.port
            });
        } else {
            this._usersPool = mysql.createPool({
                host: config.databaseInfo.users.host,
                user: config.databaseInfo.users.userName,
                password: config.databaseInfo.users.password,
                port: config.databaseInfo.users.port
            });
        }

        logger('sql pool created users pool');
    },

    initMainPool: function(shouldUseDatabase) {
        if (this._mainPool) {
            return;
        }

        if (shouldUseDatabase) {
            this._mainPool = mysql.createPool({
                host: config.databaseInfo.main.host,
                user: config.databaseInfo.main.userName,
                password: config.databaseInfo.main.password,
                database: config.databaseInfo.main.databaseName,
                port: config.databaseInfo.main.port
            });
        } else {
            this._mainPool = mysql.createPool({
                host: config.databaseInfo.main.host,
                user: config.databaseInfo.main.userName,
                password: config.databaseInfo.main.password,
                port: config.databaseInfo.main.port
            });
        }

        logger('sql pool created main pool');
    },

    initPools: function(shouldUseDatabase) {
        this.initUsersPool(shouldUseDatabase);
        this.initMainPool(shouldUseDatabase);
        logger('sql-pool has initialized its pools');
    },

    _getUsersPool: function() {
        if (!this._usersPool) {
            this.initUsersPool(true);
        }

        return this._usersPool;
    },

    _getMainPool: function() {
        if (!this._mainPool) {
            this.initMainPool(true);
        }

        return this._mainPool;
    },


    /**
     * This method makes a query against the given database.
     * 
     * @param {object} queryInfo - key is the database and the value is the query.
     *      Also contains join value if the query spans multiple databases.
     * @param {function} callback
     */
    makeQuery: function(queryInfo, callback) {
        if(_.has(queryInfo, config.databaseInfo.users.databaseName) &&
            _.has(queryInfo, config.databaseInfo.main.databaseName)
        )  {
            let resultData = {};
            const usersFunction = function(completion) {
                this._makeQuery(
                    config.databaseInfo.users.databaseName,
                    queryInfo[config.databaseInfo.users.databaseName],
                    function(error, data) {
                        if (error) {
                            logger('Error: making async users query');
                            completion(error, null);
                            return;
                        }

                        resultData[config.databaseInfo.users.databaseName] = data;
                        completion(null, data);
                    });
            }.bind(this);

            const mainFunction = function(completion) {
                this._makeQuery(
                    config.databaseInfo.main.databaseName,
                    queryInfo[config.databaseInfo.main.databaseName],
                    function(error, data) {
                        if (error) {
                            logger('Error: making async main query');
                            completion(error, null);
                            return;
                        }

                        resultData[config.databaseInfo.main.databaseName] = data;
                        completion(null, data);
                    }
                );
            }.bind(this);

            async.parallel(
                [
                    usersFunction,
                    mainFunction
                ], function(error, results) {
                    if (error) {
                        logger(
                            'Error making two database query. Failed with error:',
                            lattisErrors.errorWithMessage(error)
                        );
                        callback(error, null);
                        return;
                    }

                    if (_.has(queryInfo, 'join') &&
                        _.has(queryInfo, 'primaryDatabase') &&
                        _.has(queryInfo, 'secondaryDatabase') &&
                        _.has(resultData, queryInfo.primaryDatabase) &&
                        _.has(resultData, queryInfo.secondaryDatabase)
                    ) {
                        // FIXME: Since the `_performJoin` method only accepts two parameters currently,
                        // we have to split the results array here. There is probably a more elegant
                        // way of doing this. This should be explored when there is more time.
                        const joinedData = this._performJoin(
                            queryInfo.join,
                            resultData[queryInfo.primaryDatabase],
                            resultData[queryInfo.secondaryDatabase]
                        );

                        callback(null, joinedData);
                        return;
                    }

                    callback(null, results);
                }.bind(this)
            );
        } else if (_.has(queryInfo, config.databaseInfo.users.databaseName)) {
            this._makeQuery(
                config.databaseInfo.users.databaseName,
                queryInfo[config.databaseInfo.users.databaseName],
                function(error, data) {
                    if (error) {
                        logger('Error: making async users query');
                        callback(error, null);
                        return;
                    }

                    callback(null, data);
                });
        } else if (_.has(queryInfo, config.databaseInfo.main.databaseName)) {
            this._makeQuery(
                config.databaseInfo.main.databaseName,
                queryInfo[config.databaseInfo.main.databaseName],
                function(error, data) {
                    if (error) {
                        logger('Error: making async main query');
                        callback(error, null);
                        return;
                    }

                    callback(null, data);
                }
            );
        }
    },

    _makeQuery: function(database, query, callback) {
        let pool;
        if (database === config.databaseInfo.main.databaseName) {
            pool = this._getMainPool();
        } else if (database === config.databaseInfo.users.databaseName) {
            pool = this._getUsersPool();
        }

        if (!pool) {
            logger('Error: database name was not passed into sql pool query.');
            callback(lattisErrors.incorrectDatabase(false), null);
            return;
        }

        pool.getConnection(function(error, connection) {
            if (error) {
                logger('Error: got error for query:', query, 'error:', error);
                if (connection) {
                    connection.release();
                }

                callback(error, null);
                return;
            }

            connection.query(query, function(error, rows) {
                if (error) {
                    logger('Error making query:', query, 'Error:',  lattisErrors.errorWithMessage(error));
                }

                if (connection) {
                    connection.release();
                }

                callback(error, rows);
            });
        });
    },

    destroyPools: function(callback) {
        this.destroyMainPool(function(error) {
            if (error) {
                callback(error);
                return;
            }

            this.destroyUsersPool(callback);
        }.bind(this));
    },

    destroyUsersPool: function(callback) {
        if (!this._usersPool) {
            callback(null);
            return;
        }

        this._usersPool.end(function(error) {
            if (error) {
                callback(error);
                return;
            }

            logger('sql-pool has destroyed the users pool');
            this._usersPool = null;
            callback(null);
        }.bind(this));
    },

    destroyMainPool: function(callback) {
        if (!this._mainPool) {
            callback(null);
            return;
        }

        this._mainPool.end(function(error) {
            if (error) {
                callback(error);
                return;
            }

            logger('sql-pool has destroyed the main pool');
            this._mainPool = null;
            callback(null);
        }.bind(this));
    },

    _performJoin: function(joinOnValue, results1, results2) {
        // FIXME: This method should not rely on the two result parameters. It should accept an
        // array of parameters and be smart enough to perform a join on all of them. This is
        // something that should be added in the future.
        if (results1.length === 0 || results2.length === 0) {
            return results1;
        }

        let joinedResults = [];
        _.each(results1, function(result1) {
            _.each(results2, function(result2) {
                if (result1[joinOnValue] === result2[joinOnValue]) {
                    joinedResults.push(_.extend(result1, result2));
                }
            });
        });

        return joinedResults;
    }
};
