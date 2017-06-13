'use strict';

const _ = require('underscore');


const EARTH_RADIUS = 6371009.0;

/**
 * This method returns the distance between two points on a great circle in meters.
 *
 * @param {object} point1
 * @param {object} point2
 * @returns {number}
 */
const distanceBetweenPoints = function(point1, point2) {
    const dLat = degreesToRadians(point2.latitude-point1.latitude);
    const dLon = degreesToRadians(point2.longitude-point1.longitude);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(degreesToRadians(point1.latitude)) * Math.cos(degreesToRadians(point2.latitude)) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return EARTH_RADIUS * c;
};

/**
 * Converts a number from degrees to radians
 *
 * @param {number} degreeValue - number in degrees
 * @returns {number}
 */
const degreesToRadians = function(degreeValue) {
    return degreeValue * Math.PI / 180.0;
};

/**
 * Converts a value in radians to degrees.
 *
 * @param radianValue
 * @returns {number}
 */
const radiansToDegrees = function(radianValue) {
    return radianValue * 180.0 / Math.PI;
};

/**
 * Creates a random point
 *
 * @returns {{latitude: number, longitude: number}}
 */
const createPoint = function() {
    const latitudeSign = Math.floor(Math.random()*2)%2;
    const longitudeSign = Math.floor(Math.random()*2)%2;

    const latitude = Math.random()*90;
    const longitude = Math.random()*180;

    return {
        latitude: latitudeSign === 0 ? latitude : -1*latitude,
        longitude: longitudeSign === 0 ? longitude : -1*longitude
    };
};

/**
 * This method returns a point near a given location.
 *
 * @param {object} location
 * @returns {{latitude: *, longitude: *}}
 */
const getNearByPoint = function(location) {
    const distance = 0.002;

    const latitudeSign = Math.floor(Math.random()*2)%2;
    const longitudeSign = Math.floor(Math.random()*2)%2;

    const latitudeMultiplier = Math.floor(Math.random()*10);
    const longitudeMultiplier = Math.floor(Math.random()*10);

    return {
        latitude:location.latitude + latitudeMultiplier * distance * (latitudeSign === 0 ? 1 : -1),
        longitude: location.longitude + longitudeMultiplier * distance * (longitudeSign === 0 ? 1 : -1)
    };
};

/**
 * This method gets a random point in a given box.
 *
 * @param {object} northEast
 * @param {object} southWest
 * @returns {{latitude: number, longitude: *}}
 */
const getRandomPointInBox = function(northEast, southWest) {
    const dLatitude = northEast.latitude - southWest.latitude;
    const dLongitude = northEast.longitude - southWest.longitude;

    return {
        latitude: southWest.latitude + Math.random() * dLatitude,
        longitude: southWest.longitude + Math.random() * dLongitude
    };
};


/**
 * Gets mid point of an array of latitude, longitude objects.
 *
 * @param points
 * @returns {{latitude: number, longitude: number}}
 */
const getMidPoint = function(points) {
    let latitude = 0.0;
    let longitude = 0.0;

    _.each(points, function(point) {
        latitude += point.latitude;
        longitude += point.longitude;
    });

    return {
        latitude: latitude / points.length,
        longitude: longitude / points.length
    };
};


/**
 * This method will calculate a random point on a circle that is defined by
 *  its radius and center.
 *
 * @param {Number} radius Raidus of the circle in meters
 * @param {Object} centerPoint Point with latitude and longitude of the circle's center
 *
 * @returns {Object} {{latitude: number, longitude: number}}
 */
const getRandomPointOnCircle = function(radius, centerPoint) {
    const theta = degreesToRadians(Math.random() * 360);
    const arc = radius/EARTH_RADIUS;
    const latitude = Math.asin(Math.sin(degreesToRadians(centerPoint.latitude)) * Math.cos(arc)
        + Math.cos(degreesToRadians(centerPoint.latitude)) * Math.sin(arc) * Math.cos(theta));
    const longitude = Math.atan2(
        Math.sin(theta) * Math.sin(arc) * Math.cos(degreesToRadians(centerPoint.latitude)),
        Math.cos(arc) - Math.sin(centerPoint.latitude) * Math.sin(latitude)
    );

    return {
        latitude: radiansToDegrees(latitude),
        longitude: radiansToDegrees(longitude) + centerPoint.longitude
    }
};

/**
 * This method will calculate a random point on a polygon that is defined by
 *  its coordinates.
 *
 * @param {Array} polygonCoordinates
 * ex:[
 [-77.031669, 38.878605],
 [-77.029609, 38.881946],
 [-77.020339, 38.884084],
 [-77.025661, 38.885821],
 [-77.021884, 38.889563],
 [-77.019824, 38.892368]
 ]
 *
 * @returns {Object} {{latitude: number, longitude: number}}
 */
const getRandomPointPolygon = function(polygonCoordinates) {
    let bbox = createBoundingBox(polygonCoordinates);
    const latitude = bbox[1] + (Math.random() * (bbox[3] - bbox[1]));
    const longitude = bbox[0] + (Math.random() * (bbox[2] - bbox[0]));
    return {
        randomPoint: {latitude: latitude, longitude: longitude},
        isInside: checkWithinBounds(polygonCoordinates, [longitude, latitude])
    };
};



/**
 * This method will create a bounding box that is defined by
 *  polygon coordinates.
 *
 * @param {Number} polygonCoordinates - Coordinates of the polygon
 *
 * @returns {Array} [ 39.984,-75.833,39.284, -75.833]]
 */
const createBoundingBox = function(polygonCoordinates){
    let bbox = [Infinity, Infinity, -Infinity, -Infinity];
    _.each(polygonCoordinates, function (coord) {
        if (bbox[0] > coord[0]) {
            bbox[0] = coord[0];
        }

        if (bbox[1] > coord[1]) {
            bbox[1] = coord[1];
        }

        if (bbox[2] < coord[0]) {
            bbox[2] = coord[0];
        }

        if (bbox[3] < coord[1]) {
            bbox[3] = coord[1];
        }
    });

    return bbox;
};

/**
 * This method check within the bounds  that is defined by
 *  polygon coordinates and point.
 *
 * @param {Array} polygonCoordinates - Coordinates of the polygon
 * @param {Array} point - Points to check with in the bounds or not.
 * @returns {Boolean} true/false
 */
const checkWithinBounds = function(polygonCoordinates,point){
    let isInside = false;
    for (let i = 0, j = polygonCoordinates.length - 1; i < polygonCoordinates.length; j = i++) {
        const xi = polygonCoordinates[i][0], yi = polygonCoordinates[i][1];
        const xj = polygonCoordinates[j][0], yj = polygonCoordinates[j][1];
        const intersect = ((yi > point[1]) !== (yj > point[1])) &&
            (point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }

    return isInside;
};

module.exports = {
    createPoint: createPoint,
    getNearByPoint: getNearByPoint,
    getRandomPointInBox: getRandomPointInBox,
    distanceBetweenPoints: distanceBetweenPoints,
    getRandomPointOnCircle: getRandomPointOnCircle,
    getMidPoint: getMidPoint,
    getRandomPointPolygon : getRandomPointPolygon,
    createBoundingBox :createBoundingBox,
    checkWithinBounds : checkWithinBounds
};
