'use strict';

const config = require('./../config');

/*
 * Related a table name with a database
 */
module.exports = {
    dbNames: {
        addresses: config.databaseInfo.main.databaseName,
        bikes: config.databaseInfo.main.databaseName,
        booking: config.databaseInfo.main.databaseName,
        confirmation_codes: config.databaseInfo.users.databaseName,
        crashes: config.databaseInfo.main.databaseName,
        customers: config.databaseInfo.users.databaseName,
        deleted_bikes: config.databaseInfo.main.databaseName,
        deleted_operators: config.databaseInfo.users.databaseName,
        deleted_users: config.databaseInfo.users.databaseName,
        fleet_associations: config.databaseInfo.main.databaseName,
        fleets: config.databaseInfo.main.databaseName,
        geofence_circle: config.databaseInfo.main.databaseName,
        geofence_polygon: config.databaseInfo.main.databaseName,
        hubs: config.databaseInfo.main.databaseName,
        lattis_accounts: config.databaseInfo.users.databaseName,
        locks: config.databaseInfo.main.databaseName,
        maintenance: config.databaseInfo.main.databaseName,
        metadata: config.databaseInfo.main.databaseName,
        notifications: config.databaseInfo.main.databaseName,
        operators: config.databaseInfo.users.databaseName,
        parking_areas: config.databaseInfo.main.databaseName,
        parking_spots: config.databaseInfo.main.databaseName,
        pin_codes: config.databaseInfo.main.databaseName,
        share: config.databaseInfo.main.databaseName,
        thefts: config.databaseInfo.main.databaseName,
        trips: config.databaseInfo.main.databaseName,
        users: config.databaseInfo.users.databaseName
    },

    tables: {
        addresses: 'addresses',
        bikes: 'bikes',
        booking: 'booking',
        confirmation_codes: 'confirmation_codes',
        crashes: 'crashes',
        customers: 'customers',
        deleted_bikes: 'deleted_bikes',
        deleted_operators: 'deleted_operators',
        deleted_users: 'deleted_users',
        fleet_associations: 'fleet_associations',
        fleets: 'fleets',
        geofence_circle: 'geofence_circle',
        geofence_polygon: 'geofence_polygon',
        hubs: 'hubs',
        lattis_accounts: 'lattis_accounts',
        locks: 'locks',
        maintenance: 'maintenance',
        metadata: 'metadata',
        notifications: 'notifications',
        operators: 'operators',
        parking_areas: 'parking_areas',
        parking_spots: 'parking_spots',
        pin_codes: 'pin_codes',
        share: 'share',
        thefts: 'thefts',
        trips: 'trips',
        users: 'users'
    }
};
