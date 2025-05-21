const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middlewares/auth');

// Get budget overview
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const { Budget, Category, Expense } = req.app.locals.models;
    
    // Get current month and year
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    // Find active budget
    const budget = await Budget.findOne({
      user: req.user._id,
      month: currentMonth,
      year: currentYear
    }).populate('categories.category').lean();
    
    if (!budget) {
      return res.render('pages/budget/index', {
        title: 'Budget',
        currentPath: req.path,
        budget: null,
        totalBudget: 0,
        totalSpent: 0,
        totalRemaining: 0,
        categories: [],
        hasBudget: false
      });
    }
    
    // Get total expenses for current month
    const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth, 0);
    
    const categoryExpenses = await Expense.aggregate([
      { 
        $match: { 
          user: req.user._id,
          date: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
        }
      },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" }
        }
      }
    ]);
    
    // Calculate budget statistics
    let totalBudget = 0;
    let totalSpent = 0;
    
    const budgetCategories = budget.categories.map(budgetCat => {
      const expenseData = categoryExpenses.find(exp => 
        exp._id.toString() === budgetCat.category._id.toString());
      
      const amount = budgetCat.amount || 0;
      const spent = expenseData ? expenseData.total : 0;
      const remaining = amount - spent;
      const percentage = amount > 0 ? (spent / amount) * 100 : 0;
      
      totalBudget += amount;
      totalSpent += spent;
      
      return {
        ...budgetCat,
        spent,
        remaining,
        percentage
      };
    });
    
    const totalRemaining = totalBudget - totalSpent;
    const overallPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    
    res.render('pages/budget/index', {
      title: 'Budget',
      currentPath: req.path,
      budget: {
        ...budget,
        categories: budgetCategories,
        totalBudget,
        totalSpent,
        totalRemaining,
        overallPercentage
      },
      hasBudget: true,
      month: currentMonth,
      year: currentYear,
      monthName: new Date(currentYear, currentMonth - 1).toLocaleString('default', { month: 'long' })
    });
  } catch (err) {
    console.error('Error getting budget:', err);
    req.flash('error', 'Failed to load budget information');
    res.redirect('/dashboard');
  }
});

// Display create budget form
router.get('/create', ensureAuthenticated, async (req, res) => {
  try {
    const { Category, Budget } = req.app.locals.models;
    
    // Get current month and year
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const year = parseInt(req.query.year) || new Date().getFullYear();
    
    // Check if budget already exists for this month/year
    const existingBudget = await Budget.findOne({
      user: req.user._id,
      month,
      year
    });
    
    if (existingBudget) {
      req.flash('info', 'Budget already exists for this period. Redirecting to edit page.');
      return res.redirect(`/budget/edit/${existingBudget._id}`);
    }
    
    // Get all categories
    const categories = await Category.find({ user: req.user._id }).lean();
    
    res.render('pages/budget/create', {
      title: 'Create Budget',
      currentPath: req.path,
      categories,
      month,
      year,
      monthName: new Date(year, month - 1).toLocaleString('default', { month: 'long' })
    });
  } catch (err) {
    console.error('Error loading create budget form:', err);
    req.flash('error', 'Failed to load form');
    res.redirect('/budget');
  }
});

// Create new budget
router.post('/', ensureAuthenticated, async (req, res) => {
  try {
    const { Budget } = req.app.locals.models;
    const { month, year, totalAmount, categories } = req.body;
    
    // Check if budget already exists for this month/year
    const existingBudget = await Budget.findOne({
      user: req.user._id,
      month: parseInt(month),
      year: parseInt(year)
    });
    
    if (existingBudget) {
      req.flash('error', 'Budget already exists for this period');
      return res.redirect('/budget');
    }
    
    // Process category budget amounts
    const budgetCategories = [];
    
    // If categories is an array (multiple categories)
    if (Array.isArray(categories)) {
      for (let i = 0; i < categories.length; i++) {
        const category = categories[i];
        const amount = req.body[`amount_${category}`];
        
        if (amount && parseFloat(amount) > 0) {
          budgetCategories.push({
            category,
            amount: parseFloat(amount)
          });
        }
      }
    } 
    // If categories is a single value
    else if (categories) {
      const amount = req.body[`amount_${categories}`];
      
      if (amount && parseFloat(amount) > 0) {
        budgetCategories.push({
          category: categories,
          amount: parseFloat(amount)
        });
      }
    }
    
    const newBudget = new Budget({
      month: parseInt(month),
      year: parseInt(year),
      totalAmount: parseFloat(totalAmount),
      categories: budgetCategories,
      user: req.user._id
    });
    
    await newBudget.save();
    req.flash('success', 'Budget created successfully');
    res.redirect('/budget');
  } catch (err) {
    console.error('Error creating budget:', err);
    req.flash('error', 'Failed to create budget');
    res.redirect('/budget/create');
  }
});

// Display edit budget form
router.get('/edit/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { Budget, Category } = req.app.locals.models;
    
    // Get budget and categories
    const [budget, categories] = await Promise.all([
      Budget.findOne({ _id: req.params.id, user: req.user._id }).lean(),
      Category.find({ user: req.user._id }).lean()
    ]);
    
    if (!budget) {
      req.flash('error', 'Budget not found');
      return res.redirect('/budget');
    }
    
    // Create a map of category amounts for easier access in the view
    const categoryAmounts = {};
    budget.categories.forEach(item => {
      categoryAmounts[item.category.toString()] = item.amount;
    });
    
    res.render('pages/budget/edit', {
      title: 'Edit Budget',
      currentPath: req.path,
      budget,
      categories,
      categoryAmounts,
      monthName: new Date(budget.year, budget.month - 1).toLocaleString('default', { month: 'long' })
    });
  } catch (err) {
    console.error('Error loading edit budget form:', err);
    req.flash('error', 'Failed to load form');
    res.redirect('/budget');
  }
});

// Update budget
router.put('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { Budget } = req.app.locals.models;
    const { totalAmount, categories } = req.body;
    
    // Process category budget amounts
    const budgetCategories = [];
    
    // If categories is an array (multiple categories)
    if (Array.isArray(categories)) {
      for (let i = 0; i < categories.length; i++) {
        const category = categories[i];
        const amount = req.body[`amount_${category}`];
        
        if (amount && parseFloat(amount) > 0) {
          budgetCategories.push({
            category,
            amount: parseFloat(amount)
          });
        }
      }
    } 
    // If categories is a single value
    else if (categories) {
      const amount = req.body[`amount_${categories}`];
      
      if (amount && parseFloat(amount) > 0) {
        budgetCategories.push({
          category: categories,
          amount: parseFloat(amount)
        });
      }
    }
    
    await Budget.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      {
        totalAmount: parseFloat(totalAmount),
        categories: budgetCategories,
        updatedAt: Date.now()
      }
    );
    
    req.flash('success', 'Budget updated successfully');
    res.redirect('/budget');
  } catch (err) {
    console.error('Error updating budget:', err);
    req.flash('error', 'Failed to update budget');
    res.redirect(`/budget/edit/${req.params.id}`);
  }
});

module.exports = router;
