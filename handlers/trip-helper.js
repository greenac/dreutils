'use strict';

const _ = require('underscore');
let pointHandler = require('./point-handler');


/**
 * This method will calculate trip distance for particular trip
 *
 * @param {Object} trip - trip detail to calculate distance
 */
const getTripDistance = function(trip) {
    let steps = trip.steps;
    if (!steps || steps.length < 2) {
        return 0.0;
    }

    let distance = 0.0;
    let previousPoint = null;
    steps = JSON.parse(steps);
    _.each(steps, function (step) {
        if (previousPoint) {
            distance += pointHandler.distanceBetweenPoints(previousPoint, step.point);
        }

        previousPoint = step.point;
    });

    return distance;
};

/**
 * This method will calculate trip duration for particular trip
 *
 * @param {Object} trip - trip detail to calculate duration
 */
const getTripDuration = function(trip) {
    if (!trip.steps || trip.steps.length < 2) {
        return 0.0;
    }
    trip.steps = JSON.parse(trip.steps);
    return trip.steps[trip.steps.length - 1].time - trip.steps[0].time;
};


module.exports = {
    getTripDistance: getTripDistance,
    getTripDuration: getTripDuration
};
