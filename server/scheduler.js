// const sendsms = require('./sendsms');

// // Function to add a delay and then execute the SMS sending
// const sendSmsWithDelay = async (shiftType) => {
//     console.log('Waiting 20 seconds before sending SMS...');
//     setTimeout(async () => {
//         console.log(`Sending ${shiftType} shift SMS now`);
//         await sendsms(shiftType); // Call the sendsms function with 'morning' or 'night'
//     }, 20000); // 20 seconds delay
// };

// // Call the function to test
// sendSmsWithDelay('morning'); // For testing morning shift
// sendSmsWithDelay('night');   // For testing night shift
const { sendsms } = require('./sendsms');

// Function to add a delay and then execute the SMS sending
const sendSmsWithDelay = async (shiftType) => {
    console.log(`Waiting 20 seconds before sending ${shiftType} shift SMS...`);
    return new Promise((resolve) => {
        setTimeout(async () => {
            console.log(`Sending ${shiftType} shift SMS now`);
            try {
                await sendsms(shiftType);
                resolve();
            } catch (error) {
                console.error(`Error sending ${shiftType} shift SMS:`, error);
                resolve();
            }
        }, 20000); // 20 seconds delay
    });
};

// Call the function to test
(async () => {
    await sendSmsWithDelay('morning');
    await sendSmsWithDelay('night');
})();