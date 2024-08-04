const twilio = require('twilio');
const mongoose = require('mongoose');
require('dotenv').config();

// Create a Twilio client instance
const client = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// MongoDB models
const MorningShift = require('./models/MorningShift');
const NightShift = require('./models/NightShift');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const getStartAndEndOfToday = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end };
};

// Shift type translation mapping
const shiftTypeTranslation = {
    morning: 'الصباح',
    night: 'الليل'
};

// Function to send SMS with daily patient count and revenue
const sendsms = async (shiftType) => {
    try {
        const { start, end } = getStartAndEndOfToday();
        let patientCount, totalRevenue;

        if (shiftType === 'morning') {
            patientCount = await MorningShift.countDocuments({ date: { $gte: start, $lte: end } });
            const revenue = await MorningShift.aggregate([
                { $match: { date: { $gte: start, $lte: end } } },
                { $group: { _id: null, totalRevenue: { $sum: "$تم_دفع" } } }
            ]);
            totalRevenue = revenue[0]?.totalRevenue || 0;
        } else if (shiftType === 'night') {
            patientCount = await NightShift.countDocuments({ date: { $gte: start, $lte: end } });
            const revenue = await NightShift.aggregate([
                { $match: { date: { $gte: start, $lte: end } } },
                { $group: { _id: null, totalRevenue: { $sum: "$تم_دفع" } } }
            ]);
            totalRevenue = revenue[0]?.totalRevenue || 0;
        } else {
            throw new Error('Invalid shift type');
        }

        // Translate shiftType to Arabic
        const arabicShiftType = shiftTypeTranslation[shiftType] || 'غير معروف';

        const message = await client.messages.create({
            body: `التقرير اليومي: عدد المرضى في فترة ${arabicShiftType} هو ${patientCount}. إجمالي الإيرادات هو ${totalRevenue} جنيه مصري.`,
            from: process.env.TWILIO_PHONE_NUMBER, // Your Twilio phone number
            to: '+201273400555' // Recipient's phone number
        });

        console.log('SMS sent:', message.sid);
    } catch (error) {
        console.error('Error sending SMS:', error);
    }
};

module.exports = sendsms;
