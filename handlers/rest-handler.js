'use strict';

const _ = require('underscore');
const http = require('http');
const logger = require('./../utils/logger');


class RestHandler {
    constructor(options) {
        this._host = null;
        this._path = null;
        this._headers = null;
        this._payload = null;
        this._port = null;
        this._method = null;
        this._callback = null;
        this._setOptions(options)
    };

    postRequest(options, callback) {
        if (options) {
            options.method = 'POST';
            this._setOptions(options);
        } else if (!this._method) {
            this._method = 'POST';
        }

        options = this._createRestOptions();
        this._callback = callback;
        const req = http.request(options, this._handleResponseData.bind(this));
        req.on('error', this._handleError.bind(this));
        req.write(JSON.stringify(this._payload));
        req.end();
    };

    _handleResponseData(response) {
        logger(
            'Got response from request with status:',
            response.statusCode,
            'and headers:',
            response.headers
        );

        let data = '';
        response.setEncoding('utf8');
        response.on('data', function(chunk) {
            data += chunk;
        });

        response.on('end', function() {
            if (this._callback) {
                this._callback(null, data);
            }
        }.bind(this));
    };

    _handleError(error) {
        logger('Error failed to make post request. Failed with error', error);
        if (this._callback) {
            this._callback(error, null);
        }
    };

    _setOptions(options) {
        this._host = _.has(options, 'host') ? options.host : null;
        this._path = _.has(options, 'path') ? options.path : null;
        this._headers = _.has(options, 'headers') ? options.headers : null;
        this._payload = _.has(options, 'payload') ? options.payload : null;
        this._port = _.has(options, 'port') ? options.port : null;
        this._method = _.has(options, 'method') ? options.method : null;
    };

    _createRestOptions() {
        let options = {};
        if (this._host) {
            options.host = this._host;
        }

        if (this._path) {
            options.path = this._path;
        }

        if (this._headers) {
            options.headers = this._headers;
        }

        if (this._port) {
            options.port = this._port;
        }

        if (this._method) {
            options.method = this._method;
        }

        return options;
    };
}

module.exports = RestHandler;
