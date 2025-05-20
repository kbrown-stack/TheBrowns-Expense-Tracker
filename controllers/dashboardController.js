// This is the controller for  business logic as regards to the Dashboard.

const Expense = require('../models/Expense');
const Budget = require('../models/Budget');
const Category = require('../models/Category');
const User = require('../models/User');
const Family = require('../models/Family');
const moment = require('moment');

// Dashboard home
exports.getDashboard = async (req, res) => {
  try {
    // Get query parameters for filtering
    const { month, year } = req.query;
    const currentMonth = parseInt(month) || moment().month() + 1;
    const currentYear = parseInt(year) || moment().year();
    
    // Date range for current month
    const startOfMonth = moment(`${currentYear}-${currentMonth}-01`).startOf('month').toDate();
    const endOfMonth = moment(`${currentYear}-${currentMonth}-01`).endOf('month').toDate();
    
    // Get total expenses for current month
    const totalExpenses = await Expense.aggregate([
      {
        $match: {
          familyId: req.user.familyId,
          date: {
            $gte: startOfMonth,
            $lte: endOfMonth
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
    
    const totalExpenseAmount = totalExpenses[0]?.total || 0;
    
    // Get expenses by category for current month
    const expensesByCategory = await Expense.aggregate([
      {
        $match: {
          familyId: req.user.familyId,
          date: {
            $gte: startOfMonth,
            $lte: endOfMonth
          }
        }
      },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" }
        }
      },
      {
        $sort: { total: -1 }
      }
    ]);
    
    // Get category details
    const categoryIds = expensesByCategory.map(item => item._id);
    const categories = await Category.find({
      _id: { $in: categoryIds }
    });
    
    // Combine category data with totals
    const categoriesWithData = expensesByCategory.map(expense => {
      const category = categories.find(cat => cat._id.toString() === expense._id.toString());
      return {
        _id: expense._id,
        name: category ? category.name : 'Unknown Category',
        color: category ? category.color : '#ccc',
        icon: category ? category.icon : 'question',
        total: expense.total,
        percentage: ((expense.total / totalExpenseAmount) * 100).toFixed(1)
      };
    });
    
    // Get expenses by user for current month
    const expensesByUser = await Expense.aggregate([
      {
        $match: {
          familyId: req.user.familyId,
          date: {
            $gte: startOfMonth,
            $lte: endOfMonth
          }
        }
      },
      {
        $group: {
          _id: "$user",
          total: { $sum: "$amount" }
        }
      },
      {
        $sort: { total: -1 }
      }
    ]);
    
    // Get user details
    const userIds = expensesByUser.map(item => item._id);
    const users = await User.find({
      _id: { $in: userIds }
    });
    
    // Combine user data with totals
    const usersWithData = expensesByUser.map(expense => {
      const user = users.find(u => u._id.toString() === expense._id.toString());
      return {
        _id: expense._id,
        name: user ? user.name : 'Unknown User',
        total: expense.total,
        percentage: ((expense.total / totalExpenseAmount) * 100).toFixed(1)
      };
    });
    
    // Get expense trends for the past 6 months
    const sixMonthsAgo = moment().subtract(6, 'months').startOf('month').toDate();
    
    const expenseTrend = await Expense.aggregate([
      {
        $match: {
          familyId: req.user.familyId,
          date: {
            $gte: sixMonthsAgo
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" }
          },
          total: { $sum: "$amount" }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 }
      }
    ]);
    
    // Format trend data for charts
    const trendData = expenseTrend.map(item => ({
      month: moment(`${item._id.year}-${item._id.month}-01`).format('MMM YY'),
      total: item.total
    }));
    
    // Get budget vs actual for the current month
    const budgets = await Budget.find({
      familyId: req.user.familyId,
      month: currentMonth,
      year: currentYear
    }).populate('category');
    
    // Calculate spending for each budget category
    const budgetsWithSpending = await Promise.all(budgets.map(async (budget) => {
      const totalSpent = await Expense.aggregate([
        {
          $match: {
            category: budget.category._id,
            familyId: req.user.familyId,
            date: {
              $gte: startOfMonth,
              $lte: endOfMonth
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
      
      return {
        ...budget.toObject(),
        spent,
        remaining: budget.amount - spent,
        percentUsed: percentUsed.toFixed(1)
      };
    }));
    
    // Get recent expenses
    const recentExpenses = await Expense.find({
      familyId: req.user.familyId
    })
      .populate('category')
      .populate('user', 'name')
      .sort({ date: -1 })
      .limit(5);
    
    // Get family details
    const family = await Family.findById(req.user.familyId);
    
    // Calculate total monthly budget
    const totalBudget = budgets.reduce((sum, budget) => sum + budget.amount, 0);
    
    // Get months and years for filter dropdowns
    const months = Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      name: moment().month(i).format('MMMM')
    }));
    
    const years = [];
    const currentYearNum = moment().year();
    for (let i = currentYearNum - 2; i <= currentYearNum + 2; i++) {
      years.push(i);
    }
    
    res.render('dashboard/index', {
      title: 'Dashboard',
      totalExpenseAmount,
      totalBudget,
      budgetRemaining: totalBudget - totalExpenseAmount,
      budgetUsedPercentage: totalBudget > 0 ? ((totalExpenseAmount / totalBudget) * 100).toFixed(1) : 0,
      categoriesWithData,
      usersWithData,
      trendData,
      budgetsWithSpending,
      recentExpenses,
      family,
      months,
      years,
      selectedMonth: currentMonth,
      selectedYear: currentYear,
      moment
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading dashboard');
    res.render('dashboard/index', {
      title: 'Dashboard',
      error: 'Could not load dashboard data'
    });
  }
};

// Generate report
exports.generateReport = async (req, res) => {
  try {
    const { month, year, reportType } = req.body;
    
    // Date range for selected month
    const startOfMonth = moment(`${year}-${month}-01`).startOf('month').toDate();
    const endOfMonth = moment(`${year}-${month}-01`).endOf('month').toDate();
    
    // Different reports based on type
    let reportData = {};
    let reportTitle = '';
    
    if (reportType === 'category') {
      // Report by category
      const expensesByCategory = await Expense.aggregate([
        {
          $match: {
            familyId: req.user.familyId,
            date: {
              $gte: startOfMonth,
              $lte: endOfMonth
            }
          }
        },
        {
          $group: {
            _id: "$category",
            total: { $sum: "$amount" },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { total: -1 }
        }
      ]);
      
      // Get category details
      const categoryIds = expensesByCategory.map(item => item._id);
      const categories = await Category.find({
        _id: { $in: categoryIds }
      });
      
      // Combine category data with totals
      reportData = {
        categories: expensesByCategory.map(expense => {
          const category = categories.find(cat => cat._id.toString() === expense._id.toString());
          return {
            name: category ? category.name : 'Unknown Category',
            total: expense.total,
            count: expense.count
          };
        }),
        totalAmount: expensesByCategory.reduce((sum, cat) => sum + cat.total, 0)
      };
      
      reportTitle = 'Expenses by Category';
    } else if (reportType === 'user') {
      // Report by user
      const expensesByUser = await Expense.aggregate([
        {
          $match: {
            familyId: req.user.familyId,
            date: {
              $gte: startOfMonth,
              $lte: endOfMonth
            }
          }
        },
        {
          $group: {
            _id: "$user",
            total: { $sum: "$amount" },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { total: -1 }
        }
      ]);
      
      // Get user details
      const userIds = expensesByUser.map(item => item._id);
      const users = await User.find({
        _id: { $in: userIds }
      });
      
      // Combine user data with totals
      reportData = {
        users: expensesByUser.map(expense => {
          const user = users.find(u => u._id.toString() === expense._id.toString());
          return {
            name: user ? user.name : 'Unknown User',
            total: expense.total,
            count: expense.count
          };
        }),
        totalAmount: expensesByUser.reduce((sum, user) => sum + user.total, 0)
      };
      
      reportTitle = 'Expenses by User';
    } else if (reportType === 'budget') {
      // Budget compliance report
      const budgets = await Budget.find({
        familyId: req.user.familyId,
        month: parseInt(month),
        year: parseInt(year)
      }).populate('category');
      
      // Calculate spending for each budget category
      const budgetsWithSpending = await Promise.all(budgets.map(async (budget) => {
        const totalSpent = await Expense.aggregate([
          {
            $match: {
              category: budget.category._id,
              familyId: req.user.familyId,
              date: {
                $gte: startOfMonth,
                $lte: endOfMonth
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
        
        return {
          categoryName: budget.category.name,
          budget: budget.amount,
          spent,
          remaining: budget.amount - spent,
          percentUsed: percentUsed.toFixed(1),
          status: percentUsed > 100 ? 'Over Budget' : 'Within Budget'
        };
      }));
      
      reportData = {
        budgets: budgetsWithSpending,
        totalBudget: budgetsWithSpending.reduce((sum, budget) => sum + budget.budget, 0),
        totalSpent: budgetsWithSpending.reduce((sum, budget) => sum + budget.spent, 0)
      };
      
      reportTitle = 'Budget Compliance Report';
    }
    
    res.render('dashboard/report', {
      title: reportTitle,
      reportType,
      reportData,
      month: months[parseInt(month) - 1].name,
      year,
      moment
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error generating report');
    res.redirect('/dashboard');
  }
};

// Get months array for reports
const months = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  name: moment().month(i).format('MMMM')
}));