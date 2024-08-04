// models/MorningShift.js
const mongoose = require('mongoose');

const morningShiftSchema = new mongoose.Schema({
  الاسم: { type: String, required: true },
  رقم_الغرفة: { type: String, required: true },
  تم_دفع: { type: Number, required: true },
  متبقي: { type: Number, required: true },
  موعد_الدخول: { type: Date, required: true },
  موعد_الخروج: { type: Date, required: true },
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MorningShift', morningShiftSchema);
