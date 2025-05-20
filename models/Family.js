//This is the Mongoose database models for family.

const mongoose = require('mongoose');

const FamilySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  monthlyBudget: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'USD'
  }
});

const Family = mongoose.model('Family', FamilySchema);

module.exports = Family;