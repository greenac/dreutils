'use strict';

const crypto = require('crypto');

module.exports = {
    _saltLength: 16,

    _saltSet: '0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ',

    /*
     * gets a new hash for password and salt
     * @param {Function} Callback with params {boolean}
     */
    newHash: function(pwToHashAndSalt, done) {
        this._createHash(pwToHashAndSalt, this._salt(), done);
    },

    /*
     * creates a new hash for password using sha256 and hexadecimal digest
     * @param {Function} Callback with params {saltObject}
     */
    _createHash: function(password, salt, done) {
        const saltedPW = crypto.createHash('sha256').update(salt + password).digest("hex");
        done(salt + saltedPW);
    },

    /*
     * Verifies an incoming password
     * @param {Function} Callback with params {boolean}
     */
    verify: function(incomingPW, hashedPw, done) {
        this._createHash(incomingPW, this._getSalt(hashedPw), function(newHash) {
            done(newHash === hashedPw);
        });
    },

    /*
     * creates a new salt for password of Admin User
     * @param {Value} Salt
     */
    _salt: function() {
        let saltString = '';
        for(let i = 0; i < this._saltLength; i++) {
            let target = Math.floor(Math.random() * this._saltSet.length);
            saltString += this._saltSet[target];
        }

        return saltString;
    },

    /*
     * Gets the new salt for password of Admin User
     * @param {Value} Salt
     */
    _getSalt: function(hashedAndSaltedPassword) {
        return hashedAndSaltedPassword.substring(0, this._saltLength);
    }
};
