'use strict';

const async = require('async');
const config = require('./../config');
const sqlPool = require('./../db/sql-pool');
const path = require('path');
const _ = require('underscore');
const fs = require('fs');
const jsonFile = require('jsonfile');
const passwordHandler = require('./../handlers/password-handler');
const queryFormatter = require('./../db/query-formatter');
const queryCreator = require('./../db/query-creator');
const logger = require('./logger');
const ellipseUserModel = require('./../models/ellipse-users');
const lattisAccounts = require('./../models/lattis-accounts');
const operatorModel = require('./../models/operators');
const customerModel = require('./../models/customers');
const lockModel = require('./../models/locks');
const tripModel = require('./../models/trips');
const bikeModel = require('./../models/bikes');
const bookingModel = require('./../models/booking');
const fleetModel = require('./../models/fleets');
const maintenanceModel = require('./../models/maintenance');
const crashesModel = require('./../models/crashes');
const theftsModel = require('./../models/thefts');
const metadataModel = require('./../models/metadata');
const shareModel = require('./../models/share');
const pinCodesModel = require('./../models/pin-codes');
const deletedUsers = require('./../models/deleted-users');
const addressesModel = require('./../models/addresses');
const confirmationCodesModel = require('./../models/confirmation-codes');
const notifications = require('./../models/notifications');
const parkingSpots = require('./../models/parking-spots');
const parkingAreas = require('./../models/parking-areas');
const fleetAssociations = require('./../models/fleet-associations');
const deletedBikes = require('./../models/deleted-bikes');
const deletedOperators = require('./../models/deleted-operators');
const moment = require('moment');
const pointHandler = require('./../handlers/point-handler');
const mapBoxHandler = require('./../handlers/mapbox-handler');
const dbConstants = require('./../constants/db-constants');


// utility functions
const randomByteString = function(numberOfBytes) {
    const map = [
        '0',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        'a',
        'b',
        'c',
        'd',
        'e',
        'f'
    ];

    let byteString = '';
    for (let i = 0; i < 2 * numberOfBytes; i++) {
        let target = Math.floor(Math.random() * (map.length - 1));
        byteString += map[target];
    }

    return byteString;
};

const getErrorMessage = function(error) {
    return _.has(error, 'message') ? error.message : '';
};

const randomPastDate = function() {
    return Math.floor(moment().unix() - 7000000 * Math.random());
};

const getRandomObjectFromArray = function(arrayOfObjects) {
    if (arrayOfObjects.length === 0) {
        return null;
    }
    return _.sample(arrayOfObjects);
};

class DatabaseCreator {
    constructor() {
        this._rawLocks = jsonFile.readFileSync(path.join(__dirname, '../files/demo_data/locks.json'));
        this._rawUsers = jsonFile.readFileSync(path.join(__dirname, '../files/demo_data/users.json'));
        this._rawOperators = jsonFile.readFileSync(path.join(__dirname, '../files/demo_data/operators.json'));
        this._rawOperatorAddresses = jsonFile.readFileSync(path.join(__dirname, '../files/demo_data/operator-addresses.json'));
        this._rawCustomers = jsonFile.readFileSync(path.join(__dirname, '../files/demo_data/customers.json'));
        this._rawCustomerAddresses = jsonFile.readFileSync(path.join(__dirname, '../files/demo_data/customer-addresses.json'));
        this._rawMetadata = jsonFile.readFileSync(path.join(__dirname, '../files/demo_data/metadata.json'));
        this._rawParkingSpots = jsonFile.readFileSync(path.join(__dirname, '../files/demo_data/parking-spots.json'));
        this._parkingAnchors = jsonFile.readFileSync(path.join(__dirname, '../files/demo_data/parking-anchors.json'));
        this._users = [];
        this._operators = [];
        this._customers = [];
        this._locks = [];
        this._bikes = [];
        this._fleets = [];
        this._maintenance = [];
        this._trips = [];
        this._users = [];
        this._crashes = [];
        this._thefts = [];
        this._parkingAreas = [];
        this._parkingSpots = [];
        this._numberOfTrips = 300;
        this._numberOfLocks = 300;
        this._numberOfThefts = 1000;
        this._numberOfCrashes = 1000;
        this._batchSize = 5;
        this._counter = 0;
        this._minNumberOfFleetsForOperator = 2;
        this._numberOfParkingAreas = 250;
        this._numberOfParkingSpots = 700;
        this._useDummyData = false;
        this._maxLocks = 3;
    }

    run(shouldUseDummyData=false) {
        this._useDummyData = shouldUseDummyData;
        //To get server data back to reuse
        if (shouldUseDummyData) {
            const requiredParams = [
                'LATTIS_USERS_SERVER_DB_USERNAME',
                'LATTIS_USERS_SERVER_DB_PASSWORD',
                'LATTIS_USERS_SERVER_DB_NAME',
                'LATTIS_USERS_SERVER_DB_HOST',
                'LATTIS_USERS_SERVER_DB_PORT',
                'LATTIS_MAIN_SERVER_DB_USERNAME',
                'LATTIS_MAIN_SERVER_DB_PASSWORD',
                'LATTIS_MAIN_SERVER_DB_NAME',
                'LATTIS_MAIN_SERVER_DB_HOST',
                'LATTIS_MAIN_SERVER_DB_PORT'
            ];

            for (let i = 0; i < requiredParams.length; i++) {
                if (!_.has(process.env, requiredParams[i])) {
                    console.log(
                        'Error: environment variables have not been properly setup for the Lattis Platform database creator. The variable:',
                        requiredParams[i],
                        'was not found.'
                    );

                    throw new Error('Lattis Platform Environment Variables Not Properly Set');
                }
            }
        }

        let asyncFunctions = [
            this._deleteUsersDatabase.bind(this),
            this._deleteMainDatabase.bind(this),
            this._createUsersDatabase.bind(this),
            this._createMainDatabase.bind(this),
            this._addTables.bind(this)
        ];

        if (shouldUseDummyData) {
            asyncFunctions.push(this._createData.bind(this));
        }

        async.series(asyncFunctions, function(error) {
            if (error) {
                logger(
                    shouldUseDummyData ? 'Failed to setup databases and create dummy data with error:' :
                        'Failed to setup databases with error:',
                    error,
                    'message:',
                    getErrorMessage(error)
                );
            } else {
                logger(
                    shouldUseDummyData ? 'SETTING UP DATABASES WITH DUMMY DATA WAS A SUCCESS!!'
                        : 'SETTING UP DATABASES WITHOUT DUMMY DATA WAS A SUCCESS!!'
                );
            }

            this._destroyPool();
        }.bind(this));
    };

    _createData(done) {
        let asyncFunctions = [
            this._createOperators.bind(this),
            this._saveOperators.bind(this),
            this._getOperators.bind(this),
            this._saveOperatorAddresses.bind(this),
            this._getOperatorAddresses.bind(this),
            this._createCustomers.bind(this),
            this._saveCustomers.bind(this),
            this._getCustomers.bind(this),
            this._saveCustomerAddresses.bind(this),
            this._getCustomerAddresses.bind(this),
            this._createUsers.bind(this),
            this._saveUsers.bind(this),
            this._getUsers.bind(this),
            this._createMetadata.bind(this),
            this._saveMetadata.bind(this),
            this._createFleets.bind(this),
            this._saveFleets.bind(this),
            this._getFleets.bind(this),
            this._createLocks.bind(this),
            this._saveLocks.bind(this),
            this._getLocks.bind(this),
            this._createBikes.bind(this),
            this._saveBikes.bind(this),
            this._getBikes.bind(this),
            this._createMaintenance.bind(this),
            this._saveMaintenance.bind(this),
            this._createTrips.bind(this),
            this._createThefts.bind(this),
            this._saveThefts.bind(this),
            this._getThefts.bind(this),
            this._createCrashes.bind(this),
            this._saveCrashes.bind(this),
            this._getCrashes.bind(this),
            this._createParkingAreas.bind(this),
            this._saveParkingAreas.bind(this),
            this._getParkingAreas.bind(this),
            this._createParkingSpots.bind(this),
            this._saveParkingSpots.bind(this),
            this._createFleetAssociations.bind(this),
            this._saveFleetAssociations.bind(this)
        ];

        async.series(asyncFunctions, function(error) {
                if (error) {
                    logger(
                        'Failed to created data with error:',
                        error,
                        'and message:',
                        getErrorMessage(error)
                    );
                    done(error);
                    return;
                }

                done();
            }
        );
    };

    //Customized query to get server data by given table name
    _getServerTableData(table, done) {
        sqlPool.initPools(true);
        let queryObject = {};
        let database = dbConstants.dbNames[table] === config.databaseInfo.main.databaseName ?
            config.serverDatabaseInfo.main.databaseName : config.serverDatabaseInfo.users.databaseName;
        queryObject[database] = 'SELECT * FROM `' + database + '`.`' + table + '`';
        sqlPool.makeQuery(queryObject, function(error, rows) {
            if (error) {
                logger(
                    'Error: could not get table data for', table, '. Failed with error:',
                    error,
                    'and message',
                    getErrorMessage(error, null)
                );
                done(error, null);
                return;
            }
            done(null, rows);
        }.bind(this));
    };

    _pullServerData(done) {
        async.series([
                this._dbUsers.bind(this),
                this._dbLocks.bind(this)],
            function(error) {
                if (error) {
                    logger(
                        'Failed to pull data from server with error:',
                        error,
                        'and message:',
                        getErrorMessage(error)
                    );
                    done(error);
                    return;
                }
                done();
            }.bind(this)
        );
    }

    _dbUsers(done) {
        this._getServerTableData(dbConstants.tables.users, function(error, usersData) {
                if (error) {
                    return done(error);
                } else {
                    usersData = _.map(usersData, function(row) {
                        return _.omit(row, 'user_id')
                    });
                    this._rawUsers = usersData;
                    done()
                }
            }.bind(this)
        );
    }

    _dbLocks(done) {
        this._getServerTableData(dbConstants.tables.locks, function(error, locksData) {
                if (error) {
                    return done(error);
                } else {
                    locksData = _.map(locksData, function(row) {
                        return _.omit(row, 'lock_id')
                    });
                    this._rawLocks = locksData;
                    done()
                }
            }.bind(this)
        );
    }

    _deleteUsersDatabase(done) {
        let queryObject = {};
        queryObject[config.databaseInfo.users.databaseName] =
            'DROP DATABASE ' + config.databaseInfo.users.databaseName;
        sqlPool.makeQuery(queryObject, function(error) {
            if (error) {
                if (error.code === 'ER_BAD_DB_ERROR') {
                    done();
                    return;
                }

                logger(
                    'Error: failed to delete users database with error:',
                    error,
                    'and message',
                    getErrorMessage(error)
                );
                done(error);
                return;
            }

            logger('Successfully deleted the database:', config.databaseInfo.users.databaseName);
            done();
        }.bind(this));
    };

    _deleteMainDatabase(done) {
        let queryObject = {};
        queryObject[config.databaseInfo.main.databaseName] =
            'DROP DATABASE ' + config.databaseInfo.main.databaseName;
        sqlPool.makeQuery(queryObject, function(error) {
            if (error) {
                if (error.code === 'ER_BAD_DB_ERROR') {
                    sqlPool.destroyPools(function(error) {
                        if (error) {
                            done(error);
                            return;
                        }

                        logger('destroyed sql pools');
                        done();
                    });
                } else {
                    logger(
                        'Error: failed to delete users database with error:',
                        error,
                        'and message',
                        getErrorMessage(error)
                    );
                    done(error);
                }
            } else {
                logger('Successfully deleted the database:', config.databaseInfo.main.databaseName);
                sqlPool.destroyPools(function(error) {
                    if (error) {
                        done(error);
                        return;
                    }

                    logger('destroyed sql pools');
                    done();
                });
            }
        });
    };

    _createMainDatabase(done) {
        sqlPool.initPools(false);
        let queryObject = {};
        queryObject[config.databaseInfo.main.databaseName] =
            'CREATE DATABASE ' + config.databaseInfo.main.databaseName;
        sqlPool.makeQuery(queryObject, function(error) {
            if (error) {
                logger(
                    'Error: could not create main databases. Failed with error:',
                    error,
                    'and message',
                    getErrorMessage(error)
                );
                done(error);
                return;
            }

            logger('Successfully created the database:', config.databaseInfo.main.databaseName);
            done();
        }.bind(this));
    };

    _createUsersDatabase(done) {
        sqlPool.initPools(false);
        let queryObject = {};
        queryObject[config.databaseInfo.users.databaseName] =
            'CREATE DATABASE ' + config.databaseInfo.users.databaseName;
        sqlPool.makeQuery(queryObject, function(error) {
            if (error) {
                logger(
                    'Error: could not create databases. Failed with error:',
                    error,
                    'and message',
                    getErrorMessage(error)
                );
                done(error);
                return;
            }

            logger('Successfully created the database:', config.databaseInfo.users.databaseName);
            done();
        }.bind(this));
    };

    _addTables(done) {
        sqlPool.destroyPools(function(error) {
            if (error) {
                logger(
                    'Failed to destroy pool with error:',
                    error,
                    'and message',
                    getErrorMessage(error)
                );
                done(error);
                return;
            }

            sqlPool.initPools(true);
            let tableCreationQueries = [
                addressesModel.createTableQuery(),
                ellipseUserModel.createTableQuery(),
                lattisAccounts.createTableQuery(),
                customerModel.createTableQuery(),
                operatorModel.createTableQuery(),
                lockModel.createTableQuery(),
                tripModel.createTableQuery(),
                bikeModel.createTableQuery(),
                bookingModel.createTableQuery(),
                fleetModel.createTableQuery(),
                maintenanceModel.createTableQuery(),
                crashesModel.createTableQuery(),
                theftsModel.createTableQuery(),
                metadataModel.createTableQuery(),
                shareModel.createTableQuery(),
                pinCodesModel.createTableQuery(),
                deletedUsers.createTableQuery(),
                notifications.createTableQuery(),
                confirmationCodesModel.createTableQuery(),
                parkingSpots.createTableQuery(),
                parkingAreas.createTableQuery(),
                fleetAssociations.createTableQuery(),
                deletedOperators.createTableQuery(),
                deletedBikes.createTableQuery()
            ];

            let asyncFunctions = [];
            while (tableCreationQueries.length > 0) {
                const createTableQuery = tableCreationQueries.pop();
                const queryFunction = function(callback) {
                    sqlPool.makeQuery(createTableQuery, function(error) {
                        if (error) {
                            logger(
                                'Error. Failed to create tables with query:',
                                createTableQuery,
                                'Failed with error:',
                                error,
                                'and message',
                                getErrorMessage(error)
                            );
                            callback(error);
                            return;
                        }

                        callback();
                    }.bind(this));
                }.bind(this);

                asyncFunctions.push(queryFunction);
            }

            async.series(asyncFunctions, function(error) {
                if (error) {
                    logger(
                        'Error: failed to create tables with error:',
                        error,
                        'and message',
                        getErrorMessage(error)
                    );
                    done(error);
                    return;
                }

                logger('Successfully created all tables.');
                done();
            }.bind(this));
        }.bind(this));
    };

    _destroyPool() {
        sqlPool.destroyPools(function(error) {
            if (error) {
                logger(
                    'Error destroying pool after saving data to database. Failed with error',
                    error,
                    'and message:',
                    getErrorMessage(error)
                );
                return;
            }

            logger('Successfully cleaned up the database pool');
        }.bind(this));
    };

    _createUsers(done) {
        _.each(this._rawUsers, function(user) {
            passwordHandler.newHash(user.password, function(hashedPassword) {
                user.password = hashedPassword;
                user.date_created = randomPastDate();
                user.max_locks = this._maxLocks;
                this._users.push(user);
                if (this._users.length === this._rawUsers.length) {
                    logger('Successfully created users');
                    done();
                }
            }.bind(this))
        }, this);
    };

    _saveUsers(done) {
        const formattedToSaveUsers = queryFormatter.formatObjectsForMultipleQuery(
            this._rawUsers
        );

        const insertUsersQuery = queryCreator.insertMultiple(
            'users',
            formattedToSaveUsers.columns,
            formattedToSaveUsers.values
        );

        sqlPool.makeQuery(insertUsersQuery, function(error) {
            if (error) {
                done(error);
                return;
            }

            logger('Saved users successfully to database');
            done();
        }.bind(this));
    };

    _createOperators(done) {
        _.each(this._rawOperators, function(operator) {
            passwordHandler.newHash(operator.password, function(hashedPassword) {
                operator.password = hashedPassword;
                this._operators.push(operator);
                if (this._operators.length === this._rawOperators.length) {
                    done();
                }
            }.bind(this))
        }, this);
    };

    _saveOperators(done) {
        const formattedToSaveOperators = queryFormatter.formatObjectsForMultipleQuery(
            this._operators
        );

        const insertOperatorsQuery = queryCreator.insertMultiple(
            'operators',
            formattedToSaveOperators.columns,
            formattedToSaveOperators.values
        );
        sqlPool.makeQuery(insertOperatorsQuery, function(error) {
            if (error) {
                done(error);
                return;
            }

            logger('Saved operators successfully to database');
            done();
        }.bind(this));
    };

    _getOperators(done) {
        const operatorsQuery = queryCreator.selectWithAnd('operators', null, null);
        sqlPool.makeQuery(operatorsQuery, function(error, rows) {
            if (error) {
                logger('Error: could not retrieve operators from database');
                done(error);
                return;
            }

            logger('Successfully updated operators from the database');
            this._operators = rows;
            done();
        }.bind(this));
    };

    _saveOperatorAddresses(done) {
        const formattedAddress = queryFormatter.formatObjectsForMultipleQuery(this._rawOperatorAddresses);
        const addressQuery = queryCreator.insertMultiple('addresses', formattedAddress.columns, formattedAddress.values);
        sqlPool.makeQuery(addressQuery, (error) => {
            if (error) {
                logger('Failed to save operator addresses with error:', error);
                done(error);
                return;
            }

            logger('Successfully saved operator addresses to the database');
            done();
        });
    };

    _getOperatorAddresses(done) {
        const addressQuery = queryCreator.selectWithAnd('addresses', null, {type: 'operator'});
        sqlPool.makeQuery(addressQuery, function(error, rows) {
            if (error) {
                logger('Error: could not retrieve operator addresses');
                done(error);
                return;
            }

            this._operatorAddresses = rows;
            logger('Successfully retrieved operator addresses');
            done();
        }.bind(this));
    };

    _createCustomers(done) {
        this._customers = [];
        let operators = {};
        _.each(this._rawCustomers, function(customer) {
            // We want every operator to have a least a minimum number of fleets
            let assignedCustomer = false;
            while (!assignedCustomer) {
                const operator = getRandomObjectFromArray(this._operators);
                let allFull = true;
                for (let i = 0; i < this._operators.length; i++) {
                    const op = this._operators[i];
                    if (!_.has(operators, op.operator_id) ||
                        operators[op.operator_id] < this._minNumberOfFleetsForOperator) {
                        allFull = false;
                        break;
                    }
                }

                if (allFull) {
                    customer.operator_id = operator.operator_id;
                    assignedCustomer = true;
                } else {
                    if (_.has(operators, operator.operator_id)) {
                        if (operators[operator.operator_id] < this._minNumberOfFleetsForOperator) {
                            customer.operator_id = operator.operator_id;
                            operators[operator.operator_id] = operators[operator.operator_id] + 1;
                            assignedCustomer = true;
                        }
                    } else {
                        customer.operator_id = operator.operator_id;
                        operators[operator.operator_id] = 1;
                        assignedCustomer = true;
                    }
                }
            }

            this._customers.push(customer);
            if (this._customers.length === this._rawCustomers.length) {
                logger('Successfully created customers');
                done();
            }
        }.bind(this));
    };

    _saveCustomers(done) {
        const formattedCustomers = queryFormatter.formatObjectsForMultipleQuery(
            this._customers
        );
        const insertCustomersQuery = queryCreator.insertMultiple(
            'customers',
            formattedCustomers.columns,
            formattedCustomers.values
        );

        sqlPool.makeQuery(insertCustomersQuery, function(error) {
            if (error) {
                done(error);
                return;
            }

            logger('Saved customers successfully to the database');
            done();
        }.bind(this));
    };

    _getCustomers(done) {
        const customersQuery = queryCreator.selectWithAnd('customers', null, null);
        sqlPool.makeQuery(customersQuery, function(error, rows) {
            if (error) {
                logger('Error: could not retrieve customers from database');
                done(error);
                return;
            }

            logger('Successfully updated customers from the database');
            this._customers = rows;
            done();
        }.bind(this));
    };

    _saveCustomerAddresses(done) {
        const formattedAddress = queryFormatter.formatObjectsForMultipleQuery(this._rawCustomerAddresses);
        const addressQuery = queryCreator.insertMultiple('addresses', formattedAddress.columns, formattedAddress.values);
        sqlPool.makeQuery(addressQuery, (error) => {
            if (error) {
                logger('Failed to save customer addresses with error:', error);
                done(error);
                return;
            }

            logger('Successfully saved customer addresses to the database');
            done();
        });
    };

    _getCustomerAddresses(done) {
        const addressQuery = queryCreator.selectWithAnd('addresses', null, {type: 'customer'});
        sqlPool.makeQuery(addressQuery, function(error, rows) {
            if (error) {
                logger('Error: could not retrieve addresses');
                done(error);
                return;
            }

            this._customerAddresses = rows;
            logger('Successfully retrieved operator addresses');
            done();
        }.bind(this));
    };

    _createMetadata(done) {
        _.each(this._rawMetadata, function(metadata) {
            metadata.hint = Math.floor(Math.random() * 2147483647);
        }, this);
        done();
    };

    _saveMetadata(done) {
        const formattedToSaveMetadata = queryFormatter.formatObjectsForMultipleQuery(
            this._rawMetadata
        );

        const insertMetadataQuery = queryCreator.insertMultiple(
            'metadata',
            formattedToSaveMetadata.columns,
            formattedToSaveMetadata.values
        );

        sqlPool.makeQuery(insertMetadataQuery, function(error) {
            if (error) {
                done(error);
                return;
            }

            logger('Saved Metadata successfully to', config.databaseInfo.main.databaseName, 'database');
            done();
        }.bind(this));
    };

    _createLocks(done) {
        console.log(this._operators);
        for(let i=0; i<this._rawLocks.length; i++){
            const operator = getRandomObjectFromArray(this._operators);
            let fleets = [];
            while (fleets.length === 0) {
                fleets = _.where(this._fleets, {operator_id: operator.operator_id});
            }
            const fleet = getRandomObjectFromArray(fleets);
            const statusValue = Math.random();
            let lock = {
                name: this._rawLocks[i].name,
                mac_id: this._rawLocks[i].mac_id,
                key: this._rawLocks[i].key,
                battery_level: Math.floor(100 * Math.random()),
                fleet_id: fleet.fleet_id,
                operator_id: operator.operator_id,
                user_id: null,
                customer_id: null,
                hub_id: null
            };

            if (statusValue < 0.5) {
                const user = getRandomObjectFromArray(this._users);
                lock['user_id'] = user.user_id;
                lock['name'] = user.first_name + ' ' + user.last_name + "'s Lock";
                lock['status'] = 'active';
            } else if (statusValue < 0.7) {
                lock['status'] = 'shipping';
                lock['customer_id'] = fleet.customer_id;
            } else if (statusValue < 0.8) {
                lock['status'] = 'maintenance';
                lock['customer_id'] = fleet.customer_id;
            } else {
                lock['status'] = 'active';
                lock['customer_id'] = fleet.customer_id;
            }
            this._locks.push(lock);
        }
        done();
    };

    _saveLocks(done) {
        let formattedToSaveLocks = queryFormatter.formatObjectsForMultipleQuery(
            this._locks
        );

        let insertLocksQuery = queryCreator.insertMultiple(
            'locks',
            formattedToSaveLocks.columns,
            formattedToSaveLocks.values
        );

        sqlPool.makeQuery(insertLocksQuery, function(error) {
            if (error) {
                done(error);
                return;
            }

            logger('Saved locks successfully to database');
            done();
        }.bind(this));
    };

    _createBikes(done) {
        this._bikes = [];
        const activeLocks = _.where(this._locks, {'status': 'active'});
        const inActiveLocks = _.where(this._locks, {'status': 'shipping'});
        const suspendedLocks = _.where(this._locks, {'status': 'maintenance'});
        const lockCount = activeLocks.length + inActiveLocks.length + suspendedLocks.length;
        while (this._bikes.length < lockCount) {
            let status;
            let currentStatus;
            let maintenanceStatus = null;

            const bikeNames_1 = [
                'Happy',
                'Calm',
                'Cool',
                'Perfect',
                'Attractive',
                'Hot',
                'Smile',
                'Terrific',
                'Quick',
                'Brisk'
            ];
            const bikeNames_2 = [
                'Tiger',
                'Cat',
                'Lion',
                'Cheetah',
                'Dog',
                'Horse',
                'Wolf',
                'Zeebra',
                'Goat',
                'Leopard',
                'Kangaroo'
            ];

            const make = [
                "Mongoose",
                "Genze",
                "Schwinn",
                "Trek",
                "Atlas",
                "Montra"
            ];
            const model = [
                "ARTERY SPORT",
                "SELOUS COMP",
                "TYAX SUPA EXPERT",
                "Sport",
                "4 ONE ONE 1",
                "Émonda SL 6 Pro",
                "Crockett 7 Disc",
                "TORPEDO D/SHOX",
                "ROCK 650B",
                "CELTIC 2.2"
            ];
            const type = [
                "regular",
                "electric"
            ];
            const description = [
                "Bikes in this network are black and white, and have a UHBikes sticker placed on the crossbar.",
                "Bikes in this network are blue."
            ];
            const currentStatusArr = [
                'on_trip',
                'parked'
            ];
            const inactiveStatusArr = [
                'lock_assigned',
                'lock_not_assigned'
            ];

            const deletedStatusArr = [
                'total_loss',
                'stolen',
                'defleeted'
            ];
            const suspendedStatusArr = [
                'damaged',
                'stolen',
                'under_maintenance'
            ];

            let statusValue = Math.floor(100 * Math.random());
            let lock = null;
            let target;
            if (statusValue < 20 && activeLocks.length > 0) {
                status = 'active';
                currentStatus = _.sample(currentStatusArr);
                target = Math.floor(Math.random() * (activeLocks.length - 1));
                lock = activeLocks[target];
                activeLocks.splice(target, 1);
            } else if (statusValue < 40 && activeLocks.length > 0) {
                status = 'active';
                currentStatus = _.sample(currentStatusArr);
                target = Math.floor(Math.random() * (activeLocks.length - 1));
                lock = activeLocks[target];
                activeLocks.splice(target, 1);
            } else if (statusValue < 60 && suspendedLocks.length > 0) {
                status = 'suspended';
                currentStatus = _.sample(suspendedStatusArr);
                maintenanceStatus = 'field_maintenance';
                target = Math.floor(Math.random() * (suspendedLocks.length - 1));
                lock = suspendedLocks[target];
                suspendedLocks.splice(target, 1);
            } else if (statusValue < 80 && suspendedLocks.length > 0) {
                status = 'suspended';
                currentStatus = _.sample(suspendedStatusArr);
                maintenanceStatus = 'shop_maintenance';
                target = Math.floor(Math.random() * (suspendedLocks.length - 1));
                lock = suspendedLocks[target];
                suspendedLocks.splice(target, 1);
            } else if (statusValue < 90 && inActiveLocks.length > 0) {
                status = 'inactive';
                currentStatus = _.sample(inactiveStatusArr);
                target = Math.floor(Math.random() * (inActiveLocks.length - 1));
                lock = inActiveLocks[target];
                inActiveLocks.splice(target, 1);
            } else if (statusValue >= 90 && inActiveLocks.length > 0) {
                status = 'deleted';
                currentStatus = _.sample(deletedStatusArr);
                target = Math.floor(Math.random() * (inActiveLocks.length - 1));
                lock = inActiveLocks[target];
                inActiveLocks.splice(target, 1);
            }
            if (lock) {
                this._bikes.push({
                    date_created: randomPastDate(),
                    status: status,
                    battery_level: statusValue,
                    lock_id: lock.lock_id,
                    current_status: currentStatus,
                    maintenance_status: maintenanceStatus,
                    fleet_id: lock.fleet_id,
                    bike_name: _.sample(bikeNames_1)+' '+ _.sample(bikeNames_2),
                    make: _.sample(make),
                    type: _.sample(type),
                    model: _.sample(model),
                    description: _.sample(description),
                    pic: 'https://s3-us-west-1.amazonaws.com/'+config.aws.s3.bikeImageUpload.bucket+'/bike.jpg'
                });
            }
        }

        done();
    };

    _saveBikes(done) {
        const formattedToSaveBikes = queryFormatter.formatObjectsForMultipleQuery(
            this._bikes
        );

        const insertBikesQuery = queryCreator.insertMultiple(
            'bikes',
            formattedToSaveBikes.columns,
            formattedToSaveBikes.values
        );

        sqlPool.makeQuery(insertBikesQuery, function(error) {
            if (error) {
                logger(
                    'Error: failed to save bikes with error:',
                    error,
                    'and message:',
                    getErrorMessage(error)
                );
                done(error);
                return;
            }

            logger('Successfully saved bikes to the database');
            done();
        }.bind(this));
    };

    _createGeoFences(done) {
        this._geoFenceCircles = [];
        this._geoFencePolygons = [];

        for (let i = 0; i < this._fleets.length; i++) {
            // // Only creating geo-fences for 90% of fleets
            // if (Math.random() > 0.90) {
            //     continue;
            // }

            Math.floor(2 * Math.random()) % 2 === 0 ? this._geoFenceCircles.push(
                this._createCircularGeoFenceForFleet(this._fleets[i])
            ) : this._geoFencePolygons.push(this._createPolygonGeoFenceForFleet(this._fleets[i]));
        }

        logger('Successfully created', this._fleets.length, 'geo-fences successfully');
        done();
    };


    /**
     * Creates a circular geo fence with radius within a pre-defined circle
     * in a major city.
     *
     * @returns {{latitude: number, longitude: number, radius: number, admin_id: number}}
     * @private
     */
    _createCircularGeoFenceForFleet(fleet) {
        const customer = _.findWhere(this._customers, {customer_id: fleet.customer_id});
        const region = _.findWhere(this._parkingAnchors, {city: customer.region});
        const radius = Math.random() * 0.5 * region.maxRadius;
        const geoFenceCenter = pointHandler.getRandomPointOnCircle(radius, region.center);

        return {
            latitude: geoFenceCenter.latitude,
            longitude: geoFenceCenter.longitude,
            radius: radius,
            fleet_id: fleet.fleet_id,
            operator_id: fleet.operator_id,
            customer_id: fleet.customer_id
        };
    };

    /**
     * Saves circular geo-fences to database that are stored in _geoFenceCircles.
     *
     * @param {Function} done callback function
     * @private
     */
    _saveCircularGeoFences(done) {
        // const subsetCount = this._geoFenceCircles.length < this._batchSize ?
        //     this._geoFenceCircles.length : this._batchSize;
        // const geoFencesToInsert = this._geoFenceCircles.splice(
        //     this._geoFenceCircles.length - subsetCount,
        //     subsetCount
        // );

        const circularGeoFenceQueryObjects = queryFormatter.formatObjectsForMultipleQuery(
            this._geoFenceCircles
        );
        const circularGeoFenceQuery = queryCreator.insertMultiple(
            'geofence_circle',
            circularGeoFenceQueryObjects.columns,
            circularGeoFenceQueryObjects.values
        );

        sqlPool.makeQuery(circularGeoFenceQuery, function(error) {
            if (error) {
                logger('Error: saving circular geo-fences');
                done(error);
                return;
            }

            logger('Successfully saved geo fence circles to the database.');
            done()
        }.bind(this));
    };

    /**
     * Creates a polygon geo fence with 3 to 8 vertices within a pre-defined circle
     * in a major city.
     *
     * @returns {{steps: Array, operator_id: Number}}
     * @private
     */
    _createPolygonGeoFenceForFleet(fleet) {
        const customer = _.findWhere(this._customers, {customer_id: fleet.customer_id});
        const region = _.findWhere(this._parkingAnchors, {city: customer.region});
        const radius = Math.random() * 0.5 * region.maxRadius;
        const geoFenceCenter = pointHandler.getRandomPointOnCircle(radius, region.center);

        const numberOfVertices = Math.floor(Math.random() * 5) + 3;
        let vertices = [];
        for (let i = 0; i < numberOfVertices; i++) {
            vertices.push(pointHandler.getNearByPoint(geoFenceCenter))
        }
        vertices.push(vertices[0]);

        return {
            steps: JSON.stringify(vertices),
            operator_id: fleet.operator_id,
            customer_id: fleet.customer_id,
            fleet_id: fleet.fleet_id
        };
    };

    /**
     * Saves polygon geo-fences to database that are stored in _geoFencePolygon.
     *
     * @param {Function} done callback function
     * @private
     */
    _savePolygonGeoFences(done) {
        const subsetCount = this._geoFencePolygons.length < this._batchSize ?
            this._geoFencePolygons.length : this._batchSize;
        const geoFencesToInsert = this._geoFencePolygons.splice(
            this._geoFencePolygons.length - subsetCount,
            subsetCount
        );
        const polygonGeofenceQueryObjects = queryFormatter.formatObjectsForMultipleQuery(geoFencesToInsert);
        const polygonGeofenceQuery = queryCreator.insertMultiple(
            'geofence_polygon',
            polygonGeofenceQueryObjects.columns,
            polygonGeofenceQueryObjects.values
        );

        sqlPool.makeQuery(polygonGeofenceQuery, function(error) {
            if (error) {
                logger('Error: saving polygon geo-fences');
                done(error);
                return;
            }

            logger('Successfully saved geo fence polygons to the database.');
            done();
        }.bind(this));
    };

    /**
     * After circular geo-fences are inserted into the database, this method will set _geoFenceCircles to
     * the objects in the database. This is necessary since the ids of the geo-fences were not
     * set prior to the initial database save. This method updates the geo-fences objects so
     * that id is set.
     *
     * @param {Function} done callback function
     * @private
     */
    _updateCircularGeoFences(done) {
        const geoFenceQuery = query.selectWithAnd('geofence_circle', null, null);
        sqlPool.makeQuery(geoFenceQuery, function(error, rows) {
            if (error) {
                logger('Error: could not retrieve circular geo-fences from database');
                done(error);
                return;
            }

            logger('Successfully updated geo fence circles');
            this._geoFenceCircles = rows;
            done();
        }.bind(this));
    };

    /**
     * After polygon geo-fences are inserted into the database, this method will set _geoFencePolygons to
     * the objects in the database. This is necessary since the ids of the geo-fences were not
     * set prior to the initial database save. This method updates the geo-fences objects so
     * that id is set.
     *
     * @param {Function} done callback function
     * @private
     */
    _updatePolygonGeoFences(done) {
        const geoFenceQuery = queryCreator.selectWithAnd('geofence_polygon', null, null);
        sqlPool.makeQuery(geoFenceQuery, function(error, rows) {
            if (error) {
                logger('Error: could not retrieve polygon geo-fences from database');
                done(error);
                return;
            }

            logger('Successfully updated geo fence polygons');
            this._geoFencePolygons = rows;
            done();
        }.bind(this));
    };

    _createFleets(done) {
        this._fleets = [];
        for (let i = 0; i < this._customers.length; i++) {
            const customer = this._customers[i];
            this._fleets.push({
                operator_id: customer.operator_id,
                customer_id: customer.customer_id,
                fleet_name: customer.customer_name,
                meters_until_maintenance: 100,
                date_created: randomPastDate(),
            });
        }

        done();
    };

    /**
     * This method saves fleets to database.
     *
     * @param {Function} done callback function
     * @private
     */
    _saveFleets(done) {
        const formattedToSaveFleets = queryFormatter.formatObjectsForMultipleQuery(
            this._fleets
        );
        const insertFleetsQuery = queryCreator.insertMultiple(
            'fleets',
            formattedToSaveFleets.columns,
            formattedToSaveFleets.values
        );

        sqlPool.makeQuery(insertFleetsQuery, function(error) {
            if (error) {
                done(error);
                return;
            }

            logger('Saved fleets successfully to database');
            done();
        }.bind(this));
    };

    /**
     * Creates a fleet association for operator
     *
     * @param {Function} done callback function
     * @private
     */
    _createFleetAssociations(done) {
        this._fleetAssociations = [];
        for (let i = 0; i < this._fleets.length; i++) {
            const fleet = this._fleets[i];
            this._fleetAssociations.push({
                operator_id: fleet.operator_id,
                fleet_id : fleet.fleet_id,
                acl: 'admin',
                on_call: 0
            });
        }

        done();
    };

    /**
     * This method saves fleet associations to database.
     *
     * @param {Function} done callback function
     * @private
     */
    _saveFleetAssociations(done) {
        const formattedToSaveFleets = queryFormatter.formatObjectsForMultipleQuery(
            this._fleetAssociations
        );
        const insertFleetsQuery = queryCreator.insertMultiple(
            'fleet_associations',
            formattedToSaveFleets.columns,
            formattedToSaveFleets.values
        );

        sqlPool.makeQuery(insertFleetsQuery, function(error) {
            if (error) {
                done(error);
                return;
            }

            logger('Saved fleet Associations successfully to database');
            done();
        }.bind(this));
    };

    _createHubs(done) {
        // Setting ~2/3 of fleets to have hubs
        this._hubs = [];
        _.each(this._fleets, function(fleet, index) {
            if (Math.random() < 0.67) {
                for (let i = 0; i < Math.floor(20 * Math.random()); i++) {
                    let position;
                    let geoFenceCircle = _.findWhere(this._geoFenceCircles, {fleet_id: fleet.fleet_id});
                    let geoFenceCircleId;
                    let geoFencePolygonId;
                    if (geoFenceCircle) {
                        position = pointHandler.getNearByPoint({
                            latitude: geoFenceCircle.latitude,
                            longitude: geoFenceCircle.longitude
                        });
                        geoFenceCircleId = geoFenceCircle.geofence_circle_id;
                        geoFencePolygonId = null;
                    } else {
                        let geoFencePolygon = _.findWhere(
                            this._geoFencePolygons,
                            {fleet_id: fleet.fleet_id}
                        );

                        if (geoFencePolygon) {
                            geoFenceCircleId = null;
                            geoFencePolygonId = geoFencePolygon.geofence_polygon_id;
                            position = pointHandler.getMidPoint(JSON.parse(geoFencePolygon.steps));
                        }
                    }

                    if (!geoFenceCircleId && !geoFencePolygonId) {
                        continue;
                    }

                    this._hubs.push({
                        latitude: position.latitude,
                        longitude: position.longitude,
                        rule: Math.floor(2 * Math.random()) == 0 ? 'anywhere' : 'hub',
                        bike_racks: Math.floor(20 * Math.random()) + 1,
                        geofence_circle_id: geoFenceCircleId,
                        geofence_polygon_id: geoFencePolygonId,
                        fleet_id: fleet.fleet_id,
                        operator_id: fleet.operator_id,
                        customer_id: fleet.customer_id
                    });
                }
            }
            if (index === this._fleets.length - 1) {
                done();
            }
        }, this);
    };

    _saveHubs(done) {
        let formattedToSaveHubs = queryFormatter.formatObjectsForMultipleQuery(
            this._hubs
        );

        let insertHubsQuery = queryCreator.insertMultiple(
            'hubs',
            formattedToSaveHubs.columns,
            formattedToSaveHubs.values
        );

        sqlPool.makeQuery(insertHubsQuery, function(error) {
            if (error) {
                done(error);
                return;
            }

            logger('Saved Hubs successfully to database');
            done();
        }.bind(this));
    };

    _updateHubs(done) {
        const hubsQuery = queryCreator.selectWithAnd('hubs', null, null);
        sqlPool.makeQuery(hubsQuery, function(error, rows) {
            if (error) {
                logger('Error: could not retrieve hubs from database');
                done(error);
                return;
            }

            logger('Successfully updated hubs');
            this._hubs = rows;
            done();
        }.bind(this));
    };

    _createMaintenance(done) {
        let bikesUnderMaintenance = _.where(this._bikes, {status: 'suspended'});
        for (let i = 0; i < bikesUnderMaintenance.length; i++) {
            let bike = getRandomObjectFromArray(bikesUnderMaintenance);
            let lock = _.where(this._locks, {lock_id: bike.lock_id, user_id: null});
            let operatorId, customerId, fleetId;
            if (!_.has(lock, 'operator_id')) {
                let operator = getRandomObjectFromArray(this._operators);
                let customer = getRandomObjectFromArray(this._customers);
                let fleet = getRandomObjectFromArray(this._fleets);
                operatorId = operator.operator_id;
                customerId = customer.customer_id;
                fleetId = fleet.fleet_id;
            } else {
                operatorId = lock.operator_id;
                customerId = lock.customer_id;
                fleetId = lock.fleet_id;
            }

            const serviceStartDate = randomPastDate();
            let maintenanceCategory;
            let riderNotes;
            let status;
            if (bike.current_status === "field-maintenance") {
                status = "onboarding_in_process";
                maintenanceCategory = "Standard_service";
            } else {
                let statusValue = Math.floor(100 * Math.random());
                if (statusValue <= 40) {
                    status = "in_workshop";
                    maintenanceCategory = "faulty_gears";
                    riderNotes = "Customer had an accident which damaged the such and such part. Damage was reported by customer. Technician replaced the part and cleaned the little supporting parts.";
                } else if (statusValue <= 60) {
                    status = "in_workshop";
                    maintenanceCategory = 'Wheel damage';
                    riderNotes = 'Customer had an accident which damaged the such and such part. Damage was reported by customer. Technician replaced the part and cleaned the little supporting parts.';
                } else if (statusValue >= 60) {
                    status = "in_workshop";
                    maintenanceCategory = 'faulty_part_and_such_part';
                    riderNotes = 'Customer had an accident which damaged the such and such part. Damage was reported by customer. Technician replaced the part and cleaned the little supporting parts.';
                }
            }

            this._maintenance.push({
                operator_id: operatorId,
                lock_id: bike.lock_id,
                service_start_date: randomPastDate(),
                service_end_date: Math.floor(serviceStartDate + Math.random() * (1000 * 3600 * 71) + (1000 * 3600)),
                bike_id: bike.bike_id,
                fleet_id: fleetId,
                customer_id: customerId,
                status: status,
                category: maintenanceCategory,
                rider_notes: riderNotes
            });
        }

        done();
    };

    _saveMaintenance(done) {
        const formattedToSaveMaintenance = queryFormatter.formatObjectsForMultipleQuery(
            this._maintenance
        );

        const insertMaintenanceQuery = queryCreator.insertMultiple(
            'maintenance',
            formattedToSaveMaintenance.columns,
            formattedToSaveMaintenance.values
        );

        sqlPool.makeQuery(insertMaintenanceQuery, function(error) {
            if (error) {
                done(error);
                return;
            }

            logger('Saved maintenance successfully to database');
            done();
        }.bind(this));
    };

    _createTrips(done) {
        logger(
            'Attempting to create trips...There may be be some lag here ' +
            'since we have to fetch information from map box'
        );

        let activeLocks = [];
        let parkingImage = 'https://s3-us-west-1.amazonaws.com/'+config.aws.s3.bikeImageUpload.bucket+'/parking_image.jpg';
        for (let i = 0; i < this._locks.length; i++) {
            if (this._locks[i].user_id && this._locks[i].fleet_id && this._locks[i].status === "active") {
                activeLocks.push(this._locks[i]);
            } else if (this._locks[i].user_id === null && this._locks[i].status === "active") {
                this._locks[i].user_id = Math.floor(Math.random() * this._rawUsers.length);
                activeLocks.push(this._locks[i]);
            }
        }

        if (activeLocks.length === 0) {
            throw new Error('There are no active locks');
        }

        let locksForTrips = [];
        for (let i = 0; i < this._numberOfTrips; i++) {
            if (i <= activeLocks.length - 1) {
                locksForTrips.push(activeLocks[i]);
            } else {
                let lock = getRandomObjectFromArray(activeLocks);
                if (lock) {
                    locksForTrips.push(lock);
                }
            }
        }

        if (locksForTrips.length === 0) {
            throw new Error('There are no locks with a fleet id and lock id');
        }

        let tripCounter = 0;
        let completedTripCounter = 0;
        let asyncFunctions = [];
        while (tripCounter < locksForTrips.length) {
            let fleets = [];
            let lock;
            while (fleets.length === 0) {
                lock = locksForTrips[tripCounter];
                if (lock) {
                    fleets = _.where(this._fleets, {fleet_id: lock.fleet_id});
                    if (fleets.length === 0) {
                        logger(
                            'There are no fleets associated with lock id:',
                            lock.lock_id,
                            'Searching again...'
                        );
                    }
                }
            }

            const getDirections = function(callback) {
                const fleet = getRandomObjectFromArray(fleets);
                const customer = _.findWhere(this._customers, {customer_id: fleet.customer_id});
                const geoFenceAnchor = _.findWhere(this._parkingAnchors, {city: customer.region});
                const bikes = _.filter(this._bikes, {lock_id: lock.lock_id});
                const bike = getRandomObjectFromArray(bikes);
                const from = pointHandler.getRandomPointOnCircle(
                    Math.random() * geoFenceAnchor.maxRadius,
                    geoFenceAnchor.center
                );

                const to = pointHandler.getRandomPointOnCircle(
                    Math.random() * geoFenceAnchor.maxRadius,
                    geoFenceAnchor.center
                );

                mapBoxHandler.getDirectionsBetweenCoordinates(
                    {from: from, to: to},
                    function(error, directions) {
                        if (error) {
                            // We'll leave this as a soft error for now since the
                            // map box api is a bit buggy. If that changes in the
                            // future, a more robust error handling solution should
                            // be put into place here.
                            logger('Error: making directions query to map box');
                            callback();
                            return;
                        }

                        const startTime = randomPastDate();
                        let duration = 0;
                        let steps = [];
                        _.each(directions, function(direction) {
                            duration += (direction.duration);
                            steps.push([direction.latitude, direction.longitude, startTime + duration]);
                        });

                        // Since we're randomly generating the trip start and end,
                        // occasionally the steps string will overflow the database
                        // column where it is stored. To avoid this, we'll just disregard
                        // any trip that is beyond the length that the database allows.
                        const stepsJSON = JSON.stringify(steps);
                        if (stepsJSON.length >= 10000) {
                            logger('Not adding trip. It has too many steps.');
                            callback();
                            return;
                        }

                        mapBoxHandler.getAddressInformationForCoordinate(
                            from,
                            function(error, fromInfo) {
                                if (error) {
                                    logger('Error: making from address query to map box');
                                    callback();
                                    return;
                                }

                                mapBoxHandler.getAddressInformationForCoordinate(
                                    to,
                                    function(error, toInfo) {
                                        if (error) {
                                            logger('Error: making from address query to map box');
                                            callback();
                                            return;
                                        }

                                        const startAddress = (!!fromInfo.address && !!fromInfo.street)
                                            ? fromInfo.address + ' ' + fromInfo.street : '';

                                        const endAddress = (!!toInfo.address && !!toInfo.street)
                                            ? toInfo.address + ' ' + toInfo.street : '';

                                        const trip = {
                                            steps: stepsJSON,
                                            parking_image : parkingImage,
                                            user_id: lock.user_id,
                                            operator_id: lock.operator_id,
                                            customer_id: lock.customer_id,
                                            fleet_id: lock.fleet_id,
                                            lock_id: lock.lock_id,
                                            bike_id: bike.bike_id,
                                            date_created: startTime,
                                            start_address: startAddress,
                                            end_address: endAddress
                                        };

                                        this._trips.push(trip);

                                        const tripQuery = queryCreator.insertSingle(
                                            'trips',
                                            trip
                                        );

                                        sqlPool.makeQuery(tripQuery, function(error) {
                                            if (error) {
                                                logger('Error: failed to save trip:', trip);
                                            } else {
                                                completedTripCounter += 1;
                                                logger('Successfully saved a trip!');
                                                logger(
                                                    'Created trip number:',
                                                    completedTripCounter,
                                                    'from:',
                                                    trip.start_address,
                                                    'to:',
                                                    trip.end_address,
                                                    'in geofence anchor city:',
                                                    geoFenceAnchor.city,
                                                    'start: [', steps[0][0], ', ', steps[0][1], ']',
                                                    'end:[', steps[steps.length - 1][0], ', ', steps[steps.length - 1][1], ']',
                                                    'duration:',
                                                    (steps[steps.length - 1][2] - steps[0][2]) / 60000,
                                                    'mins'
                                                );
                                            }

                                            callback();
                                        });
                                    }.bind(this)
                                );
                            }.bind(this)
                        );
                    }.bind(this)
                );
            }.bind(this);

            asyncFunctions.push(getDirections);
            tripCounter += 1;
        }

        async.series(asyncFunctions, function(error) {
            if (error) {
                logger('Error: failed to create trips.');
                done(error);
                return;
            }

            done();
        });
    };

    _saveTrips(done) {
        const formattedTrips = queryFormatter.formatObjectsForMultipleQuery(this._trips);
        const tripQuery = queryCreator.insertMultiple(
            'trips',
            formattedTrips.columns,
            formattedTrips.values
        );

        sqlPool.makeQuery(tripQuery, function(error) {
            if (error) {
                done(error);
                return;
            }

            logger('Successfully saved trips to database');
            done();
        });
    };

    _getFleets(done) {
        const fleetsQuery = queryCreator.selectWithAnd('fleets', null, null);
        sqlPool.makeQuery(fleetsQuery, function(error, rows) {
            if (error) {
                logger('Error: could not retrieve fleets from database');
                done(error);
                return;
            }

            this._fleets = rows;
            done();
        }.bind(this));
    };

    _getUsers(done) {
        const usersQuery = queryCreator.selectWithAnd('users', null, null);
        sqlPool.makeQuery(usersQuery, function(error, rows) {
            if (error) {
                logger('Error: could not retrieve fleets from database');
                done(error);
                return;
            }

            this._users = rows;
            done();
        }.bind(this));
    };

    _getBikes(done) {
        const bikesQuery = queryCreator.selectWithAnd('bikes', null, null);
        sqlPool.makeQuery(bikesQuery, function(error, rows) {
            if (error) {
                logger('Error: could not retrieve locks from database');
                done(error);
                return;
            }

            this._bikes = rows;
            done();
        }.bind(this));
    };

    _getLocks(done) {
        const locksQuery = queryCreator.selectWithAnd('locks', null, null);
        sqlPool.makeQuery(locksQuery, function(error, rows) {
            if (error) {
                logger('Error: could not retrieve locks from database');
                done(error);
                return;
            }

            this._locks = rows;
            done();
        }.bind(this));
    };

    _createThefts(done) {
        for (let i = 0; i < this._numberOfThefts; i++) {
            const trip = getRandomObjectFromArray(this._trips);
            const step = getRandomObjectFromArray(JSON.parse(trip.steps));
            this._thefts.push({
                date: randomPastDate(),
                x_ave: 1000 * Math.random(),
                y_ave: 1000 * Math.random(),
                z_ave: 1000 * Math.random(),
                x_dev: 1000 * Math.random(),
                y_dev: 1000 * Math.random(),
                z_dev: 1000 * Math.random(),
                latitude: step[0],
                longitude: step[1],
                lock_id: trip.lock_id,
                user_id: trip.user_id,
                trip_id: trip.trip_id,
                confirmed: true
            });
        }

        done();
    };

    _saveThefts(done) {
        let asyncFunctions = [];
        let index = 0;
        this._counter = 0;
        while (index < this._numberOfThefts) {
            const saveFunction = (callback) => {
                this._counter += this._batchSize;
                const thefts = (this._counter + this._batchSize < this._thefts.length) ?
                    this._thefts.slice(this._counter, this._counter + this._batchSize) :
                    this._thefts.slice(this._counter);

                if (thefts.length === 0) {
                    callback();
                    return;
                }

                const formattedThefts = queryFormatter.formatObjectsForMultipleQuery(thefts);
                const theftsQuery = queryCreator.insertMultiple(
                    'thefts',
                    formattedThefts.columns,
                    formattedThefts.values
                );

                sqlPool.makeQuery(theftsQuery, (error) => {
                    if (error) {
                        logger('Error: could not retrieve thefts from database');
                        callback(error);
                        return;
                    }

                    callback();
                });
            };

            asyncFunctions.push(saveFunction);
            index += this._batchSize;
        }

        async.series(asyncFunctions, (error) => {
            this._counter = 0;
            if (error) {
                logger('Error: saving thefts:', error);
                done(error);
                return;
            }

            done();
        });
    }

    _getThefts(done) {
        const theftsQuery = queryCreator.selectWithAnd('thefts', null, null);
        sqlPool.makeQuery(theftsQuery, (error, rows) => {
            if (error) {
                logger('Error: could not retrieve thefts from database');
                done(error);
                return;
            }

            this._thefts = rows;
            logger('Successfully retrieved:', this._thefts.length, 'thefts');
            done();
        });
    };

    _createCrashes(done) {
        for (let i = 0; i < this._numberOfCrashes; i++) {
            const trip = getRandomObjectFromArray(this._trips);
            const step = getRandomObjectFromArray(JSON.parse(trip.steps));
            this._crashes.push({
                date: randomPastDate(),
                x_ave: 1000 * Math.random(),
                y_ave: 1000 * Math.random(),
                z_ave: 1000 * Math.random(),
                x_dev: 1000 * Math.random(),
                y_dev: 1000 * Math.random(),
                z_dev: 1000 * Math.random(),
                latitude: step[0],
                longitude: step[1],
                lock_id: trip.lock_id,
                user_id: trip.user_id,
                trip_id: trip.trip_id,
                message_sent: true
            });
        }

        done();
    };

    _saveCrashes(done) {
        let asyncFunctions = [];
        let index = 0;
        this._counter = 0;
        while (index < this._numberOfCrashes) {
            const saveFunction = (callback) => {
                this._counter += this._batchSize;
                const crashes = (this._counter + this._batchSize < this._crashes.length) ?
                    this._crashes.slice(this._counter, this._counter + this._batchSize) :
                    this._crashes.slice(this._counter);

                if (crashes.length === 0) {
                    callback();
                    return;
                }

                const formattedCrashes = queryFormatter.formatObjectsForMultipleQuery(crashes);
                const crashesQuery = queryCreator.insertMultiple(
                    'crashes',
                    formattedCrashes.columns,
                    formattedCrashes.values
                );

                sqlPool.makeQuery(crashesQuery, (error) => {
                    if (error) {
                        logger('Error: could not retrieve crashes from database');
                        callback(error);
                        return;
                    }

                    callback();
                });
            };

            asyncFunctions.push(saveFunction);
            index += this._batchSize;
        }

        async.series(asyncFunctions, (error) => {
            this._counter = 0;
            if (error) {
                logger('Error: saving crashes:', error);
                done(error);
                return;
            }

            logger('Successfully saved:', this._crashes.length, 'crashes');
            done();
        });
    }

    _getCrashes(done) {
        const crashesQuery = queryCreator.selectWithAnd('crashes', null, null);
        sqlPool.makeQuery(crashesQuery, (error, rows) => {
            if (error) {
                logger('Error: could not retrieve crashes from database');
                done(error);
                return;
            }

            this._crashes = rows;
            done();
        });
    };


    _createParkingAreas(done) {
        const areaType = [
            'circle',
            'polygon',
            'rectangle'
        ];
        for (let i = 0; i < this._numberOfParkingAreas; i++) {
            let type = _.sample(areaType);
            const fleet = getRandomObjectFromArray(this._fleets);
            let name = fleet.fleet_name + ' ' + type + ' zone';
            if (type === 'circle') {
                this._parkingAreas.push(this._createCircularParkingAreas(fleet, type, name));
            } else if (type === 'polygon') {
                this._parkingAreas.push(this._createPolygonParkingAreas(fleet, type, name));
            } else if (type === 'rectangle') {
                this._parkingAreas.push(this._createRectangleParkingAreas(fleet, type, name));
            }
        }
        done();
    };

    _createCircularParkingAreas(fleet, type, name) {
        let circleArray = [];
        const customer = _.findWhere(this._customers, {customer_id: fleet.customer_id});
        const region = _.findWhere(this._parkingAnchors, {city: customer.region});
        const radius = Math.random() * 0.5 * region.maxRadius;
        const parkingCircle = pointHandler.getRandomPointOnCircle(radius, region.center);
        parkingCircle.radius = radius;
        circleArray.push(parkingCircle);
        return {
            name: name,
            geometry: JSON.stringify(circleArray),
            type: type,
            fleet_id: fleet.fleet_id,
            operator_id: fleet.operator_id,
            customer_id: fleet.customer_id
        };
    };

    _createPolygonParkingAreas(fleet, type, name) {
        const customer = _.findWhere(this._customers, {customer_id: fleet.customer_id});
        const region = _.findWhere(this._parkingAnchors, {city: customer.region});
        const radius = Math.random() * 0.5 * region.maxRadius;
        const parkingPolygon = pointHandler.getRandomPointOnCircle(radius, region.center);
        const numberOfVertices = Math.floor(Math.random() * 5) + 3;
        let vertices = [];
        for (let i = 0; i < numberOfVertices; i++) {
            vertices.push(pointHandler.getNearByPoint(parkingPolygon));
        }
        vertices.push(vertices[0]);

        return {
            geometry: JSON.stringify(vertices),
            type: type,
            name: name,
            operator_id: fleet.operator_id,
            customer_id: fleet.customer_id,
            fleet_id: fleet.fleet_id
        };
    };

    _createRectangleParkingAreas(fleet, type, name) {
        const customer = _.findWhere(this._customers, {customer_id: fleet.customer_id});
        const region = _.findWhere(this._parkingAnchors, {city: customer.region});
        const radius = Math.random() * 0.5 * region.maxRadius;
        const parkingRectangle = pointHandler.getRandomPointOnCircle(radius, region.center);
        const numberOfVertices = 4;
        let vertices = [];
        for (let i = 1; i < numberOfVertices; i++) {
            vertices.push(pointHandler.getNearByPoint(parkingRectangle));
        }
        vertices.push(vertices[0]);

        return {
            geometry: JSON.stringify(vertices),
            type: type,
            name: name,
            operator_id: fleet.operator_id,
            customer_id: fleet.customer_id,
            fleet_id: fleet.fleet_id
        };
    };

    _saveParkingAreas(done) {
        const formattedParkingAreas = queryFormatter.formatObjectsForMultipleQuery(this._parkingAreas);
        const parkingAreasQuery = queryCreator.insertMultiple(
            'parking_areas',
            formattedParkingAreas.columns,
            formattedParkingAreas.values
        );
        sqlPool.makeQuery(parkingAreasQuery, function(error) {
            if (error) {
                done(error);
                return;
            }

            logger('Successfully saved parkingAreas to database');
            done();
        });
    };

    _createParkingSpots(done) {
        const areaType = [
            'parking_meter',
            'bike_rack',
            'sheffield_stand'
        ];
        for (let i = 0; i < this._numberOfParkingSpots; i++) {
            let type = _.sample(areaType);
            let fleet = getRandomObjectFromArray(this._fleets);
            let rawParkingSpot = getRandomObjectFromArray(this._rawParkingSpots);
            let name = rawParkingSpot.name;
            let description = rawParkingSpot.description;
            let pic = rawParkingSpot.pic;
            let parkingArea;
            let steps;
            if (i <= this._parkingAreas.length - 1) {
                parkingArea = this._parkingAreas[i];
                steps = JSON.parse(parkingArea.geometry);
            } else {
                parkingArea = getRandomObjectFromArray(this._parkingAreas);
                steps = JSON.parse(parkingArea.geometry);
            }
            let parkingSpot;
            let coordinates = [];
            let parkingAreaId;
            if (parkingArea.type === 'circle') {
                parkingAreaId = parkingArea.parking_area_id;
                parkingSpot = {latitude: steps[0].latitude, longitude: steps[0].longitude};
            } else if (parkingArea.type === 'polygon') {
                _.each(steps, function(step) {
                    coordinates.push([step.longitude, step.latitude]);
                });
                let spot = pointHandler.getRandomPointPolygon(coordinates);
                if (spot.isInside) {
                    parkingSpot = spot.randomPoint;
                    parkingAreaId = parkingArea.parking_area_id;
                } else {
                    parkingSpot = spot.randomPoint;
                    parkingAreaId = null;
                }
            } else if (parkingArea.type === 'rectangle') {
                _.each(steps, function(step) {
                    coordinates.push([step.longitude, step.latitude]);
                });
                let spot = pointHandler.getRandomPointPolygon(coordinates);
                if (spot.isInside) {
                    parkingSpot = spot.randomPoint;
                    parkingAreaId = parkingArea.parking_area_id;
                } else {
                    parkingSpot = spot.randomPoint;
                    parkingAreaId = null;
                }
            }
            this._parkingSpots.push(
                {
                    type: type,
                    name: name,
                    description: description,
                    pic: pic,
                    latitude: parkingSpot.latitude,
                    longitude: parkingSpot.longitude,
                    capacity: Math.floor(Math.random() * 3) + 1,
                    parking_area_id: parkingAreaId,
                    operator_id: fleet.operator_id,
                    customer_id: fleet.customer_id,
                    fleet_id: fleet.fleet_id
                }
            )
        }
        done();
    }

    _saveParkingSpots(done) {
        const formattedParkingSpots = queryFormatter.formatObjectsForMultipleQuery(this._parkingSpots);
        const parkingSpotsQuery = queryCreator.insertMultiple(
            'parking_spots',
            formattedParkingSpots.columns,
            formattedParkingSpots.values
        );
        sqlPool.makeQuery(parkingSpotsQuery, function(error) {
            if (error) {
                done(error);
                return;
            }

            logger('Successfully saved parkingSpots to database');
            done();
        });
    };

    _getParkingAreas(done) {
        const parkingAreasQuery = queryCreator.selectWithAnd('parking_areas', null, null);
        sqlPool.makeQuery(parkingAreasQuery, (error, rows) => {
            if (error) {
                logger('Error: could not retrieve crashes from database');
                done(error);
                return;
            }

            this._parkingAreas = rows;
            done();
        });
    }

}

module.exports = DatabaseCreator;
