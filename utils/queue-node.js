'use strict';

class QueueNode {
    constructor(payload) {
        this.next = null;
        this.previous = null;
        this.payload = payload;
    };

    fifoRemove() {
        if (this.next) {

        }
    };
}

module.exports = QueueNode;
