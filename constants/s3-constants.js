'use strict';

const config = require('./../config');


module.exports = {
        firmware: config.aws.s3.firmware,
        firmwareUpdateLog: config.aws.s3.firmwareUpdateLog,
        termsAndConditions: config.aws.s3.termsAndConditions,
        maintenanceDamageReportUpload: config.aws.s3.maintenanceDamageReportUpload,
        parkingSpotUpload: config.aws.s3.parkingSpotUpload
};
