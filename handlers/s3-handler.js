'use strict';

const awsHandler = require('./aws-handler');
const logger = require('./../utils/logger');
const fs = require('fs');
const _ = require('underscore');
const moment = require('moment');


class S3Handler {
    constructor() {
        this._objectsToUpload = null;
        this._s3 = awsHandler.s3();
    };

    _params(options) {
        let parameters = {};
        if (_.has(options, 'bucket')) {
            parameters.Bucket = options.bucket;
        }

        if (_.has(options, 'key')) {
            parameters.Key = options.key;
        }

        if (_.has(options, 'region')) {
            parameters.region = options.region;
        }

        return parameters;
    };

    download(options, callback) {
        this._s3.getObject(this._params(options), function(error, s3Object) {
            if (error) {
                logger('Error: s3 could not download objects with options:', options, 'Failed with:', error);
                callback(error, null);
                return;
            }

            if (!s3Object || !_.has(s3Object, 'Body') || !_.has(s3Object, 'Metadata')) {
                callback(null, null);
                return;
            }

            const formattedObject = {
                body: s3Object.Body,
                metadata: s3Object.Metadata
            };

            callback(null, formattedObject);
        });
    };

    upload(file, bucket, contentType, done) {
        let file_data = fs.readFileSync(file.path);
        const params = {Bucket: bucket, Key: file.originalFilename, Body: file_data, ContentType : contentType, ACL : 'public-read'};
        this._s3.upload(params, function(err, data) {
            done(err, data);
        });
    };

    getBucketContents(options, callback) {
        this._s3.listObjects(this._params(options), function(error, objectList) {
            if (error) {
                logger('Error: failed to fetch list of s3 objects with options:', options, 'error:', error);
                callback(error, null);
                return;
            }

            if (!objectList || !_.has(objectList, 'Contents')) {
                callback(null, null);
                return;
            }

            const contents = objectList.Contents;
            let keys = [];
            _.each(contents, function(contentObject) {
                keys.push(contentObject.Key);
            });

            callback(null, keys);
        });
    }
}

module.exports = S3Handler;
