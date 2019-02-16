const mesg = require('mesg-js').application();
const fs = require('fs');

const addresses = JSON.parse(fs.readFileSync('./resources/addresses.json'));
const contract = JSON.parse(fs.readFileSync('./resources/contract.json'));

const getBalance = a => {
  return mesg.executeTaskAndWaitResult({
    serviceID: "ethereum-erc20",
    taskKey: "balanceOf",
    inputData: JSON.stringify({
      address: a,
      contractAddress: contract
    })
  })
    .then(result => {
      return JSON.parse(result.outputData);
    })
    .catch(err => {
      console.error(`Error occured during getBalance: ${err}`);
  });
};

const ipfsAdd = str => {
  return mesg.executeTaskAndWaitResult({
    serviceID: "service-ipfs",
    taskKey: "add",
    inputData: JSON.stringify({
      str: str
    })
  })
    .then(result => {
      return JSON.parse(result.outputData);
    })
    .catch(err => {
      console.error(`Error occured during ipfs add: ${err}`);
  });
};

const ipfsPublish = (topic, msg) => {
  return mesg.executeTaskAndWaitResult({
    serviceID: "service-ipfs",
    taskKey: "publish",
    inputData: JSON.stringify({
      topic: topic,
      message: msg
    })
  })
    .then(result => {
      return JSON.parse(result.outputData);
    })
    .catch(err => {
      console.error(`Error occured during ipfs publish: ${err}`);
  }) ;
};

mesg.listenEvent({
  serviceID: 'ethereum-erc20',
  eventFilter: 'transfer'
})
  .on('data', ({ eventKey, eventData }) => {
    const event = JSON.parse(eventData);

    console.log(`${event.from} --> ${event.to}`);

    const from = addresses.filter(address => address === event.from);
    const to = addresses.filter(address => address === event.to);

    // For demonstration purposes, we are monitoring all addresses.
    // This can be changed by changing the two following comments.
    if (
      // from.length || to.length
      true
    ) {
      // const a = from.concat(to);
      const a = [event.to];

      a.map(address => {
        console.log(`Received a transfer relating to watched address: ${address}`);
        // mesg.emitEvent('balanceChanged', {address: address, transfer: event});

        getBalance(address)
          .then(({ balance }) => {
          const record = {
            transfer: event,
            address: address,
            balance: balance
          };
          return ipfsAdd(JSON.stringify(record, null, 2));
        })
          .then(({ result }) => {
          return Promise.all(
            result.map(h => {
              return ipfsPublish(address, h.hash);
          }));
        })
          .then(results => {
            results.map(({ topic, message }) => {
              console.log(`Published on ${topic} : ${message}`);
            });

        }).catch(err => console.error(err));


        // // Add to IPFS
        // ipfsAdd(JSON.stringify(record, null, 2))
        //   .then(addResult => {
        //     console.log(`add result: ${JSON.stringify(addResult)}`);
        //     const hash = addResult[0].hash;
        //     console.log(`Record written to: ${hash}`);
        //     return ipfsPublish(address, hash);
        //   })
        //   .then(publishResult => {
        //     console.log(`Notification published to: ${address}`);
        //   });
      });
    }
  })
  .on('error', error => console.error(error));
