'use strict';

const QueueNode = require('./queue-node');


class FifoQueue {
    /**
     * This is the initializer for a queue instance.
     */
    constructor() {
        this._head = null;
        this._tail = null;
        this._count = 0;
    };

    /**
     * This method adds an item to the queue.
     *
     * @param {*} payload
     */
    enqueue(payload) {
        this._count += 1;
        const node = new QueueNode(payload);
        if (!this._head) {
            this._head = node;
            this._tail = node;
            return;
        }

        const lastNode = this._tail;
        lastNode.next = node;
        node.previous = lastNode;
        this._tail = node;
    };

    /**
     * This method removes and returns a nodes payload from the front of the queue.
     *
     * @returns {*}
     */
    deQueue() {
       if (!this._head) {
           return null;
       }

       const firstNode = this._head;
       if (!!firstNode.next) {
           firstNode.next.previous = null;
           this._head = firstNode.next;
       } else {
           this._head = null;
           this._tail = null;
       }

       this._count -= 1;

       return firstNode.payload;
    };

    /**
     * This method removes and returns the payloads from the given number
     * of entries from the front of the queue.
     *
     * @param numberOfEntries
     * @returns {Array}
     */
    deQueueMultiple(numberOfEntries) {
        const count = numberOfEntries > this._count ? this._count : numberOfEntries;
        let payloads = [];
        let index = 0;
        while (index < count) {
            payloads.push(this.deQueue());
            index += 1;
        }

        return payloads;
    };

    /**
     * This method returns an array of all the payloads in the queue.
     *
     * @returns {Array}
     */
    allPayloads() {
        let payloads = [];
        if (!this._head) {
            return payloads;
        }

        let node = this._head;
        while (!!node) {
            payloads.push(node.payload);
            node = node.next;
        }

        return payloads;
    }

    /**
     * This method returns the number of items in the queue.
     *
     * @returns {number}
     */
    count() {
        return this._count;
    };
}

module.exports = FifoQueue;
