const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const session = require('express-session');
const MorningShift = require('./models/MorningShift');
const NightShift = require('./models/NightShift');
require('dotenv').config();
const moment = require('moment-timezone');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ 
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://management-system52.vercel.app' 
    : 'http://localhost:3001', 
  credentials: true 
}));
app.use(bodyParser.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret_key',
  resave: false,
  saveUninitialized: false,
    cookie: { 
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

const users = [
    { username: 'morning', password: 'MorningShift821', userType: 'firstUser' },
    { username: 'night', password: 'NightShift821', userType: 'secondUser' },
    { username: 'Doctor', password: 'Doctor402', userType: 'doctor' },
    { username: 'owner', password: 'owner', userType: 'owner'}
];

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Function to convert date to UTC
const convertToUTC = (dateStr) => {
  let date = new Date(dateStr);
  date = new Date(date + " UTC");
  return date.toISOString();
};

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  console.log('Received username:', username);
  console.log('Received password:', password);

  const user = users.find(user => user.username === username && user.password === password);

  if (user) {
    req.session.user = { username: user.username, userType: user.userType };
    return res.json({ userType: user.userType });
  }
  return res.status(401).json({ message: 'Invalid credentials' });
});



app.get('/check-auth', (req, res) => {
    if (req.session.user) {
        res.json({ authenticated: true, userType: req.session.user.userType });
    } else {
        res.json({ authenticated: false });
    }
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
      if (err) {
          return res.status(500).json({ message: 'Failed to log out' });
      }
      res.clearCookie('connect.sid'); // Clear session cookie if used
      res.status(200).json({ message: 'Logged out successfully' });
  });
});

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ message: 'Unauthorized' });
    }
};

// Route for submitting morning shift data
app.post('/submit-morning', isAuthenticated, async (req, res) => {
    if (req.session.user.userType !== 'firstUser') {
      return res.status(403).json({ message: 'Access denied' });
    }
  
    const { الاسم, رقم_الغرفة, تم_دفع, متبقي, موعد_الدخول, موعد_الخروج } = req.body;
  
    try {
      const userData = new MorningShift({
        الاسم,
        رقم_الغرفة,
        تم_دفع,
        متبقي,
        موعد_الدخول: convertToUTC(موعد_الدخول),
        موعد_الخروج: convertToUTC(موعد_الخروج),
        date: new Date() 
      });
  
      console.log('Morning shift data to save:', userData);
  
      await userData.save();
      res.status(200).send('Morning shift data saved successfully');
    } catch (error) {
        console.error('Error:', error.message); // Log detailed errors
        res.status(500).json({ message: `Error: ${error.message}` });
      }
  });

// Route for submitting night shift data
app.post('/submit-night', isAuthenticated, async (req, res) => {
  if (req.session.user.userType !== 'secondUser') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const { الاسم, رقم_الغرفة, تم_دفع, متبقي, موعد_الدخول, موعد_الخروج } = req.body;

  try {
    const userData = new NightShift({
      الاسم,
      رقم_الغرفة,
      تم_دفع,
      متبقي,
      موعد_الدخول: convertToUTC(موعد_الدخول),
      موعد_الخروج: convertToUTC(موعد_الخروج),
      date: new Date() 
    });

    console.log('Night shift data to save:', userData);

    await userData.save();
    res.status(200).send('Night shift data saved successfully');
  } catch (error) {
    console.error('Error saving night shift data:', error);
    res.status(500).send(`Error saving data: ${error.message}`);
  }
});

app.get('/daily-revenue', isAuthenticated, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of the day
    const endOfDay = new Date(today).setHours(23, 59, 59, 999); // End of the day

    // Aggregate revenue for morning shift
    const morningRevenue = await MorningShift.aggregate([
      { $match: { date: { $gte: today, $lte: endOfDay } } },
      { $group: { _id: null, totalRevenue: { $sum: "$تم_دفع" } } }
    ]);

    // Aggregate revenue for night shift
    const nightRevenue = await NightShift.aggregate([
      { $match: { date: { $gte: today, $lte: endOfDay } } },
      { $group: { _id: null, totalRevenue: { $sum: "$تم_دفع" } } }
    ]);

    const totalRevenue = (morningRevenue[0]?.totalRevenue || 0) + (nightRevenue[0]?.totalRevenue || 0);

    res.status(200).json({ totalRevenue });
  } catch (error) {
    console.error('Error fetching daily revenue:', error);
    res.status(500).json({ message: `Error: ${error.message}` });
  }
});

app.get('/doctor-dashboard', isAuthenticated, (req, res) => {
  if (req.session.user.userType !== 'doctor') {
    return res.status(403).json({ message: 'Access denied' });
  }

  // Respond with a message or some data for the doctor dashboard
  res.status(200).json({ message: 'Welcome to the Doctor Dashboard' });
});

app.get('/weekly-shift-data', async (req, res) => {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysToLastFriday = (dayOfWeek + 2) % 7; // 0 if it's Friday, 1 if it's Saturday, etc.
    
    const lastFriday = new Date(now);
    lastFriday.setDate(now.getDate() - daysToLastFriday);
    lastFriday.setHours(0, 0, 0, 0); // Set to last Friday 12 AM

    console.log(`Querying from ${lastFriday.toISOString()} to ${now.toISOString()}`);

    // Aggregate revenue and patient count for morning shift
    const morningShiftData = await MorningShift.aggregate([
      { $match: { date: { $gte: lastFriday, $lte: now } } },
      { $group: { _id: null, totalRevenue: { $sum: "$تم_دفع" }, totalPatients: { $sum: 1 } } }
    ]);
    console.log('Morning Shift Data:', morningShiftData);

    // Aggregate revenue and patient count for night shift
    const nightShiftData = await NightShift.aggregate([
      { $match: { date: { $gte: lastFriday, $lte: now } } },
      { $group: { _id: null, totalRevenue: { $sum: "$تم_دفع" }, totalPatients: { $sum: 1 } } }
    ]);
    console.log('Night Shift Data:', nightShiftData);

    res.status(200).json({
      morningShift: {
        totalRevenue: morningShiftData[0]?.totalRevenue || 0,
        totalPatients: morningShiftData[0]?.totalPatients || 0
      },
      nightShift: {
        totalRevenue: nightShiftData[0]?.totalRevenue || 0,
        totalPatients: nightShiftData[0]?.totalPatients || 0
      }
    });
  } catch (error) {
    console.error('Error fetching weekly shift data:', error);
    res.status(500).json({ message: `Error: ${error.message}` });
  }
});

app.get('/weekly-night-shift-data', async (req, res) => {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysToLastFriday = (dayOfWeek + 2) % 7; // 0 if it's Friday, 1 if it's Saturday, etc.
    
    const lastFriday = new Date(now);
    lastFriday.setDate(now.getDate() - daysToLastFriday);
    lastFriday.setHours(0, 0, 0, 0); // Set to last Friday 12 AM

    console.log(`Querying from ${lastFriday.toISOString()} to ${now.toISOString()}`);

    // Aggregate revenue and patient count for night shift
    const nightShiftData = await NightShift.aggregate([
      { $match: { date: { $gte: lastFriday, $lte: now } } },
      { $group: { _id: null, totalRevenue: { $sum: "$تم_دفع" }, totalPatients: { $sum: 1 } } }
    ]);
    console.log('Night Shift Data:', nightShiftData);

    res.status(200).json({
      nightShift: {
        totalRevenue: nightShiftData[0]?.totalRevenue || 0,
        totalPatients: nightShiftData[0]?.totalPatients || 0
      }
    });
  } catch (error) {
    console.error('Error fetching weekly night shift data:', error);
    res.status(500).json({ message: `Error: ${error.message}` });
  }
});


app.get('/api/bi-monthly-revenue', isAuthenticated, async (req, res) => {
  try {
    // Get the current date
    const now = moment().tz('Africa/Cairo');

    // Determine the current two-month period
    const startOfPeriod = now.clone().startOf('month').subtract(now.month() % 2, 'months').startOf('month').toDate();
    const endOfPeriod = now.clone().startOf('month').add(2, 'months').subtract(1, 'day').endOf('day').toDate();

    // Fetch morning shift revenue for the current two-month period
    const morningRevenues = await MorningShift.aggregate([
      { $match: { date: { $gte: startOfPeriod, $lte: endOfPeriod } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, totalRevenue: { $sum: "$تم_دفع" } } }
    ]);

    // Fetch night shift revenue for the current two-month period
    const nightRevenues = await NightShift.aggregate([
      { $match: { date: { $gte: startOfPeriod, $lte: endOfPeriod } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, totalRevenue: { $sum: "$تم_دفع" } } }
    ]);

    res.json({ morningRevenues, nightRevenues });
  } catch (error) {
    console.error('Error fetching bi-monthly revenue:', error);
    res.status(500).send('Error fetching bi-monthly revenue');
  }
});


// server.js or app.js (Node.js with Express)

app.get('/api/shift-data', isAuthenticated, async (req, res) => {
  try {
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    // Calculate the start of the week (Sunday)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    
    // Calculate the end of the week (Saturday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    const morningShifts = await MorningShift.find({ date: { $gte: startOfWeek, $lte: endOfWeek } });
    const nightShifts = await NightShift.find({ date: { $gte: startOfWeek, $lte: endOfWeek } });

    res.status(200).json({ morningShifts, nightShifts });
  } catch (error) {
    console.error('Error fetching shift data:', error);
    res.status(500).json({ message: `Error: ${error.message}` });
  }
});


// Route for deleting a shift
app.put('/api/shift/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const updatedData = req.body;

    // Check if the shift exists
    const shift = await MorningShift.findById(id) || await NightShift.findById(id);
    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }

    // Update the shift record
    Object.assign(shift, updatedData);
    await shift.save();

    res.status(200).json({ message: 'Shift updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating shift', error: error.message });
  }
});

app.get('/upcoming-patients', async (req, res) => {
  try {
    const notifyBeforeDays = 1; // Notify 1 day before leave date
    const today = new Date();
    const notifyDate = new Date();
    notifyDate.setDate(today.getDate() + notifyBeforeDays);

    const upcomingPatients = await MorningShift.find({
      موعد_الخروج: {
        $lte: notifyDate,
        $gt: today
      }
    }).exec();

    res.json(upcomingPatients);
  } catch (err) {
    console.error('Error fetching upcoming patients:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/all-time-revenue', isAuthenticated, async (req, res) => {
  try {
    // Aggregate revenue for morning shift
    const morningRevenue = await MorningShift.aggregate([
      { $group: { _id: null, totalRevenue: { $sum: "$تم_دفع" } } }
    ]);

    // Aggregate revenue for night shift
    const nightRevenue = await NightShift.aggregate([
      { $group: { _id: null, totalRevenue: { $sum: "$تم_دفع" } } }
    ]);

    const totalRevenue = (morningRevenue[0]?.totalRevenue || 0) + (nightRevenue[0]?.totalRevenue || 0);

    res.status(200).json({ totalRevenue });
  } catch (error) {
    console.error('Error fetching all-time revenue:', error);
    res.status(500).json({ message: `Error: ${error.message}` });
  }
});

app.get('/morning-shift-revenue', isAuthenticated, async (req, res) => {
  try {
    const morningRevenue = await MorningShift.aggregate([
      { $group: { _id: null, totalRevenue: { $sum: "$تم_دفع" } } }
    ]);

    res.status(200).json({ totalRevenue: morningRevenue[0]?.totalRevenue || 0 });
  } catch (error) {
    console.error('Error fetching morning shift revenue:', error);
    res.status(500).json({ message: `Error: ${error.message}` });
  }
});


app.get('/night-shift-revenue', isAuthenticated, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of the day
    const endOfDay = new Date(today).setHours(23, 59, 59, 999); // End of the day

    const nightRevenue = await NightShift.aggregate([
      { $match: { date: { $gte: today, $lte: endOfDay } } },
      { $group: { _id: null, totalRevenue: { $sum: "$تم_دفع" } } }
    ]);

    res.status(200).json({ totalRevenue: nightRevenue[0]?.totalRevenue || 0 });
  } catch (error) {
    console.error('Error fetching night shift revenue:', error);
    res.status(500).json({ message: `Error: ${error.message}` });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

