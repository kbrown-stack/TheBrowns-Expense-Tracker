const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middlewares/auth');
const mongoose = require('mongoose');

// Get all expenses
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const { Expense } = req.app.locals.models;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    
    // Filter setup
    const filter = { user: req.user._id };
    
    // Date range filter
    if (req.query.startDate && req.query.endDate) {
      filter.date = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    }
    
    // Category filter
    if (req.query.category && req.query.category !== 'all') {
      filter.category = mongoose.Types.ObjectId(req.query.category);
    }
    
    // Search query
    if (req.query.search) {
      filter.description = { $regex: req.query.search, $options: 'i' };
    }
    
    // Sort setup
    const sortField = req.query.sort || 'date';
    const sortOrder = req.query.order === 'asc' ? 1 : -1;
    const sortOptions = {};
    sortOptions[sortField] = sortOrder;
    
    // Execute query
    const expenses = await Expense.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .populate('category')
      .lean();
    
    // Get total count for pagination
    const total = await Expense.countDocuments(filter);
    const pages = Math.ceil(total / limit);
    
    // Get categories for filter dropdown
    const { Category } = req.app.locals.models;
    const categories = await Category.find({ user: req.user._id }).lean();
    
    // Calculate total amount
    const totalAmount = await Expense.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    
    res.render('pages/expenses/index', {
      title: 'Expenses',
      currentPath: req.path,
      expenses,
      categories,
      pagination: {
        page,
        pages,
        total,
        hasNext: page < pages,
        hasPrev: page > 1
      },
      filters: {
        startDate: req.query.startDate || '',
        endDate: req.query.endDate || '',
        category: req.query.category || 'all',
        search: req.query.search || '',
        sort: sortField,
        order: req.query.order || 'desc'
      },
      totalAmount: totalAmount[0]?.total || 0
    });
  } catch (err) {
    console.error('Error getting expenses:', err);
    req.flash('error', 'Failed to fetch expenses');
    res.redirect('/dashboard');
  }
});

// Display add expense form
router.get('/add', ensureAuthenticated, async (req, res) => {
  try {
    const { Category, User } = req.app.locals.models;
    const categories = await Category.find({ user: req.user._id }).lean();
    
    // Get family members for the "paid by" dropdown
    const familyMembers = await User.find({ 
      $or: [
        { _id: req.user._id },
        { familyId: req.user.familyId, _id: { $ne: req.user._id } }
      ]
    }).lean();
    
    res.render('pages/expenses/add', {
      title: 'Add Expense',
      currentPath: req.path,
      categories,
      familyMembers
    });
  } catch (err) {
    console.error('Error loading add expense form:', err);
    req.flash('error', 'Failed to load form');
    res.redirect('/expenses');
  }
});

// Create new expense
router.post('/', ensureAuthenticated, async (req, res) => {
  try {
    const { Expense } = req.app.locals.models;
    const { description, amount, category, date, notes, paidBy, paymentMethod } = req.body;
    
    const newExpense = new Expense({
      description,
      amount: parseFloat(amount),
      category,
      date,
      notes,
      paidBy: paidBy || req.user._id,
      paymentMethod,
      user: req.user._id
    });
    
    await newExpense.save();
    req.flash('success', 'Expense added successfully');
    res.redirect('/expenses');
  } catch (err) {
    console.error('Error adding expense:', err);
    req.flash('error', 'Failed to add expense');
    res.redirect('/expenses/add');
  }
});

// Display single expense
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { Expense } = req.app.locals.models;
    const expense = await Expense.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('category').populate('paidBy', 'name').lean();
    
    if (!expense) {
      req.flash('error', 'Expense not found');
      return res.redirect('/expenses');
    }
    
    res.render('pages/expenses/details', {
      title: 'Expense Details',
      currentPath: req.path,
      expense
    });
  } catch (err) {
    console.error('Error getting expense details:', err);
    req.flash('error', 'Failed to fetch expense details');
    res.redirect('/expenses');
  }
});

// Display edit expense form
router.get('/edit/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { Expense, Category, User } = req.app.locals.models;
    const [expense, categories, familyMembers] = await Promise.all([
      Expense.findOne({ _id: req.params.id, user: req.user._id }).lean(),
      Category.find({ user: req.user._id }).lean(),
      User.find({ 
        $or: [
          { _id: req.user._id },
          { familyId: req.user.familyId, _id: { $ne: req.user._id } }
        ]
      }).lean()
    ]);
    
    if (!expense) {
      req.flash('error', 'Expense not found');
      return res.redirect('/expenses');
    }
    
    // Format date for the input field
    expense.formattedDate = new Date(expense.date).toISOString().split('T')[0];
    
    res.render('pages/expenses/edit', {
      title: 'Edit Expense',
      currentPath: req.path,
      expense,
      categories,
      familyMembers
    });
  } catch (err) {
    console.error('Error loading edit expense form:', err);
    req.flash('error', 'Failed to load form');
    res.redirect('/expenses');
  }
});

// Update expense
router.put('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { Expense } = req.app.locals.models;
    const { description, amount, category, date, notes, paidBy, paymentMethod } = req.body;

    await Expense.findOneAndUpdate(
        { _id: req.params.id, user: req.user._id },
        {
          description,
          amount: parseFloat(amount),
          category,
          date,
          notes,
          paidBy,
          paymentMethod,
          updatedAt: Date.now()
        }
      );
      
      req.flash('success', 'Expense updated successfully');
      res.redirect('/expenses');
    } catch (err) {
      console.error('Error updating expense:', err);
      req.flash('error', 'Failed to update expense');
      res.redirect(`/expenses/edit/${req.params.id}`);
    }
  });

  // Delete expense
router.delete('/:id', ensureAuthenticated, async (req, res) => {
    try {
      const { Expense } = req.app.locals.models;
      await Expense.findOneAndDelete({ _id: req.params.id, user: req.user._id });
      
      req.flash('success', 'Expense deleted successfully');
      res.redirect('/expenses');
    } catch (err) {
      console.error('Error deleting expense:', err);
      req.flash('error', 'Failed to delete expense');
      res.redirect('/expenses');
    }
  });
  
  module.exports = router;