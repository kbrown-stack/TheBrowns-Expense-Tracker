//This is the Mongoose database models for Budget

const mongoose = require('mongoose');

const BudgetSchema = new mongoose.Schema({
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  month: {
    type: Number, // 1-12
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  familyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Family'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notifyThreshold: {
    type: Number,
    default: 80, // Percentage of budget at which to notify (80%)
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to ensure uniqueness for category, month, year, and family
BudgetSchema.index({ category: 1, month: 1, year: 1, familyId: 1 }, { unique: true });

const Budget = mongoose.model('Budget', BudgetSchema);

module.exports = Budget;