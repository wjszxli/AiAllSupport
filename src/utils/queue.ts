import PQueue from 'p-queue';

const requestQueues: { [topicId: string]: PQueue } = {};

export const getTopicQueue = (topicId: string, options = {}): PQueue => {
    if (!requestQueues[topicId]) requestQueues[topicId] = new PQueue(options);
    return requestQueues[topicId];
};
