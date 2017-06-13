'use strict';

const Throttler = require('./../utils/throttler');
const logger = require('./../utils/logger');
const jsonResponse = require('./../utils/json-response');
const lattisErrors = require('./../errors/lattis-errors');


module.exports = {
    _throttler: new Throttler(),

    handleRequest(res, req, throttleType) {
        const identifier = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        if (this._throttler.throttle(identifier, throttleType)) {
            logger(identifier, 'has been throttled. Cannot complete request with throttle type', throttleType);
            const error = lattisErrors.apiLimitExceeded(true);
            jsonResponse(res, error.code, error, null);
            return false;
        }

        return true;
    }
};
