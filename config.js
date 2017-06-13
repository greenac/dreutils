'use strict';

const _ = require('underscore');


const requiredParams = [
    'LATTIS_USERS_DB_USERNAME',
    'LATTIS_USERS_DB_PASSWORD',
    'LATTIS_USERS_DB_NAME',
    'LATTIS_USERS_DB_HOST',
    'LATTIS_MAIN_DB_USERNAME',
    'LATTIS_MAIN_DB_PASSWORD',
    'LATTIS_MAIN_DB_NAME',
    'LATTIS_MAIN_DB_HOST',
    'LATTIS_LOG_PATH',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_KEY',
    'AWS_REGION',
    'LATTIS_NPM_TOKEN',
    'LATTIS_SENDER_EMAIL',
    'LATTIS_MAPBOX_TOKEN',
    'LUCY_WRITE_QUEUE_URL',
    'LUCY_READ_QUEUE_URL'
];

const optionalParams = [
    'LATTIS_ELLIPTICAL_DB_PRIVATE_KEY',
    'LATTIS_ELLIPTICAL_DB_PUBLIC_KEY',
    'LATTIS_ELLIPTICAL_REST_PRIVATE_KEY',
    'LATTIS_ELLIPTICAL_REST_PUBLIC_KEY'
];

for (let i=0; i < requiredParams.length; i++) {
    if (!_.has(process.env, requiredParams[i])) {
        console.log(
            'Error: environment variables have not been properly setup for the Lattis Platform. The variable:',
            requiredParams[i],
            'was not found.'
        );

        throw new Error('Lattis Platform Environment Variables Not Properly Set');
    }
}

for (let i=0; i < optionalParams.length; i++) {
    if (!_.has(process.env, requiredParams[i])) {
        console.log(
            'Warning: optional env variables have not been properly setup for the Lattis Platform. The variable:',
            optionalParams[i],
            'was not found.'
        );
    }
}

module.exports = {
    appName: 'lattis-platform',

    paths: {
        logPath: process.env.LATTIS_LOG_PATH,
    },

    databaseInfo: {
        main: {
            userName: process.env.LATTIS_MAIN_DB_USERNAME,
            password: process.env.LATTIS_MAIN_DB_PASSWORD,
            databaseName: process.env.LATTIS_MAIN_DB_NAME,
            host: process.env.LATTIS_MAIN_DB_HOST,
            port: process.env.LATTIS_MAIN_DB_PORT
        },

        users: {
            userName: process.env.LATTIS_USERS_DB_USERNAME,
            password: process.env.LATTIS_USERS_DB_PASSWORD,
            databaseName: process.env.LATTIS_USERS_DB_NAME,
            host: process.env.LATTIS_USERS_DB_HOST,
            port: process.env.LATTIS_USERS_DB_PORT
        }
    },

    serverDatabaseInfo: {
        main: {
            userName: process.env.LATTIS_MAIN_SERVER_DB_USERNAME,
            password: process.env.LATTIS_MAIN_SERVER_DB_PASSWORD,
            databaseName: process.env.LATTIS_MAIN_SERVER_DB_NAME,
            host: process.env.LATTIS_MAIN_SERVER_DB_HOST,
            port: process.env.LATTIS_MAIN_SERVER_DB_PORT
        },
        users: {
            userName: process.env.LATTIS_USERS_SERVER_DB_USERNAME,
            password: process.env.LATTIS_USERS_SERVER_DB_PASSWORD,
            databaseName: process.env.LATTIS_USERS_SERVER_DB_NAME,
            host: process.env.LATTIS_USERS_SERVER_DB_HOST,
            port: process.env.LATTIS_USERS_SERVER_DB_PORT
        }
    },

    aws: {
        keyId: process.env.AWS_ACCESS_KEY_ID,
        key: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION,
        s3: {
            firmware: {
                bucket: this.mode === 'production' ?
                    'lattis.ellipse.firmware' : 'lattis.ellipse.firmware.dev',
            },
            firmwareUpdateLog: {
                bucket: 'lattis.ellipse.firmware.log',
                file: 'ellipse_fw_log.json'
            },
            termsAndConditions: {
                bucket: 'terms.and.conditions',
                file: 'terms_and_conditions.json'
            },
            maintenanceDamageReportUpload: {
                bucket: 'lattis.maintenance.image.upload'
            },
            parkingSpotUpload : {
                bucket : "lattis.parking-spot.image.upload"
            },
            bikeImageUpload : {
                bucket : "lattis.bike.image.upload"
            }
        },
        sqs: {
            lucy: {
                queues: {
                    write: process.env.LUCY_WRITE_QUEUE_URL,
                    read: process.env.LUCY_READ_QUEUE_URL
                }
            }
        }
    },

    verificationMail: {
        senderEmail: process.env.LATTIS_SENDER_EMAIL
    },

    mapBox: {
        geoCodingBaseUrl: 'https://api.mapbox.com/geocoding/v5/mapbox.places/',
        directionsBaseUrl: 'https://api.mapbox.com/directions/v5/mapbox/cycling/',
        apiToken: process.env.LATTIS_MAPBOX_TOKEN
    },

    ellipticalKeys: {
        database: {
            privateKey: process.env.LATTIS_ELLIPTICAL_DB_PRIVATE_KEY,
            publicKey: process.env.LATTIS_ELLIPTICAL_DB_PUBLIC_KEY
        },

        rest: {
            privateKey: process.env.LATTIS_ELLIPTICAL_REST_PRIVATE_KEY,
            publicKey: process.env.LATTIS_ELLIPTICAL_REST_PUBLIC_KEY
        }
    }
};
