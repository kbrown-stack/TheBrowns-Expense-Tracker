const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middlewares/auth');

// Home route
router.get('/', (req, res) => {
  // If user is logged in, redirect to dashboard
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  res.render('pages/auth/login', { 
    title: 'Welcome',
    currentPath: req.path
  });
});

// Dashboard route (This is protected route)
router.get('/dashboard', ensureAuthenticated, async (req, res) => {
  try {
    const { Expense, Category } = req.app.locals.models;
    const userId = req.user._id;
    
    // Brown Get total expenses for current month
    const currentDate = new Date();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    const totalMonthlyExpenses = await Expense.aggregate([
      { 
        $match: { 
          user: userId,
          date: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);
    
    // Get budget remaining
    const budget = 50000; // This should come from your budget model
    const budgetRemaining = budget - (totalMonthlyExpenses[0]?.total || 0);
    
    // Get highest expense category
    const highestCategory = await Expense.aggregate([
      { $match: { user: userId } },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
      { $sort: { total: -1 } },
      { $limit: 1 }
    ]);
    
    let categoryDetail = { name: "None" };
    if (highestCategory.length > 0) {
      categoryDetail = await Category.findById(highestCategory[0]._id);
    }
    
    // Get category count
    const categoriesCount = await Category.countDocuments({ user: userId });
    
    // Get recent expenses
    const recentExpenses = await Expense.find({ user: userId })
      .sort({ date: -1 })
      .limit(5)
      .populate('category');
    
    // Get monthly expense data for chart
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    
    const monthlyExpenses = await Expense.aggregate([
      { 
        $match: { 
          user: userId,
          date: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: { month: { $month: "$date" }, year: { $year: "$date" } },
          total: { $sum: "$amount" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyLabels = [];
    const monthlyData = [];
    
    for (let i = 0; i < 6; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - 5 + i);
      const month = date.getMonth();
      const year = date.getFullYear();
      
      monthlyLabels.push(`${months[month]} ${year}`);
      
      const expenseData = monthlyExpenses.find(item => 
        item._id.month === month + 1 && item._id.year === year);
      
      monthlyData.push(expenseData ? expenseData.total : 0);
    }
    
    // Get category expense data for chart
    const categoryExpenses = await Expense.aggregate([
      { $match: { user: userId } },
      { $group: { _id: "$category", total: { $sum: "$amount" } } }
    ]);
    
    const categoryLabels = [];
    const categoryData = [];
    const categoryColors = [];
    
    await Promise.all(categoryExpenses.map(async (item) => {
      const category = await Category.findById(item._id);
      if (category) {
        categoryLabels.push(category.name);
        categoryData.push(item.total);
        categoryColors.push(category.color || '#' + Math.floor(Math.random()*16777215).toString(16));
      }
    }));
    
    res.render('pages/dashboard', {
      title: 'Dashboard',
      currentPath: req.path,
      totalMonthlyExpenses: totalMonthlyExpenses[0]?.total || 0,
      budgetRemaining,
      highestCategory: categoryDetail,
      categoriesCount,
      recentExpenses,
      monthlyLabels,
      monthlyData,
      categoryLabels,
      categoryData,
      categoryColors
    });
    
  } catch (err) {
    console.error('Dashboard error:', err);
    req.flash('error', 'Failed to load dashboard data');
    res.render('pages/dashboard', {
      title: 'Dashboard',
      currentPath: req.path,
      totalMonthlyExpenses: 0,
      budgetRemaining: 0,
      highestCategory: { name: 'None' },
      categoriesCount: 0,
      recentExpenses: [],
      monthlyLabels: [],
      monthlyData: [],
      categoryLabels: [],
      categoryData: [],
      categoryColors: []
    });
  }
});

module.exports = router;