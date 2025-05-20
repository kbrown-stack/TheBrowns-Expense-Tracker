// This is the controller for all business logic as regards to expense.

const Expense = require('../models/Expense');
const Category = require('../models/Category');
const Budget = require('../models/Budget');
const moment = require('moment');

// Display all expenses
exports.getExpenses = async (req, res) => {
  try {
    // Get query parameters for filtering
    const { month, year, category, startDate, endDate, sort = 'date' } = req.query;
    
    // Build filter object
    const filter = { 
      user: req.user.id,
      familyId: req.user.familyId
    };
    
    // Filter by month and year if provided
    if (month && year) {
      const startOfMonth = moment(`${year}-${month}-01`).startOf('month').toDate();
      const endOfMonth = moment(`${year}-${month}-01`).endOf('month').toDate();
      filter.date = { $gte: startOfMonth, $lte: endOfMonth };
    } else if (startDate && endDate) {
      // Filter by date range if provided
      filter.date = { 
        $gte: moment(startDate).startOf('day').toDate(),
        $lte: moment(endDate).endOf('day').toDate()
      };
    }
    
    // Filter by category if provided
    if (category && category !== 'all') {
      filter.category = category;
    }
    
    // Determine sort order
    const sortOptions = {};
    if (sort === 'amount-asc') {
      sortOptions.amount = 1;
    } else if (sort === 'amount-desc') {
      sortOptions.amount = -1;
    } else if (sort === 'date-asc') {
      sortOptions.date = 1;
    } else {
      sortOptions.date = -1; // Default: date descending (newest first)
    }
    
    // Fetch expenses with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    
    const expenses = await Expense.find(filter)
      .populate('category')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);
    
    const totalExpenses = await Expense.countDocuments(filter);
    const totalPages = Math.ceil(totalExpenses / limit);
    
    // Get categories for filter dropdown
    const categories = await Category.find({
      familyId: req.user.familyId
    });
    
    // Get months and years for filter dropdowns
    const distinctDates = await Expense.aggregate([
      { 
        $match: { 
          familyId: req.user.familyId 
        } 
      },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" }
          }
        }
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } }
    ]);
    
    const months = Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      name: moment().month(i).format('MMMM')
    }));
    
    const years = Array.from(
      new Set(distinctDates.map(date => date._id.year))
    ).sort((a, b) => b - a); // Sort descending
    
    res.render('expenses/index', {
      title: 'Expenses',
      expenses,
      categories,
      months,
      years,
      selectedMonth: month ? parseInt(month) : moment().month() + 1,
      selectedYear: year ? parseInt(year) : moment().year(),
      selectedCategory: category || 'all',
      selectedStartDate: startDate || '',
      selectedEndDate: endDate || '',
      selectedSort: sort,
      pagination: {
        page,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      moment
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error fetching expenses');
    res.redirect('/dashboard');
  }
};

// Display add expense form
exports.getAddExpense = async (req, res) => {
  try {
    const categories = await Category.find({
      familyId: req.user.familyId
    });
    
    res.render('expenses/add', {
      title: 'Add Expense',
      categories
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading form');
    res.redirect('/expenses');
  }
};

// Add new expense
exports.postAddExpense = async (req, res) => {
    try {
      const { description, amount, category, date, paymentMethod, notes } = req.body;
      
      // Basic validation
      if (!description || !amount || !category) {
        req.flash('error_msg', 'Please fill in all required fields');
        return res.redirect('/expenses/add');
      }
      
      // Create new expense
      const newExpense = new Expense({
        description,
        amount,
        category,
        date: date || Date.now(),
        user: req.user.id,
        familyId: req.user.familyId,
        paymentMethod,
        notes
      });
      
      await newExpense.save();
      
      // Check if this expense affects any budget
      const expenseDate = moment(newExpense.date);
      const month = expenseDate.month() + 1; // moment months are 0-indexed
      const year = expenseDate.year();
      
      const budget = await Budget.findOne({
        category: newExpense.category,
        month,
        year,
        familyId: req.user.familyId
      });
      
      if (budget) {
        // Calculate total spent in this category for this month
        const totalSpent = await Expense.aggregate([
          {
            $match: {
              category: budget.category,
              familyId: req.user.familyId,
              date: {
                $gte: moment(`${year}-${month}-01`).startOf('month').toDate(),
                $lte: moment(`${year}-${month}-01`).endOf('month').toDate()
              }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$amount" }
            }
          }
        ]);
        
        const spent = totalSpent[0]?.total || 0;
        const percentUsed = (spent / budget.amount) * 100;
        
        // Alert if over budget threshold
        if (percentUsed >= budget.notifyThreshold) {
          req.flash('warning_msg', `You've used ${percentUsed.toFixed(1)}% of your budget for this category this month`);
        }
      }
      
      req.flash('success_msg', 'Expense added successfully');
      res.redirect('/expenses');
    } catch (err) {
      console.error(err);
      req.flash('error_msg', 'Error adding expense');
      res.redirect('/expenses/add');
    }
  };
  
  // Display edit expense form
  exports.getEditExpense = async (req, res) => {
    try {
      const expense = await Expense.findOne({
        _id: req.params.id,
        familyId: req.user.familyId
      });
      
      if (!expense) {
        req.flash('error_msg', 'Expense not found');
        return res.redirect('/expenses');
      }
      
      // Check if user is the owner or admin
      if (expense.user.toString() !== req.user.id && req.user.role !== 'admin') {
        req.flash('error_msg', 'Not authorized');
        return res.redirect('/expenses');
      }
      
      const categories = await Category.find({
        familyId: req.user.familyId
      });
      
      res.render('expenses/edit', {
        title: 'Edit Expense',
        expense,
        categories,
        moment
      });
    } catch (err) {
      console.error(err);
      req.flash('error_msg', 'Error loading expense');
      res.redirect('/expenses');
    }
  };
  
  // Update expense
  exports.updateExpense = async (req, res) => {
    try {
      const { description, amount, category, date, paymentMethod, notes } = req.body;
      
      const expense = await Expense.findOne({
        _id: req.params.id,
        familyId: req.user.familyId
      });
      
      if (!expense) {
        req.flash('error_msg', 'Expense not found');
        return res.redirect('/expenses');
      }
      
      // Check if user is the owner or admin
      if (expense.user.toString() !== req.user.id && req.user.role !== 'admin') {
        req.flash('error_msg', 'Not authorized');
        return res.redirect('/expenses');
      }
      
      // Update expense
      expense.description = description;
      expense.amount = amount;
      expense.category = category;
      expense.date = date || expense.date;
      expense.paymentMethod = paymentMethod;
      expense.notes = notes;
      
      await expense.save();
      
      req.flash('success_msg', 'Expense updated successfully');
      res.redirect('/expenses');
    } catch (err) {
      console.error(err);
      req.flash('error_msg', 'Error updating expense');
      res.redirect(`/expenses/edit/${req.params.id}`);
    }
  };
  
  // Delete expense
  exports.deleteExpense = async (req, res) => {
    try {
      const expense = await Expense.findOne({
        _id: req.params.id,
        familyId: req.user.familyId
      });
      
      if (!expense) {
        req.flash('error_msg', 'Expense not found');
        return res.redirect('/expenses');
      }
      
      // Check if user is the owner or admin
      if (expense.user.toString() !== req.user.id && req.user.role !== 'admin') {
        req.flash('error_msg', 'Not authorized');
        return res.redirect('/expenses');
      }
      
      await expense.deleteOne();
      
      req.flash('success_msg', 'Expense deleted successfully');
      res.redirect('/expenses');
    } catch (err) {
      console.error(err);
      req.flash('error_msg', 'Error deleting expense');
      res.redirect('/expenses');
    }
  };