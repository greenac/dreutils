'use strict';

const request = require('request');
const logger = require('./../utils/logger');
const _ = require('underscore');
const config = require('../config');
const lattisErrors = require('./../errors/lattis-errors');


/**
 * This method gets address data for a given coordinate.
 *
 * @param {Object} coordinate - An object with keys latitude and longitude
 * @param {Function} done - Callback function
 */
const getAddressInformationForCoordinate = function(coordinate, done) {
    const query = coordinate.longitude.toString() + "," + coordinate.latitude.toString();
    request({
        url: config.mapBox.geoCodingBaseUrl + query + '.json?access_token=' + config.mapBox.apiToken,
        method: 'GET'
    }, function (error, response, body) {
        if (error) {
            logger('Error: failed to get address data from map box with error:', error);
            done(error, null);
            return;
        }

        const mapBoxData = JSON.parse(body);
        if (!_.has(mapBoxData, 'features') || mapBoxData.features.length === 0) {
            logger('Error: map box api has returned response with no features');
            done(null, null);
            return;
        }

        let addressInfo = {};
        _.each(mapBoxData.features, function(feature) {
            if (feature.id.indexOf('address') !== -1) {
                addressInfo.street = feature.text;
                addressInfo.address = feature.address;
            } else if (feature.id.indexOf('place') !== -1) {
                addressInfo.city = feature.text
            } else if (feature.id.indexOf('postcode') !== -1) {
                addressInfo.zipCode = feature.text;
            } else if (feature.id.indexOf('region') !== -1) {
                addressInfo.state = feature.text;
            } else if (feature.id.indexOf('country') !== -1) {
                addressInfo.country = feature.text;
            }
        });

        done(null, addressInfo);
    });
};

/**
 * This method will fetch direction for a given input of two coordinates.
 *
 * @param {object} coordinates - {latitude, longitude} object for keys `to` and `from`
 * @param {Function} done
 */
const getDirectionsBetweenCoordinates = function(coordinates, done) {
    if (!_.has(coordinates, 'to') || !_.has(coordinates, 'from')) {
        logger('Could not fetch map box directions between coordinates.',
            'The coordinates object parameter does not contain the proper keys'
        );
        throw lattisErrors.missingParameter(false);
    }

    const query = coordinates.to.longitude.toString() + "," + coordinates.to.latitude.toString()
        + ';' + coordinates.from.longitude.toString() + "," + coordinates.from.latitude.toString();
    const url = config.mapBox.directionsBaseUrl + query + '?steps=true&access_token='
        + config.mapBox.apiToken;

    request({
        url: url,
        method: 'GET'
    }, function (error, response, body) {
        if (error) {
            logger('Error: failed to get directions data from map box with error:', error);
            done(error, null);
            return;
        }

        // TODO: When we have a better picture of how directions will be used (in the lattis-app),
        // we should probably send more information though this REST call than the parameters
        // we are currently parsing.
        const directions = JSON.parse(body);
        let steps = [];
        _.each(directions.routes[0].legs[0].steps, function(step) {
            steps.push({
                longitude: step.maneuver.location[0],
                latitude: step.maneuver.location[1],
                duration: step.duration,
                name: step.name,
                distance: step.distance,
                instruction: step.maneuver.instruction
            });
        });

        done(null, steps);
    });
};

module.exports = {
    getAddressInformationForCoordinate: getAddressInformationForCoordinate,
    getDirectionsBetweenCoordinates: getDirectionsBetweenCoordinates
};
