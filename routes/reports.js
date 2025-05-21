const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middlewares/auth');

// Monthly reports
router.get('/monthly', ensureAuthenticated, async (req, res) => {
  try {
    const { Expense } = req.app.locals.models;
    
    // Get selected month and year, default to current month/year
    const selectedMonth = parseInt(req.query.month) || new Date().getMonth() + 1;
    const selectedYear = parseInt(req.query.year) || new Date().getFullYear();
    
    // Define date range for query
    const startDate = new Date(selectedYear, selectedMonth - 1, 1);
    const endDate = new Date(selectedYear, selectedMonth, 0);
    
    // Get expenses for the month
    const expenses = await Expense.find({
      user: req.user._id,
      date: { $gte: startDate, $lte: endDate }
    }).populate('category').sort({ date: 1 }).lean();
    
    // Calculate total expenses
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    // Group expenses by category
    const expensesByCategory = await Expense.aggregate([
      { 
        $match: { 
          user: req.user._id,
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" }
        }
      },
      { $sort: { total: -1 } }
    ]);
    
    // Get category details
    const { Category } = req.app.locals.models;
    const categories = await Category.find({ 
      _id: { $in: expensesByCategory.map(item => item._id) }
    }).lean();
    
    // Merge category data
    const categoryData = expensesByCategory.map(item => {
      const category = categories.find(cat => cat._id.toString() === item._id.toString());
      return {
        name: category?.name || 'Unknown',
        color: category?.color || '#888888',
        total: item.total,
        percentage: (item.total / totalExpenses) * 100
      };
    });
    
    // Group expenses by day
    const expensesByDay = await Expense.aggregate([
      { 
        $match: { 
          user: req.user._id,
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $dayOfMonth: "$date" },
          total: { $sum: "$amount" }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Prepare data for daily chart
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const dailyData = [];
    const dailyLabels = [];
    
    for (let i = 1; i <= daysInMonth; i++) {
      dailyLabels.push(i);
      const dayExpense = expensesByDay.find(item => item._id === i);
      dailyData.push(dayExpense ? dayExpense.total : 0);
    }
    
    res.render('pages/reports/monthly', {
      title: 'Monthly Report',
      currentPath: req.path,
      expenses,
      totalExpenses,
      categoryData,
      month: selectedMonth,
      year: selectedYear,
      monthName: startDate.toLocaleString('default', { month: 'long' }),
      dailyData,
      dailyLabels
    });
  } catch (err) {
    console.error('Error generating monthly report:', err);
    req.flash('error', 'Failed to generate report');
    res.redirect('/dashboard');
  }
});

// Yearly reports
router.get('/yearly', ensureAuthenticated, async (req, res) => {
  try {
    const { Expense } = req.app.locals.models;
    
    // Get selected year, default to current year
    const selectedYear = parseInt(req.query.year) || new Date().getFullYear();
    
    // Define date range for query
    const startDate = new Date(selectedYear, 0, 1);
    const endDate = new Date(selectedYear, 11, 31);
    
    // Get expenses for the year
    const expenses = await Expense.find({
      user: req.user._id,
      date: { $gte: startDate, $lte: endDate }
    }).populate('category').sort({ date: 1 }).lean();
    
    // Calculate total expenses
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    // Group expenses by month
    const expensesByMonth = await Expense.aggregate([
      { 
        $match: { 
          user: req.user._id,
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $month: "$date" },
          total: { $sum: "$amount" }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Prepare monthly data for chart
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyData = [];
    
    for (let i = 1; i <= 12; i++) {
      const monthExpense = expensesByMonth.find(item => item._id === i);
      monthlyData.push(monthExpense ? monthExpense.total : 0);
    }
    
    // Group expenses by category
    const expensesByCategory = await Expense.aggregate([
      { 
        $match: { 
          user: req.user._id,
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" }
        }
      },
      { $sort: { total: -1 } }
    ]);
    
    // Get category details
    const { Category } = req.app.locals.models;
    const categories = await Category.find({ 
      _id: { $in: expensesByCategory.map(item => item._id) }
    }).lean();
    
    // Merge category data
    const categoryData = expensesByCategory.map(item => {
      const category = categories.find(cat => cat._id.toString() === item._id.toString());
      return {
        name: category?.name || 'Unknown',
        color: category?.color || '#888888',
        total: item.total,
        percentage: (item.total / totalExpenses) * 100
      };
    });
    
    res.render('pages/reports/yearly', {
      title: 'Yearly Report',
      currentPath: req.path,
      totalExpenses,
      categoryData,
      year: selectedYear,
      months,
      monthlyData
    });
  } catch (err) {
    console.error('Error generating yearly report:', err);
    req.flash('error', 'Failed to generate report');
    res.redirect('/dashboard');
  }
});

// Category-based reports
router.get('/category', ensureAuthenticated, async (req, res) => {
  try {
    const { Expense, Category } = req.app.locals.models;
    
    // Get selected category and date range
    const categoryId = req.query.category;
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    
    // Get all categories for the dropdown
    const categories = await Category.find({ user: req.user._id }).lean();
    
    // If no category is selected, just show the form
    if (!categoryId) {
      return res.render('pages/reports/category', {
        title: 'Category Report',
        currentPath: req.path,
        categories,
        expenses: [],
        category: null,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      });
    }
    
    // Get category details
    const category = await Category.findOne({ 
      _id: categoryId,
      user: req.user._id 
    }).lean();
    
    if (!category) {
      req.flash('error', 'Category not found');
      return res.redirect('/reports/category');
    }
    
    // Get expenses for this category in the date range
    const expenses = await Expense.find({
      user: req.user._id,
      category: categoryId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: -1 }).lean();
    
    // Calculate total
    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    res.render('pages/reports/category', {
      title: 'Category Report',
      currentPath: req.path,
      categories,
      category,
      expenses,
      total,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });
  } catch (err) {
    console.error('Error generating category report:', err);
    req.flash('error', 'Failed to generate report');
    res.redirect('/dashboard');
  }
});

module.exports = router;