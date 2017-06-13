'use strict';

const sendmail = require('sendmail')();
const config = require('./../config');

module.exports = {
    sendMail: function(recipientLattisUser, resetCode, callback) {
        sendmail({
            from: config.verificationMail.senderEmail,
            to: recipientLattisUser,
            subject: 'Lattis Verification Code',
            text: resetCode
        }, function (err, reply) {
            callback(err, reply);
        });
    }
};
