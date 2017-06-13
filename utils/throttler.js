'use strict';

const throttleTypes = require('./../constants/throttle-types');
const logger = require('./../utils/logger');
const _ = require('underscore');
const lattisExceptions = require('./../errors/lattis-exceptions');


class Throttler {
    constructor() {
        this._times = {};
        this._limits = {};
        this._interval = 5000;
        this._penaltyPeriod = 60000;
        this._enforcedPenalties = {};
        this._setLimits();
    };

    /**
     * This method determines if a throttle should be applied for
     * a particular identifier and throttle type.
     *
     * @param {string || number} identifier
     * @param {string} throttleType
     * @returns {boolean}
     */
    throttle(identifier, throttleType) {
        if (this._hasBeenThrottled(identifier, throttleType)) {
            return true;
        }

        this._addThrottle(identifier, throttleType);
        return this._shouldThrottle(identifier, throttleType);
    };

    /**
     * Sets the throttle cutoff limits on initialization.
     *
     * @private
     */
    _setLimits() {
        this._limits[throttleTypes.signInCode] = 5;
        this._limits[throttleTypes.signInConformation] = 5;
        this._limits[throttleTypes.sendEmergencyMessage] = 5;
        this._limits[throttleTypes.newTokens] = 5;
        this._limits[throttleTypes.refreshTokes] = 5;
        this._limits[throttleTypes.forgotPasswordCode] = 5;
        this._limits[throttleTypes.forgotPasswordConfirmation] = 5;
        this._limits[throttleTypes.updatePasswordCode] = 5;
        this._limits[throttleTypes.updatePasswordConfirmation] = 5;
        this._limits[throttleTypes.updatePhoneNumberCode] = 5;
        this._limits[throttleTypes.updatePhoneNumberConfirmation] = 5;
        this._limits[throttleTypes.emailVerificationCode] = 5;
        this._limits[throttleTypes.confirmEmailVerificationCode] = 5;
    };

    /**
     * This method updates the throttle information. It also prunes old throttle data points.
     *
     * @param {string || number} identifier
     * @param {string} throttleType
     * @private
     */
    _addThrottle(identifier, throttleType) {
        if (!_.has(this._limits, throttleType)) {
            logger('Error: throttle type:', throttleType, 'is not supported');
            throw new lattisExceptions('UnknownThrottleType ' + throttleType.toString() + ' is not supported');
        }

        if (!_.has(this._times, identifier)) {
            this._times[identifier] = {};
        }

        if (_.has(this._times[identifier], throttleType)) {
            let throttleTimes = this._times[identifier][throttleType];
            throttleTimes.unshift((new Date).getTime());
            this._times[identifier][throttleType] = throttleTimes;
        } else {
            this._times[identifier][throttleType] = [(new Date).getTime()];
        }
    };

    /**
     * This method determines if a throttle should be applied.
     *
     * @param {string || number} identifier
     * @param {string} throttleType
     * @returns {boolean}
     * @private
     */
    _shouldThrottle(identifier, throttleType) {
        let times = this._times[identifier][throttleType];
        if (times.length < this._limits[throttleType]) {
            return false;
        }

        const currentTime = (new Date).getTime();
        for (let i=times.length - 1; i >= 0; i--) {
            if (currentTime - times[i] > this._interval) {
                times.pop();
            }
        }

        if (times.length >= this._limits[throttleType]) {
            if (!_.has(this._enforcedPenalties, identifier)) {
                this._enforcedPenalties[identifier] = {};
            }

            logger('Starting to throttle:', identifier, 'for throttle type:', throttleType);
            this._enforcedPenalties[identifier][throttleType] = (new Date).getTime();
            return true;
        }

        return false;
    };

    /**
     * This method checks to see if an identifier and throttle type are currently throttled.
     *
     * @param {string || number} identifier
     * @param {string} throttleType
     * @returns {boolean}
     * @private
     */
    _hasBeenThrottled(identifier, throttleType) {
        if (_.has(this._enforcedPenalties, identifier) &&
            _.has(this._enforcedPenalties[identifier], throttleType) &&
            !!this._enforcedPenalties[identifier][throttleType]
        ) {
            const throttleTime = this._enforcedPenalties[identifier][throttleType];
            const elapsedTime = (new Date).getTime() - throttleTime;
            if (elapsedTime < this._penaltyPeriod) {
                logger(
                    identifier,
                    'has been throttled for type:',
                    throttleType,
                    'time remaining:',
                    this._penaltyPeriod - elapsedTime
                );
                return true;
            } else {
                delete this._enforcedPenalties[identifier][throttleType];
            }
        }

        return false;
    };
}

module.exports = Throttler;
