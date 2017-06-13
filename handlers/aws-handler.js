'use strict';

const AWS = require('aws-sdk');


module.exports = {
    s3: function() {
        return new AWS.S3();
    },
    sqs: function() {
        return new AWS.SQS();
    }
};
