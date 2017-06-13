'use strict';


const crypto = require('crypto');
const logger = require('./../utils/logger');
const config = require('./../config');
const Elliptic = require('elliptic').ec;


module.exports = {
    /**
     * Length of the salt for passwords.
     */
    _saltLength: 16,

    /**
     * Set of characters used when creating a salt for passwords.
     */
    _saltSet: '0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ',

    /**
     * The encryption algorithm used in the `crypto` module.
     */
    _ellipticalEncryptionAlgorithm: 'prime256v1',

    /**
     * The encryption algorithm used in the `crypto` module.
     */
    _cipherEncryptionAlgorithm: 'aes-256-ecb',

    /**
     * The encoding used when encrypting data.
     */
    _encryptionEncoding: 'hex',

    /**
     * The decryption used when decrypting data.
     */
    _decryptionEncoding: 'utf8',

    _elliptic: null,

    /**
     * This method initializes the elliptic object.
     *
     * @returns {object}
     * @private
     */
    _getElliptic: function() {
        if (!this._elliptic) {
            this._elliptic = new Elliptic('p256');
        }

        return this._elliptic;
    },

    /**
     * This method creates and returns public and private elliptical keys.
     *
     * @returns {{publicKey: string, privateKey: string}}
     */
    getNewEllipticalKeys: function() {
        // const keyCreator = crypto.createECDH(this._ellipticalEncryptionAlgorithm);
        // keyCreator.generateKeys(this._encryptionEncoding);
        //
        // return {
        //     publicKey: keyCreator.getPublicKey(this._encryptionEncoding),
        //     privateKey: keyCreator.getPrivateKey(this._encryptionEncoding)
        // };

        const keys = this._getElliptic().genKeyPair();
        return {
            privateKey: keys.priv.toString('hex'),
            publicKey: keys.getPublic('hex')
        };
    },

    /**
     * This method will generate a public key for a given private key.
     * @param {string} privateKey
     * @param {boolean} trimKey determines wether the DER byte 0x04 should be removed
     * @returns {string} - The public key in hex format
     */
    publicKeyForPrivateKey: function(privateKey, trimKey=true) {
        // const keyCreator = crypto.createECDH(this._ellipticalEncryptionAlgorithm);
        // keyCreator.setPrivateKey(privateKey, this._encryptionEncoding);
        // return keyCreator.getPublicKey(this._encryptionEncoding);
        const key = this._getElliptic().keyFromPrivate(privateKey);
        let publicKey = key.getPublic('hex').toString('hex');
        if (trimKey && publicKey.length === 130) {
            publicKey = publicKey.substring(2, publicKey.length);
        }

        return publicKey;
    },

    /**
     * Encrypts a value for transfer on the wire or storage in database.
     *
     * @param {string} value - Value to encrypt
     * @param {string} publicKey
     * @param {string} privateKey
     * @returns {string} - The encrypted value of the original value
     */
    encryptValue: function(value, publicKey, privateKey) {
        const cipher = crypto.createCipher(
            this._cipherEncryptionAlgorithm,
            this._ellipticalSecret(publicKey, privateKey).toString('utf8')
        );

        return cipher.update(
                value,
                this._decryptionEncoding,
                this._encryptionEncoding
            ) + cipher.final(this._encryptionEncoding);
    },

    /**
     * Decrypts a value.
     *
     * @param {string} encryptedValue
     * @param {string} publicKey
     * @param {string} privateKey
     * @returns {string}
     */
    decryptedValue: function(encryptedValue, publicKey, privateKey) {
        const decipher = crypto.createDecipher(
            this._cipherEncryptionAlgorithm,
            this._ellipticalSecret(publicKey, privateKey).toString('utf8')
        );

        return decipher.update(
                encryptedValue,
                this._encryptionEncoding,
                this._decryptionEncoding
            ) + decipher.final(this._decryptionEncoding);
    },

    /**
     * Encrypts a value for the database.
     *
     * @param {string} value
     * @returns {*|string}
     */
    encryptDbValue: function(value) {
        return this.encryptValue(
            value,
            config.ellipticalKeys.database.publicKey,
            config.ellipticalKeys.database.privateKey
        );
    },

    /**
     * Decrypts a value from the database.
     *
     * @param {string} encryptedValue
     * @returns {*|string}
     */
    decryptDbValue: function(encryptedValue) {
        return this.decryptedValue(
            encryptedValue,
            config.ellipticalKeys.database.publicKey,
            config.ellipticalKeys.database.privateKey
        );
    },

    /**
     * This method
     *
     * @param publicKey
     * @param privateKey
     * @returns {string}
     * @private
     */
    _ellipticalSecret: function(publicKey, privateKey) {
        const keyCreator = crypto.createECDH(this._ellipticalEncryptionAlgorithm);
        keyCreator.setPrivateKey(privateKey, this._encryptionEncoding);
        return keyCreator.computeSecret(publicKey, this._encryptionEncoding);
    },

    /**
     * This method elliptically signs the message passed in.
     *
     * @param {Buffer} message
     * @param {string} privateKey
     */
    ellipticallySign: function(message, privateKey) {
        const ec = this._getElliptic();
        const key = ec.keyFromPrivate(privateKey, 'hex');
        return key.sign(message);
    },

    /**
     * This method creates a new password hash.
     *
     * @param {string} pwToHashAndSalt
     * @returns {string}
     */
    newPassword: function(pwToHashAndSalt) {
        return this._createHash(pwToHashAndSalt, this._salt());
    },


    /**
     * This method creates a new password hash.
     *
     * @param password
     * @param salt
     * @returns {string}
     * @private
     */
    _createHash: function(password, salt) {
        const saltedPW = this.sha256Hash(salt + password);
        return salt + saltedPW;
    },

    sha256Hash: function(textToHash) {
        return crypto.createHash('sha256').update(textToHash).digest(this._encryptionEncoding);
    },

    /**
     * This method verifies a plain text password against a hashed password.
     *
     * @param incomingPW
     * @param hashedPw
     * @returns {boolean}
     */
    verifyPassword: function(incomingPW, hashedPw) {
        return this._createHash(incomingPW, this._getSalt(hashedPw)) === hashedPw;
    },

    /**
     * This method assembles a salt for password hashing.
     *
     * @returns {string}
     * @private
     */
    _salt: function() {
        let saltString = '';
        let target;
        for(let i = 0; i < this._saltLength; i++) {
            target = Math.floor(Math.random() * this._saltSet.length);
            saltString += this._saltSet[target];
        }

        return saltString;
    },

    /**
     * This method extracts the salt from a password that has been hashed and salted.
     *
     * @param {string} hashedAndSaltedPassword
     * @returns {string}
     * @private
     */
    _getSalt: function(hashedAndSaltedPassword) {
        return hashedAndSaltedPassword.substring(0, this._saltLength);
    },

    /**
     * This method converts a hexadecimal string into a ascii string.
     *
     * @param hexString
     * @returns {string}
     */
    hex2ascii: function(hexString) {
        let asciiString = '';
        for (let i=0; i < hexString.length; i += 2) {
            asciiString += String.fromCharCode(parseInt(hexString.substr(i, 2), 16));
        }

        return asciiString;
    }
};
