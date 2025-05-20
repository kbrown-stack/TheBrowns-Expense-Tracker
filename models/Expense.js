//This is the Mongoose database models for expense

const mongoose = require('mongoose');
const moment = require('moment');

const ExpenseSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  familyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Family'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'credit card', 'debit card', 'bank transfer', 'other'],
    default: 'cash'
  },
  receipt: {
    type: String // URL to uploaded receipt image
  },
  notes: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Virtual for month and year
ExpenseSchema.virtual('month').get(function() {
  return moment(this.date).format('MMMM');
});

ExpenseSchema.virtual('year').get(function() {
  return moment(this.date).format('YYYY');
});

// Set virtuals to be included in JSON output
ExpenseSchema.set('toJSON', { virtuals: true });
ExpenseSchema.set('toObject', { virtuals: true });

const Expense = mongoose.model('Expense', ExpenseSchema);

module.exports = Expense;